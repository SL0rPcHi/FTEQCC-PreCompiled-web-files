(() => {
    const storageKey = "fte-qc-development-suite-project-v1";
    const starterFiles = {
        "progs.src": "progs.dat\nmain.qc\n",
        "main.qc": "// Your QuakeC project starts here.\nvoid() main =\n{\n};\n"
    };
    const files = new Map(Object.entries(loadProject()));
    const initialManifest = files.has("progs.src") ? "progs.src" :
        [...files.keys()].find((name) => isSourceManifest(name)) || "";
    const initialActiveFile = files.has("main.qc") ? "main.qc" :
        [...files.keys()].find((name) => !isSourceManifest(name)) || initialManifest;
    const openedFiles = new Set(initialActiveFile ? [initialActiveFile] : []);
    const dirtyFiles = new Set();
    const windows = new Map([...document.querySelectorAll("[data-window]")].map((element) => [element.dataset.window, element]));
    const desktop = document.getElementById("desktop");
    const fileList = document.getElementById("project-files");
    const tabs = document.getElementById("document-tabs");
    const statusMessage = document.getElementById("status-message");
    const toast = document.getElementById("toast");
    const fileInput = document.getElementById("file-input");
    const editor = CodeMirror(document.getElementById("editor-host"), {
        value: initialActiveFile && !isSourceManifest(initialActiveFile) ? files.get(initialActiveFile) || "" : "",
        mode: "text/x-csrc",
        lineNumbers: true,
        matchBrackets: true,
        indentUnit: 4,
        indentWithTabs: true,
        tabSize: 4,
        lineWrapping: false,
        autofocus: true,
        extraKeys: {
            "Ctrl-S": saveProject,
            "Cmd-S": saveProject,
            "Ctrl-Enter": compileProject,
            "Cmd-Enter": compileProject,
            "Ctrl-F": findInFile,
            "Cmd-F": findInFile
        }
    });

    let activeFile = initialActiveFile;
    let selectedManifest = initialManifest;
    let highestZ = 5;
    let toastTimer;
    let compilerOptions = loadOptions();
    let lastBuild = null;

    function loadProject() {
        try {
            const stored = JSON.parse(localStorage.getItem(storageKey));
            return stored && stored.files && typeof stored.files === "object" ? stored.files : starterFiles;
        } catch (_) {
            return starterFiles;
        }
    }

    function loadOptions() {
        try {
            return JSON.parse(localStorage.getItem(`${storageKey}-options`)) || {};
        } catch (_) {
            return {};
        }
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("visible"), 2300);
    }

    function setStatus(message) {
        statusMessage.textContent = message;
    }

    function isSourceManifest(name) {
        return typeof name === "string" && name.toLowerCase().endsWith(".src");
    }

    function renderBuildManifests() {
        const selector = document.getElementById("build-manifest");
        const names = [...files.keys()].filter(isSourceManifest).sort((left, right) => {
            if (left === "progs.src") return -1;
            if (right === "progs.src") return 1;
            return left.localeCompare(right);
        });
        if (!names.includes(selectedManifest)) selectedManifest = names[0] || "";
        selector.replaceChildren(...names.map((name) => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            return option;
        }));
        selector.value = selectedManifest;
        selector.disabled = names.length === 0;
    }

    function escapeName(name) {
        return name.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    }

    function renderProject() {
        const names = [...files.keys()].sort((left, right) => {
            if (left === "progs.src") return -1;
            if (right === "progs.src") return 1;
            return left.localeCompare(right);
        });
        fileList.replaceChildren(...names.map((name) => {
            const row = document.createElement("div");
            row.className = "project-file-row";
            const button = document.createElement("button");
            button.type = "button";
            button.className = `project-file${name === activeFile ? " active" : ""}`;
            button.setAttribute("role", "treeitem");
            button.title = name;
            button.innerHTML = `<span class="file-glyph" aria-hidden="true">${name.endsWith(".src") ? "L" : "Q"}</span><span>${escapeName(name)}</span>`;
            button.addEventListener("click", () => openFile(name));
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "project-file-delete";
            deleteButton.textContent = "×";
            deleteButton.title = `Delete ${name}`;
            deleteButton.setAttribute("aria-label", `Delete ${name}`);
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                deleteProjectFile(name);
            });
            row.append(button, deleteButton);
            return row;
        }));
        renderBuildManifests();
        document.getElementById("status-project").textContent = `${names.filter((name) => name.endsWith(".qc")).length} source file${names.filter((name) => name.endsWith(".qc")).length === 1 ? "" : "s"}`;
    }

    function renderTabs() {
        tabs.replaceChildren(...[...openedFiles].map((name) => {
            const button = document.createElement("button");
            button.type = "button";
            button.role = "tab";
            button.className = `document-tab${name === activeFile ? " active" : ""}${dirtyFiles.has(name) ? " dirty" : ""}`;
            button.textContent = name;
            button.setAttribute("aria-selected", name === activeFile ? "true" : "false");
            button.addEventListener("click", () => openFile(name));
            return button;
        }));
    }

    function updateEditorStatus() {
        const cursor = editor.getCursor();
        document.getElementById("cursor-position").textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
        document.getElementById("file-state").textContent = dirtyFiles.has(activeFile) ? "Modified" : "Saved";
    }

    function openFile(name) {
        if (!files.has(name)) return;
        if (activeFile) {
            files.set(activeFile, isSourceManifest(activeFile) ? document.getElementById("manifest-editor").value : editor.getValue());
        }
        activeFile = name;
        openedFiles.add(name);
        if (isSourceManifest(name)) {
            selectedManifest = name;
            windows.get("manifest").hidden = false;
            bringToFront("manifest");
            document.getElementById("manifest-editor").value = files.get(name);
            document.getElementById("manifest-title").textContent = `${name} - Project Files`;
        } else {
            editor.setValue(files.get(name));
            document.getElementById("editor-title").textContent = `${name} - FTEQCC Editor`;
            windows.get("editor").hidden = false;
            bringToFront("editor");
            editor.refresh();
        }
        document.getElementById("file-state").textContent = "Saved";
        renderProject();
        renderTabs();
    }

    function saveProject() {
        if (activeFile && isSourceManifest(activeFile)) files.set(activeFile, document.getElementById("manifest-editor").value);
        else if (activeFile) files.set(activeFile, editor.getValue());
        try {
            localStorage.setItem(storageKey, JSON.stringify({ files: Object.fromEntries(files) }));
            dirtyFiles.clear();
            document.getElementById("file-state").textContent = "Saved";
            renderTabs();
            setStatus("Project saved in this browser");
            showToast("Project saved in this browser.");
        } catch (_) {
            showToast("Browser storage is full. Download your source files to keep a copy.");
        }
    }

    function deleteProjectFile(name) {
        if (!files.has(name) || !window.confirm(`Delete ${name} from this browser project? This cannot be undone.`)) return;

        const deletingActiveFile = activeFile === name;
        if (activeFile && !deletingActiveFile) {
            if (isSourceManifest(activeFile)) files.set(activeFile, document.getElementById("manifest-editor").value);
            else files.set(activeFile, editor.getValue());
        }

        files.delete(name);
        openedFiles.delete(name);
        dirtyFiles.delete(name);

        if (!isSourceManifest(name)) {
            for (const manifestName of [...files.keys()].filter(isSourceManifest)) {
                const manifest = files.get(manifestName);
                const updatedManifest = manifest.split(/\r?\n/).filter((line) => line.trim() !== name).join("\n");
                if (updatedManifest !== manifest) {
                    files.set(manifestName, updatedManifest);
                    if (activeFile === manifestName) document.getElementById("manifest-editor").value = updatedManifest;
                }
            }
        }

        if (isSourceManifest(name) && deletingActiveFile) {
            windows.get("manifest").hidden = true;
            document.getElementById("manifest-editor").value = "";
        }

        if (deletingActiveFile) {
            activeFile = "";
            const nextFile = [...files.keys()].find((fileName) => !isSourceManifest(fileName)) ||
                [...files.keys()].find(isSourceManifest) || "";
            if (nextFile) {
                openFile(nextFile);
                dirtyFiles.delete(nextFile);
            } else {
                editor.setValue("");
                document.getElementById("editor-title").textContent = "No source file";
                document.getElementById("file-state").textContent = "Saved";
                windows.get("manifest").hidden = true;
                windows.get("editor").hidden = false;
                bringToFront("editor");
            }
        }

        renderProject();
        renderTabs();
        saveProject();
        setStatus(`Deleted ${name} from this browser project`);
        showToast(`${name} deleted from this browser project.`);
    }

    function safeFilename(name) {
        const basename = name.split(/[\\/]/).pop().trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
        return basename && basename !== "." && basename !== ".." ? basename : "source.qc";
    }

    function downloadFile(name, data, type) {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function downloadActiveFile() {
        const content = isSourceManifest(activeFile) ? document.getElementById("manifest-editor").value : editor.getValue();
        files.set(activeFile, content);
        downloadFile(activeFile, content, "text/plain;charset=utf-8");
    }

    function createFile() {
        const entered = prompt("New QuakeC file name", "newfile.qc");
        if (!entered) return;
        const name = safeFilename(entered);
        if (files.has(name)) {
            showToast(`${name} already exists.`);
            return;
        }
        files.set(name, "");
        openedFiles.add(name);
        activeFile = name;
        editor.setValue("");
        document.getElementById("editor-title").textContent = `${name} - FTEQCC Editor`;
        renderProject();
        renderTabs();
        bringToFront("editor");
        editor.focus();
    }

    async function importFiles(fileObjects) {
        for (const file of fileObjects) {
            const name = safeFilename(file.name);
            files.set(name, await file.text());
            if (isSourceManifest(name)) {
                openedFiles.add(name);
                activeFile = name;
                selectedManifest = name;
                document.getElementById("manifest-editor").value = files.get(name);
                document.getElementById("manifest-title").textContent = `${name} - Project Files`;
            } else if (name.endsWith(".qc") || name.endsWith(".qh")) {
                openedFiles.add(name);
                activeFile = name;
                editor.setValue(files.get(name));
                document.getElementById("editor-title").textContent = `${name} - FTEQCC Editor`;
            }
        }
        renderProject();
        renderTabs();
        saveProject();
        bringToFront("editor");
        editor.refresh();
    }

    function findInFile() {
        const input = document.getElementById("project-find-input");
        const query = input.value.trim();
        if (!query) {
            input.focus();
            return;
        }
        let cursor = editor.getSearchCursor(query, editor.getCursor());
        if (!cursor.findNext()) {
            cursor = editor.getSearchCursor(query, { line: 0, ch: 0 });
            if (!cursor.findNext()) {
                showToast(`No match for “${query}”.`);
                return;
            }
        }
        editor.setSelection(cursor.from(), cursor.to());
        editor.focus();
    }

    function orderedSourceFiles(manifestName) {
        if (manifestName && files.has(manifestName)) {
            return ["-s", manifestName];
        }
        return [...files.keys()].filter((name) => name.endsWith(".qc"));
    }

    async function compileProject() {
        const output = document.getElementById("compiler-output");
        const status = document.getElementById("compile-status");
        const downloadButton = document.getElementById("download-build");
        const manifestName = selectedManifest;
        const manifestFirstLine = manifestName && files.has(manifestName)
            ? files.get(manifestName).split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("//"))
            : "";
        const configuredOutput = safeFilename(document.getElementById("output-name").value || "progs.dat");
        const outputName = manifestFirstLine && configuredOutput === "progs.dat"
            ? safeFilename(manifestFirstLine)
            : configuredOutput;
        const options = {
            standard: document.getElementById("standard-select").value,
            optimization: document.getElementById("optimization-select").value,
            output: outputName,
            quiet: document.getElementById("quiet-option").checked
        };
        localStorage.setItem(`${storageKey}-options`, JSON.stringify(options));
        compilerOptions = options;
        if (activeFile) files.set(activeFile, isSourceManifest(activeFile) ? document.getElementById("manifest-editor").value : editor.getValue());
        output.textContent = "Starting WebAssembly compiler...\n";
        status.textContent = "Compiling...";
        downloadButton.disabled = true;
        windows.get("output").hidden = false;
        bringToFront("output");
        setStatus("Compiling project...");
        document.querySelectorAll('[data-action="compile"]').forEach((button) => { button.disabled = true; });
        let log = `Standard: ${options.standard === "fteqcc" ? "FTEQCC-compatible (GMQCC)" : options.standard}\n`;
        const print = (line) => { log += `${line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")}\n`; };
        try {
            if (typeof createGmqcc !== "function") throw new Error("Compiler module not found. Build gmqcc.js first.");
            const module = await createGmqcc({ noInitialRun: true, noExitRuntime: true, print, printErr: print });
            module.FS.mkdir("/project");
            for (const [name, contents] of files) module.FS.writeFile(`/project/${safeFilename(name)}`, contents);
            module.FS.chdir("/project");
            const args = [`-std=${options.standard}`, `-O${options.optimization}`, "-o", outputName];
            args.push("-Wno-error-missing-return-values");
            if (options.quiet) args.push("-q");
            args.push(...orderedSourceFiles(manifestName));
            const exitCode = module.callMain(args);
            output.textContent = log || "Compiler finished without messages.";
            if (exitCode !== 0) throw new Error(`Compiler exited with code ${exitCode}.`);
            const binary = module.FS.readFile(`/project/${outputName}`);
            lastBuild = { name: outputName, data: binary };
            downloadButton.disabled = false;
            status.textContent = `Build succeeded - ${binary.byteLength} bytes`;
            setStatus(`Build succeeded: ${outputName}`);
            showToast(`Build succeeded. ${outputName} is ready to download.`);
        } catch (error) {
            output.textContent = `${log}${log ? "\n" : ""}${error && error.message ? error.message : String(error)}`;
            status.textContent = "Build failed";
            setStatus("Build failed - see compiler output");
        } finally {
            document.querySelectorAll('[data-action="compile"]').forEach((button) => { button.disabled = false; });
        }
    }

    function reportCompileFailure(error) {
        const message = error && error.message ? error.message : String(error);
        document.getElementById("compiler-output").textContent = message;
        document.getElementById("compile-status").textContent = "Build failed";
        document.getElementById("download-build").disabled = true;
        windows.get("output").hidden = false;
        bringToFront("output");
        setStatus("Build failed - see compiler output");
        document.querySelectorAll('[data-action="compile"]').forEach((button) => { button.disabled = false; });
    }

    function bringToFront(name) {
        const element = windows.get(name);
        if (!element) return;
        element.hidden = false;
        element.style.zIndex = String(++highestZ);
    }

    function arrangeWindows() {
        const manifest = windows.get("manifest");
        const sourceEditor = windows.get("editor");
        const area = desktop.getBoundingClientRect();
        manifest.hidden = false;
        sourceEditor.hidden = false;
        manifest.style.left = "22px";
        manifest.style.top = "34px";
        manifest.style.width = `${Math.min(320, Math.max(260, area.width * 0.38))}px`;
        manifest.style.height = "220px";
        sourceEditor.style.left = `${Math.min(105, Math.max(34, area.width * 0.13))}px`;
        sourceEditor.style.top = "64px";
        sourceEditor.style.width = `${Math.max(280, area.width - 40)}px`;
        sourceEditor.style.height = `${Math.max(210, area.height - 110)}px`;
        bringToFront("editor");
        editor.refresh();
    }

    function restoreOptions() {
        document.getElementById("standard-select").value = compilerOptions.standard || "fteqcc";
        document.getElementById("optimization-select").value = compilerOptions.optimization || "1";
        document.getElementById("output-name").value = compilerOptions.output || "progs.dat";
        document.getElementById("quiet-option").checked = !!compilerOptions.quiet;
    }

    function showDialog(id) {
        const dialog = document.getElementById(id);
        if (id === "options-dialog") restoreOptions();
        if (!dialog.open) dialog.showModal();
    }

    function handleAction(action) {
        document.querySelectorAll(".menu-popup").forEach((popup) => { popup.hidden = true; });
        document.querySelectorAll("[data-menu]").forEach((button) => button.setAttribute("aria-expanded", "false"));
        switch (action) {
            case "new": createFile(); break;
            case "open": fileInput.click(); break;
            case "save": saveProject(); break;
            case "download": downloadActiveFile(); break;
            case "compile": compileProject().catch(reportCompileFailure); break;
            case "undo": editor.undo(); break;
            case "redo": editor.redo(); break;
            case "find": findInFile(); break;
            case "previous": cycleFile(-1); break;
            case "next": cycleFile(1); break;
            case "show-project": document.getElementById("project-pane").hidden = !document.getElementById("project-pane").hidden; break;
            case "show-editor": windows.get("editor").hidden = false; bringToFront("editor"); editor.refresh(); break;
            case "show-output": windows.get("output").hidden = false; bringToFront("output"); break;
            case "arrange": arrangeWindows(); break;
            case "options": showDialog("options-dialog"); break;
            case "about": showDialog("about-dialog"); break;
            case "quit": showToast("Close this browser tab to quit the development suite."); break;
            default: break;
        }
    }

    function cycleFile(direction) {
        const names = [...files.keys()].filter((name) => !name.endsWith(".src"));
        if (!names.length) return;
        const index = names.indexOf(activeFile);
        openFile(names[(index + direction + names.length) % names.length]);
    }

    document.addEventListener("click", (event) => {
        const menuButton = event.target.closest("[data-menu]");
        if (menuButton) {
            const popup = document.querySelector(`[data-popup="${menuButton.dataset.menu}"]`);
            const show = popup.hidden;
            document.querySelectorAll(".menu-popup").forEach((item) => { item.hidden = true; });
            document.querySelectorAll("[data-menu]").forEach((item) => item.setAttribute("aria-expanded", "false"));
            popup.hidden = !show;
            menuButton.setAttribute("aria-expanded", String(show));
            return;
        }
        const actionButton = event.target.closest("[data-action]");
        if (actionButton && actionButton.dataset.action !== "compile") handleAction(actionButton.dataset.action);
    });

    document.querySelectorAll('[data-action="compile"]').forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleAction("compile");
        });
    });

    document.addEventListener("click", (event) => {
        const closeButton = event.target.closest("[data-close]");
        const minimizeButton = event.target.closest("[data-minimize]");
        const maximizeButton = event.target.closest("[data-maximize]");
        if (closeButton) windows.get(closeButton.dataset.close).hidden = true;
        if (minimizeButton) windows.get(minimizeButton.dataset.minimize).hidden = true;
        if (maximizeButton) {
            const target = windows.get(maximizeButton.dataset.maximize);
            const maximized = target.dataset.maximized === "true";
            target.dataset.maximized = String(!maximized);
            if (maximized) {
                target.style.left = target.dataset.oldLeft;
                target.style.top = target.dataset.oldTop;
                target.style.width = target.dataset.oldWidth;
                target.style.height = target.dataset.oldHeight;
            } else {
                target.dataset.oldLeft = target.style.left;
                target.dataset.oldTop = target.style.top;
                target.dataset.oldWidth = target.style.width;
                target.dataset.oldHeight = target.style.height;
                target.style.left = "4px";
                target.style.top = "25px";
                target.style.width = "calc(100% - 8px)";
                target.style.height = "calc(100% - 30px)";
            }
            bringToFront(maximizeButton.dataset.maximize);
            editor.refresh();
        }
        const taskButton = event.target.closest("[data-task]");
        if (taskButton) {
            const target = windows.get(taskButton.dataset.task);
            if (target.hidden) bringToFront(taskButton.dataset.task);
            else bringToFront(taskButton.dataset.task);
            if (taskButton.dataset.task === "editor") editor.refresh();
        }
    });

    fileInput.addEventListener("change", async () => {
        if (fileInput.files.length) await importFiles([...fileInput.files]);
        fileInput.value = "";
    });

    document.getElementById("project-find-form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (isSourceManifest(activeFile)) {
            showToast("Find is available for source files, not the build list.");
            return;
        }
        findInFile();
    });

    document.getElementById("build-manifest").addEventListener("change", (event) => {
        selectedManifest = event.target.value;
    });

    document.getElementById("manifest-editor").value = isSourceManifest(activeFile)
        ? files.get(activeFile) || ""
        : files.get(selectedManifest) || "";
    document.getElementById("manifest-editor").addEventListener("input", (event) => {
        if (!isSourceManifest(activeFile)) return;
        files.set(activeFile, event.target.value);
        dirtyFiles.add(activeFile);
        document.getElementById("file-state").textContent = "Modified";
        renderTabs();
    });

    editor.on("change", () => {
        if (!activeFile) return;
        files.set(activeFile, editor.getValue());
        dirtyFiles.add(activeFile);
        document.getElementById("file-state").textContent = "Modified";
        renderProject();
        renderTabs();
    });
    editor.on("cursorActivity", updateEditorStatus);

    document.getElementById("download-build").addEventListener("click", () => {
        if (lastBuild) downloadFile(lastBuild.name, lastBuild.data, "application/octet-stream");
    });
    document.getElementById("shell-close").addEventListener("click", () => showToast("Close this browser tab to quit the development suite."));
    document.getElementById("workspace-size").textContent = `${Math.round(desktop.clientWidth)} × ${Math.round(desktop.clientHeight)}`;

    document.querySelectorAll(".window-drag-handle").forEach((handle) => {
        handle.addEventListener("dblclick", () => {
            const target = handle.closest("[data-window]");
            if (target && target.dataset.window === "editor") target.querySelector("[data-maximize]").click();
        });
        handle.addEventListener("pointerdown", (event) => {
            if (event.target.closest("button")) return;
            const target = handle.closest("[data-window]");
            bringToFront(target.dataset.window);
            const area = desktop.getBoundingClientRect();
            const rect = target.getBoundingClientRect();
            const startX = event.clientX;
            const startY = event.clientY;
            const originX = rect.left - area.left;
            const originY = rect.top - area.top;
            handle.setPointerCapture(event.pointerId);
            const move = (moveEvent) => {
                const maxX = Math.max(0, area.width - target.offsetWidth);
                const maxY = Math.max(0, area.height - target.offsetHeight);
                target.style.left = `${Math.max(0, Math.min(maxX, originX + moveEvent.clientX - startX))}px`;
                target.style.top = `${Math.max(25, Math.min(maxY, originY + moveEvent.clientY - startY))}px`;
            };
            const done = () => {
                handle.removeEventListener("pointermove", move);
                handle.removeEventListener("pointerup", done);
                handle.removeEventListener("pointercancel", done);
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", done);
            handle.addEventListener("pointercancel", done);
        });
    });

    document.querySelectorAll("[data-resize]").forEach((handle) => {
        const target = windows.get(handle.dataset.resize);
        const resizeBy = (width, height) => {
            const area = desktop.getBoundingClientRect();
            const rect = target.getBoundingClientRect();
            const left = rect.left - area.left;
            const top = rect.top - area.top;
            const maxWidth = Math.max(0, area.width - left);
            const maxHeight = Math.max(0, area.height - top);
            target.style.width = `${Math.min(maxWidth, Math.max(240, width))}px`;
            target.style.height = `${Math.min(maxHeight, Math.max(170, height))}px`;
            bringToFront(target.dataset.window);
            if (target.dataset.window === "editor") editor.refresh();
        };
        handle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            const rect = target.getBoundingClientRect();
            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = rect.width;
            const startHeight = rect.height;
            handle.setPointerCapture(event.pointerId);
            bringToFront(target.dataset.window);
            const move = (moveEvent) => resizeBy(
                startWidth + moveEvent.clientX - startX,
                startHeight + moveEvent.clientY - startY
            );
            const done = () => {
                handle.removeEventListener("pointermove", move);
                handle.removeEventListener("pointerup", done);
                handle.removeEventListener("pointercancel", done);
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", done);
            handle.addEventListener("pointercancel", done);
        });
        handle.addEventListener("keydown", (event) => {
            const step = event.shiftKey ? 40 : 10;
            const rect = target.getBoundingClientRect();
            if (event.key === "ArrowRight") resizeBy(rect.width + step, rect.height);
            else if (event.key === "ArrowLeft") resizeBy(rect.width - step, rect.height);
            else if (event.key === "ArrowDown") resizeBy(rect.width, rect.height + step);
            else if (event.key === "ArrowUp") resizeBy(rect.width, rect.height - step);
            else return;
            event.preventDefault();
        });
    });

    const resizeObserver = new ResizeObserver(() => {
        document.getElementById("workspace-size").textContent = `${Math.round(desktop.clientWidth)} × ${Math.round(desktop.clientHeight)}`;
        editor.refresh();
    });
    resizeObserver.observe(desktop);

    restoreOptions();
    windows.get("manifest").hidden = ![...files.keys()].some(isSourceManifest);
    if (isSourceManifest(activeFile)) {
        windows.get("manifest").hidden = false;
        windows.get("editor").hidden = true;
    } else if (activeFile) {
        document.getElementById("editor-title").textContent = `${activeFile} - FTEQCC Editor`;
    } else {
        document.getElementById("editor-title").textContent = "No source file";
    }
    renderProject();
    renderTabs();
    setStatus("Compiler ready");
})();
