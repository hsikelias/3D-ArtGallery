# HackNite: 3D Art Gallery

## Artwork planes (`feature/artwork-placement`)

The gallery displays 15 supplied JPEG/PNG artworks on `ArtSlot_01` through `ArtSlot_15`. Landscape and portrait images keep their original proportions. The status panel should report `15 artworks loaded`.

| Slot | Artwork filename |
| --- | --- |
| ArtSlot_01 | CottonRiver.jpg |
| ArtSlot_02 | Elephant.jpg |
| ArtSlot_03 | Kanye.jpg |
| ArtSlot_04 | LadyInTheForest.jpg |
| ArtSlot_05 | MarioDTS.png |
| ArtSlot_06 | MontogomeryCalendar.png |
| ArtSlot_07 | Nest.jpg |
| ArtSlot_08 | Portrait Study1.png |
| ArtSlot_09 | Pure Souls.png |
| ArtSlot_10 | QueensGambit.jpg |
| ArtSlot_11 | Sargent.jpg |
| ArtSlot_12 | Sargent2.jpg |
| ArtSlot_13 | Sketch1.jpg |
| ArtSlot_14 | Spoon.jpg |
| ArtSlot_15 | Study.jpg |

To use your own test artwork:

1. Copy JPEG/PNG files into `client/public/test-art/`.
2. Edit the filename list in `client/src/artwork/testImages.js`, for example `my-painting.jpg`. Use the exact filenames, including capitalization and extension. Spaces are encoded automatically when building the URLs. Adding a file alone does not add it to the selection.
3. Run `cd client` then `npm run dev`. Refresh and check the artwork count in the status panel.
4. Image order maps to slot order. Supply up to 15 URLs; fewer images leave the remaining slots empty. Failed images leave their assigned slot empty and report details in the console.

The renderer uses front-facing image planes on brown rectangular backings. Image aspect ratios are preserved within an 8-by-8-unit display limit; no cropping or stretching occurs. Each backing adds a 0.25-unit border on every edge (0.5 extra total width and height) and has a tuned depth of 0.25 units. The backing stays in front of the wall, with its image surface projecting into the room. The image sits 0.01 units in front of the backing to avoid flickering. Tune `artworkFrame` in `src/artwork/imagePlacement.js` to change the border, depth, or brown color. These dimensions are gallery units, independent of image pixel resolution. Artwork uses an unlit material so gallery preview lighting does not obscure its colors; the brown backing responds to scene lighting.

`src/artwork/slotConfig.js` contains manually configured world-space rotations, size limits, and wall offsets for all 15 slots, including the interior divider. `ArtSlot_05` has a small position correction because that anchor sits farther from the wall. No Blender file changes are needed. The developer can tune these values as the gallery layout evolves.

### Popup integration for the UI teammate

The artwork renderer has no form or upload dependencies. Keep the manager created in `main.js`, remove its temporary `testImageUrls` call when connecting the popup, and pass the chosen image URLs instead:

```js
const artworkManager = createArtworkManager({ scene, artSlots });
const result = await artworkManager.setImages(selectedImageUrls);
// result.loadedCount, result.errors [{ slot, url, message }], result.superseded
```

Reuse this manager for later selections. `setImages` replaces previous planes and releases their textures; slow results from an older selection cannot overwrite a newer one. Use `clear()` for an empty gallery and `dispose()` when leaving the scene. The component that creates local object URLs owns revoking them once they are no longer needed by previews or texture loading. Shared room uploads still require URLs accessible to other browsers.

Only the artwork imports and a small startup block were added to `main.js`; the popup HTML and player/camera code were not changed. The backing is a child of each image plane and is cleaned up with it; the image-selection API is unchanged.

From `client/`, verify with:

```bash
node --test test/artwork.test.js
npm run build
```

The tests cover aspect-ratio fitting, wall clearance for all 15 slots against the actual GLB, failure isolation, replacement cleanup, and overlapping image selections. Also check the images visually in the running app before merging.

## Ghost model preview (`feature/ghost-mesh`)

Following PLAN.md sections 8 and 14, `client/src/player/ghost_mesh.js` builds a
reusable Pac-Man-style ghost with a rounded dome, cylindrical body, scalloped
skirt, and eyes. Each instance has its own body material and an attached name
label. The requested preview overrides the plan's static, solid, fixed-palette
defaults: it uses a generated pastel hex color, 85% opacity, and gentle bobbing.
The model file contains no movement or camera logic; preview bobbing and spawn
placement live in `main.js`, and label rendering lives in `createScene.js`.

Run `cd client` then `npm run dev`. The ghost replaces the Blender `Player`
reference at its original floor position, with its height matched to that reference.
`PlayerSpawn` is relocated there at runtime; the GLB stays unchanged.
Movement and the third-person camera come from `origin/feature/player-movement`
(`debba03`), following PLAN.md sections 9–10. Click the gallery and use WASD;
drag to orbit, scroll to zoom, and press Escape to release keyboard focus.
Reset returns both the player and camera to the new spawn. Reload to generate a
new pastel color. The outlined name follows the ghost; visual bobbing does not
move the camera or player pivot. Multiplayer color assignment is not connected yet.

### Exterior collision (PLAN.md Stage 7)

