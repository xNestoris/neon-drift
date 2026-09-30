'use strict';
// Shared namespace. Plain scripts (not ES modules) so the game runs from file:// with no server.
const ND = (window.ND = {});
ND.W = 1280;
ND.H = 720;

let nextId = 1;
ND.id = () => nextId++;

ND.util = {
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  dist2: (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  },
  angleTo: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
  // Framerate-independent approach factor: fraction of the gap closed this step.
  approach: (rate, dt) => 1 - Math.exp(-rate * dt),
  weighted(list) {
    let total = 0;
    for (const o of list) total += o.w;
    let r = Math.random() * total;
    for (const o of list) {
      r -= o.w;
      if (r <= 0) return o.v;
    }
    return list[list.length - 1].v;
  },
  formatTime(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  },
};
