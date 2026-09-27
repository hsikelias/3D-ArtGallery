# Multiplayer 3D Art Gallery — Project Guide for the Team and Coding Agents

## 0. Purpose of This Document

This file is the working technical guide for the project.

It is meant to be read by:

- the 4-person hackathon team
- any coding agent helping the team
- future contributors who need to understand the project quickly

The project should **not** be one-shot generated.

The team wants to understand how the project works while still using AI coding assistance heavily. Therefore, coding agents should build the project **incrementally**, explain each major system before or while implementing it, and stop at clear checkpoints so the team can test and understand the result.

The overall rule is:

> Build the smallest working version of each system first, then combine the systems, then polish.

Do not build advanced features before the earlier stage is working.

---

# 1. Project Idea

The project is a **multiplayer 3D art gallery in the browser**.

Instead of viewing an artist's work in a normal social-media feed or portfolio grid, users enter a stylized 3D gallery and move around it as a simple ghost avatar. Keyboard input moves the ghost, and mouse movement controls the camera view. The ghost has no character animations.

A gallery owner should eventually be able to:

1. enter their display name
2. provide/select artwork
3. create a gallery
4. enter the 3D gallery
5. receive a room code
6. share that code
7. have other users join
8. walk around the gallery together
9. see each other's names and movement
10. eventually talk using proximity voice chat

The project is intentionally not a giant metaverse or open world.

The core experience is:

```text
artist / user
      ↓
select artwork
      ↓
create gallery
      ↓
enter 3D room
      ↓
walk around
      ↓
invite friends
      ↓
explore together
```

The goal is to make it feel like:

> "I am physically visiting someone's digital art exhibition."

---

# 2. Current Visual Direction

The gallery is intentionally minimalist and stylized.

Current Blender work includes:

- gallery room/environment
- walls and architectural divisions
- floor
- ceiling
- point lights / bulb objects
- designated artwork locations
- a temporary player-height reference
- artwork slot Empty objects
- a future player spawn Empty

The artwork itself should visually remain the focus.

Avoid filling the environment with unnecessary decoration.

Possible later props:

- bench
- plant
- pedestal
- small sculpture
- minimal signage
- simple decorative objects

---

# 3. Core Technical Stack

## Frontend Application

### Vite

Use Vite as the development/build environment.

Responsibilities:

- local development server
- frontend bundling
- fast reloads
- production build

---

### JavaScript

Use JavaScript unless the team explicitly decides to migrate to TypeScript later.

Do not introduce TypeScript just because an agent prefers it.

The team should prioritize understanding the project over adding unnecessary abstraction.

---

### Three.js

Three.js is the main 3D engine.

Three.js is responsible for:

- loading the Blender gallery
- rendering the 3D scene
- rendering player models
- loading GLB / glTF assets
- camera movement
- third-person camera behavior
- ghost movement
- ghost rotation
- displaying artwork textures
- positioning artwork at Blender anchors
- lighting adjustments
- collision detection
- raycasting
- spatial information used by proximity voice
- rendering remote multiplayer users

---

### HTML / CSS

Used for all normal interface elements such as:

- landing page
- username form
- create gallery screen
- join gallery screen
- room code display
- artwork selector
- loading screen
- HUD
- microphone controls
- player name tags where appropriate

---

### React

React is optional.

If React is used, it should mainly organize the website UI.

Do not introduce React Three Fiber unless the team deliberately chooses it.

The simplest planned architecture is:

```text
React or normal DOM UI
        +
Three.js 3D scene
```

Three.js should remain understandable as its own system.

---

# 4. Blender's Role

Blender is used to create the visual 3D assets.

Blender is **not** responsible for game logic.

Blender should contain:

## Gallery

- floor
- walls
- ceiling
- architectural details
- visible light fixtures / bulbs
- props
- artwork location anchors
- player spawn anchor
- optional collision geometry

## Ghost Avatar

Each user is represented by a simple ghost with no character animations.

Build the first ghost from simple Three.js geometry. A static `ghost.glb` can replace its visual shape later while keeping the same color, username, and networking logic. A custom Blender character is not required.

No Mixamo workflow, armature, skeleton, rigging, or Idle/Walk/Run clips are needed. Three.js moves and rotates the whole ghost directly in response to user input.

