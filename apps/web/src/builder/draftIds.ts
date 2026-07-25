// Rule and condition ids only have to be unique within one session, and React
// keys them — a counter is enough, and unlike randomness it keeps test output
// readable. One shared counter so ids minted in different components can never
// collide.
let counter = 0;

export function nextDraftId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}
