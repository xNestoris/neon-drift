'use strict';
// Between-wave upgrades. `max` caps how many times one can be taken.
ND.UPGRADES = [
  { id: 'rapid', name: 'Rapid Fire', icon: '»', rarity: 'common', max: 6, desc: '+20% fire rate', apply: p => (p.fireRate *= 1.2) },
  { id: 'power', name: 'Overcharge', icon: '✦', rarity: 'common', max: 6, desc: '+25% bullet damage', apply: p => (p.damage *= 1.25) },
  { id: 'hull', name: 'Reinforced Hull', icon: '⬢', rarity: 'common', max: 5, desc: '+30 max HP and repair 30 HP', apply: p => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
  { id: 'thrusters', name: 'Thrusters', icon: '➤', rarity: 'common', max: 4, desc: '+12% move speed', apply: p => (p.speed *= 1.12) },
  { id: 'rail', name: 'Rail Accelerator', icon: '═', rarity: 'common', max: 3, desc: '+30% bullet speed and +10% damage', apply: p => { p.bulletSpeed *= 1.3; p.damage *= 1.1; } },
  { id: 'magnet', name: 'Tractor Field', icon: '◎', rarity: 'common', max: 3, desc: 'Collect orbs from much further away', apply: p => (p.magnet += 80) },
  {
    id: 'repair', name: 'Nano Repair', icon: '✚', rarity: 'common', max: 99, desc: 'Fully repair your hull',
    when: p => p.hp < p.maxHp * 0.65, apply: p => (p.hp = p.maxHp),
  },
  { id: 'dash', name: 'Phase Coils', icon: '⇉', rarity: 'common', max: 3, desc: '-22% dash cooldown', apply: p => (p.dashCd *= 0.78) },
  { id: 'multi', name: 'Split Shot', icon: '⋔', rarity: 'rare', max: 4, desc: '+1 bullet per shot', apply: p => (p.shots += 1) },
  { id: 'pierce', name: 'Piercing Rounds', icon: '↠', rarity: 'rare', max: 3, desc: 'Bullets pass through +1 enemy', apply: p => (p.pierce += 1) },
  { id: 'crit', name: 'Targeting Chip', icon: '⌖', rarity: 'rare', max: 4, desc: '+12% chance to crit for double damage', apply: p => (p.crit += 0.12) },
  { id: 'shield', name: 'Deflector', icon: '◯', rarity: 'rare', max: 3, desc: 'Shield that blocks one hit, recharges every 8s (stacks)', apply: p => { p.shieldMax += 1; p.shield = p.shieldMax; } },
  { id: 'leech', name: 'Siphon', icon: '♥', rarity: 'rare', max: 3, desc: 'Repair 1 HP for every kill', apply: p => (p.lifesteal += 1) },
  { id: 'regen', name: 'Auto-Repair', icon: '↻', rarity: 'rare', max: 3, desc: 'Regenerate 1 HP every 2 seconds', apply: p => (p.regen += 0.5) },
  { id: 'rear', name: 'Rear Guard', icon: '⇅', rarity: 'rare', max: 1, desc: 'Also fire a shot straight behind you', apply: p => (p.rear = true) },
  { id: 'homing', name: 'Seeker Rounds', icon: '☄', rarity: 'epic', max: 2, desc: 'Bullets steer toward nearby enemies', apply: p => (p.homing += 1) },
  { id: 'orbital', name: 'Orbital Drone', icon: '◉', rarity: 'epic', max: 3, desc: 'A drone circles you and shreds enemies it touches', apply: p => (p.orbitals += 1) },
  { id: 'explosive', name: 'Volatile Rounds', icon: '✺', rarity: 'epic', max: 3, desc: 'Bullets explode on impact, hitting nearby enemies', apply: p => (p.explosive += 1) },
];

ND.RARITY = {
  common: { weight: 10, color: '#8fb3ff', label: 'Common' },
  rare: { weight: 5, color: '#3ef0ff', label: 'Rare' },
  epic: { weight: 2, color: '#ff5ef0', label: 'Epic' },
};

// Pick `n` distinct upgrades. `boostRare` (after a boss) favours rare/epic picks.
ND.rollUpgrades = (player, taken, n = 3, boostRare = false) => {
  let pool = ND.UPGRADES.filter(u => (taken[u.id] || 0) < u.max && (!u.when || u.when(player)));
  const out = [];
  while (out.length < n && pool.length) {
    const choice = ND.util.weighted(
      pool.map(u => ({ v: u, w: ND.RARITY[u.rarity].weight * (boostRare && u.rarity !== 'common' ? 3 : 1) })),
    );
    out.push(choice);
    pool = pool.filter(u => u !== choice);
  }
  return out;
};
