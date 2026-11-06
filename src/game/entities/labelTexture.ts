import * as THREE from 'three';

/** Canvas-backed text label (offline — no font downloads). Redraw on change only. */
export class Label {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private last = '';

  constructor(public w = 256, public h = 160) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  draw(text: string, bg: string, fg = '#ffffff', border = '#ffffff') {
    const key = `${text}|${bg}|${fg}|${border}`;
    if (key === this.last) return;
    this.last = key;
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const r = 28;
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, r);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = border;
    ctx.stroke();
    let size = 92;
    ctx.font = `800 ${size}px Fredoka, "Baloo 2", system-ui, sans-serif`;
    while (ctx.measureText(text).width > w - 36 && size > 30) {
      size -= 6;
      ctx.font = `800 ${size}px Fredoka, "Baloo 2", system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, w / 2, h / 2 + 4);
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, h / 2 + 4);
    this.texture.needsUpdate = true;
  }

  /**
   * Answer board: frosted gradient glass panel, glossy highlight and big numerals.
   * `blur` (px) softens the text so options sharpen as the runner approaches.
   */
  drawBoard(text: string, top: string, bottom: string, blur: number, glow = 0) {
    const key = `B|${text}|${top}|${bottom}|${blur}|${glow}`;
    if (key === this.last) return;
    this.last = key;
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const r = 26;
    // panel gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, r);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.clip();
    // glass sheen
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(0.46, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
    if (glow > 0) {
      const rg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
      rg.addColorStop(0, `rgba(255,255,255,${0.25 * glow})`);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, r);
    ctx.stroke();
    // numerals
    let size = 104;
    const font = (s: number) => `700 ${s}px Fredoka, "Baloo 2", system-ui, sans-serif`;
    ctx.font = font(size);
    while (ctx.measureText(text).width > w - 40 && size > 32) {
      size -= 6;
      ctx.font = font(size);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(text, w / 2 + 3, h / 2 + 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2 + 4);
    ctx.filter = 'none';
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

/** Emoji/icon sprite texture (power-up pickups). */
export function iconTexture(icon: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.font = '64px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
