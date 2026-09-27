import { Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

export function fitArtwork(imageWidth, imageHeight, maxWidth, maxHeight) {
  if (![imageWidth, imageHeight, maxWidth, maxHeight].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error('Image dimensions and slot limits must be positive numbers.');
  }
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}

export function createArtworkPlane(texture, anchor, settings) {
  const image = texture.image;
  const { width, height } = fitArtwork(
    image.naturalWidth ?? image.width,
    image.naturalHeight ?? image.height,
    settings.maxWidth,
    settings.maxHeight,
  );
  texture.colorSpace = SRGBColorSpace;
  // Keep artwork readable independently of the temporary gallery lights.
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true });
  const plane = new Mesh(new PlaneGeometry(width, height), material);
  plane.name = `Artwork_${anchor.name}`;
  // Read world coordinates because the plane is added outside the imported GLB.
  anchor.getWorldPosition(plane.position);
  if (settings.positionOffset) plane.position.add(new Vector3(...settings.positionOffset));
  plane.rotation.set(0, settings.rotationY, 0);
  plane.translateZ(settings.wallOffset);
  return plane;
}

export function disposeArtwork(plane) {
  plane.removeFromParent();
  plane.geometry.dispose();
  plane.material.map.dispose();
  plane.material.dispose();
}
