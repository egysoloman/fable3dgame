import * as THREE from 'three';
import { t } from './i18n.js';

// Killstreak attack helicopter, drivable vehicles (hoverbike, battle tank,
// gunship helicopter), and selectable equipment.

export const EQUIP_DEFS = ['plates', 'helmet', 'stim', 'boots'];
const EQUIP_KEY = 'neonstrike.equip';

export function loadEquip() {
  try {
    const v = JSON.parse(localStorage.getItem(EQUIP_KEY) || '["plates","helmet"]');
    return v.filter((id) => EQUIP_DEFS.includes(id)).slice(0, 2);
  } catch (e) { return ['plates', 'helmet']; }
}

export function saveEquip(list) {
  try { localStorage.setItem(EQUIP_KEY, JSON.stringify(list)); } catch (e) { /* ok */ }
}

const _ray = new THREE.Raycaster();

// ---------- ally attack helicopter (12-killstreak escort) ----------
class Helicopter {
  constructor(game) {
    this.game = game;
    this.life = 30;
    this.angle = 0;
    this.gunTimer = 1;
    this.burst = 0;
    this.burstTimer = 0;

    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x24303a, roughness: 0.5, metalness: 0.6 });
    const trim = new THREE.MeshStandardMaterial({
      color: 0x62f0ff, emissive: 0x62f0ff, emissiveIntensity: 1.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 3.2), mat);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 2.6), mat);
    tail.position.set(0, 0.2, 2.6);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.7), mat);
    fin.position.set(0, 0.6, 3.6);
    g.add(fin);
    for (const sx of [-0.7, 0.7]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.4), trim);
      skid.position.set(sx, -0.75, 0);
      g.add(skid);
    }
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 0.3), mat);
    this.rotor.position.y = 0.75;
    g.add(this.rotor);
    g.scale.setScalar(1.35);
    this.group = g;
    game.scene.add(g);
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.game.scene.remove(this.group);
      return false;
    }
    const p = this.game.player.position;
    this.angle += dt * 0.55;
    const r = 16;
    const x = p.x + Math.cos(this.angle) * r;
    const z = p.z + Math.sin(this.angle) * r;
    const half = this.game.world.half - 4;
    this.group.position.set(
      Math.max(-half, Math.min(half, x)), 13 + Math.sin(this.angle * 2) * 0.6,
      Math.max(-half, Math.min(half, z)));
    this.group.rotation.y = -this.angle;
    this.rotor.rotation.y += dt * 30;

    // gunnery: pick a visible hostile, fire 3-round bursts
    if (this.burst > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.burstTimer = 0.11;
        this.burst--;
        this._fire();
      }
    } else {
      this.gunTimer -= dt;
      if (this.gunTimer <= 0) {
        this.gunTimer = 1.0;
        if (this._pickTarget()) this.burst = 3;
      }
    }
    return true;
  }

  _pickTarget() {
    const from = this.group.position;
    let best = null, bd = Infinity;
    for (const e of this.game.enemies.list) {
      if (!e.alive || e.spawnTimer > 0) continue;
      const c = new THREE.Vector3(e.position.x, e.position.y + e.height * 0.5, e.position.z);
      const d = c.distanceTo(from);
      if (d > 60 || d >= bd) continue;
      const dir = c.clone().sub(from);
      const dist = dir.length();
      dir.normalize();
      _ray.set(from.clone(), dir);
      _ray.far = dist;
      if (_ray.intersectObjects(this.game.world.colliderMeshes, false).length === 0) {
        best = e; bd = d;
      }
    }
    this.target = best;
    return !!best;
  }

  _fire() {
    const e = this.target;
    if (!e || !e.alive) { this.burst = 0; return; }
    const from = this.group.position.clone();
    const aim = new THREE.Vector3(
      e.position.x + (Math.random() - 0.5) * 1.2,
      e.position.y + e.height * 0.5,
      e.position.z + (Math.random() - 0.5) * 1.2);
    this.game.effects.tracer(from, aim, 0xffd27f);
    this.game.audio.remoteShot();
    const hit = Math.random() < 0.65;
    if (hit) e.takeDamage(14, aim, false);
    else this.game.effects.impactSparks(aim.setY(0.05));
  }
}

