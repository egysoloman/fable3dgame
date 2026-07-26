import * as THREE from 'three';
import { buildEnemyBody } from './enemies.js';
import { WEAPON_DEFS } from './weapons.js';
import { DIFFICULTY } from './bots.js';
import { t } from './i18n.js';

// STRIKE mode: a squad of AI soldiers that fight with the normal weapon
// arsenal. The full algorithm is documented in docs/AI.md; in short each bot
// runs a three-state machine (ENGAGE / COVER / HUNT) with a human-like aim
// model: an error cone that tightens with continuous time-on-target, a
// first-shot delay after acquiring, flinch when hit, and per-weapon burst
// discipline with preferred engagement ranges.

const GRAVITY = 26;
const BOT_HP = 100;
const BOT_WEAPONS = ['smg', 'rifle', 'dmr', 'shotgun'];
const RANGE_PREF = { smg: 9, rifle: 14, dmr: 22, shotgun: 6 };
const BURSTS = { smg: [5, 9], rifle: [3, 6], dmr: [1, 2], shotgun: [1, 1] };
const BOT_TYPE = { name: 'soldier', attack: 'ranged', scale: 1, score: 200, color: 0x6a7a4a, eyeColor: 0xffb347 };

const _ray = new THREE.Raycaster();
const _v1 = new THREE.Vector3();

