import * as THREE from 'three';
import { buildEnemyBody } from './enemies.js';
import { WEAPON_DEFS } from './weapons.js';
import { t } from './i18n.js';

// "Virtual players": bots that play by player rules — real weapons with
// magazines and reloads, armor, health regen, grenades, movement parity —
// driven by the same perception/aim pipeline as the Strike soldiers but
// parameterized by a difficulty preset. Used to fill Versus (FFA) offline.

export const DIFFICULTY = {
  easy:   { aimStart: 0.20, aimFloor: 0.055, tighten: 0.04, react: 0.75, pause: 1.3, grenade: 0.002, speed: 0.85, hpMul: 0.85 },
  normal: { aimStart: 0.14, aimFloor: 0.030, tighten: 0.06, react: 0.45, pause: 0.85, grenade: 0.004, speed: 0.95, hpMul: 1.0 },
  hard:   { aimStart: 0.10, aimFloor: 0.020, tighten: 0.09, react: 0.28, pause: 0.55, grenade: 0.007, speed: 1.0, hpMul: 1.1 },
  expert: { aimStart: 0.07, aimFloor: 0.012, tighten: 0.13, react: 0.16, pause: 0.35, grenade: 0.010, speed: 1.05, hpMul: 1.2 },
};

const BOT_NAMES = ['ROOK', 'HALO', 'ONYX', 'DRIFT', 'NOVA-7', 'JINX', 'SABLE'];
const BOT_COLORS = [0xd88a3b, 0x3bd8a0, 0xd83bb0, 0x8a3bd8, 0xb0d83b];
const BOT_WEAPONS = ['smg', 'rifle', 'dmr', 'shotgun', 'carbine'];
const RANGE_PREF = { smg: 9, rifle: 14, dmr: 22, shotgun: 6, carbine: 16 };
const GRAVITY = 26;
const TARGET_KILLS = 15;
const MATCH_TIME = 240;

const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

function makeTag(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(20, 6, 4, 0.6)';
  g.fillRect(48, 8, 160, 46);
  g.fillStyle = '#ffb4a0';
  g.fillText(name, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.9, 0.48, 1);
  sprite.raycast = () => {};
  return sprite;
}