// ---------- drivable vehicle base ----------
// Shared health pool / destruction / pad respawn / occupancy claim / AABB
// slide. Subclasses supply the mesh, the driving model, and (optionally) a
// mounted weapon fired with the mouse while riding.
class Vehicle {
  constructor(game, x, z, yaw, index) {
    this.game = game;
    this.index = index;
    this.home = { x, z, yaw };
    this.position = new THREE.Vector3(x, 0, z);
    this.yaw = yaw;
    this.speed = 0;
    this.mounted = false;
    this.remoteOccupied = false;
    this.remoteDriven = false;
    this.destroyed = false;
    this.respawnTimer = 0;
    this.fireCooldown = 0;
    this.bob = Math.random() * 6;

    // subclass-tuned physique
    this.type = 'bike';
    this.maxHp = 150;
    this.enclosed = false;     // enclosed vehicles soak the rider's damage
    this.seatY = 0.55;
    this.mountRadius = 2.4;
    this.colHalf = 0.7;
    this.colHeight = 1.2;
    this.bobAmp = 0.05;
    this.ctlKey = 'vehicle.mounted';
    this._setup();
    this.hp = this.maxHp;

    this.group = this._build();
    game.scene.add(this.group);
    this._sync(0);
  }

  _setup() {}
  _build() { return new THREE.Group(); }
  passive(dt) {}

  _sync(dt) {
    this.bob += dt * 3;
    this.group.visible = !this.destroyed && (!this.remoteOccupied || this.remoteDriven);
    this.group.position.set(
      this.position.x, this.position.y + Math.sin(this.bob) * this.bobAmp,
      this.position.z);
    this.group.rotation.y = this.yaw;
  }

  takeDamage(dmg) {
    if (this.destroyed) return;
    this.hp -= dmg;
    if (this.hp <= 0) this.destroy();
  }

  destroy(fromRemote = false) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.respawnTimer = 20;
    const pos = this.position.clone();
    pos.y += 0.6;
    this.game.effects.explosion(pos);
    this.game.audio.explosion();
    this.game.hud.killfeed(t('vehicle.destroyed'), 'cheat');
    const p = this.game.player;
    if (p.vehicle === this) {
      p.vehicle = null;
      this.mounted = false;
      if (this.onDismount) this.onDismount();
      this.game.weapons.rig.visible = true;
      p.takeDamage(30, pos, 'splash');
      if (this.game.mp.active) this.game.mp.sendBikeState(this.index, false);
    }
    this.remoteOccupied = false;
    this.remoteDriven = false;
    this.botRider = null;
    if (this.game.mp.active && !fromRemote) this.game.mp.sendVehKill(this.index);
  }

  tickRespawn(dt) {
    if (!this.destroyed) return;
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.destroyed = false;
      this.hp = this.maxHp;
      this.position.set(this.home.x, 0, this.home.z);
      this.yaw = this.home.yaw;
      this.speed = 0;
      this.game.effects.spawnPortal(this.position, 0xb06aff);
    }
  }

  _moveAxis(axis, amount) {
    if (amount === 0) return;
    this.position[axis] += amount;
    const half = this.colHalf;
    for (const c of this.game.world.colliders) {
      const overl =
        this.position.x + half > c.min.x && this.position.x - half < c.max.x &&
        this.position.y + this.colHeight > c.min.y && this.position.y < c.max.y &&
        this.position.z + half > c.min.z && this.position.z - half < c.max.z;
      if (!overl) continue;
      if (axis === 'x') this.position.x = amount > 0 ? c.min.x - half : c.max.x + half;
      else this.position.z = amount > 0 ? c.min.z - half : c.max.z + half;
      this.speed *= 0.4; // bounce off
    }
  }

  _seatRider(dt) {
    const p = this.game.player;
    p.position.set(this.position.x, this.position.y + this.seatY, this.position.z);
    p.velocity.set(0, 0, 0);
    this._sync(dt);
    p.syncCamera(dt);
  }

  // shared projectile machinery for vehicles with cannons/rocket pods
  _stepShells(dt, radius, dmg) {
    if (!this.shells) return;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.life -= dt;
      let boom = s.life <= 0;
      const steps = 3;
      for (let k = 0; k < steps && !boom; k++) {
        s.pos.addScaledVector(s.vel, dt / steps);
        s.vel.y -= (s.grav || 9) * dt / steps;
        boom = this._shellHit(s.pos);
      }
      s.mesh.position.copy(s.pos);
      if (boom) {
        this.game.scene.remove(s.mesh);
        this.shells.splice(i, 1);
        this.game.applySplash(s.pos.clone(), radius, dmg);
      }
    }
  }

  _shellHit(pos) {
    if (pos.y <= 0.06) return true;
    for (const c of this.game.world.colliders) {
      if (pos.x > c.min.x && pos.x < c.max.x && pos.y > c.min.y &&
          pos.y < c.max.y && pos.z > c.min.z && pos.z < c.max.z) return true;
    }
    for (const e of this.game.enemies.list) {
      if (!e.alive || e.spawnTimer > 0) continue;
      if (Math.hypot(e.position.x - pos.x, e.position.z - pos.z) < 1.3 &&
          pos.y < e.position.y + e.height + 0.5) return true;
    }
    return false;
  }

  dispose() {
    if (this.shells) {
      for (const s of this.shells) this.game.scene.remove(s.mesh);
      this.shells = [];
    }
    this.game.scene.remove(this.group);
  }
}