---

# 5. Blender → Web Conventions

These conventions are important because Three.js will look for Blender objects by name.

## Artwork Anchors

Artwork locations are represented by Blender Empty objects.

Use names:

```text
ArtSlot_01
ArtSlot_02
ArtSlot_03
...
```

The Empty represents:

- where the artwork should be centered
- optionally its orientation

For the hackathon, keep the existing GLB unchanged and use each Empty's world position. All 15 current artwork anchors have the same unrotated orientation, so configure the artwork's wall-facing rotation manually in JavaScript.

Blender changes are not required for artwork placement. Keep per-slot rotation, maximum width/height, and any small position correction in `client/src/artwork/slotConfig.js`.

The program will create image planes in Three.js.

The Empty itself is invisible.

---

## Player Spawn

Create:

```text
PlayerSpawn
```

or later:

```text
PlayerSpawn_01
PlayerSpawn_02
PlayerSpawn_03
```

This Empty defines where new users enter the gallery.

Blender defines the artistic spawn position.

Three.js / multiplayer code uses that location when spawning a player.

---

## Light Objects

Blender can contain:

```text
Bulb_01
Bulb_02
...
```

The visible bulb or fixture should be a normal mesh.

Point lights may also be exported in the GLB.

Three.js will load the scene and then the team will test how those lights look in the browser.

If necessary, Three.js can:

- modify imported light intensity
- modify light distance
- modify decay
- enable or disable shadows
- create replacement Three.js lights

Do **not** delete the Blender lights before testing the GLB in Three.js.

---

# 6. Artwork System — First Version

Do not build a complicated dynamic frame system first.

The first artwork system should be extremely simple.

Use a simple brown backing for depth: put each image plane just in front of a brown box. Add 0.5 gallery units to the image's total width and height (0.25 on each edge), use the current tuned depth of 0.25 units, and leave a 0.01-unit gap between the image and the box's front. Keep aspect-ratio fitting unchanged. This is a plain rectangular backing, not an elaborate frame or molding system; all dimensions are configurable in JavaScript. Keep the rear of the box clear of the wall and place the image outward by the box depth plus the image gap.

Each artwork slot is:

```text
Blender Empty
     ↓
Three.js image plane
```

Example:

```text
ArtSlot_01
     ↓
image plane containing selected image
```

Three.js:

1. finds `ArtSlot_01`
2. creates a plane
3. loads the image as a texture
4. preserves the image's aspect ratio
5. places the plane at the Empty's world position using its manually configured rotation and wall offset
6. repeats for the remaining artwork

Example concept:

```js
const slot = gallery.getObjectByName("ArtSlot_01");
```

When the artwork is added directly to the main scene, use the anchor's world position rather than its parent-relative position:

```js
slot.getWorldPosition(artwork.position);
artwork.rotation.set(0, slotSettings.rotationY, 0);
artwork.translateZ(slotSettings.wallOffset + artworkFrame.depth + artworkFrame.imageGap);
```

Do not stretch images.

Use their original aspect ratio.

## Manual Slot Configuration

Developers tune the artwork in code; users only select images. No Blender re-export or user-entered aspect ratio is required.

Each slot configuration defines:

- `rotationY`: absolute facing direction in Three.js world space, in radians
- `maxWidth` and `maxHeight`: the available display area in gallery units
- `wallOffset`: clearance behind the backing along local positive Z, pointing into the room; the image is farther out by the frame depth and image gap
- optional position corrections in world units if an anchor needs adjustment

Check the facing direction with a plain plane at each wall before finalizing the values. Do not guess final rotations from the names alone. Keep configuration keyed by `ArtSlot_01` through `ArtSlot_15`, and use the same configuration in every browser.

Fit the image inside the configured display area without stretching or cropping:

```js
const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
const artworkWidth = imageWidth * scale;
const artworkHeight = imageHeight * scale;
```

Read dimensions after the image has loaded successfully. Create the plane with the resulting width and height and center it on the anchor. These are world-space dimensions; image pixels do not determine the gallery's physical scale.

---

# 7. Artwork Source Strategy

## First Development Version

