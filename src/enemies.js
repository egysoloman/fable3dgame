import * as THREE from 'three';
import { t } from './i18n.js';

const GRAVITY = 26;

export const ENEMY_TYPES = {
  grunt: {
    name: 'grunt', hp: 50, speed: 4.4, score: 100, scale: 1.0,
    color: 0xd83b3b, eyeColor: 0xff8a8a,
    attack: 'melee', meleeDmg: 10, meleeRange: 1.9, meleeCooldown: 1.0,
  },
  ranger: {
    name: 'ranger', hp: 40, speed: 3.4, score: 150, scale: 0.92,
    color: 0x3b7fd8, eyeColor: 0x8ac8ff,
    attack: 'ranged', shootRange: 18, keepDistance: 10, shootCooldown: 2.1,
    projSpeed: 15, projDmg: 8,
  },
  tank: {
    name: 'tank', hp: 220, speed: 2.35, score: 400, scale: 1.55,
    color: 0x9b3bd8, eyeColor: 0xd98aff,
    attack: 'melee', meleeDmg: 25, meleeRange: 2.4, meleeCooldown: 1.5,
  },
};

// Shared unit geometries (scaled per-enemy via group.scale)
const torsoGeo = new THREE.BoxGeometry(0.72, 0.8, 0.42);
const headGeo = new THREE.BoxGeometry(0.4, 0.36, 0.4);
const eyeGeo = new THREE.PlaneGeometry(0.26, 0.09);
const legGeo = new THREE.BoxGeometry(0.18, 0.62, 0.22);
legGeo.translate(0, -0.31, 0); // pivot at hip
const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.18);
armGeo.translate(0, -0.24, 0);
const barGeo = new THREE.PlaneGeometry(0.9, 0.09);
const projGeo = new THREE.SphereGeometry(0.13, 8, 8);

const barBgMat = new THREE.MeshBasicMaterial({
  color: 0x220a0a, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide,
});
const projMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a });

// Builds the robot body used by enemies, enemy replicas, and teammate avatars.
export function buildEnemyBody(look, withBar = true) {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: look.color, roughness: 0.55, metalness: 0.45,
    emissive: look.color, emissiveIntensity: 0.12,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: look.eyeColor });

  const g = new THREE.Group();

  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.y = 1.02;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);

  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, 1.62, 0.21);
  eye.raycast = () => {};
  g.add(eye);

  const legL = new THREE.Mesh(legGeo, bodyMat);
  legL.position.set(-0.19, 0.64, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, bodyMat);
  legR.position.set(0.19, 0.64, 0);
  legR.castShadow = true;
  g.add(legR);

  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.45, 1.36, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.45, 1.36, 0);
  g.add(armR);

  let bar = null, barBg = null, barMat = null;
  if (withBar) {
    barMat = new THREE.MeshBasicMaterial({
      color: 0x35ff6a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide,
    });
    barBg = new THREE.Mesh(barGeo, barBgMat);
    barBg.position.y = 2.12;
    barBg.raycast = () => {};
    g.add(barBg);
    bar = new THREE.Mesh(barGeo, barMat);
    bar.position.y = 2.12;
    bar.raycast = () => {};
    g.add(bar);
  }

  return {
    group: g, head, eye, legL, legR, armL, armR, bar, barBg, bodyMat, eyeMat, barMat,
    dispose() {
      bodyMat.dispose();
      eyeMat.dispose();
      if (barMat) barMat.dispose();
    },
  };
}

class Enemy {
  constructor(game, type, pos, mods, id) {
    this.game = game;
    this.type = type;
    this.id = id;
    this.hp = Math.round(type.hp * mods.hpMul);
    this.maxHp = this.hp;
    this.speed = type.speed * mods.speedMul;
    this.alive = true;
    this.dying = 0;
    this.spawnTimer = 0.35;
    this.attackCooldown = 1 + Math.random() * 0.5;
    this.flashTime = 0;
    this.walkPhase = Math.random() * 10;
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.strafeFlip = 2 + Math.random() * 2;
    this.stuckTimer = 0;
    this.avoidTimer = 0;
    this.velocity = new THREE.Vector3();
    this.position = pos.clone(); // feet
    this.halfW = 0.42 * type.scale;
    this.height = 1.85 * type.scale;

    const body = buildEnemyBody(type, true);
    this.parts = body;
    this.group = body.group;
    this.bodyMat = body.bodyMat;
    this.head = body.head;
    this.head.userData.headshot = true;
    this.legL = body.legL;
    this.legR = body.legR;
    this.armL = body.armL;
    this.armR = body.armR;
    this.bar = body.bar;
    this.barBg = body.barBg;
    this.barMat = body.barMat;

    this.group.traverse((o) => { o.userData.enemy = this; });
    this.group.position.copy(this.position);
    this.group.scale.setScalar(0.01);
    game.scene.add(this.group);
  }