// ---------- rideable hoverbike ----------
class Hoverbike extends Vehicle {
  _setup() {
    this.type = 'bike';
    this.maxHp = 150;
  }

  _build() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2e40, roughness: 0.45, metalness: 0.7 });
    const glow = new THREE.MeshStandardMaterial({
      color: 0xb06aff, emissive: 0xb06aff, emissiveIntensity: 1.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 2.2), mat);
    body.position.y = 0.62;
    g.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.8), glow);
    seat.position.set(0, 0.86, 0.3);
    g.add(seat);
    const bars = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), mat);
    bars.position.set(0, 0.95, -0.85);
    g.add(bars);
    for (const nz of [-0.85, 0.85]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.7), glow);
      pad.position.set(0, 0.28, nz);
      g.add(pad);
    }
    return g;
  }

  // driving model: throttle + steer scaled by speed, light drift
  drive(dt) {
    const p = this.game.player;
    const keys = p.keys;
    const throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 0.5 : 0);
    const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    this.speed += throttle * 14 * dt;
    this.speed *= Math.max(0, 1 - 0.6 * dt);
    this.speed = Math.max(-6, Math.min(18, this.speed));
    this.yaw += steer * dt * (1.2 + Math.min(1.4, Math.abs(this.speed) * 0.08)) *
      Math.sign(this.speed >= 0 ? 1 : -1);

    const px0 = this.position.x, pz0 = this.position.z;
    const dx = -Math.sin(this.yaw) * this.speed * dt;
    const dz = -Math.cos(this.yaw) * this.speed * dt;
    this._moveAxis('x', dx);
    this._moveAxis('z', dz);
    const half = this.game.world.half - 1;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));
    if (!this.game.world.groundAt(this.position.x, this.position.z)) {
      this.position.x = px0;
      this.position.z = pz0;
      this.speed *= 0.3;
    }

    // ram damage (the bike takes wear too)
    if (Math.abs(this.speed) > 8) {
      for (const e of this.game.enemies.list) {
        if (!e.alive) continue;
        const d = Math.hypot(e.position.x - this.position.x, e.position.z - this.position.z);
        if (d < 1.5) {
          e.takeDamage(95, new THREE.Vector3(e.position.x, 1, e.position.z), false);
          this.speed *= 0.6;
          this.takeDamage(8);
          this.game.player.addShake(0.06);
        }
      }
    }
    this._seatRider(dt);
  }
}

// ---------- battle tank ----------
// Slow, enclosed, and heavily armored; the turret tracks the camera and the
// cannon lobs splash shells on left click.
class Tank extends Vehicle {
  _setup() {
    this.type = 'tank';
    this.maxHp = 600;
    this.enclosed = true;
    this.seatY = 1.75;
    this.mountRadius = 3.4;
    this.colHalf = 1.5;
    this.colHeight = 1.8;
    this.bobAmp = 0;
    this.ctlKey = 'vehicle.tankCtl';
    this.shells = [];
  }