Before any external API is involved, hardcode a few test images.

Example:

```js
const artworks = [
  "/test-art/01.jpg",
  "/test-art/02.jpg",
  "/test-art/03.jpg"
];
```

This lets the team prove:

```text
gallery loads
+
artwork appears
+
slots work
```

before dealing with network/API problems.

---

## Planned Hackathon Artwork Flow

User-selected image uploads are the only hackathon artwork source. Bluesky integration is out of scope.

Potential flow:

```text
user enters a display name
        ↓
user chooses images from their device
        ↓
validate files and load local previews
        ↓
display image thumbnails
        ↓
user selects up to gallery slot count
        ↓
selected images are assigned to ArtSlot_01... using manual slot settings
        ↓
gallery is created
```

Important:

Accept different image aspect ratios and fit them automatically using Section 6. Start with JPEG and PNG, a maximum selection matching the available slots (currently 15), and an explicit per-file size limit in the UI. Reject unreadable files with a clear message.

Local previews can use `URL.createObjectURL(file)`. Revoke these URLs when their previews/textures are no longer needed. This is local file selection, not yet an upload to shared storage.

For multiplayer, the selected files must be uploaded to a server or storage service that every joining browser can access. Use the returned shared URLs in room data. A creator's local `blob:` URLs cannot be shared as working image URLs with other players. Implement this shared upload step with Stage 14; the deployment/storage choice remains to be decided.

The first placement logic can still remain simple:

```text
selectedImages[0] → ArtSlot_01
selectedImages[1] → ArtSlot_02
selectedImages[2] → ArtSlot_03
...
```

Smarter curation / rearranging can come later.

---

# 8. Ghost Avatar System

For the first version, every player uses the **same simple ghost shape**, with their own body color and username label.

Users do not need character customization.

Players can be distinguished using:

- username
- a distinct body/material color assigned from a palette

## Reusable Ghost Construction

Build a rounded head, a slightly flared body, and two black oval eyes using Three.js geometry. `LatheGeometry` is an option for forming the rounded body from a simple outline.

Put the body and eyes inside a `THREE.Group`. Moving or rotating the group moves the whole ghost. Start with solid pastel body colors such as pink, blue, mint, yellow, lavender, and orange.

Reuse geometry across players, but give each ghost its own body material. If cloning an existing ghost, clone its body material before changing its color so recoloring one player does not recolor others. Eyes stay black.

Use one reusable function for local players, remote players, and temporary test ghosts:

```js
createGhost({ id, username, color })
```

Attach a username label above the ghost as described in Section 14. The local ghost receives keyboard movement input; remote ghosts receive network movement updates. Mouse input controls only the local camera.

## Color Assignment

When a player joins, the server assigns an unused color from the palette and stores it with their ID and username. Once rooms exist, assign colors within each room.

If all palette colors are in use, colors may repeat; username labels still help distinguish users. A departing player's color becomes available again if no remaining player uses it.

The server sends the assigned color to all clients so everyone sees the same appearance for each player. Browsers must not independently randomize remote players' colors.

The ghost is a static visual object. It has no Idle, Walk, Run, bobbing, or other character animations. Movement changes its position directly.

No jump is required initially.

No facial animation.

No emotes.

No inventory.

---

# 9. Ghost Movement Logic

Three.js updates the ghost's position from keyboard input each frame.

```text
no movement input → remain stationary
WASD → move the ghost
mouse movement → rotate the camera view
```

Movement is relative to the camera's horizontal direction. Looking up or down does not make the ghost fly; it moves around the gallery at a fixed height above the floor and respects collision boundaries.

Shift may increase movement speed, but does not trigger an animation.

No `AnimationMixer`, animation clips, or animation state machine is needed. Multiplayer synchronizes position and rotation; there is no animation state to send or play.

---

# 10. Third-Person Camera

Three.js handles the camera.

No separate camera engine is required.

Desired behavior:

```text
mouse movement
      ↓
rotate camera around player

WASD
      ↓
move relative to camera direction

ghost
      ↓
rotate toward movement direction
```

Important:

```text
camera rotation
!=
ghost rotation
```

The player should be able to rotate the camera around a stationary ghost.

When movement begins, the ghost should rotate toward the movement direction.