class SoldierBot {
  constructor(game, mgr, pos, id) {
    this.game = game;
    this.mgr = mgr;
    this.id = id;
    this.type = BOT_TYPE;
    this.hp = BOT_HP;
    this.maxHp = BOT_HP;
    this.alive = true;
    this.dying = 0;
    this.spawnTimer = 0.3;
    this.halfW = 0.38;
    this.height = 1.8;
    this.position = pos.clone();
    this.velocity = new THREE.Vector3();

    // loadout
    const pick = BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)];
    this.weapon = WEAPON_DEFS.find((d) => d.id === pick);
    this.mag = this.weapon.magSize;

    // aim model state (difficulty preset scales the whole model)
    this.diff = DIFFICULTY[game.setup.difficulty] || DIFFICULTY.normal;
    this.hasLOS = false;
    this.losTimer = Math.random() * 0.15;  // staggered perception ticks
    this.aimError = this.diff.aimStart;    // radians of cone error
    this.acquireDelay = 0;                 // first-shot delay after acquiring
    this.lastSeen = pos.clone();
    this.lastSeenAge = 999;

    // firing discipline
    this.burstLeft = 0;
    this.shotTimer = 0;
    this.pauseTimer = 0.5;
    this.reloadTimer = 0;

    // movement
    this.state = 'engage'; // engage | cover | hunt
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.strafeFlip = 2 + Math.random() * 2;
    this.coverSpot = null;
    this.walkPhase = Math.random() * 10;
    this.flashTime = 0;

    const body = buildEnemyBody(BOT_TYPE, true);
    this.parts = body;
    this.group = body.group;
    this.parts.head.userData.headshot = true;
    // rifle prop in hands
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x22282e, roughness: 0.5, metalness: 0.7 }));
    gun.position.set(0.2, 1.25, 0.35);
    gun.userData.enemy = this;
    this.group.add(gun);
    this.group.traverse((o) => { o.userData.enemy = this; });
    this.group.position.copy(this.position);
    game.scene.add(this.group);
  }

  // --- perception: throttled LOS check + target memory ---
  _perceive(dt) {
    this.losTimer -= dt;
    this.lastSeenAge += dt;
    if (this.losTimer > 0) return;
    this.losTimer = 0.15;
    const p = this.game.player;
    if (!p.alive) { this.hasLOS = false; return; }
    const from = _v1.set(this.position.x, this.position.y + 1.55, this.position.z);
    const to = p.eyePosition;
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    _ray.set(from.clone(), dir);
    _ray.far = dist;
    const blocked = _ray.intersectObjects(this.game.world.colliderMeshes, false).length > 0;
    const seesNow = !blocked && dist < 60;
    if (seesNow) {
      if (!this.hasLOS) {
        // fresh acquisition: wide error + human reaction delay
        this.aimError = this.diff.aimStart;
        this.acquireDelay = this.diff.react + Math.random() * 0.2;
      }
      this.lastSeen.copy(p.position);
      this.lastSeenAge = 0;
    } else if (this.hasLOS) {
      this.aimError = this.diff.aimStart; // lost sight: aim resets
    }
    this.hasLOS = seesNow;
  }

  // --- one aimed shot at the player with the current error cone ---
  _fireShot() {
    const p = this.game.player;
    const from = new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z);
    const eye = p.eyePosition;
    const dir = eye.clone().sub(from).normalize();
    // triangular-ish error distribution inside the cone
    const err = this.aimError;
    dir.x += ((Math.random() + Math.random()) / 2 - 0.5) * 2 * err;
    dir.y += ((Math.random() + Math.random()) / 2 - 0.5) * 2 * err;
    dir.z += ((Math.random() + Math.random()) / 2 - 0.5) * 2 * err;
    dir.normalize();

    // trace: world first, then the player AABB slab test
    _ray.set(from, dir);
    _ray.far = 80;
    const wallHits = _ray.intersectObjects(this.game.world.colliderMeshes, false);
    const wallDist = wallHits.length ? wallHits[0].distance : 80;
    const hitT = this._rayVsPlayer(from, dir, p);
    let end;
    if (hitT !== null && hitT < wallDist) {
      end = from.clone().addScaledVector(dir, hitT);
      p.takeDamage(this.weapon.damage * 0.5, this.position, 'bullet');
    } else {
      end = from.clone().addScaledVector(dir, Math.min(wallDist, 80));
      this.game.effects.impactSparks(end);
    }
    this.game.effects.tracer(from, end, this.weapon.tracer);
    this.game.effects.flash(from, 1.2);
    this.game.audio.remoteShot();
    this.mag--;
  }

  _rayVsPlayer(from, dir, p) {
    // slab test against the player's AABB
    const min = [p.position.x - 0.4, p.position.y, p.position.z - 0.4];
    const max = [p.position.x + 0.4, p.position.y + 1.8, p.position.z + 0.4];
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

  // --- pick a cover spot: a collider whose body blocks the line to the player ---
  _findCover() {
    const p = this.game.player.position;
    let best = null, bd = Infinity;
    for (const c of this.game.world.colliders) {
      const cx = (c.min.x + c.max.x) / 2;
      const cz = (c.min.z + c.max.z) / 2;
      if (c.max.y - c.min.y < 1.2) continue;              // too low to hide behind
      const d = Math.hypot(cx - this.position.x, cz - this.position.z);
      if (d > 25 || d < 1) continue;
      // spot on the far side of the obstacle from the player
      const away = _v1.set(cx - p.x, 0, cz - p.z).normalize();
      const spot = new THREE.Vector3(cx + away.x * 2.2, 0, cz + away.z * 2.2);
      if (d < bd) { bd = d; best = spot; }
    }
    return best;
  }

  update(dt) {
    const g = this.group;
    if (!this.alive) {
      this.dying += dt;
      const tt = Math.min(1, this.dying / 0.6);
      g.scale.set(1 + tt * 0.4, Math.max(0.01, 1 - tt), 1 + tt * 0.4);
      this.parts.bodyMat.opacity = 1 - tt;
      return this.dying < 0.65;
    }
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      g.scale.setScalar(1 - Math.max(0, this.spawnTimer) / 0.3);
      g.position.copy(this.position);
      return true;
    }
    g.scale.setScalar(1);

    const p = this.game.player;
    this._perceive(dt);

    // aim tightens with continuous time-on-target
    if (this.hasLOS) {
      this.aimError = Math.max(this.diff.aimFloor, this.aimError - this.diff.tighten * dt);
      if (this.acquireDelay > 0) this.acquireDelay -= dt;
    }

    // --- state transitions ---
    if (this.reloadTimer > 0) {
      this.state = 'cover';
    } else if (this.hasLOS) {
      this.state = 'engage';
    } else if (this.lastSeenAge < 6) {
      this.state = 'hunt';
    }

    // --- movement ---
    this.strafeFlip -= dt;
    if (this.strafeFlip <= 0) {
      this.strafeFlip = 1.6 + Math.random() * 2;
      this.strafeSign *= -1;
    }
    const toP = _v1.set(p.position.x - this.position.x, 0, p.position.z - this.position.z);
    const dist = toP.length();
    if (dist > 0.001) toP.divideScalar(dist);
    const perp = new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(this.strafeSign);

    const move = new THREE.Vector3();
    const pref = RANGE_PREF[this.weapon.id];
    if (this.state === 'engage') {
      if (dist > pref * 1.4) move.copy(toP);
      else if (dist < pref * 0.6) move.copy(toP).negate();
      move.addScaledVector(perp, 0.9);
    } else if (this.state === 'cover') {
      if (!this.coverSpot) this.coverSpot = this._findCover();
      if (this.coverSpot) {
        const toCover = new THREE.Vector3(
          this.coverSpot.x - this.position.x, 0, this.coverSpot.z - this.position.z);
        if (toCover.length() > 0.8) move.copy(toCover.normalize());
      } else {
        move.copy(toP).negate().addScaledVector(perp, 0.6); // no cover: back off
      }
    } else if (this.state === 'hunt') {
      const toSeen = new THREE.Vector3(
        this.lastSeen.x - this.position.x, 0, this.lastSeen.z - this.position.z);
      if (toSeen.length() > 1.5) move.copy(toSeen.normalize());
      else this.lastSeenAge = 10; // arrived, nothing here: idle patrol
    }

    // separation from squadmates
    for (const other of this.mgr.list) {
      if (other === this || !other.alive) continue;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 4 && d2 > 0.001) {
        const d = Math.sqrt(d2);
        move.x += (dx / d) * (1 - d / 2) * 1.4;
        move.z += (dz / d) * (1 - d / 2) * 1.4;
      }
    }
    if (move.lengthSq() > 0.001) move.normalize();

    const speed = this.state === 'engage' ? 4.2 : 5.4;
    this.velocity.x = move.x * speed;
    this.velocity.z = move.z * speed;
    this.velocity.y -= GRAVITY * dt;
    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);
    this._moveAxis('y', this.velocity.y * dt);
    if (this.position.y <= 0) { this.position.y = 0; if (this.velocity.y < 0) this.velocity.y = 0; }

    // --- weapon handling ---
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.mag = this.weapon.magSize;
        this.coverSpot = null;
      }
    } else if (this.mag <= 0) {
      this.reloadTimer = this.weapon.reloadTime * 1.15;
      this.coverSpot = null;
    } else if (this.hasLOS && this.acquireDelay <= 0 && p.alive && dist < 55) {
      if (this.burstLeft > 0) {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
          this.shotTimer = Math.max(0.09, this.weapon.fireDelay);
          this.burstLeft--;
          this._fireShot();
        }
      } else {
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) {
          const [lo, hi] = BURSTS[this.weapon.id];
          this.burstLeft = lo + Math.floor(Math.random() * (hi - lo + 1));
          this.pauseTimer = 0.5 + Math.random() * 0.7;
          this.shotTimer = 0;
        }
      }
    }

    // --- animation & bars ---
    const moving = move.lengthSq() > 0.01;
    if (moving) this.walkPhase += dt * speed * 2.2;
    const swing = moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    const face = this.hasLOS || this.state === 'hunt'
      ? Math.atan2(toP.x, toP.z) : Math.atan2(move.x, move.z);
    if (moving || this.hasLOS) g.rotation.y = face;
    g.position.copy(this.position);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      const f = Math.max(0, this.flashTime / 0.08);
      this.parts.bodyMat.emissive.setRGB(f + 0.1, f + 0.1, f + 0.1);
      this.parts.bodyMat.emissiveIntensity = 0.12 + f * 2.2;
      if (this.flashTime <= 0) {
        this.parts.bodyMat.emissive.setHex(BOT_TYPE.color);
        this.parts.bodyMat.emissiveIntensity = 0.12;
      }
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
      const overl =
        this.position.x + this.halfW > c.min.x && this.position.x - this.halfW < c.max.x &&
        this.position.y + this.height > c.min.y && this.position.y < c.max.y &&
        this.position.z + this.halfW > c.min.z && this.position.z - this.halfW < c.max.z;
      if (!overl) continue;
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

  takeDamage(dmg, point, headshot, attackerId) {
    if (!this.alive) return;
    if (this.game.cheats && this.game.cheats.is('instantKill')) dmg = this.hp;
    this.hp -= dmg;
    this.flashTime = 0.08;
    this.aimError = Math.min(0.16, this.aimError + 0.05); // flinch
    if (point) this.game.effects.enemyHitSparks(point);
    const localHit = attackerId === undefined;
    if (localHit) this.game.audio.hit(headshot);
    if (this.hp <= 0) {
      this.die();
      if (localHit) this.game.hud.hitmarker(true);
    } else if (localHit) {
      this.game.hud.hitmarker(false);
    }
  }

  die() {
    this.alive = false;
    this.dying = 0;
    this.parts.bodyMat.transparent = true;
    this.parts.bar.visible = false;
    this.parts.barBg.visible = false;
    this.game.effects.enemyDeathBurst(
      new THREE.Vector3(this.position.x, this.position.y + 1, this.position.z), BOT_TYPE.color);
    this.game.audio.kill();
    this.game.addScore(BOT_TYPE.score);
    this.game.addKill('soldier');
    this.mgr.onBotKilled();
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.parts.dispose();
  }
}

