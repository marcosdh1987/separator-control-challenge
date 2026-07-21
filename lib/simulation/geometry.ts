const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function fullCylinderVolume(diameterM: number, lengthM: number): number {
  const radius = diameterM / 2;
  return Math.PI * radius * radius * lengthM;
}

export function horizontalVolumeFromLevel(
  levelPct: number,
  diameterM: number,
  lengthM: number,
): number {
  const level = clamp(levelPct, 0, 100) / 100;
  const radius = diameterM / 2;
  const height = level * diameterM;
  if (height <= 0) return 0;
  if (height >= diameterM) return fullCylinderVolume(diameterM, lengthM);
  const area =
    radius * radius * Math.acos((radius - height) / radius) -
    (radius - height) * Math.sqrt(Math.max(0, 2 * radius * height - height * height));
  return area * lengthM;
}

export function horizontalLevelFromVolume(
  volumeM3: number,
  diameterM: number,
  lengthM: number,
): number {
  const full = fullCylinderVolume(diameterM, lengthM);
  if (volumeM3 <= 0) return 0;
  if (volumeM3 >= full) return 100;
  let lower = 0;
  let upper = 100;
  for (let index = 0; index < 60; index += 1) {
    const middle = (lower + upper) / 2;
    if (horizontalVolumeFromLevel(middle, diameterM, lengthM) < volumeM3) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return (lower + upper) / 2;
}
