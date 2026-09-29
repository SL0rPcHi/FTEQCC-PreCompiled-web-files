<img width="72" height="72" alt="icon" src="https://github.com/user-attachments/assets/5b3845fb-585a-4aa0-b4fa-4f50bea0e5a6" />


This repository contains the basic Quake 1 and 2 tools you need to  compile (and test!) your very own quake mod all in a web browser!
So far this repository is the *ONLY* public repo that has a QuakeC compiler ported to webassembly via emscripten, so please if you've found this repo, share it around, would boost my self-esteem.
this contains the compiled *FTEQW* engine, and the single biggest quakeC compiler currently in development *GMQCC!*

GitHub pages deployment for FTEQW: https://sl0rpchi.github.io/FTEQCC-PreCompiled-web-files/release/

Pages deployment for GMQCC with interactive UI: https://sl0rpchi.github.io/Quake-ultimate-web-tools/web/

(Also It may be a little hard to setup quake 3, do not just use any pak0.pk3 file, only use pak0.pk3 to pak8.pk3, the pak0 should be *over* 400mb or its missing files like music, which instantly kills the vibe
Also features real time lighting and working multiplayer! will be fixed very soon if it doesn't work for you, just put it in the issues tab, and I'll get to it!)

Also about the GMQCC compiler, things that would throw warnings and just slide on FTEQCC, *will NOT* slide here, eg.. in the source code in doors.qc there's "void(entity, float)" (which is why you may have ever seen blood particles fly out of some secret doors or player shot triggers)

Previews:
compiler:
<img width="1365" height="608" alt="image" src="https://github.com/user-attachments/assets/4553073b-5626-42ed-8db9-3460e3010ca5" />
Engine running quake 1:

<img width="1366" height="768" alt="Screenshot 2026-09-28 12 24 51 AM" src="https://github.com/user-attachments/assets/09a7aa92-a55c-4ddc-b4e8-ba5532469f25" />

Engine running quake 3 also me getting cooked by ranger: 
<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/8aa45d46-1b75-4af7-82a0-d1bd6c6f5f07" />
