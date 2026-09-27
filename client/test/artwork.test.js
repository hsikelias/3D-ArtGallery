import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DoubleSide, Group, Object3D, Raycaster, Texture, TextureLoader, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createArtworkManager } from '../src/artwork/artworkManager.js';
import { createArtworkPlane, disposeArtwork, fitArtwork } from '../src/artwork/imagePlacement.js';
import { slotConfig } from '../src/artwork/slotConfig.js';

test('different aspect ratios fit within the display area without distortion', () => {
  for (const [w, h] of [[1200, 800], [800, 1200], [900, 900], [3000, 100]]) {
    const fitted = fitArtwork(w, h, 8, 6);
    assert.ok(fitted.width <= 8 && fitted.height <= 6);
    assert.ok(Math.abs(fitted.width / fitted.height - w / h) < 1e-10);
    assert.ok(fitted.width === 8 || fitted.height === 6);
  }
  assert.throws(() => fitArtwork(0, 100, 8, 8));
});

test('all 15 configured planes have a nearby wall behind their center and corners in the actual GLB', async () => {
  const bytes = await readFile(new URL('../public/models/gallery.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const walls = gltf.scene.getObjectByName('Floor');
  walls.material.side = DoubleSide;
  assert.equal(Object.keys(slotConfig).length, 15);
  for (const [name, settings] of Object.entries(slotConfig)) {
    const anchor = gltf.scene.getObjectByName(name);
    assert.ok(anchor, name);
    const plane = createArtworkPlane(new Texture({ width: 900, height: 900 }), anchor, settings);
    plane.updateMatrixWorld(true);
    const back = new Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
    for (const [x, y] of [[0, 0], [-3.99, -3.99], [-3.99, 3.99], [3.99, -3.99], [3.99, 3.99]]) {
      const origin = plane.localToWorld(new Vector3(x, y, 0));
      const hit = new Raycaster(origin, back, 0, 0.3).intersectObject(walls)[0];
      assert.ok(hit && hit.distance > 0.05, `${name}: plane must sit just in front of its wall`);
    }
    disposeArtwork(plane);
  }
});

function setupManager() {
  const scene = new Group();
  const artSlots = [1, 2, 3].map((number) => {
    const anchor = new Object3D();
    anchor.name = `ArtSlot_0${number}`;
    return anchor;
  });
  return { scene, manager: createArtworkManager({ scene, artSlots }) };
}

test('failed images leave their own slot empty and replacing artwork releases old textures', async (t) => {
  const textures = [];
  let released = 0;
  t.mock.method(TextureLoader.prototype, 'loadAsync', async (url) => {
    if (url === 'broken') throw new Error('Image unavailable');
    const texture = new Texture({ width: 1200, height: 800 });
    texture.addEventListener('dispose', () => released++);
    textures.push(texture);
    return texture;
  });
  const { scene, manager } = setupManager();
  const result = await manager.setImages(['first', 'broken', 'third']);
  assert.equal(result.loadedCount, 2);
  assert.equal(result.errors[0].slot, 'ArtSlot_02');
  assert.ok(scene.getObjectByName('Artwork_ArtSlot_03'));
  assert.equal(scene.getObjectByName('Artwork_ArtSlot_02'), undefined);
  await assert.rejects(manager.setImages(['1', '2', '3', '4']), /up to 3/);
  assert.equal(scene.getObjectByName('Gallery artwork').children.length, 2);
  await manager.setImages(['replacement']);
  assert.equal(released, 2);
  await manager.setImages([]);
  assert.equal(released, textures.length);
  manager.dispose();
  assert.equal(scene.children.length, 0);
});

test('a slow previous selection cannot overwrite a newer selection', async (t) => {
  let finishOld;
  let released = false;
  const old = new Texture({ width: 10, height: 20 });
  old.addEventListener('dispose', () => { released = true; });
  t.mock.method(TextureLoader.prototype, 'loadAsync', (url) => url === 'old'
    ? new Promise((resolve) => { finishOld = () => resolve(old); })
    : Promise.resolve(new Texture({ width: 20, height: 10 })));
  const { scene, manager } = setupManager();
  const pending = manager.setImages(['old']);
  await manager.setImages(['new']);
  finishOld();
  assert.equal((await pending).superseded, true);
  assert.equal(released, true);
  assert.equal(scene.getObjectByName('Gallery artwork').children.length, 1);
  manager.dispose();
});
