/** Fixed UI copy (buttons, headlines, toasts) and the credits. */
export const UI_TEXT = {
  disclaimer: 'A parody. Any resemblance to actual governments is regrettable.',
  letThemCome: 'LET THEM COME',
  callEarly: (n: number) => `CALL EARLY +${n}`,
  levelUp: 'NEW TOOL OF ORDER APPROVED',
  victoryHeadline: 'ORDER RESTORED',
  defeatHeadline: 'THE REGIME HAS FALLEN',
  /** Canonical closing lines (variants: text/moments.ts `closingLine`). */
  atWhatCost: 'You kept order. But at what cost?',
  defeatCost: 'You lost order. It cost exactly the same.',
  moveHint: 'TAP A ROAD TO MOVE',
  moveHintMouse: 'CLICK A ROAD TO MOVE',
  confirmHint: 'TAP AGAIN OR OK TO DEPLOY',
  notEnoughHate: (cost: number) => `NOT ENOUGH HATE (${cost} NEEDED)`,
  approvedAt: (name: string, level: number) => `${name.toUpperCase()}: APPROVED AT LEVEL ${level}`,
  bretaTitle: 'BRETA SIGHTED!',
  bretaLine: 'Worth +100 Hate if downed. Paparazzi included.',
  prophetsTitle: 'THE PROPHETS ARE COMING',
  prophetsLine: 'They explode on contact. Keep them off your men.',
  newThreat: (name: string) => `NEW THREAT: ${name.toUpperCase()}`,
  /** Incoming-wave marker tooltip (district, expected head count, first time?, leading type). */
  forecastTip: (district: string, count: string, isNew: boolean, lead: string | null) =>
    `${district.toUpperCase()}${isNew ? ' (NEW)' : ''}: ABOUT ${count} PROTESTERS GATHER HERE.` +
    (lead ? ` LED BY ${lead.toUpperCase()}.` : ''),
};

export const CREDITS: ReadonlyArray<[string, string]> = [['MADE BY', 'GBT Digital Products']];
/** Closing line under the credits. */
export const CREDITS_LEGAL = 'Any resemblance to real events is a coincidence we deeply regret.';
