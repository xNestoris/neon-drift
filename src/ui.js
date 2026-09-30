'use strict';
// HTML menu screens layered over the canvas. Game-level actions (play, resume, pick...)
// are forwarded to handlers registered by game.js.
ND.ui = (() => {
  const $ = id => document.getElementById(id);
  let current = null;
  let stack = [];
  let handlers = {};

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function show(name) {
    document.querySelectorAll('.screen').forEach(s => (s.hidden = s.id !== 'screen-' + name));
    current = name;
    $('ui').classList.toggle('active', !!name);
    if (name) {
      refresh(name);
      focusFirst();
    }
  }

  // Top-level screens reset the back stack.
  function showTop(name) {
    stack = [];
    show(name);
  }

  function go(name) {
    stack.push(current);
    show(name);
  }

  function back() {
    show(stack.pop() || 'menu');
  }

  function focusFirst() {
    const s = $('screen-' + current);
    const el = s && s.querySelector('button.primary:not([disabled]), button:not([disabled]), input');
    if (el) el.focus({ preventScroll: true });
  }

  function escape() {
    if (current === 'pause') handlers.resume();
    else if (current && $('screen-' + current).querySelector('[data-back]')) back();
  }

  // ------------------------------------------------------------ refreshers
  function refresh(name) {
    const d = ND.save.data;
    if (name === 'menu') {
      const ship = ND.SHIPS[d.selectedShip];
      $('menu-ship').textContent = '· ' + ship.name;
      $('menu-best').textContent = d.runs
        ? `Best score ${ND.save.best().toLocaleString()} · Best wave cleared ${d.bestCleared} · Runs ${d.runs}`
        : 'Tip: dash through danger. You are invulnerable while dashing.';
    } else if (name === 'ships') {
      $('ship-grid').innerHTML = Object.entries(ND.SHIPS)
        .map(([id, s]) => {
          const unlocked = ND.save.isUnlocked(id);
          const sel = d.selectedShip === id;
          const bars = [
            ['Hull', s.hp / 160],
            ['Speed', s.speed / 370],
            ['Firepower', (s.fireRate * s.damage * (s.shots || 1)) / 96],
            ['Dash', 0.9 / s.dashCd],
          ]
            .map(([label, v]) => `<div class="bar"><span>${label}</span><i style="--v:${Math.min(1, v).toFixed(2)}"></i></div>`)
            .join('');
          return `<button class="ship-card${sel ? ' selected' : ''}" data-ship="${id}" ${unlocked ? '' : 'disabled'} style="--c:${s.color}">
            <span class="yuv" aria-hidden="true">YUV</span>
            <strong>${esc(s.name)}</strong>
            <em>${unlocked ? esc(s.desc) : 'Locked: ' + esc(s.unlock.text)}</em>
            ${unlocked ? bars : ''}
            ${sel ? '<b class="tag">Selected</b>' : ''}
          </button>`;
        })
        .join('');
    } else if (name === 'scores') {
      const rows = d.highScores
        .map((h, i) => `<tr><td>${i + 1}</td><td>${h.score.toLocaleString()}</td><td>${h.wave}</td><td>${esc((ND.SHIPS[h.ship] || {}).name || h.ship)}</td><td>${h.date}</td></tr>`)
        .join('');
      $('scores-table').innerHTML = rows
        ? `<tr><th>#</th><th>Score</th><th>Wave</th><th>Ship</th><th>Date</th></tr>${rows}`
        : '<tr><td class="muted">No runs yet. Go make history.</td></tr>';
      $('scores-stats').textContent = `Runs ${d.runs} · Total kills ${d.totalKills.toLocaleString()} · Best wave cleared ${d.bestCleared}`;
    } else if (name === 'settings') {
      const s = d.settings;
      $('set-volume').value = Math.round(s.volume * 100);
      $('set-music').checked = s.music;
      $('set-shake').checked = s.shake;
      $('set-autofire').checked = s.autoFire;
      $('set-fps').checked = s.showFps;
      $('reset-row').hidden = false;
      $('reset-confirm').hidden = true;
    } else if (name === 'pause') {
      const b = handlers.getBuild();
      $('pause-build').innerHTML =
        `<p class="muted">Wave ${b.wave} · Score ${b.score.toLocaleString()} · ${esc(b.ship)}</p>` +
        (b.upgrades.length
          ? '<ul>' + b.upgrades.map(u => `<li style="--c:${ND.RARITY[u.rarity].color}"><span>${u.icon}</span>${esc(u.name)}${u.count > 1 ? ' ×' + u.count : ''}</li>`).join('') + '</ul>'
          : '<p class="muted">No upgrades yet.</p>');
    }
  }

  // ------------------------------------------------------------ game-driven screens
  function showUpgrade(choices, taken, title, sub) {
    $('upgrade-title').textContent = title;
    $('upgrade-sub').textContent = sub;
    $('upgrade-cards').innerHTML = choices
      .map((u, i) => {
        const r = ND.RARITY[u.rarity];
        const lvl = (taken[u.id] || 0) + 1;
        const lvlText = u.max > 1 && u.max < 99 ? `Level ${lvl} / ${u.max}` : '';
        return `<button class="card" data-action="pick" data-index="${i}" style="--c:${r.color}">
          <kbd>${i + 1}</kbd>
          <span class="icon">${u.icon}</span>
          <strong>${esc(u.name)}</strong>
          <span class="desc">${esc(u.desc)}</span>
          <span class="rarity">${r.label}${lvlText ? ' · ' + lvlText : ''}</span>
        </button>`;
      })
      .join('');
    showTop('upgrade');
  }

  function showGameOver(info) {
    const stat = (label, value) => `<div><span>${label}</span><strong>${value}</strong></div>`;
    $('go-stats').innerHTML =
      stat('Score', info.score.toLocaleString()) +
      stat('Wave', info.wave) +
      stat('Kills', info.kills) +
      stat('Time', ND.util.formatTime(info.time)) +
      stat('Best combo', info.bestCombo);
    $('go-rank').textContent = info.rank === 0 ? 'New high score!' : info.rank > 0 ? `#${info.rank + 1} on the high score table` : '';
    $('go-unlocks').textContent = info.newly.length ? 'Unlocked: ' + info.newly.map(id => ND.SHIPS[id].name).join(', ') + '!' : '';
    showTop('gameover');
  }

  // ------------------------------------------------------------ events
  function bind() {
    document.addEventListener('click', e => {
      const shipBtn = e.target.closest('[data-ship]');
      if (shipBtn && !shipBtn.disabled) {
        ND.audio.init();
        ND.audio.play('click');
        ND.save.data.selectedShip = shipBtn.dataset.ship;
        ND.save.persist();
        refresh('ships');
        const again = document.querySelector(`[data-ship="${shipBtn.dataset.ship}"]`);
        if (again) again.focus({ preventScroll: true });
        return;
      }
      const b = e.target.closest('button[data-action]');
      if (!b) return;
      ND.audio.init();
      ND.audio.play('click');
      const a = b.dataset.action;
      switch (a) {
        case 'ships':
        case 'scores':
        case 'settings':
        case 'howto':
          go(a);
          break;
        case 'back':
          back();
          break;
        case 'reset':
          $('reset-row').hidden = true;
          $('reset-confirm').hidden = false;
          $('reset-confirm').querySelector('[data-action="reset-no"]').focus();
          break;
        case 'reset-no':
          refresh('settings');
          break;
        case 'reset-yes':
          ND.save.reset();
          ND.audio.applySettings();
          refresh('settings');
          break;
        case 'pick':
          handlers.pick(Number(b.dataset.index));
          break;
        default:
          if (handlers[a]) handlers[a]();
      }
    });

    const s = () => ND.save.data.settings;
    const onSetting = (id, fn) =>
      $(id).addEventListener(id === 'set-volume' ? 'input' : 'change', e => {
        fn(e.target);
        ND.save.persist();
        ND.audio.applySettings();
      });
    onSetting('set-volume', el => (s().volume = el.value / 100));
    onSetting('set-music', el => (s().music = el.checked));
    onSetting('set-shake', el => (s().shake = el.checked));
    onSetting('set-autofire', el => (s().autoFire = el.checked));
    onSetting('set-fps', el => (s().showFps = el.checked));
  }

  // Gamepad navigation of whatever screen is showing.
  function padNav() {
    if (!current) return;
    const I = ND.input;
    const screen = $('screen-' + current);
    const items = [...screen.querySelectorAll('button:not([disabled]), input')].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    let idx = items.indexOf(document.activeElement);
    const el = items[idx];
    const isRange = el && el.type === 'range';
    const move = dir => {
      idx = idx < 0 ? 0 : (idx + dir + items.length) % items.length;
      items[idx].focus({ preventScroll: true });
    };
    if (I.wasPressed('Pad_up')) move(-1);
    if (I.wasPressed('Pad_down')) move(1);
    if (I.wasPressed('Pad_left')) {
      if (isRange) {
        el.stepDown();
        el.dispatchEvent(new Event('input'));
      } else move(-1);
    }
    if (I.wasPressed('Pad_right')) {
      if (isRange) {
        el.stepUp();
        el.dispatchEvent(new Event('input'));
      } else move(1);
    }
    if (I.wasPressed('Pad_a') && el && !isRange) el.click();
    if (I.wasPressed('Pad_b')) escape();
  }

  return {
    init(h) {
      handlers = h;
      bind();
    },
    showTop,
    hide: () => showTop(null),
    showUpgrade,
    showGameOver,
    escape,
    padNav,
    get current() {
      return current;
    },
  };
})();
