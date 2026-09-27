# HackNite: 3D Art Gallery

A multiplayer art gallery in the browser. Artists upload their work, create a room, and share its code. Visitors join the same exhibition as pastel ghost avatars, explore the space, and see one another moving through the gallery.

The project combines a Blender environment with Three.js rendering and a Node.js multiplayer server. Artwork comes from the artist's uploads; visitors do not need to download or configure any files.

## The experience

1. The artist chooses images, enters a display name, and creates a gallery.
2. The server stores the images for the session and generates a six-digit room code.
3. Visitors open the same website and join using that code and their own names.
4. Everyone sees the same artwork and the other players' ghosts, names, colors, and movement.

Click the gallery to focus the controls. Use **WASD** to move, **drag** to orbit the camera, **scroll** to zoom, and **Escape** to release keyboard focus. The gallery menu provides room actions, and the reset button returns the player and camera to their spawn.

## Technology

| Technology | Role |
| --- | --- |
| Blender / GLB | Gallery architecture, light fixtures, artwork anchors, and player references |
| Three.js | Scene rendering, artwork textures, ghost geometry, camera, and spatial calculations |
| JavaScript, HTML, CSS | Application logic, forms, upload previews, menus, and name labels |
| Vite | Frontend development server and production build |
| Node.js / Socket.IO | Room membership, shared identities, movement events, and image uploads |
| IndexedDB | Saves the artist's unfinished draft locally |

The frontend uses plain JavaScript. The 3D scene and the normal page interface are separate systems connected by the gallery runtime.

## Project structure

```text
client/
  index.html                 Gallery viewport and create/join interface
  public/models/             Blender gallery asset
  src/
    galleryEntry.js          Forms, upload previews, and room transitions
    galleryRuntime.js        Connects the scene, artwork, and players
    scene/                   Scene setup, GLB loading, and lighting
    artwork/                 Image placement, sizing, and frame geometry
    player/                  Ghost model, movement, camera follow, and collision
    multiplayer/             Server connection and incoming player updates
    rooms/                   Local draft storage and image validation
  test/                      Frontend behavior, artwork, and movement tests
  vite.config.js             Build settings and local backend proxies
server/
  server.js                  Starts the HTTP and Socket.IO server
  app.js                     HTTP routes and multiplayer server setup
  galleryRooms.js            Rooms, usernames, colors, images, and player state
  staticClient.js            Serves the built website
  test/                      Network integration and server tests
PLAN.md                      Development roadmap and implementation conventions
MULTIPLAYER.md               Deployment, room lifecycle, and demo instructions
```

The main page starts through `galleryEntry.js`. `src/main.js` is an older standalone inspection entry. The separate `multiplayer-test.html` page uses cubes to diagnose networking independently of the full gallery.

## How it is implemented

### 1. Load the gallery

`createScene.js` creates the Three.js scene, perspective camera, WebGL renderer, resize handling, and render loop. `loadGallery.js` loads the Blender GLB with `GLTFLoader` and discovers its named artwork and spawn anchors.

Blender supplies the environment's shape and reference locations; JavaScript supplies application behavior. `configureGalleryPreview.js` handles missing materials, floor color, and supporting lights without modifying the exported model.

### 2. Turn uploaded images into an exhibition

The entry interface validates the artist's files and creates local thumbnail previews. When the artist creates a room, the browser sends the image bytes to the server. The server returns shared HTTP URLs that every visitor can load. IndexedDB keeps only the local draft for the active create/join flow; it is not the source of online room membership.

`artworkManager.js` accepts the room's image URLs. `imagePlacement.js` fits each image inside its display area without stretching or cropping and places it in front of a simple brown backing. Blender artwork anchors determine the locations; `slotConfig.js` supplies wall-facing rotations, size limits, and offsets.

The same renderer handles every visitor's exhibition. Replacing artwork releases the previous textures and geometry, and failed images are reported individually.

