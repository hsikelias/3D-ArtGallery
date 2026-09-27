# Multiplayer setup and demo guide

## What was wrong

The main page loads `galleryEntry.js`, not the legacy `main.js` inspection entry.
Its Create/Join handlers called IndexedDB `localRooms` methods even though the
Socket.IO server, gallery connection, and remote ghost rendering already existed.
Two tabs on the same origin could therefore reopen the same locally stored
images without ever sharing a network room or player list.

The entry page now uses `createGalleryConnection` for server create/join requests.
Local storage only saves the artist's unfinished draft. The server chooses room
codes and player identities, receives image bytes, serves shared artwork URLs,
and broadcasts movement only to members of the same room. The existing artwork
renderer and ghost model remain in use (PLAN.md Stages 11–14).

## Run for development

From the repository root, install the existing dependencies:

```powershell
npm install --prefix client
npm install --prefix server
```

In one terminal run `npm run dev --prefix server`. In another, run
`npm run dev --prefix client`. Restart an older Vite process so its `/socket.io`
and `/api` proxies take effect. Open Vite's displayed URL, usually
`http://localhost:5173`. Opening HTML directly or using Live Server will not work.

## Run the complete built application

From the repository root:

```powershell
npm run build --prefix client
npm start --prefix server
```

Open `http://localhost:3002`. This single Node server serves the website,
models, uploaded images, and Socket.IO together. `PORT` overrides 3002;
`HOST` overrides the default `0.0.0.0` listening address.

For another laptop on the same network, use the server computer's LAN address
and port, and allow the app through its firewall if prompted. `localhost` always
refers to the visitor's own computer. Internet visitors need a public deployment.

## Hosting the presentation

The simplest deployment is a **single Node web service** that serves the entire
app. For example, on Render use these settings, with the repository root as the
service root (not `client` or `server`):

- Build command: `npm ci --prefix client && npm run build --prefix client && npm ci --prefix server --omit=dev`
- Start command: `npm start --prefix server`
- Health check: `/api/health`
- Node version: a Vite-compatible version such as Node 24.
- One running instance. Room state is currently in that process's memory.

Use the service's public HTTPS URL for the artist and all guests. Use a service
that stays running during the presentation. Room data is lost on restart or
redeploy; create the demo room after the deployment is ready. Render documents
[WebSocket support](https://render.com/docs/websocket) and
[web service configuration](https://render.com/docs/web-services).

### Vercel frontend with a separate Node backend

This is also supported:

1. Deploy `server` as a single Node web service. Build: `npm ci`; start: `npm start`.
2. Set its `CLIENT_ORIGIN` environment variable to the exact frontend HTTPS origin,
   for example `https://your-gallery.vercel.app` (no trailing slash).
3. In Vercel, choose `client` as the root directory, the Vite preset,
   `npm run build` as the build command, and `dist` as the output directory.
4. Set Vercel's `VITE_GALLERY_SERVER` to the backend HTTPS origin before building,
   for example `https://your-gallery-server.onrender.com`.
5. Redeploy after changing these values. Test with two different browsers/devices.

The frontend connects directly to that backend and resolves artwork URLs against
it. Both hosts must use HTTPS. Local development needs neither environment
variable because Vite proxies requests on the same origin.

Vercel now documents WebSocket support in beta, but its Functions can run on
different instances and disconnect at their duration limit. Running this
in-memory backend entirely on Vercel would require external shared room state,
pub/sub, and image storage; it is not supported by the current implementation.
See [Vercel's WebSocket state guidance](https://vercel.com/docs/functions/websockets#manage-persistent-state).

## Presentation rehearsal

1. Artist: create a gallery with an image and a name, then use **Show room code**.
2. Visitor: open the same website in a private browser or on a different computer.
   Join with that code and a different name. Both should see two named ghosts.
3. Try the artist's name, including different capitalization or surrounding spaces:
   the server must reject it. Existing guest names are also reserved in that room.
4. Walk each ghost with WASD. The other browser should show the movement. Join a
   third visitor after moving; it should receive everyone's current position.
5. Confirm the uploaded artwork appears on a device with no artist draft saved.
6. Close a visitor tab: its ghost should disappear. Briefly interrupt a connection:
   it should resume with the same identity within 60 seconds, while the tab stays open.
7. Create a second gallery: its visitors and artwork must remain separate.

Only the host sees the code control. Identity and colors come from the server;
clients cannot choose another player's ID by changing a movement packet.

## Current limits

- 24 players per gallery, including temporarily disconnected reserved sessions;
  up to 20 galleries per server. Request throttling prevents accidental rapid retries.
- 1–15 JPEG/PNG/WebP files, at most 2 MiB each. Image bytes are uploaded to server
  memory and available over HTTP; this is temporary demo storage, not a saved portfolio.
- Empty rooms expire after roughly 30 minutes. Disconnect reservations expire after
  60 seconds. The artist's name remains reserved for the room's lifetime.
- Session credentials remain in tab memory. A full refresh or closing the tab loses
  that identity; the artist should keep their tab open for the presentation. After
  losing the host tab, create a new room to regain host controls.
- Keyboard/mouse controls currently target desktop visitors; touch controls and
  voice chat are separate milestones. Camera collision is still unimplemented.

## Verification

From the repository root:

```powershell
npm run build --prefix client
node --test client/test/*.test.js
npm test --prefix server
```

Server tests use real WebSocket and HTTP polling clients for gallery membership,
late joins, shared image bytes, movement, name protection, room isolation, reconnects,
and invalid input. The production smoke test uses the built `client/dist`, so build
before running it. Frontend tests cover the real form handlers, artwork, and collision.
