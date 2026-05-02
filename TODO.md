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
│   ├── client/                    # was client-deps (Skyrim Data/ overlay: fonts, .swf, .pex)
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

## Phase 2 — Move TS projects into `projects/`

**Risk:** medium. **Goal:** lock in the TS layout.

- [ ] `git mv skymp5-server         projects/server`
- [ ] `git mv skymp5-client         projects/client`
- [ ] `git mv skymp5-front          projects/ui`
- [ ] `git mv skyrim-platform       projects/skyrim-platform`
- [ ] `git mv skymp5-functions-lib  projects/gamemode` (rename in same
      step; the existing `index.ts` is kept as a placeholder for future
      in-tree gamemode source). Add `projects/gamemode/package.json`
      (name: `@skymp/gamemode`) and `tsconfig.json` at this point. The
      CMake-driven external clone of `skyrim-multiplayer/skymp5-gamemode`
      stays in place until the gamemode source is brought in-tree.
- [ ] Update root `package.json` `workspaces` to `["projects/*"]` (no
      `packages/` until an internal-shared TS lib actually exists).
- [ ] Update path references:
  - [ ] `tsconfig.json` `outDir` paths (e.g. server's `../build/dist/server/...`)
  - [ ] `cmakeproj.cmake` files inside the moved dirs (relative paths to siblings)
  - [ ] `cmake/*.cmake` helper scripts that reference sibling project paths
  - [ ] `.github/workflows/*` — any hardcoded `skymp5-*/` paths
  - [ ] `build.sh` — any `cd <subdir>` or path-specific logic
  - [ ] `.dockerignore`, `.prettierignore` patterns
  - [ ] `docs/` references to old paths
- [ ] Verify CI green on Windows + Linux.

## Phase 3 — Move C++ libs, tests, and assets

**Risk:** medium. **Goal:** finish the role-based grouping.

- [ ] `git mv libespm         libs/espm`
- [ ] `git mv papyrus-vm      libs/papyrus-vm`
- [ ] `git mv savefile        libs/savefile`
- [ ] `git mv serialization   libs/serialization`
- [ ] `git mv viet            libs/viet`
- [ ] `git mv unit            tests/unit`
- [ ] `git mv misc/tests      tests/integration`
- [ ] `git mv client-deps     assets/client`
- [ ] `git mv skymp5-scripts  assets/papyrus`
- [ ] Optional: rename CMake project IDs where the directory rename made
      them inconsistent (e.g. `project(libespm)` → `project(espm)`).
- [ ] Update path references:
  - [ ] `cmakeproj.cmake` files in the moved dirs
  - [ ] Root `CMakeLists.txt` if any explicit paths remain
  - [ ] `cmake/run_test_unit.cmake`, `cmake/run_integration_test.cmake`,
        `cmake/run_test_functions_lib.cmake`, etc.
  - [ ] `client-deps/CMakeLists.txt` — copies into
        `${CMAKE_BINARY_DIR}/dist/client/data`; verify its
        `add_dependencies(... skyrim-platform)` still resolves after the
        Phase 2 rename.
  - [ ] `.github/workflows/*`
  - [ ] `docs/` references
- [ ] Verify `ctest --verbose` runs all unit + integration tests.

## Phase 4 — Tooling and third-party cleanup

**Risk:** low. **Goal:** finish the layout; nothing functional changes.

- [ ] `git mv cmake               tools/cmake`
- [ ] `git mv misc/prettier       tools/prettier`
- [ ] `git mv overlay_ports       third_party/overlay_ports`
- [ ] `git mv overlay_triplets    third_party/overlay_triplets`
- [ ] Move `vcpkg` submodule to `third_party/vcpkg`:
  - [ ] Edit `.gitmodules` to update the path
  - [ ] `git mv vcpkg third_party/vcpkg`
  - [ ] `git submodule sync && git submodule update --init`
  - [ ] Update any `CMAKE_TOOLCHAIN_FILE` path references in CI and
        `build.sh`.
- [ ] Move loose scripts: `misc/deps_linux`, `misc/github_env_linux`,
      `misc/install_git_hooks.cmake` → `tools/scripts/`.
- [ ] Update path references:
  - [ ] Root `CMakeLists.txt` `include()` calls referencing `cmake/...`
  - [ ] All `*.cmake` files referencing sibling helpers
  - [ ] `.github/workflows/*`
  - [ ] `build.sh`
  - [ ] `docs/`
- [ ] Delete `misc/` if it's now empty.
- [ ] Update `CLAUDE.md` build/test instructions and `docs/` to reflect
      the new layout.

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
