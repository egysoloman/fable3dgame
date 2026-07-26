import * as THREE from 'three';
import { EnemyManager } from './enemies.js';
import { BotPlayer, DIFFICULTY } from './bots.js';
import { t } from './i18n.js';

// DOMINATION with bot teams: an enemy squad of AI soldiers captures and
// defends zones against you and an allied AI teammate. Zones flip after 3 s
// of uncontested presence; owned zones tick a point per second; first side
// to TARGET wins. Bots push their assigned objective when out of contact and
// fight with the shared virtual-player combat model (see docs/AI.md).

const TARGET = 150;
const ZONE_R = 4.5;
const CAP_TIME = 3;
const COLORS = { neutral: 0x8a97a8, player: 0x27e8ff, enemy: 0xff4d4d };
const ENEMY_SQUAD = 3;

export class Zone {
  constructor(game, label, x, z, quiet = false) {
    this.game = game;
    this.label = label;
    this.quiet = quiet;
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
    if (this.quiet) return;
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
    this.enemyBots = [];
    this.allyBot = null;
    this.playerPts = 0;
    this.enemyPts = 0;
    this.tick = 0;
    this.assignTimer = 0;
    this.playerRespawn = 0;
    this.done = false;
  }

  // ---- manager read interface: the enemy team is what you can shoot ----
  get list() { return this.enemyBots; }
  set list(v) { /* parent constructor writes []; team arrays own state */ }
  get byId() { return new Map(this.enemyBots.map((b) => [b.id, b])); }
  set byId(v) { /* ignored */ }

  aliveGroups() {
    return this.enemyBots
      .filter((b) => b.alive && b.spawnTimer <= 0).map((b) => b.group);
  }

  aliveCount() {
    return this.enemyBots.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
  }

  teammates() {
    return this.allyBot && this.allyBot.alive ? [this.allyBot] : [];
  }

  forceNextWave() { /* fixed squads in domination */ }

  startGame() {
    this.reset();
    this.done = false;
    this.playerPts = 0;
    this.enemyPts = 0;
    const labels = ['A', 'B', 'C'];
    this.zones = this.game.world.map.domPoints.map(
      ([x, z], i) => new Zone(this.game, labels[i], x, z));

    const diff = DIFFICULTY[this.game.setup.difficulty] || DIFFICULTY.normal;
    for (let i = 0; i < ENEMY_SQUAD; i++) {
      this.enemyBots.push(new BotPlayer(
        this.game, this, `dom-e${i}`, `RAID-${i + 1}`, 0xd84a3b, diff, 'enemies'));
    }
    this.allyBot = new BotPlayer(
      this.game, this, 'dom-ally', 'COBALT', 0x27b8d8, diff, 'allies');
    this._assignObjectives();
    this.game.hud.setWave('0:0');
  }

  reset() {
    for (const z of this.zones || []) z.dispose();
    this.zones = [];
    for (const b of this.enemyBots || []) b.dispose();
    this.enemyBots = [];
    if (this.allyBot) {
      this.allyBot.dispose();
      this.allyBot = null;
    }
  }

  // BotPlayer hooks -----------------------------------------------------
  get bots() { return [...this.enemyBots, this.allyBot].filter(Boolean); }

  targetsFor(bot) {
    const out = [];
    if (bot.team === 'enemies') {
      const p = this.game.player;
      if (p.alive) out.push({ isPlayer: true, position: p.position, eyeY: 1.6 });
      if (this.allyBot && this.allyBot.alive && this.allyBot.spawnTimer <= 0) {
        out.push({ isPlayer: false, bot: this.allyBot,
          position: this.allyBot.position, eyeY: 1.55 });
      }
    } else {
      for (const b of this.enemyBots) {
        if (b.alive && b.spawnTimer <= 0) {
          out.push({ isPlayer: false, bot: b, position: b.position, eyeY: 1.55 });
        }
      }
    }
    return out;
  }

