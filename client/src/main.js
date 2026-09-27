import { createScene } from './scene/createScene.js';
import { loadGallery } from './scene/loadGallery.js';
import { createPlayerController } from './player/createPlayerController.js';
import { Box3, Vector3 } from 'three';
import { createGhost } from './player/ghost_mesh.js';
import './style.css';

const status = document.querySelector('#setup-status');
async function start() {
  try {
    const { scene, camera, controls, canvas, setUpdate, inspectionLighting } = createScene(document.querySelector('#viewport'));
    let playerController;
    document.querySelector('#reset-view').addEventListener('click', () => playerController?.reset());
    document.querySelector('#inspection-light').addEventListener('change', (event) => {
      inspectionLighting.visible = event.target.checked;
    });
    const { artSlots, spawn, lights, size, warnings } = await loadGallery(scene, inspectionLighting);
    const placeholder = scene.getObjectByName('Player');
    if (!placeholder || !spawn) throw new Error('The gallery needs Player and PlayerSpawn for ghost placement.');
    // Use the authored reference character's feet as the requested spawn point.
    // Update only the loaded scene; preserve the Blender file and anchor name.
    const bounds = new Box3().setFromObject(placeholder);
    const spawnPosition = bounds.getCenter(new Vector3());
    spawnPosition.y = bounds.min.y;
    spawn.position.copy(spawn.parent.worldToLocal(spawnPosition.clone()));
    spawn.updateMatrixWorld(true);
    const ghost = createGhost({ username: 'Guest' });
    const ghostHeight = new Box3().setFromObject(ghost).getSize(new Vector3()).y;
    ghost.scale.setScalar(bounds.getSize(new Vector3()).y / ghostHeight);
    placeholder.removeFromParent();
    scene.add(ghost);
    playerController = createPlayerController({ scene, camera, controls, canvas,
      player: ghost, spawn });
    const restHeight = ghost.position.y;
    let elapsed = 0;
    setUpdate((delta) => {
      playerController.update(delta);
      elapsed += delta;
      // Bob only the visual child so the movement pivot and camera stay level.
      ghost.position.y = restHeight + 0.4 + Math.sin(elapsed * 1.8) * 0.18;
    });
    status.textContent = `Gallery loaded: ${artSlots.length} artwork anchors, ` +
      `PlayerSpawn ${spawn ? 'found' : 'missing'}, ${lights.length} imported lights.`;
    document.querySelector('#scene-details').textContent =
      `Size: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)} exported units (X/Y/Z). ` + warnings.join(' ');
  } catch (error) {
    console.error('Gallery setup failed:', error);
    status.textContent = 'Unable to show the gallery. Check WebGL support and public/models/gallery.glb. See the browser console for details.';
    status.classList.add('error');
  }
}
start();