export class BotPlayer {
  constructor(game, match, id, name, color, diff, team = null) {
    this.game = game;
    this.match = match;
    this.id = id;
    this.name = name;
    this.diff = diff;
    this.team = team;          // null = FFA; 'allies' | 'enemies' in team modes
    this.objective = null;     // Vector3 the bot pushes toward when not fighting
    this.type = { attack: 'ranged', scale: 1, name: 'bot' };  // radar interface
    this.maxHp = Math.round(100 * diff.hpMul);
    this.hp = this.maxHp;
    this.armor = 50;
    this.alive = true;
    this.dying = 0;
    this.spawnTimer = 0.3;
    this.halfW = 0.38;
    this.height = 1.8;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.timeSinceDamage = 999;

    // player-rule weapon: real magazine + reload
    const pick = BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)];
    this.weapon = WEAPON_DEFS.find((d) => d.id === pick);
    this.mag = this.weapon.magSize;
    this.reloadTimer = 0;
    this.grenades = 2;

    // aim/perception state (same model as Strike soldiers, tuned by difficulty)
    this.target = null;         // {isPlayer, bot}
    this.hasLOS = false;
    this.losTimer = Math.random() * 0.15;
    this.aimError = diff.aimStart;
    this.acquireDelay = 0;
    this.burstLeft = 0;
    this.shotTimer = 0;
    this.pauseTimer = 0.5;
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.strafeFlip = 2 + Math.random() * 2;
    this.walkPhase = Math.random() * 10;
    this.flashTime = 0;
    this.kills = 0;
    this.streak = 0;

    const body = buildEnemyBody({ color, eyeColor: 0xffe0b0 }, true);
    this.parts = body;
    this.group = body.group;
    this.parts.head.userData.headshot = true;
    this.tag = makeTag(name);
    this.tag.position.y = 2.4;
    this.group.add(this.tag);
    this.group.traverse((o) => { o.userData.enemy = this; });
    game.scene.add(this.group);
    this.respawn();
  }

  respawn() {
    const pts = this.game.world.spawnPoints;
    const pos = this.match.spawnFor
      ? this.match.spawnFor(this)
      : pts[Math.floor(Math.random() * pts.length)].clone();
    pos.x += (Math.random() - 0.5) * 3;
    pos.z += (Math.random() - 0.5) * 3;
    this.position.copy(pos);
    this.hp = this.maxHp;
    this.armor = 50;
    this.mag = this.weapon.magSize;
    this.alive = true;
    this.dying = 0;
    this.spawnTimer = 0.3;
    this.aimError = this.diff.aimStart;
    this.streak = 0;
    this.group.visible = true;
    this.parts.bodyMat.opacity = 1;
    this.game.effects.spawnPortal(pos, 0xffb4a0);
  }

  // nearest visible combatant: FFA sees everyone; team modes ask the match
  _pickTarget() {
    let cands;
    if (this.match.targetsFor) {
      cands = this.match.targetsFor(this);
    } else {
      cands = [];
      const p = this.game.player;
      if (p.alive) cands.push({ isPlayer: true, position: p.position, eyeY: 1.6 });
      for (const b of this.match.bots) {
        if (b !== this && b.alive && b.spawnTimer <= 0) {
          cands.push({ isPlayer: false, bot: b, position: b.position, eyeY: 1.55 });
        }
      }
    }
    let best = null, bd = Infinity;
    for (const c of cands) {
      const d = Math.hypot(c.position.x - this.position.x, c.position.z - this.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  _losTo(tgt) {
    const from = _v.set(this.position.x, this.position.y + 1.55, this.position.z);
    const to = new THREE.Vector3(tgt.position.x, tgt.position.y + tgt.eyeY, tgt.position.z);
    const dir = to.sub(from.clone());
    const dist = dir.length();
    if (dist > 55) return false;
    dir.normalize();
    _ray.set(from.clone(), dir);
    _ray.far = dist;
    return _ray.intersectObjects(this.game.world.colliderMeshes, false).length === 0;
  }

  _fireShot(tgt) {
    const from = new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z);
    const aim = new THREE.Vector3(
      tgt.position.x, tgt.position.y + tgt.eyeY - 0.15, tgt.position.z);
    const dir = aim.sub(from).normalize();
    const err = this.aimError;
    dir.x += ((Math.random() + Math.random()) / 2 - 0.5) * 2 * err;
    dir.y += ((Math.random() + Math.random()) / 2 - 0.5) * 2 * err;
    dir.z += ((Math.random() + Math.random()) / 2 - 0.5) * 2 * err;
    dir.normalize();

    _ray.set(from, dir);
    _ray.far = 80;
    const wallHits = _ray.intersectObjects(this.game.world.colliderMeshes, false);
    const wallDist = wallHits.length ? wallHits[0].distance : 80;

    // player-rule ballistics: full weapon damage, armor rules on the receiver
    let end = null;
    if (tgt.isPlayer) {
      const hitT = this._rayVsAabb(from, dir, tgt.position, 0.4, 1.8);
      if (hitT !== null && hitT < wallDist) {
        end = from.clone().addScaledVector(dir, hitT);
        this.game.player.lastBotAttacker = this.id;
        this.game.player.takeDamage(this.weapon.damage * 0.5, this.position, 'bullet');
      }
    } else {
      const b = tgt.bot;
      const hitT = this._rayVsAabb(from, dir, b.position, b.halfW, b.height);
      if (hitT !== null && hitT < wallDist) {
        end = from.clone().addScaledVector(dir, hitT);
        b.takeDamage(this.weapon.damage * 0.6, end, false, this.id); // bot-vs-bot pacing
      }
    }
    if (!end) {
      end = from.clone().addScaledVector(dir, Math.min(wallDist, 80));
      this.game.effects.impactSparks(end);
    }
    this.game.effects.tracer(from, end, this.weapon.tracer);
    this.game.audio.remoteShot();
    this.mag--;
  }

  _rayVsAabb(from, dir, feet, halfW, height) {
    const min = [feet.x - halfW, feet.y, feet.z - halfW];
    const max = [feet.x + halfW, feet.y + height, feet.z + halfW];
    const o = [from.x, from.y, from.z];
    const d = [dir.x, dir.y, dir.z];
    let t0 = 0, t1 = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-8) {
        if (o[i] < min[i] || o[i] > max[i]) return null;
      } else {
        let a = (min[i] - o[i]) / d[i];
        let b = (max[i] - o[i]) / d[i];
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1) return null;
      }
    }
    return t0 > 0 ? t0 : null;
  }

  _throwGrenade(tgt) {
    if (this.grenades <= 0) return;
    this.grenades--;
    const at = new THREE.Vector3(tgt.position.x, tgt.position.y, tgt.position.z);
    this.game.audio.grenadeThrow();
    // simple arc: detonate near the target after a fuse
    setTimeout(() => {
      if (!this.game.playing) return;
      at.x += (Math.random() - 0.5) * 3;
      at.z += (Math.random() - 0.5) * 3;
      at.y += 0.3;
      this.game.applySplash(at, 4.5, 80);
    }, 1400);
  }

  update(dt) {
    const g = this.group;
    if (!this.alive) {
      this.dying += dt;
      const tt = Math.min(1, this.dying / 0.6);
      g.scale.set(1 + tt * 0.4, Math.max(0.01, 1 - tt), 1 + tt * 0.4);
      this.parts.bodyMat.opacity = 1 - tt;
      if (this.dying > 3) this.respawn();    // versus: bots redeploy like players
      else if (this.dying > 0.65) g.visible = false;
      return true;
    }
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      g.scale.setScalar(1 - Math.max(0, this.spawnTimer) / 0.3);
      g.position.copy(this.position);
      return true;
    }
    g.scale.setScalar(1);

    // player-rule regen
    this.timeSinceDamage += dt;
    if (this.timeSinceDamage > 4.5 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 22 * dt);
    }

    // perception tick
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = 0.15;
      this.target = this._pickTarget();
      const seesNow = this.target ? this._losTo(this.target) : false;
      if (seesNow && !this.hasLOS) {
        this.aimError = this.diff.aimStart;
        this.acquireDelay = this.diff.react + Math.random() * 0.15;
      }
      this.hasLOS = seesNow;
    }
    if (this.hasLOS) {
      this.aimError = Math.max(this.diff.aimFloor, this.aimError - this.diff.tighten * dt);
      if (this.acquireDelay > 0) this.acquireDelay -= dt;
    }

    // movement: keep preferred range, strafe
    this.strafeFlip -= dt;
    if (this.strafeFlip <= 0) {
      this.strafeFlip = 1.6 + Math.random() * 2;
      this.strafeSign *= -1;
    }
    const move = new THREE.Vector3();
    let dist = 999;
    if (!this.target && this.objective) {
      const toO = new THREE.Vector3(
        this.objective.x - this.position.x, 0, this.objective.z - this.position.z);
      if (toO.length() > 2.2) {
        move.copy(toO.normalize());
        g.rotation.y = Math.atan2(move.x, move.z);
      }
    }
    if (this.target) {
      const toT = new THREE.Vector3(
        this.target.position.x - this.position.x, 0, this.target.position.z - this.position.z);
      dist = toT.length();
      if (dist > 0.001) toT.divideScalar(dist);
      const pref = RANGE_PREF[this.weapon.id];
      if (this.reloadTimer > 0) {
        move.copy(toT).negate();
      } else if (!this.hasLOS && this.objective) {
        // push the objective instead of chasing ghosts
        const toO = new THREE.Vector3(
          this.objective.x - this.position.x, 0, this.objective.z - this.position.z);
        if (toO.length() > 2.2) move.copy(toO.normalize());
      } else if (!this.hasLOS) {
        move.copy(toT);
      } else {
        if (dist > pref * 1.4) move.copy(toT);
        else if (dist < pref * 0.6) move.copy(toT).negate();
        move.addScaledVector(new THREE.Vector3(-toT.z, 0, toT.x), this.strafeSign * 0.9);
      }
      if (move.lengthSq() > 0.001) move.normalize();
      g.rotation.y = Math.atan2(toT.x, toT.z);
    }

    const speed = 5.2 * this.diff.speed;
    this.velocity.x = move.x * speed;
    this.velocity.z = move.z * speed;
    this.velocity.y -= GRAVITY * (this.game.world.map.gravityMul || 1) * dt;
    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);
    this._moveAxis('y', this.velocity.y * dt);
    if (this.position.y <= 0) { this.position.y = 0; if (this.velocity.y < 0) this.velocity.y = 0; }
    // bots never step off open-edge maps
    const lim = this.game.world.half - 1;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));
    g.position.copy(this.position);

    // weapon handling: real magazines, reloads, burst discipline
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.mag = this.weapon.magSize;
    } else if (this.mag <= 0) {
      this.reloadTimer = this.weapon.reloadTime * 1.1;
    } else if (this.hasLOS && this.acquireDelay <= 0 && this.target && dist < 50) {
      if (Math.random() < this.diff.grenade && dist > 8 && dist < 30) {
        this._throwGrenade(this.target);
      }
      if (this.burstLeft > 0) {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
          this.shotTimer = Math.max(0.09, this.weapon.fireDelay);
          this.burstLeft--;
          this._fireShot(this.target);
        }
      } else {
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) {
          this.burstLeft = 2 + Math.floor(Math.random() * 4);
          this.pauseTimer = this.diff.pause * (0.7 + Math.random() * 0.6);
          this.shotTimer = 0;
        }
      }
    }

    // animation + bars
    const moving = move.lengthSq() > 0.01;
    if (moving) this.walkPhase += dt * speed * 2.2;
    const swing = moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      const f = Math.max(0, this.flashTime / 0.08);
      this.parts.bodyMat.emissiveIntensity = 0.12 + f * 2.2;
    }
    const frac = Math.max(0, this.hp / this.maxHp);
    this.parts.bar.scale.x = Math.max(0.001, frac);
    this.parts.bar.position.x = -(1 - frac) * 0.45;
    this.parts.barMat.color.setHSL(frac * 0.33, 0.9, 0.55);
    const camPos = this.game.camera.position;
    this.parts.barBg.lookAt(camPos.x, this.parts.barBg.position.y + this.position.y, camPos.z);
    this.parts.bar.rotation.copy(this.parts.barBg.rotation);
    const show = this.hp < this.maxHp;
    this.parts.bar.visible = show;
    this.parts.barBg.visible = show;
    return true;
  }

  _moveAxis(axis, amount) {
    if (amount === 0) return;
    this.position[axis] += amount;
    for (const c of this.game.world.colliders) {
      const o =
        this.position.x + this.halfW > c.min.x && this.position.x - this.halfW < c.max.x &&
        this.position.y + this.height > c.min.y && this.position.y < c.max.y &&
        this.position.z + this.halfW > c.min.z && this.position.z - this.halfW < c.max.z;
      if (!o) continue;
      if (axis === 'x') {
        this.position.x = amount > 0 ? c.min.x - this.halfW : c.max.x + this.halfW;
        this.velocity.x = 0;
      } else if (axis === 'z') {
        this.position.z = amount > 0 ? c.min.z - this.halfW : c.max.z + this.halfW;
        this.velocity.z = 0;
      } else {
        this.position.y = amount > 0 ? c.min.y - this.height : c.max.y;
        this.velocity.y = 0;
      }
    }
  }

  // player-rule damage: armor absorbs before health; flinch widens aim
  takeDamage(dmg, point, headshot, attackerId) {
    if (!this.alive) return;
    if (this.game.cheats && this.game.cheats.is('instantKill') &&
        attackerId === undefined) dmg = this.hp + this.armor;
    this.timeSinceDamage = 0;
    this.aimError = Math.min(this.diff.aimStart, this.aimError + 0.05);
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.7);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.hp -= dmg;
    this.flashTime = 0.08;
    if (point) this.game.effects.enemyHitSparks(point);
    const localHit = attackerId === undefined;
    if (localHit) this.game.audio.hit(headshot);
    if (this.hp <= 0) {
      this.die(attackerId);
      if (localHit) this.game.hud.hitmarker(true);
    } else if (localHit) {
      this.game.hud.hitmarker(false);
    }
  }

  die(attackerId) {
    this.alive = false;
    this.dying = 0;
    this.streak = 0;
    this.parts.bodyMat.transparent = true;
    this.parts.bar.visible = false;
    this.parts.barBg.visible = false;
    this.game.effects.enemyDeathBurst(
      new THREE.Vector3(this.position.x, this.position.y + 1, this.position.z), 0xffb4a0);
    this.game.audio.kill();
    this.match.onKill(attackerId === undefined ? 'me' : attackerId, this.id);
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.parts.dispose();
    this.tag.material.map.dispose();
    this.tag.material.dispose();
  }
}

