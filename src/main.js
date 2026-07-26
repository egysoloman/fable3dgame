import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { WeaponSystem, ATTACHMENTS, WEAPON_DEFS, THROWABLES, DEFAULT_LOADOUT,
  saveLoadout, loadPresets, savePresets } from './weapons.js';
import { EnemyManager } from './enemies.js';
import { PickupManager } from './pickups.js';
import { Effects } from './effects.js';
import { AudioFX } from './audio.js';
import { HUD } from './hud.js';
import { Progression, PERKS } from './progression.js';
import { CheatSystem } from './cheats.js';
import { Multiplayer } from './mp.js';
import { SoldierManager } from './soldiers.js';
import { DominationManager } from './domination.js';
import { TdmManager } from './tdm.js';
import { CtfManager, HardpointManager, GunGameManager, SndManager,
  InfectionManager } from './modes.js';
import { BotMatch, DIFFICULTY } from './bots.js';
import { Warfare, OrbitalRailgun, EQUIP_DEFS, loadEquip, saveEquip } from './warfare.js';
import { t, setLang, getLang, nextLang, applyDom, LANG_LABELS } from './i18n.js';

const BEST_KEY = 'neonstrike.best';
const SETTINGS_KEY = 'neonstrike.settings';

// Production kill-switch for the dev console: serve with ?nocheats=1
const CHEATS_ENABLED = new URLSearchParams(location.search).get('nocheats') !== '1';

const STREAK_REWARDS = {
  5: { bonus: 250, resupply: true, key: 'streakr.resupply' },
  7: { bonus: 400, orbital: true, key: 'streakr.railgun' },
  10: { bonus: 750, refill: true },
  12: { bonus: 1000, heli: true, key: 'streakr.heli' },
  15: { bonus: 2000, refill: true },
  20: { bonus: 4000, refill: true },
};
const SETUP_KEY = 'neonstrike.setup';

