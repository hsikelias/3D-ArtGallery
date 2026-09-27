# HackNite: 3D Art Gallery

A browser-based multiplayer art gallery with colored ghost avatars. See [PLAN.md](PLAN.md) for the staged roadmap.

## Current milestone: Stage 0

The frontend uses plain JavaScript, HTML/CSS, Vite, and Three.js. The starter page verifies the Three.js import. Gallery loading, ghosts, multiplayer, and voice will be added in later stages.

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

If you already have the repository, open a terminal in that folder instead. The setup initially lives on `feature/project-setup`; until its PR is merged, reviewers should fetch and switch to that branch.

Run frontend commands inside `client`, not the repository root:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173). The page should say that JavaScript is running and display the loaded Three.js revision. Stop the server with `Ctrl+C`.

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
| `client/index.html` | Starter page and JavaScript entry point |
| `client/src/main.js` | Imports Three.js and updates the setup status |
| `client/src/style.css` | Responsive starter page styling |
| `client/package.json` | Dependencies and dev/build/preview commands |
| `client/package-lock.json` | Exact resolved dependency versions for teammates |
| `.gitignore` | Excludes dependencies, generated builds, and local environment files |

Vite serves the frontend during development and bundles it for production. Three.js is installed for the upcoming 3D scene. No framework or server is needed for Stage 0.

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
git commit -m "Set up Vite JavaScript frontend with Three.js"
git push -u origin feature/project-setup
```

To review the setup before it is merged, after the author pushes it:

```bash
git fetch origin
git switch feature/project-setup
cd client
npm ci
npm run build
npm run dev
```

Verify the starter page and Three.js status, and record the result on the PR. Once merged, everyone returns to the repository root, switches to `main`, and runs `git pull --ff-only`. Preserve uncommitted work before switching branches.

## Stage 0 verification checklist

- [ ] Each teammate can install dependencies and run the frontend.
- [ ] The page displays the JavaScript/Three.js success message.
- [ ] `npm run build` succeeds.
- [ ] A teammate reviews the setup PR before it is merged.

Next: create `feature/gallery-loader` from updated `main` and implement Stage 1 from PLAN.md. Add `gallery.glb` under `client/public/models/` when that stage begins.

# Team Members
1. Lekish Sai Podili
2. Brando Vasquez
3. Subanee Acharya
4. Mateus Landowski
