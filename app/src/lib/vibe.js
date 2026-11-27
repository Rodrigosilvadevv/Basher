// "Vibe": compatibilidade entre dois perfis (posição, o que procuram, gostos e tribos).
const POS_FIT = {
  top: { bottom: 1, vers_bottom: 1, versatile: 0.85, vers_top: 0.45, top: 0.1, side: 0.2 },
  vers_top: { bottom: 1, vers_bottom: 1, versatile: 0.9, vers_top: 0.6, top: 0.4, side: 0.3 },
  versatile: { versatile: 1, vers_top: 0.9, vers_bottom: 0.9, top: 0.85, bottom: 0.85, side: 0.4 },
  vers_bottom: { top: 1, vers_top: 1, versatile: 0.9, vers_bottom: 0.6, bottom: 0.4, side: 0.3 },
  bottom: { top: 1, vers_top: 1, versatile: 0.85, vers_bottom: 0.45, bottom: 0.1, side: 0.2 },
  side: { side: 1, versatile: 0.4, vers_top: 0.3, vers_bottom: 0.3, top: 0.2, bottom: 0.2 },
};

const overlap = (a = [], b = []) => {
  if (!a.length || !b.length) return 0;
  const s = new Set(a);
  return b.filter((x) => s.has(x)).length;
};

export function vibeScore(me, other) {
  if (!me || !other) return null;
  let score = 30;
  const pos = me.sex_position && other.sex_position ? POS_FIT[me.sex_position]?.[other.sex_position] ?? 0.3 : 0.5;
  score += pos * 30;
  const look = overlap(me.looking_for, other.looking_for);
  score += Math.min(look, 3) * 6;
  const likes = overlap(me.interests, other.interests);
  score += Math.min(likes, 4) * 4;
  score += Math.min(overlap(me.tribes, other.tribes), 2) * 3;
  return Math.max(12, Math.min(99, Math.round(score)));
}

export function sharedInterests(me, other) {
  const s = new Set(me?.interests || []);
  return (other?.interests || []).filter((x) => s.has(x));
}
