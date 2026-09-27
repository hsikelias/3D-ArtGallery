import test from 'node:test';
import assert from 'node:assert/strict';
import { createProximityVoice, proximityGain } from '../src/voice/proximityVoice.js';
import { createVoicePeers } from '../src/voice/voicePeers.js';

class AudioNode {
  constructor() {
    this.gain = { value: 1, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; } };
    this.connections = [];
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; this.disconnected = true; }
  setPosition(...position) { this.position = position; }
  getFloatTimeDomainData(samples) { samples.fill(0.08); }
}
class AudioContextMock {
  constructor() {
    this.state = 'running'; this.currentTime = 0; this.nodes = [];
    this.destination = {}; this.listener = { setPosition() {}, setOrientation() {} };
    AudioContextMock.last = this;
  }
  createGain() { const node = new AudioNode(); this.nodes.push(node); return node; }
  createAnalyser() { return this.createGain(); }
  createPanner() { return this.createGain(); }
  createMediaStreamSource() { return this.createGain(); }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}
function installAudio(t) {
  const original = globalThis.AudioContext;
  const originalAudio = globalThis.Audio;
  globalThis.AudioContext = AudioContextMock;
  globalThis.Audio = class { async play() {} pause() {} };
  t.after(() => { globalThis.AudioContext = original; globalThis.Audio = originalAudio; });
}
function micStream() {
  const track = new EventTarget();
  Object.assign(track, { kind: 'audio', enabled: true, readyState: 'live', stop() { this.readyState = 'ended'; } });
  return { getAudioTracks: () => [track], getTracks: () => [track] };
}

test('proximity is full nearby, linear in 3D, and zero outside range or with missing coordinates', () => {
  const origin = { x: 0, y: 0, z: 0 };
  assert.equal(proximityGain(origin, origin), 1);
  assert.equal(proximityGain(origin, { x: 0, y: 6, z: 0 }), 1);
  assert.equal(proximityGain(origin, { x: 18, y: 0, z: 0 }), 0.5);
  assert.equal(proximityGain(origin, { x: 0, y: 0, z: -30 }), 0);
  assert.equal(proximityGain(origin, { x: 500, y: 0, z: 0 }), 0);
  assert.equal(proximityGain(origin, null), 0);
  assert.equal(proximityGain(origin, { x: NaN, y: 0, z: 0 }), 0);
  assert.throws(() => proximityGain(origin, origin, 30, 6), RangeError);
  assert.throws(() => proximityGain(origin, origin, 6, Infinity), RangeError);
});

test('mic is opt-in, mute disables the real track and meter, disposal releases devices', async t => {
  installAudio(t);
  let captures = 0;
  const stream = micStream();
  const voice = createProximityVoice({ captureMicrophone: async () => { captures++; return stream; } });
  assert.equal(captures, 0);
  assert.equal(voice.getState().muted, true);
  await voice.setMuted(false);
  assert.equal(captures, 1);
  assert.equal(stream.getAudioTracks()[0].enabled, true);
  assert.ok(voice.getLevel() > 0);
  // Local microphone graph is connected to the output only through a zero gain.
  assert.equal(AudioContextMock.last.nodes.at(-1).gain.value, 0);
  await voice.setMuted(true);
  assert.equal(stream.getAudioTracks()[0].enabled, false);
  assert.equal(voice.getLevel(), 0);
  await voice.setMuted(false);
  assert.equal(captures, 1);
  await voice.dispose();
  assert.equal(stream.getAudioTracks()[0].readyState, 'ended');
  assert.equal(AudioContextMock.last.state, 'closed');
});

test('permission denial stays muted and a later retry succeeds', async t => {
  installAudio(t);
  let denied = true;
  const voice = createProximityVoice({ captureMicrophone: async () => {
    if (denied) throw Object.assign(new Error(), { name: 'NotAllowedError' });
    return micStream();
  } });
  await voice.setMuted(false);
  assert.equal(voice.getState().muted, true);
  assert.match(voice.getState().error, /permission was denied/);
  denied = false;
  await voice.setMuted(false);
  assert.equal(voice.getState().muted, false);
  assert.equal(voice.getState().error, '');
  await voice.dispose();
});

