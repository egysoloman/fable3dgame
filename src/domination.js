import * as THREE from 'three';
import { EnemyManager } from './enemies.js';
import { t } from './i18n.js';

// DOMINATION: three capture zones (A/B/C). Stand in a zone to flip it; owned
// zones tick points every second. First side to TARGET points wins. Enemies
// trickle-spawn near zones and guard them (limited aggro range) instead of
// hunting the player across the map.

const TARGET = 150;
const ZONE_R = 4.5;
const CAP_TIME = 3;
const COLORS = { neutral: 0x8a97a8, player: 0x27e8ff, enemy: 0xff4d4d };

class Zone {
  constructor(game, label, x, z) {
    this.game = game;
    this.label = label;
    this.x = x;
    this.z = z;
    this.owner = 'neutral';
    this.progress = 0;     // -CAP_TIME (enemy) .. +CAP_TIME (player)

    const ringGeo = new THREE.RingGeometry(ZONE_R - 0.5, ZONE_R, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      color: COLORS.neutral, transparent: true, opacity: 0.65,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeo, this.mat);
    this.ring.position.set(x, 0.08, z);
    game.scene.add(this.ring);

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g2 = c.getContext('2d');
    g2.font = 'bold 96px "Courier New", monospace';
    g2.textAlign = 'center';
    g2.fillStyle = '#ffffff';
    g2.fillText(label, 64, 96);
    const tex = new THREE.CanvasTexture(c);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false }));
    this.sprite.position.set(x, 4.2, z);
    this.sprite.scale.set(2.2, 2.2, 1);
    game.scene.add(this.sprite);

    this.light = new THREE.PointLight(COLORS.neutral, 30, 18, 1.8);
    this.light.position.set(x, 3, z);
    game.scene.add(this.light);
  }

  setOwner(owner) {
    if (this.owner === owner) return;
    this.owner = owner;
    this.mat.color.setHex(COLORS[owner]);
    this.light.color.setHex(COLORS[owner]);
    const g = this.game;
    g.hud.killfeed(t(owner === 'player' ? 'dom.captured' : 'dom.lost',
      { zone: this.label }), owner === 'player' ? 'cheat' : '');
    if (owner === 'player') g.audio.waveClear();
    else g.audio.enemyShot();
  }

  dispose() {
    const s = this.game.scene;
    s.remove(this.ring);
    s.remove(this.sprite);
    s.remove(this.light);
    this.ring.geometry.dispose();
    this.mat.dispose();
    this.sprite.material.map.dispose();
    this.sprite.material.dispose();
  }
}

export class DominationManager extends EnemyManager {
  constructor(game) {
    super(game);
    this.zones = [];
    this.playerPts = 0;
    this.enemyPts = 0;
    this.tick = 0;
    this.trickle = 0;
    this.aggroRange = 22;   // guards engage only nearby operatives
    this.done = false;
  }

  startGame() {
    this.reset();
    this.done = false;
    this.playerPts = 0;
    this.enemyPts = 0;
    this.mods = { hpMul: 1, speedMul: 1 };
    const labels = ['A', 'B', 'C'];
    this.zones = this.game.world.map.domPoints.map(
      ([x, z], i) => new Zone(this.game, labels[i], x, z));
    for (let i = 0; i < 5; i++) this._trickleSpawn();
    this.game.hud.setWave('0:0');
  }

  reset() {
    super.reset();
    for (const z of this.zones || []) z.dispose();
    this.zones = [];
  }

  forceNextWave() {
    for (let i = 0; i < 3; i++) this._trickleSpawn();
  }

  _trickleSpawn() {
    // spawn near a non-player-owned zone so guards keep pressure on objectives
    const pool = this.zones.filter((z) => z.owner !== 'player');
    const zone = (pool.length ? pool : this.zones)[
      Math.floor(Math.random() * (pool.length ? pool.length : this.zones.length))];
    const world = this.game.world;
    let point = world.spawnPoints[0];
    let bd = Infinity;
    for (const p of world.spawnPoints) {
      const d = zone ? Math.hypot(p.x - zone.x, p.z - zone.z) : 0;
      if (d < bd && p.distanceTo(this.game.player.position) > 14) { bd = d; point = p; }
    }
    const pos = point.clone();
    pos.x += (Math.random() - 0.5) * 4;
    pos.z += (Math.random() - 0.5) * 4;
    const types = ['grunt', 'grunt', 'ranger', 'tank'];
    this._spawnAt(types[Math.floor(Math.random() * types.length)], pos);
  }

  _spawnAt(typeName, pos) {
    // reuse the parent spawner but at an explicit position
    const saved = this.game.world.spawnPoints;
    this.game.world.spawnPoints = [pos];
    this._spawnOne(typeName);
    this.game.world.spawnPoints = saved;
  }

  update(dt) {
    if (this.done) return;

    // zone control
    const p = this.game.player;
    for (const z of this.zones) {
      const pIn = p.alive && Math.hypot(p.position.x - z.x, p.position.z - z.z) < ZONE_R;
      const eIn = this.list.some((e) => e.alive &&
        Math.hypot(e.position.x - z.x, e.position.z - z.z) < ZONE_R);
      if (pIn && !eIn) z.progress = Math.min(CAP_TIME, z.progress + dt);
      else if (eIn && !pIn) z.progress = Math.max(-CAP_TIME, z.progress - dt);
      if (z.progress >= CAP_TIME) z.setOwner('player');
      else if (z.progress <= -CAP_TIME) z.setOwner('enemy');
      z.sprite.material.opacity = 0.6 + Math.sin(performance.now() / 300) * 0.2;
    }

    // scoring
    this.tick += dt;
    if (this.tick >= 1) {
      this.tick -= 1;
      for (const z of this.zones) {
        if (z.owner === 'player') this.playerPts++;
        else if (z.owner === 'enemy') this.enemyPts++;
      }
      this.game.hud.setWave(`${this.playerPts}:${this.enemyPts}`);
      if (this.playerPts >= TARGET || this.enemyPts >= TARGET) {
        this.done = true;
        const win = this.playerPts >= TARGET;
        if (win) this.game.addScore(2000);
        this.game.domFinished(win);
        return;
      }
    }

    // keep guards populated
    this.trickle -= dt;
    if (this.trickle <= 0 && this.aliveCount() < 7) {
      this.trickle = 2.5;
      this._trickleSpawn();
    }

    // enemies + projectiles (no wave machine)
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.update(dt)) {
        this.byId.delete(e.id);
        e.dispose();
        this.list.splice(i, 1);
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].update(dt)) {
        this.projectiles[i].dispose();
        this.projectiles.splice(i, 1);
      }
    }
    this.game.hud.setEnemiesLeft(this.aliveCount());
    this.game.hud.subbanner(
      t('dom.status', { p: this.playerPts, e: this.enemyPts, n: TARGET }));
  }
}