  // Nearest living target: solo = the player; co-op host = any operative.
  _pickTarget() {
    const game = this.game;
    if (game.mp && game.mp.active && game.mp.isHost) {
      const targets = game.mp.targetList();
      let best = null, bd = Infinity;
      for (const tg of targets) {
        const d = Math.hypot(tg.position.x - this.position.x, tg.position.z - this.position.z);
        if (d < bd) { bd = d; best = tg; }
      }
      return best;
    }
    if (game.player.alive) {
      return { id: null, position: game.player.position, isLocal: true };
    }
    return null;
  }

  update(dt) {
    const g = this.group;
    if (!this.alive) {
      // death animation: crumple and sink
      this.dying += dt;
      const tt = Math.min(1, this.dying / 0.6);
      g.scale.set(
        this.type.scale * (1 + tt * 0.4),
        Math.max(0.01, this.type.scale * (1 - tt)),
        this.type.scale * (1 + tt * 0.4)
      );
      this.bodyMat.opacity = 1 - tt;
      return this.dying < 0.65;
    }

    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      const tt = 1 - Math.max(0, this.spawnTimer) / 0.35;
      g.scale.setScalar(this.type.scale * tt);
      g.position.copy(this.position);
      return true;
    }
    g.scale.setScalar(this.type.scale);

    let target = this._pickTarget();
    const toTarget = new THREE.Vector3();
    let dist = 999;
    if (target) {
      toTarget.subVectors(target.position, this.position);
      toTarget.y = 0;
      dist = toTarget.length();
      if (dist > 0.001) toTarget.divideScalar(dist);
      const aggro = this.game.enemies.aggroRange;
      if (aggro && dist > aggro) { target = null; dist = 999; } // zone guards hold position
    }

    // --- steering ---
    this.strafeFlip -= dt;
    if (this.strafeFlip <= 0) {
      this.strafeFlip = 2 + Math.random() * 2.5;
      this.strafeSign *= -1;
    }
    const perp = new THREE.Vector3(-toTarget.z, 0, toTarget.x).multiplyScalar(this.strafeSign);

    let moveDir = new THREE.Vector3();
    const ty = this.type;
    if (target) {
      if (ty.attack === 'melee') {
        if (dist > ty.meleeRange * 0.85) moveDir.copy(toTarget);
      } else {
        if (dist > ty.shootRange * 0.9) moveDir.copy(toTarget);
        else if (dist < ty.keepDistance) moveDir.copy(toTarget).negate().addScaledVector(perp, 0.7);
        else moveDir.copy(perp).multiplyScalar(0.8);
      }
    }

