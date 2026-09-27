import { Box3, DoubleSide, MeshStandardMaterial, PointLight, Vector3 } from 'three';

// Flat oak-plank-inspired color; no wood texture or Blender edit is needed.
const FLOOR_COLOR = '#f39f51';

function colorGroundSurfaces(mesh) {
  const geometry = mesh.geometry;
  const positions = geometry.attributes.position;
  const indices = geometry.index;
  const count = indices ? indices.count : positions.count;
  const groundY = new Box3().setFromObject(mesh).min.y;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const normal = new Vector3();
  const edge = new Vector3();
  const wallMaterial = mesh.material;
  const floorMaterial = wallMaterial.clone();
  floorMaterial.name = 'Warm oak floor';
  floorMaterial.color.set(FLOOR_COLOR);
  mesh.material = [wallMaterial, floorMaterial];
  geometry.clearGroups();

  // The Floor mesh includes the entire room. Assign a second material only to
  // horizontal triangles near its lowest level, retaining all original geometry.
  // Combine adjacent triangles with the same material to keep draw calls small.
  let groupStart = 0;
  let previousMaterial;
  for (let i = 0; i < count; i += 3) {
    for (const [offset, point] of [[0, a], [1, b], [2, c]]) {
      point.fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset);
      point.applyMatrix4(mesh.matrixWorld);
    }
    normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
    const isGround = Math.abs(normal.y) > 0.99 &&
      [a, b, c].every((point) => Math.abs(point.y - groundY) < 0.05);
    const materialIndex = isGround ? 1 : 0;
    if (previousMaterial !== undefined && materialIndex !== previousMaterial) {
      geometry.addGroup(groupStart, i - groupStart, previousMaterial);
      groupStart = i;
    }
    previousMaterial = materialIndex;
  }
  geometry.addGroup(groupStart, count - groupStart, previousMaterial);
}

// Temporary Stage 1 support for incomplete exports. Keep authored materials and
// lights intact so the Blender file remains the source of the finished look.
export function configureGalleryPreview(gltf, inspectionLighting) {
  const missingMaterials = [];
  const fixtures = [];
  let importedLightCount = 0;

  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (object.isLight) importedLightCount += 1;
    // GLTFLoader removes dots from Blender names (LightBulb.006 -> LightBulb006).
    if (/^LightBulb(?:[._]?\d+)?$/.test(object.name)) fixtures.push(object);
    if (!object.isMesh) return;

    const reference = gltf.parser.associations.get(object);
    const primitive = gltf.parser.json.meshes[reference?.meshes]?.primitives[reference?.primitives];
    if (!primitive || primitive.material !== undefined) return;

    // An omitted glTF material defaults to metalness=1 and front faces only.
    // The current export's Floor mesh also contains the walls and ceiling.
    // A matte, two-sided fallback makes those bare surfaces inspectable.
    object.material = new MeshStandardMaterial({
      name: 'Missing material preview',
      color: '#dedbd3',
      metalness: 0,
      roughness: 0.85,
      side: DoubleSide,
    });
    if (object.name === 'Floor') colorGroundSurfaces(object);
    missingMaterials.push(object.name);
  });

  // Glowing bulb materials don't light other objects in this renderer. Create
  // actual lights only when the asset has none, avoiding doubled export lights.
  if (importedLightCount === 0) {
    for (const fixture of fixtures) {
      // Values tuned for this roughly 87 x 17 x 94 unit gallery, not real meters.
      const light = new PointLight(0xfff3dc, 600, 45, 2);
      light.name = `Preview light: ${fixture.name}`;
      fixture.getWorldPosition(light.position);
      light.position.y -= 0.3;
      inspectionLighting.add(light);
    }
  }

  return { missingMaterials, previewLightCount: importedLightCount === 0 ? fixtures.length : 0 };
}