The ghost now collides with the eight outside wall segments, including the
narrow entrance and its shoulders. Interior partitions remain passable by
design. `exteriorCollision.js` stores the measured X/Z outline of this GLB;
update it if the exterior is remodeled. The controller supplies the ghost's
radius and resolves short movement steps independently along X/Z to slide along
walls. Bobbing and camera orbit do not change the collision footprint.

Run `node --test test/exteriorCollision.test.js` inside `client` for collision
checks. In the browser, walk into each outside wall and corner, move diagonally
along a wall, cross the entrance, and walk through the inside partitions.
Camera collision remains a separate future feature. Stop here to review Stage 7.

A browser-based multiplayer art gallery with colored ghost avatars. See [PLAN.md](PLAN.md) for the staged roadmap.

## Current milestone: artwork placement with player controls

The frontend loads the Blender gallery, displays 15 framed artworks, and supports a colored ghost with third-person movement and exterior wall collision. The artwork renderer is ready for the popup's image selection. Multiplayer, shared uploads, and voice remain later stages.

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

If you already have the repository, open a terminal in that folder instead. Use the branch being reviewed, or updated `main` once the feature has been merged.

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

To review the artwork feature after its author pushes it:

```bash
git fetch origin
git switch feature/artwork-placement
cd client
npm ci
node --test
npm run build
npm run dev
```

Verify all 15 artworks, frame depth, image proportions, ghost movement, resize handling, and scene diagnostics. Record the result on the PR. Once merged on GitHub, everyone returns to the repository root, switches to `main`, and runs `git pull --ff-only`. A local merge alone does not update GitHub. Preserve uncommitted work before switching branches.

## Current verification checklist

- [ ] Each teammate can install dependencies and run the frontend.
- [ ] The gallery geometry and materials appear, and its scale is reviewed against the Blender reference.
- [ ] All 15 artworks load with correct proportions and brown backings clear of the walls.
- [ ] Ghost movement and exterior collision still work.
- [ ] `node --test` succeeds from `client/`.
- [ ] `npm run build` succeeds.
- [ ] A teammate reviews the feature PR before it is merged.

Next: connect the popup's selected image URLs to the existing artwork manager, coordinating the integration with the UI teammate. Shared uploads and room state come later.

# Team Members
1. Lekish Sai Podili
2. Brando Vasquez
3. Subanee Acharya
4. Mateus Landowski

## Inspect the gallery (Stage 1)

- `src/scene/createScene.js` creates the scene, perspective camera, renderer, resize handler, render loop, and temporary OrbitControls. Camera position and target are explicit values for the current export.
- `src/scene/loadGallery.js` loads `/models/gallery.glb`, preserves its transforms and authored materials/lights, and logs object names, world spawn coordinates, dimensions, and imported lights.
- `src/scene/configureGalleryPreview.js` gives meshes with no exported material a matte, double-sided preview material. It adds temporary point lights at LightBulb objects only if the GLB has no actual lights. Authored materials are not overwritten.
- Click the gallery and use WASD to move the ghost, drag to orbit, scroll to zoom, and press Escape to release keyboard focus. Reset returns the player and camera to spawn; panning is disabled by the player controller.
- Open browser developer tools (F12), then Console, to inspect the object table.
- Confirm 15 artwork anchors and PlayerSpawn are reported. Resize the window and check the view is not stretched.
- The current export contains 11 visible LightBulb fixtures but no exported light objects. Inspection lighting controls a hemisphere fill plus 11 temporary point lights; turning it off leaves only any imported lights and emissive surfaces. These preview lights do not cast shadows and may illuminate through walls. Final lighting will need separate tuning.
- The Floor mesh (which includes the room surfaces) and Player reference mesh have no assigned material in the GLB. glTF's default material loads as metallic and single-sided; this caused dark surfaces and walls disappearing from the back. The temporary fallback keeps both sides visible without modifying the GLB.
- The ghost is constrained by exterior walls; interior partitions remain passable. The camera can still pass through walls because camera obstruction handling is not implemented.
- Check scale visually with the Blender reference before approving. Dimensions are reported in exported units; no automatic rescaling is applied.
- Loading errors appear in the panel and browser console.
- The production build may report a bundle-size warning for Three.js; this is not a build failure.

## Hackathon artwork direction

The intended source is images selected from the user's device; Bluesky is out of scope. The current preview uses bundled JPEG/PNG files. Keep `gallery.glb` unchanged and tune placement, facing direction, display dimensions, and wall offsets manually in JavaScript.

- The 15 existing `ArtSlot` anchors supply world-space center positions.
- `src/artwork/slotConfig.js` holds each slot's rotation, maximum width/height, and wall offset. Manual rotations compensate for the unrotated Blender anchors.
- The renderer fits each image within those limits while preserving its aspect ratio, without stretching or cropping.
- Stage 9 connects local file selection and preview to the renderer. Stage 14 adds shared upload URLs so other players can see the selected images. Local `blob:` URLs cannot serve as shared room artwork URLs.
- Existing preview materials and lighting can be tuned in Three.js. Exact matching to Blender's render is not required for the hackathon.

Artwork rendering and manual slot configuration are implemented. File selection, shared storage, and multiplayer integration remain separate work. See PLAN.md for the updated stages.