// Offline Versus (FFA) manager. Mirrors the EnemyManager read interface so
// weapons targeting, radar, and splash damage all work unchanged.
export class BotMatch {
  constructor(game) {
    this.game = game;
    this.bots = [];
    this.scores = new Map();
    this.projectiles = [];
    this.spawnQueue = [];
    this.state = 'active';
    this.wave = 0;
    this.timeLeft = MATCH_TIME;
    this.playerRespawn = 0;
    this.done = false;
  }

  get list() { return this.bots; }
  get byId() { return new Map(this.bots.map((b) => [b.id, b])); }
  aliveGroups() {
    return this.bots.filter((b) => b.alive && b.spawnTimer <= 0).map((b) => b.group);
  }
  aliveCount() { return this.bots.reduce((n, b) => n + (b.alive ? 1 : 0), 0); }
  forceNextWave() { /* fixed roster in versus */ }

  startGame(count = 3) {
    this.reset();
    this.done = false;
    this.timeLeft = MATCH_TIME;
    const diff = DIFFICULTY[this.game.setup.difficulty] || DIFFICULTY.normal;
    this.scores.set('me', { name: this.game.mp.name, kills: 0, score: 0 });
    for (let i = 0; i < count; i++) {
      const bot = new BotPlayer(
        this.game, this, `bot${i}`, BOT_NAMES[i % BOT_NAMES.length],
        BOT_COLORS[i % BOT_COLORS.length], diff);
      this.bots.push(bot);
      this.scores.set(bot.id, { name: bot.name, kills: 0, score: 0 });
    }
  }

