import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// Front face of the middle wall is at Z=-8.77. Keep sculptures forward of it;
// ArtSlot_12 on the perpendicular partition behind it remains unobstructed.
export const statuePlacements = [
  { name: 'Concrete dog', file: 'dog.obj', x: 10, z: -20, height: 6, yaw: Math.PI / 2, color: '#b7b1a5' },
  { name: 'The Thinker', file: 'thinker.obj', x: 4, z: -3, height: 7.5, yaw: 0,
    texture: 'thinker-diffuse.jpg', bump: 'thinker-bump.jpg' },
  { name: 'Stone head', file: 'statue.obj', x: 0, z: -30, height: 8, yaw: 0, texture: 'statue-diffuse.jpg' },
];
const floorY = 1.4820216894;
const pedestalHeight = 1.4;

export function placeStatue(model, config) {
  // These OBJ exports use Z-up; the gallery/Three.js uses Y-up.
  model.rotation.x = -Math.PI / 2;
  model.rotation.z = config.yaw;
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const scale = Math.min(config.height / size.y, 5.5 / size.x, 5.5 / size.z);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  model.position.set(-center.x, pedestalHeight - bounds.min.y, -center.z);

  const display = new Group();
  display.name = `Statue: ${config.name}`;
  display.position.set(config.x, floorY, config.z);
  const dimensions = bounds.getSize(new Vector3());
  const pedestal = new Mesh(
    new BoxGeometry(Math.max(3.2, dimensions.x + 0.6), pedestalHeight, Math.max(3.2, dimensions.z + 0.6)),
    new MeshStandardMaterial({ color: '#bcb6ac', roughness: 0.9 }),
  );
  pedestal.name = `${config.name} plinth`;
  pedestal.position.y = pedestalHeight / 2;
  display.add(pedestal, model);
  return display;
}

export async function loadStatues(scene) {
  const assetRoot = import.meta.env ? '/models/statues/' : new URL('./public/models/statues/', document.baseURI).href;
  const loader = new OBJLoader();
  const textures = new TextureLoader();
  const results = await Promise.allSettled(statuePlacements.map(async config => {
    const model = await loader.loadAsync(assetRoot + config.file);
    const material = new MeshStandardMaterial({ color: config.color ?? '#ffffff', roughness: 0.8, metalness: 0 });
    // Ignore the incomplete legacy MTL files, but preserve supplied color maps.
    if (config.texture) {
      material.map = await textures.loadAsync(assetRoot + config.texture);
      material.map.colorSpace = SRGBColorSpace;
    }
    if (config.bump) {
      material.bumpMap = await textures.loadAsync(assetRoot + config.bump);
      material.bumpScale = 0.05;
    }
    const oldMaterials = new Set();
    model.traverse(object => {
      if (!object.isMesh) return;
      for (const old of Array.isArray(object.material) ? object.material : [object.material]) oldMaterials.add(old);
      object.material = material;
    });
    oldMaterials.forEach(old => old.dispose());
    const display = placeStatue(model, config);
    scene.add(display);
    return display;
  }));
  const errors = results.flatMap((result, i) => result.status === 'rejected' ? [`${statuePlacements[i].name}: ${result.reason.message}`] : []);
  if (errors.length) console.warn('Some statues could not load:', errors);
  return { statues: results.filter(result => result.status === 'fulfilled').map(result => result.value), errors };
}
