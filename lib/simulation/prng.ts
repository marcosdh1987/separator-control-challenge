export interface RandomStep {
  state: number;
  value: number;
}

export function nextRandom(currentState: number): RandomStep {
  const state = (currentState + 0x6d2b79f5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    state,
    value: ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296,
  };
}
