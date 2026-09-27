export function proximityGain(listener, speaker, near = 6, far = 30) {
  if (![near, far].every(Number.isFinite) || !(near >= 0 && far > near)) throw new RangeError('Voice distance needs finite values with 0 <= near < far.');
  if (![listener, speaker].every(p => p && [p.x, p.y, p.z].every(Number.isFinite))) return 0;
  const distance = Math.hypot(listener.x - speaker.x, listener.y - speaker.y, listener.z - speaker.z);
  return Math.max(0, Math.min(1, (far - distance) / (far - near)));
}

function audioError(error) {
  if (error.name === 'NotAllowedError') return 'Microphone permission was denied. Allow it in your browser, then try again.';
  if (error.name === 'NotFoundError') return 'No microphone found. Connect a microphone, then try again.';
  if (error.name === 'NotReadableError') return 'Your microphone is unavailable or in use by another app.';
  return error.message || 'Unable to start voice. Please try again.';
}

// No socket, room, or Three.js dependency. Positions use gallery world units.
export function createProximityVoice({ near = 6, far = 30, captureMicrophone = () => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access needs HTTPS or localhost.');
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
} } = {}) {
  proximityGain(null, null, near, far); // Validate configuration up front.
  const subscribers = new Set();
  const remotes = new Map();
  let context, stream, source, analyser, silentOutput, samples, pending;
  let listenerPosition = null;
  let disposed = false;
  let wantedMuted = true;
  const state = { muted: true, starting: false, ready: false, error: '' };
  const notify = () => subscribers.forEach(fn => fn({ ...state }));

  async function resume() {
    if (disposed) throw new Error('Voice has been disposed.');
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context;
  }

  function releaseMicrophone() {
    stream?.getTracks().forEach(track => track.stop());
    source?.disconnect(); analyser?.disconnect(); silentOutput?.disconnect();
    stream = source = analyser = silentOutput = samples = null;
  }

  function applyMute() {
    state.muted = wantedMuted || !stream;
    stream?.getAudioTracks().forEach(track => { track.enabled = !state.muted; });
    notify();
  }

  async function setMuted(muted) {
    if (disposed) return;
    wantedMuted = Boolean(muted);
    if (wantedMuted) { applyMute(); return; }
    if (pending) return pending;
    if (stream) {
      try { await resume(); state.error = ''; applyMute(); }
      catch (error) { wantedMuted = true; state.error = audioError(error); applyMute(); }
      return;
    }
    state.starting = true;
    state.error = '';
    notify();
    pending = (async () => {
      try {
        await resume();
        const captured = await captureMicrophone();
        if (disposed) { captured.getTracks().forEach(track => track.stop()); return; }
        stream = captured;
        stream.getAudioTracks().forEach(track => { track.enabled = false; });
        if (!stream.getAudioTracks().some(track => track.readyState === 'live')) throw new Error('No live microphone audio track.');
        source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        samples = new Float32Array(analyser.fftSize);
        // Keep the meter processing without playing the local mic back to speakers.
        silentOutput = context.createGain();
        silentOutput.gain.value = 0;
        source.connect(analyser).connect(silentOutput).connect(context.destination);
        stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
          if (disposed) return;
          wantedMuted = true;
          releaseMicrophone();
          state.ready = false;
          state.error = 'Microphone disconnected. Reconnect it, then unmute to retry.';
          applyMute();
        }, { once: true }));
        state.ready = true;
        applyMute();
      } catch (error) {
        releaseMicrophone();
        wantedMuted = true;
        state.muted = true;
        state.ready = false;
        state.error = audioError(error);
      } finally {
        pending = null;
        state.starting = false;
        if (!disposed) notify();
      }
    })();
    return pending;
  }

  function readLevel(node, buffer) {
    node.getFloatTimeDomainData(buffer);
    const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length);
    return Math.max(0, Math.min(1, (rms - 0.008) * 8));
  }

  function getLevel() {
    return !analyser || state.muted || context.state !== 'running' ? 0 : readLevel(analyser, samples);
  }

  function getPeerLevel(id) {
    const remote = remotes.get(id);
    return !remote || context.state !== 'running' ? 0 : readLevel(remote.meter, remote.samples);
  }

  function updateRemote(remote) {
    const amount = proximityGain(listenerPosition, remote.position, near, far);
    remote.volume.gain.cancelScheduledValues(context.currentTime);
    if (amount === 0) remote.volume.gain.setValueAtTime(0, context.currentTime);
    else remote.volume.gain.setTargetAtTime(amount, context.currentTime, 0.04);
  }

  function setListener(position, forward = { x: 0, y: 0, z: -1 }) {
    listenerPosition = position && { x: position.x, y: position.y, z: position.z };
    if (!context) return;
    if ([position, forward].every(p => p && [p.x, p.y, p.z].every(Number.isFinite))) {
      context.listener.setPosition(position.x, position.y, position.z);
      context.listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
    remotes.forEach(updateRemote);
  }

  function setPeerPosition(id, position) {
    const remote = remotes.get(id);
    if (!remote) return;
    remote.position = position && { x: position.x, y: position.y, z: position.z };
    if (position && [position.x, position.y, position.z].every(Number.isFinite)) {
      remote.panner.setPosition(position.x, position.y, position.z);
    }
    updateRemote(remote);
  }

  function removeRemote(id) {
    const remote = remotes.get(id);
    if (!remote) return;
    remote.source.disconnect(); remote.panner.disconnect(); remote.volume.disconnect(); remote.meter.disconnect();
    remote.playback.pause();
    remote.playback.srcObject = null;
    remotes.delete(id);
  }

  function addRemoteStream(id, remoteStream) {
    if (disposed) return;
    // Connecting incoming media never requests microphone permission.
    context ??= new AudioContext();
    removeRemote(id);
    const remote = { source: context.createMediaStreamSource(remoteStream),
      panner: context.createPanner(), volume: context.createGain(), meter: context.createAnalyser(), position: null };
    // Chromium needs a media element consuming incoming WebRTC audio to keep
    // its receiver rendering. Keep it muted: only the spatial audio graph plays.
    remote.playback = new Audio();
    remote.playback.muted = true;
    remote.playback.srcObject = remoteStream;
    void remote.playback.play().catch(() => {
      if (!disposed && remotes.get(id) === remote) {
        state.error = 'Audio playback was blocked. Rejoin voice from a button click.';
        notify();
      }
    });
    remote.meter.fftSize = 512;
    remote.samples = new Float32Array(remote.meter.fftSize);
    remote.panner.panningModel = 'HRTF';
    remote.panner.rolloffFactor = 0; // Distance fade is controlled once, by our gain.
    remote.volume.gain.value = 0; // Unknown positions must never be audible.
    remote.source.connect(remote.panner).connect(remote.volume).connect(remote.meter).connect(context.destination);
    remotes.set(id, remote);
  }

  async function dispose() {
    disposed = true;
    wantedMuted = true;
    state.muted = true;
    state.ready = false;
    releaseMicrophone();
    [...remotes.keys()].forEach(removeRemote);
    notify(); subscribers.clear();
    if (context && context.state !== 'closed') await context.close();
  }

  return { setMuted, resume, getLevel, getPeerLevel, setListener, setPeerPosition, addRemoteStream, removeRemote, dispose,
    getState: () => ({ ...state, audioState: context?.state ?? 'not-started' }), getLocalStream: () => stream,
    subscribe(fn) { subscribers.add(fn); fn({ ...state }); return () => subscribers.delete(fn); } };
}
