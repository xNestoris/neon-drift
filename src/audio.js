'use strict';
// All sound is synthesized with WebAudio - no asset files.
ND.audio = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const lastPlayed = {};
  const MIN_GAP = 0.035; // seconds between repeats of the same sound

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.connect(comp);
    musicBus = ctx.createGain();
    musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applySettings();
    startMusic();
  }

  function applySettings() {
    if (!ctx) return;
    const s = ND.save.data.settings;
    master.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.02);
    musicBus.gain.setTargetAtTime(s.music ? 0.32 : 0, ctx.currentTime, 0.05);
  }

  function tone({ type = 'square', f0, f1, dur, vol = 0.2, delay = 0, bus = sfxBus, at }) {
    const t = at !== undefined ? at : ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise({ dur, vol = 0.2, freq = 1000, type = 'lowpass', delay = 0, bus = sfxBus, at }) {
    const t = at !== undefined ? at : ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  const sfx = {
    shoot: () => tone({ type: 'square', f0: 900, f1: 420, dur: 0.06, vol: 0.035 }),
    enemyShoot: () => tone({ type: 'sine', f0: 520, f1: 260, dur: 0.09, vol: 0.05 }),
    hit: () => tone({ type: 'triangle', f0: 320, f1: 140, dur: 0.05, vol: 0.07 }),
    explode: () => {
      noise({ dur: 0.25, vol: 0.22, freq: 1400 });
      tone({ type: 'sine', f0: 170, f1: 45, dur: 0.22, vol: 0.18 });
    },
    bigExplode: () => {
      noise({ dur: 1.1, vol: 0.5, freq: 700 });
      tone({ type: 'sine', f0: 110, f1: 28, dur: 1.0, vol: 0.4 });
      tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 0.6, vol: 0.12 });
    },
    dash: () => {
      noise({ dur: 0.16, vol: 0.14, freq: 3200, type: 'highpass' });
      tone({ type: 'sawtooth', f0: 180, f1: 620, dur: 0.12, vol: 0.05 });
    },
    playerHit: () => {
      tone({ type: 'sawtooth', f0: 240, f1: 55, dur: 0.32, vol: 0.22 });
      noise({ dur: 0.2, vol: 0.2, freq: 900 });
    },
    shield: () => tone({ type: 'triangle', f0: 1400, f1: 500, dur: 0.25, vol: 0.14 }),
    shieldUp: () => tone({ type: 'triangle', f0: 600, f1: 1300, dur: 0.18, vol: 0.08 }),
    pickup: () => tone({ type: 'sine', f0: 700, f1: 1400, dur: 0.08, vol: 0.06 }),
    heal: () => {
      tone({ type: 'sine', f0: 523, dur: 0.1, vol: 0.1 });
      tone({ type: 'sine', f0: 784, dur: 0.14, vol: 0.1, delay: 0.07 });
    },
    upgrade: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.06 })),
    waveStart: () => tone({ type: 'sawtooth', f0: 220, f1: 440, dur: 0.35, vol: 0.08 }),
    waveClear: () => [392, 523, 659].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.14, vol: 0.06, delay: i * 0.08 })),
    bossWarn: () => [0, 0.45, 0.9].forEach(d => tone({ type: 'sawtooth', f0: 110, f1: 82, dur: 0.35, vol: 0.2, delay: d })),
    gameOver: () => [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.14, delay: i * 0.16 })),
    click: () => tone({ type: 'square', f0: 1200, dur: 0.03, vol: 0.04 }),
  };

  function play(name) {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (lastPlayed[name] !== undefined && now - lastPlayed[name] < MIN_GAP) return;
    lastPlayed[name] = now;
    sfx[name]();
  }

  // --- Music: a small step sequencer (Am - F - C - G) scheduled slightly ahead of time.
  const STEP = 0.125; // 16th notes at 120 BPM
  const ROOTS = [110, 87.31, 130.81, 98];
  const ARP = [1, 1.5, 2, 3, 2, 1.5, 2, 2.5];
  let timer = null, nextNote = 0, step = 0, intensity = 0;

  function startMusic() {
    if (!ctx || timer) return;
    nextNote = ctx.currentTime + 0.1;
    step = 0;
    timer = setInterval(schedule, 25);
  }

  function schedule() {
    if (!ND.save.data.settings.music) {
      nextNote = ctx.currentTime + 0.1;
      return;
    }
    // After a long stall (background tab) don't try to catch up on missed notes.
    if (nextNote < ctx.currentTime) nextNote = ctx.currentTime + 0.05;
    while (nextNote < ctx.currentTime + 0.12) {
      playStep(step, nextNote);
      nextNote += STEP;
      step = (step + 1) % 64;
    }
  }

  function playStep(s, t) {
    const root = ROOTS[Math.floor(s / 16)];
    const bus = musicBus;
    if (s % 2 === 0) tone({ type: 'sawtooth', f0: s % 4 === 2 ? root * 2 : root, dur: 0.11, vol: 0.12, bus, at: t });
    if (s % 4 === 0) tone({ type: 'sine', f0: 150, f1: 40, dur: 0.16, vol: intensity > 0 ? 0.5 : 0.35, bus, at: t });
    if (intensity >= 1 && s % 2 === 1) noise({ dur: 0.04, vol: 0.06, freq: 7000, type: 'highpass', bus, at: t });
    if (intensity >= 1 && s % 8 === 4) noise({ dur: 0.14, vol: 0.14, freq: 1800, bus, at: t });
    if (intensity >= 2 || (intensity >= 1 && s % 2 === 0)) {
      tone({ type: 'square', f0: root * 2 * ARP[s % 8], dur: 0.09, vol: 0.035, bus, at: t });
    }
    if (intensity === 0 && s % 16 === 0) {
      tone({ type: 'triangle', f0: root * 4, dur: 1.6, vol: 0.05, bus, at: t });
      tone({ type: 'triangle', f0: root * 4 * 1.2, dur: 1.6, vol: 0.04, bus, at: t });
    }
  }

  return {
    init,
    play,
    applySettings,
    setIntensity: v => (intensity = v),
  };
})();