  _build() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2e3b2e, roughness: 0.6, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a221a, roughness: 0.8, metalness: 0.3 });
    const glow = new THREE.MeshStandardMaterial({
      color: 0x9dff6a, emissive: 0x9dff6a, emissiveIntensity: 0.9 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 3.8), mat);
    hull.position.y = 0.85;
    g.add(hull);
    for (const sx of [-1.25, 1.25]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 4.1), dark);
      track.position.set(sx, 0.42, 0);
      g.add(track);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.3), glow);
    stripe.position.set(0, 1.32, 1.4);
    g.add(stripe);
    this.turret = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.9), mat);
    this.turret.add(dome);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2.6), dark);
    barrel.position.set(0, 0.1, -2.0);
    this.turret.add(barrel);
    this.turret.position.y = 1.6;
    g.add(this.turret);
    return g;
  }

  drive(dt) {
    const keys = this.game.player.keys;
    const throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 0.7 : 0);
    const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    this.speed += throttle * 6 * dt;
    this.speed *= Math.max(0, 1 - 1.1 * dt);
    this.speed = Math.max(-3.5, Math.min(7, this.speed));
    this.yaw += steer * dt * 0.9;

    const px0 = this.position.x, pz0 = this.position.z;
    this._moveAxis('x', -Math.sin(this.yaw) * this.speed * dt);
    this._moveAxis('z', -Math.cos(this.yaw) * this.speed * dt);
    const half = this.game.world.half - 2;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));
    if (!this.game.world.groundAt(this.position.x, this.position.z)) {
      this.position.x = px0;
      this.position.z = pz0;
      this.speed *= 0.3;
    }

    // tracks crush anything they touch
    if (Math.abs(this.speed) > 1.5) {
      for (const e of this.game.enemies.list) {
        if (!e.alive) continue;
        const d = Math.hypot(e.position.x - this.position.x, e.position.z - this.position.z);
        if (d < 2.3) {
          e.takeDamage(180, new THREE.Vector3(e.position.x, 1, e.position.z), false);
          this.speed *= 0.75;
          this.game.player.addShake(0.08);
        }
      }
    }

    // turret follows the camera
    this.turret.rotation.y = this.game.player.yaw - this.yaw;
    this._seatRider(dt);
  }

  fire(dt, held) {
    if (!held || this.fireCooldown > 0) return;
    this.fireCooldown = 2.2;
    const g = this.game;
    const dir = g.camera.getWorldDirection(new THREE.Vector3());
    const from = this.position.clone();
    from.y += 2.0;
    from.addScaledVector(dir, 2.6);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    mesh.position.copy(from);
    g.scene.add(mesh);
    this.shells.push({ pos: from, vel: dir.multiplyScalar(38), life: 4, mesh });
    g.audio.explosion();
    g.effects.impactSparks(from.clone());
    g.player.addShake(0.16);
    if (g.mp.active) g.mp.sendShot(from, from.clone().addScaledVector(dir, 3), 0xffe08a);
  }

  passive(dt) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    this._stepShells(dt, 6, 95);
  }
}

// ---------- drivable gunship helicopter ----------
// Free flight with altitude control; the chin gun is a fast hitscan fired
// through the crosshair.
class AttackHeli extends Vehicle {
  _setup() {
    this.type = 'heli';
    this.maxHp = 350;
    this.enclosed = true;
    this.seatY = 1.5;
    this.mountRadius = 4.2;
    this.colHalf = 2.0;
    this.colHeight = 2.5;
    this.bobAmp = 0.04;
    this.ctlKey = 'vehicle.heliCtl';
    this.shells = [];
    this.rocketCooldown = 0;
  }

  // belly-gunner camera: hang below the airframe with a clear view down;
  // the aircraft itself stays out of frame above you
  _seatRider(dt) {
    const p = this.game.player;
    p.position.set(this.position.x,
      Math.max(0.15, this.position.y - 2.1), this.position.z);
    p.velocity.set(0, 0, 0);
    this._sync(dt);
    p.syncCamera(dt);
  }

