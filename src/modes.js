import * as THREE from 'three';
import { EnemyManager } from './enemies.js';
import { BotPlayer, DIFFICULTY } from './bots.js';
import { WEAPON_DEFS } from './weapons.js';
import { Zone } from './domination.js';
import { t } from './i18n.js';

// Additional bot-filled modes: Capture the Flag, Hardpoint, Gun Game,
// Search & Destroy, and Infection. Team modes share TeamBotMode: your
// fireteam of ally bots against an enemy squad, all using the shared
// virtual-player combat model (see docs/AI.md).

// ---------------------------------------------------------------------------
class TeamBotMode extends EnemyManager {
  constructor(game) {
    super(game);
    this.enemyBots = [];
    this.allyBots = [];
    this.playerRespawn = 0;
    this.done = false;
  }

  get list() { return this.enemyBots; }
  set list(v) { /* team arrays own state */ }
  get byId() { return new Map(this.enemyBots.map((b) => [b.id, b])); }
  set byId(v) { /* ignored */ }
  get bots() { return [...this.enemyBots, ...this.allyBots]; }

  aliveGroups() {
    return this.enemyBots
      .filter((b) => b.alive && b.spawnTimer <= 0).map((b) => b.group);
  }

  aliveCount() {
    return this.enemyBots.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
  }

  teammates() { return this.allyBots.filter((b) => b.alive); }
  forceNextWave() { /* fixed squads */ }

  _spawnSquads(nEnemy, nAlly, prefix) {
    const diff = DIFFICULTY[this.game.setup.difficulty] || DIFFICULTY.normal;
    for (let i = 0; i < nEnemy; i++) {
      this.enemyBots.push(new BotPlayer(
        this.game, this, `${prefix}-e${i}`, `RAID-${i + 1}`, 0xd84a3b, diff, 'enemies'));
    }
    const names = ['COBALT', 'VECTOR', 'ECHO'];
    for (let i = 0; i < nAlly; i++) {
      this.allyBots.push(new BotPlayer(
        this.game, this, `${prefix}-a${i}`, names[i] || `ALLY-${i}`, 0x27b8d8, diff, 'allies'));
    }
  }

  reset() {
    for (const b of this.enemyBots || []) b.dispose();
    this.enemyBots = [];
    for (const b of this.allyBots || []) b.dispose();
    this.allyBots = [];
  }

  targetsFor(bot) {
    const out = [];
    if (bot.team === 'enemies') {
      const p = this.game.player;
      if (p.alive) out.push({ isPlayer: true, position: p.position, eyeY: 1.6 });
      for (const b of this.allyBots) {
        if (b.alive && b.spawnTimer <= 0) {
          out.push({ isPlayer: false, bot: b, position: b.position, eyeY: 1.55 });
        }
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
      let best = pts[0], bd = Infinity;
      for (const q of pts) {
        const d = q.distanceTo(p);
        if (d > 8 && d < bd) { bd = d; best = q; }
      }
      return best.clone();
    }
    const far = pts.filter((q) => q.distanceTo(p) > 25);
    const pool = far.length ? far : pts;
    return pool[Math.floor(Math.random() * pool.length)].clone();
  }

  creditPlayerDeath(botId) { this.onKill(botId, 'me'); }

  _names() {
    const names = { me: this.game.mp.name };
    for (const b of this.bots) names[b.id] = b.name;
    return names;
  }

  onPlayerDeath() {
    this.playerRespawn = 2.5;
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    document.getElementById('spectate-note').classList.add('visible');
  }

  _respawnTick(dt) {
    if (this.playerRespawn <= 0) return false;
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
    return true;
  }

  _finish(win) {
    if (this.done) return;
    this.done = true;
    if (win) this.game.addScore(2000);
    this.game.modeFinished(win);
  }
}

// ---------------------------------------------------------------------------
// CAPTURE THE FLAG: steal the enemy banner and run it home while an enemy
// runner does the same. Kills drop the flag where the carrier fell.
const CTF_CAPS = 3;
const CTF_TIME = 300;

class Flag {
  constructor(game, x, z, color) {
    this.game = game;
    this.home = new THREE.Vector3(x, 0, z);
    this.pos = this.home.clone();
    this.carrier = null;      // null | 'me' | BotPlayer
    this.returnTimer = 0;     // > 0 while dropped

    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 3.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.5, metalness: 0.6 }));
    pole.position.y = 1.6;
    g.add(pole);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.7, 0.06),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.9 }));
    banner.position.set(0.66, 2.7, 0);
    g.add(banner);
    this.light = new THREE.PointLight(color, 40, 14, 1.8);
    this.light.position.y = 3;
    g.add(this.light);
    this.group = g;
    game.scene.add(g);
    this._sync();
  }

  get atBase() { return !this.carrier && this.returnTimer <= 0 && this.pos.equals(this.home); }
  get dropped() { return !this.carrier && this.returnTimer > 0; }

  drop(at) {
    this.carrier = null;
    this.pos.set(at.x, 0, at.z);
    this.returnTimer = 12;
    this._sync();
  }

  sendHome() {
    this.carrier = null;
    this.returnTimer = 0;
    this.pos.copy(this.home);
    this._sync();
  }

  _sync() {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.visible = true;
  }

  followCarrier(game) {
    const at = this.carrier === 'me'
      ? game.player.position : this.carrier.position;
    this.pos.set(at.x, 0, at.z);
    this.group.position.set(at.x, 0.6, at.z);
  }

  dispose() {
    this.game.scene.remove(this.group);
  }
}

