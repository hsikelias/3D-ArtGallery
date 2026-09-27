import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// PLAN.md sections 8 and 14: reusable geometry, independent materials and labels.
// Model coordinates: feet at y=0, eyes facing +Z. No movement or camera logic.
const profile = [];
for (let row = 0; row <= 12; row += 1) {
  const t = row / 12;
  profile.push(new THREE.Vector2(1.12 - 0.12 * t, 0.22 + 1.48 * t));
}
for (let row = 1; row <= 20; row += 1) {
  const angle = (row / 20) * Math.PI / 2;
  profile.push(new THREE.Vector2(Math.cos(angle), 1.7 + Math.sin(angle)));
}
const bodyGeometry = new THREE.LatheGeometry(profile, 96);
const positions = bodyGeometry.attributes.position;
for (let index = 0; index < positions.count; index += 1) {
  const y = positions.getY(index);
  const angle = Math.atan2(positions.getX(index), positions.getZ(index));
  // Eight soft scallops fade into a smooth cylindrical body below the dome.
  const skirtWeight = Math.max(0, 1 - (y - 0.22) / 0.9) ** 2;
  positions.setY(index, y + 0.22 * Math.cos(angle * 8) * skirtWeight);
}
bodyGeometry.computeVertexNormals();
bodyGeometry.computeBoundingBox();
bodyGeometry.computeBoundingSphere();
const eyeGeometry = new THREE.SphereGeometry(1, 24, 16);
const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
const pupilMaterial = new THREE.MeshBasicMaterial({ color: '#111111' });

export function randomPastelColor() {
  // Continuous hue/saturation/lightness range, converted to a six-digit hex.
  // Restricting saturation and lightness keeps every generated color pastel.
  const color = new THREE.Color().setHSL(
    Math.random(), 0.5 + Math.random() * 0.3, 0.75 + Math.random() * 0.1,
    THREE.SRGBColorSpace,
  );
  return `#${color.getHexString()}`;
}

export function createGhost({ id = 'preview', username = 'Guest', color = randomPastelColor() } = {}) {
  const ghost = new THREE.Group();
  ghost.name = `Ghost_${id}`;
  ghost.userData = { id, username, color };
  const body = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({
    color, transparent: true, opacity: 0.85, depthWrite: false,
    roughness: 0.65, metalness: 0,
  }));
  body.name = 'Ghost body';
  ghost.add(body);

  for (const x of [-0.36, 0.36]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(x, 1.85, 0.9);
    eye.scale.set(0.27, 0.36, 0.16);
    const pupil = new THREE.Mesh(eyeGeometry, pupilMaterial);
    pupil.position.set(x, 1.85, 1.045);
    pupil.scale.set(0.12, 0.2, 0.055);
    ghost.add(eye, pupil);
  }

  const label = document.createElement('div');
  label.className = 'ghost-name';
  label.textContent = username;
  label.style.color = color;
  const nameTag = new CSS2DObject(label);
  nameTag.position.set(0, 3.2, 0);
  ghost.add(nameTag);
  return ghost;
}