  _build() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x263a42, roughness: 0.5, metalness: 0.65 });
    const glow = new THREE.MeshStandardMaterial({
      color: 0x27e8ff, emissive: 0x27e8ff, emissiveIntensity: 1.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 3.4), mat);
    body.position.y = 1.0;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.8), glow);
    nose.position.set(0, 0.85, -2.0);
    g.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.6), mat);
    tail.position.set(0, 1.25, 2.7);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.6), mat);
    fin.position.set(0, 1.7, 3.7);
    g.add(fin);
    for (const sx of [-0.75, 0.75]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.6), mat);
      skid.position.set(sx, 0.1, 0);
      g.add(skid);
    }
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.06, 0.32), mat);
    this.rotor.position.y = 1.75;
    g.add(this.rotor);
    // stub wings with rocket pods
    for (const sx of [-1.1, 1.1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.5), mat);
      wing.position.set(sx, 0.9, -0.4);
      g.add(wing);
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 8), glow);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sx * 1.35, 0.75, -0.5);
      g.add(pod);
    }
    g.scale.setScalar(1.45); // an imposing airframe
    return g;
  }

  drive(dt) {
    const keys = this.game.player.keys;
    const throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 0.8 : 0);
    const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    const lift = (keys.has('Space') ? 1 : 0) -
      ((keys.has('ControlLeft') || keys.has('KeyC')) ? 1 : 0);
    this.speed += throttle * 12 * dt;
    this.speed *= Math.max(0, 1 - 0.5 * dt);
    this.speed = Math.max(-9, Math.min(17, this.speed));
    this.yaw += steer * dt * 1.5;
    // auto-hover: while flown, stay high enough for the belly camera
    this.position.y = Math.max(this.mounted ? 2.4 : 0.2,
      Math.min(24, this.position.y + lift * 6.5 * dt));

    this._moveAxis('x', -Math.sin(this.yaw) * this.speed * dt);
    this._moveAxis('z', -Math.cos(this.yaw) * this.speed * dt);
    const half = this.game.world.half - 2;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));

    this.group.rotation.x = -this.speed * 0.012;
    this._seatRider(dt);
  }

  fire(dt, held) {
    if (!held || this.fireCooldown > 0) return;
    this.fireCooldown = 0.12;
    const g = this.game;
    const cam = g.camera;
    const camPos = cam.getWorldPosition(new THREE.Vector3());
    const dir = cam.getWorldDirection(new THREE.Vector3());
    dir.x += (Math.random() - 0.5) * 0.02;
    dir.y += (Math.random() - 0.5) * 0.02;
    dir.normalize();
    _ray.set(camPos, dir);
    _ray.far = 160;
    const targets = [...g.world.colliderMeshes, ...g.enemies.aliveGroups()];
    if (g.mp && g.mp.versus) targets.push(...g.mp.pvpTargets());
    const hits = _ray.intersectObjects(targets, true);
    const muzzle = camPos.clone().addScaledVector(dir, 1.3);
    muzzle.y -= 0.35; // from the chin gun under the cockpit
    let end = camPos.clone().addScaledVector(dir, 160);
    const h = hits[0];
    if (h) {
      end = h.point;
      if (h.object.userData.rp) {
        g.effects.enemyHitSparks(end);
        g.hud.hitmarker(false);
        g.audio.hit(false);
        g.mp.sendPvpHit(h.object.userData.rp.id, 13, end);
      } else if (h.object.userData.enemy) {
        h.object.userData.enemy.takeDamage(13, end, false);
      } else {
        g.effects.impactSparks(end);
      }
    }
    g.effects.tracer(muzzle, end, 0xffd27f);
    g.audio.remoteShot();
    if (g.mp.active) g.mp.sendShot(muzzle, end, 0xffd27f);
  }

  // right mouse: a rocket volley from the wing pods
  fireAlt(dt, held) {
    if (!held || this.rocketCooldown > 0) return;
    this.rocketCooldown = 2.6;
    const g = this.game;
    const dir = g.camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (const side of [-1, 1]) {
      const from = this.position.clone();
      from.y += 1.1;
      from.addScaledVector(right, side * 1.9);
      from.addScaledVector(dir, 2.2);
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.4, 6),
        new THREE.MeshBasicMaterial({ color: 0xc8ff8a }));
      mesh.position.copy(from);
      g.scene.add(mesh);
      this.shells.push({ pos: from, vel: dir.clone().multiplyScalar(46),
        life: 3, grav: 2, mesh });
    }
    g.audio.rocketFire();
    g.player.addShake(0.12);
    if (g.mp.active) g.mp.sendShot(this.position.clone(),
      this.position.clone().addScaledVector(dir, 4), 0xc8ff8a);
  }

  passive(dt) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.rocketCooldown > 0) this.rocketCooldown -= dt;
    this._stepShells(dt, 5, 85);
    this.rotor.rotation.y += dt * (this.mounted || this.remoteDriven ? 30 : 2);
  }
}

const VEHICLE_TYPES = { bike: Hoverbike, tank: Tank, heli: AttackHeli };

// ---------- orbital railgun (7-killstreak) ----------
// Press 0 to switch to a top-down tactical view: the mouse steers a ground
// reticle, each click calls a railgun lance from orbit with heavy AOE splash.
export class OrbitalRailgun {
  constructor(game) {
    this.game = game;
    this.charges = 0;
    this.active = false;
    this.cooldown = 0;
    this.pending = [];
    this.beams = [];
    this.reticle = null;
    this.retPos = new THREE.Vector3();
  }

  grant(n) {
    this.charges = Math.max(this.charges, n);
    this.game.hud.killfeed(t('orbital.ready'), 'cheat');
    this.game.hud.setOrbital(this.charges, this.active);
  }