export class CtfManager extends TeamBotMode {
  startGame() {
    this.reset();
    this.done = false;
    this.playerCaps = 0;
    this.enemyCaps = 0;
    this.timeLeft = CTF_TIME;
    this.assignTimer = 0;
    const sp = this.game.world.map.playerSpawn;
    this.playerBase = new THREE.Vector3(sp[0], 0, sp[1]);
    this.enemyBase = new THREE.Vector3(-sp[0], 0, -sp[1]);
    this.playerFlag = new Flag(this.game, sp[0], sp[1], 0x27b8d8);
    this.enemyFlag = new Flag(this.game, -sp[0], -sp[1], 0xd84a3b);
    this._spawnSquads(3, 2, 'ctf');
    this.game.hud.setWave('0:0');
  }

  reset() {
    super.reset();
    if (this.playerFlag) { this.playerFlag.dispose(); this.playerFlag = null; }
    if (this.enemyFlag) { this.enemyFlag.dispose(); this.enemyFlag = null; }
  }

  onKill(killerId, victimId) {
    const names = this._names();
    if (killerId === 'me') { this.game.addScore(150); this.game.addKillMp(); }
    // a dead carrier drops the banner on the spot
    const victimBot = this.bots.find((b) => b.id === victimId);
    if (this.playerFlag.carrier && this.playerFlag.carrier !== 'me' &&
        this.playerFlag.carrier.id === victimId) {
      this.playerFlag.drop(this.playerFlag.carrier.position);
      this.game.hud.killfeed(t('ctf.dropped'), 'cheat');
    }
    if (victimId === 'me' && this.enemyFlag.carrier === 'me') {
      this.enemyFlag.drop(this.game.player.position);
    }
    if (victimBot && this.enemyFlag.carrier === victimBot) {
      this.enemyFlag.drop(victimBot.position);
    }
    this.game.hud.killfeed(t('mp.playerKilled', {
      player: names[killerId] || '?', enemy: names[victimId] || '?' }));
  }

  onPlayerDeath() {
    if (this.enemyFlag.carrier === 'me') this.enemyFlag.drop(this.game.player.position);
    super.onPlayerDeath();
  }

  _score(team) {
    if (team === 'player') {
      this.playerCaps++;
      this.enemyFlag.sendHome();
      this.game.addScore(500);
      this.game.audio.waveClear();
      this.game.hud.killfeed(t('ctf.captured'), 'cheat');
    } else {
      this.enemyCaps++;
      this.playerFlag.sendHome();
      this.game.audio.enemyShot();
      this.game.hud.killfeed(t('ctf.lost'), '');
    }
    this.game.hud.setWave(`${this.playerCaps}:${this.enemyCaps}`);
    if (this.playerCaps >= CTF_CAPS) this._finish(true);
    else if (this.enemyCaps >= CTF_CAPS) this._finish(false);
  }

  update(dt) {
    if (this.done) return;
    this._respawnTick(dt);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this._finish(this.playerCaps >= this.enemyCaps);
      return;
    }

    const p = this.game.player;
    const pf = this.playerFlag, ef = this.enemyFlag;

    // dropped flags tick home
    for (const f of [pf, ef]) {
      if (f.dropped) {
        f.returnTimer -= dt;
        if (f.returnTimer <= 0) f.sendHome();
      }
    }