The camera should smoothly follow the player.

---

# 11. Multiplayer Stack

Use:

```text
Node.js
+
Socket.IO
```

The server should initially be lightweight.

The server handles:

- connecting users
- creating rooms
- joining rooms
- leaving rooms
- usernames
- ghost body color assignment
- player positions
- player rotations
- spawn/despawn events
- room information
- WebRTC signaling later

The server does **not** constantly send the whole 3D gallery.

Every browser loads the same gallery GLB locally.

---

# 12. Multiplayer Player State

An early multiplayer packet may look like:

```js
{
  id: "socket-id",
  username: "Alex",
  color: "#7CB9FF",
  x: 4.2,
  y: 0,
  z: -2.1,
  rotationY: 1.4
}
```

Do not overcomplicate this schema initially.

Use `id` to identify players internally, since usernames may be duplicated. `color` is the ghost's body color.

Send username and color with spawn/join information, including the existing player list for a new arrival. Regular movement updates need only the player ID, position, and rotation; they do not need to resend appearance data or any animation state.

---

# 13. Remote Players

The local player is controlled by keyboard/mouse.

Remote players are controlled by multiplayer data.

Conceptually:

```text
LOCAL PLAYER
keyboard/mouse
      ↓
movement

REMOTE PLAYER
Socket.IO messages
      ↓
movement
```

Both can still reuse much of the same ghost avatar code.

---

# 14. Name Tags

Each player should display their username above their ghost.

Use an HTML label attached above the ghost with:

```text
CSS2DRenderer
```

Create a `CSS2DObject` for each label and render labels with `CSS2DRenderer` alongside the Three.js scene. Use white text on a dark background for readability across all ghost colors. Set the username with `textContent`, not `innerHTML`, and keep labels from intercepting mouse controls.

Example:

```text
       Vann
        👻
```

Body color and username together distinguish players. Separate name-tag colors and full character customization are not required.

---

# 15. Proximity Voice Chat — Future Stage

Voice chat should **not** be implemented during the earliest stages.

Eventually use:

```text
WebRTC
+
Web Audio API
+
Three.js player positions
+
Socket.IO signaling
```

Responsibilities:

### WebRTC

Carries microphone audio.

### Socket.IO

Handles connection/signaling information.

### Three.js

Provides player coordinates.

### Web Audio API

Provides:

- distance attenuation
- directional sound
- left/right spatialization
- maximum hearing distance

Concept:

```text
near player
→ loud

medium distance
→ quieter

far player
→ inaudible
```

Wall occlusion is a stretch goal.

Do not implement voice chat until normal multiplayer movement is stable.

---

# 16. Recommended Project Structure

An initial structure could become:

```text
project/
│
├── client/
│   ├── public/
│   │   ├── models/
│   │   │   ├── gallery.glb
│   │   │   └── ghost.glb (optional static asset)
│   │   │
│   │   └── test-art/
│   │
│   └── src/
│       ├── main.js
│       │
│       ├── scene/
│       │   ├── createScene.js
│       │   └── loadGallery.js
│       │
│       ├── player/
│       │   ├── createPlayer.js
│       │   ├── movement.js
│       │   └── camera.js
│       │
│       ├── artwork/
│       │   ├── artworkManager.js
│       │   ├── slotConfig.js
│       │   └── imagePlacement.js
│       │
│       ├── multiplayer/
│       │   ├── socket.js
│       │   └── remotePlayers.js
│       │
│       ├── voice/
│       │   └── proximityVoice.js
│       │
│       └── ui/
│           ├── createGallery.js
│           └── joinGallery.js
│
└── server/
    ├── server.js
    ├── rooms.js
    └── players.js
```

Do not create every file immediately.

Split files when the feature actually exists.

---

# 17. DEVELOPMENT STAGES

The coding agent should follow these stages in order.

Do not skip ahead unless the team explicitly requests it.

---

# STAGE 0 — Repository and Development Setup

## Goal

Everyone can clone the repository and run the same project.

## Tasks

1. create Git repository
2. create Vite frontend
3. install Three.js
4. confirm `npm install`
5. confirm `npm run dev`
6. add `.gitignore`
7. create basic README
8. commit the working starter project