test('mute while permission is pending prevents late unmute; repeated unmute captures once', async t => {
  installAudio(t);
  let resolveCapture, started;
  const captureStarted = new Promise(resolve => { started = resolve; });
  const captured = micStream();
  let count = 0;
  const voice = createProximityVoice({ captureMicrophone: () => {
    count++; started(); return new Promise(resolve => { resolveCapture = resolve; });
  } });
  const first = voice.setMuted(false);
  await captureStarted;
  const second = voice.setMuted(false);
  await voice.setMuted(true);
  resolveCapture(captured);
  await Promise.all([first, second]);
  assert.equal(count, 1);
  assert.equal(captured.getAudioTracks()[0].enabled, false);
  assert.equal(voice.getState().muted, true);
  await voice.dispose();
});

test('leaving while permission is pending stops a late microphone stream', async t => {
  installAudio(t);
  let finish, started;
  const captureStarted = new Promise(resolve => { started = resolve; });
  const voice = createProximityVoice({ captureMicrophone: () => {
    started(); return new Promise(resolve => { finish = resolve; });
  } });
  const pending = voice.setMuted(false);
  await captureStarted;
  await voice.dispose();
  const captured = micStream(); finish(captured); await pending;
  assert.equal(captured.getAudioTracks()[0].readyState, 'ended');
  assert.equal(voice.getLocalStream(), null);
});

test('device removal clears microphone and lets the user retry', async t => {
  installAudio(t);
  const stream = micStream();
  const voice = createProximityVoice({ captureMicrophone: async () => stream });
  await voice.setMuted(false);
  stream.getAudioTracks()[0].dispatchEvent(new Event('ended'));
  assert.equal(voice.getState().muted, true);
  assert.equal(voice.getState().ready, false);
  assert.match(voice.getState().error, /disconnected/);
  await voice.dispose();
});

test('remote voices require valid positions and are disconnected on departure', async t => {
  installAudio(t);
  const voice = createProximityVoice();
  voice.addRemoteStream('peer', micStream());
  const context = AudioContextMock.last;
  const volume = context.nodes.at(-2);
  assert.equal(volume.gain.value, 0);
  voice.setListener({ x: 0, y: 0, z: 0 });
  voice.setPeerPosition('peer', { x: 18, y: 0, z: 0 });
  assert.equal(volume.gain.value, 0.5);
  voice.setPeerPosition('peer', { x: 31, y: 0, z: 0 });
  assert.equal(volume.gain.value, 0);
  voice.setPeerPosition('peer', null);
  assert.equal(volume.gain.value, 0);
  voice.removeRemote('peer');
  assert.ok(context.nodes.every(node => node.disconnected));
  await voice.dispose();
});

test('WebRTC buffers early ICE, ignores outsiders, answers only the designated offerer, and cleans up', async t => {
  const original = globalThis.RTCPeerConnection;
  let pc;
  globalThis.RTCPeerConnection = class {
    constructor() { pc = this; this.candidates = []; this.signalingState = 'stable'; this.sender = { replaceTrack: async track => { this.track = track; } }; }
    async setRemoteDescription(description) { this.remoteDescription = description; }
    getTransceivers() { return [{ receiver: { track: { kind: 'audio' } }, sender: this.sender }]; }
    async createAnswer() { return { type: 'answer', sdp: 'test' }; }
    async setLocalDescription(description) { this.localDescription = { toJSON: () => description }; }
    async addIceCandidate(candidate) { this.candidates.push(candidate); }
    close() { this.closed = true; }
  };
  t.after(() => { globalThis.RTCPeerConnection = original; });
  let removed, unsubscribed = false;
  const sent = [];
  const voice = { subscribe(fn) { fn(); return () => { unsubscribed = true; }; }, getLocalStream: () => null,
    removeRemote(id) { removed = id; } };
  const peers = createVoicePeers({ localId: 'b', voice, sendSignal: (to, message) => { sent.push({ to, message }); } });
  await peers.receiveSignal('outsider', { description: { type: 'offer' } });
  assert.equal(pc, undefined);
  peers.addPeer('a');
  await peers.receiveSignal('a', { candidate: { candidate: 'early' } });
  assert.equal(pc.candidates.length, 0);
  await peers.receiveSignal('a', { description: { type: 'offer', sdp: 'test' } });
  assert.equal(pc.candidates.length, 1);
  assert.equal(sent[0].message.description.type, 'answer');
  peers.dispose();
  assert.equal(pc.closed, true);
  assert.equal(removed, 'a');
  assert.equal(unsubscribed, true);
});