    // the player grabs, returns, and captures
    if (p.alive) {
      const dEf = Math.hypot(p.position.x - ef.pos.x, p.position.z - ef.pos.z);
      if (!ef.carrier && dEf < 2.4) {
        ef.carrier = 'me';
        this.game.hud.killfeed(t('ctf.taken'), 'cheat');
      }
      const dPfDrop = Math.hypot(p.position.x - pf.pos.x, p.position.z - pf.pos.z);
      if (pf.dropped && dPfDrop < 2.4) {
        pf.sendHome();
        this.game.hud.killfeed(t('ctf.returned'), 'cheat');
      }
      const dHome = Math.hypot(p.position.x - this.playerBase.x, p.position.z - this.playerBase.z);
      if (ef.carrier === 'me' && dHome < 3.2 && pf.atBase) this._score('player');
    }

    // enemy runner: RAID-1 hunts your banner and runs it home
    const runner = this.enemyBots[0];
    if (runner && runner.alive && runner.spawnTimer <= 0) {
      if (pf.carrier === runner) {
        runner.objective = this.enemyBase.clone();
        const dHome = Math.hypot(runner.position.x - this.enemyBase.x,
          runner.position.z - this.enemyBase.z);
        if (dHome < 3.2) this._score('enemy');
      } else if (!pf.carrier) {
        runner.objective = new THREE.Vector3(pf.pos.x, 0, pf.pos.z);
        const d = Math.hypot(runner.position.x - pf.pos.x, runner.position.z - pf.pos.z);
        if (d < 2.4) {
          pf.carrier = runner;
          this.game.hud.killfeed(t('ctf.stolen'), '');
        }
      }
    }
    this.assignTimer -= dt;
    if (this.assignTimer <= 0) {
      this.assignTimer = 2;
      for (let i = 1; i < this.enemyBots.length; i++) {
        this.enemyBots[i].objective = new THREE.Vector3(ef.home.x, 0, ef.home.z);
      }
      for (const a of this.allyBots) {
        a.objective = pf.carrier && pf.carrier !== 'me'
          ? new THREE.Vector3(pf.pos.x, 0, pf.pos.z)
          : new THREE.Vector3(ef.home.x, 0, ef.home.z);
      }
    }

    if (pf.carrier && pf.carrier !== 'me') pf.followCarrier(this.game);
    if (ef.carrier) ef.followCarrier(this.game);

    for (const b of this.bots) b.update(dt);
    this.game.hud.setEnemiesLeft(this.aliveCount());
    if (this.playerRespawn <= 0) {
      this.game.hud.subbanner(t('ctf.status', {
        p: this.playerCaps, e: this.enemyCaps, n: CTF_CAPS }));
    }
  }
}

// ---------------------------------------------------------------------------
// HARDPOINT: one contested zone that relocates on a timer; only the team
// alone inside scores. First to HP_TARGET points wins.
const HP_TARGET = 120;
const HP_ROTATE = 40;

export class HardpointManager extends TeamBotMode {
  startGame() {
    this.reset();
    this.done = false;
    this.playerPts = 0;
    this.enemyPts = 0;
    this.zoneIdx = 0;
    this.rotateIn = HP_ROTATE;
    this.tick = 0;
    this.owner = 'neutral';
    this.hold = 0;
    this._makeZone();
    this._spawnSquads(3, 2, 'hp');
    this.game.hud.setWave('0:0');
  }

  _makeZone() {
    if (this.zone) this.zone.dispose();
    const pts = this.game.world.map.domPoints;
    const [x, z] = pts[this.zoneIdx % pts.length];
    this.zone = new Zone(this.game, 'H', x, z, true);
    for (const b of this.bots) b.objective = new THREE.Vector3(x, 0, z);
  }

  reset() {
    super.reset();
    if (this.zone) { this.zone.dispose(); this.zone = null; }
  }

  onKill(killerId, victimId) {
    const names = this._names();
    if (killerId === 'me') { this.game.addScore(150); this.game.addKillMp(); }
    this.game.hud.killfeed(t('mp.playerKilled', {
      player: names[killerId] || '?', enemy: names[victimId] || '?' }));
  }

