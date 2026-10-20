// デモ版の見本写真（風景イラスト）を生成するスクリプト
// 実在の写真は使わず、コードで描いたSVGを demo/photos/ に書き出す。
// 実行: node scripts/generate-demo-photos.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'photos');
mkdirSync(outDir, { recursive: true });

// 再現できるよう乱数は固定シード
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ridge(r, w, h, baseY, amp, steps) {
  let d = `M0 ${h} L0 ${baseY}`;
  for (let i = 1; i <= steps; i++) {
    const x = (w / steps) * i;
    const y = baseY - r() * amp + amp / 2;
    d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
  }
  return d + ` L${w} ${h} Z`;
}

function smoothHill(w, h, baseY, amp, phase) {
  let d = `M0 ${h} L0 ${baseY}`;
  for (let x = 0; x <= w; x += 40) {
    const y = baseY - Math.sin(x / w * Math.PI * 1.6 + phase) * amp;
    d += ` L${x} ${y.toFixed(0)}`;
  }
  return d + ` L${w} ${h} Z`;
}

const scenes = {
  mountains(r, w, h, p) {
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <circle cx="${w * 0.7}" cy="${h * 0.32}" r="${h * 0.08}" fill="${p.sun}" opacity="0.9"/>
      <path d="${ridge(r, w, h, h * 0.5, h * 0.2, 9)}" fill="${p.far}" opacity="0.7"/>
      <path d="${ridge(r, w, h, h * 0.62, h * 0.16, 7)}" fill="${p.mid}"/>
      <path d="${smoothHill(w, h, h * 0.78, h * 0.05, r() * 3)}" fill="${p.near}"/>`;
  },
  sea(r, w, h, p) {
    let waves = '';
    for (let i = 0; i < 14; i++) {
      const y = h * 0.6 + i * h * 0.03;
      waves += `<rect x="${(r() * w * 0.8).toFixed(0)}" y="${y.toFixed(0)}" width="${(w * (0.1 + r() * 0.2)).toFixed(0)}" height="3" rx="2" fill="#fff" opacity="${(0.15 + r() * 0.25).toFixed(2)}"/>`;
    }
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <circle cx="${w * 0.5}" cy="${h * 0.56}" r="${h * 0.12}" fill="${p.sun}"/>
      <rect y="${h * 0.58}" width="${w}" height="${h * 0.42}" fill="${p.mid}"/>
      <rect y="${h * 0.58}" width="${w}" height="${h * 0.42}" fill="url(#fade)"/>
      ${waves}
      <path d="${smoothHill(w, h, h * 0.92, h * 0.03, 1)}" fill="${p.near}"/>`;
  },
  flowers(r, w, h, p) {
    let f = '';
    for (let i = 0; i < 160; i++) {
      const y = h * 0.62 + Math.pow(r(), 0.7) * h * 0.38;
      const size = 4 + (y - h * 0.6) / h * 34;
      const c = p.flowers[Math.floor(r() * p.flowers.length)];
      f += `<circle cx="${(r() * w).toFixed(0)}" cy="${y.toFixed(0)}" r="${size.toFixed(1)}" fill="${c}" opacity="0.92"/>`;
    }
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <circle cx="${w * 0.2}" cy="${h * 0.2}" r="${h * 0.07}" fill="${p.sun}"/>
      <path d="${smoothHill(w, h, h * 0.55, h * 0.06, 0.5)}" fill="${p.mid}"/>
      <path d="${smoothHill(w, h, h * 0.65, h * 0.04, 2)}" fill="${p.near}"/>
      ${f}`;
  },
  night(r, w, h, p) {
    let stars = '';
    for (let i = 0; i < 140; i++) {
      stars += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h * 0.6).toFixed(0)}" r="${(0.8 + r() * 2.2).toFixed(1)}" fill="#fff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
    }
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      ${stars}
      <circle cx="${w * 0.78}" cy="${h * 0.22}" r="${h * 0.07}" fill="${p.sun}"/>
      <circle cx="${w * 0.78 + h * 0.03}" cy="${h * 0.2}" r="${h * 0.065}" fill="${p.sky[0]}"/>
      <path d="${ridge(r, w, h, h * 0.7, h * 0.12, 12)}" fill="${p.mid}"/>
      <path d="${smoothHill(w, h, h * 0.85, h * 0.04, 1)}" fill="${p.near}"/>`;
  },
  forest(r, w, h, p) {
    let trees = '';
    for (let layer = 0; layer < 3; layer++) {
      const base = h * (0.6 + layer * 0.13);
      const color = [p.far, p.mid, p.near][layer];
      for (let i = 0; i < 18 - layer * 4; i++) {
        const x = r() * w;
        const th = h * (0.18 + layer * 0.08) * (0.7 + r() * 0.6);
        const tw = th * 0.35;
        trees += `<polygon points="${x.toFixed(0)},${(base - th).toFixed(0)} ${(x - tw).toFixed(0)},${base.toFixed(0)} ${(x + tw).toFixed(0)},${base.toFixed(0)}" fill="${color}"/>`;
      }
      trees += `<rect y="${base.toFixed(0)}" width="${w}" height="${h - base}" fill="${color}"/>`;
    }
    return `<rect width="${w}" height="${h}" fill="url(#sky)"/>
      <circle cx="${w * 0.3}" cy="${h * 0.25}" r="${h * 0.06}" fill="${p.sun}" opacity="0.8"/>${trees}`;
  },
  snow(r, w, h, p) {
    let flakes = '';
    for (let i = 0; i < 120; i++) {
      flakes += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(1.5 + r() * 4).toFixed(1)}" fill="#fff" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
    }
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <path d="${ridge(r, w, h, h * 0.5, h * 0.18, 8)}" fill="${p.far}"/>
      <path d="${smoothHill(w, h, h * 0.68, h * 0.07, 0.3)}" fill="${p.mid}"/>
      <path d="${smoothHill(w, h, h * 0.82, h * 0.05, 2.4)}" fill="${p.near}"/>
      ${flakes}`;
  },
  blossom(r, w, h, p) {
    let petals = '';
    const cx = w * 0.42, cy = h * 0.38;
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * Math.min(w, h) * 0.36;
      const c = p.flowers[Math.floor(r() * p.flowers.length)];
      petals += `<circle cx="${(cx + Math.cos(a) * d * 1.3).toFixed(0)}" cy="${(cy + Math.sin(a) * d * 0.8).toFixed(0)}" r="${(10 + r() * 22).toFixed(0)}" fill="${c}" opacity="0.75"/>`;
    }
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <path d="${smoothHill(w, h, h * 0.8, h * 0.03, 1)}" fill="${p.near}"/>
      <path d="M${cx - 22} ${h * 0.82} L${cx - 10} ${cy} L${cx + 14} ${cy} L${cx + 26} ${h * 0.82} Z" fill="${p.mid}"/>
      <path d="M${cx} ${cy + 40} L${cx - w * 0.15} ${cy - 30}" stroke="${p.mid}" stroke-width="14" stroke-linecap="round"/>
      <path d="M${cx} ${cy + 20} L${cx + w * 0.17} ${cy - 50}" stroke="${p.mid}" stroke-width="12" stroke-linecap="round"/>
      ${petals}`;
  },
  dunes(r, w, h, p) {
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <circle cx="${w * 0.66}" cy="${h * 0.3}" r="${h * 0.1}" fill="${p.sun}"/>
      <path d="${smoothHill(w, h, h * 0.6, h * 0.08, 0)}" fill="${p.far}"/>
      <path d="${smoothHill(w, h, h * 0.72, h * 0.09, 2)}" fill="${p.mid}"/>
      <path d="${smoothHill(w, h, h * 0.86, h * 0.06, 4)}" fill="${p.near}"/>`;
  },
  balloons(r, w, h, p) {
    let b = '';
    for (let i = 0; i < 9; i++) {
      const x = w * (0.1 + r() * 0.8), y = h * (0.15 + r() * 0.45), rr = h * (0.04 + r() * 0.04);
      const c = p.flowers[i % p.flowers.length];
      b += `<line x1="${x.toFixed(0)}" y1="${(y + rr).toFixed(0)}" x2="${(x + (r() - 0.5) * 60).toFixed(0)}" y2="${(y + rr * 4).toFixed(0)}" stroke="#fff" stroke-opacity="0.6" stroke-width="2"/>`;
      b += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(rr * 0.85).toFixed(0)}" ry="${rr.toFixed(0)}" fill="${c}"/>`;
      b += `<ellipse cx="${(x - rr * 0.3).toFixed(0)}" cy="${(y - rr * 0.35).toFixed(0)}" rx="${(rr * 0.18).toFixed(0)}" ry="${(rr * 0.28).toFixed(0)}" fill="#fff" opacity="0.45"/>`;
    }
    return `<rect width="${w}" height="${h}" fill="url(#sky)"/>
      <path d="${smoothHill(w, h, h * 0.85, h * 0.04, 1)}" fill="${p.near}"/>${b}`;
  },
  lake(r, w, h, p) {
    const m = ridge(r, w, h, h * 0.5, h * 0.2, 8);
    return `
      <rect width="${w}" height="${h}" fill="url(#sky)"/>
      <circle cx="${w * 0.25}" cy="${h * 0.24}" r="${h * 0.07}" fill="${p.sun}"/>
      <path d="${m}" fill="${p.mid}"/>
      <rect y="${h * 0.6}" width="${w}" height="${h * 0.4}" fill="${p.far}"/>
      <g transform="translate(0 ${h * 1.2}) scale(1 -1)" opacity="0.35"><path d="${m}" fill="${p.mid}"/></g>
      <rect y="${h * 0.6}" width="${w}" height="${h * 0.4}" fill="url(#fade)"/>
      <path d="${smoothHill(w, h, h * 0.93, h * 0.02, 1)}" fill="${p.near}"/>`;
  },
};

