// Toggleable dev/cheat console: ~ or F1 opens, arrows navigate, Enter toggles.
// States persist to localStorage. Disable entirely with ?nocheats=1.
import { t } from './i18n.js';

const CHEATS_KEY = 'neonstrike.cheats';

export const CHEAT_DEFS = [
  { id: 'god' },
  { id: 'infiniteAmmo' },
  { id: 'noReload' },
  { id: 'instantKill' },
  { id: 'unlockAll' },
  { id: 'maxLevel' },
  { id: 'slowMotion' },
  { id: 'radarAll' },
  { id: 'infiniteGrenades' },
  { id: 'spawnWave', action: true },
  { id: 'reset', action: true },
];

export class CheatSystem {
  constructor(game, enabled) {
    this.game = game;
    this.enabled = enabled;
    this.suspended = false;   // true during multiplayer matches
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

  get enabledNow() {
    return this.enabled && !this.suspended;
  }

  is(id) {
    return this.enabledNow && !!this.flags[id];
  }

  anyActive() {
    return this.enabledNow && Object.values(this.flags).some(Boolean);
  }

  suspend(v) {
    this.suspended = v;
    if (v && this.open) this.toggleMenu(false);
    this._syncIndicator();
  }

  activeCount() {
    return Object.values(this.flags).filter(Boolean).length;
  }

  _onKey(e) {
    if (!this.enabledNow) return;
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
    if (!this.enabledNow && force !== false) return;
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
    this.game.hud.killfeed(
      t(value ? 'feed.cheatOn' : 'feed.cheatOff', { cheat: t(`cheat.${id}`) }), 'cheat');
    this._applySideEffects(id);
    this._syncIndicator();
    this._render();
  }

  _runAction(id) {
    if (id === 'reset') {
      for (const k of Object.keys(this.flags)) {
        if (this.flags[k]) this.setFlag(k, false);
      }
      this.game.hud.killfeed(t('feed.cheatsReset'), 'cheat');
    } else if (id === 'spawnWave') {
      if (this.game.playing) {
        this.game.enemies.forceNextWave();
        this.game.hud.killfeed(t('feed.waveForced'), 'cheat');
      } else {
        this.game.hud.killfeed(t('feed.startRun'), 'cheat');
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
    const on = this.enabledNow && n > 0;
    this.frameEl.classList.toggle('visible', on);
    if (on) this.badgeEl.textContent = t('cheat.active', { n });
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
        `<span class="cm-name">${t(`cheat.${c.id}`)}</span>` +
        `<span class="cm-desc">${t(`cheat.${c.id}.d`)}</span>` +
        `<span class="cm-state ${this.flags[c.id] ? 'on' : ''} ${c.action ? 'action' : ''}">${state}</span>`;
      li.classList.toggle('selected', i === this.sel);
    });
  }
}