  update(dt) {
    if (this.done) return;
    this._respawnTick(dt);

    this.rotateIn -= dt;
    if (this.rotateIn <= 0) {
      this.rotateIn = HP_ROTATE;
      this.zoneIdx++;
      this._makeZone();
      this.game.hud.killfeed(t('hp.moved'), 'cheat');
    }

    const z = this.zone;
    const p = this.game.player;
    const inZone = (px, pz) => Math.hypot(px - z.x, pz - z.z) < 4.5;
    const allyIn = (p.alive && inZone(p.position.x, p.position.z)) ||
      this.allyBots.some((b) => b.alive && b.spawnTimer <= 0 && inZone(b.position.x, b.position.z));
    const enemyIn = this.enemyBots.some((b) =>
      b.alive && b.spawnTimer <= 0 && inZone(b.position.x, b.position.z));
    if (allyIn && !enemyIn) z.setOwner('player');
    else if (enemyIn && !allyIn) z.setOwner('enemy');
    else if (allyIn && enemyIn) z.setOwner('neutral'); // contested

    this.tick += dt;
    if (this.tick >= 1) {
      this.tick -= 1;
      if (z.owner === 'player') this.playerPts++;
      else if (z.owner === 'enemy') this.enemyPts++;
      this.game.hud.setWave(`${this.playerPts}:${this.enemyPts}`);
      if (this.playerPts >= HP_TARGET) { this._finish(true); return; }
      if (this.enemyPts >= HP_TARGET) { this._finish(false); return; }
    }

    for (const b of this.bots) {
      b.objective = new THREE.Vector3(z.x, 0, z.z);
      b.update(dt);
    }
    this.game.hud.setEnemiesLeft(this.aliveCount());
    if (this.playerRespawn <= 0) {
      this.game.hud.subbanner(t('hp.status', {
        p: this.playerPts, e: this.enemyPts, n: HP_TARGET, s: Math.ceil(this.rotateIn) }));
    }
  }
}

// ---------------------------------------------------------------------------
// GUN GAME: free-for-all where every kill advances you to the next weapon.
// First through the whole ladder wins.
export const GUN_LADDER = ['pistol', 'mpistol', 'smg', 'vector', 'rifle', 'akr',
  'shotgun', 'dmr', 'sks', 'lmg', 'carbine', 'revolver'];

export class GunGameManager extends EnemyManager {
  constructor(game) {
    super(game);
    this.botsArr = [];
    this.levels = new Map();
    this.playerRespawn = 0;
    this.done = false;
  }

  get list() { return this.botsArr; }
  set list(v) { /* ignored */ }
  get byId() { return new Map(this.botsArr.map((b) => [b.id, b])); }
  set byId(v) { /* ignored */ }
  get bots() { return this.botsArr; }

  aliveGroups() {
    return this.botsArr.filter((b) => b.alive && b.spawnTimer <= 0).map((b) => b.group);
  }

  aliveCount() { return this.botsArr.reduce((n, b) => n + (b.alive ? 1 : 0), 0); }
  teammates() { return []; }
  forceNextWave() { /* no waves */ }

  startGame() {
    this.reset();
    this.done = false;
    this.levels = new Map([['me', 0]]);
    const diff = DIFFICULTY[this.game.setup.difficulty] || DIFFICULTY.normal;
    const names = ['ROOK', 'HALO', 'ONYX'];
    for (let i = 0; i < 3; i++) {
      const b = new BotPlayer(this.game, this, `gg-${i}`, names[i], 0xd88a3b, diff, null);
      b.weapon = WEAPON_DEFS.find((d) => d.id === GUN_LADDER[0]);
      b.mag = b.weapon.magSize;
      this.botsArr.push(b);
      this.levels.set(b.id, 0);
    }
    this.game.weapons.overrideCarry(GUN_LADDER[0]);
    this.game.hud.setWave(`1/${GUN_LADDER.length}`);
  }

  reset() {
    for (const b of this.botsArr || []) b.dispose();
    this.botsArr = [];
    if (this.game.weapons) this.game.weapons.clearCarryOverride();
  }

  _advance(id) {
    const lvl = (this.levels.get(id) || 0) + 1;
    this.levels.set(id, lvl);
    if (lvl >= GUN_LADDER.length) {
      this.done = true;
      if (id === 'me') this.game.addScore(2000);
      this.game.modeFinished(id === 'me');
      return;
    }
    if (id === 'me') {
      this.game.weapons.overrideCarry(GUN_LADDER[lvl]);
      this.game.hud.setWave(`${lvl + 1}/${GUN_LADDER.length}`);
      this.game.hud.killfeed(t('gg.advance', {
        weapon: t(`weapon.${GUN_LADDER[lvl]}`) }), 'cheat');
    } else {
      const bot = this.botsArr.find((b) => b.id === id);
      if (bot) {
        bot.weapon = WEAPON_DEFS.find((d) => d.id === GUN_LADDER[lvl]);
        bot.mag = bot.weapon.magSize;
      }
    }
  }

