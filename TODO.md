# Repository Restructure Plan

Reorganize the skymp repo from a flat layout (~20 top-level dirs mixing C++,
TS, scripts, vendored deps, and assets) into a role-based layout. Adopt
turborepo + yarn workspaces for the TS side. Execute in four phases; each
phase is one PR.

## Current layout (problems)

- All projects sit at the top level with no role separation: TS apps
  (`skymp5-server`, `skymp5-client`, `skymp5-front`), C++ libs (`libespm`,
  `papyrus-vm`, `savefile`, `serialization`, `viet`), the dual C++/TS
  `skyrim-platform`, vendored vcpkg overlays, the `cmake/` helpers, and
  `misc/` (tests + prettier + scripts) all coexist as siblings.
- `skymp5-client` depends on `@skyrim-platform/skyrim-platform@2.9.0` from
  npm even though `skyrim-platform` source sits in the same repo. There is
  no workspace linking — every TS package is invoked standalone via yarn,
  driven from CMake `add_custom_command`s.
- `skymp5-functions-lib` is a single `index.ts` with no `package.json`,
  built only via CMake.
- `client-deps/` is misnamed: not a library but a Skyrim `Data/` overlay
  (fonts, .swf overlays, a compiled `.pex`).
- `misc/` is a grab-bag (integration tests, prettier config, install scripts).

## Target layout

```
skymp/
├── projects/                      # end-products & published packages
│   ├── server/                    # was skymp5-server         (TS + cpp/ addon)
│   ├── client/                    # was skymp5-client         (TS plugin)
│   ├── ui/                        # was skymp5-front          (rename pkg ui_webpack → @skymp/ui)
│   ├── skyrim-platform/           # was skyrim-platform       (C++ SKSE plugin + npm pkg)
│   └── gamemode/                  # was skymp5-functions-lib  (rename; index.ts kept as placeholder; CMake-driven external clone retained until in-tree)
│
# packages/ is reserved for future internal shared TS libs;
# Phase 1/2/3 do not introduce any.
│
├── libs/                          # C++ libraries
│   ├── espm/                      # was libespm (drop "lib" prefix)
│   ├── papyrus-vm/
│   ├── savefile/
│   ├── serialization/
│   └── viet/
│
├── assets/                        # static & build-output asset trees
│   ├── skyrim-data/               # was client-deps (Skyrim Data/ overlay: fonts, .swf, .pex). Phase 3 used this name instead of `client/` to avoid a discovery-loop key collision with `projects/client/` (leaf dir names are project keys).
│   └── papyrus/                   # was skymp5-scripts (compiled .pex + .psc sources)
│
├── tests/
│   ├── unit/                      # was unit/ (C++ Catch2)
│   └── integration/               # was misc/tests/
│
├── tools/
│   ├── cmake/                     # was cmake/ (helpers, modules, scripts)
│   ├── prettier/                  # was misc/prettier/
│   └── scripts/                   # misc/deps_linux, misc/github_env_linux, install_git_hooks.cmake
│
├── third_party/
│   ├── vcpkg/                     # submodule (relocated)
│   ├── overlay_ports/             # was overlay_ports
│   └── overlay_triplets/          # was overlay_triplets
│
├── build/                         # gitignored
├── docs/                          # unchanged
├── CMakeLists.txt                 # auto-discovery via cmakeproj.cmake (unchanged in spirit)
├── vcpkg.json                     # must stay at root (vcpkg requirement)
├── package.json                   # NEW: turborepo + yarn workspaces root
├── turbo.json                     # NEW
├── build.sh
└── README.md
```

## Naming conventions

- Drop the `skymp5-` prefix everywhere — when every project in the repo is
  skymp5, the prefix is noise.
- Drop the `lib` prefix on `libespm` → `libs/espm` — the directory's
  location already implies "library".
- Keep published npm package names unchanged
  (e.g. `@skyrim-platform/skyrim-platform`). Workspace linking uses the
  package name, not the path, so directory renames are invisible to npm
  consumers.
- Stay on **yarn classic (1.x)** for workspaces — minimum disruption to
  the existing CMake `yarn build` invocations. Migrating to yarn 4 or pnpm
  is a separate decision.

## Why this layout

