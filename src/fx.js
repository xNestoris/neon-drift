'use strict';
// Particles, shockwave rings, floating text, screen shake and flash.
ND.fx = {
  parts: [],
  rings: [],
  texts: [],
  shake: 0,
  flash: 0,
  flashColor: '#ff3e5e',
  MAX_PARTS: 1400,

  burst(x, y, color, n = 12, speed = 220, life = 0.55, size = 3) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.MAX_PARTS) this.parts.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      const l = life * (0.6 + Math.random() * 0.6);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, color, size: size * (0.6 + Math.random() * 0.8) });
    }
  },

  // Directed spray, e.g. muzzle flash or dash trail.
  spray(x, y, angle, spread, color, n, speed, life = 0.3, size = 2) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.MAX_PARTS) this.parts.shift();
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size });
    }
  },

  ring(x, y, color, radius = 60, life = 0.4, width = 3) {
    this.rings.push({ x, y, color, radius, life, max: life, width });
  },

  text(x, y, str, color = '#fff', size = 16, life = 0.8) {
    this.texts.push({ x, y, str, color, size, life, max: life });
  },

  addShake(amount) {
    if (!ND.save.data.settings.shake) return;
    this.shake = Math.min(28, this.shake + amount);
  },

  doFlash(amount, color = '#ff3e5e') {
    this.flash = Math.max(this.flash, amount);
    this.flashColor = color;
  },

  update(dt) {
    const drag = Math.pow(0.04, dt);
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.life -= dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    for (const t of this.texts) {
      t.y -= 40 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter(t => t.life > 0);
    this.shake *= Math.pow(0.002, dt);
    if (this.shake < 0.1) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 1.6);
  },

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * k);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    for (const r of this.rings) {
      const k = r.life / r.max;
      ctx.globalAlpha = k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * k + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (1 - k * k * 0.9), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
      ctx.font = `700 ${t.size}px Orbitron, "Segoe UI", sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  },

  clear() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
  },
};