  onKill(killerId, victimId) {
    const names = { me: this.game.mp.name };
    for (const b of this.botsArr) names[b.id] = b.name;
    if (killerId === 'me') { this.game.addScore(100); this.game.addKillMp(); }
    this.game.hud.killfeed(t('mp.playerKilled', {
      player: names[killerId] || '?', enemy: names[victimId] || '?' }));
    this._advance(killerId);
  }

  creditPlayerDeath(botId) { this.onKill(botId, 'me'); }

  onPlayerDeath() {
    this.playerRespawn = 2.5;
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    document.getElementById('spectate-note').classList.add('visible');
  }

  update(dt) {
    if (this.done) return;
    if (this.playerRespawn > 0) {
      this.playerRespawn -= dt;
      this.game.hud.subbanner(t('strike.redeploy', { s: Math.ceil(this.playerRespawn) }));
      if (this.playerRespawn <= 0) {
        const pl = this.game.player;
        const pts = this.game.world.spawnPoints;
        const sp = pts[Math.floor(Math.random() * pts.length)];
        pl.alive = true;
        pl.hp = pl.maxHp;
        pl.armor = this.game.hasEquip('plates') ? 50 : 0;
        pl.position.set(sp.x, 0, sp.z);
        pl.timeSinceDamage = 999;
        this.game.hud.setHealth(pl.hp, pl.maxHp);
        this.game.hud.setArmor(pl.armor);
        this.game.hud.subbanner('');
        this.game.weapons.rig.visible = true;
        document.getElementById('spectate-note').classList.remove('visible');
        this.game.resetStreak();
      }
    }
    for (const b of this.botsArr) b.update(dt);
    this.game.hud.setEnemiesLeft(this.aliveCount());
    if (this.playerRespawn <= 0) {
      const lvl = this.levels.get('me') || 0;
      this.game.hud.subbanner(t('gg.status', {
        n: lvl + 1, total: GUN_LADDER.length,
        weapon: t(`weapon.${GUN_LADDER[Math.min(lvl, GUN_LADDER.length - 1)]}`) }));
    }
  }
}

// ---------------------------------------------------------------------------
// SEARCH & DESTROY: plant the charge at site A or B (hold near it, press F),
// then keep the defenders off it. Defenders defuse by standing on the bomb.
const SND_ROUNDS = 3;      // first to 3 round wins
const SND_ROUND_TIME = 90;
const SND_PLANT_TIME = 2.5;
const SND_BOMB_TIME = 35;
const SND_DEFUSE_TIME = 4;

export class SndManager extends TeamBotMode {
  startGame() {
    this.reset();
    this.done = false;
    this.playerRounds = 0;
    this.enemyRounds = 0;
    this.sites = this.game.world.map.domPoints.slice(0, 2)
      .map(([x, z], i) => new Zone(this.game, i === 0 ? 'A' : 'B', x, z, true));
    this._spawnSquads(3, 1, 'snd');
    this._beginRound();
  }

  reset() {
    super.reset();
    for (const s of this.sites || []) s.dispose();
    this.sites = [];
  }

  _beginRound() {
    this.roundTime = SND_ROUND_TIME;
    this.planted = false;
    this.plantProgress = 0;
    this.bombTimer = 0;
    this.defuseProgress = 0;
    this.bombSite = null;
    this.roundOver = false;
    for (const s of this.sites) s.setOwner('neutral');
    const pl = this.game.player;
    const sp = this.game.world.map.playerSpawn;
    pl.alive = true;
    pl.hp = pl.maxHp;
    pl.armor = this.game.hasEquip('plates') ? 50 : 0;
    pl.position.set(sp[0], 0, sp[1]);
    pl.timeSinceDamage = 999;
    this.game.hud.setHealth(pl.hp, pl.maxHp);
    this.game.weapons.rig.visible = true;
    document.getElementById('spectate-note').classList.remove('visible');
    for (const b of this.bots) b.respawn();
    // defenders split across the two sites
    this.enemyBots.forEach((b, i) => {
      const s = this.sites[i % this.sites.length];
      b.objective = new THREE.Vector3(s.x, 0, s.z);
    });
    this.game.hud.setWave(`${this.playerRounds}:${this.enemyRounds}`);
    this.game.hud.banner(t('snd.round', { n: this.playerRounds + this.enemyRounds + 1 }), '');
    this.game.hud.bannerFadeSoon();
  }