## Success Condition

Every teammate can:

```bash
git clone ...
npm install
npm run dev
```

and see the starter page.

---

# STAGE 1 — Show the 3D Scene in the Browser

## THIS SHOULD BE THE FIRST REAL HACKATHON TASK

When the team first sits down in the hacking room, do **not** start with multiplayer.

Do not start with image storage services.

Do not start with artwork uploads.

Do not start with voice chat.

The first goal is:

> The Blender gallery appears inside the website.

## Step 1

Export the current gallery from Blender as:

```text
gallery.glb
```

Place it in:

```text
client/public/models/gallery.glb
```

## Step 2

Create a Three.js scene.

Need:

- Scene
- PerspectiveCamera
- WebGLRenderer
- resize handling
- animation/render loop

## Step 3

Use `GLTFLoader`.

Load:

```text
/models/gallery.glb
```

## Step 4

Add the loaded scene:

```js
scene.add(gltf.scene);
```

## Step 5

Position the development camera manually.

Do not build the ghost controller yet.

Use a temporary camera position that lets the team inspect the room.

## Step 6

Confirm:

- geometry appears
- materials appear
- scale looks correct
- artwork Empty objects exist
- `PlayerSpawn` exists
- imported lights can be inspected

## Debugging

Print object names:

```js
gltf.scene.traverse((object) => {
  console.log(object.name, object.type);
});
```

The team should be able to find:

```text
ArtSlot_01
ArtSlot_02
...
PlayerSpawn
```

## Success Condition

Open browser:

```text
http://localhost:...
```

and see the Blender gallery.

Nothing else matters yet.

---

# STAGE 2 — Understand the Loaded Blender Scene

## Goal

Prove that Blender objects can control the web scene.

## Tasks

1. find `PlayerSpawn`
2. log its coordinates
3. find `ArtSlot_01`
4. log its coordinates
5. add a temporary Three.js cube at `PlayerSpawn`
6. add a temporary plane at `ArtSlot_01`

## Success Condition

A cube appears where a player will eventually spawn.

A plane appears exactly where an artwork will eventually be displayed.

This stage proves:

```text
Blender anchors
        ↓
Three.js
```

works correctly.

---

# STAGE 3 — Basic Artwork Placement

## Goal

Display hardcoded test images in the gallery.

## Tasks

1. place several test JPG/PNG images in `public/test-art`
2. load image textures
3. create plane geometry
4. preserve aspect ratio
5. place planes at `ArtSlot_01`, `ArtSlot_02`, etc.
6. offset artwork slightly from the wall if needed to prevent z-fighting
7. tune per-slot facing directions and maximum display dimensions in `slotConfig.js`; use the existing GLB without editing Blender

## Do Not Build Yet

- external APIs
- uploading
- elaborate frames or molding geometry
- drag/drop rearranging
- advanced sizing system

## Success Condition

Several real images appear correctly on the gallery walls.

---

# STAGE 4 — Create the Ghost Avatar

## Goal

Put a simple ghost avatar in the gallery.

## Tasks

1. create a reusable `createGhost({ id, username, color })` using simple Three.js geometry
2. set its scale and height relative to the gallery floor
3. place the ghost at `PlayerSpawn`
4. confirm that the ghost renders correctly without rigging or animation setup
5. create three temporary stationary ghosts with different body colors and test usernames above them
6. verify that changing one ghost's body color does not change the others

## Success Condition

The ghost appears at the intended spawn point. Three stationary test ghosts display distinct colors and readable usernames before movement is connected. Use hardcoded test identities here; server assignment comes in Stage 12. Remove the extra test ghosts after verification.

---

# STAGE 5 — Ghost Movement

## Goal

Walk around the gallery.

## Tasks

1. keyboard input
2. WASD movement
3. ghost translation at a fixed height above the floor
4. smooth ghost rotation toward movement
5. optional Shift speed boost

Pseudo state:

```text
no movement input → stationary ghost
WASD → moving ghost
Shift + movement → faster movement, if enabled
```

## Success Condition

One user can move the ghost through the gallery using keyboard input, with no character animations.

---

# STAGE 6 — Third-Person Camera

## Goal

Make the gallery feel like a small third-person game.

