import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { configureGalleryPreview } from './configureGalleryPreview.js';

export async function loadGallery(scene, inspectionLighting) {
  // Vite serves public/ files at the site root.
  const gltf = await new GLTFLoader().loadAsync('/models/gallery.glb');
  const gallery = gltf.scene;
  scene.add(gallery);
  gallery.updateMatrixWorld(true);
  const { missingMaterials, previewLightCount } = configureGalleryPreview(gltf, inspectionLighting);
  const objects = [];
  const artSlots = [];
  const lights = [];
  gallery.traverse((object) => {
    objects.push({ name: object.name, type: object.type });
    if (/^ArtSlot_\d+$/.test(object.name)) artSlots.push(object);
    if (object.isLight) lights.push(object);
  });
  artSlots.sort((a, b) => a.name.localeCompare(b.name));
  const spawn = gallery.getObjectByName('PlayerSpawn');
  const size = new Box3().setFromObject(gallery).getSize(new Vector3());
  console.group('Gallery inspection');
  console.table(objects);
  console.log('Artwork anchors:', artSlots.map((slot) => slot.name));
  console.log('PlayerSpawn world position:', spawn?.getWorldPosition(new Vector3()));
  console.log('Gallery size in exported units:', size);
  console.log('Imported lights:', lights);
  console.log('Meshes with missing materials (using matte, double-sided preview):', missingMaterials);
  console.log('Temporary bulb lights:', previewLightCount);
  console.groupEnd();
  const warnings = [];
  if (!spawn) warnings.push('PlayerSpawn is missing. Check the Blender export.');
  if (!artSlots.length) warnings.push('No ArtSlot anchors found. Check the Blender export.');
  if (!lights.length) warnings.push(`No exported lights; ${previewLightCount} temporary bulb lights are available with inspection lighting.`);
  if (missingMaterials.length) warnings.push(`Missing materials on ${missingMaterials.join(', ')}: using a matte, double-sided preview.`);
  warnings.forEach((message) => console.warn(message));
  return { artSlots, spawn, lights, size, warnings };
}