const palettes = {
  spring:  { sky: ['#bfe3ff', '#fdf1f5'], sun: '#fff6d8', far: '#9fc7a8', mid: '#6fae7c', near: '#4e8f5c', flowers: ['#ffd1dc', '#ffb3c6', '#fff', '#ffe0ea'] },
  summer:  { sky: ['#3d9be9', '#bde6ff'], sun: '#fff3b0', far: '#5a9fcf', mid: '#1f78b4', near: '#e8d6a8', flowers: ['#ffcf3f', '#ff7b54', '#fff', '#ff4f81'] },
  sunset:  { sky: ['#2b2d6e', '#ff9a5a'], sun: '#ffd27a', far: '#7a4a7f', mid: '#4b2c55', near: '#2a1a33', flowers: ['#ffb36b', '#ff6f6f', '#ffd27a'] },
  autumn:  { sky: ['#f6c38f', '#fde9cf'], sun: '#fff1d6', far: '#d98c4a', mid: '#b5532e', near: '#7a3420', flowers: ['#e2572b', '#f2a03d', '#c23b22'] },
  winter:  { sky: ['#9fb6cf', '#e9f0f7'], sun: '#ffffff', far: '#c9d6e3', mid: '#e6edf4', near: '#ffffff', flowers: ['#fff'] },
  night:   { sky: ['#0b1433', '#2c3e7a'], sun: '#fdf6c9', far: '#1d2a55', mid: '#141d3d', near: '#0b1026', flowers: ['#fff'] },
  desert:  { sky: ['#ffb26b', '#ffe4b5'], sun: '#fff5d1', far: '#e7a660', mid: '#d48b46', near: '#b8702f', flowers: ['#fff'] },
  party:   { sky: ['#7ec8ff', '#e8f6ff'], sun: '#fff', far: '#88c999', mid: '#5fae74', near: '#7dc48a', flowers: ['#ff5d73', '#ffcf3f', '#4fc3f7', '#9b7bff', '#5ee6a0'] },
  morning: { sky: ['#a7c7e7', '#ffe9d1'], sun: '#fff7e0', far: '#8fb3c9', mid: '#5d8aa8', near: '#3f6b55', flowers: ['#fff'] },
};