## Tasks

1. camera follow offset
2. mouse yaw
3. mouse pitch
4. camera orbit around player
5. smooth camera movement
6. movement relative to camera direction
7. ghost rotates toward movement

## Success Condition

The user can:

- rotate camera around ghost
- move based on camera direction
- explore gallery comfortably

---

# STAGE 7 — Basic Collision

## Goal

Prevent users from walking through walls.

## First Version

Use simple collision.

Do not build a full physics simulation.

Possible approaches:

- simple bounding boxes
- raycasting
- lightweight collision library if needed

## Success Condition

Player stays inside gallery and cannot walk directly through major walls.

---

# STAGE 8 — Website UI

## Goal

Create the basic non-3D application flow.

Pages / states:

```text
Landing
   ↓
Create Gallery
or
Join Gallery
```

Create flow:

```text
enter display name
      ↓
select artwork
      ↓
create gallery
```

Join flow:

```text
enter room code
      ↓
enter display name
      ↓
join
```

Do not polish heavily yet.

---

# STAGE 9 — Local Image Selection and Preview

## Goal

Let users choose their own images and preview them in the gallery using the existing artwork renderer.

## Intended Flow

```text
choose JPEG/PNG files from device
       ↓
validate file types, file sizes, and selection count
       ↓
create local image URLs
       ↓
show thumbnails
       ↓
select up to number of ArtSlots
       ↓
preview the selected images in the gallery
```

## Important Development Rule

Before implementing this stage, the hardcoded artwork system must already work.

File selection should only replace:

```text
where image URLs come from
```

It should **not** replace the artwork rendering system.

Architecture:

```text
Hardcoded Image URLs
        ↓
ArtworkManager
        ↓
Three.js planes

later becomes

Local Image URLs
        ↓
ArtworkManager
        ↓
Three.js planes
```

## Success Condition

Users can select portrait, landscape, and square images and see them fitted correctly at the configured anchors. Empty slots remain empty. Failed images show a helpful error. Replacing a selection cleans up unused textures, planes, and object URLs.

This milestone is a local preview. Actual shared uploads are required in Stage 14 before another device can see these images.

---

# STAGE 10 — Multiplayer Server

## Goal

Connect two browser tabs.

Start with cubes.

Prove movement synchronization with cubes before connecting the ghost avatars.

## Server

Create Node + Socket.IO server.

## First Multiplayer Test

Browser A:

```text
cube A
```

Browser B:

```text
cube B
```

Each should see the other move.

## Synchronize

Initially:

```text
id
x
y
z
rotation
```

## Success Condition

Two browser windows show two independently moving objects.

---

# STAGE 11 — Multiplayer Ghosts

## Goal

Replace network cubes with the simple ghost avatars.

## Tasks

1. create remote player instances
2. reuse `createGhost` for local and remote players
3. sync position
4. sync rotation
5. interpolate remote movement
6. remove the ghost on disconnect

## Success Condition

Two people enter the room and see each other's ghosts moving smoothly. No character animation data is synchronized.

---

# STAGE 12 — Usernames and Colors

## Goal

Make users distinguishable.

Each player gets:

- display name
- name label
- server-assigned ghost body color

## Tasks

1. collect the user's display name in the create/join UI
2. assign a body color on the server using the palette from Section 8
3. send ID, username, and color with player spawn data and the existing player list
4. connect the username labels and per-player materials proven in Stage 4 to this server data
5. confirm every browser sees the same username and color for each player
6. remove labels with disconnected ghosts and release unused colors

Use the shared multiplayer test session for this stage. Scope color assignment to individual rooms when Stage 13 introduces room codes.

## Success Condition

Two browser windows show matching usernames and body colors for all players, including when a new player joins after others are already present.

Example:

```text
       Alex
        👻
```

Do not build full character customization.

---

# STAGE 13 — Room Codes

## Goal

Create actual gallery rooms.

Flow:

```text
Person A
Create Gallery
    ↓
server generates room code
    ↓
K7PJ3
```

Person B:

```text
Join Gallery
    ↓
K7PJ3
    ↓
same room
```

The server should separate players by room. Assign ghost colors from the colors available within that room, and include each player's username and color in the room's initial player list.