  toggle() {
    if (this.active) { this.exit(); return; }
    const g = this.game;
    if (this.charges <= 0 || !g.player.alive || g.player.vehicle) return;
    this.active = true;
    g.hud.setOrbital(this.charges, true);
    this.retPos.copy(g.player.position);
    if (!this.reticle) {
      const ringGeo = new THREE.RingGeometry(7.4, 9, 48);
      ringGeo.rotateX(-Math.PI / 2);
      this.reticle = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0x62f0ff, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false }));
    }
    this.reticle.position.set(this.retPos.x, 0.15, this.retPos.z);
    g.scene.add(this.reticle);
    g.weapons.rig.visible = false;
    g.weapons.triggerHeld = false;
    g.weapons.ads = false;
    g.hud.setScope(false);
    g.hud.subbanner(t('orbital.aim', { n: this.charges }));
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    if (this.reticle) this.game.scene.remove(this.reticle);
    if (this.game.player.alive && !this.game.player.vehicle) {
      this.game.weapons.rig.visible = true;
    }
    this.game.hud.subbanner('');
    this.game.hud.setOrbital(this.charges, false);
  }

  onMouse(mx, my) {
    const half = this.game.world.half - 2;
    const s = 0.05;
    this.retPos.x = Math.max(-half, Math.min(half, this.retPos.x + mx * s));
    this.retPos.z = Math.max(-half, Math.min(half, this.retPos.z + my * s));
  }

  fire() {
    if (!this.active || this.charges <= 0 || this.cooldown > 0) return;
    this.cooldown = 1.1;
    this.charges--;
    // charge-up: a converging ring glows at the strike point while the
    // lance spins up in orbit
    const ringGeo = new THREE.RingGeometry(0.7, 1.05, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0x8af4ff, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false }));
    ring.position.set(this.retPos.x, 0.2, this.retPos.z);
    this.game.scene.add(ring);
    this.pending.push({ pos: this.retPos.clone(), t: 0.7, total: 0.7, ring });
    this.game.audio.orbitalHum();
    this.game.hud.subbanner(
      this.charges > 0 ? t('orbital.aim', { n: this.charges }) : '');
    this.game.hud.setOrbital(this.charges, this.active);
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const s = this.pending[i];
      s.t -= dt;
      if (s.t > 0) {
        const k = Math.max(0.05, s.t / s.total);
        s.ring.scale.setScalar(0.6 + k * 5);
        s.ring.material.opacity = 0.35 + (1 - k) * 0.65;
        s.ring.rotation.y += dt * 5;
        continue;
      }
      this.pending.splice(i, 1);
      const g = this.game;
      g.scene.remove(s.ring);
      s.ring.geometry.dispose();
      s.ring.material.dispose();
      // the lance: a slim light strip from orbit with a thunderclap —
      // deliberately narrow, no screen-filling glow
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x9af6ff, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.3, 84, 8, 1, true), beamMat);
      beam.position.set(s.pos.x, 42, s.pos.z);
      g.scene.add(beam);
      this.beams.push({ mesh: beam, mat: beamMat, t: 0.5 });
      if (g.mp.active) {
        g.mp.sendShot(new THREE.Vector3(s.pos.x, 70, s.pos.z), s.pos, 0x62f0ff);
      }
      g.audio.orbitalBlast();
      g.applySplash(s.pos.clone().setY(0.4), 9, 170);
      g.player.addShake(0.35);
    }
    // beam afterglow: hold the strip, just fade it out
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t -= dt;
      b.mat.opacity = Math.max(0, b.t / 0.5) * 0.9;
      if (b.t <= 0) {
        this.game.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mat.dispose();
        this.beams.splice(i, 1);
      }
    }
    if (this.active) {
      if (!this.game.player.alive) { this.exit(); return; }
      this.reticle.position.set(this.retPos.x, 0.15, this.retPos.z);
      this.reticle.rotation.y += dt * 0.8;
      this.reticle.material.opacity = this.cooldown > 0 ? 0.3 : 0.85;
      if (this.charges <= 0 && this.pending.length === 0 && this.cooldown <= 0.4) {
        this.exit();
      }
    }
  }

  // top-down tactical camera above the reticle
  applyCamera() {
    const cam = this.game.camera;
    const h = Math.min(64, this.game.world.half * 1.1 + 12);
    cam.position.set(this.retPos.x, h, this.retPos.z);
    cam.up.set(0, 0, -1);
    cam.lookAt(this.retPos.x, 0, this.retPos.z);
    cam.up.set(0, 1, 0);
  }

  reset() {
    this.exit();
    this.charges = 0;
    this.cooldown = 0;
    for (const s of this.pending) {
      this.game.scene.remove(s.ring);
      s.ring.geometry.dispose();
      s.ring.material.dispose();
    }
    this.pending = [];
    for (const b of this.beams) {
      this.game.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mat.dispose();
    }
    this.beams = [];
    this.game.hud.setOrbital(0, false);
  }
}