  _endRound(win) {
    if (this.roundOver) return;
    this.roundOver = true;
    if (win) this.playerRounds++;
    else this.enemyRounds++;
    this.game.hud.setWave(`${this.playerRounds}:${this.enemyRounds}`);
    this.game.hud.killfeed(t(win ? 'snd.roundWon' : 'snd.roundLost'), win ? 'cheat' : '');
    if (this.playerRounds >= SND_ROUNDS) { this._finish(true); return; }
    if (this.enemyRounds >= SND_ROUNDS) { this._finish(false); return; }
    setTimeout(() => { if (!this.done && this.game.mode === 'snd') this._beginRound(); }, 1800);
  }

  onKill(killerId, victimId) {
    const names = this._names();
    if (killerId === 'me') { this.game.addScore(150); this.game.addKillMp(); }
    this.game.hud.killfeed(t('mp.playerKilled', {
      player: names[killerId] || '?', enemy: names[victimId] || '?' }));
  }

  onPlayerDeath() {
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    // single life per round: unless the charge is already down, that's it
    if (!this.planted) this._endRound(false);
  }

  update(dt) {
    if (this.done || this.roundOver) return;
    const p = this.game.player;

    this.roundTime -= dt;
    if (this.roundTime <= 0 && !this.planted) { this._endRound(false); return; }

    if (!this.planted) {
      // planting: stand on a site and hold F
      const near = this.sites.find((s) =>
        p.alive && Math.hypot(p.position.x - s.x, p.position.z - s.z) < 4.5);
      if (near && p.keys.has('KeyF')) {
        this.plantProgress += dt;
        this.game.hud.subbanner(t('snd.planting', {
          s: Math.ceil(SND_PLANT_TIME - this.plantProgress) }));
        if (this.plantProgress >= SND_PLANT_TIME) {
          this.planted = true;
          this.bombSite = near;
          this.bombTimer = SND_BOMB_TIME;
          near.setOwner('player');
          this.game.audio.grenadeThrow();
          this.game.hud.killfeed(t('snd.planted'), 'cheat');
          for (const b of this.enemyBots) {
            b.objective = new THREE.Vector3(near.x, 0, near.z);
          }
        }
      } else {
        this.plantProgress = 0;
        if (p.alive) {
          this.game.hud.subbanner(t('snd.objective', { s: Math.ceil(this.roundTime) }));
        }
      }
    } else {
      // the charge is down: defenders swarm it and try to defuse
      this.bombTimer -= dt;
      const defusing = this.enemyBots.some((b) => b.alive && b.spawnTimer <= 0 &&
        Math.hypot(b.position.x - this.bombSite.x, b.position.z - this.bombSite.z) < 3.2);
      if (defusing) this.defuseProgress += dt;
      else this.defuseProgress = Math.max(0, this.defuseProgress - dt * 0.5);
      if (this.defuseProgress >= SND_DEFUSE_TIME) {
        this.bombSite.setOwner('enemy');
        this._endRound(false);
        return;
      }
      if (this.bombTimer <= 0) {
        this.game.applySplash(new THREE.Vector3(this.bombSite.x, 0.5, this.bombSite.z), 12, 250);
        this.game.player.addShake(0.3);
        this._endRound(true);
        return;
      }
      this.game.hud.subbanner(t(defusing ? 'snd.defusing' : 'snd.armed',
        { s: Math.ceil(this.bombTimer) }));
    }

    for (const b of this.bots) b.update(dt);
    this.game.hud.setEnemiesLeft(this.aliveCount());
  }
}

// ---------------------------------------------------------------------------
// INFECTION: survive the outbreak. One fast clawed hunter starts infected;
// every kill turns the victim. If it gets you, you hunt your old squad.
const INF_TIME = 180;