  spawnFor(bot) {
    const pts = this.game.world.spawnPoints;
    const p = this.game.player.position;
    if (bot.team === 'allies') {
      // redeploy near the player's side of the map
      let best = pts[0], bd = Infinity;
      for (const q of pts) {
        const d = q.distanceTo(p);
        if (d > 8 && d < bd) { bd = d; best = q; }
      }
      return best.clone();
    }
    // enemies: far from the player, near a zone they should hold
    const far = pts.filter((q) => q.distanceTo(p) > 20);
    const pool = far.length ? far : pts;
    return pool[Math.floor(Math.random() * pool.length)].clone();
  }

  onKill(killerId, victimId) {
    const names = { me: this.game.mp.name };
    for (const b of this.bots) names[b.id] = b.name;
    if (killerId === 'me') {
      this.game.addScore(150);
      this.game.addKillMp();
    }
    this.game.hud.killfeed(t('mp.playerKilled', {
      player: names[killerId] || '?', enemy: names[victimId] || '?' }));
  }

  creditPlayerDeath(botId) {
    this.onKill(botId, 'me');
  }

  onPlayerDeath() {
    this.playerRespawn = 2.5;
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    document.getElementById('spectate-note').classList.add('visible');
  }

  // ---------------------------------------------------------------------
  _assignObjectives() {
    // enemies: spread across zones the enemy team doesn't own yet, defend otherwise
    const targets = this.zones.filter((z) => z.owner !== 'enemy');
    const held = this.zones.filter((z) => z.owner === 'enemy');
    this.enemyBots.forEach((b, i) => {
      const pool = targets.length ? targets : held.length ? held : this.zones;
      const z = pool[i % pool.length];
      if (z) b.objective = new THREE.Vector3(z.x, 0, z.z);
    });
    // ally: push the nearest zone the player's team doesn't own
    if (this.allyBot) {
      const want = this.zones.filter((z) => z.owner !== 'player');
      const pool = want.length ? want : this.zones;
      let best = pool[0], bd = Infinity;
      for (const z of pool) {
        const d = Math.hypot(z.x - this.allyBot.position.x, z.z - this.allyBot.position.z);
        if (d < bd) { bd = d; best = z; }
      }
      if (best) this.allyBot.objective = new THREE.Vector3(best.x, 0, best.z);
    }
  }

  update(dt) {
    if (this.done) return;

    // player redeploy
    if (this.playerRespawn > 0) {
      this.playerRespawn -= dt;
      this.game.hud.subbanner(t('strike.redeploy', { s: Math.ceil(this.playerRespawn) }));
      if (this.playerRespawn <= 0) {
        const pl = this.game.player;
        const sp = this.game.world.map.playerSpawn;
        pl.alive = true;
        pl.hp = pl.maxHp;
        pl.armor = this.game.hasEquip('plates') ? 50 : 0;
        pl.position.set(sp[0] + (Math.random() - 0.5) * 4, 0, sp[1]);
        pl.timeSinceDamage = 999;
        this.game.hud.setHealth(pl.hp, pl.maxHp);
        this.game.hud.setArmor(pl.armor);
        this.game.hud.subbanner('');
        this.game.weapons.rig.visible = true;
        document.getElementById('spectate-note').classList.remove('visible');
        this.game.resetStreak();
      }
    }

    this.assignTimer -= dt;
    if (this.assignTimer <= 0) {
      this.assignTimer = 2;
      this._assignObjectives();
    }

    // zone control: both teams' bots count
    const p = this.game.player;
    for (const z of this.zones) {
      const allyIn = (p.alive && Math.hypot(p.position.x - z.x, p.position.z - z.z) < ZONE_R) ||
        (this.allyBot && this.allyBot.alive &&
          Math.hypot(this.allyBot.position.x - z.x, this.allyBot.position.z - z.z) < ZONE_R);
      const enemyIn = this.enemyBots.some((b) => b.alive &&
        Math.hypot(b.position.x - z.x, b.position.z - z.z) < ZONE_R);
      if (allyIn && !enemyIn) z.progress = Math.min(CAP_TIME, z.progress + dt);
      else if (enemyIn && !allyIn) z.progress = Math.max(-CAP_TIME, z.progress - dt);
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

    for (const b of this.bots) b.update(dt);

    this.game.hud.setEnemiesLeft(this.aliveCount());
    if (this.playerRespawn <= 0) {
      this.game.hud.subbanner(
        t('dom.status', { p: this.playerPts, e: this.enemyPts, n: TARGET }));
    }
  }
}
