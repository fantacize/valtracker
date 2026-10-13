const THRESHOLDS = {
  kd: { good: 1.16, bad: 0.9 },
  winRate: { good: 55, bad: 45 },
  hs: { good: 25, bad: 15 }
};

export const statTone = (stat, rawValue) => {
  const limits = THRESHOLDS[stat];
  const value = Number(rawValue);
  if (!limits || rawValue === null || rawValue === undefined || !Number.isFinite(value)) return 'neutral';
  if (value >= limits.good) return 'good';
  if (value < limits.bad) return 'bad';
  return 'neutral';
};
