import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createPlayerController } from '../src/player/createPlayerController.js';

test('network heading survives turns past 90 degrees and reconnect pose restoration', t => {
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { querySelector: () => null });
  let controller;
  t.after(() => {
    controller?.dispose();
    globalThis.window = priorWindow;
    globalThis.document = priorDocument;
  });
  const canvas = Object.assign(new EventTarget(), { setAttribute() {}, focus() {} });
  document.activeElement = canvas;
  const scene = new Scene();
  const player = new Mesh(new BoxGeometry(2, 3, 2), new MeshBasicMaterial());
  const spawn = new Object3D();
  spawn.position.set(0, 1.5, 14);
  scene.add(player, spawn);
  controller = createPlayerController({ scene, player, spawn, canvas,
    camera: new PerspectiveCamera(), controls: { target: new Vector3(), update() {}, saveState() {}, getAzimuthalAngle: () => 0 } });
  t.after(() => { player.geometry.dispose(); player.material.dispose(); });
  for (const angle of [0, Math.PI * 0.75, -Math.PI * 0.75, Math.PI]) {
    controller.setSpawn({ x: 0, y: 1.5, z: 14, rotationY: angle });
    // Simulate quaternion interpolation, which updates the object's Euler form.
    const pivot = scene.getObjectByName('LocalPlayer');
    pivot.quaternion.copy(pivot.quaternion.clone());
    const actual = controller.getState();
    assert(Math.abs(Math.atan2(Math.sin(actual.rotationY - angle), Math.cos(actual.rotationY - angle))) < 1e-8);
    assert.equal(actual.x, 0);
    assert.equal(actual.z, 14);
  }
  controller.reset();
  const key = new Event('keydown');
  Object.defineProperty(key, 'code', { value: 'KeyW' });
  canvas.dispatchEvent(key);
  for (let frame = 0; frame < 60; frame++) controller.update(1 / 60);
  const state = controller.getState();
  assert(state.z < 14);
  assert.equal(state.y, 1.5);
  assert(Math.abs(Math.abs(state.rotationY) - Math.PI) < 0.01);
});