// ---------- coordinator ----------
export class Warfare {
  constructor(game) {
    this.game = game;
    this.heli = null;
    this.vehicles = [];
    this._remoteVeh = new Map(); // remote player id -> vehicle index
    this.strikes = [];
    this.packages = [];

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyE' || !game.playing) return;
      if (game.cheats && game.cheats.open) return;
      this.toggleMount();
    });
  }

  // legacy alias: splash damage and older call sites use .bikes
  get bikes() { return this.vehicles; }

  spawnVehicles() {
    for (const v of this.vehicles) v.dispose();
    this.vehicles = [];
    this._remoteVeh.clear();
    this.game.world.vehicleSpawns.forEach((v, i) => {
      const Cls = VEHICLE_TYPES[v.type] || Hoverbike;
      this.vehicles.push(new Cls(this.game, v.x, v.z, v.yaw, i));
    });
    if (this.heli) { this.game.scene.remove(this.heli.group); this.heli = null; }
  }

  callHelicopter() {
    if (this.heli) this.heli.life = 30; // extend
    else this.heli = new Helicopter(this.game);
    this.game.hud.killfeed(t('streakr.heli'), 'cheat');
  }

  // Airstrike (6-killstreak): after a short delay, a stick of five bombs
  // walks a line across wherever the player is aiming.
  callAirstrike() {
    const g = this.game;
    const dir = g.camera.getWorldDirection(new THREE.Vector3());
    const eye = g.player.eyePosition;
    // aim point: crosshair ground intercept, else 25 m out
    let target;
    if (dir.y < -0.05) {
      target = eye.clone().addScaledVector(dir, -eye.y / dir.y);
    } else {
      target = eye.clone().addScaledVector(dir, 25);
      target.y = 0;
    }
    const half = g.world.half - 2;
    target.x = Math.max(-half, Math.min(half, target.x));
    target.z = Math.max(-half, Math.min(half, target.z));
    const lat = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let i = 0; i < 5; i++) {
      const at = target.clone().addScaledVector(lat, (i - 2) * 5);
      at.y = 0;
      this.strikes.push({ pos: at, t: 1.2 + i * 0.16 });
    }
    g.audio.rocketFire();
  }

  // Care package (8-killstreak): a crate drops ahead of the player with a
  // random reward inside — grab it before it expires.
  dropCarePackage() {
    const g = this.game;
    const fwd = g.player.forwardDir();
    const at = g.player.position.clone().addScaledVector(fwd, 8);
    const half = g.world.half - 3;
    at.x = Math.max(-half, Math.min(half, at.x));
    at.z = Math.max(-half, Math.min(half, at.z));
    if (!g.world.groundAt(at.x, at.z)) at.copy(g.player.position);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x2a6a3a, roughness: 0.7, metalness: 0.3,
        emissive: 0x2aff6a, emissiveIntensity: 0.25 }));
    mesh.position.set(at.x, 26, at.z);
    g.scene.add(mesh);
    const light = new THREE.PointLight(0x2aff6a, 30, 12, 1.8);
    light.position.set(at.x, 2, at.z);
    g.scene.add(light);
    this.packages.push({ pos: at, mesh, light, falling: true, life: 45 });
  }

  _updateStrikes(dt) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.strikes.splice(i, 1);
      const g = this.game;
      g.effects.tracer(new THREE.Vector3(s.pos.x, 60, s.pos.z),
        new THREE.Vector3(s.pos.x, 0.3, s.pos.z), 0xffb347);
      g.applySplash(s.pos.clone().setY(0.4), 6, 90);
      g.player.addShake(0.18);
    }
  }

  _updatePackages(dt) {
    const g = this.game;
    for (let i = this.packages.length - 1; i >= 0; i--) {
      const c = this.packages[i];
      if (c.falling) {
        c.mesh.position.y -= 12 * dt;
        if (c.mesh.position.y <= 0.6) {
          c.mesh.position.y = 0.6;
          c.falling = false;
          g.effects.impactSparks(c.pos.clone());
          g.audio.land();
        }
      } else {
        c.life -= dt;
        c.mesh.rotation.y += dt * 0.8;
        const p = g.player;
        if (p.alive &&
            Math.hypot(p.position.x - c.pos.x, p.position.z - c.pos.z) < 2.2) {
          const roll = Math.random();
          if (roll < 0.34) {
            g.weapons.current.refill();
            g.weapons.addReserveAll(2);
            g.hud.killfeed(t('care.ammo'), 'cheat');
          } else if (roll < 0.67) {
            g.orbital.grant(1);
            g.hud.killfeed(t('care.orbital'), 'cheat');
          } else {
            p.armor = Math.min(75, p.armor + 75);
            g.hud.setArmor(p.armor);
            g.weapons.addGrenade(2);
            g.hud.killfeed(t('care.armor'), 'cheat');
          }
          g.audio.waveClear();
          c.life = 0;
        }
        if (c.life <= 0) {
          g.scene.remove(c.mesh);
          g.scene.remove(c.light);
          c.mesh.geometry.dispose();
          c.mesh.material.dispose();
          this.packages.splice(i, 1);
        }
      }
    }
  }

  setRemoteBike(index, occupied) {
    const b = this.vehicles[index];
    if (b) {
      b.remoteOccupied = occupied;
      if (!occupied) b.remoteDriven = false;
      b._sync(0);
    }
  }

  // 15 Hz vehicle state piggybacked on the player-state message
  applyRemoteVehicle(from, v) {
    const prev = this._remoteVeh.get(from);
    if (!v) {
      if (prev !== undefined) {
        this._remoteVeh.delete(from);
        this.setRemoteBike(prev, false);
      }
      return;
    }
    const [i, x, y, z, yaw] = v;
    if (prev !== undefined && prev !== i) this.setRemoteBike(prev, false);
    this._remoteVeh.set(from, i);
    const veh = this.vehicles[i];
    if (!veh || veh.destroyed) return;
    veh.remoteOccupied = true;
    veh.remoteDriven = true;
    veh.position.set(x, y, z);
    veh.yaw = yaw;
    veh._sync(0);
  }

  destroyRemote(index) {
    const v = this.vehicles[index];
    if (v) v.destroy(true);
  }

  toggleMount() {
    const p = this.game.player;
    if (p.vehicle) {
      // dismount to the side
      const v = p.vehicle;
      v.mounted = false;
      p.vehicle = null;
      if (v.onDismount) v.onDismount();
      if (this.game.mp.active) this.game.mp.sendBikeState(v.index, false);
      p.position.set(
        v.position.x + Math.cos(v.yaw) * (v.colHalf + 0.6), v.position.y,
        v.position.z - Math.sin(v.yaw) * (v.colHalf + 0.6));
      this.game.weapons.rig.visible = true;
      this.game.hud.setVehicleHp(null);
      return;
    }
    if (!p.alive) return;
    for (const v of this.vehicles) {
      if (v.destroyed || v.remoteOccupied || v.botRider) continue;
      const d = Math.hypot(v.position.x - p.position.x, v.position.z - p.position.z);
      if (d < v.mountRadius) {
        p.vehicle = v;
        v.mounted = true;
        if (v.onMount) v.onMount();
        this.game.weapons.rig.visible = false;
        this.game.weapons.triggerHeld = false;
        this.game.weapons.ads = false;
        this.game.hud.killfeed(t(v.ctlKey), 'cheat');
        if (this.game.mp.active) this.game.mp.sendBikeState(v.index, true);
        return;
      }
    }
  }

  update(dt) {
    if (this.heli && !this.heli.update(dt)) this.heli = null;
    this._updateStrikes(dt);
    this._updatePackages(dt);
    const p = this.game.player;
    for (const v of this.vehicles) {
      v.tickRespawn(dt);
      v.passive(dt);
      if (!v.mounted) v._sync(dt);
    }
    if (p.vehicle) {
      p.vehicle.drive(dt);
      if (p.vehicle.fire) p.vehicle.fire(dt, this.game.weapons.triggerHeld);
      if (p.vehicle.fireAlt) p.vehicle.fireAlt(dt, this.game.weapons.ads);
      this.game.hud.setVehicleHp(p.vehicle);
    } else {
      this.game.hud.setVehicleHp(null);
    }

    // mount hint
    if (!p.vehicle && p.alive) {
      const near = this.vehicles.some((v) => !v.destroyed && !v.remoteOccupied &&
        !v.botRider &&
        Math.hypot(v.position.x - p.position.x, v.position.z - p.position.z) < v.mountRadius);
      this.game.hud.setMountHint(near);
    } else {
      this.game.hud.setMountHint(false);
    }
  }

  reset() {
    this.strikes = [];
    for (const c of this.packages || []) {
      this.game.scene.remove(c.mesh);
      this.game.scene.remove(c.light);
    }
    this.packages = [];
    const v = this.game.player.vehicle;
    if (v) {
      v.mounted = false;
      if (v.onDismount) v.onDismount();
      this.game.player.vehicle = null;
    }
    this.game.hud.setVehicleHp(null);
    if (this.heli) { this.game.scene.remove(this.heli.group); this.heli = null; }
  }
}
