import { EnemyManager } from './enemies.js';
import { BotPlayer, DIFFICULTY } from './bots.js';
import { t } from './i18n.js';

// TEAM DEATHMATCH: your fireteam (you + 2 ally bots) against an enemy squad
// of 3. Every elimination scores a point for the killer's team; first to
// TARGET — or the higher score when the clock runs out — wins. Both teams
// use the shared virtual-player combat model (see docs/AI.md).

const TARGET = 30;
const MATCH_TIME = 300;
const ENEMY_SQUAD = 3;
const ALLY_SQUAD = 2;
const ALLY_NAMES = ['COBALT', 'VECTOR'];

export class TdmManager extends EnemyManager {
  constructor(game) {
    super(game);
    this.enemyBots = [];
    this.allyBots = [];
    this.playerPts = 0;
    this.enemyPts = 0;
    this.timeLeft = MATCH_TIME;
    this.playerRespawn = 0;
    this.done = false;
    this._deathScored = false;
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

  teammates() { return this.allyBots.filter((b) => b.alive); }
  forceNextWave() { /* fixed squads in TDM */ }
  get bots() { return [...this.enemyBots, ...this.allyBots]; }

  startGame() {
    this.reset();
    this.done = false;
    this.playerPts = 0;
    this.enemyPts = 0;
    this.timeLeft = MATCH_TIME;
    this._deathScored = false;
    const diff = DIFFICULTY[this.game.setup.difficulty] || DIFFICULTY.normal;
    for (let i = 0; i < ENEMY_SQUAD; i++) {
      this.enemyBots.push(new BotPlayer(
        this.game, this, `tdm-e${i}`, `RAID-${i + 1}`, 0xd84a3b, diff, 'enemies'));
    }
    for (let i = 0; i < ALLY_SQUAD; i++) {
      this.allyBots.push(new BotPlayer(
        this.game, this, `tdm-a${i}`, ALLY_NAMES[i], 0x27b8d8, diff, 'allies'));
    }
    this.game.hud.setWave('0:0');
  }

  reset() {
    for (const b of this.enemyBots || []) b.dispose();
    this.enemyBots = [];
    for (const b of this.allyBots || []) b.dispose();
    this.allyBots = [];
  }

  // BotPlayer hooks -----------------------------------------------------
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
    // allies redeploy near the player's side, enemies far from it
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

  _teamOf(id) {
    if (id === 'me' || this.allyBots.some((b) => b.id === id)) return 'player';
    if (this.enemyBots.some((b) => b.id === id)) return 'enemy';
    return null;
  }

  onKill(killerId, victimId) {
    const names = { me: this.game.mp.name };
    for (const b of this.bots) names[b.id] = b.name;
    const vTeam = this._teamOf(victimId);
    if (vTeam === 'enemy') this.playerPts++;
    else if (vTeam === 'player') this.enemyPts++;
    if (victimId === 'me') this._deathScored = true;
    if (killerId === 'me') {
      this.game.addScore(150);
      this.game.addKillMp();
    }
    this.game.hud.killfeed(t('mp.playerKilled', {
      player: names[killerId] || '?', enemy: names[victimId] || '?' }));
    this.game.hud.setWave(`${this.playerPts}:${this.enemyPts}`);
    this._checkEnd();
  }

  creditPlayerDeath(botId) {
    this.onKill(botId, 'me');
  }

  onPlayerDeath() {
    if (!this._deathScored) {
      // uncredited deaths (falls, out-of-bounds) still score for the enemy
      this.enemyPts++;
      this.game.hud.setWave(`${this.playerPts}:${this.enemyPts}`);
    }
    this._deathScored = false;
    this.playerRespawn = 2.5;
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    document.getElementById('spectate-note').classList.add('visible');
    this._checkEnd();
  }

  _checkEnd() {
    if (this.done) return;
    if (this.playerPts >= TARGET || this.enemyPts >= TARGET) {
      this.done = true;
      const win = this.playerPts > this.enemyPts;
      if (win) this.game.addScore(2000);
      this.game.tdmFinished(win);
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

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.done = true;
      const win = this.playerPts >= this.enemyPts;
      if (win) this.game.addScore(1500);
      this.game.tdmFinished(win);
      return;
    }

    for (const b of this.bots) b.update(dt);

    this.game.hud.setEnemiesLeft(this.aliveCount());
    if (this.playerRespawn <= 0) {
      this.game.hud.subbanner(t('tdm.status', {
        p: this.playerPts, e: this.enemyPts, n: TARGET, s: Math.ceil(this.timeLeft) }));
    }
  }
}
