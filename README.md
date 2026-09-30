# Neon Drift

A wave-survival arena shooter that runs in any modern browser. There's no install and no build step, and every sound is synthesized with WebAudio.

Fly a neon ship, survive waves of enemies that get harder each round, and pick an upgrade after every wave. Every 5th wave brings a boss.

## Play

- **Locally:** open `index.html` in a browser (double-click works; no server needed).
- **Online:** if GitHub Pages is enabled for this repo, play at `https://<user>.github.io/neon-drift/`.

## Controls

| Action | Keyboard & mouse | Gamepad |
|---|---|---|
| Move | WASD / arrow keys | Left stick |
| Aim | Mouse | Right stick |
| Fire | Hold left click (or J) | Right stick / RT |
| Dash (brief invulnerability) | Space / Shift / right click | A / bumpers |
| Pause | Esc / P | Start |
| Pick upgrade | Click or 1 / 2 / 3 | D-pad + A |

Settings include volume, music, screen shake, auto-fire and an FPS counter.

## Features

- **6 enemy types:** chasers, dashers that telegraph their charge, gunners, splitters, shards and bullet-ring juggernauts.
- **Bosses every 5 waves.** Each has five attack patterns (burst, spiral, charge, summon, aimed) and an enraged phase below 50% HP.
- **18 upgrades** across common, rare and epic rarities, including split shot, piercing, crits, shields, siphon, orbital drones, explosive and seeker rounds.
- **4 ships:** Striker, plus Wisp, Bulwark and Nova, which unlock when you clear waves 5, 8 and 12.
- **Combo multiplier** up to ×4, score shards and repair orbs.
- **Saved progress:** top 10 high scores, unlocks and settings are kept in `localStorage`.
- **Polish:** particles, screen shake, hit-stop, glow rendering, and a procedural soundtrack that intensifies in combat.

## Project layout

```
index.html      markup for the canvas and menu screens
style.css       menu/overlay styling
src/util.js     namespace + math helpers
src/save.js     localStorage persistence (scores, unlocks, settings)
src/input.js    keyboard, mouse, gamepad
src/audio.js    synthesized SFX + step-sequencer music
src/fx.js       particles, rings, floating text, shake
src/entities.js ships, enemy AI, boss patterns
src/upgrades.js upgrade definitions and rolling
src/waves.js    wave budgets, spawning, telegraphs
src/ui.js       HTML screens and gamepad menu navigation
src/render.js   canvas drawing and HUD
src/game.js     state machine, fixed-timestep loop, combat
test.html       headless smoke test (bot plays 10 waves, dies, checks save)
```

The scripts are plain (non-module) files that share a global `ND` namespace, so the game works straight from `file://`.

## Testing

Open `test.html` in a browser, or run it headless:

```
msedge --headless=new --dump-dom file:///path/to/neon-drift/test.html
```

The `#result` block reports `"ok": true` when a bot gets through 10 waves (including two bosses), pause and resume, death, game over and saving without errors.