---

# STAGE 14 — Gallery Artwork Shared Across Room

## Goal

Everyone joining the same room sees the same selected artwork.

## Shared Upload Tasks

1. add an upload endpoint or storage integration that returns image URLs accessible to all room members
2. validate supported image types, size limits, and room slot count on the server as well as in the UI
3. upload the creator's selected files and handle upload failures before publishing the room artwork list
4. store the returned URLs in a stable slot order; never send local `blob:` URLs as shared artwork
5. load that list through the same artwork renderer and manual slot configuration on every client
6. verify a second device and a late joiner both see the same artwork

Choose a storage approach compatible with the demo deployment and define when temporary uploads expire. Accounts and a large database are not required for this feature.

Room data can include:

```js
{
  roomId: "K7PJ3",
  owner: "Vann",
  artworks: [
    "...",
    "...",
    "..."
  ]
}
```

When someone joins:

```text
server sends gallery artwork list
       ↓
their browser places images into ArtSlots
```

The server does not send the actual 3D environment.

---

# STAGE 15 — Proximity Voice Chat

Only begin once multiplayer is stable.

## Stack

```text
WebRTC
Socket.IO signaling
Web Audio API
Three.js positions
```

## First Voice Milestone

Two users can hear each other.

No proximity yet.

## Second Milestone

Volume changes based on distance.

## Third Milestone

Directional audio.

## Stretch

Walls muffle voice.

---

# STAGE 16 — Polish

Only after the core loop works.

Possible polish:

- improved lighting
- smoother ghost movement and camera controls
- props
- loading screen
- smoother networking
- artwork interaction
- enlarge artwork on click
- microphone indicator
- room owner controls
- gallery intro
- sound effects

---

# 18. Team Development Strategy

The team has 4 people.

Do not have all 4 people edit the same file.

A possible responsibility split:

## Person A — Gallery / Blender / Scene Integration

- gallery GLB
- Blender anchors
- player spawn
- lights
- loading the gallery
- basic environment setup

## Person B — Player

- simple ghost geometry or static ghost GLB
- movement
- camera
- collision

## Person C — Artwork

- image selection
- artwork manager
- local image selection and upload integration
- image placement

## Person D — UI / Multiplayer

- landing/create/join UI
- Socket.IO server
- room creation
- room joining
- remote players

This is not a permanent ownership rule.

Team members should still understand the overall system.

---

# 19. Git Workflow

Keep Git simple.

Main branch:

```text
main
```

Feature branches:

```text
feature/gallery-loader
feature/player-controller
feature/artwork-system
feature/multiplayer
```

Workflow:

```bash
git checkout main
git pull
git checkout -b feature/example
```

Commit small working changes.

Push branch.

Open pull request.

Merge after another teammate checks the change.

Avoid everyone editing `main` directly.

---

# 20. Coding Agent Rules

This section is specifically for AI coding agents.

## RULE 1 — Do Not One-Shot the Application

Never generate the entire project at once.

Work on the current development stage only.

---

## RULE 2 — Explain Before Large Changes

Before implementing a major system, briefly explain:

- what files will change
- what the system does
- how it connects to existing systems

The team wants to learn.

---

## RULE 3 — Prefer Small, Testable Changes

Good task:

> Load `gallery.glb` and show it in the scene.

Bad task:

> Build gallery, multiplayer, ghost movement, uploads, and voice chat.

---

## RULE 4 — Stop at Milestones

After completing a stage, provide:

1. what was implemented
2. how to run it
3. how to test it
4. what the important code does
5. what the next recommended step is

Do not automatically continue into the next large feature unless requested.

---

## RULE 5 — Do Not Replace Working Architecture Without Reason

If Three.js is already being used, do not migrate to:

- Babylon.js
- React Three Fiber
- Unity WebGL
- another engine

unless the team explicitly requests the change.

---

## RULE 6 — Do Not Add Unnecessary Dependencies

Before installing a package, explain why it is needed.

Prefer native Three.js / browser APIs when reasonable.

---

## RULE 7 — Keep Code Understandable

Avoid unnecessary design patterns.

Avoid overengineering.

Prefer:

