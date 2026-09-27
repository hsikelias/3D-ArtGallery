# Proximity voice (isolated prototype)

All files are new. Nothing is imported into the existing gallery, and no packages
or multiplayer-server files were changed. Start Vite with `cd client` then
`npm run dev`, and open `/voice-preview.html`.

- Click the mic to request microphone access and unmute. Click again to mute.
- The green vertical meter uses live microphone RMS levels; it is zero while muted.
- The microphone is never played back locally or recorded. Tracks start disabled.
- Open `/voice-preview.html?source=tone` for a synthetic mic with no hardware access.
  Unmute, click **Connect test listener**, and use the distance slider. This runs
  two real WebRTC peers locally, using a generated tone instead of microphone audio.
  The received-audio readout measures the actual remote output after distance fading.
- Received voices use directional Web Audio panning and a linear fade: full volume
  through 6 world units, fading to silence at 30. Both distances are configurable.
  Missing player positions are silent. Walls do not muffle voices yet.
  Remote streams also feed a muted media element to activate Chromium playback;
  only the spatial Web Audio graph is audible.

## Files

- `proximityVoice.js`: mic lifecycle, mute, level meter data, remote audio and distance.
- `voiceControls.js`: mic icon button and green bar, with styles isolated in a shadow root.
- `voicePeers.js`: audio-only WebRTC peers; receives room membership and signaling externally.
- `voicePreview.js` and `../../voice-preview.html`: independent manual test page.
- `../../test/proximityVoice.test.js`: unit tests, run with `node --test test/proximityVoice.test.js` from `client`.

## Multiplayer integration contract

The example below belongs in your teammate's room integration once multiplayer
is ready. It is documentation only; this branch does not add these calls to the app.

```js
import { createProximityVoice } from './voice/proximityVoice.js';
import { createVoicePeers } from './voice/voicePeers.js';
import { mountVoiceControls } from './voice/voiceControls.js';

const voice = createProximityVoice({ near: 6, far: 30 });
const hud = mountVoiceControls(hudContainer, voice);
const peers = createVoicePeers({
  localId: socket.id,
  voice,
  // Supply deployment STUN/TURN configuration here, including short-lived TURN credentials.
  rtcConfig: { iceServers: [] },
  sendSignal: (to, message) => socket.emit('voice:signal', { to, message }),
  onStatus: (id, state, error) => console.log('Voice peer', id, state, error),
});
const receive = ({ from, message }) => { void peers.receiveSignal(from, message); };
socket.on('voice:signal', receive);

// Call for each existing/new member AFTER the server confirms room membership.
peers.addPeer(remotePlayer.id);
// Each frame: positions must be WORLD positions, not a model child's local offset.
voice.setListener(localWorldPosition, cameraWorldForward);
peers.setPeerPosition(remotePlayer.id, remoteWorldPosition);
// To hear while keeping your own mic muted, resume from a user gesture (e.g. Join).
await voice.resume();

// On departure, remove this peer. On failed connection, remove/add on BOTH clients.
peers.removePeer(remotePlayer.id);
// On room leave or socket reconnect, discard old IDs/connections and recreate:
socket.off('voice:signal', receive);
peers.dispose();
hud.dispose();
await voice.dispose();
```

`voice:signal` is a proposed event name, not an existing server API. The server
must derive `from` from the authenticated socket, verify both players belong to
the same room, validate/limit message sizes, and forward `{ from, message }` only
to `to`. Only SDP `description` or ICE `candidate` messages are relayed. Do not
broadcast signals across rooms. Announce membership before delivering signals;
signals from unknown peers are intentionally ignored. IDs must be unique strings.
The lexicographically smaller ID creates the offer, preventing simultaneous offers.
Microphone changes use `replaceTrack` on the established audio sender.

The built-in preview relay is **same-page only**. Cross-device voice remains
unverified until the multiplayer relay and deployment STUN/TURN servers exist.
No public relay or credentials are hardcoded. An empty `iceServers` list is suitable
for the local loopback check, not reliable internet connectivity. This is a small-room
peer mesh, not an SFU for large groups. Distance is client playback volume, not a
privacy boundary: room peers still receive media, even when too far away to hear it.

The preview is served directly by Vite dev. The current production build only
includes the existing app entry; adding the feature to production requires the
later integration change. This branch deliberately leaves that configuration alone.

Browser references: [microphone permission and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia),
[audio track replacement](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack),
and [Web Audio distance models](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel).
