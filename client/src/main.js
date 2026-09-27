import { REVISION } from 'three';
import './style.css';

// A small import check for Stage 0. The actual 3D scene begins in Stage 1.
document.querySelector('#setup-status').textContent =
  `JavaScript is running. Three.js revision ${REVISION} is loaded.`;
