import { createProximityVoice, proximityGain } from './proximityVoice.js';
import { createVoicePeers } from './voicePeers.js';
import { mountVoiceControls } from './voiceControls.js';

const synthetic = new URLSearchParams(location.search).get('source') === 'tone';
let toneContext, oscillator, pulse;
async function captureTone() {
  toneContext = new AudioContext();
  await toneContext.resume();
  const destination = toneContext.createMediaStreamDestination();
  const gain = toneContext.createGain();
  oscillator = toneContext.createOscillator();
  oscillator.frequency.value = 220;
  gain.gain.value = 0.035;
  oscillator.connect(gain).connect(destination);
  oscillator.start();
  let loud = false;
  pulse = setInterval(() => {
    loud = !loud;
    gain.gain.setTargetAtTime(loud ? 0.11 : 0.02, toneContext.currentTime, 0.1);
  }, 450);
  return destination.stream;
}

const voice = createProximityVoice(synthetic ? { captureMicrophone: captureTone } : {});
const hud = mountVoiceControls(document.querySelector('#voice-hud'), voice);
let listener, senderPeers, listenerPeers;
const button = document.querySelector('#connect');
const status = document.querySelector('#connection-status');
const distance = document.querySelector('#distance');
if (synthetic) {
  document.querySelector('#mode').textContent = 'Synthetic microphone mode — a generated tone replaces your mic. No microphone permission is requested.';
  document.querySelector('#mode-link').textContent = 'Switch to your real microphone →';
  document.querySelector('#mode-link').href = 'voice-preview.html';
  document.querySelector('#test-panel').hidden = false;
  document.querySelector('#mic-heading').textContent = 'Try the synthetic microphone';
  document.querySelector('#mic-instructions').textContent = 'Click the mic to start the generated tone. The level bar pulses; mute it to drop the level to zero.';
}
const receivedLevel = document.querySelector('#received-level');
const meterTimer = setInterval(() => {
  receivedLevel.textContent = `${Math.round((listener?.getPeerLevel('a-speaker') ?? 0) * 100)}%`;
}, 100);
const statsTimer = setInterval(async () => {
  const activePeers = listenerPeers;
  if (!activePeers) return;
  try {
    const stats = await activePeers.getStats('a-speaker');
    const sentStats = await senderPeers?.getStats('b-listener');
    if (activePeers !== listenerPeers) return;
    const audio = [...stats.values()].find(item => item.type === 'inbound-rtp' && item.kind === 'audio');
    const sent = [...(sentStats?.values() ?? [])].find(item => item.type === 'media-source' && item.kind === 'audio');
    document.querySelector('#connection-details').textContent =
      `Audio output: ${listener.getState().audioState}. Received: ${audio?.packetsReceived ?? 0} audio packets. Source energy: ${(sent?.totalAudioEnergy ?? 0).toFixed(4)}.`;
  } catch { /* Closing a test connection can cancel a pending stats request. */ }
}, 500);

function updateDistance() {
  const position = { x: Number(distance.value), y: 0, z: 0 };
  const origin = { x: 0, y: 0, z: 0 };
  listener?.setListener(origin);
  listenerPeers?.setPeerPosition('a-speaker', position);
  document.querySelector('#distance-value').value = distance.value;
  document.querySelector('#volume-readout').textContent = `Distance volume: ${Math.round(proximityGain(origin, position) * 100)}%`;
}
distance.addEventListener('input', updateDistance);

async function disconnect() {
  senderPeers?.dispose(); listenerPeers?.dispose();
  senderPeers = listenerPeers = null;
  await listener?.dispose(); listener = null;
  status.textContent = 'Test listener disconnected.';
  document.querySelector('#connection-details').textContent = 'Audio transport has not started.';
  button.textContent = 'Connect test listener';
}

button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    if (listener) { await disconnect(); return; }
    listener = createProximityVoice();
    await listener.resume(); // Explicit user gesture unlocks remote playback.
    status.textContent = 'Connecting test listener…';
    const onStatus = (_id, state, error) => { status.textContent = `WebRTC: ${state}${error ? ` — ${error}` : ''}`; };
    // This relay is only a local test. A real room server replaces these two callbacks.
    senderPeers = createVoicePeers({ localId: 'a-speaker', voice, onStatus,
      sendSignal: (_id, message) => { queueMicrotask(() => listenerPeers?.receiveSignal('a-speaker', message)); } });
    listenerPeers = createVoicePeers({ localId: 'b-listener', voice: listener, onStatus,
      sendSignal: (_id, message) => { queueMicrotask(() => senderPeers?.receiveSignal('b-listener', message)); } });
    listenerPeers.addPeer('a-speaker');
    senderPeers.addPeer('b-listener');
    updateDistance();
    button.textContent = 'Disconnect test listener';
  } catch (error) {
    await disconnect();
    status.textContent = `Test connection failed: ${error.message}`;
  } finally { button.disabled = false; }
});

window.addEventListener('pagehide', () => {
  hud.dispose();
  senderPeers?.dispose(); listenerPeers?.dispose();
  void listener?.dispose(); void voice.dispose();
  clearInterval(pulse);
  clearInterval(meterTimer);
  clearInterval(statsTimer);
  oscillator?.stop();
  void toneContext?.close();
}, { once: true });
// Back/forward cache must not restore controls whose audio resources were closed.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
