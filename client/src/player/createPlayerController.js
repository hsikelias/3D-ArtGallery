import { Box3, Group, MathUtils, Quaternion, Vector3 } from 'three';
import { canOccupy, moveWithinExterior } from './exteriorCollision.js';

// PLAN.md sections 9–10. Based on origin/feature/player-movement (debba03).
// Local movement only; the ghost model remains independent of this controller.
// Movement/camera distances use its exported height, rather than assuming meters.
export function createPlayerController({ scene, camera, controls, canvas, player, spawn }) {
  if (!player || !spawn) throw new Error('Player movement needs Player and PlayerSpawn in the gallery.');

  const bounds = new Box3().setFromObject(player);
  const height = bounds.getSize(new Vector3()).y;
  const size = bounds.getSize(new Vector3());
  // The circular footprint covers the skirt/eyes through every facing angle.
  const radius = Math.max(size.x, size.z) / 2 + 0.08;
  const center = bounds.getCenter(new Vector3());
  const spawnPosition = spawn.getWorldPosition(new Vector3());
  if (!canOccupy(spawnPosition.x, spawnPosition.z, radius)) {
    throw new Error('PlayerSpawn does not fit inside the gallery exterior.');
  }
  const up = new Vector3(0, 1, 0);
  const forward = new Vector3();
  const right = new Vector3();
  const direction = new Vector3();
  const displacement = new Vector3();
  const target = new Vector3();
  const followOffset = new Vector3();
  const facing = new Quaternion();
  const keys = new Set();
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

  // Put the pivot at the character's feet, preserving the mesh's world scale.
  // Only the runtime instance changes; gallery.glb is never edited.
  scene.attach(player);
  player.position.sub(new Vector3(center.x, bounds.min.y, center.z));
  const character = new Group();
  character.name = 'LocalPlayer';
  character.add(player);
  scene.add(character);

  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = height * 1.3;
  controls.maxDistance = height * 3;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.48;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Gallery character controls. Click, then use WASD to move. Drag to look around.');

  function clearKeys() { keys.clear(); }
  function focusCanvas() { canvas.focus({ preventScroll: true }); }
  function onKeyDown(event) {
    if (event.code === 'Escape') {
      clearKeys();
      canvas.blur();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || !movementKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  }
  function onKeyUp(event) { keys.delete(event.code); }

  canvas.addEventListener('pointerdown', focusCanvas);
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('blur', clearKeys);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', clearKeys);

  function reset() {
    clearKeys();
    // Consume any pending drag/zoom before placing the camera at its start.
    controls.enableDamping = false;
    controls.update();
    character.position.copy(spawnPosition);
    character.quaternion.identity();
    controls.target.copy(spawnPosition).addScaledVector(up, height * 0.7);
    camera.position.copy(controls.target).add(new Vector3(0, height * 0.65, height * 2.1));
    controls.update();
    controls.enableDamping = true;
    controls.saveState();
  }

  function update(deltaSeconds) {
    const dt = MathUtils.clamp(deltaSeconds, 0, 0.05);
    const modalOpen = Boolean(document.querySelector('dialog[open], [aria-modal="true"]'));
    controls.enabled = !modalOpen;
    if (document.activeElement !== canvas || modalOpen) clearKeys();

    // Yaw only: looking up/down never changes the character's floor height.
    const yaw = controls.getAzimuthalAngle();
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    direction.copy(forward).multiplyScalar(Number(keys.has('KeyW')) - Number(keys.has('KeyS')));
    direction.addScaledVector(right, Number(keys.has('KeyD')) - Number(keys.has('KeyA')));
    if (direction.lengthSq() > 0) {
      direction.normalize(); // Diagonals travel at the same speed as straight movement.
      displacement.copy(direction).multiplyScalar(height * 2 * dt);
      moveWithinExterior(character.position, displacement, radius);
      // ghost_mesh faces +Z in model space.
      facing.setFromAxisAngle(up, Math.atan2(direction.x, direction.z));
      character.quaternion.slerp(facing, 1 - Math.exp(-12 * dt));
    }

    // Smooth the camera target and translate its orbit by the same amount.
    // Camera orbit is independent of character facing while standing still.
    target.copy(character.position).addScaledVector(up, height * 0.7);
    followOffset.subVectors(target, controls.target).multiplyScalar(1 - Math.exp(-10 * dt));
    controls.target.add(followOffset);
    camera.position.add(followOffset);
    if (controls.enabled) controls.update(dt);
  }

  function dispose() {
    clearKeys();
    canvas.removeEventListener('pointerdown', focusCanvas);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('blur', clearKeys);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', clearKeys);
    document.removeEventListener('visibilitychange', clearKeys);
  }

  reset();
  return {
    update, reset, dispose,
    getState() {
      return { x: character.position.x, y: character.position.y, z: character.position.z,
        rotationY: Math.atan2(Math.sin(character.rotation.y), Math.cos(character.rotation.y)) };
    },
    setSpawn(position) {
      spawnPosition.set(position.x, position.y, position.z);
      reset();
    },
  };
}
