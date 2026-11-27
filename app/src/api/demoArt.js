// Arte gerada para o modo demonstração (sem fotos de pessoas reais).
const SKIN = ['#f3d6c1', '#e8b996', '#d29a70', '#b07549', '#8a5634', '#5e3721'];
const HAIR = ['#120e0d', '#2b1a12', '#5b3a22', '#a8794a', '#e9e2d8', '#2d2350'];
const BGS = [
  ['#7c3aed', '#d946ef'],
  ['#3b0764', '#8b5cf6'],
  ['#1e1b4b', '#7c3aed'],
  ['#581c87', '#f0abfc'],
  ['#2e1065', '#a77bff'],
  ['#4a044e', '#c026d3'],
  ['#0f172a', '#6d28d9'],
  ['#3f0f5c', '#fb7185'],
];
const SHIRTS = ['#0b0812', '#1f1235', '#e9ddff', '#111827', '#3b1773', '#f4eeff', '#1c1917', '#4c1d95'];

function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const uri = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

export function portrait(seed) {
  const r = rng(seed + 11);
  const skin = pick(r, SKIN);
  const hair = pick(r, HAIR);
  const [b1, b2] = pick(r, BGS);
  const shirt = pick(r, SHIRTS);
  const hairStyle = Math.floor(r() * 6);
  const beard = Math.floor(r() * 4);
  const glasses = r() < 0.22;
  const tilt = (r() * 10 - 5).toFixed(1);
  const id = 's' + seed;

  const hairs = [
    `<path d="M100 120 C98 70 202 70 200 120 C188 94 112 94 100 120Z" fill="${hair}"/>`,
    `<path d="M97 124 C88 64 152 48 198 78 C214 90 206 114 201 124 C190 98 160 88 130 96 C112 101 103 112 97 124Z" fill="${hair}"/>`,
    `<g fill="${hair}">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${104 + i * 15.5}" cy="${86 - Math.sin((i / 6) * Math.PI) * 18}" r="17"/>`).join('')}<path d="M98 118 C98 92 202 92 202 118 C190 100 110 100 98 118Z"/></g>`,
    '',
    `<g fill="${hair}"><circle cx="150" cy="58" r="20"/><path d="M100 122 C96 72 204 72 200 122 C188 92 112 92 100 122Z"/></g>`,
    `<path d="M96 132 C84 60 160 40 204 84 C214 96 210 120 204 136 C200 110 182 92 150 92 C120 92 102 108 96 132Z" fill="${hair}"/>`,
  ];
  const beards = [
    '',
    `<path d="M108 150 C112 186 136 196 150 196 C164 196 188 186 192 150 C184 168 168 176 150 176 C132 176 116 168 108 150Z" fill="${hair}" opacity=".35"/>`,
    `<path d="M104 140 C106 190 134 202 150 202 C166 202 194 190 196 140 C190 160 176 172 150 172 C124 172 110 160 104 140Z" fill="${hair}"/>`,
    `<path d="M128 160 C138 152 162 152 172 160 C162 158 138 158 128 160Z" fill="${hair}" stroke="${hair}" stroke-width="6" stroke-linejoin="round"/>`,
  ];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
<defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>
<radialGradient id="${id}l" cx=".3" cy=".25" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
</defs>
<rect width="300" height="300" fill="url(#${id}b)"/>
<circle cx="80" cy="70" r="120" fill="url(#${id}l)"/>
<g transform="rotate(${tilt} 150 200)">
<path d="M34 300 C44 228 98 206 150 206 C202 206 256 228 266 300Z" fill="${shirt}"/>
<rect x="128" y="168" width="44" height="54" rx="18" fill="${skin}"/>
<rect x="128" y="168" width="44" height="54" rx="18" fill="#000" opacity=".14"/>
<ellipse cx="150" cy="130" rx="50" ry="58" fill="${skin}"/>
<path d="M188 92 C206 112 206 156 186 178" stroke="${b2}" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>
${beards[beard]}
${hairs[hairStyle]}
${glasses ? `<g><rect x="112" y="118" width="34" height="22" rx="10" fill="#0b0812"/><rect x="154" y="118" width="34" height="22" rx="10" fill="#0b0812"/><rect x="144" y="124" width="12" height="4" fill="#0b0812"/><path d="M118 124 L130 124" stroke="${b2}" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>` : ''}
</g>
<rect width="300" height="300" fill="url(#${id}s)"/>
</svg>`;
  return uri(svg);
}

// Cenas noturnas abstratas para posts, stories e álbuns do demo.
export function scene(seed, { w = 600, h = 750 } = {}) {
  const r = rng(seed + 101);
  const [b1, b2] = pick(r, BGS);
  const id = 'c' + seed;
  const blds = Array.from({ length: 9 }, (_, i) => {
    const bw = 50 + r() * 50;
    const bh = 120 + r() * 300;
    const x = i * (w / 8) - 20 + r() * 20;
    const wins = Array.from({ length: Math.floor(bh / 28) }, (__, k) =>
      r() < 0.4 ? `<rect x="${x + 10 + (k % 2) * 22}" y="${h - bh + 14 + k * 26}" width="10" height="12" fill="${r() < 0.5 ? '#f0abfc' : '#ffcf6b'}" opacity="${0.4 + r() * 0.5}"/>` : '',
    ).join('');
    return `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" fill="#07050b" opacity=".92"/>${wins}`;
  }).join('');
  const orbs = Array.from({ length: 5 }, () =>
    `<circle cx="${r() * w}" cy="${r() * h * 0.6}" r="${20 + r() * 90}" fill="${pick(r, ['#d946ef', '#a77bff', '#7c3aed', '#f0abfc'])}" opacity="${0.15 + r() * 0.3}"/>`,
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset=".7" stop-color="${b2}"/><stop offset="1" stop-color="#07050b"/></linearGradient>
<filter id="${id}f"><feGaussianBlur stdDeviation="18"/></filter></defs>
<rect width="${w}" height="${h}" fill="url(#${id})"/>
<g filter="url(#${id}f)">${orbs}</g>
<circle cx="${w * (0.2 + r() * 0.6)}" cy="${h * 0.28}" r="46" fill="#f4eeff" opacity=".85"/>
${blds}
<rect y="${h - 6}" width="${w}" height="6" fill="#d946ef" opacity=".6"/>
</svg>`;
  return uri(svg);
}
