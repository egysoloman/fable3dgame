// Persistent CoD-style progression: XP -> ranks, weapon unlocks, passive perks.
const XP_KEY = 'neonstrike.xp';

// cumulative XP required to reach rank index+1
const THRESHOLDS = [0, 1000, 2500, 5000, 8500, 13000, 19000, 26000, 35000, 46000];
export const MAX_RANK = THRESHOLDS.length;

export const PERKS = [
  { rank: 2, id: 'swift', name: 'SWIFT HANDS', desc: '20% faster reloads' },
  { rank: 4, id: 'conditioning', name: 'CONDITIONING', desc: '8% faster sprint' },
  { rank: 6, id: 'bandolier', name: 'BANDOLIER', desc: '+1 grenade, +2 capacity' },
  { rank: 8, id: 'juggernaut', name: 'JUGGERNAUT', desc: '125 max integrity' },
  { rank: 10, id: 'deadeye', name: 'DEAD EYE', desc: '+10% bullet damage' },
];

export class Progression {
  constructor(game) {
    this.game = game;
    this.xp = 0;
    try {
      this.xp = parseInt(localStorage.getItem(XP_KEY) || '0', 10) || 0;
    } catch (e) { /* private browsing */ }
  }

  rankForXp(xp) {
    let rank = 1;
    for (let i = 0; i < THRESHOLDS.length; i++) {
      if (xp >= THRESHOLDS[i]) rank = i + 1;
    }
    return rank;
  }

  get realRank() {
    return this.rankForXp(this.xp);
  }

  // effective rank: the Max Level cheat lifts everything to the cap
  get rank() {
    if (this.game.cheats && this.game.cheats.is('maxLevel')) return MAX_RANK;
    return this.realRank;
  }

  get rankLabel() {
    return this.rank >= MAX_RANK ? 'MAX' : String(this.rank);
  }

  nextThreshold() {
    const r = this.realRank;
    return r >= MAX_RANK ? null : THRESHOLDS[r];
  }

  addXp(n) {
    const before = this.realRank;
    this.xp += Math.max(0, Math.round(n));
    try { localStorage.setItem(XP_KEY, String(this.xp)); } catch (e) { /* ok */ }
    const after = this.realRank;
    if (after > before) this.game.onRankUp(after);
  }

  hasPerk(id) {
    const perk = PERKS.find((p) => p.id === id);
    return !!perk && this.rank >= perk.rank;
  }

  isUnlocked(def) {
    if (this.game.cheats && this.game.cheats.is('unlockAll')) return true;
    return (def.unlockRank || 1) <= this.rank;
  }

  // perk-derived stats
  reloadMul() { return this.hasPerk('swift') ? 0.8 : 1; }
  sprintMul() { return this.hasPerk('conditioning') ? 1.08 : 1; }
  grenadeBonus() { return this.hasPerk('bandolier') ? 1 : 0; }
  grenadeCapBonus() { return this.hasPerk('bandolier') ? 2 : 0; }
  maxHp() { return this.hasPerk('juggernaut') ? 125 : 100; }
  damageMul() { return this.hasPerk('deadeye') ? 1.1 : 1; }

  // first still-locked weapon, for "next unlock" hints
  nextUnlock(defs) {
    const locked = defs
      .filter((d) => !d.streakOnly)
      .filter((d) => (d.unlockRank || 1) > this.realRank)
      .sort((a, b) => a.unlockRank - b.unlockRank);
    return locked[0] || null;
  }
}
