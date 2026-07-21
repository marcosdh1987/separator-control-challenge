const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function stepActuator(
  positionPct: number,
  commandPct: number,
  dtS: number,
  tauS: number,
  strokeRatePctS: number,
): number {
  const position = clamp(positionPct, 0, 100);
  const command = clamp(commandPct, 0, 100);
  const desired = tauS > 0
    ? position + (1 - Math.exp(-dtS / tauS)) * (command - position)
    : command;
  const maximumMove = Math.max(0, strokeRatePctS) * dtS;
  const move = clamp(desired - position, -maximumMove, maximumMove);
  return clamp(position + move, 0, 100);
}
