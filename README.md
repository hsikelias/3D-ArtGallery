# HackNite: 3D Art Gallery

A browser-based multiplayer art gallery with colored ghost avatars. See [PLAN.md](PLAN.md) for the staged roadmap.

## Current milestone: Stage 1

The frontend loads the Blender gallery with Three.js. A temporary camera, mouse inspection controls, and scene diagnostics help verify the export. Ghosts, artwork placement, multiplayer, and voice remain later stages.

## Requirements

- Git and access to this repository.
- Node.js and npm. Vite 8 requires Node.js `^20.19.0 || >=22.12.0`; use the same supported version across the team. This setup was verified with Node.js 26.4.0 and npm 12.0.1.

Check your installation:

```bash
node --version
npm --version
git --version
```

## Run locally

For a new checkout:

```bash
git clone https://github.com/hsikelias/3D-ArtGallery.git
cd 3D-ArtGallery
```

If you already have the repository, open a terminal in that folder instead. The setup initially lives on `feature/gallery-loader`; until its PR is merged, reviewers should fetch and switch to that branch.

Run frontend commands inside `client`, not the repository root:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173). The page should display the gallery and report the artwork anchors, spawn anchor, and imported lights. Stop the server with `Ctrl+C`.

For a clean install using the committed lockfile, use `npm ci` instead of `npm install`. Commit `package-lock.json` when dependencies change; never commit `node_modules` or `dist`.

## Build and preview

From `client/`:

```bash
npm run build
npm run preview
```

The build creates `client/dist/`. Preview serves that production build locally; open the URL printed in the terminal. Stop with `Ctrl+C`.

## What the files do

| File | Purpose |
| --- | --- |
| `client/index.html` | Gallery viewport, inspection panel, and JavaScript entry point |
| `client/src/main.js` | Starts the scene, loads the gallery, and reports errors |
| `client/src/style.css` | Full-window canvas and inspection panel styling |
| `client/package.json` | Dependencies and dev/build/preview commands |
| `client/package-lock.json` | Exact resolved dependency versions for teammates |
| `.gitignore` | Excludes dependencies, generated builds, and local environment files |

Vite serves the frontend during development and bundles it for production. Three.js renders the imported gallery. No backend server is needed yet.

## Team Git workflow

Work on one small feature branch at a time. From the repository root, with your previous work committed:

```bash
git switch main
git pull --ff-only
git switch -c feature/your-task
```

After implementing and testing, inspect your changes with `git status` and `git diff`. Stage only intended files, commit, and push your branch. Open a pull request targeting `main`; another teammate should run it before merging.

For the initial setup branch, the author can use:

```bash
git add .gitignore README.md client/package.json client/package-lock.json client/index.html client/src
git commit -m "Load Blender gallery with inspection controls"
git push -u origin feature/gallery-loader
```

To review the setup before it is merged, after the author pushes it:

```bash
git fetch origin
git switch feature/gallery-loader
cd client
npm ci
npm run build
npm run dev
```

Verify the gallery, mouse controls, resize handling, and scene diagnostics, and record the result on the PR. Once merged, everyone returns to the repository root, switches to `main`, and runs `git pull --ff-only`. Preserve uncommitted work before switching branches.

## Stage 1 verification checklist

- [ ] Each teammate can install dependencies and run the frontend.
- [ ] The gallery geometry and materials appear, and its scale is reviewed against the Blender reference.
- [ ] `npm run build` succeeds.
- [ ] A teammate reviews the setup PR before it is merged.

Next: after Stage 1 review, implement Stage 2: a temporary cube at PlayerSpawn and a plane at ArtSlot_01.

# Team Members
1. Lekish Sai Podili
2. Brando Vasquez
3. Subanee Acharya
4. Mateus Landowski

## Inspect the gallery (Stage 1)

- `src/scene/createScene.js` creates the scene, perspective camera, renderer, resize handler, render loop, and temporary OrbitControls. Camera position and target are explicit values for the current export.
- `src/scene/loadGallery.js` loads `/models/gallery.glb`, preserves its transforms and authored materials/lights, and logs object names, world spawn coordinates, dimensions, and imported lights.
- `src/scene/configureGalleryPreview.js` gives meshes with no exported material a matte, double-sided preview material. It adds temporary point lights at LightBulb objects only if the GLB has no actual lights. Authored materials are not overwritten.
- Left-drag to orbit, scroll to zoom, right-drag to pan, and use Reset view to return inside the room. These are development controls, not the future ghost controller.
- Open browser developer tools (F12), then Console, to inspect the object table.
- Confirm 15 artwork anchors and PlayerSpawn are reported. Resize the window and check the view is not stretched.
- The current export contains 11 visible LightBulb fixtures but no exported light objects. Inspection lighting controls a hemisphere fill plus 11 temporary point lights; turning it off leaves only any imported lights and emissive surfaces. These preview lights do not cast shadows and may illuminate through walls. Final lighting will need separate tuning.
- The Floor mesh (which includes the room surfaces) and Player reference mesh have no assigned material in the GLB. glTF's default material loads as metallic and single-sided; this caused dark surfaces and walls disappearing from the back. The temporary fallback keeps both sides visible without modifying the GLB.
- The free inspection camera can still pass through walls. Player collision and camera obstruction handling belong to the later controls stages; rendering both sides of a wall does not provide collision.
- Check scale visually with the Blender reference before approving. Dimensions are reported in exported units; no automatic rescaling is applied.
- Loading errors appear in the panel and browser console.
- The production build may report a bundle-size warning for Three.js; this is not a build failure.

## Correct the Blender export before final lighting

1. Assign explicit Principled BSDF materials to the room surfaces. Start with a light neutral base color, Metallic 0, and high Roughness for matte walls.
2. Check wall normals and thickness. For intentionally thin planes that must be visible from both sides, disable material backface culling for export. For solid walls, fix normals and provide thickness as needed.
3. Include actual Point, Spot, or Sun lights when exporting glTF. Bright/emissive bulb meshes alone do not light the room in this Three.js setup. Blender Area lights and World lighting are not exported by glTF; recreate their effect in Three.js or bake suitable lighting into textures later.
4. Replace `client/public/models/gallery.glb` and reload. Confirm the console reports authored materials and imported lights. The preview material is only applied where a material is absent, and bulb lights are skipped when actual lights are imported.

Reference: [Blender glTF export documentation](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html). Differences between Blender rendering and the browser still require visual tuning; the temporary preview is not a reproduction of the Blender render.
