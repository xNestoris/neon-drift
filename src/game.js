'use strict';
// Game state, fixed-timestep loop, combat and flow between screens.
(() => {
  const { W, H } = ND;
  const U = ND.util;
  const STEP = 1 / 60;
  const COMBO_WINDOW = 2.5;

  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  const G = {
    state: 'menu', // menu | playing | paused | upgrade | dying | gameover
    player: null,
    enemies: [],
    pBullets: [],
    eBullets: [],
    orbs: [],
    boss: null,
    wave: null,
    waveNum: 0,
    score: 0,
    kills: 0,
    combo: 0,
    bestCombo: 0,
    comboT: 0,
    banner: null,
    time: 0,
    hitstop: 0,
    dyingT: 0,
    clearT: 0,
    vacuum: false,
    taken: {},
  };

  // ------------------------------------------------------------------ sizing
  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    stage.style.width = cw + 'px';
    stage.style.height = ch + 'px';
    stage.style.fontSize = Math.max(10, 16 * scale) + 'px';
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    ctx.setTransform((cw * dpr) / W, 0, 0, (ch * dpr) / H, 0, 0);
  }

  function toLogical(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  }

  // ------------------------------------------------------------------ flow
  function setState(s) {
    G.state = s;
    stage.classList.toggle('playing', s === 'playing');
  }

  function startRun() {
    ND.audio.init();
    const shipId = ND.save.isUnlocked(ND.save.data.selectedShip) ? ND.save.data.selectedShip : 'striker';
    Object.assign(G, {
      player: ND.makePlayer(shipId),
      enemies: [], pBullets: [], eBullets: [], orbs: [], boss: null,
      waveNum: 0, score: 0, kills: 0, combo: 0, bestCombo: 0, comboT: 0,
      time: 0, hitstop: 0, dyingT: 0, clearT: 0, vacuum: false, taken: {}, banner: null,
    });
    ND.fx.clear();
    ND.ui.hide();
    nextWave();
    setState('playing');
  }

  function nextWave() {
    G.waveNum++;
    ND.Waves.start(G, G.waveNum);
    G.vacuum = false;
    const boss = G.wave.boss;
    showBanner(boss ? 'WARNING' : 'WAVE ' + G.waveNum, ND.Waves.describe(G.waveNum), boss ? '#ff3e5e' : '#3ef0ff', boss ? 2.6 : 2);
    ND.audio.play(boss ? 'bossWarn' : 'waveStart');
    ND.audio.setIntensity(boss ? 2 : 1);
  }

  function showBanner(text, sub, color, max = 2) {
    G.banner = { text, sub, color, t: 0, max };
  }

  function pause() {
    if (G.state !== 'playing') return;
    setState('paused');
    ND.ui.showTop('pause');
  }

  function resume() {
    if (G.state !== 'paused') return;
    ND.ui.hide();
    if (document.activeElement) document.activeElement.blur();
    setState('playing');
  }

  function toMenu() {
    setState('menu');
    G.player = null;
    G.enemies = [];
    G.pBullets = [];
    G.eBullets = [];
    G.orbs = [];
    G.boss = null;
    G.wave = null;
    ND.fx.clear();
    ND.audio.setIntensity(0);
    ND.ui.showTop('menu');
  }

  function openUpgrade() {
    const bossWave = G.wave.boss;
    const choices = ND.rollUpgrades(G.player, G.taken, 3, bossWave);
    if (!choices.length) {
      nextWave();
      return;
    }
    G.choices = choices;
    setState('upgrade');
    ND.ui.showUpgrade(
      choices,
      G.taken,
      bossWave ? 'Boss destroyed' : `Wave ${G.waveNum} cleared`,
      bossWave ? 'Hull repaired 40%. Pick a reward.' : 'Choose an upgrade',
    );
  }

  function chooseUpgrade(i) {
    if (G.state !== 'upgrade' || !G.choices[i]) return;
    const u = G.choices[i];
    u.apply(G.player);
    G.taken[u.id] = (G.taken[u.id] || 0) + 1;
    ND.audio.play('upgrade');
    ND.fx.ring(G.player.x, G.player.y, ND.RARITY[u.rarity].color, 90, 0.5, 4);
    ND.fx.text(G.player.x, G.player.y - 30, u.name, ND.RARITY[u.rarity].color, 16, 1.2);
    ND.ui.hide();
    if (document.activeElement) document.activeElement.blur();
    setState('playing');
    nextWave();
  }

  function die() {
    const p = G.player;
    setState('dying');
    G.dyingT = 1.8;
    ND.fx.burst(p.x, p.y, p.color, 80, 420, 1.2, 4);
    ND.fx.burst(p.x, p.y, '#ffffff', 30, 250, 0.8, 3);
    ND.fx.ring(p.x, p.y, p.color, 200, 0.8, 5);
    ND.fx.addShake(26);
    ND.fx.doFlash(0.6);
    ND.audio.play('bigExplode');
    ND.audio.setIntensity(0);
  }

  function gameOver() {
    setState('gameover');
    ND.audio.play('gameOver');
    const cleared = G.waveNum - 1;
    const res = ND.save.recordRun({ score: G.score, wave: G.waveNum, cleared, ship: G.player.ship, kills: G.kills, time: G.time });
    ND.ui.showGameOver({ score: G.score, wave: G.waveNum, kills: G.kills, time: G.time, bestCombo: G.bestCombo, rank: res.rank, newly: res.newly });
  }

  function comboMult() {
    return Math.min(4, 1 + Math.floor(G.combo / 10) * 0.5);
  }

  // ------------------------------------------------------------------ combat
  function fire(p) {
    const n = p.shots;
    const spread = p.spread * (n > 3 ? 0.8 : 1);
    const shoot = a => {
      const crit = Math.random() < p.crit;
      G.pBullets.push({
        x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16,
        vx: Math.cos(a) * p.bulletSpeed, vy: Math.sin(a) * p.bulletSpeed,
        r: p.bulletSize, dmg: p.damage * (crit ? 2 : 1), crit, pierce: p.pierce, life: 1.3, hit: new Set(),
      });
    };
    for (let i = 0; i < n; i++) shoot(p.angle + (i - (n - 1) / 2) * spread);
    if (p.rear) shoot(p.angle + Math.PI);
    ND.fx.spray(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, p.angle, 0.6, p.color, 2, 160, 0.15);
    ND.audio.play('shoot');
  }

  function hurtPlayer(dmg) {
    const p = G.player;
    if (G.state !== 'playing' || p.invuln > 0 || p.dashTime > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.shieldTimer = 0;
      p.invuln = 0.6;
      ND.fx.ring(p.x, p.y, '#3ef0ff', 70, 0.4, 4);
      ND.fx.addShake(5);
      ND.audio.play('shield');
      return;
    }
    p.hp -= dmg;
    p.invuln = 1.0;
    G.combo = 0;
    G.hitstop = 0.06;
    ND.fx.burst(p.x, p.y, p.color, 20, 260);
    ND.fx.addShake(12);
    ND.fx.doFlash(0.35);
    ND.audio.play('playerHit');
    if (p.hp <= 0) {
      p.hp = 0;
      die();
    }
  }

  function damageEnemy(e, dmg, crit, kx = 0, ky = 0) {
    if (e.dead || e.entering) return;
    e.hp -= dmg;
    e.hitFlash = 0.07;
    if (!e.isBoss) {
      e.vx += kx * 0.12;
      e.vy += ky * 0.12;
    }
    if (crit) ND.fx.text(e.x, e.y - e.r - 6, 'CRIT', '#ffd23e', 12, 0.5);
    ND.audio.play('hit');
    if (e.hp <= 0) killEnemy(e);
  }

  function dropOrbs(e) {
    const shards = e.isBoss ? 24 : e.type === 'tank' ? 3 : 1;
    for (let i = 0; i < shards; i++) {
      const a = Math.random() * Math.PI * 2, s = U.rand(40, e.isBoss ? 260 : 120);
      G.orbs.push({ kind: 'shard', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 12, val: Math.ceil(e.score * 0.25 / shards) + 2 });
    }
    const healChance = e.isBoss ? 1 : e.type === 'tank' ? 0.3 : 0.06;
    const heals = e.isBoss ? 5 : Math.random() < healChance ? 1 : 0;
    for (let i = 0; i < heals; i++) {
      const a = Math.random() * Math.PI * 2, s = U.rand(30, 180);
      G.orbs.push({ kind: 'heal', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 12, val: 8 });
    }
  }

  function killEnemy(e) {
    e.dead = true;
    const p = G.player;
    G.kills++;
    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    G.comboT = COMBO_WINDOW;
    const pts = Math.round(e.score * comboMult());
    G.score += pts;
    if (p.lifesteal && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.lifesteal);
    dropOrbs(e);

    if (e.isBoss) {
      G.boss = null;
      G.score += 500 * e.level;
      G.eBullets = [];
      for (let i = 0; i < 4; i++) ND.fx.burst(e.x + U.rand(-40, 40), e.y + U.rand(-40, 40), i % 2 ? '#ffd23e' : e.color, 50, 480, 1.3, 5);
      ND.fx.ring(e.x, e.y, '#ffffff', 320, 1, 6);
      ND.fx.addShake(28);
      ND.fx.doFlash(0.5, '#ffffff');
      ND.fx.text(e.x, e.y, `+${(pts + 500 * e.level).toLocaleString()}`, '#ffd23e', 26, 1.6);
      ND.audio.play('bigExplode');
      // Clean up any minions so the wave ends with the boss.
      for (const m of G.enemies) {
        if (!m.dead && m !== e) {
          m.dead = true;
          ND.fx.burst(m.x, m.y, m.color, 10, 200);
        }
      }
      G.wave.queue = [];
      G.wave.telegraphs = [];
      return;
    }

    ND.fx.burst(e.x, e.y, e.color, e.r > 16 ? 26 : 14, e.r > 16 ? 300 : 220, 0.6, 3);
    ND.fx.ring(e.x, e.y, e.color, e.r * 2.5, 0.3, 2);
    ND.fx.addShake(e.r > 16 ? 5 : 2);
    if (G.combo >= 3 && G.combo % 10 === 0) ND.fx.text(p.x, p.y - 34, `${G.combo} COMBO!`, '#ff5ef0', 16, 1);
    ND.audio.play('explode');

    if (e.type === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const m = ND.makeEnemy('mini', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, G.wave.mult);
        m.vx = Math.cos(a) * 260;
        m.vy = Math.sin(a) * 260;
        G.enemies.push(m);
      }
    }
  }

  function nearestEnemy(x, y, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const e of G.enemies) {
      if (e.dead || e.entering) continue;
      const d = U.dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ update
  function updatePlayer(dt) {
    const p = G.player;
    const I = ND.input;
    const mv = I.move();
    p.angle = I.aim(p.x, p.y);

    if (p.dashTimer > 0) p.dashTimer -= dt;
    if (I.dashPressed() && p.dashTimer <= 0) {
      p.dashDir = mv.x || mv.y ? Math.atan2(mv.y, mv.x) : p.angle;
      p.dashTime = 0.18;
      p.dashTimer = p.dashCd;
      p.invuln = Math.max(p.invuln, 0.3);
      ND.fx.ring(p.x, p.y, p.color, 40, 0.25, 2);
      ND.audio.play('dash');
    }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.vx = Math.cos(p.dashDir) * 950;
      p.vy = Math.sin(p.dashDir) * 950;
      ND.fx.spray(p.x, p.y, p.dashDir + Math.PI, 0.5, p.color, 3, 120, 0.3, 3);
    } else {
      const k = U.approach(14, dt);
      p.vx += (mv.x * p.speed - p.vx) * k;
      p.vy += (mv.y * p.speed - p.vy) * k;
    }
    p.x = U.clamp(p.x + p.vx * dt, p.r + 8, W - p.r - 8);
    p.y = U.clamp(p.y + p.vy * dt, p.r + 8, H - p.r - 8);
    p.invuln -= dt;

    const wantsFire = ND.save.data.settings.autoFire ? G.enemies.length > 0 || I.firing() : I.firing();
    if (p.fireTimer > 0) p.fireTimer -= dt;
    if (wantsFire && p.fireTimer <= 0) {
      fire(p);
      p.fireTimer += 1 / p.fireRate;
    }

    if (p.shield < p.shieldMax) {
      p.shieldTimer += dt;
      if (p.shieldTimer >= 8) {
        p.shield++;
        p.shieldTimer = 0;
        ND.audio.play('shieldUp');
      }
    }
    if (p.regen > 0 && p.hp < p.maxHp) {
      p.regenAcc += p.regen * dt;
      if (p.regenAcc >= 1) {
        p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.regenAcc));
        p.regenAcc -= Math.floor(p.regenAcc);
      }
    }

    if (p.orbitals > 0) {
      p.orbitAngle += dt * 3.2;
      for (let i = 0; i < p.orbitals; i++) {
        const a = p.orbitAngle + (i / p.orbitals) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * 58, oy = p.y + Math.sin(a) * 58;
        for (const e of G.enemies) {
          if (e.dead || e.orbitHitT > 0) continue;
          if (U.dist2(ox, oy, e.x, e.y) < (e.r + 8) ** 2) {
            e.orbitHitT = 0.25;
            damageEnemy(e, p.damage * 1.2, false);
            ND.fx.burst(ox, oy, '#ff5ef0', 5, 120, 0.25, 2);
          }
        }
      }
    }
  }

  function updateBullets(dt) {
    const p = G.player;
    for (const b of G.pBullets) {
      if (p.homing) {
        const t = nearestEnemy(b.x, b.y, 320);
        if (t) {
          const cur = Math.atan2(b.vy, b.vx);
          let diff = Math.atan2(t.y - b.y, t.x - b.x) - cur;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          const turn = U.clamp(diff, -3.5 * p.homing * dt, 3.5 * p.homing * dt);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(cur + turn) * sp;
          b.vy = Math.sin(cur + turn) * sp;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.dead = true;
    }
    for (const b of G.eBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) b.dead = true;
    }
  }

  function updateOrbs(dt) {
    const p = G.player;
    const drag = Math.pow(0.05, dt);
    for (const o of G.orbs) {
      o.life -= dt;
      const d = Math.hypot(p.x - o.x, p.y - o.y) || 1;
      if (G.vacuum || d < p.magnet) {
        const pull = G.vacuum ? 1400 : 900;
        o.vx += ((p.x - o.x) / d) * pull * dt;
        o.vy += ((p.y - o.y) / d) * pull * dt;
      } else {
        o.vx *= drag;
        o.vy *= drag;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (d < p.r + 10) {
        o.dead = true;
        if (o.kind === 'heal') {
          p.hp = Math.min(p.maxHp, p.hp + o.val);
          ND.fx.text(p.x, p.y - 26, `+${o.val} HP`, '#7dff6a', 12, 0.7);
          ND.audio.play('heal');
        } else {
          G.score += o.val;
          ND.audio.play('pickup');
        }
      } else if (o.life <= 0) o.dead = true;
    }
  }

  function separate() {
    const es = G.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        if (a.isBoss) {
          b.x += dx * push;
          b.y += dy * push;
        } else if (b.isBoss) {
          a.x -= dx * push;
          a.y -= dy * push;
        } else {
          a.x -= dx * push * 0.5;
          a.y -= dy * push * 0.5;
          b.x += dx * push * 0.5;
          b.y += dy * push * 0.5;
        }
      }
    }
  }

  function collisions() {
    const p = G.player;
    for (const b of G.pBullets) {
      if (b.dead) continue;
      for (const e of G.enemies) {
        if (e.dead || e.entering || b.hit.has(e.id)) continue;
        if (U.dist2(b.x, b.y, e.x, e.y) > (b.r + e.r) ** 2) continue;
        b.hit.add(e.id);
        damageEnemy(e, b.dmg, b.crit, b.vx, b.vy);
        ND.fx.spray(b.x, b.y, Math.atan2(-b.vy, -b.vx), 1.2, b.crit ? '#ffd23e' : e.color, 3, 160, 0.2);
        if (p.explosive) {
          const R = 40 + 18 * p.explosive;
          ND.fx.ring(b.x, b.y, '#ffb36b', R, 0.25, 2);
          for (const o of G.enemies) {
            if (o !== e && !o.dead && U.dist2(b.x, b.y, o.x, o.y) < (R + o.r) ** 2) damageEnemy(o, b.dmg * 0.5, false);
          }
        }
        if (b.pierce > 0) b.pierce--;
        else {
          b.dead = true;
          break;
        }
      }
    }

    const hitR = p.r * 0.7;
    for (const b of G.eBullets) {
      if (!b.dead && U.dist2(b.x, b.y, p.x, p.y) < (b.r + hitR) ** 2) {
        b.dead = true;
        hurtPlayer(b.dmg);
        if (G.state !== 'playing') return;
      }
    }

    for (const e of G.enemies) {
      if (e.dead || e.entering) continue;
      const d2 = U.dist2(e.x, e.y, p.x, p.y);
      if (d2 < (e.r + p.r * 0.8) ** 2) {
        hurtPlayer(e.dmg);
        if (G.state !== 'playing') return;
        if (!e.isBoss) {
          const d = Math.sqrt(d2) || 1;
          e.vx = ((e.x - p.x) / d) * 320;
          e.vy = ((e.y - p.y) / d) * 320;
        }
      }
    }
  }

  function stepPlaying(dt) {
    G.time += dt;
    updatePlayer(dt);
    ND.Waves.update(G, dt);
    for (const e of G.enemies) (e.isBoss ? ND.updateBoss : ND.updateEnemy)(e, dt, G);
    separate();
    updateBullets(dt);
    updateOrbs(dt);
    collisions();

    G.enemies = G.enemies.filter(e => !e.dead);
    G.pBullets = G.pBullets.filter(b => !b.dead);
    G.eBullets = G.eBullets.filter(b => !b.dead);
    G.orbs = G.orbs.filter(o => !o.dead);

    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) G.combo = 0;
    }

    if (G.state !== 'playing') return; // died this step

    const w = G.wave;
    if (!w.cleared && ND.Waves.isDone(G)) {
      w.cleared = true;
      G.clearT = 1.4;
      G.vacuum = true;
      G.eBullets = [];
      const bonus = 100 * w.n;
      G.score += bonus;
      if (w.boss) G.player.hp = Math.min(G.player.maxHp, G.player.hp + G.player.maxHp * 0.4);
      showBanner(w.boss ? 'BOSS DOWN' : 'WAVE CLEARED', `+${bonus.toLocaleString()} bonus`, '#7dff6a', 1.4);
      ND.audio.play('waveClear');
      ND.audio.setIntensity(0);
    }
    if (w.cleared) {
      G.clearT -= dt;
      if (G.clearT <= 0) openUpgrade();
    }
  }

  function update(dt) {
    const I = ND.input;
    I.poll();

    if (I.pausePressed()) {
      if (G.state === 'playing') pause();
      else ND.ui.escape();
    } else if (G.state === 'upgrade') {
      for (let i = 0; i < 3; i++) if (I.wasPressed('Digit' + (i + 1)) || I.wasPressed('Numpad' + (i + 1))) chooseUpgrade(i);
    }
    if (G.state !== 'playing') ND.ui.padNav();

    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.t >= G.banner.max) G.banner = null;
    }

    if (G.state === 'playing') {
      if (G.hitstop > 0) G.hitstop -= dt;
      else stepPlaying(dt);
      ND.fx.update(dt);
    } else if (G.state === 'dying') {
      G.time += dt;
      const slow = dt * 0.35;
      for (const e of G.enemies) {
        e.x += e.vx * slow;
        e.y += e.vy * slow;
      }
      ND.fx.update(slow * 2);
      G.dyingT -= dt;
      if (G.dyingT <= 0) gameOver();
    } else if (G.state === 'menu') {
      G.time += dt;
      ND.fx.update(dt);
    }

    I.endFrame();
  }

  // ------------------------------------------------------------------ loop
  let last = performance.now(), acc = 0, fps = 60, fpsAcc = 0, fpsFrames = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 0.5) {
      fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0;
      fpsFrames = 0;
    }
    ND.render.frame(ctx, G, fps);
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ boot
  ND.game = {
    isPlaying: () => G.state === 'playing',
    comboMult,
    // Exposed for the automated smoke test (test.html).
    debug: { G, startRun, update, chooseUpgrade, hurtPlayer, STEP },
  };

  ND.ui.init({
    play: startRun,
    retry: startRun,
    resume,
    quit: toMenu,
    menu: toMenu,
    pick: chooseUpgrade,
    getBuild: () => ({
      wave: G.waveNum,
      score: G.score,
      ship: G.player ? ND.SHIPS[G.player.ship].name : '',
      upgrades: Object.entries(G.taken).map(([id, count]) => ({ ...ND.UPGRADES.find(u => u.id === id), count })),
    }),
  });
  ND.input.attach(canvas, toLogical);
  window.addEventListener('resize', resize);
  const autoPause = () => {
    if (G.state === 'playing') pause();
  };
  document.addEventListener('visibilitychange', () => document.hidden && autoPause());
  window.addEventListener('blur', autoPause);

  resize();
  toMenu();
  requestAnimationFrame(t => {
    last = t;
    frame(t);
  });
})();
