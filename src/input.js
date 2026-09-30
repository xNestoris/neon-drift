'use strict';
// Keyboard, mouse and gamepad input. `pressed` holds edge-triggered presses until the
// next fixed update consumes them via endFrame().
ND.input = (() => {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: ND.W / 2, y: ND.H / 2, down: false };
  let usingPad = false;
  let pad = null;
  let padPrev = {};
  let aimAngle = 0;

  const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  function attach(canvas, toLogical) {
    window.addEventListener('keydown', e => {
      if (!e.repeat) pressed.add(e.code);
      keys.add(e.code);
      usingPad = false;
      // Keep Space/arrows from scrolling or re-clicking a focused button while playing.
      if (GAME_KEYS.includes(e.code) && ND.game && ND.game.isPlaying()) e.preventDefault();
    });
    window.addEventListener('keyup', e => keys.delete(e.code));
    window.addEventListener('blur', () => {
      keys.clear();
      mouse.down = false;
    });
    const track = e => {
      const p = toLogical(e.clientX, e.clientY);
      mouse.x = p.x;
      mouse.y = p.y;
    };
    canvas.addEventListener('mousemove', e => {
      track(e);
      usingPad = false;
    });
    canvas.addEventListener('mousedown', e => {
      track(e);
      usingPad = false;
      if (e.button === 0) mouse.down = true;
      if (e.button === 2) pressed.add('Mouse2');
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) mouse.down = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  function deadzone(x, y, d) {
    const m = Math.hypot(x, y);
    if (m < d) return { x: 0, y: 0 };
    const s = Math.min(1, (m - d) / (1 - d)) / m;
    return { x: x * s, y: y * s };
  }

  function poll() {
    pad = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) return;
    const btn = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const cur = {
      a: btn(0), b: btn(1), x: btn(2), y: btn(3), lb: btn(4), rb: btn(5), lt: btn(6), rt: btn(7),
      start: btn(9), up: btn(12), down: btn(13), left: btn(14), right: btn(15),
    };
    for (const k in cur) {
      if (cur[k] && !padPrev[k]) {
        pressed.add('Pad_' + k);
        usingPad = true;
      }
    }
    padPrev = cur;
    const ax = pad.axes;
    if (Math.hypot(ax[0] || 0, ax[1] || 0) > 0.3 || Math.hypot(ax[2] || 0, ax[3] || 0) > 0.3) usingPad = true;
  }

  function rightStick() {
    return pad ? deadzone(pad.axes[2] || 0, pad.axes[3] || 0, 0.25) : { x: 0, y: 0 };
  }

  function move() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (pad) {
      const s = deadzone(pad.axes[0] || 0, pad.axes[1] || 0, 0.2);
      x += s.x;
      y += s.y;
    }
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return { x, y };
  }

  function aim(px, py) {
    if (pad && usingPad) {
      const s = rightStick();
      if (s.x || s.y) aimAngle = Math.atan2(s.y, s.x);
      else {
        const m = move();
        if (m.x || m.y) aimAngle = Math.atan2(m.y, m.x);
      }
    } else {
      aimAngle = Math.atan2(mouse.y - py, mouse.x - px);
    }
    return aimAngle;
  }

  function firing() {
    if (pad && usingPad) {
      const s = rightStick();
      return !!(s.x || s.y) || !!padPrev.rt;
    }
    return mouse.down || keys.has('KeyJ');
  }

  const any = (...codes) => codes.some(c => pressed.has(c));

  return {
    attach,
    poll,
    move,
    aim,
    firing,
    mouse,
    get usingPad() {
      return usingPad;
    },
    wasPressed: code => pressed.has(code),
    dashPressed: () => any('Space', 'ShiftLeft', 'ShiftRight', 'KeyK', 'Mouse2', 'Pad_a', 'Pad_lb', 'Pad_rb', 'Pad_lt'),
    pausePressed: () => any('Escape', 'KeyP', 'Pad_start'),
    endFrame: () => pressed.clear(),
  };
})();