class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | gameover
    this.score = 0;
    this.kills = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.cheatsUsedThisRun = false;
    this.menuTime = 0;
    this.mpOverlay = false;

    this.settings = { sensitivity: 1, volume: 0.7, quality: 'high' };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
    } catch (e) { /* defaults */ }
    if (!['low', 'medium', 'high'].includes(this.settings.quality)) {
      this.settings.quality = 'high';
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
    this.applyQuality();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.05, 300);
    this.scene.add(this.camera);

    // fill light so the first-person weapon reads in dark corners
    const viewLight = new THREE.PointLight(0xbfe4ff, 2.2, 3.5, 2);
    viewLight.position.set(0.25, -0.05, -0.35);
    this.camera.add(viewLight);

    this.audio = new AudioFX();
    this.hud = new HUD();
    this.hud.game = this;
    this.progression = new Progression(this);
    this.world = new World(this.scene);
    this.player = new Player(this);
    this.effects = new Effects(this);
    this.weapons = new WeaponSystem(this);
    this.enemiesSolo = new EnemyManager(this);
    this.enemies = this.enemiesSolo;
    this.pickups = new PickupManager(this);
    this.cheats = new CheatSystem(this, CHEATS_ENABLED);
    this.mp = new Multiplayer(this);
    this.soldiers = new SoldierManager(this);
    this.domination = new DominationManager(this);
    this.tdm = new TdmManager(this);
    this.ctf = new CtfManager(this);
    this.hardpoint = new HardpointManager(this);
    this.gungame = new GunGameManager(this);
    this.snd = new SndManager(this);
    this.infection = new InfectionManager(this);
    this.botMatch = new BotMatch(this);
    this.warfare = new Warfare(this);
    this.orbital = new OrbitalRailgun(this);
    this.smokes = [];
    this.fires = [];
    this.mode = 'survival';
    this.setup = { mode: 'survival', map: 'arena', difficulty: 'normal', equip: loadEquip() };
    try {
      const st = JSON.parse(localStorage.getItem(SETUP_KEY) || '{}');
      if (st.mode) this.setup.mode = st.mode;
      if (st.map) this.setup.map = st.map;
      if (DIFFICULTY[st.difficulty]) this.setup.difficulty = st.difficulty;
    } catch (e) { /* defaults */ }
    this.matchDifficulty = 'normal';
    this.applyQuality(); // again now that the world (and its sun) exists
    this.ui = this._buildUi();

    this.weapons.rig.visible = false;
    applyDom();
    this.hud.renderArsenal();
    this.ui.syncLangButton();

    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- pointer lock ---
    document.addEventListener('pointerlockchange', () => {
      const locked = this.pointerLocked;
      if (!locked && this.state === 'playing') {
        if (this.mp.active) this._showMpOverlay();
        else this.pause();
      } else if (locked) {
        if (this.state === 'paused') this.resumePlaying();
        else if (this.mpOverlay) this._hideMpOverlay();
      }
    });

    document.getElementById('start-btn').addEventListener('click', () => {
      this.audio.init();
      this.applyVolume();
      this.ui.showSetup();
    });
    document.getElementById('deploy-btn').addEventListener('click', () => {
      this.startRun();
      this.requestLock();
    });
    document.getElementById('setup-back-btn').addEventListener('click', () => {
      this.ui.showMenu();
    });
    document.getElementById('restart-btn').addEventListener('click', () => {
      this.audio.init();
      this.applyVolume();
      this.startRun();
      this.requestLock();
    });
    document.getElementById('resume-btn').addEventListener('click', () => {
      this.audio.init();
      this.requestLock();
      // resumePlaying happens on pointerlockchange; fall back for
      // environments where pointer lock is unavailable
      setTimeout(() => {
        if (!this.pointerLocked) {
          if (this.state === 'paused') this.resumePlaying();
          else if (this.mpOverlay) this._hideMpOverlay();
        }
      }, 250);
    });
    document.getElementById('pause-leave-btn').addEventListener('click', () => {
      this._hideMpOverlay();
      this.mp.leaveMatch();
    });

    // Recovery paths for playing without pointer lock (e.g. resume clicked
    // during the browser's ~1.25s re-lock cooldown after Esc): click re-locks,
    // Esc still pauses.
    this.renderer.domElement.addEventListener('mousedown', () => {
      if (this.state === 'playing' && !this.pointerLocked && !this.mpOverlay) this.requestLock();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing' && !this.pointerLocked) {
        if (this.mp.active) this._showMpOverlay();
        else this.pause();
      }
    });

    // Keep crouch/reload/switch combos (Ctrl+W/R/1-8...) from triggering
    // browser shortcuts, and guard against accidental tab close mid-run.
    const GAME_KEYS = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyG', 'KeyC', 'KeyE', 'KeyV', 'KeyF', 'Space',
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
      'Digit9', 'Digit0',
    ]);
    window.addEventListener('keydown', (e) => {
      if (this.playing && GAME_KEYS.has(e.code)) e.preventDefault();
    });
    window.addEventListener('beforeunload', (e) => {
      if (this.state === 'playing' || this.state === 'paused') {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    this._wireSettings();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------------- UI controller (menus, lobby, language) ----------------
  _buildUi() {
    const game = this;
    const $ = (id) => document.getElementById(id);

    const ui = {
      syncLangButton() {
        const btn = $('lang-btn');
        btn.textContent = LANG_LABELS[nextLang()];
        btn.classList.toggle('visible', game.state !== 'playing');
      },
      refreshText() {
        applyDom();
        game.hud.renderArsenal();
        game.weapons.updateHud();
        game.hud.setRank(game.progression.rankLabel);
        game.cheats._render();
        ui.syncLangButton();
        if (document.getElementById('loadout-screen').classList.contains('visible')) {
          ui.renderLoadout();
        }
      },
      showMenu() {
        game.state = 'menu';
        game.hud.hide();
        game.hud.screen('menu');
        game.hud.renderArsenal();
        ui.syncLangButton();
      },
      showMpBrowser() {
        game.hud.screen('mp');
        ui.mpStatus('');
        game.mp.listRooms();
      },
      showLobby() {
        if (game.mp.room) ui.renderLobby(game.mp.room);
        else ui.showMpBrowser();
      },
      mpStatus(text) {
        $('mp-status').textContent = text || '';
      },
      setServerStatus(state, detail) {
        const badge = $('server-status');
        badge.className = `status-badge ${state}`;
        badge.textContent = t(`server.${state}`);
        const btn = $('server-connect-btn');
        btn.textContent = t(state === 'connected' ? 'server.disconnect' : 'server.connect');
        if (detail === 'badAddress') ui.mpStatus(t('server.badAddress'));
      },
      showSetup() {
        game.hud.screen('setup');
        ui.renderSetup();
      },
      showLoadout(returnTo) {
        ui._loadoutReturn = returnTo || 'menu';
        game.hud.screen('loadout');
        ui.renderSetup();       // attach/equip pickers live on this screen
        ui.renderLoadout();
      },
      loadoutSummary() {
        const l = game.weapons.loadout;
        return `${t(`weapon.${l.primary}`)} · ${t(`weapon.${l.secondary}`)} · ` +
          t(`throw.${l.throwable}`);
      },
      renderLoadout() {
        const w = game.weapons;
        const cats = [
          ['primary', WEAPON_DEFS.filter((d) => d.cat === 'primary')],
          ['secondary', WEAPON_DEFS.filter((d) => d.cat === 'secondary')],
          ['throwable', Object.values(THROWABLES)],
        ];
        for (const [cat, defs] of cats) {
          const list = $(`lo-${cat}`);
          list.innerHTML = '';
          for (const def of defs) {
            const row = document.createElement('button');
            row.className = 'lo-row';
            const isThrow = cat === 'throwable';
            const locked = !isThrow && !game.progression.isUnlocked(def);
            if (w.loadout[cat] === def.id) row.classList.add('sel');
            if (locked) row.classList.add('locked');
            const name = document.createElement('span');
            name.textContent = isThrow ? t(`throw.${def.id}`) : t(`weapon.${def.id}`);
            const cls = document.createElement('span');
            cls.className = 'cls';
            cls.textContent = locked
              ? t('loadout.locked', { n: def.unlockRank })
              : (isThrow ? t(`throw.${def.id}.d`) : t(`wclass.${def.wclass}`));
            row.append(name, cls);
            row.addEventListener('click', () => {
              if (locked) { game.audio.empty(); return; }
              w.setLoadoutItem(cat, def.id);
              ui.renderLoadout();
            });
            row.addEventListener('mouseenter', () => ui.renderLoStats(cat, def));
            list.appendChild(row);
          }
        }
        ui.renderLoStats('primary',
          WEAPON_DEFS.find((d) => d.id === w.loadout.primary));
        ui.renderPresets();
        $('setup-loadout-sum').textContent = ui.loadoutSummary();
      },
      loStatSpec(def) {
        return [
          ['stat.dmg', Math.min(1, (def.damage * def.pellets) / 70)],
          ['stat.rof', Math.min(1, (1 / def.fireDelay) / 16)],
          ['stat.acc', Math.max(0.05, 1 - def.spreadHip * 26)],
          ['stat.rng', Math.max(0.05, 1 - def.spreadAds * 55)],
          ['stat.mob', Math.min(1, Math.max(0.05, (def.moveMul - 0.75) / 0.25))],
        ];
      },
      // stats panel: bars for the hovered def, deltas vs the selected one
      renderLoStats(cat, def) {
        if (!def) return;
        const box = $('lo-stats');
        box.innerHTML = '';
        const nameEl = document.createElement('div');
        nameEl.className = 'name';
        const isThrow = cat === 'throwable';
        nameEl.textContent = isThrow ? t(`throw.${def.id}`) : t(`weapon.${def.id}`);
        box.appendChild(nameEl);
        if (isThrow) {
          const text = document.createElement('div');
          text.className = 'lo-text';
          text.textContent = `${t('stat.dmg')} ${def.splashDmg} · ` +
            `${t('stat.radius')} ${def.splashRadius}m · ${t('stat.count')} ${def.max}`;
          const desc = document.createElement('div');
          desc.className = 'lo-text';
          desc.textContent = t(`throw.${def.id}.d`);
          box.append(text, desc);
          return;
        }
        const selDef = WEAPON_DEFS.find((x) => x.id === game.weapons.loadout[cat]);
        const base = selDef && selDef.id !== def.id ? ui.loStatSpec(selDef) : null;
        ui.loStatSpec(def).forEach(([key, v], i) => {
          const row = document.createElement('div');
          row.className = 'lo-stat';
          const lbl = document.createElement('span');
          lbl.className = 'lbl';
          lbl.textContent = t(key);
          const bar = document.createElement('div');
          bar.className = 'bar';
          const fill = document.createElement('div');
          fill.className = 'fill';
          fill.style.width = `${Math.round(v * 100)}%`;
          bar.appendChild(fill);
          row.append(lbl, bar);
          if (base) {
            const dv = v - base[i][1];
            const delta = document.createElement('span');
            delta.className = `delta ${dv >= 0.005 ? 'up' : dv <= -0.005 ? 'down' : ''}`;
            delta.textContent = Math.abs(dv) < 0.005
              ? '=' : `${dv > 0 ? '+' : ''}${Math.round(dv * 100)}`;
            row.appendChild(delta);
          }
          box.appendChild(row);
        });
        const text = document.createElement('div');
        text.className = 'lo-text';
        text.textContent = `${t('stat.mag')} ${def.magSize} · ` +
          `${t('stat.reload')} ${def.reloadTime}s · ` +
          `${t('stat.reserve')} ${def.reserve === Infinity ? '∞' : def.reserve}`;
        box.appendChild(text);
      },
      renderPresets() {
        const presets = loadPresets();
        for (let i = 0; i < 3; i++) {
          $(`preset-save-${i}`).textContent = t('loadout.save', { n: i + 1 });
          const btn = $(`preset-load-${i}`);
          btn.textContent = presets[i] ? t('loadout.load', { n: i + 1 }) : `· ${i + 1} ·`;
          btn.disabled = !presets[i];
        }
      },
      renderSetup() {
        for (const d of Object.keys(DIFFICULTY)) {
          $(`diff-${d}`).classList.toggle('sel', game.setup.difficulty === d);
        }
        for (const m of ['survival', 'strike', 'domination', 'tdm', 'versus', 'ctf', 'hardpoint', 'gungame', 'snd', 'infection']) {
          $(`mode-${m}`).classList.toggle('sel', game.setup.mode === m);
        }
        for (const m of ['arena', 'battlefield', 'station', 'carrier', 'desert', 'rooftop', 'snow', 'factory']) {
          $(`map-${m}`).classList.toggle('sel', game.setup.map === m);
        }
        $('setup-loadout-sum').textContent = ui.loadoutSummary();
        for (const eq of EQUIP_DEFS) {
          $(`eq-${eq}`).classList.toggle('sel', game.setup.equip.includes(eq));
        }
        for (const slot of Object.keys(ATTACHMENTS)) {
          const id = game.weapons.attachments[slot];
          const btn = $(`attach-${slot}`);
          btn.textContent = `${t(`attach.${slot}`)}: ${t(`attach.${id}`)}`;
          btn.classList.toggle('sel', id !== 'none');
        }
      },
      saveSetup() {
        try {
          localStorage.setItem(SETUP_KEY, JSON.stringify({
            mode: game.setup.mode, map: game.setup.map,
            difficulty: game.setup.difficulty }));
        } catch (e) { /* ok */ }
        saveEquip(game.setup.equip);
        ui.renderSetup();
      },
      async openMultiplayer() {
        game.state = 'menu';
        game.hud.screen('mp');
        $('name-input').value = game.mp.name;
        $('server-input').value = game.mp.serverAddress;
        ui.mpStatus('');
        const ok = await game.mp.connect();  // reconnect to the last server
        if (!ok) {
          ui.mpStatus(t('mp.offline'));
          return;
        }
        game.mp.listRooms();
      },
      renderRoomList(rooms) {
        const list = $('room-list');
        list.innerHTML = '';
        if (!rooms.length) {
          const d = document.createElement('div');
          d.className = 'empty';
          d.textContent = t('mp.noRooms');
          list.appendChild(d);
          return;
        }
        for (const r of rooms) {
          const row = document.createElement('div');
          row.className = 'room-row';
          const codeEl = document.createElement('b');
          codeEl.textContent = r.code;
          const host = document.createElement('span');
          host.className = 'grow';
          host.textContent = `${r.host} · ${r.count}/${r.max}` +
            (r.started ? ` · ${t('mp.inMatch')}` : '');
          const join = document.createElement('button');
          join.className = 'join-btn';
          join.textContent = t('mp.join');
          join.disabled = r.count >= r.max;
          join.addEventListener('click', () => {
            game.mp.setName($('name-input').value);
            game.mp.joinRoom(r.code);
          });
          row.append(codeEl, host, join);
          list.appendChild(row);
        }
      },
      renderLobby(room) {
        game.hud.screen('lobby');
        $('lobby-code').textContent = t('mp.room', { code: room.code });
        const wrap = $('lobby-players');
        wrap.innerHTML = '';
        let meReady = false;
        for (const p of room.players) {
          if (p.id === game.mp.myId) meReady = p.ready;
          const row = document.createElement('div');
          row.className = 'p-row';
          const name = document.createElement('span');
          name.className = 'grow';
          name.textContent = p.name + (p.id === game.mp.myId ? ' ◄' : '');
          row.appendChild(name);
          if (p.host) {
            const tag = document.createElement('span');
            tag.className = 'tag host';
            tag.textContent = t('mp.host');
            row.appendChild(tag);
          } else {
            const tag = document.createElement('span');
            tag.className = `tag ${p.ready ? 'ready' : 'notready'}`;
            tag.textContent = p.ready ? t('mp.ready') : t('mp.unready');
            row.appendChild(tag);
          }
          wrap.appendChild(row);
        }
        const amHost = room.hostId === game.mp.myId;
        $('lobby-map-row').style.display = amHost ? '' : 'none';
        $('lobby-map-btn').textContent = t(`map.${game.setup.map}`);
        $('lobby-mode-btn').textContent = t(`mode.${game.mpMode || 'survival'}`);
        $('lobby-diff-btn').textContent = t(`diff.${game.setup.difficulty}`);
        $('ready-btn').style.display = amHost ? 'none' : '';
        $('ready-btn').textContent = meReady ? t('mp.unready') : t('mp.ready');
        $('start-match-btn').style.display = amHost ? '' : 'none';
        $('lobby-status').textContent = amHost ? t('mp.waitReady') : t('mp.waitHost');
        this._meReady = meReady;
      },
    };

    $('mp-btn').addEventListener('click', () => {
      game.audio.init();
      ui.openMultiplayer();
    });
    $('loadout-btn').addEventListener('click', () => {
      game.audio.init();
      ui.showLoadout('menu');
    });
    $('setup-loadout-sum').addEventListener('click', () => ui.showLoadout('setup'));
    $('loadout-back-btn').addEventListener('click', () => {
      if (ui._loadoutReturn === 'setup') ui.showSetup();
      else ui.showMenu();
    });
    for (let i = 0; i < 3; i++) {
      $(`preset-save-${i}`).addEventListener('click', () => {
        const presets = loadPresets();
        presets[i] = {
          loadout: { ...game.weapons.loadout },
          attachments: { ...game.weapons.attachments },
          equip: [...game.setup.equip],
        };
        savePresets(presets);
        ui.renderLoadout();
      });
      $(`preset-load-${i}`).addEventListener('click', () => {
        const pr = loadPresets()[i];
        if (!pr) return;
        game.weapons.loadout = { ...DEFAULT_LOADOUT, ...(pr.loadout || {}) };
        saveLoadout(game.weapons.loadout);
        game.weapons.applyLoadout(true);
        for (const slot of Object.keys(ATTACHMENTS)) {
          game.weapons.setAttachment(slot, (pr.attachments || {})[slot] || 'none');
        }
        game.setup.equip = (pr.equip || []).slice(0, 2);
        ui.saveSetup();
        ui.renderLoadout();
      });
    }
    $('loadout-default').addEventListener('click', () => {
      game.weapons.loadout = { ...DEFAULT_LOADOUT };
      saveLoadout(game.weapons.loadout);
      game.weapons.applyLoadout(true);
      for (const slot of Object.keys(ATTACHMENTS)) game.weapons.setAttachment(slot, 'none');
      game.setup.equip = ['plates', 'helmet'];
      ui.saveSetup();
      ui.renderLoadout();
    });
    $('mp-back-btn').addEventListener('click', () => {
      if (game.mp.inRoom()) game.mp.leaveRoom();
      ui.showMenu();
    });
    $('create-room-btn').addEventListener('click', () => {
      game.mp.setName($('name-input').value);
      game.mp.createRoom();
    });
    $('quickplay-btn').addEventListener('click', () => {
      game.mp.setName($('name-input').value);
      game.mp.quickPlay();
    });
    $('join-code-btn').addEventListener('click', () => {
      game.mp.setName($('name-input').value);
      const code = $('room-code-input').value.trim().toUpperCase();
      if (code.length === 4) game.mp.joinRoom(code);
    });
    $('refresh-btn').addEventListener('click', () => game.mp.listRooms());
    $('server-connect-btn').addEventListener('click', async () => {
      if (game.mp.connected) {
        game.mp.disconnect();
        return;
      }
      ui.mpStatus('');
      if (!game.mp.setServerAddress($('server-input').value)) {
        ui.setServerStatus('failed', 'badAddress');
        return;
      }
      const ok = await game.mp.connect();
      if (ok) game.mp.listRooms();
      else ui.mpStatus(t('mp.offline'));
    });
    $('ready-btn').addEventListener('click', () => {
      game.mp.setReady(!ui._meReady);
    });
    $('start-match-btn').addEventListener('click', () => {
      game.audio.init();
      game.applyVolume();
      game.mp.requestStart(game.setup.map, game.mpMode || 'survival', game.setup.difficulty);
    });
    $('leave-lobby-btn').addEventListener('click', () => {
      game.mp.leaveRoom();
      ui.showMpBrowser();
    });
    $('mpover-lobby-btn').addEventListener('click', () => ui.showLobby());
    $('lang-btn').addEventListener('click', () => {
      setLang(nextLang());
      ui.refreshText();
    });
    for (const m of ['survival', 'strike', 'domination', 'tdm', 'versus', 'ctf', 'hardpoint', 'gungame', 'snd', 'infection']) {
      $(`mode-${m}`).addEventListener('click', () => { game.setup.mode = m; ui.saveSetup(); });
    }
    for (const d of Object.keys(DIFFICULTY)) {
      $(`diff-${d}`).addEventListener('click', () => {
        game.setup.difficulty = d;
        ui.saveSetup();
      });
    }
    $('lobby-diff-btn').addEventListener('click', () => {
      const order = Object.keys(DIFFICULTY);
      game.setup.difficulty = order[(order.indexOf(game.setup.difficulty) + 1) % order.length];
      ui.saveSetup();
      $('lobby-diff-btn').textContent = t(`diff.${game.setup.difficulty}`);
    });
    for (const m of ['arena', 'battlefield', 'station', 'carrier', 'desert', 'rooftop', 'snow', 'factory']) {
      $(`map-${m}`).addEventListener('click', () => { game.setup.map = m; ui.saveSetup(); });
    }
    for (const slot of Object.keys(ATTACHMENTS)) {
      $(`attach-${slot}`).addEventListener('click', () => {
        const opts = ATTACHMENTS[slot];
        const i = opts.findIndex((o) => o.id === game.weapons.attachments[slot]);
        game.weapons.setAttachment(slot, opts[(i + 1) % opts.length].id);
        ui.renderSetup();
      });
    }
    for (const eq of EQUIP_DEFS) {
      $(`eq-${eq}`).addEventListener('click', () => {
        const list = game.setup.equip;
        const i = list.indexOf(eq);
        if (i >= 0) list.splice(i, 1);
        else {
          list.push(eq);
          while (list.length > 2) list.shift();
        }
        ui.saveSetup();
      });
    }
    $('lobby-map-btn').addEventListener('click', () => {
      // host cycles the co-op map
      const cycle = ['arena', 'battlefield', 'station', 'carrier', 'desert', 'rooftop', 'snow', 'factory'];
      game.setup.map = cycle[(cycle.indexOf(game.setup.map) + 1) % cycle.length];
      ui.saveSetup();
      $('lobby-map-btn').textContent = t(`map.${game.setup.map}`);
    });
    $('lobby-mode-btn').addEventListener('click', () => {
      game.mpMode = game.mpMode === 'versus' ? 'survival' : 'versus';
      $('lobby-mode-btn').textContent = t(`mode.${game.mpMode}`);
    });

    return ui;
  }

  // Graphics quality: low = reduced resolution + no shadows,
  // medium = native resolution + shadows, high = supersampled up to 2x DPR.
  applyQuality() {
    const q = this.settings.quality;
    this.renderer.setPixelRatio(
      q === 'low' ? 0.66 : q === 'medium' ? 1 : Math.min(window.devicePixelRatio, 2));
    if (this.world && this.world.sun) this.world.sun.castShadow = q !== 'low';
    this.renderer.shadowMap.enabled = q !== 'low';
  }

  _wireSettings() {
    const sens = document.getElementById('sens-slider');
    const sensVal = document.getElementById('sens-value');
    const vol = document.getElementById('vol-slider');
    const volVal = document.getElementById('vol-value');
    sens.value = String(this.settings.sensitivity);
    vol.value = String(this.settings.volume);
    sensVal.textContent = Number(this.settings.sensitivity).toFixed(1);
    volVal.textContent = Number(this.settings.volume).toFixed(2);
    sens.addEventListener('input', () => {
      this.settings.sensitivity = parseFloat(sens.value);
      sensVal.textContent = this.settings.sensitivity.toFixed(1);
      this.saveSettings();
    });
    vol.addEventListener('input', () => {
      this.settings.volume = parseFloat(vol.value);
      volVal.textContent = this.settings.volume.toFixed(2);
      this.applyVolume();
      this.saveSettings();
    });
    const qBtn = document.getElementById('quality-btn');
    const qLabel = () => { qBtn.textContent = t(`gfx.${this.settings.quality}`); };
    qLabel();
    qBtn.addEventListener('click', () => {
      const order = ['low', 'medium', 'high'];
      this.settings.quality =
        order[(order.indexOf(this.settings.quality) + 1) % order.length];
      this.applyQuality();
      this.saveSettings();
      qLabel();
    });
  }

  hasEquip(id) {
    return this.setup.equip.includes(id);
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* ok */ }
  }

  applyVolume() {
    if (this.audio.master) this.audio.master.gain.value = this.settings.volume * 0.7;
  }

  // god mode is cheat-backed; keep the plain property API for console/tests
  get godMode() {
    return !!(this.cheats && this.cheats.is('god'));
  }

  set godMode(v) {
    if (this.cheats) this.cheats.setFlag('god', !!v);
  }

  refreshPerks() {
    const newMax = this.progression.maxHp();
    this.player.maxHp = newMax;
    this.player.hp = Math.min(this.player.hp, newMax);
    this.hud.setHealth(this.player.hp, newMax);
  }

  onRankUp(newRank) {
    this.hud.setRank(this.progression.rankLabel);
    this.hud.banner(t('banner.rank', { rank: this.progression.rankLabel }), 'streak');
    this.hud.bannerFadeSoon();
    this.audio.streak();
    for (const w of this.weapons.weapons) {
      if (w.def.unlockRank === newRank) {
        this.hud.killfeed(t('feed.unlocked', { weapon: t(`weapon.${w.def.id}`) }), 'cheat');
      }
    }
    for (const p of PERKS) {
      if (p.rank === newRank) {
        this.hud.killfeed(t('feed.perk', { perk: t(`perk.${p.id}`) }), 'cheat');
      }
    }
    this.refreshPerks();
    this.hud.renderArsenal();
  }

  get pointerLocked() {
    return document.pointerLockElement === this.renderer.domElement;
  }

  get playing() {
    return this.state === 'playing';
  }

  requestLock() {
    const el = this.renderer.domElement;
    try {
      const p = el.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          try {
            const q = el.requestPointerLock();
            if (q && q.catch) q.catch(() => {});
          } catch (e) { /* pointer lock unavailable */ }
        });
      }
    } catch (e) {
      try {
        const q = el.requestPointerLock();
        if (q && q.catch) q.catch(() => {});
      } catch (e2) { /* pointer lock unavailable */ }
    }
  }

  _resetRunState() {
    this.score = 0;
    this.kills = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.state = 'playing';
    this.player.reset();
    this.weapons.reset();
    this.effects.reset();
    this.pickups.reset();
    this.hud.setScore(0);
    this.hud.setStreak(0);
    this.hud.setRank(this.progression.rankLabel);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.screen(null);
    this.hud.show();
    this.hud.banner(t('banner.survive'), '');
    this.weapons.rig.visible = true;
    this.ui.syncLangButton();
  }

  startRun() {
    this.cheats.suspend(false);
    this.cheatsUsedThisRun = this.cheats.anyActive();
    this.mode = this.setup.mode;
    this.world.load(this.setup.map);
    this.warfare.reset();
    this.orbital.reset();
    this._updateSmokes(9999);
    this._updateFires(9999);
    document.querySelector('#gameover-screen h1').textContent = t('over.title');
    this.matchDifficulty = this.setup.difficulty;
    this.meleeOnlyPlayer = false;
    this.enemies = this.mode === 'strike' ? this.soldiers
      : this.mode === 'domination' ? this.domination
      : this.mode === 'tdm' ? this.tdm
      : this.mode === 'ctf' ? this.ctf
      : this.mode === 'hardpoint' ? this.hardpoint
      : this.mode === 'gungame' ? this.gungame
      : this.mode === 'snd' ? this.snd
      : this.mode === 'infection' ? this.infection
      : this.mode === 'versus' ? this.botMatch : this.enemiesSolo;
    for (const mgr of [this.enemiesSolo, this.soldiers, this.domination, this.botMatch,
      this.tdm, this.ctf, this.hardpoint, this.gungame, this.snd, this.infection]) {
      if (mgr !== this.enemies) mgr.reset();
    }
    this._resetRunState();
    this.warfare.spawnVehicles();
    this.enemies.startGame();
    if (this.mode === 'versus') {
      this.hud.setWave('0/15');
      this.hud.subbanner(t('versus.target', { n: 15 }));
      setTimeout(() => { if (this.playing) this.hud.subbanner(''); }, 3000);
    }
  }

  versusSoloFinished(won, scores) {
    this.hud.subbanner('');
    document.getElementById('spectate-note').classList.remove('visible');
    document.querySelector('#mpover-screen h2').textContent =
      t(won ? 'versus.win' : 'versus.lose');
    const wrap = document.getElementById('mp-scores');
    wrap.innerHTML = '';
    const rows = [...scores.values()].sort((a, b) => b.kills - a.kills);
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 's-row';
      row.innerHTML =
        `<span class="grow">${r.name}</span>` +
        `<span>${t('mp.kills')} <b>${r.kills}</b></span>` +
        `<span>${t('mp.score')} <b>${r.score}</b></span>`;
      wrap.appendChild(row);
    }
    // repurpose the lobby-return button as a menu return offline
    this.state = 'gameover';
    this.weapons.rig.visible = false;
    this.hud.setScope(false);
    this.hud.hide();
    this.hud.screen('mpover');
    this.ui.syncLangButton();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  strikeFinished(win, kills) {
    document.querySelector('#gameover-screen h1').textContent =
      t(win ? 'strike.win' : 'strike.lose');
    this._finishRun();
  }

  domFinished(win) {
    document.querySelector('#gameover-screen h1').textContent =
      t(win ? 'strike.win' : 'strike.lose');
    this.hud.subbanner('');
    this._finishRun();
  }

  modeFinished(win) {
    document.querySelector('#gameover-screen h1').textContent =
      t(win ? 'strike.win' : 'strike.lose');
    this.hud.subbanner('');
    this.meleeOnlyPlayer = false;
    this._finishRun();
  }

  tdmFinished(win) {
    document.querySelector('#gameover-screen h1').textContent =
      t(win ? 'strike.win' : 'strike.lose');
    this.hud.subbanner('');
    this._finishRun();
  }

  // multiplayer match entry (called by Multiplayer on 'started')
  startMatch(mp, map = 'arena', mode = 'survival') {
    if (this.cheats.anyActive()) {
      this.hud.killfeed(t('mp.cheatsDisabled'), 'cheat');
    }
    this.cheats.suspend(true);
    this.cheatsUsedThisRun = false;
    this.mode = mode;
    this.world.load(map);
    this.warfare.reset();
    this.orbital.reset();
    this._updateSmokes(9999);
    this._updateFires(9999);
    this.meleeOnlyPlayer = false;
    for (const mgr of [this.soldiers, this.domination, this.botMatch, this.tdm,
      this.ctf, this.hardpoint, this.gungame, this.snd, this.infection]) {
      mgr.reset();
    }
    if (mode === 'versus' || mp.isHost) {
      this.enemiesSolo.reset();
      this.enemies = this.enemiesSolo;
    } else {
      this.enemiesSolo.reset();
      this.enemies = mp.replicas;
    }
    this._resetRunState();
    this.warfare.spawnVehicles();
    if (mode === 'versus') {
      // FFA: scatter spawns, no AI waves
      const pts = this.world.spawnPoints;
      const sp = pts[Math.floor(Math.random() * pts.length)];
      this.player.position.set(sp.x, 0, sp.z);
      this.hud.setWave('0/15');
      this.hud.subbanner(t('versus.target', { n: 15 }));
      setTimeout(() => this.hud.subbanner(''), 3000);
    } else if (mp.isHost) {
      this.enemies.startGame();
    }
    this.requestLock(); // clients may lack a gesture; click-to-lock recovers
  }

  // multiplayer match exit
  endMatch(reason, scores) {
    this.cheats.suspend(false);
    this.mpOverlay = false;
    this.weapons.rig.visible = false;
    this.hud.setScope(false);
    this.hud.hide();
    this.enemiesSolo.reset();
    this.enemies = this.enemiesSolo;
    this.state = 'gameover'; // reuse the orbit camera
    if (document.pointerLockElement) document.exitPointerLock();

    if (reason === 'over' || reason === 'hostLeft') {
      if (this.mode === 'versus') {
        const mine = scores.get(this.mp.myId);
        const best = Math.max(0, ...[...scores.values()].map((s) => s.kills));
        const won = mine && mine.kills >= best && best > 0;
        document.querySelector('#mpover-screen h2').textContent =
          t(won ? 'versus.win' : 'versus.lose');
      } else {
        document.querySelector('#mpover-screen h2').textContent = t('mp.matchOver');
      }
      const wrap = document.getElementById('mp-scores');
      wrap.innerHTML = '';
      const rows = [...scores.values()].sort((a, b) => b.score - a.score);
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = 's-row';
        row.innerHTML =
          `<span class="grow">${r.name}</span>` +
          `<span>${t('mp.kills')} <b>${r.kills}</b></span>` +
          `<span>${t('mp.score')} <b>${r.score}</b></span>`;
        wrap.appendChild(row);
      }
      if (reason === 'hostLeft') {
        const note = document.createElement('div');
        note.style.cssText = 'margin-top:10px;font-size:13px;color:var(--warn);letter-spacing:2px';
        note.textContent = t('mp.hostLeft');
        wrap.appendChild(note);
      }
      this.hud.screen('mpover');
    } else if (reason === 'lost') {
      this.ui.showMenu();
      this.hud.screen('mp');
      this.ui.mpStatus(t('mp.err.lost'));
    } else {
      this.ui.showMenu();
    }
    this.ui.syncLangButton();
  }

  _showMpOverlay() {
    if (this.mpOverlay) return;
    this.mpOverlay = true;
    this.player.keys.clear();
    this.weapons.triggerHeld = false;
    this.weapons.ads = false;
    document.getElementById('pause-leave-btn').style.display = '';
    this.hud.screen('pause');
  }

  _hideMpOverlay() {
    if (!this.mpOverlay) return;
    this.mpOverlay = false;
    document.getElementById('pause-leave-btn').style.display = 'none';
    this.hud.screen(null);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.weapons.triggerHeld = false;
    this.weapons.ads = false;
    document.getElementById('pause-leave-btn').style.display = 'none';
    this.hud.screen('pause');
    this.ui.syncLangButton();
  }

  resumePlaying() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.screen(null);
    this.ui.syncLangButton();
    this.clock.getDelta(); // swallow the pause duration
  }

  gameOver() {
    if (this.state !== 'playing') return;
    if (this.mp.active) {
      // co-op: down, spectate until the next wave (or match over)
      this.mp.onLocalDeath();
      return;
    }
    if (this.mode === 'strike' && !this.enemies.done) {
      // strike mode: redeploy instead of ending the run
      this.enemies.onPlayerDeath();
      return;
    }
    if (['versus', 'domination', 'tdm', 'ctf', 'hardpoint', 'gungame', 'snd',
         'infection'].includes(this.mode) && !this.mp.active && !this.enemies.done) {
      // bot-team modes: credit the killer bot, then redeploy
      if (this.player.lastBotAttacker && this.enemies.creditPlayerDeath) {
        this.enemies.creditPlayerDeath(this.player.lastBotAttacker);
        this.player.lastBotAttacker = null;
      }
      this.enemies.onPlayerDeath();
      return;
    }
    this._finishRun();
  }

  _finishRun() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.audio.gameOver();
    this.weapons.rig.visible = false;
    this.hud.setScope(false);
    this.hud.hide();

    let best = 0;
    try {
      best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
      if (this.score > best && !this.cheatsUsedThisRun) {
        best = this.score;
        localStorage.setItem(BEST_KEY, String(best));
      }
    } catch (e) { if (!this.cheatsUsedThisRun) best = Math.max(best, this.score); }

    const prog = this.progression;
    const next = prog.nextThreshold();
    const rankLine = next === null
      ? t('over.rank', { rank: prog.rankLabel })
      : t('over.rankXp', { rank: prog.rankLabel, xp: prog.xp, next });
    this.hud.showGameOver(this.score, this.enemies.wave, this.kills, this.bestStreak,
      best, rankLine, this.cheatsUsedThisRun);
    this.hud.renderArsenal();
    this.ui.syncLangButton();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  addScore(n) {
    this.score += Math.round(n);
    this.hud.setScore(this.score);
    if (!this.cheatsUsedThisRun) this.progression.addXp(n);
  }

  addKill(typeName = 'grunt') {
    this.hud.killfeed(t('feed.eliminated', { enemy: t(`enemy.${typeName}`) }));
    this.addKillMp();
  }

  // kill accounting without the solo killfeed line (mp feed formats its own)
  addKillMp() {
    this.kills++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.hud.setStreak(this.streak);
    const reward = STREAK_REWARDS[this.streak];
    if (reward) {
      this.addScore(reward.bonus);
      if (reward.refill) this.weapons.addReserveAll(2);
      if (reward.resupply) {
        this.weapons.addReserveAll(1);
        this.weapons.addGrenade(1);
        if (this.hasEquip('plates')) {
          this.player.armor = Math.min(75, this.player.armor + 50);
          this.hud.setArmor(this.player.armor);
        }
      }
      if (reward.orbital) this.orbital.grant(3);
      if (reward.heli && !this.mp.active) this.warfare.callHelicopter();
      const label = reward.key ? t(reward.key) : t(`streak.${this.streak}`);
      this.hud.banner(`${label}  +${reward.bonus}`, 'streak');
      this.hud.bannerFadeSoon();
      this.audio.streak();
    }
  }

  resetStreak() {
    this.streak = 0;
    this.hud.setStreak(0);
  }

  // True when world geometry blocks the segment from a blast point to a target.
  _splashBlocked(from, to) {
    const dir = _splashDir.subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.001) return false;
    dir.divideScalar(dist);
    _splashRay.set(from, dir);
    _splashRay.far = dist;
    return _splashRay.intersectObjects(this.world.colliderMeshes, false).length > 0;
  }

  // Explosion damage: enemies take falloff damage, the player takes half.
  // Cover matters: blocked line of sight cuts damage to 25%.
  applySplash(pos, radius, dmg) {
    this.effects.explosion(pos);
    this.audio.explosion();
    if (this.mp.active) this.mp.sendBoom(pos);
    const origin = pos.clone();
    origin.y += 0.25; // lift off the floor so the LOS ray doesn't graze it

    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const center = new THREE.Vector3(
        e.position.x, e.position.y + e.height * 0.5, e.position.z);
      const d = center.distanceTo(pos);
      if (d < radius) {
        let falloff = Math.max(0.3, 1 - d / radius);
        if (this._splashBlocked(origin, center)) falloff *= 0.25;
        e.takeDamage(dmg * falloff, center, false);
      }
    }

    for (const b of this.warfare.bikes) {
      if (b.destroyed) continue;
      const bd = Math.hypot(b.position.x - pos.x, b.position.z - pos.z);
      if (bd < radius) b.takeDamage(dmg * Math.max(0.3, 1 - bd / radius) * 0.8);
    }

    if (this.mp.versus) {
      for (const r of this.mp.remoteList()) {
        if (!r.alive) continue;
        const center = new THREE.Vector3(r.position.x, r.position.y + 1, r.position.z);
        const d = center.distanceTo(pos);
        if (d < radius && !this._splashBlocked(origin, center)) {
          this.mp.sendPvpHit(r.id, dmg * Math.max(0.3, 1 - d / radius) * 0.6, center);
        }
      }
    }

    const eye = this.player.eyePosition;
    const pd = eye.distanceTo(pos);
    if (pd < radius) {
      let falloff = Math.max(0.3, 1 - pd / radius);
      if (this._splashBlocked(origin, eye)) falloff *= 0.25;
      this.player.takeDamage(dmg * falloff * 0.5, pos, 'splash');
    }
    if (pd < radius * 3) {
      this.player.addShake(Math.min(0.12, 0.35 / Math.max(1, pd)));
    }
  }

  // Flashbang: blinds the player (screen whiteout) and stuns AI in LOS.
  applyFlash(pos, radius) {
    this.effects.explosion(pos);
    this.audio.explosion();
    if (this.mp.active) this.mp.sendBoom(pos);
    const origin = pos.clone();
    origin.y += 0.4;
    for (const e of this.enemies.list) {
      if (!e.alive || e.spawnTimer > 0) continue;
      const c = new THREE.Vector3(
        e.position.x, e.position.y + (e.height || 1.5) * 0.5, e.position.z);
      if (c.distanceTo(pos) < radius && !this._splashBlocked(origin, c)) {
        e.stunned = Math.max(e.stunned || 0, 3);
      }
    }
    const p = this.player;
    const d = p.eyePosition.distanceTo(pos);
    if (p.alive && d < radius * 1.3 && !this._splashBlocked(origin, p.eyePosition)) {
      const dir = pos.clone().sub(p.eyePosition).normalize();
      const facing = this.camera.getWorldDirection(new THREE.Vector3()).dot(dir);
      const k = Math.max(0.3, 1 - d / (radius * 1.3)) * (facing > 0.1 ? 1 : 0.45);
      this.hud.flashBang(k);
    }
  }

  // Molotov fire zone: a burning patch that ticks damage on anything inside.
  applyFire(pos, radius, duration) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff7a3b, transparent: true, opacity: 0.3, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat);
    const at = pos.clone();
    at.y = Math.max(0.3, at.y);
    mesh.position.copy(at);
    mesh.scale.set(radius, radius * 0.45, radius);
    this.scene.add(mesh);
    const light = new THREE.PointLight(0xff8a3b, 50, radius * 4, 1.6);
    light.position.set(at.x, at.y + 1, at.z);
    this.scene.add(light);
    this.fires.push({ pos: at, r: radius, t: duration, total: duration,
      tick: 0, mesh, mat, light });
    this.audio.explosion();
    if (this.mp.active) this.mp.sendBoom(at);
  }

  _updateFires(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt;
      f.tick -= dt;
      f.mat.opacity = 0.22 + Math.sin(performance.now() / 90 + i) * 0.08;
      f.light.intensity = 40 + Math.sin(performance.now() / 70) * 14;
      if (f.tick <= 0) {
        f.tick = 0.5;
        if (Math.random() < 0.9) {
          this.effects.spawnParticle(
            new THREE.Vector3(f.pos.x + (Math.random() - 0.5) * f.r,
              f.pos.y + 0.4, f.pos.z + (Math.random() - 0.5) * f.r),
            new THREE.Vector3(0, 2.5, 0), _fireEmber, 0.5, 0);
        }
        // burn everything standing in it
        for (const e of this.enemies.list) {
          if (!e.alive || e.spawnTimer > 0) continue;
          if (Math.hypot(e.position.x - f.pos.x, e.position.z - f.pos.z) < f.r &&
              e.position.y < f.pos.y + 2) {
            e.takeDamage(13, e.position, false);
          }
        }
        const p = this.player;
        if (p.alive &&
            Math.hypot(p.position.x - f.pos.x, p.position.z - f.pos.z) < f.r &&
            p.position.y < f.pos.y + 2) {
          p.takeDamage(9, f.pos, 'splash');
        }
      }
      if (f.t <= 0) {
        this.scene.remove(f.mesh);
        this.scene.remove(f.light);
        f.mesh.geometry.dispose();
        f.mat.dispose();
        this.fires.splice(i, 1);
      }
    }
  }

  // Smoke screen: a sphere that blocks AI line of sight for its lifetime.
  applySmoke(pos, duration) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9aa4b0, transparent: true, opacity: 0.42, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
    const at = pos.clone();
    at.y = Math.max(1.5, at.y + 1);
    mesh.position.copy(at);
    mesh.scale.setScalar(0.1);
    this.scene.add(mesh);
    this.smokes.push({ pos: at, r: 4.4, t: duration, total: duration, mesh, mat });
    this.audio.grenadeThrow();
  }

  smokeBlocksLos(a, b) {
    for (const s of this.smokes) {
      // closest point on segment ab to the smoke center
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const len2 = abx * abx + aby * aby + abz * abz;
      if (len2 === 0) continue;
      let tt = ((s.pos.x - a.x) * abx + (s.pos.y - a.y) * aby + (s.pos.z - a.z) * abz) / len2;
      tt = Math.max(0, Math.min(1, tt));
      const dx = a.x + abx * tt - s.pos.x;
      const dy = a.y + aby * tt - s.pos.y;
      const dz = a.z + abz * tt - s.pos.z;
      if (dx * dx + dy * dy + dz * dz < s.r * s.r) return true;
    }
    return false;
  }

  _updateSmokes(dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t -= dt;
      const grow = Math.min(1, (s.total - s.t) / 0.6);
      s.mesh.scale.setScalar(Math.max(0.1, s.r * grow));
      s.mat.opacity = 0.42 * Math.min(1, Math.max(0, s.t / 1.5));
      s.mesh.rotation.y += dt * 0.3;
      if (s.t <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mat.dispose();
        this.smokes.splice(i, 1);
      }
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.state === 'playing') {
      if (this.cheats.anyActive()) this.cheatsUsedThisRun = true;
      const gdt = this.cheats.is('slowMotion') ? dt * 0.45 : dt;
      this.player.update(gdt);
      this.weapons.update(gdt);
      this.enemies.update(gdt);
      this.pickups.update(gdt);
      this.effects.update(gdt);
      this.warfare.update(gdt);
      this._updateSmokes(gdt);
      this._updateFires(gdt);
      this.orbital.update(gdt);
      if (this.orbital.active) this.orbital.applyCamera();
      this.mp.update(dt);
      this.hud.updateRadar(this.player, this.enemies.list, this.pickups.list,
        this.mp.active ? this.mp.remoteList()
          : this.enemies.teammates ? this.enemies.teammates() : []);
      this.hud.updateCompass(this.player.yaw);
    } else if (this.state === 'menu' || this.state === 'gameover') {
      // slow orbiting camera behind the menu
      this.menuTime += dt;
      const tt = this.menuTime * 0.12;
      this.camera.position.set(Math.sin(tt) * 24, 9 + Math.sin(tt * 0.7) * 2, Math.cos(tt) * 24);
      this.camera.lookAt(0, 1.5, 0);
      this.effects.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

const _fireEmber = new THREE.Color(0xff9a4a);
const _splashRay = new THREE.Raycaster();
const _splashDir = new THREE.Vector3();

const game = new Game();
// Exposed for debugging and automated smoke tests.
window.__game = game;