    // separation from other enemies
    for (const other of this.game.enemies.list) {
      if (other === this || !other.alive) continue;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const d2 = dx * dx + dz * dz;
      const minD = (this.halfW + other.halfW) * 2.2;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        moveDir.x += (dx / d) * (1 - d / minD) * 1.6;
        moveDir.z += (dz / d) * (1 - d / minD) * 1.6;
      }
    }

    // obstacle avoidance: if we barely moved while trying to, sidestep for a while
    if (this.avoidTimer > 0) {
      this.avoidTimer -= dt;
      moveDir.addScaledVector(perp, 1.4);
    }

    if (moveDir.lengthSq() > 0.001) moveDir.normalize();

    const prevX = this.position.x;
    const prevZ = this.position.z;

    this.velocity.x = moveDir.x * this.speed;
    this.velocity.z = moveDir.z * this.speed;
    this.velocity.y -= GRAVITY * dt;

    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);
    this._moveAxis('y', this.velocity.y * dt);
    if (this.position.y <= 0) {
      this.position.y = 0;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    // stuck detection
    const wanted = this.speed * dt;
    const got = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    if (moveDir.lengthSq() > 0.01 && got < wanted * 0.25) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.4) {
        this.avoidTimer = 0.9;
        this.strafeSign *= -1;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }

    // --- attacks ---
    this.attackCooldown -= dt;
    if (target) {
      if (ty.attack === 'melee') {
        const vDiff = Math.abs(target.position.y - this.position.y);
        if (dist < ty.meleeRange && vDiff < 1.6 && this.attackCooldown <= 0 &&
            this._hasLineOfSight(target)) { // no clawing through crate corners
          this.attackCooldown = ty.meleeCooldown;
          this._dealDamage(target, ty.meleeDmg);
          // lunge visual
          this.armL.rotation.x = -1.6;
          this.armR.rotation.x = -1.6;
        }
      } else if (dist < ty.shootRange && this.attackCooldown <= 0) {
        if (this._hasLineOfSight(target)) {
          this.attackCooldown = ty.shootCooldown * (0.85 + Math.random() * 0.3);
          this.game.enemies.spawnProjectile(this, target);
        } else {
          this.attackCooldown = 0.4; // retry soon while repositioning
        }
      }
    }

    // --- animation ---
    const moving = moveDir.lengthSq() > 0.01;
    if (moving) this.walkPhase += dt * this.speed * 2.4;
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x += (swing * 0.5 - this.armL.rotation.x) * Math.min(1, dt * 8);
    this.armR.rotation.x += (-swing * 0.5 - this.armR.rotation.x) * Math.min(1, dt * 8);

    // face the target
    if (target) g.rotation.y = Math.atan2(toTarget.x, toTarget.z);
    g.position.copy(this.position);

    // hit flash
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      const f = Math.max(0, this.flashTime / 0.08);
      this.bodyMat.emissive.setRGB(1 * f + 0.1, 1 * f + 0.1, 1 * f + 0.1);
      this.bodyMat.emissiveIntensity = 0.12 + f * 2.2;
      if (this.flashTime <= 0) {
        this.bodyMat.emissive.setHex(this.type.color);
        this.bodyMat.emissiveIntensity = 0.12;
      }
    }

    // health bar faces the camera
    const frac = Math.max(0, this.hp / this.maxHp);
    this.bar.scale.x = Math.max(0.001, frac);
    this.bar.position.x = -(1 - frac) * 0.45;
    this.barMat.color.setHSL(frac * 0.33, 0.9, 0.55);
    const camPos = this.game.camera.position;
    this.barBg.lookAt(camPos.x, this.barBg.getWorldPosition(_tmpV).y, camPos.z);
    this.bar.rotation.copy(this.barBg.rotation);
    const barVisible = this.hp < this.maxHp;
    this.bar.visible = barVisible;
    this.barBg.visible = barVisible;

    return true;
  }

  _dealDamage(target, dmg) {
    if (target.isLocal) {
      this.game.player.takeDamage(dmg, this.position);
    } else {
      this.game.mp.hostHurtPlayer(target.id, dmg, this.position);
    }
  }

  _aabbOverlap(c) {
    return (
      this.position.x + this.halfW > c.min.x && this.position.x - this.halfW < c.max.x &&
      this.position.y + this.height > c.min.y && this.position.y < c.max.y &&
      this.position.z + this.halfW > c.min.z && this.position.z - this.halfW < c.max.z
    );
  }

  _moveAxis(axis, amount) {
    if (amount === 0) return;
    this.position[axis] += amount;
    for (const c of this.game.world.colliders) {
      if (!this._aabbOverlap(c)) continue;
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

  _hasLineOfSight(target) {
    const from = new THREE.Vector3(
      this.position.x, this.position.y + 1.5 * this.type.scale, this.position.z);
    const to = target.isLocal
      ? this.game.player.eyePosition
      : new THREE.Vector3(target.position.x, target.position.y + 1.55, target.position.z);
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    _losRay.set(from, dir);
    _losRay.far = dist;
    const hits = _losRay.intersectObjects(this.game.world.colliderMeshes, false);
    return hits.length === 0;
  }

  // attackerId: undefined = the local player (solo / host shooting directly)
  takeDamage(dmg, point, headshot, attackerId) {
    if (!this.alive) return;
    if (this.game.cheats && this.game.cheats.is('instantKill')) dmg = this.hp;
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
    this.bodyMat.transparent = true;
    this.bar.visible = false;
    this.barBg.visible = false;
    const center = new THREE.Vector3(
      this.position.x, this.position.y + this.height * 0.55, this.position.z);
    this.game.effects.enemyDeathBurst(center, this.type.color);
    this.game.audio.kill();

    const mp = this.game.mp;
    if (mp && mp.active && mp.isHost) {
      mp.hostEnemyKilled(this, attackerId);
    } else {
      this.game.addScore(this.type.score);
      this.game.addKill(this.type.name);
      this.game.pickups.maybeDrop(this.position);
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.parts.dispose();
  }
}

const _tmpV = new THREE.Vector3();
const _losRay = new THREE.Raycaster();

class Projectile {
  constructor(game, from, dir, speed, dmg) {
    this.game = game;
    this.dmg = dmg;
    this.velocity = dir.clone().multiplyScalar(speed);
    this.mesh = new THREE.Mesh(projGeo, projMat);
    this.mesh.position.copy(from);
    this.life = 4;
    game.scene.add(this.mesh);
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) return false;
    const pos = this.mesh.position;

    // substep so bolts can't skip through thin walls at clamped dt
    const speed = this.velocity.length();
    const steps = Math.max(1, Math.ceil((speed * dt) / 0.3));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      pos.addScaledVector(this.velocity, h);

      // world collision
      for (const c of this.game.world.colliders) {
        if (
          pos.x > c.min.x - 0.13 && pos.x < c.max.x + 0.13 &&
          pos.y > c.min.y - 0.13 && pos.y < c.max.y + 0.13 &&
          pos.z > c.min.z - 0.13 && pos.z < c.max.z + 0.13
        ) {
          this.game.effects.burst(pos, 0xff6a2a, 6, 3, 0.3, 5);
          return false;
        }
      }
      if (pos.y < 0.05) {
        this.game.effects.burst(pos, 0xff6a2a, 6, 3, 0.3, 5);
        return false;
      }

      // local player collision (AABB expanded by projectile radius)
      const p = this.game.player;
      if (p.alive &&
        pos.x > p.position.x - 0.5 && pos.x < p.position.x + 0.5 &&
        pos.y > p.position.y - 0.1 && pos.y < p.position.y + 1.9 &&
        pos.z > p.position.z - 0.5 && pos.z < p.position.z + 0.5
      ) {
        p.takeDamage(this.dmg, pos, 'bolt');
        return false;
      }

      // co-op: the host also collides bolts with remote operatives
      const mp = this.game.mp;
      if (mp && mp.active && mp.isHost) {
        for (const r of mp.remoteList()) {
          if (!r.alive) continue;
          if (
            pos.x > r.position.x - 0.5 && pos.x < r.position.x + 0.5 &&
            pos.y > r.position.y - 0.1 && pos.y < r.position.y + 1.9 &&
            pos.z > r.position.z - 0.5 && pos.z < r.position.z + 0.5
          ) {
            mp.hostHurtPlayer(r.id, this.dmg, pos);
            this.game.effects.burst(pos, 0xff6a2a, 6, 3, 0.3, 5);
            return false;
          }
        }
      }
    }

    // faint trail
    if (Math.random() < 0.5) {
      this.game.effects.spawnParticle(
        pos, new THREE.Vector3(0, 0, 0), _trailColor, 0.2, 0);
    }
    return true;
  }

  dispose() {
    this.game.scene.remove(this.mesh);
  }
}

