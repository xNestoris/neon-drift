'use strict';
// Persistent progress: high scores, unlocks and settings, kept in localStorage.
ND.save = (() => {
  const KEY = 'neonDrift.save.v1';

  const defaults = () => ({
    highScores: [],
    bestCleared: 0, // highest wave fully cleared; drives ship unlocks
    totalKills: 0,
    runs: 0,
    selectedShip: 'striker',
    settings: { volume: 0.7, music: true, shake: true, autoFire: false, showFps: false },
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const d = JSON.parse(raw);
      const def = defaults();
      return { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) } };
    } catch (e) {
      return defaults();
    }
  }

  let data = load();

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable (private mode etc.) - progress just won't persist */
    }
  }

  function isUnlocked(id) {
    const u = ND.SHIPS[id] && ND.SHIPS[id].unlock;
    return !u || data.bestCleared >= u.wave;
  }

  function recordRun({ score, wave, cleared, ship, kills, time }) {
    const before = Object.keys(ND.SHIPS).filter(isUnlocked);
    data.runs++;
    data.totalKills += kills;
    data.bestCleared = Math.max(data.bestCleared, cleared);
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const entry = { score, wave, ship, time: Math.round(time), date };
    data.highScores.push(entry);
    data.highScores.sort((a, b) => b.score - a.score);
    data.highScores = data.highScores.slice(0, 10);
    const rank = data.highScores.indexOf(entry); // -1 if it didn't make the table
    persist();
    const newly = Object.keys(ND.SHIPS).filter(id => isUnlocked(id) && !before.includes(id));
    return { rank, newly };
  }

  return {
    get data() {
      return data;
    },
    persist,
    isUnlocked,
    recordRun,
    best: () => (data.highScores[0] ? data.highScores[0].score : 0),
    reset() {
      data = defaults();
      persist();
    },
  };
})();
