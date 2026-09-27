import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { canOccupy, exteriorOutline, moveWithinExterior } from '../src/player/exteriorCollision.js';

const radius = 2;
test('spawn fits; entrance wings stay outside the footprint', () => {
  assert(canOccupy(0, 13.7, radius));
  assert(canOccupy(30, 0, radius));
  assert(!canOccupy(30, 20, radius));
  assert(!canOccupy(-30, 20, radius));
});

test('all eight outer walls stop a large step with full body clearance', () => {
  exteriorOutline.forEach(([ax, az], i) => {
    const [bx, bz] = exteriorOutline[(i + 1) % exteriorOutline.length];
    const length = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / length;
    const nz = (bx - ax) / length;
    const p = { x: (ax + bx) / 2 + nx * 5, y: 1.5, z: (az + bz) / 2 + nz * 5 };
    assert(canOccupy(p.x, p.z, radius));
    moveWithinExterior(p, { x: -nx * 100, z: -nz * 100 }, radius);
    assert(canOccupy(p.x, p.z, radius));
    assert(Math.hypot(p.x - (ax + bx) / 2, p.z - (az + bz) / 2) < 3);
    assert.equal(p.y, 1.5);
  });
});

test('slides along walls, passes interior walls and crosses the entrance', () => {
  const p = { x: 0, z: 13.7 };
  moveWithinExterior(p, { x: 0, z: -44 }, radius);
  assert(Math.abs(p.z + 30.3) < 1e-8); // Cross the partition near z=-9.
  moveWithinExterior(p, { x: 20, z: 0 }, radius);
  assert(Math.abs(p.x - 20) < 1e-8); // Cross the partition near x=7.
  const wall = { x: 41.6, z: -30 };
  moveWithinExterior(wall, { x: 10, z: 10 }, radius);
  assert(canOccupy(wall.x, wall.z, radius));
  assert(Math.abs(wall.z + 20) < 1e-8);
  const corner = { x: 0, z: 20 };
  moveWithinExterior(corner, { x: 100, z: -100 }, radius);
  assert(canOccupy(corner.x, corner.z, radius));
});

test('the configured outline matches tall wall edges in the actual GLB', async () => {
  const bytes = await readFile(new URL('../public/models/gallery.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  const floor = scene.getObjectByName('Floor');
  const { position } = floor.geometry.attributes;
  const index = floor.geometry.index;
  const edges = [];
  for (let i = 0; i < index.count; i += 3) {
    const vertices = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(position, index.getX(i + k)).applyMatrix4(floor.matrixWorld));
    if (Math.max(...vertices.map(v => v.y)) - Math.min(...vertices.map(v => v.y)) > 10) edges.push(vertices);
  }
  exteriorOutline.forEach(([ax, az], i) => {
    const [bx, bz] = exteriorOutline[(i + 1) % exteriorOutline.length];
    assert(edges.some(vs => vs.some(v => Math.hypot(v.x - ax, v.z - az) < 0.001)
      && vs.some(v => Math.hypot(v.x - bx, v.z - bz) < 0.001)), `Exterior edge ${i} changed in the GLB`);
  });
});
