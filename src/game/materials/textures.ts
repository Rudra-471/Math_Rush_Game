import * as THREE from 'three';

/**
 * Procedural PBR-ish textures drawn on canvases at startup (offline, no downloads).
 * Each returns a cached texture; colour maps are sRGB, bump/roughness maps are linear.
 */

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function tex(key: string, c: HTMLCanvasElement, color: boolean, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  return (cache.get(key) as T) ?? make();
}

/** Deterministic pseudo-random for repeatable textures. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Speckle noise over a base colour. */
function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], size: [number, number], rnd: () => number, alpha = 1) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = size[0] + rnd() * (size[1] - size[0]);
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/** Soft stains / grime blotches. */
function grime(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, color: string, rnd: () => number, alpha = 0.08) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * w * 0.15;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * (0.5 + rnd());
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

/** Crushed-stone track ballast. */
export function ballastTex() {
  return cached('ballast', () => {
    const { c, ctx } = canvas(512, 512);
    const r = prng(1);
    ctx.fillStyle = '#3f3b37';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5200; i++) {
      const x = r() * 512, y = r() * 512, s = 3 + r() * 7;
      const v = 45 + r() * 60;
      ctx.fillStyle = `rgb(${v + 8},${v + 2},${v - 4})`;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - s * 0.2, y + s * 0.5, s, 1.5);
    }
    grime(ctx, 512, 512, 30, '#3a2a1c', r, 0.15);
    return tex('ballast', c, true, [1, 30]);
  });
}

/** Worn concrete (platforms, sleepers, walls). */
export function concreteTex(tint = '#a4a29c', key = 'concrete') {
  return cached(key, () => {
    const { c, ctx } = canvas(512, 512);
    const r = prng(2);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, 14000, ['#00000022', '#ffffff1c', '#5b585222'], [1, 2.5], r);
    grime(ctx, 512, 512, 40, '#2b2620', r, 0.1);
    grime(ctx, 512, 512, 20, '#ffffff', r, 0.05);
    // expansion joints
    ctx.strokeStyle = 'rgba(40,38,34,0.45)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= 512; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    return tex(key, c, true);
  });
}

/** Generic grayscale bump noise. */
export function bumpNoiseTex() {
  return cached('bump', () => {
    const { c, ctx } = canvas(256, 256);
    const r = prng(3);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 9000, ['#5a5a5a', '#a8a8a8', '#707070', '#909090'], [1, 3], r, 0.6);
    return tex('bump', c, false);
  });
}

/** Building facade with a window grid; some windows warm-lit (emissive map). */
export function facadeTex(kind: 'brick' | 'office' | 'concrete' | 'sandstone' | 'shop', night = false, wall?: CanvasImageSource) {
  const key = `facade-${kind}-${night ? 'n' : 'd'}${wall ? '-img' : ''}`;
  return cached(key, () => {
    const W = 256, H = 512;
    const { c, ctx } = canvas(W, H);
    const r = prng(kind.length * 31 + (night ? 7 : 0));
    const base = { brick: '#9a5a44', office: '#6f8296', concrete: '#b9b4aa', sandstone: '#d9b48a', shop: '#c9c2b6' }[kind];
    // the night variant is an emissive mask: black walls, only lit windows glow
    ctx.fillStyle = night ? '#000000' : base;
    ctx.fillRect(0, 0, W, H);
    if (night) {
      /* no wall detail */
    } else if (wall) {
      // photo-scanned CC0 wall tiled behind the window grid (128 px ≈ one texture tile)
      for (let y = 0; y < H; y += 128) for (let x = 0; x < W; x += 128) ctx.drawImage(wall, x, y, 128, 128);
    } else if (kind === 'brick') {
      for (let y = 0; y < H; y += 8) {
        for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) {
          const v = r() * 30 - 15;
          ctx.fillStyle = `rgb(${150 + v},${84 + v * 0.6},${64 + v * 0.5})`;
          ctx.fillRect(x + 1, y + 1, 14, 6);
        }
      }
    } else {
      speckle(ctx, W, H, 6000, ['#00000018', '#ffffff14'], [1, 2], r);
    }
    if (!night) grime(ctx, W, H, 18, '#1e1a16', r, 0.12);
    const cols = kind === 'office' ? 6 : 4, rows = kind === 'shop' ? 3 : 10;
    const mx = 18, my = 24;
    const cw = (W - mx * 2) / cols, rh = (H - my * 2) / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = mx + col * cw + cw * 0.14, y = my + row * rh + rh * 0.16;
        const w = cw * (kind === 'office' ? 0.9 : 0.72), h = rh * (kind === 'shop' && row === rows - 1 ? 0.8 : 0.62);
        const lit = night ? r() < 0.55 : r() < 0.06;
        // frame / sill
        ctx.fillStyle = night ? '#000000' : kind === 'sandstone' ? '#efe0c8' : 'rgba(230,230,225,0.9)';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 5);
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        if (lit) { g.addColorStop(0, '#ffe2a3'); g.addColorStop(1, '#f6b45d'); }
        else if (night) { g.addColorStop(0, '#000000'); g.addColorStop(1, '#000000'); }
        else { g.addColorStop(0, '#3e5367'); g.addColorStop(0.5, '#7d97ad'); g.addColorStop(1, '#2a3846'); }
        ctx.fillStyle = g;
        if (kind === 'sandstone') {
          ctx.beginPath();
          ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.fill();
        } else ctx.fillRect(x, y, w, h);
        if (!lit && !night) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 2, y + 2, w * 0.3, h - 4); }
        ctx.fillStyle = 'rgba(20,20,20,0.5)';
        ctx.fillRect(x + w / 2 - 1, y, 2, h);
      }
    }
    return tex(key, c, true);
  });
}