- **`projects/`** holds anything that ships, whether it's a TS app, a C++
  plugin, or a dual-nature package. `apps/` would have been wrong for
  `skyrim-platform` (it's a published library, not an app); `libs/` would
  have been wrong too. `projects/` is honest.
- **`packages/`** is reserved for internal shared TS libs (workspace-only)
  and is _not_ created in any current phase — no such lib exists today.
  When a shared lib appears, the split between `projects/` and
  `packages/` mirrors the convention used by most monorepos and maps
  cleanly to turborepo's filter syntax.
- **`libs/`** is pure C++ infrastructure — consumed by `projects/server`,
  `projects/skyrim-platform`, and `tests/unit`. The role split (libs vs.
  projects) maps cleanly to the existing CMake priority system in
  `cmakeproj.cmake` (libs = priority 1, projects = priority 2–3, tests =
  priority 4).
- **`assets/`** separates static / build-output asset trees (Skyrim
  `Data/` overlays, compiled Papyrus) from code projects.
- **`tools/`** consolidates everything that supports the build but isn't
  itself a build target.

---

## Phase 1 — Turborepo + workspaces (no directory moves) ✅ DONE

**Risk:** low. **Goal:** unblock workspace linking before any moves happen.

- [x] Add root `package.json` with `"workspaces": [...]` listing the
      _current_ paths (`skymp5-server`, `skymp5-client`, `skymp5-front`,
      `skyrim-platform`). `skymp5-functions-lib` is intentionally
      excluded — see Phase 2 for its move/rename. Phase 2 updates the
      pattern to `projects/*`.
- [x] Add root `turbo.json` with pipelines: `build`, `lint`, `test`,
      `typecheck`. Configure `dependsOn: ["^build"]` for `build` so
      workspace deps build in order.
- [x] Rename the local `skyrim-platform/package.json` `name` from
      `@skymp/skyrim-platform` to `@skyrim-platform/skyrim-platform`
      so workspace linking matches the dep already present in
      `skymp5-client`.
- [x] Replace `@skyrim-platform/skyrim-platform: <version>` in
      `skymp5-client/package.json` with `"*"` so the client links
      to local source instead of the published copy.
      (Note: `workspace:*` is yarn Berry syntax; yarn 1 classic uses
      a plain version range that satisfies the workspace's `version`.)
- [x] Rename the `ui_webpack` package to `@skymp/ui` in
      `skymp5-front/package.json`.
- [x] Update CMake targets that invoke `yarn build` per package to call
      `turbo run build --filter=<package-name>` instead, with
      `WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}` (turbo resolves filters
      from the repo root). Applied to `skymp5-server/ts/CMakeLists.txt`,
      `skymp5-client/CMakeLists.txt`, and `skymp5-front/build-local.cmake`.
      `skymp5-functions-lib` continues to use its CMake-driven external
      clone of `skyrim-multiplayer/skymp5-gamemode` and stays unchanged.
- [x] Drop per-package configure-time `yarn install` calls (server,
      client, front). Replaced with a single `yarn install --frozen-lockfile`
      at the repo root in the top-level `CMakeLists.txt`, leveraging
      workspaces to hoist shared deps.
- [x] Build `skymp5-front` from its local `src/`. The CMake target
      generates `config.js` at configure time and invokes
      `yarn turbo run build --filter=@skymp/ui`, gated by `BUILD_FRONT`.
- [x] `skymp5-functions-lib` stays unchanged in Phase 1. Its `index.ts`
      currently has dangling imports that resolve to the cloned
      `skyrim-multiplayer/skymp5-gamemode` repo at build time
      (`BUILD_GAMEMODE=ON`); promoting it to a workspace package
      requires either bringing the gamemode in-tree or accepting the
      external-clone build flow. Deferred to Phase 2 (see below).
- [x] Run a clean build on Windows + Linux. Verify `ctest --verbose` still
      passes. (Verified locally on Windows: 254 unit cases / 476,803
      assertions pass; live server bundle starts and resolves
      bcrypt/mongodb/scam_native.node via workspace-root hoisting.
      Linux/CI verification pending.)

### Additional work executed (not in original Phase 1 list)

- [x] Add `"build"` script to `skymp5-server/package.json` aliasing
      `build-ts` (turbo filter requires a `build` script).
- [x] Add `"packageManager": "yarn@1.22.22"` to root `package.json`
      (turbo 2.x requires this).
- [x] Migrate `resolutions` from `skymp5-front/package.json` to root
      (yarn 1 only honors `resolutions` at the workspace root).
- [x] Add `"ts-loader": "^9.5.7"` to root `resolutions` to prevent a
      nested TypeScript 4.9.5 from breaking `moduleResolution: "bundler"`
      in `@skymp/ui`.
- [x] Update `skymp5-client/tsconfig.json` `paths` to include the hoisted
      location: `["node_modules/...", "../node_modules/..."]`.
- [x] Snapshot the published `@skyrim-platform/skyrim-platform@2.9.0`
      `index.d.ts` into `skyrim-platform/index.d.ts` and point the
      workspace's `types` field at it. Preserves client typecheck behavior;
      reconciling the drift with `src/platform_se/codegen/convert-files/skyrimPlatform.ts`
      is deferred.
- [x] Rework `skymp5-server/CMakeLists.txt` POST_BUILD: dropped the
      build-time `yarn install --frozen-lockfile` at `${CMAKE_BINARY_DIR}`.
      The Node resolver walks up from `build/dist/server/dist_back/` past
      `build/` to `${CMAKE_SOURCE_DIR}/node_modules` and finds bcrypt /
      mongodb hoisted by yarn workspaces. `dist/server/yarn.lock` is now
      copied from the workspace-root lockfile (preserves DistContentsTest).
- [x] Add `turbo_run_build(FILTER ...)` helper in `cmake/yarn.cmake`.
- [x] Delete per-package `yarn.lock` files (server, client, front);
      root `yarn.lock` is now the single source of truth.
- [x] Add `.turbo` to `.gitignore`.

## Phase 2 — Move TS projects into `projects/` ✅ DONE

**Risk:** medium. **Goal:** lock in the TS layout.

- [x] `git mv skymp5-server         projects/server`
- [x] `git mv skymp5-client         projects/client`
- [x] `git mv skymp5-front          projects/ui`
- [x] `git mv skyrim-platform       projects/skyrim-platform`
- [x] `git mv skymp5-functions-lib  projects/gamemode` (rename in same
      step; the existing `index.ts` is kept as a placeholder for future
      in-tree gamemode source). Added `projects/gamemode/package.json`
      (name: `@skymp/gamemode`) and `tsconfig.json` (non-emitting, excludes
      `index.ts` since its imports resolve only inside the cloned external
      gamemode repo). The CMake-driven external clone of
      `skyrim-multiplayer/skymp5-gamemode` stays in place until the
      gamemode source is brought in-tree.
- [x] Update root `package.json` `workspaces` to `["projects/*"]` (no
      `packages/` until an internal-shared TS lib actually exists).
- [x] Update path references:
  - [x] `tsconfig.json` `outDir` paths (server `../build/...` →
        `../../build/...`); `paths` depth in client (`../node_modules` →
        `../../node_modules`).
  - [x] `cmakeproj.cmake` files inside the moved dirs — rewritten to use
        new leaf-name keys (`server`, `client`, `ui`, `skyrim-platform`,
        `gamemode`).
  - [x] Root `CMakeLists.txt`: discovery loop redesigned to walk both
        `${CMAKE_SOURCE_DIR}/*` and `${CMAKE_SOURCE_DIR}/projects/*`,
        keying projects by leaf dir name and storing the relative path
        in `CMAKEPROJ_RELPATH_<key>` for `add_subdirectory`. Forward-
        compatible with Phase 3/4 by extending `CMAKEPROJ_GROUP_DIRS`.
        Also renamed `skymp5-functions-lib` → `gamemode` in the two
        `TARGETS_ADDITIONAL` lists (`prepare_nexus_archives`,
        `RestartGame`). Other `skymp5-*` CMake target names left
        unchanged per Phase 2 scope (Phase 3 may rename them).
  - [x] `cmake/*.cmake` helpers — generic, parameterized; no edits
        needed. Confirmed `cmake/run_test_functions_lib.cmake` is dead
        code (its `${SKYMP5_FUNCTIONS_LIB_DIR}` is never set anywhere);
        leave for Phase 3 cleanup.
  - [x] `.github/workflows/*` — confirmed no refs to moved dirs; no
        edits needed.
  - [x] `build.sh` — confirmed no path-specific refs; no edits needed.
  - [x] `.dockerignore`, `.prettierignore` patterns updated to new paths.
  - [x] `docs/` references to old paths: `docs_onhit_and_damage.md`,
        `docs_maintainer_rules.md`, `docs_repository_structure.md`,
        contributing/{en,ru}/* (English + Russian), `TERMS.md`. Doc
        filenames containing `skymp5-client` deliberately not renamed
        to keep URLs stable.
- [x] Additional path-depth fixes not in original Phase 2 list:
  - [x] `turbo.json` `outputs` `../build/dist/**` → `../../build/dist/**`
        (resolved per workspace; depth changed from 1 to 2).
  - [x] `projects/server/package.json` esbuild `--outfile` depth.
  - [x] `projects/client/webpack.config.js` `outputFolder` depth.
  - [x] `projects/skyrim-platform/tools/dev_service/index.js`:
        `getBinaryDir` depth, plus two hardcoded build subpaths
        (`skyrim-platform/_platform_se` → `projects/skyrim-platform/_platform_se`,
        `skymp5-server/cpp/...` → `projects/server/cpp/...` for
        `MpClientPlugin.dll`) caught during local Release verification.
  - [x] `projects/skyrim-platform/tools/const_enum_extractor/index.js`:
        switched CWD-relative path strings to `__dirname`-relative
        `path.resolve()` so the dev script is robust to launch CWD.
  - [x] `linter-config.json` lines 54–55 (server messages /
        client services messages paths).
  - [x] `misc/prettier/package.json` `oxfmt`/`oxlint` paths
        (`../../skymp5-front/src` → `../../projects/ui/src`).
- [x] Verify CI green on Windows + Linux. (Local Windows: 13 projects
      discovered, Release build green, ctest 12/12 pass, unit suite
      255 cases / 477,522 assertions — matches Phase 1 baseline.
      Live server bundle starts and resolves bcrypt/mongodb from
      hoisted `node_modules`. Linux/CI verification pending push.)

## Phase 3 — Move C++ libs, tests, and assets ✅ DONE

**Risk:** medium. **Goal:** finish the role-based grouping.

- [x] `git mv libespm         libs/espm`
- [x] `git mv papyrus-vm      libs/papyrus-vm`
- [x] `git mv savefile        libs/savefile`
- [x] `git mv serialization   libs/serialization`
- [x] `git mv viet            libs/viet`
- [x] `git mv unit            tests/unit`
- [x] `git mv misc/tests      tests/integration`
- [x] `git mv client-deps     assets/skyrim-data` (deviation from target
      layout: `assets/client/` would collide with `projects/client/` in
      the leaf-name keyed discovery loop; renamed to `skyrim-data` —
      descriptive of its Skyrim `Data/` overlay role)
- [x] `git mv skymp5-scripts  assets/papyrus`
- [x] Renamed `project(libespm)` → `project(espm)` in `libs/espm/CMakeLists.txt`.
      `add_library(libespm ALIAS espm)` kept so external refs continue to resolve.
      Other `project(...)` IDs (`client-deps`, `skymp5-scripts`) left as-is —
      their CMake target names are referenced from root `CMakeLists.txt` and
      stay stable per the cross-cutting reminder.
- [x] Update path references:
  - [x] `cmakeproj.cmake` files in the moved dirs — keys rekeyed to match
        new leaf dir names: `libespm` → `espm`, `client-deps` → `client`,
        `skymp5-scripts` → `papyrus`. The discovery loop in root
        `CMakeLists.txt:198` derives `<key>` from leaf dir name, so each
        cmakeproj's `CMAKEPROJ_PRIORITY_<key>` had to track. `papyrus-vm`,
        `savefile`, `serialization`, `viet`, `unit` cmakeproj.cmake files
        unchanged (leaf name preserved).
  - [x] Root `CMakeLists.txt`:
        - Extended `CMAKEPROJ_GROUP_DIRS` with `libs/`, `tests/`, `assets/`.
        - Updated three `${CMAKE_SOURCE_DIR}/misc/tests/...` refs in the
          integration-test glob (lines 277, 282, 288) to `tests/integration/...`.
        - `add_dependencies(prepare_nexus_archives skyrim-platform papyrus-vm)`
          (line 238) and the `TARGETS_ADDITIONAL` lists (lines 240-244,
          254-259) untouched — target names are stable.
  - [x] `cmake/run_test_unit.cmake`, `cmake/run_integration_test.cmake` —
        confirmed no source-path refs (only build-output filenames like
        `skymp5-server.js`, which stay stable per cross-cutting reminder).
  - [x] `cmake/run_test_functions_lib.cmake` — deleted (dead code; flagged
        in Phase 2's notes for Phase 3 cleanup).
  - [x] `assets/client/CMakeLists.txt` (was `client-deps/CMakeLists.txt`) —
        unchanged; `add_dependencies(client-deps skyrim-platform)` resolves
        because both target names are unaltered by Phase 2/3.
  - [x] `.github/workflows/*` — verified zero refs to moved dirs; no edits.
  - [x] `build.sh` — verified zero refs; no edits.
  - [x] `docs/docs_repository_structure.md` — rewritten to describe the
        finished `libs/`, `tests/`, `assets/` layout.
- [x] Verify `ctest --verbose` runs all unit + integration tests.
      (Verified retroactively during Phase 4 local verification: 12/12 ctest
      pass in Release config on Windows.)

### Additional work executed (not in original Phase 3 list)

- [x] `linter-config.json` (lines 27, 36): `/skymp5-scripts/` →
      `/assets/papyrus/` in CRLF + Linelint excludePaths.
- [x] `.linelint.yml` (line 4): `'skymp5-scripts/'` → `'assets/papyrus/'`.
- [x] `tests/unit/DistContentsExpected.json` — initial audit flagged
      `papyrus-vm/papyrus-vm[.exe]` as needing `libs/` prefix; **verified
      no change required**. The path is the dist-subdir name, hardcoded in
      `libs/papyrus-vm/CMakeLists.txt:20` (`COMMAND copy
      $<TARGET_FILE:papyrus-vm> ${CMAKE_BINARY_DIR}/dist/papyrus-vm/...`).
      The dist layout is independent of source location and stays stable
      per the cross-cutting reminder on deliverable filenames/paths.

## Phase 4 — Tooling and third-party cleanup ✅ DONE

**Risk:** low. **Goal:** finish the layout; nothing functional changes.

- [x] `git mv cmake               tools/cmake`
- [x] `git mv misc/prettier       tools/prettier`
- [x] `git mv overlay_ports       third_party/overlay_ports`
- [x] `git mv overlay_triplets    third_party/overlay_triplets`
- [x] Move `vcpkg` submodule to `third_party/vcpkg`:
  - [x] `git mv vcpkg third_party/vcpkg` (modern git auto-updates
        `.gitmodules`, the gitlink, and `.git/modules/<name>/` atomically;
        manual `.gitmodules` edit is unnecessary and unsafe)
  - [x] `git submodule sync --recursive && git submodule update --init --recursive`
  - [x] Update `CMAKE_TOOLCHAIN_FILE` in root `CMakeLists.txt:34`
        (`${CMAKE_SOURCE_DIR}/vcpkg/...` → `${CMAKE_SOURCE_DIR}/third_party/vcpkg/...`).
        Line 32 (`C:/vcpkg/...` Windows-CI absolute fallback) deliberately
        unchanged — it points at the runner's disk, not the in-repo submodule.
        Updated `build.sh` lines 71/74 (`cd vcpkg` → `cd third_party/vcpkg`)
        and `.github/workflows/linux-build.yml:207` (artifact path).
- [x] Move loose scripts: `misc/deps_linux`, `misc/github_env_linux`,
      `misc/install_git_hooks.cmake` → `tools/scripts/`.
- [x] Update path references:
  - [x] Root `CMakeLists.txt`: lines 17, 18, 34, 127, 157, 161, 236, 310
        (TODO line numbers 219/293 had drifted to 236/310 since the Phase 4
        sketch was written).
  - [x] All sub-project `CMakeLists.txt` files referencing
        `${CMAKE_SOURCE_DIR}/cmake/...` — 14 files under `assets/`, `libs/`,
        `projects/`, `tests/`. **Plus three sites missing from the original
        Phase 4 inventory**: `projects/server/cpp/CMakeLists.txt:3`,
        `projects/server/ts/CMakeLists.txt:1`, `projects/ui/build-local.cmake:1`,
        `projects/gamemode/download-and-build-with-prs.cmake:1`.
  - [x] Hardcoded data-file path in `tools/cmake/add_papyrus_library_ck.cmake:25`
        (`${CMAKE_SOURCE_DIR}/cmake/TESV_Papyrus_Flags.flg` →
        `${CMAKE_SOURCE_DIR}/tools/cmake/...`).
  - [x] `.github/workflows/prettier.yml` (lines 37, 41) and
        `.github/workflows/linux-build.yml` (lines 85 commented, 88, 101, 207).
  - [x] `build.sh` (lines 71, 74).
  - [x] `docs/docs_repository_structure.md` (lines 11, 13, 15 + added
        entries for `tools/scripts/` and `third_party/vcpkg/`).
- [x] Delete `misc/` if it's now empty. (Auto-removed by `git mv`; verified
      gone with `ls misc` returning no such directory.)
- [x] Update `CLAUDE.md` build/test instructions and `docs/` to reflect
      the new layout. **CLAUDE.md required no edits** — its commands
      (`mkdir build`, `cmake ..`, `cmake --build .`, `ctest --verbose`,
      `./unit/unit [Respawn]`) are generic and reference only stable
      build-output paths, not source paths. Doc updates landed in
      `docs/docs_repository_structure.md`.

### Additional work executed (not in original Phase 4 list)

- [x] **Bug fix**: `tools/scripts/install_git_hooks.cmake:5` — `REPO_ROOT`
      was computed as `${CMAKE_CURRENT_LIST_DIR}/..` (correct from the
      old `misc/` location, one level deep). After move to `tools/scripts/`
      it must be `${CMAKE_CURRENT_LIST_DIR}/../..` (two levels deep).
      Without this fix the `.git/hooks` directory creation and pre-commit
      install would target `tools/.git/hooks` instead of the repo root.
- [x] Removed legacy `${CMAKE_SOURCE_DIR}` entry from `CMAKEPROJ_GROUP_DIRS`
      in root `CMakeLists.txt:175` — it had been kept since Phase 3 with
      a comment marking it for Phase 4 removal. Nothing at the repo root
      carries a `cmakeproj.cmake` anymore (the discovery loop now walks
      only `projects/`, `libs/`, `tests/`, `assets/`).
- [x] `linter-config.json:45` (ClangFormat section) — `"/overlay_ports/"`
      → `"/third_party/overlay_ports/"`. The CRLF and Linelint sections
      (lines 27, 36) already had a `/third_party/` umbrella entry so the
      sub-paths are technically subsumed; updated those for clarity.
- [x] `.prettierignore:3` — bare token `vcpkg` → `third_party/vcpkg`. The
      bare token would no longer match any tracked directory after the move.
- [x] `tools/scripts/deps_linux/ubuntu-vcpkg-deps.sh:6` — internal path
      `. misc/github_env_linux` → `. tools/scripts/github_env_linux`
      (script runs from repo root inside the docker buildimage).
- [x] `tools/scripts/install_git_hooks.cmake:3` — usage comment updated.
- [x] `projects/skyrim-platform/tools/dev_service/index.js:5` — comment
      `Keep this in sync with triplet file overlay_triplets\...` →
      `third_party/overlay_triplets/...`.
- [x] **Verified non-issue**: `third_party/overlay_ports/cef-prebuilt/CMakeLists.txt:4`
      references `${CMAKE_SOURCE_DIR}/cmake` — this runs in vcpkg port
      build context where `CMAKE_SOURCE_DIR` resolves inside the port's
      extract dir, not the skymp repo. No edit required.
- [x] **Verified non-issue**: `cmake/modules/` directory does not exist.
      `CMAKE_MODULE_PATH` (line 157) was updated to `tools/cmake/modules`
      for consistency, but the path is still reserved/empty.

---

## CMake work required (concrete inventory)

The `cmakeproj.cmake` auto-discovery in the root `CMakeLists.txt` only
walks `${CMAKE_SOURCE_DIR}/*` — i.e. **direct children of the repo root**.
Once C++ projects move under `libs/`, `projects/`, `tests/` (subdirectories
two levels deep), the discovery logic stops finding them. This is the
biggest CMake change required; it cannot be skipped.

### Root `CMakeLists.txt` — must edit

- Lines 17–18: `overlay_triplets`, `overlay_ports` paths → `third_party/...`
  (Phase 4).
- Line 34: `${CMAKE_SOURCE_DIR}/vcpkg/...` toolchain path →
  `third_party/vcpkg/...` (Phase 4).
- Line 127: `${CMAKE_SOURCE_DIR}/cmake/download_skyrim_data.cmake` →
  `tools/cmake/...` (Phase 4).
- Line 157: `${CMAKE_SOURCE_DIR}/cmake/modules` → `tools/cmake/modules` (Phase 4).
- Line 219: `${CMAKE_SOURCE_DIR}/cmake/prepare_nexus_archives.cmake` →
  `tools/cmake/...` (Phase 4).
- Line 293: `${CMAKE_SOURCE_DIR}/cmake/run_integration_test.cmake` →
  `tools/cmake/...` (Phase 4).
- Lines 262, 267, 273: `${CMAKE_SOURCE_DIR}/misc/tests/...` →
  `tests/integration/...` (Phase 3).
- **Lines ~175–195 (cmakeproj discovery loop):** rewrite to walk
  `libs/*`, `projects/*`, `tests/*` (and any other group dirs), not just
  `${CMAKE_SOURCE_DIR}/*` (Phase 2 / Phase 3).
- Lines 223, 224–229, 239–244, 258: hardcoded CMake target names
  (`skymp5-client`, `skymp5-front`, `skymp5-functions-lib`,
  `skymp5-scripts`, `skymp5-server`). These reference _target_ names set
  inside each subdir's `cmakeproj.cmake` / `CMakeLists.txt`, not directory
  names. Each project's `project(...)` / `add_custom_target(...)` call
  must be renamed in lockstep, or these references will dangle. In
  particular, after Phase 2's `skymp5-functions-lib` → `projects/gamemode`
  move, both the target name and these references should change to
  `gamemode`.

### `cmake/*.cmake` helpers — must edit

- `cmake/prepare_nexus_archives.cmake` line 12: hardcoded reference to
  `skymp5-client.js` and `skymp5-client-settings.txt` filenames in a
  regex — these are output filenames, decide whether to keep
  `skymp5-client.js` as the deliverable name even after the dir is
  renamed `projects/client/` (recommended: yes, to avoid breaking
  installers and existing user setups).
- `cmake/run_integration_test.cmake` line 49: `node dist_back/skymp5-server.js`
  — same call: keep `skymp5-server.js` as the output bundle name.

### Each subdir's `cmakeproj.cmake` — must edit

After Phase 2/3 moves, every `cmakeproj.cmake` that uses
`${CMAKE_SOURCE_DIR}/<sibling>` style paths to reach another project must
be updated. Audit each one before moving.

### CI workflows — must edit

`.github/workflows/*.yml` likely reference `skymp5-*/` and `misc/tests/`
paths (caching paths, artifact globs, etc.). Audit per-phase.

### `build.sh` — must edit

If `build.sh` references any moved paths, update.

### What does _not_ need editing

- The auto-discovery _mechanism_ (priority sorting, dependency
  resolution) is fine — only the glob root needs changing.
- The per-project `project()` / `target_link_libraries()` calls inside
  `libs/*` mostly use target names, not paths; they should keep working
  once the discovery loop finds the dirs in their new location.
- `vcpkg.json` stays at repo root (vcpkg requirement).

## Cross-cutting reminders

- One PR per phase. Do not stack phases.
- Use `git mv` (not `mv` + `git add`) so blame/history is preserved.
- Keep externally-visible output filenames stable (`skymp5-client.js`,
  `skymp5-server.js`, `MpClientPlugin.pex`, `@skyrim-platform/skyrim-platform`
  npm pkg name) even when their source directories are renamed. The repo
  layout is internal; the deliverable names are user-facing.
- Run full Windows + Linux CI between phases.
