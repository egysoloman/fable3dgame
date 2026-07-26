import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { EnemyManager } from './enemies.js';
import { PickupManager } from './pickups.js';
import { Effects } from './effects.js';
import { AudioFX } from './audio.js';
import { HUD } from './hud.js';
import { Progression, PERKS } from './progression.js';
import { CheatSystem } from './cheats.js';

const BEST_KEY = 'neonstrike.best';
const SETTINGS_KEY = 'neonstrike.settings';

// Production kill-switch for the dev console: serve with ?nocheats=1
const CHEATS_ENABLED = new URLSearchParams(location.search).get('nocheats') !== '1';

const STREAK_REWARDS = {
  5: { name: 'RAMPAGE', bonus: 250 },
  10: { name: 'ONSLAUGHT', bonus: 750, refill: true },
  15: { name: 'UNSTOPPABLE', bonus: 2000, refill: true },
  20: { name: 'GODLIKE', bonus: 4000, refill: true },
};

class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | gameover
    this.score = 0;
    this.kills = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.cheatsUsedThisRun = false;
    this.menuTime = 0;

    this.settings = { sensitivity: 1, volume: 0.7 };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
    } catch (e) { /* defaults */ }

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

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
    this.enemies = new EnemyManager(this);
    this.pickups = new PickupManager(this);
    this.cheats = new CheatSystem(this, CHEATS_ENABLED);

    this.weapons.rig.visible = false;
    this.hud.renderArsenal();

    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- pointer lock ---
    document.addEventListener('pointerlockchange', () => {
      const locked = this.pointerLocked;
      if (!locked && this.state === 'playing') this.pause();
      else if (locked && this.state === 'paused') this.resumePlaying();
    });

    document.getElementById('start-btn').addEventListener('click', () => {
      this.audio.init();
      this.applyVolume();
      this.startRun();
      this.requestLock();
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
        if (this.state === 'paused' && !this.pointerLocked) this.resumePlaying();
      }, 250);
    });

    this._wireSettings();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
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
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* ok */ }
  }

  applyVolume() {
    if (this.audio.master) this.audio.master.gain.value = this.settings.volume * 0.7;
  }

  // god mode is cheat-backed; keep the plain property API for console/tests
  get godMode() {
    return !!(this.cheats && this.cheats.flags.god);
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
    this.hud.banner(`RANK ${this.progression.rankLabel}`, 'streak');
    this.hud.bannerFadeSoon();
    this.audio.streak();
    for (const w of this.weapons.weapons) {
      if (w.def.unlockRank === newRank) {
        this.hud.killfeed(`${w.def.name} UNLOCKED`, 'cheat');
      }
    }
    for (const p of PERKS) {
      if (p.rank === newRank) this.hud.killfeed(`PERK: ${p.name}`, 'cheat');
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

  startRun() {
    this.score = 0;
    this.kills = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.cheatsUsedThisRun = this.cheats ? this.cheats.anyActive() : false;
    this.state = 'playing';
    this.player.reset();
    this.weapons.reset();
    this.effects.reset();
    this.pickups.reset();
    this.enemies.startGame();
    this.hud.setScore(0);
    this.hud.setStreak(0);
    this.hud.setRank(this.progression.rankLabel);
    this.hud.setHealth(this.player.hp, this.player.maxHp);
    this.hud.screen(null);
    this.hud.show();
    this.hud.banner('SURVIVE', '');
    this.weapons.rig.visible = true;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.weapons.triggerHeld = false;
    this.weapons.ads = false;
    this.hud.screen('pause');
  }

  resumePlaying() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.screen(null);
    this.clock.getDelta(); // swallow the pause duration
  }

  gameOver() {
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
      ? `RANK ${prog.rankLabel}`
      : `RANK ${prog.rankLabel} — ${prog.xp} / ${next} XP`;
    this.hud.showGameOver(this.score, this.enemies.wave, this.kills, this.bestStreak,
      best, rankLine, this.cheatsUsedThisRun);
    this.hud.renderArsenal();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  addScore(n) {
    this.score += Math.round(n);
    this.hud.setScore(this.score);
    if (!this.cheatsUsedThisRun) this.progression.addXp(n);
  }

  addKill(typeName = 'hostile') {
    this.kills++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.hud.setStreak(this.streak);
    this.hud.killfeed(`${typeName.toUpperCase()} ELIMINATED`);
    const reward = STREAK_REWARDS[this.streak];
    if (reward) {
      this.addScore(reward.bonus);
      if (reward.refill) this.weapons.addReserveAll(2);
      this.hud.banner(`${reward.name}  +${reward.bonus}`, 'streak');
      this.hud.bannerFadeSoon();
      this.audio.streak();
    }
  }

  resetStreak() {
    this.streak = 0;
    this.hud.setStreak(0);
  }

  // Explosion damage: enemies take falloff damage, the player takes half.
  applySplash(pos, radius, dmg) {
    this.effects.explosion(pos);
    this.audio.explosion();

    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const center = new THREE.Vector3(
        e.position.x, e.position.y + e.height * 0.5, e.position.z);
      const d = center.distanceTo(pos);
      if (d < radius) {
        const falloff = Math.max(0.3, 1 - d / radius);
        e.takeDamage(dmg * falloff, center, false);
      }
    }

    const pd = this.player.eyePosition.distanceTo(pos);
    if (pd < radius) {
      const falloff = Math.max(0.3, 1 - pd / radius);
      this.player.takeDamage(dmg * falloff * 0.5, pos);
    }
    if (pd < radius * 3) {
      this.player.addShake(Math.min(0.12, 0.35 / Math.max(1, pd)));
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.state === 'playing') {
      if (this.cheats.anyActive()) this.cheatsUsedThisRun = true;
      const gdt = this.cheats.flags.slowMotion ? dt * 0.45 : dt;
      this.player.update(gdt);
      this.weapons.update(gdt);
      this.enemies.update(gdt);
      this.pickups.update(gdt);
      this.effects.update(gdt);
      this.hud.updateRadar(this.player, this.enemies.list, this.pickups.list);
      this.hud.updateCompass(this.player.yaw);
    } else if (this.state === 'menu' || this.state === 'gameover') {
      // slow orbiting camera behind the menu
      this.menuTime += dt;
      const t = this.menuTime * 0.12;
      this.camera.position.set(Math.sin(t) * 24, 9 + Math.sin(t * 0.7) * 2, Math.cos(t) * 24);
      this.camera.lookAt(0, 1.5, 0);
      this.effects.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
// Exposed for debugging and automated smoke tests.
window.__game = game;