/** Roughness map for facades: glass smooth, wall rough. */
export function facadeRoughTex(kind: 'brick' | 'office' | 'concrete' | 'sandstone' | 'shop') {
  const key = `facadeR-${kind}`;
  return cached(key, () => {
    const src = facadeTex(kind, false).image as HTMLCanvasElement;
    const { c, ctx } = canvas(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const blue = d.data[i + 2] - d.data[i];
      const v = blue > 20 ? 40 : 230;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    return tex(key, c, false);
  });
}

/** Ribbed stainless steel side of a metro car with a livery stripe. */
export function trainSideTex(livery: string) {
  const key = `train-${livery}`;
  return cached(key, () => {
    const { c, ctx } = canvas(512, 256);
    const r = prng(9);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#d9dde2');
    g.addColorStop(0.5, '#b7bdc4');
    g.addColorStop(1, '#8e959d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    for (let y = 150; y < 256; y += 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, y, 512, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, y + 2, 512, 1);
    }
    ctx.fillStyle = livery;
    ctx.fillRect(0, 128, 512, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, 128, 512, 2);
    // doors
    for (const x of [96, 384]) {
      ctx.strokeStyle = 'rgba(40,44,50,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 34, 30, 68, 222);
      ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 252); ctx.stroke();
      ctx.fillStyle = '#ffb703';
      ctx.fillRect(x - 3, 150, 6, 10);
    }
    grime(ctx, 512, 256, 25, '#3b3026', r, 0.1);
    ctx.fillStyle = 'rgba(60,50,40,0.25)';
    ctx.fillRect(0, 236, 512, 20);
    return tex(key, c, true);
  });
}

/** Barrier board: reflective red/white chevrons with scuffs. */
export function hazardTex(a: string, b: string, key: string) {
  return cached(key, () => {
    const { c, ctx } = canvas(256, 64);
    const r = prng(5);
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = b;
    for (let x = -64; x < 320; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 64); ctx.lineTo(x + 24, 64); ctx.lineTo(x + 56, 0); ctx.lineTo(x + 32, 0); ctx.fill();
    }
    speckle(ctx, 256, 64, 900, ['#00000030', '#ffffff30'], [1, 2], r);
    grime(ctx, 256, 64, 10, '#2a2018', r, 0.15);
    return tex(key, c, true);
  });
}

/** Foliage: dappled leaves. */
export function leavesTex(base: string, key: string) {
  return cached(key, () => {
    const { c, ctx } = canvas(256, 256);
    const r = prng(key.length);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = r();
      ctx.fillStyle = v < 0.4 ? 'rgba(10,30,10,0.35)' : v < 0.8 ? 'rgba(120,170,70,0.3)' : 'rgba(220,240,160,0.25)';
      ctx.beginPath();
      ctx.ellipse(r() * 256, r() * 256, 2 + r() * 5, 1 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(key, c, true);
  });
}

/** Bark. */
export function barkTex() {
  return cached('bark', () => {
    const { c, ctx } = canvas(64, 256);
    const r = prng(11);
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = r() < 0.5 ? 'rgba(20,14,8,0.6)' : 'rgba(120,100,80,0.35)';
      ctx.lineWidth = 1 + r() * 2;
      const x = r() * 64;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + r() * 8 - 4, 80, x + r() * 8 - 4, 170, x, 256); ctx.stroke();
    }
    return tex('bark', c, true);
  });
}

/** Fabric weave for clothing (denim / jersey). */
export function fabricTex(color: string, key: string, denim = false) {
  return cached(key, () => {
    const { c, ctx } = canvas(128, 128);
    const r = prng(key.length * 13);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) {
      ctx.fillStyle = denim ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, y, 128, 1);
    }
    if (denim) for (let i = 0; i < 400; i++) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(r() * 128, r() * 128, 3, 1); }
    speckle(ctx, 128, 128, 1500, ['#00000012', '#ffffff10'], [1, 1.5], r);
    return tex(key, c, true, [2, 2]);
  });
}

/** Asphalt / street beside the tracks. */
export function asphaltTex() {
  return cached('asphalt', () => {
    const { c, ctx } = canvas(512, 512);
    const r = prng(21);
    ctx.fillStyle = '#3d3f43';
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, 20000, ['#2a2b2e', '#55575c', '#6a6c70'], [1, 2], r, 0.7);
    grime(ctx, 512, 512, 25, '#1a1b1d', r, 0.2);
    return tex('asphalt', c, true, [8, 40]);
  });
}