export class InfectionManager extends TeamBotMode {
  startGame() {
    this.reset();
    this.done = false;
    this.timeLeft = INF_TIME;
    this.playerInfected = false;
    this.game.meleeOnlyPlayer = false;
    const diff = DIFFICULTY[this.game.setup.difficulty] || DIFFICULTY.normal;
    const names = ['ROOK', 'HALO', 'ONYX', 'DRIFT', 'JINX'];
    for (let i = 0; i < 5; i++) {
      this.allyBots.push(new BotPlayer(
        this.game, this, `inf-s${i}`, names[i], 0x27b8d8, diff, 'allies'));
    }
    const hunter = new BotPlayer(
      this.game, this, 'inf-z0', 'PATIENT-0', 0x4ad84a, diff, 'enemies');
    this._infect(hunter);
    this.enemyBots.push(hunter);
    this.game.hud.setWave(`${this.allyBots.length + 1}`);
  }

  _infect(bot) {
    bot.team = 'enemies';
    bot.meleeOnly = true;
    bot.speedMul = 1.35;
    bot.maxHp = Math.round(bot.maxHp * 1.5);
    bot.parts.bodyMat.color.setHex(0x4ad84a);
    bot.parts.bodyMat.emissive.setHex(0x123812);
  }

  // player can hit whichever side is hostile to them right now
  get list() { return this.playerInfected ? this.allyBots : this.enemyBots; }
  set list(v) { /* ignored */ }
  teammates() {
    return this.playerInfected ? [] : this.allyBots.filter((b) => b.alive);
  }

  aliveGroups() {
    return this.list.filter((b) => b.alive && b.spawnTimer <= 0).map((b) => b.group);
  }

  aliveCount() { return this.list.reduce((n, b) => n + (b.alive ? 1 : 0), 0); }

  targetsFor(bot) {
    const out = [];
    const p = this.game.player;
    if (bot.team === 'enemies') {
      if (p.alive && !this.playerInfected) {
        out.push({ isPlayer: true, position: p.position, eyeY: 1.6 });
      }
      for (const b of this.allyBots) {
        if (b.alive && b.spawnTimer <= 0) {
          out.push({ isPlayer: false, bot: b, position: b.position, eyeY: 1.55 });
        }
      }
    } else {
      if (p.alive && this.playerInfected) {
        out.push({ isPlayer: true, position: p.position, eyeY: 1.6 });
      }
      for (const b of this.enemyBots) {
        if (b.alive && b.spawnTimer <= 0) {
          out.push({ isPlayer: false, bot: b, position: b.position, eyeY: 1.55 });
        }
      }
    }
    return out;
  }

  _convert(bot) {
    const i = this.allyBots.indexOf(bot);
    if (i < 0) return;
    this.allyBots.splice(i, 1);
    this._infect(bot);
    this.enemyBots.push(bot);
    this.game.hud.killfeed(t('inf.turned', { name: bot.name }), '');
    this.game.audio.enemyShot();
    if (this.allyBots.length === 0 && this.playerInfected) {
      // the hive got everyone
      this._finish(false);
    }
  }

  onKill(killerId, victimId) {
    if (killerId === 'me' && !this.playerInfected) {
      this.game.addScore(150);
      this.game.addKillMp();
    }
    const victim = this.bots.find((b) => b.id === victimId);
    if (victim && victim.team === 'allies') this._convert(victim);
  }

  creditPlayerDeath(botId) {
    // the player rises as one of them
    if (!this.playerInfected) {
      this.playerInfected = true;
      this.game.meleeOnlyPlayer = true;
      this.game.weapons.rig.visible = false;
      this.game.hud.killfeed(t('inf.you'), '');
      this.game.audio.enemyShot();
    }
  }

  onPlayerDeath() {
    this.playerRespawn = 2.5;
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    document.getElementById('spectate-note').classList.add('visible');
  }

  update(dt) {
    if (this.done) return;
    if (this._respawnTick(dt) === false && this.playerInfected) {
      // infected players keep their claws only
      this.game.weapons.rig.visible = false;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this._finish(!this.playerInfected);
      return;
    }
    for (const b of this.bots) b.update(dt);
    this.game.hud.setWave(String(this.allyBots.filter((b) => b.alive).length +
      (this.playerInfected ? 0 : 1)));
    this.game.hud.setEnemiesLeft(this.aliveCount());
    if (this.playerRespawn <= 0) {
      this.game.hud.subbanner(t(this.playerInfected ? 'inf.hunt' : 'inf.survive',
        { s: Math.ceil(this.timeLeft), n: this.allyBots.filter((b) => b.alive).length }));
    }
  }
}