// [ファイル名, 情景, 配色, 横長か]
const list = [
  ['01-spring-field', 'flowers', 'spring', true],
  ['02-summer-sea', 'sea', 'summer', true],
  ['03-autumn-hills', 'mountains', 'autumn', true],
  ['04-snowy-day', 'snow', 'winter', false],
  ['05-sakura', 'blossom', 'spring', true],
  ['06-sunset-sea', 'sea', 'sunset', true],
  ['07-starry-night', 'night', 'night', true],
  ['08-forest', 'forest', 'morning', false],
  ['09-dunes', 'dunes', 'desert', true],
  ['10-balloons', 'balloons', 'party', false],
  ['11-lake', 'lake', 'morning', true],
  ['12-sunset-mountains', 'mountains', 'sunset', true],
  ['13-autumn-forest', 'forest', 'autumn', true],
  ['14-summer-flowers', 'flowers', 'summer', false],
  ['15-winter-lake', 'lake', 'winter', true],
  ['16-birthday', 'balloons', 'spring', true],
  ['17-blue-mountains', 'mountains', 'morning', false],
  ['18-night-hills', 'night', 'night', true],
  ['19-sakura-night', 'blossom', 'sunset', true],
  ['20-morning-sea', 'sea', 'morning', true],
];

list.forEach(([name, scene, pal, landscape], i) => {
  const w = landscape ? 1600 : 1200;
  const h = landscape ? 1200 : 1600;
  const p = palettes[pal];
  const r = rng(1000 + i * 7919);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.25"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient>
</defs>${scenes[scene](r, w, h, p)}
</svg>
`;
  writeFileSync(join(outDir, `${name}.svg`), svg);
});
console.log(`${list.length} 枚を ${outDir} に書き出しました`);
