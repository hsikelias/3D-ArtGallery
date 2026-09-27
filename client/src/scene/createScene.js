import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e7e5df');
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1000);
  // Temporary inspection view for this export, not the future player camera.
  camera.position.set(0, 10, 24);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-label', '3D gallery inspection');
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 9, -15);
  controls.enableDamping = true;
  controls.update();
  controls.saveState();
  // A single toggle controls fill lighting and any temporary bulb lights.
  const inspectionLighting = new THREE.Group();
  inspectionLighting.name = 'Temporary inspection lighting';
  inspectionLighting.add(new THREE.HemisphereLight(0xffffff, 0x777168, 1.5));
  scene.add(inspectionLighting);
  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', resize);
  resize();
  let update = () => controls.update();
  let previousTime;
  renderer.setAnimationLoop((time) => {
    const delta = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    update(delta);
    renderer.render(scene, camera);
  });
  return { scene, camera, controls, inspectionLighting, canvas: renderer.domElement,
    setUpdate(callback) { update = callback; } };
}
