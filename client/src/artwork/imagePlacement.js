import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

// Gallery units: 0.25 on each edge adds 0.5 to the overall width and height.
// Depth is independently tuned in gallery units; the backing projects outward.
export const artworkFrame = { border: 0.25, depth: 0.25, imageGap: 0.01, color: '#70452c' };

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
  // A solid backing leaves an even brown border around the image.
  // Keep it attached to the plane so both share the anchor's orientation.
  const backing = new Mesh(
    new BoxGeometry(width + artworkFrame.border * 2, height + artworkFrame.border * 2, artworkFrame.depth),
    new MeshStandardMaterial({ color: artworkFrame.color, roughness: 0.85, metalness: 0 }),
  );
  backing.name = `Frame_${anchor.name}`;
  backing.position.z = -artworkFrame.depth / 2 - artworkFrame.imageGap;
  plane.add(backing);
  // Read world coordinates because the plane is added outside the imported GLB.
  anchor.getWorldPosition(plane.position);
  if (settings.positionOffset) plane.position.add(new Vector3(...settings.positionOffset));
  plane.rotation.set(0, settings.rotationY, 0);
  // wallOffset is the clearance behind the backing. Increasing frame depth
  // projects the image farther into the room instead of sinking into the wall.
  plane.translateZ(settings.wallOffset + artworkFrame.depth + artworkFrame.imageGap);
  return plane;
}

export function disposeArtwork(plane) {
  plane.removeFromParent();
  plane.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    object.material.map?.dispose();
    object.material.dispose();
  });
}
