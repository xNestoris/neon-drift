'use strict';
// Wave director: builds each wave's enemy list from a budget and spawns it over time,
// with a short telegraph before each enemy appears.
ND.Waves = (() => {
  const { W, H } = ND;
  const U = ND.util;
  const COST = { chaser: 1, dasher: 2, shooter: 2, splitter: 3, tank: 5 };

  function weights(n) {
    return [
      { v: 'chaser', w: 10 },
      { v: 'dasher', w: n >= 2 ? 6 : 0 },
      { v: 'shooter', w: n >= 3 ? 5 : 0 },
      { v: 'splitter', w: n >= 4 ? 4 : 0 },
      { v: 'tank', w: n >= 7 ? 2 + n * 0.1 : 0 },
    ].filter(o => o.w > 0);
  }

  function build(n, budget) {
    const list = [];
    const table = weights(n);
    while (budget > 0) {
      const t = U.weighted(table);
      list.push(t);
      budget -= COST[t];
    }
    return list;
  }

  function spawnPoint(G) {
    const p = G.player;
    for (let i = 0; i < 30; i++) {
      const x = U.rand(60, W - 60), y = U.rand(60, H - 60);
      if (U.dist2(x, y, p.x, p.y) > 280 * 280) return { x, y };
    }
    // Fallback: the corner furthest from the player.
    return { x: p.x < W / 2 ? W - 60 : 60, y: p.y < H / 2 ? H - 60 : 60 };
  }

  function start(G, n) {
    const boss = n % 5 === 0;
    const budget = boss ? 4 + n : 8 + n * 4 + Math.floor(n * n * 0.15);
    G.wave = {
      n,
      boss,
      queue: build(n, budget),
      telegraphs: [],
      spawnT: boss ? 99 : 1.6, // boss waves hold minions until the boss arrives
      interval: boss ? 2.2 : Math.max(0.35, 1.25 - n * 0.05),
      bossT: 2.4,
      bossSpawned: false,
      cleared: false,
      mult: {
        hp: 1 + 0.13 * (n - 1),
        spd: 1 + Math.min(0.35, 0.025 * (n - 1)),
        dmg: 1 + 0.05 * (n - 1),
      },
    };
  }

  function update(G, dt) {
    const w = G.wave;
    if (w.boss && !w.bossSpawned) {
      w.bossT -= dt;
      if (w.bossT <= 0) {
        w.bossSpawned = true;
        const b = ND.makeBoss(w.n / 5);
        G.boss = b;
        G.enemies.push(b);
        w.spawnT = 4;
      }
    }

    w.spawnT -= dt;
    const cap = 40 + w.n * 2;
    if (w.spawnT <= 0 && w.queue.length && G.enemies.length < cap) {
      const groupMax = 2 + Math.floor(w.n / 4);
      const group = Math.min(w.queue.length, U.randInt(1, groupMax));
      const c = spawnPoint(G);
      for (let i = 0; i < group; i++) {
        const type = w.queue.shift();
        const x = U.clamp(c.x + U.rand(-50, 50), 40, W - 40);
        const y = U.clamp(c.y + U.rand(-50, 50), 40, H - 40);
        w.telegraphs.push({ type, x, y, t: 0.9, max: 0.9 });
      }
      w.spawnT = w.interval * U.rand(0.7, 1.3);
    }

    for (const t of w.telegraphs) {
      t.t -= dt;
      if (t.t <= 0) {
        G.enemies.push(ND.makeEnemy(t.type, t.x, t.y, w.mult));
        ND.fx.ring(t.x, t.y, ND.ENEMIES[t.type].color, 34, 0.3, 2);
      }
    }
    w.telegraphs = w.telegraphs.filter(t => t.t > 0);
  }

  const remaining = G => G.wave.queue.length + G.wave.telegraphs.length + G.enemies.length + (G.wave.boss && !G.wave.bossSpawned ? 1 : 0);

  const isDone = G => remaining(G) === 0;

  function describe(n) {
    if (n % 5 === 0) return 'Boss approaching';
    const intro = { 2: 'Dashers incoming', 3: 'Gunners join the fight', 4: 'Splitters break apart', 7: 'Juggernauts deployed' };
    return intro[n] || (n > 10 ? 'Hold the line' : 'Survive');
  }

  return { start, update, isDone, remaining, describe };
})();
