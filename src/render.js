'use strict';
// Canvas drawing for the world and the HUD. Glow is faked by stroking each shape twice
// (a wide translucent pass, then a thin bright one), which is much cheaper than shadowBlur.
ND.render = (() => {
  const { W, H } = ND;
  const TAU = Math.PI * 2;
  const FONT = 'Orbitron, "Segoe UI", sans-serif';
  let vignette = null;
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));

  function poly(ctx, x, y, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * TAU;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function glow(ctx, color, width, fillAlpha) {
    if (fillAlpha) {
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = width * 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function background(ctx, t, pulse) {
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      const y = (s.y + t * 12 * s.z) % H;
      ctx.globalAlpha = 0.25 + 0.5 * s.z;
      ctx.fillStyle = '#8fb3ff';
      ctx.fillRect(s.x, y, s.z * 2, s.z * 2);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(62, 120, 255, ${0.08 + pulse * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(4, 4, W - 8, H - 8);
    glow(ctx, `rgba(62, 240, 255, ${0.5 + pulse * 0.5})`, 2);
  }

  function drawVignette(ctx) {
    if (!vignette) {
      vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function enemyShape(ctx, e) {
    switch (e.shape) {
      case 'tri':
        poly(ctx, e.x, e.y, e.r, 3, e.angle);
        break;
      case 'diamond':
        poly(ctx, e.x, e.y, e.r, 4, e.angle);
        break;
      case 'square':
        poly(ctx, e.x, e.y, e.r, 4, e.angle + Math.PI / 4);
        break;
      case 'hex':
        poly(ctx, e.x, e.y, e.r, 6, e.t);
        break;
      case 'oct':
        poly(ctx, e.x, e.y, e.r, 8, e.angle);
        break;
    }
  }

  function drawEnemy(ctx, e) {
    const color = e.hitFlash > 0 ? '#ffffff' : e.color;
    if (e.type === 'dasher' && e.state === 'windup') {
      // Telegraph the charge direction.
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.lockAngle) * 290, e.y + Math.sin(e.lockAngle) * 290);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    enemyShape(ctx, e);
    glow(ctx, color, 2, 0.15);
    if (e.type === 'shooter' || e.type === 'tank') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.35, 0, TAU);
      glow(ctx, color, 1.5);
    }
    if (e.hp < e.maxHp && e.maxHp > 40) {
      const w = e.r * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w, 3);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w * Math.max(0, e.hp / e.maxHp), 3);
    }
  }

  function drawBoss(ctx, b) {
    // The boss is hit constantly, so it brightens its fill instead of flashing white.
    const color = b.color;
    const fill = b.hitFlash > 0 ? 0.4 : 0.12;
    if (b.pattern === 'charge' && b.charge && b.charge.state === 'windup' && b.charge.angle !== undefined) {
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(b.t * 30);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.r * 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.charge.angle) * 700, b.y + Math.sin(b.charge.angle) * 700);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    poly(ctx, b.x, b.y, b.r, 6, b.angle);
    glow(ctx, color, 3, fill);
    poly(ctx, b.x, b.y, b.r * 0.62, 6, -b.angle * 1.5);
    glow(ctx, color, 2);
    const enraged = b.hp < b.maxHp * 0.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.22 + Math.sin(b.t * (enraged ? 14 : 6)) * 3, 0, TAU);
    glow(ctx, enraged ? '#ffd23e' : '#ffffff', 2, 0.6);
  }

  function drawPlayer(ctx, p, G) {
    if (p.invuln > 0 && p.dashTime <= 0 && Math.floor(G.time * 20) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    glow(ctx, p.dashTime > 0 ? '#ffffff' : p.color, 2, 0.25);
    ctx.restore();
    if (p.shield > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 10, 0, TAU);
      glow(ctx, '#3ef0ff', 1.5, 0.05 * p.shield);
    }
    for (let i = 0; i < p.orbitals; i++) {
      const a = p.orbitAngle + (i / p.orbitals) * TAU;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, 7, 0, TAU);
      glow(ctx, '#ff5ef0', 2, 0.4);
    }
  }

  function drawCrosshair(ctx, x, y) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(x + dx * 5, y + dy * 5);
      ctx.lineTo(x + dx * 14, y + dy * 14);
    }
    ctx.stroke();
  }

  function bar(ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,0.12)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  function text(ctx, str, x, y, size, color, align = 'left', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function hud(ctx, G) {
    const p = G.player;
    const hpFrac = p.hp / p.maxHp;
    const hpColor = hpFrac > 0.5 ? '#3ef0ff' : hpFrac > 0.25 ? '#ffd23e' : '#ff3e5e';
    bar(ctx, 20, 20, 240, 14, hpFrac, hpColor);
    text(ctx, `HULL ${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`, 24, 44, 11, '#cfe3ff');
    for (let i = 0; i < p.shieldMax; i++) {
      ctx.beginPath();
      ctx.arc(272 + i * 18, 27, 6, 0, TAU);
      ctx.strokeStyle = '#3ef0ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (i < p.shield) {
        ctx.fillStyle = '#3ef0ff';
        ctx.fill();
      }
    }
    const dashReady = p.dashTimer <= 0;
    bar(ctx, 20, 56, 120, 5, dashReady ? 1 : 1 - p.dashTimer / p.dashCd, dashReady ? '#ffd23e' : 'rgba(255,210,62,0.5)');
    text(ctx, dashReady ? 'DASH READY' : 'DASH', 148, 59, 10, dashReady ? '#ffd23e' : '#8a96b8');

    text(ctx, G.score.toLocaleString(), W - 20, 28, 26, '#ffffff', 'right', 900);
    text(ctx, `BEST ${Math.max(ND.save.best(), G.score).toLocaleString()}`, W - 20, 52, 11, '#8a96b8', 'right');
    if (G.combo >= 3) {
      const mult = ND.game.comboMult();
      ctx.globalAlpha = Math.min(1, G.comboT / 0.5);
      text(ctx, `${G.combo} COMBO  ×${mult.toFixed(1)}`, W - 20, 74, 14, '#ff5ef0', 'right');
      bar(ctx, W - 160, 86, 140, 3, G.comboT / 2.5, '#ff5ef0');
      ctx.globalAlpha = 1;
    }

    text(ctx, `WAVE ${G.waveNum}`, W / 2, 24, 16, '#cfe3ff', 'center', 900);
    const left = ND.Waves.remaining(G);
    if (left > 0) text(ctx, `${left} hostile${left === 1 ? '' : 's'} left`, W / 2, 44, 11, '#8a96b8', 'center');

    if (G.boss) {
      const b = G.boss;
      const bw = 560, bx = (W - bw) / 2, by = H - 34;
      text(ctx, b.name, W / 2, by - 12, 12, '#ff3e5e', 'center', 900);
      bar(ctx, bx, by, bw, 10, b.hp / b.maxHp, b.hp < b.maxHp * 0.5 ? '#ffd23e' : '#ff3e5e');
    }
  }

  function banner(ctx, G) {
    const bn = G.banner;
    if (!bn) return;
    const k = bn.t / bn.max;
    const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.globalAlpha = Math.max(0, a);
    const y = H * 0.36;
    ctx.fillStyle = 'rgba(5,6,15,0.55)';
    ctx.fillRect(0, y - 44, W, 88);
    text(ctx, bn.text, W / 2, y - 8, 44, bn.color, 'center', 900);
    if (bn.sub) text(ctx, bn.sub, W / 2, y + 28, 14, '#cfe3ff', 'center', 500);
    ctx.globalAlpha = 1;
  }

  function world(ctx, G) {
    const pulse = G.boss ? 0.5 + 0.5 * Math.sin(G.time * 4) : 0;
    background(ctx, G.time, pulse);
    if (!G.player) return;

    if (G.wave) {
      for (const t of G.wave.telegraphs) {
        const k = 1 - t.t / t.max;
        const c = ND.ENEMIES[t.type].color;
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(k * 12));
        ctx.beginPath();
        ctx.arc(t.x, t.y, 22 * (1.4 - k * 0.6), 0, TAU);
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(t.x - 6, t.y - 6);
        ctx.lineTo(t.x + 6, t.y + 6);
        ctx.moveTo(t.x + 6, t.y - 6);
        ctx.lineTo(t.x - 6, t.y + 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const o of G.orbs) {
      if (o.life < 3 && Math.floor(o.life * 8) % 2 === 0) continue;
      ctx.beginPath();
      if (o.kind === 'heal') {
        ctx.arc(o.x, o.y, 6, 0, TAU);
        glow(ctx, '#7dff6a', 1.5, 0.6);
      } else {
        poly(ctx, o.x, o.y, 4.5, 4, G.time * 3);
        glow(ctx, '#8fd8ff', 1.2, 0.6);
      }
    }

    for (const e of G.enemies) (e.isBoss ? drawBoss : drawEnemy)(ctx, e);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.pBullets) {
      ctx.strokeStyle = b.crit ? '#ffd23e' : G.player.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = b.r * 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.7, 0, TAU);
      ctx.fill();
    }
    for (const b of G.eBullets) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (G.state !== 'gameover' && !(G.state === 'dying')) drawPlayer(ctx, G.player, G);
  }

  function frame(ctx, G, fps) {
    ctx.save();
    const sh = ND.fx.shake;
    if (sh > 0) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    world(ctx, G);
    ND.fx.draw(ctx);
    ctx.restore();
    drawVignette(ctx);

    if (G.player && G.state !== 'menu') {
      hud(ctx, G);
      banner(ctx, G);
      if (G.state === 'playing' && !ND.input.usingPad) drawCrosshair(ctx, ND.input.mouse.x, ND.input.mouse.y);
    }
    if (ND.fx.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, ND.fx.flash);
      ctx.fillStyle = ND.fx.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (ND.save.data.settings.showFps) text(ctx, `${fps} FPS`, 20, H - 16, 10, '#8a96b8');
  }

  return { frame };
})();
