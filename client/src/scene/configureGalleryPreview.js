import { DoubleSide, MeshStandardMaterial, PointLight } from 'three';

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