```js
loadGallery()
createPlayer()
updatePlayer()
placeArtwork()
```

over deeply abstracted enterprise architecture.

---

## RULE 8 — Preserve Blender Naming Contracts

Do not casually rename references such as:

```text
ArtSlot_01
PlayerSpawn
```

These names form a contract between Blender and Three.js.

---

## RULE 9 — Build With Temporary Objects When Dependencies Are Missing

If the ghost avatar is not ready:

```text
use a cube
```

If final artwork isn't ready:

```text
use test images
```

If multiplayer ghosts aren't ready:

```text
network cubes
```

Do not block one feature because another feature is unfinished.

---

## RULE 10 — Keep Features Replaceable

Example:

The artwork renderer should accept a list of image URLs.

Initially:

```text
hardcoded URLs
```

Later:

```text
Local preview URLs, then shared uploaded-image URLs
```

The rendering system should not care where the URLs came from.

---

# 21. Feature Dependencies

High-level dependency graph:

```text
Vite + Three.js
      ↓
Gallery loads
      ↓
Blender anchors work
      ↓
 ┌───────────────┐
 ↓               ↓
Artwork        Ghost
system         avatar
                 ↓
              movement
                 ↓
               camera
                 ↓
             collision
 └───────┬───────┘
         ↓
      UI flow
         ↓
 Local image selection
         ↓
   Multiplayer cubes
         ↓
Multiplayer ghosts
         ↓
      Room codes
         ↓
 Shared artwork state
         ↓
    Voice chat
         ↓
       Polish
```

---

# 22. What NOT to Build Early

Do not prioritize:

- accounts
- database-heavy architecture
- character customization
- multiple gallery buildings
- multiple floors
- chat
- likes
- reactions
- inventory
- procedural gallery generation
- dynamic frame geometry
- VR
- advanced physics
- wall-based voice occlusion
- sophisticated optimization before profiling
- Instagram integration

---

# 23. Minimum Successful Hackathon Demo

A successful demo is:

```text
Person A opens website
      ↓
enters name
      ↓
selects artwork
      ↓
creates gallery
      ↓
receives room code
      ↓
enters 3D gallery
      ↓
walks around
```

Then:

```text
Person B opens website
      ↓
enters room code
      ↓
joins same gallery
      ↓
both users see each other
      ↓
both users walk around
      ↓
both users see the same artwork
```

If this works reliably, the project has proven its core idea.

Voice chat is excellent if finished, but the project should not fail just because voice is unfinished.

---

# 24. First Hackathon Session Checklist

When everyone sits down:

## First 30–60 minutes

```text
[ ] everyone pulls repository
[ ] everyone can run frontend
[ ] current gallery.glb is added
[ ] Three.js scene exists
[ ] gallery appears in browser
```

Do not split into advanced features before this common baseline works.

## Then verify Blender anchors

```text
[ ] print ArtSlot names
[ ] print PlayerSpawn
[ ] spawn temporary cube at PlayerSpawn
[ ] place temporary plane at ArtSlot_01
```

At this point the team has proven that Blender and Three.js communicate correctly.

## Only then split work

Possible parallel work:

```text
Person A
gallery / lighting / Blender fixes

Person B
ghost avatar + movement

Person C
artwork placement + selection

Person D
UI / Socket.IO server skeleton
```

---

# 25. Mental Model for the Whole Project

Think of the system as four layers.

```text
1. BLENDER
visual world
models
anchors

        ↓

2. THREE.JS
renders world
controls player
camera
artwork

        ↓

3. SOCKET.IO SERVER
rooms
player state
multiplayer events

        ↓

4. WEB UI / APIs
names
room codes
image selection / uploads
microphone controls
```

And later:

```text
WEBRTC
↓
voice between players
```

---

# 26. Final Guiding Principle

At every stage, ask:

> What is the smallest version of this feature that proves the idea works?

Examples:

```text
Gallery:
show GLB

Artwork:
one image on one ArtSlot

Ghost avatar:
static ghost at PlayerSpawn

Movement:
WASD

Multiplayer:
two cubes

Rooms:
one generated code

Voice:
two people can hear each other
```

Once the small version works, improve it.

The project should grow through working layers rather than through one giant code-generation attempt.
