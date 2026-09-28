# FTE QuakeC Development Suite

The browser IDE uses the GMQCC WebAssembly build in `../build-wasm/`.

Build the compiler with Emscripten from the `gmqcc` directory:

```sh
. ../emsdk/emsdk_env.sh
emcmake cmake -S . -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm --target gmqcc -j2
```

Serve the workspace over HTTP from the `gmqcc` directory (the browser must fetch the `.wasm` file):

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/web/`. XP.css and CodeMirror are loaded from CDNs.