### 3. Build and control the ghost

`ghost_mesh.js` creates a reusable Pac-Man-inspired ghost from Three.js geometry: a rounded head, cylindrical body, scalloped skirt, and eyes. Each ghost has its own body material at 85% opacity and a matching name label with a black outline. `CSS2DRenderer` positions the HTML labels above the ghosts.

The model contains no movement or camera code. `createPlayerController.js` handles keyboard input, movement relative to the camera, smooth turning, and a third-person follow camera. The local player moves at a fixed floor height; gentle bobbing affects only the visual model, keeping the movement position and camera steady.

The Blender player reference establishes the avatar scale and initial floor level. Online rooms then assign individual spawn positions and pastel colors on the server so arrivals are separated and everyone sees consistent identities.

### 4. Keep the player inside the building

`exteriorCollision.js` describes the gallery's outer wall outline independently of its combined Blender mesh. Movement accounts for the ghost's radius and resolves short steps along each horizontal axis, allowing the player to slide along walls.

Exterior walls block movement; interior partitions remain passable. The outline must be updated if the building's exterior changes. Camera collision is not implemented.

### 5. Synchronize the room

`galleryConnection.js` connects the browser to the Socket.IO gallery namespace. Creating or joining a room returns the local player's identity, the current player list, and shared artwork URLs.

The server assigns player IDs and colors and reserves usernames within each room. Guests cannot use the artist's name, including capitalization, whitespace, or Unicode compatibility variants. The artist's name stays reserved for the room's lifetime.

The local controller sends changed positions and headings at up to 20 updates per second. The server validates movement packets and broadcasts them only to other members of that room. `galleryRuntime.js` creates remote ghosts and interpolates their movement between updates. Departures remove the associated ghost and label; brief network interruptions can resume the existing session.

Each browser renders its own copy of the gallery. The server shares room data and player updates rather than repeatedly transmitting the 3D environment.

### 6. Serve the application

During development, Vite serves the frontend and proxies `/socket.io` and `/api` to the Node server. In production, the Node server can serve the compiled frontend, uploaded artwork, and multiplayer connection from one public URL.

A separately hosted frontend is also supported through the configuration described in [MULTIPLAYER.md](MULTIPLAYER.md).

## Run locally

Use Node.js 24 and npm. From the repository root, install both sets of dependencies:

```bash
npm ci --prefix client
npm ci --prefix server
```

Start the backend in one terminal:

```bash
npm run dev --prefix server
```

Start the frontend in another:

```bash
npm run dev --prefix client
```

Open the URL printed by Vite. Both processes are required for online rooms.

To build and run the complete application through one server instead:

```bash
npm run build --prefix client
npm start --prefix server
```

Open `http://localhost:3002`, unless you configured a different server port.

## Verification

Run these commands from the repository root:

```bash
npm run build --prefix client
node --test client/test/*.test.js
npm test --prefix server
```

The tests cover artwork fitting and cleanup, exterior collision, player headings, the create/join interface, shared image delivery, room isolation, username protection, and reconnect behavior. Build first because the server's production smoke test checks the compiled website.

For a practical check, create a room in one browser and join from a separate browser or device. Confirm that both see the same artwork and each other's movement.

## Current scope

Rooms support up to 24 players and 15 uploaded JPEG, PNG, or WebP images, with a 2 MiB limit per image. Rooms and uploads currently live in server memory and are lost when the server restarts. Host credentials stay in tab memory, so the artist should keep their tab open for the session.

Controls currently target keyboard and mouse. Persistent galleries, proximity voice chat, and camera collision remain future work. See [PLAN.md](PLAN.md) for the roadmap and [MULTIPLAYER.md](MULTIPLAYER.md) for hosting details, session limits, and presentation setup.

## Team

- Lekish Sai Podili
- Brando Vasquez
- Subanee Acharya
- Mateus Landowski
