// World-space facing directions for the current gallery.glb.
// A Three.js plane faces local +Z. These rotations point it into the room.
// Width/height are display limits in gallery units, not image pixels.
// wallOffset measures clearance behind the backing; frame depth projects outward.
const slot = (rotationY) => ({ maxWidth: 8, maxHeight: 8, rotationY, wallOffset: 0.12 });

export const slotConfig = {
  ArtSlot_01: slot(Math.PI),
  ArtSlot_02: slot(Math.PI),
  ArtSlot_03: slot(Math.PI),
  ArtSlot_04: slot(-Math.PI / 2),
  ArtSlot_05: { ...slot(-Math.PI / 2), positionOffset: [0.35, 0, 0] }, // Anchor sits farther from this wall.
  ArtSlot_06: slot(-Math.PI / 2),
  ArtSlot_07: slot(-Math.PI / 2),
  ArtSlot_08: slot(0),
  ArtSlot_09: slot(0),
  ArtSlot_10: slot(0),
  ArtSlot_11: slot(Math.PI / 2),
  ArtSlot_12: slot(-Math.PI / 2), // West face of the interior divider.
  ArtSlot_13: slot(Math.PI / 2),
  ArtSlot_14: slot(Math.PI),
  ArtSlot_15: slot(Math.PI),
};