// Squad manager for STRIKE mode. Mirrors the EnemyManager read interface so
// weapons, radar, and splash damage work unchanged.
export class SoldierManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.byId = new Map();
    this.projectiles = [];
    this.spawnQueue = [];
    this.state = 'active';
    this.wave = 0;
    this.timer = 0;
    this.nextId = 1;
    this.kills = 0;
    this.target = 30;
    this.timeLeft = 300;
    this.respawns = [];
    this.playerRespawn = 0;
    this.done = false;
  }

  reset() {
    for (const b of this.list) b.dispose();
    this.list = [];
    this.byId.clear();
    this.respawns = [];
    this.kills = 0;
    this.timeLeft = 300;
    this.playerRespawn = 0;
    this.done = false;
  }

  startGame() {
    this.reset();
    const squad = 4;
    for (let i = 0; i < squad; i++) this._spawn();
    this.game.hud.setWave(0);
  }

  aliveGroups() {
    return this.list.filter((b) => b.alive && b.spawnTimer <= 0).map((b) => b.group);
  }

  aliveCount() {
    return this.list.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
  }

  forceNextWave() { this._spawn(); }

  _spawn() {
    const pts = this.game.world.spawnPoints;
    const p = this.game.player.position;
    const far = pts.filter((q) => q.distanceTo(p) > 25);
    const pool = far.length ? far : pts;
    const pos = pool[Math.floor(Math.random() * pool.length)].clone();
    pos.x += (Math.random() - 0.5) * 3;
    pos.z += (Math.random() - 0.5) * 3;
    const bot = new SoldierBot(this.game, this, pos, this.nextId++);
    this.list.push(bot);
    this.byId.set(bot.id, bot);
    this.game.effects.spawnPortal(pos, BOT_TYPE.color);
  }

  onBotKilled() {
    this.kills++;
    this.wave = this.kills; // game-over screen shows this as the wave stat
    this.game.hud.setWave(`${this.kills}/${this.target}`);
    this.respawns.push(3);
    if (this.kills >= this.target && !this.done) this._finish(true);
  }

  onPlayerDeath() {
    this.playerRespawn = 2.5;
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
  }

  _finish(win) {
    this.done = true;
    if (win) this.game.addScore(1500);
    this.game.strikeFinished(win, this.kills);
  }

  update(dt) {
    if (this.done) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this._finish(this.kills >= this.target); return; }

    // player redeploy
    if (this.playerRespawn > 0) {
      this.playerRespawn -= dt;
      this.game.hud.subbanner(t('strike.redeploy', { s: Math.ceil(this.playerRespawn) }));
      if (this.playerRespawn <= 0) {
        const pl = this.game.player;
        const sp = this.game.world.map.playerSpawn;
        pl.alive = true;
        pl.hp = pl.maxHp;
        pl.position.set(sp[0] + (Math.random() - 0.5) * 4, 0, sp[1]);
        pl.timeSinceDamage = 999;
        this.game.hud.setHealth(pl.hp, pl.maxHp);
        this.game.hud.subbanner('');
        this.game.weapons.rig.visible = true;
        this.game.resetStreak();
      }
    }

    // bot respawns keep the squad populated
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      this.respawns[i] -= dt;
      if (this.respawns[i] <= 0) {
        this.respawns.splice(i, 1);
        this._spawn();
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].update(dt)) {
        this.byId.delete(this.list[i].id);
        this.list[i].dispose();
        this.list.splice(i, 1);
      }
    }

    this.game.hud.setEnemiesLeft(this.aliveCount());
    this.game.hud.setWave(`${this.kills}/${this.target}`);
    if (this.playerRespawn <= 0 && this.timeLeft < 31) {
      this.game.hud.subbanner(t('strike.timer', { s: Math.max(0, Math.ceil(this.timeLeft)) }));
    }
  }
}
