// PLAN.md Stage 7: simple collision, without a physics engine.
// World-space exterior wall endpoints measured from gallery.glb's Floor mesh.
// Its interior partitions intentionally do not participate. Update this outline
// if the Blender exterior changes; a bounding box would miss the entrance wings.
export const exteriorOutline = [
  [-43.616734, -56.172069], [43.616734, -56.172069],
  [43.616734, 8.625245], [14.467463, 8.598147],
  [14.467463, 37.533074], [-14.467463, 37.533074],
  [-14.467463, 8.598147], [-43.616734, 8.625245],
];

export function canOccupy(x, z, radius) {
  let inside = false;
  for (let i = 0, j = exteriorOutline.length - 1; i < exteriorOutline.length; j = i++) {
    const [ax, az] = exteriorOutline[j];
    const [bx, bz] = exteriorOutline[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) {
      inside = !inside;
    }
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < radius) return false;
  }
  return inside;
}

export function moveWithinExterior(position, displacement, radius) {
  if (!(radius > 0)) throw new Error('Collision radius must be positive.');
  // Small steps prevent crossing a wall or corner during a long movement frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(displacement.x, displacement.z) / (radius * 0.25)));
  const dx = displacement.x / steps;
  const dz = displacement.z / steps;
  for (let step = 0; step < steps; step += 1) {
    // Resolve separately so input into a wall still allows motion along it.
    if (canOccupy(position.x + dx, position.z, radius)) position.x += dx;
    if (canOccupy(position.x, position.z + dz, radius)) position.z += dz;
  }
}
