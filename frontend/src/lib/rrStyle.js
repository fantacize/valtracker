const START_HUE = -5;
const END_HUE = 145;

const clamp = (value) => Math.min(100, Math.max(0, Number(value) || 0));

const colorAt = (progress) => {
  const hue = Math.round(START_HUE + (END_HUE - START_HUE) * progress);
  const saturation = Math.round(90 - 20 * progress);
  const lightness = Math.round(60 - 10 * progress);
  return `hsl(${hue < 0 ? hue + 360 : hue} ${saturation}% ${lightness}%)`;
};

export const getRrDisplay = ({ tier, rr }) => {
  if (tier === 'Radiant') return { kind: 'number', tone: 'radiant' };
  if (String(tier || '').includes('Immortal')) return { kind: 'number', tone: 'immortal' };

  const width = clamp(rr);
  const color = colorAt(width / 100);
  return {
    kind: 'bar',
    width,
    color,
    background: `linear-gradient(90deg, ${colorAt(0)}, ${color})`
  };
};
