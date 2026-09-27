import * as THREE from 'three';
import { io } from 'socket.io-client';

const status = document.querySelector('#connection');
const container = document.querySelector('#test-viewport');
const socket = io('/movement-test', { autoConnect: false });
const players = new Map();
const keys = new Set();
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
let selfId;
let renderer;

function start() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8e7df');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 150);
  camera.position.set(0, 27, 27);
  camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Click to control your cube with WASD or arrow keys.');
  container.append(canvas);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777168, 3));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshStandardMaterial({ color: '#f7f5ef' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor, new THREE.GridHelper(32, 32, '#a7a0b2', '#d2ced8'));
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(geometry);
  const outlineMaterial = new THREE.LineBasicMaterial({ color: '#343541' });

  function updateList() {
    document.querySelector('#player-count').textContent = `${players.size} player(s) connected`;
    const list = document.querySelector('#players');
    list.replaceChildren();
    for (const [id, player] of players) {
      const item = document.createElement('li');
      item.textContent = `${id === selfId ? 'You' : 'Player'} · ${id.slice(-5)}`;
      item.style.borderLeft = `5px solid ${player.color}`;
      item.style.paddingLeft = '8px';
      list.append(item);
    }
  }
  function remove(id) {
    const player = players.get(id);
    if (!player) return;
    scene.remove(player.mesh);
    player.mesh.material.dispose();
    players.delete(id);
  }
  function clear() { for (const id of players.keys()) remove(id); updateList(); }
  function add(data) {
    remove(data.id);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: data.color }));
    mesh.position.set(data.x, data.y, data.z);
    mesh.rotation.y = data.rotationY;
    if (data.id === selfId) mesh.add(new THREE.LineSegments(edges, outlineMaterial));
    scene.add(mesh);
    players.set(data.id, { mesh, color: data.color, target: mesh.position.clone(), rotationY: data.rotationY });
  }
  socket.on('session:snapshot', data => {
    clear();
    selfId = data.selfId;
    data.players.forEach(add);
    keys.clear();
    status.textContent = 'Connected';
    document.querySelector('#identity').textContent = `Your connection: ${selfId.slice(-5)}`;
    updateList();
  });
  socket.on('player:joined', data => { add(data); updateList(); });
  socket.on('player:moved', data => {
    const player = players.get(data.id);
    if (!player || data.id === selfId) return;
    player.target.set(data.x, data.y, data.z);
    player.rotationY = data.rotationY;
  });
  socket.on('player:left', ({ id }) => { remove(id); updateList(); });
  socket.on('disconnect', () => {
    keys.clear();
    clear();
    selfId = null;
    document.querySelector('#identity').textContent = '';
    status.textContent = 'Disconnected — reconnecting…';
  });
  socket.on('connect_error', error => {
    status.textContent = `Cannot connect: ${error.message}. Check that the server is running on port 3002.`;
  });
  canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
  canvas.addEventListener('keydown', event => {
    if (event.code === 'Escape') { keys.clear(); canvas.blur(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || !movementKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  canvas.addEventListener('blur', () => keys.clear());
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => keys.clear());
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();
  const direction = new THREE.Vector3();
  let previousTime;
  let lastSend = 0;
  let dirty = false;
  renderer.setAnimationLoop(time => {
    const delta = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    const local = players.get(selfId);
    if (local && socket.connected && document.activeElement === canvas) {
      direction.set(Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')), 0,
        Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')));
      if (direction.lengthSq()) {
        direction.normalize();
        local.mesh.position.addScaledVector(direction, delta * 5);
        local.mesh.position.x = THREE.MathUtils.clamp(local.mesh.position.x, -15, 15);
        local.mesh.position.z = THREE.MathUtils.clamp(local.mesh.position.z, -15, 15);
        local.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        dirty = true;
      }
    }
    if (local && socket.connected && dirty && time - lastSend >= 50) {
      const { x, y, z } = local.mesh.position;
      socket.emit('player:move', { x, y, z, rotationY: local.mesh.rotation.y });
      lastSend = time;
      dirty = false;
    }
    for (const [id, player] of players) {
      if (id === selfId) continue;
      const amount = 1 - Math.exp(-15 * delta);
      player.mesh.position.lerp(player.target, amount);
      const angle = Math.atan2(Math.sin(player.rotationY - player.mesh.rotation.y), Math.cos(player.rotationY - player.mesh.rotation.y));
      player.mesh.rotation.y += angle * amount;
    }
    renderer.render(scene, camera);
  });
  socket.connect();
  window.addEventListener('pagehide', () => {
    socket.disconnect();
    keys.clear();
    renderer.setAnimationLoop(null);
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
}

try { start(); } catch (error) {
  status.textContent = `Could not start the 3D test: ${error.message}`;
  renderer?.dispose();
  socket.disconnect();
}
