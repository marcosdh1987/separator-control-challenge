export interface ShellThetaSector {
  start: number;
  length: number;
}

/** CylinderGeometry uses z = radius * cos(theta); rotation about Z preserves z. */
export const FRONT_SHELL_THETA: ShellThetaSector = Object.freeze({
  start: -Math.PI / 2,
  length: Math.PI,
});

export const REAR_SHELL_THETA: ShellThetaSector = Object.freeze({
  start: Math.PI / 2,
  length: Math.PI,
});

export function shellSectorMidpoint(sector: ShellThetaSector, radius: number) {
  const theta = sector.start + sector.length / 2;
  return {
    z: radius * Math.cos(theta),
    normalZ: Math.cos(theta),
  };
}
