// Toggleable dev/cheat console: ~ or F1 opens, arrows navigate, Enter toggles.
// States persist to localStorage. Disable entirely with ?nocheats=1.
const CHEATS_KEY = 'neonstrike.cheats';

export const CHEAT_DEFS = [
  { id: 'god', name: 'GOD MODE', desc: 'player takes no damage' },
  { id: 'infiniteAmmo', name: 'INFINITE AMMO', desc: 'magazine never depletes' },
  { id: 'noReload', name: 'NO RELOAD', desc: 'reloads complete instantly' },
  { id: 'instantKill', name: 'INSTANT KILL', desc: 'one shot eliminates anything' },
  { id: 'unlockAll', name: 'UNLOCK ALL WEAPONS', desc: 'full arsenal regardless of rank' },
  { id: 'maxLevel', name: 'MAX LEVEL', desc: 'max rank, all perks active' },
  { id: 'slowMotion', name: 'SLOW MOTION', desc: 'cinematic 45% game speed' },
  { id: 'radarAll', name: 'FULL RADAR', desc: 'radar shows every hostile' },
  { id: 'infiniteGrenades', name: 'INFINITE GRENADES', desc: 'unlimited throwables' },
  { id: 'spawnWave', name: 'SPAWN NEXT WAVE', desc: 'force the next wave now', action: true },
  { id: 'reset', name: 'RESET ALL CHEATS', desc: 'turn everything off', action: true },
];

export class CheatSystem {
  constructor(game, enabled) {
    this.game = game;
    this.enabled = enabled;
    this.open = false;
    this.sel = 0;
    this.flags = {};
    for (const c of CHEAT_DEFS) if (!c.action) this.flags[c.id] = false;

    this.menuEl = document.getElementById('cheat-menu');
    this.listEl = document.getElementById('cheat-list');
    this.frameEl = document.getElementById('cheat-frame');
    this.badgeEl = document.getElementById('cheat-badge');

    if (this.enabled) this._load();
    this._buildList();
    this._syncIndicator();

    window.addEventListener('keydown', (e) => this._onKey(e));
  }

  _load() {
    try {
      const stored = JSON.parse(localStorage.getItem(CHEATS_KEY) || '{}');
      for (const k of Object.keys(this.flags)) {
        if (typeof stored[k] === 'boolean') this.flags[k] = stored[k];
      }
    } catch (e) { /* defaults */ }
  }

  _save() {
    try { localStorage.setItem(CHEATS_KEY, JSON.stringify(this.flags)); } catch (e) { /* ok */ }
  }

  anyActive() {
    return this.enabled && Object.values(this.flags).some(Boolean);
  }

  activeCount() {
    return Object.values(this.flags).filter(Boolean).length;
  }

  _onKey(e) {
    if (!this.enabled) return;
    if (e.code === 'Backquote' || e.code === 'F1') {
      e.preventDefault();
      this.toggleMenu();
      return;
    }
    if (!this.open) return;
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      this.sel = (this.sel + CHEAT_DEFS.length - 1) % CHEAT_DEFS.length;
      this._render();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      this.sel = (this.sel + 1) % CHEAT_DEFS.length;
      this._render();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      this.activate(CHEAT_DEFS[this.sel].id);
    }
  }

  toggleMenu(force) {
    if (!this.enabled) return;
    this.open = force !== undefined ? force : !this.open;
    this.menuEl.classList.toggle('visible', this.open);
    if (this.open) this._render();
  }

  activate(id) {
    if (!this.enabled) return;
    const def = CHEAT_DEFS.find((c) => c.id === id);
    if (!def) return;
    if (def.action) {
      this._runAction(id);
    } else {
      this.setFlag(id, !this.flags[id]);
    }
    this._render();
  }

  setFlag(id, value) {
    if (!this.enabled || !(id in this.flags)) return;
    if (this.flags[id] === value) return;
    this.flags[id] = value;
    this._save();
    const def = CHEAT_DEFS.find((c) => c.id === id);
    this.game.hud.killfeed(`CHEAT: ${def.name} ${value ? 'ON' : 'OFF'}`, 'cheat');
    this._applySideEffects(id);
    this._syncIndicator();
    this._render();
  }

  _runAction(id) {
    if (id === 'reset') {
      for (const k of Object.keys(this.flags)) {
        if (this.flags[k]) this.setFlag(k, false);
      }
      this.game.hud.killfeed('CHEATS RESET', 'cheat');
    } else if (id === 'spawnWave') {
      if (this.game.playing) {
        this.game.enemies.forceNextWave();
        this.game.hud.killfeed('CHEAT: WAVE FORCED', 'cheat');
      } else {
        this.game.hud.killfeed('START A RUN FIRST', 'cheat');
      }
    }
  }

  _applySideEffects(id) {
    const g = this.game;
    if (id === 'maxLevel' || id === 'unlockAll') {
      g.refreshPerks();
      g.hud.setRank(g.progression.rankLabel);
      g.hud.renderArsenal();
    }
    if (id === 'infiniteGrenades') {
      g.weapons.updateHud();
    }
    if (id === 'noReload' && this.flags.noReload) {
      // finish any in-flight reload instantly
      for (const w of g.weapons.weapons) {
        if (w.reloading) w.reloadTimer = 0;
      }
    }
  }

  _syncIndicator() {
    const n = this.activeCount();
    const on = this.enabled && n > 0;
    this.frameEl.classList.toggle('visible', on);
    if (on) this.badgeEl.textContent = `⚠ CHEATS ACTIVE (${n})`;
  }

  _buildList() {
    this.listEl.innerHTML = '';
    CHEAT_DEFS.forEach((c, i) => {
      const li = document.createElement('li');
      li.dataset.id = c.id;
      li.addEventListener('click', () => {
        this.sel = i;
        this.activate(c.id);
      });
      this.listEl.appendChild(li);
    });
    this._render();
  }

  _render() {
    const items = this.listEl.children;
    CHEAT_DEFS.forEach((c, i) => {
      const li = items[i];
      if (!li) return;
      const state = c.action ? '▶' : (this.flags[c.id] ? 'ON' : 'OFF');
      li.innerHTML =
        `<span class="cm-name">${c.name}</span>` +
        `<span class="cm-desc">${c.desc}</span>` +
        `<span class="cm-state ${this.flags[c.id] ? 'on' : ''} ${c.action ? 'action' : ''}">${state}</span>`;
      li.classList.toggle('selected', i === this.sel);
    });
  }
}
