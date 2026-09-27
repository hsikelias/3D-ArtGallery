import { createScene } from './scene/createScene.js';
import { loadGallery } from './scene/loadGallery.js';
import { createPlayerController } from './player/createPlayerController.js';
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
    playerController = createPlayerController({ scene, camera, controls, canvas,
      player: scene.getObjectByName('Player'), spawn });
    setUpdate(playerController.update);
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
