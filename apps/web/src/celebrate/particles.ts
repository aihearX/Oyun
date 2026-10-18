/**
 * Hafif canvas parçacık motoru: konfeti, ışıltı, nota, yıldız. 60 fps; parçacık kalmayınca döngü durur.
 * Tek tam ekran canvas (pointer-events: none); DPR'ye duyarlı; üst sınır 450 parçacık.
 */
type Shape = 'rect' | 'circle' | 'star' | 'note' | 'spark' | 'ring';
interface P { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; shape: Shape; life: number; ttl: number; g: number; drag: number; wob: number; fade: boolean; grow?: number }

export const CONFETTI = ['#ffc93c', '#ff9f1c', '#ff5c8a', '#2ee6d6', '#8ef0b0', '#8b6bff', '#ffffff'];
export const GOLD = ['#ffc93c', '#ffe08a', '#fff6e5', '#ff9f1c'];

export class Particles {
  private ps: P[] = []; private raf = 0; private ctx: CanvasRenderingContext2D | null = null; private last = 0; private w = 0; private h = 0; private dpr = 1;
  constructor(private canvas: HTMLCanvasElement) { this.resize(); }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1); this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx = this.canvas.getContext('2d');
  }
  get count() { return this.ps.length; }

  private add(p: Partial<P> & { x: number; y: number }) {
    if (this.ps.length > 450) this.ps.shift();
    this.ps.push({ vx: 0, vy: 0, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10, size: 8, color: '#fff', shape: 'rect', life: 0, ttl: 1.6, g: 600, drag: 0.6, wob: Math.random() * 6.28, fade: true, ...p });
    this.start();
  }

  /** konfeti patlaması (yukarı-yana saçılır, salınarak düşer) */
  confetti(x: number, y: number, n = 80, power = 1, colors = CONFETTI) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3; const sp = (350 + Math.random() * 650) * power;
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 6 + Math.random() * 7, color: colors[i % colors.length]!, shape: Math.random() < 0.7 ? 'rect' : Math.random() < 0.5 ? 'circle' : 'star', ttl: 2 + Math.random() * 1.4, g: 520, drag: 1.4 });
    }
  }
  /** yukarıdan yağan konfeti (tüm ekran) */
  rain(n = 70, colors = CONFETTI) {
    for (let i = 0; i < n; i++) this.add({ x: Math.random() * this.w, y: -20 - Math.random() * this.h * 0.5, vx: (Math.random() - 0.5) * 80, vy: 80 + Math.random() * 160, size: 6 + Math.random() * 6, color: colors[i % colors.length]!, shape: Math.random() < 0.75 ? 'rect' : 'circle', ttl: 3.5 + Math.random(), g: 90, drag: 0.2 });
  }
  /** ışıltı: kısa ömürlü yıldızcıklar */
  sparkle(x: number, y: number, n = 14, radius = 60, colors = GOLD) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283; const sp = 60 + Math.random() * radius * 3;
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 4 + Math.random() * 7, color: colors[i % colors.length]!, shape: Math.random() < 0.6 ? 'spark' : 'star', ttl: 0.45 + Math.random() * 0.5, g: 0, drag: 3, vr: 0 });
    }
  }
  /** nota şekilleri yükselir (biyom canlandı, müzik anı) */
  notes(x: number, y: number, n = 12, colors = ['#ffffff', '#2ee6d6', '#ffc93c', '#8ef0b0']) {
    for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5) * 160, y: y + Math.random() * 40, vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 140, size: 16 + Math.random() * 12, color: colors[i % colors.length]!, shape: 'note', ttl: 1.8 + Math.random(), g: -20, drag: 0.3, vr: (Math.random() - 0.5) * 2 });
  }
  /** genişleyen ışık halkası */
  ring(x: number, y: number, color = '#ffe08a', size = 40) { this.add({ x, y, size, color, shape: 'ring', ttl: 0.5, g: 0, drag: 0, vr: 0, grow: 180 }); }

  clear() { this.ps = []; }

  private start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } }
  private frame = (t: number) => {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    const c = this.ctx; if (!c) { this.raf = 0; return; }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h);
    const alive: P[] = [];
    for (const p of this.ps) {
      p.life += dt; if (p.life >= p.ttl || p.y > this.h + 60) continue;
      p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt; p.vy += p.g * dt;
      p.wob += dt * 6; p.x += (p.vx + (p.shape === 'rect' ? Math.sin(p.wob) * 30 : 0)) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt;
      const k = p.life / p.ttl; const a = p.fade ? (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) : 1;
      c.globalAlpha = Math.max(0, a); c.fillStyle = p.color; c.strokeStyle = p.color;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      switch (p.shape) {
        case 'rect': c.scale(1, Math.abs(Math.cos(p.wob))); c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); break;
        case 'circle': c.beginPath(); c.arc(0, 0, p.size / 2.4, 0, 6.283); c.fill(); break;
        case 'star': star(c, p.size / 2); break;
        case 'spark': { const s = p.size * (1 - k * 0.6); c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.22, -s * 0.22); c.lineTo(s, 0); c.lineTo(s * 0.22, s * 0.22); c.lineTo(0, s); c.lineTo(-s * 0.22, s * 0.22); c.lineTo(-s, 0); c.lineTo(-s * 0.22, -s * 0.22); c.closePath(); c.fill(); break; }
        case 'note': c.font = `900 ${p.size}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.size > 22 ? '♫' : '♪', 0, 0); break;
        case 'ring': c.globalAlpha = Math.max(0, 1 - k); c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(0, 0, p.size, 0, 6.283); c.stroke(); break;
      }
      c.restore();
      alive.push(p);
    }
    c.globalAlpha = 1;
    this.ps = alive;
    if (alive.length) this.raf = requestAnimationFrame(this.frame); else { this.raf = 0; c.clearRect(0, 0, this.w, this.h); }
  };
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; this.ps = []; }
}

function star(c: CanvasRenderingContext2D, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
