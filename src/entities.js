'use strict';
// Ships, enemies, the boss and their behaviour.
(() => {
  const { W, H } = ND;
  const U = ND.util;
  const ARENA_PAD = 8;

  ND.SHIPS = {
    striker: {
      name: 'Striker', color: '#3ef0ff', desc: 'Balanced all-rounder.',
      hp: 100, speed: 300, fireRate: 6, damage: 10, dashCd: 1.5,
    },
    wisp: {
      name: 'Wisp', color: '#ffd23e', desc: 'Fast, rapid-firing and quick to dash. Fragile.',
      hp: 70, speed: 370, fireRate: 8, damage: 8, dashCd: 0.9,
      unlock: { wave: 5, text: 'Clear wave 5 (first boss)' },
    },
    bulwark: {
      name: 'Bulwark', color: '#7dff6a', desc: 'Heavy hull, heavy rounds, starts with a shield. Slow.',
      hp: 160, speed: 245, fireRate: 4.2, damage: 17, dashCd: 2.0, shield: 1,
      unlock: { wave: 8, text: 'Clear wave 8' },
    },
    nova: {
      name: 'Nova', color: '#ff5ef0', desc: 'Starts with triple shot and seeker rounds. Low HP.',
      hp: 80, speed: 310, fireRate: 4, damage: 8, dashCd: 1.5, shots: 3, homing: 1,
      unlock: { wave: 12, text: 'Clear wave 12' },
    },
  };

  ND.makePlayer = shipId => {
    const s = ND.SHIPS[shipId];
    return {
      x: W / 2, y: H / 2, vx: 0, vy: 0, r: 13, angle: -Math.PI / 2,
      ship: shipId, color: s.color,
      hp: s.hp, maxHp: s.hp, speed: s.speed,
      fireRate: s.fireRate, damage: s.damage, bulletSpeed: 720, bulletSize: 4,
      shots: s.shots || 1, spread: 0.13, pierce: 0, crit: 0.05, homing: s.homing || 0,
      explosive: 0, rear: false,
      dashCd: s.dashCd, dashTimer: 0, dashTime: 0, dashDir: 0,
      shieldMax: s.shield || 0, shield: s.shield || 0, shieldTimer: 0,
      regen: 0, regenAcc: 0, lifesteal: 0, magnet: 90,
      orbitals: 0, orbitAngle: 0,
      fireTimer: 0, invuln: 0,
    };
  };

  // ---------------------------------------------------------------- enemies
  ND.ENEMIES = {
    chaser: { name: 'Chaser', hp: 20, speed: 135, r: 12, color: '#ff4d8d', score: 10, dmg: 12, shape: 'tri' },
    dasher: { name: 'Dasher', hp: 28, speed: 95, r: 13, color: '#ffd23e', score: 20, dmg: 18, shape: 'diamond' },
    shooter: { name: 'Gunner', hp: 34, speed: 100, r: 14, color: '#6aff9a', score: 25, dmg: 10, shape: 'square' },
    splitter: { name: 'Splitter', hp: 50, speed: 80, r: 18, color: '#ff9a3e', score: 30, dmg: 15, shape: 'hex' },
    mini: { name: 'Shard', hp: 9, speed: 175, r: 8, color: '#ffb36b', score: 5, dmg: 8, shape: 'tri' },
    tank: { name: 'Juggernaut', hp: 130, speed: 55, r: 24, color: '#b36bff', score: 60, dmg: 25, shape: 'oct' },
  };

  ND.makeEnemy = (type, x, y, mult) => {
    const d = ND.ENEMIES[type];
    const hp = d.hp * mult.hp;
    return {
      id: ND.id(), type, x, y, vx: 0, vy: 0, r: d.r,
      hp, maxHp: hp, speed: d.speed * mult.spd, dmg: d.dmg * mult.dmg,
      color: d.color, score: d.score, shape: d.shape,
      t: 0, state: 'move', stateT: U.rand(1.2, 2.2), fireT: U.rand(1.2, 2.6),
      lockAngle: 0, angle: 0, hitFlash: 0, orbitHitT: 0, strafe: Math.random() < 0.5 ? 1 : -1,
      level: mult.level || 1,
    };
  };

  ND.spawnEnemyBullet = (G, x, y, angle, speed, dmg, color = '#ff6a8a', r = 5) => {
    G.eBullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, dmg, color, life: 7 });
  };

  function steer(e, tx, ty, speed, rate, dt) {
    const k = U.approach(rate, dt);
    e.vx += (tx * speed - e.vx) * k;
    e.vy += (ty * speed - e.vy) * k;
  }

  function clampArena(e) {
    e.x = U.clamp(e.x, e.r + ARENA_PAD, W - e.r - ARENA_PAD);
    e.y = U.clamp(e.y, e.r + ARENA_PAD, H - e.r - ARENA_PAD);
  }

  ND.updateEnemy = (e, dt, G) => {
    const p = G.player;
    e.t += dt;
    e.hitFlash -= dt;
    e.orbitHitT -= dt;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;

    switch (e.type) {
      case 'chaser':
      case 'mini':
      case 'splitter':
        steer(e, nx, ny, e.speed, 3.5, dt);
        e.angle = Math.atan2(e.vy, e.vx);
        break;

      case 'tank':
        steer(e, nx, ny, e.speed, 2, dt);
        e.angle += dt * 0.6;
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = 3.2;
          const n = 8 + Math.min(8, Math.floor(G.waveNum / 4));
          for (let i = 0; i < n; i++) ND.spawnEnemyBullet(G, e.x, e.y, e.angle + (i / n) * Math.PI * 2, 170, e.dmg * 0.5, e.color, 6);
          ND.audio.play('enemyShoot');
        }
        break;

      case 'dasher':
        e.stateT -= dt;
        if (e.state === 'move') {
          steer(e, nx, ny, e.speed, 3, dt);
          e.angle = Math.atan2(ny, nx);
          if (e.stateT <= 0 && d < 520) {
            e.state = 'windup';
            e.stateT = 0.6;
          }
        } else if (e.state === 'windup') {
          steer(e, 0, 0, 0, 8, dt);
          e.lockAngle = Math.atan2(ny, nx);
          e.angle = e.lockAngle;
          if (e.stateT <= 0) {
            e.state = 'dash';
            e.stateT = 0.45;
            e.vx = Math.cos(e.lockAngle) * 640;
            e.vy = Math.sin(e.lockAngle) * 640;
          }
        } else if (e.state === 'dash') {
          if (e.stateT <= 0) {
            e.state = 'move';
            e.stateT = U.rand(1.4, 2.4);
          }
        }
        break;

      case 'shooter': {
        const want = 290;
        let tx = 0, ty = 0;
        if (d < want - 50) {
          tx = -nx;
          ty = -ny;
        } else if (d > want + 50) {
          tx = nx;
          ty = ny;
        } else {
          tx = -ny * e.strafe;
          ty = nx * e.strafe;
        }
        steer(e, tx, ty, e.speed, 2.5, dt);
        e.angle = Math.atan2(ny, nx);
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = U.rand(1.6, 2.4);
          const spread = G.waveNum >= 10 ? [-0.2, 0, 0.2] : [0];
          for (const s of spread) ND.spawnEnemyBullet(G, e.x, e.y, e.angle + s, 250, e.dmg, e.color);
          ND.audio.play('enemyShoot');
        }
        if (Math.random() < dt * 0.4) e.strafe *= -1;
        break;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    clampArena(e);
  };

  // ---------------------------------------------------------------- boss
  const BOSS_NAMES = ['OVERSEER', 'WARDEN', 'HYDRA', 'ECLIPSE', 'SINGULARITY'];
  const PATTERNS = ['burst', 'spiral', 'charge', 'summon', 'aimed'];

  ND.makeBoss = level => {
    const hp = 1100 * (1 + 0.8 * (level - 1));
    return {
      id: ND.id(), type: 'boss', isBoss: true, level,
      name: BOSS_NAMES[(level - 1) % BOSS_NAMES.length] + (level > BOSS_NAMES.length ? ' +' + Math.floor((level - 1) / BOSS_NAMES.length) : ''),
      x: W / 2, y: -70, vx: 0, vy: 0, r: 46, hp, maxHp: hp,
      color: '#ff3e5e', score: 1000 * level, dmg: 30, shape: 'boss',
      entering: true, pattern: null, patIdx: 0, patT: 0, fireT: 0, spin: 0, angle: 0,
      charge: null, hitFlash: 0, orbitHitT: 0, t: 0,
    };
  };

  function nextPattern(b, G) {
    b.pattern = PATTERNS[b.patIdx % PATTERNS.length];
    b.patIdx++;
    b.fireT = 0.4;
    const dur = { burst: 4.5, spiral: 4, charge: 99, summon: 3.2, aimed: 3.5 };
    b.patT = dur[b.pattern];
    if (b.pattern === 'charge') b.charge = { n: 2 + Math.min(2, b.level), state: 'windup', t: 0.75 };
    if (b.pattern === 'summon') {
      const n = 3 + b.level;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        G.enemies.push(ND.makeEnemy(b.level >= 3 && i % 2 ? 'dasher' : 'chaser', b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 80, G.wave.mult));
        ND.fx.ring(b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 80, '#ff4d8d', 30, 0.4);
      }
    }
  }

  ND.updateBoss = (b, dt, G) => {
    const p = G.player;
    b.t += dt;
    b.hitFlash -= dt;
    b.orbitHitT -= dt;
    b.angle += dt * 0.7;

    if (b.entering) {
      b.y += (170 - b.y) * U.approach(2.5, dt);
      if (Math.abs(b.y - 170) < 4) {
        b.entering = false;
        nextPattern(b, G);
      }
      return;
    }

    const enraged = b.hp < b.maxHp * 0.5;
    const rate = enraged ? 0.7 : 1;
    const toP = U.angleTo(b.x, b.y, p.x, p.y);
    b.patT -= dt;
    b.fireT -= dt;

    const hover = (tx, ty, speed) => {
      const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
      steer(b, dx / d, dy / d, Math.min(speed, d * 2), 2, dt);
    };

    switch (b.pattern) {
      case 'spiral':
        hover(W / 2, H / 2, 90);
        if (b.fireT <= 0) {
          b.fireT = 0.075 * rate;
          const arms = 2 + (b.level > 1 ? 1 : 0) + (enraged ? 1 : 0);
          for (let k = 0; k < arms; k++) ND.spawnEnemyBullet(G, b.x, b.y, b.spin + (k / arms) * Math.PI * 2, 200, 14, '#ff6a8a');
          b.spin += 0.21;
          ND.audio.play('enemyShoot');
        }
        break;

      case 'burst':
        hover(p.x, p.y, 55);
        if (b.fireT <= 0) {
          b.fireT = 1.0 * rate;
          const n = 14 + 4 * b.level;
          const off = (b.t * 3) % 1 * ((Math.PI * 2) / n);
          for (let i = 0; i < n; i++) ND.spawnEnemyBullet(G, b.x, b.y, off + (i / n) * Math.PI * 2, 190, 14, '#ffb36b', 6);
          ND.fx.ring(b.x, b.y, '#ffb36b', 90, 0.35);
          ND.audio.play('enemyShoot');
        }
        break;

      case 'aimed':
        hover(W / 2 + Math.cos(b.t * 0.8) * 300, 160, 140);
        if (b.fireT <= 0) {
          b.fireT = 0.42 * rate;
          const n = 3 + (enraged ? 2 : 0);
          for (let i = 0; i < n; i++) ND.spawnEnemyBullet(G, b.x, b.y, toP + (i - (n - 1) / 2) * 0.16, 330, 14, '#ff3e5e');
          ND.audio.play('enemyShoot');
        }
        break;

      case 'summon':
        hover(W / 2, 170, 80);
        break;

      case 'charge': {
        const c = b.charge;
        c.t -= dt;
        if (c.state === 'windup') {
          steer(b, 0, 0, 0, 6, dt);
          c.angle = toP;
          if (c.t <= 0) {
            c.state = 'dash';
            c.t = 0.6;
            b.vx = Math.cos(c.angle) * 720;
            b.vy = Math.sin(c.angle) * 720;
            ND.audio.play('dash');
          }
        } else if (c.state === 'dash') {
          if (Math.random() < 0.5) ND.fx.spray(b.x, b.y, c.angle + Math.PI, 0.8, '#ff3e5e', 2, 200);
          if (b.x <= b.r + ARENA_PAD || b.x >= W - b.r - ARENA_PAD) b.vx *= -1;
          if (b.y <= b.r + ARENA_PAD || b.y >= H - b.r - ARENA_PAD) b.vy *= -1;
          if (c.t <= 0) {
            c.n--;
            if (c.n > 0) {
              c.state = 'windup';
              c.t = 0.55 * rate;
            } else {
              c.state = 'recover';
              c.t = 0.6;
            }
            if (enraged) {
              for (let i = 0; i < 12; i++) ND.spawnEnemyBullet(G, b.x, b.y, (i / 12) * Math.PI * 2, 180, 14, '#ff6a8a');
            }
          }
        } else {
          steer(b, 0, 0, 0, 4, dt);
          if (c.t <= 0) b.patT = 0;
        }
        break;
      }
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    clampArena(b);

    if (b.patT <= 0) nextPattern(b, G);
  };
})();