const _trailColor = new THREE.Color(0xff9a5a);

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.byId = new Map();
    this.projectiles = [];
    this.wave = 0;
    this.state = 'idle'; // idle | intermission | spawning | active
    this.timer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.nextEnemyId = 1;
  }

  reset() {
    for (const e of this.list) e.dispose();
    for (const p of this.projectiles) p.dispose();
    this.list = [];
    this.byId.clear();
    this.projectiles = [];
    this.spawnQueue = [];
    this.wave = 0;
    this.state = 'idle';
  }

  startGame() {
    this.reset();
    this.state = 'intermission';
    this.timer = 3;
    this.game.hud.setWave(1);
  }

  aliveGroups() {
    return this.list.filter((e) => e.alive && e.spawnTimer <= 0).map((e) => e.group);
  }

  aliveCount() {
    return this.list.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  }

  _composition(wave) {
    const q = [];
    const playerCount = this.game.mp && this.game.mp.active
      ? 1 + this.game.mp.remoteList().length : 1;
    const mul = 1 + (playerCount - 1) * 0.6; // co-op scales wave size
    const grunts = Math.round((3 + wave + Math.floor(wave / 3)) * mul);
    for (let i = 0; i < grunts; i++) q.push('grunt');
    if (wave >= 2) {
      const rangers = Math.round((1 + Math.floor(wave / 2)) * mul);
      for (let i = 0; i < rangers; i++) q.push('ranger');
    }
    if (wave >= 4) {
      const tanks = Math.round(Math.floor((wave - 2) / 2) * mul);
      for (let i = 0; i < tanks; i++) q.push('tank');
    }
    // shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  }

  forceNextWave() {
    if (this.state === 'idle') return;
    if (this.state === 'intermission') {
      this.timer = 0.01;
      return;
    }
    this._beginWave(); // stacks the next wave onto whatever is still alive
  }

  _beginWave() {
    this.wave++;
    this.state = 'spawning';
    this.spawnQueue = this.spawnQueue.concat(this._composition(this.wave));
    this.spawnTimer = 0;
    const DIFF_WAVE = {
      easy: { hp: 0.8, sp: 0.92 }, normal: { hp: 1, sp: 1 },
      hard: { hp: 1.2, sp: 1.07 }, expert: { hp: 1.45, sp: 1.14 },
    };
    const df = DIFF_WAVE[this.game.matchDifficulty] || DIFF_WAVE.normal;
    this.mods = {
      hpMul: (1 + (this.wave - 1) * 0.06) * df.hp,
      speedMul: Math.min(1.5, (1 + (this.wave - 1) * 0.03) * df.sp),
    };
    this.game.hud.setWave(this.wave);
    this.game.hud.banner(t('banner.wave', { n: this.wave }), this.wave % 5 === 0 ? 'danger' : '');
    this.game.audio.waveStart();
    const mp = this.game.mp;
    if (mp && mp.active && mp.isHost) mp.hostWaveBegin(this.wave);
  }

  _spawnOne(typeName) {
    const world = this.game.world;
    const player = this.game.player;
    const candidates = world.spawnPoints.filter(
      (p) => p.distanceTo(player.position) > 16);
    const pool = candidates.length ? candidates : world.spawnPoints;
    const point = pool[Math.floor(Math.random() * pool.length)];
    const pos = point.clone();
    pos.x += (Math.random() - 0.5) * 3;
    pos.z += (Math.random() - 0.5) * 3;
    const type = ENEMY_TYPES[typeName];
    const enemy = new Enemy(this.game, type, pos, this.mods, this.nextEnemyId++);
    this.list.push(enemy);
    this.byId.set(enemy.id, enemy);
    this.game.effects.spawnPortal(pos, type.color);
  }

  update(dt) {
    // spawn/wave state machine
    if (this.state === 'intermission') {
      this.timer -= dt;
      const secs = Math.ceil(this.timer);
      this.game.hud.subbanner(t('banner.nextWave', { s: secs }));
      if (this.timer <= 0) {
        this.game.hud.subbanner('');
        this._beginWave();
      }
    } else if (this.state === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        this._spawnOne(this.spawnQueue.shift());
        this.spawnTimer = 0.55;
      }
      if (this.spawnQueue.length === 0) this.state = 'active';
    } else if (this.state === 'active') {
      if (this.aliveCount() === 0) {
        this.game.addScore(this.wave * 50);
        this.game.audio.waveClear();
        this.game.hud.banner(t('banner.waveClear'), '');
        this.game.hud.bannerFadeSoon();
        this.state = 'intermission';
        this.timer = 5;
        const mp = this.game.mp;
        if (mp && mp.active && mp.isHost) mp.hostWaveClear();
      }
    }

    // enemies
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.update(dt)) {
        this.byId.delete(e.id);
        e.dispose();
        this.list.splice(i, 1);
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.update(dt)) {
        p.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    this.game.hud.setEnemiesLeft(this.aliveCount() + this.spawnQueue.length);
  }

  spawnProjectile(enemy, target) {
    const from = new THREE.Vector3(
      enemy.position.x,
      enemy.position.y + 1.45 * enemy.type.scale,
      enemy.position.z);
    const aim = target && !target.isLocal
      ? new THREE.Vector3(target.position.x, target.position.y + 1.2, target.position.z)
      : this.game.player.eyePosition;
    if (!target || target.isLocal) aim.y -= 0.35; // chest height
    const dir = aim.sub(from).normalize();
    // slight inaccuracy
    dir.x += (Math.random() - 0.5) * 0.05;
    dir.y += (Math.random() - 0.5) * 0.05;
    dir.z += (Math.random() - 0.5) * 0.05;
    dir.normalize();
    this.projectiles.push(new Projectile(
      this.game, from, dir, enemy.type.projSpeed, enemy.type.projDmg));
    this.game.audio.enemyShot();
  }
}
