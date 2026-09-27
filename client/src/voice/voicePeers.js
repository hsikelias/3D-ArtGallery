// The multiplayer server supplies authenticated room membership and relays
// sendSignal(to, message). No Socket.IO event names are imposed on teammates.
export function createVoicePeers({ localId, voice, sendSignal, rtcConfig = {}, onStatus = () => {} }) {
  if (typeof localId !== 'string' || !localId) throw new Error('Voice needs a stable player ID.');
  const peers = new Map();
  let disposed = false;
  const reportError = (id, error) => onStatus(id, 'error', error.message);

  function enqueue(peer, task) {
    peer.queue = peer.queue.then(() => peers.get(peer.id) === peer && !disposed ? task() : undefined)
      .catch(error => { if (peers.get(peer.id) === peer && !disposed) reportError(peer.id, error); });
    return peer.queue;
  }

  function currentTrack() { return voice.getLocalStream()?.getAudioTracks()[0] ?? null; }
  const unsubscribe = voice.subscribe(() => {
    for (const peer of peers.values()) {
      enqueue(peer, async () => { if (peer.sender) await peer.sender.replaceTrack(currentTrack()); });
    }
  });

  function addPeer(id) {
    if (disposed || typeof id !== 'string' || !id || id === localId || peers.has(id)) return;
    const pc = new RTCPeerConnection(rtcConfig);
    const peer = { id, pc, sender: null, queue: Promise.resolve(), candidates: [], position: null };
    peers.set(id, peer);
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && peers.get(id) === peer) {
        Promise.resolve().then(() => sendSignal(id, { candidate: candidate.toJSON() })).catch(error => reportError(id, error));
      }
    };
    pc.onconnectionstatechange = () => onStatus(id, pc.connectionState);
    pc.ontrack = ({ track }) => {
      if (track.kind !== 'audio' || peers.get(id) !== peer) return;
      voice.addRemoteStream(id, new MediaStream([track]));
      voice.setPeerPosition(id, peer.position);
      track.onended = () => { if (peers.get(id) === peer) voice.removeRemote(id); };
    };
    // Exactly one offerer per pair. One audio transceiver is negotiated once;
    // mic mute/unmute and device replacement never require competing offers.
    if (localId < id) {
      enqueue(peer, async () => {
        peer.sender = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
        await peer.sender.replaceTrack(currentTrack());
        await pc.setLocalDescription(await pc.createOffer());
        await sendSignal(id, { description: pc.localDescription.toJSON() });
      });
    }
  }

  function receiveSignal(id, message) {
    const peer = peers.get(id);
    if (!peer || disposed || !message) return Promise.resolve();
    return enqueue(peer, async () => {
      const { pc } = peer;
      if (message.description) {
        const { type } = message.description;
        if (type !== 'offer' && type !== 'answer') return;
        if (type === 'offer' && !(id < localId)) return;
        if (type === 'answer' && pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(message.description);
        if (type === 'offer') {
          const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'audio');
          if (!transceiver) throw new Error('Voice offer contains no audio.');
          transceiver.direction = 'sendrecv';
          peer.sender = transceiver.sender;
          await peer.sender.replaceTrack(currentTrack());
          await pc.setLocalDescription(await pc.createAnswer());
          await sendSignal(id, { description: pc.localDescription.toJSON() });
        }
        for (const candidate of peer.candidates.splice(0)) await pc.addIceCandidate(candidate);
      } else if (message.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(message.candidate);
        else if (peer.candidates.length < 128) peer.candidates.push(message.candidate);
      }
    });
  }

  function removePeer(id) {
    const peer = peers.get(id);
    if (!peer) return;
    peers.delete(id);
    peer.pc.onicecandidate = peer.pc.ontrack = peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    voice.removeRemote(id);
  }

  return { addPeer, removePeer, receiveSignal,
    getStats(id) { return peers.get(id)?.pc.getStats() ?? Promise.resolve(new Map()); },
    setPeerPosition(id, position) {
      const peer = peers.get(id);
      if (!peer) return;
      peer.position = position;
      voice.setPeerPosition(id, position);
    },
    dispose() { disposed = true; unsubscribe(); [...peers.keys()].forEach(removePeer); } };
}