  reset() {
    for (const b of this.bots) b.dispose();
    this.bots = [];
    this.scores.clear();
    this.playerRespawn = 0;
  }

  _nameOf(id) {
    const s = this.scores.get(id);
    return s ? s.name : '?';
  }

  onKill(killerId, victimId) {
    const entry = this.scores.get(killerId);
    if (entry && killerId !== victimId) {
      entry.kills++;
      entry.score += 100;
      const bot = this.bots.find((b) => b.id === killerId);
      if (bot) {
        bot.kills++;
        bot.streak++;
        if (bot.streak === 5) { bot.armor = 75; bot.mag = bot.weapon.magSize; } // bot resupply streak
      }
    }
    if (killerId === 'me') {
      this.game.addScore(100);
      this.game.addKillMp();
    }
    this.game.hud.killfeed(t('mp.playerKilled', {
      player: this._nameOf(killerId), enemy: this._nameOf(victimId) }));
    if (entry && entry.kills >= TARGET_KILLS && !this.done) this._finish();
  }

  onPlayerDeath(killerBotId) {
    // credited by the bot that landed the killing blow via player.takeDamage
    this.playerRespawn = 3;
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    document.getElementById('spectate-note').classList.add('visible');
  }

  creditPlayerDeath(botId) {
    this.onKill(botId, 'me');
  }

  _finish() {
    this.done = true;
    const mine = this.scores.get('me');
    const best = Math.max(...[...this.scores.values()].map((s) => s.kills));
    this.game.versusSoloFinished(mine && mine.kills >= best, this.scores);
  }

  update(dt) {
    if (this.done) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this._finish(); return; }

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

    for (const b of this.bots) b.update(dt);

    const mine = this.scores.get('me');
    this.game.hud.setWave(`${mine ? mine.kills : 0}/${TARGET_KILLS}`);
    this.game.hud.setEnemiesLeft(this.aliveCount());
  }
}
