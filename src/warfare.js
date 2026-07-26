import * as THREE from 'three';
import { t } from './i18n.js';

// Killstreak attack helicopter, rideable hoverbike, and selectable equipment.

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

// ---------- ally attack helicopter (12-killstreak) ----------
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

// ---------- rideable hoverbike ----------
class Hoverbike {
  constructor(game, x, z, yaw, index) {
    this.game = game;
    this.index = index;
    this.home = { x, z, yaw };
    this.position = new THREE.Vector3(x, 0, z);
    this.yaw = yaw;
    this.speed = 0;
    this.mounted = false;
    this.remoteOccupied = false;
    this.hp = 150;
    this.maxHp = 150;
    this.destroyed = false;
    this.respawnTimer = 0;
    this.bob = Math.random() * 6;

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
    this.group = g;
    game.scene.add(g);
    this._sync(0);
  }

  _sync(dt) {
    this.bob += dt * 3;
    this.group.visible = !this.destroyed && !this.remoteOccupied;
    this.group.position.set(
      this.position.x, this.position.y + Math.sin(this.bob) * 0.05, this.position.z);
    this.group.rotation.y = this.yaw;
  }

  takeDamage(dmg) {
    if (this.destroyed) return;
    this.hp -= dmg;
    if (this.hp <= 0) this.destroy();
  }

  destroy() {
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
      this.game.weapons.rig.visible = true;
      p.takeDamage(30, pos, 'splash');
      if (this.game.mp.active) this.game.mp.sendBikeState(this.index, false);
    }
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

  // driving model: throttle + steer scaled by speed, light drift
  drive(dt) {
    const p = this.game.player;
    const keys = p.keys;
    const throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 0.5 : 0);
    const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    const boots = 1; // equipment doesn't affect vehicles
    this.speed += throttle * 14 * dt * boots;
    this.speed *= Math.max(0, 1 - 0.6 * dt);
    this.speed = Math.max(-6, Math.min(18, this.speed));
    this.yaw += steer * dt * (1.2 + Math.min(1.4, Math.abs(this.speed) * 0.08)) *
      Math.sign(this.speed >= 0 ? 1 : -1);

    const dx = -Math.sin(this.yaw) * this.speed * dt;
    const dz = -Math.cos(this.yaw) * this.speed * dt;
    this._moveAxis('x', dx);
    this._moveAxis('z', dz);
    const half = this.game.world.half - 1;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));

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

    // rider follows
    p.position.set(this.position.x, this.position.y + 0.55, this.position.z);
    p.velocity.set(0, 0, 0);
    this._sync(dt);
    p.syncCamera(dt);
  }

  _moveAxis(axis, amount) {
    if (amount === 0) return;
    this.position[axis] += amount;
    const half = 0.7;
    for (const c of this.game.world.colliders) {
      const overl =
        this.position.x + half > c.min.x && this.position.x - half < c.max.x &&
        this.position.y + 1.2 > c.min.y && this.position.y < c.max.y &&
        this.position.z + half > c.min.z && this.position.z - half < c.max.z;
      if (!overl) continue;
      if (axis === 'x') this.position.x = amount > 0 ? c.min.x - half : c.max.x + half;
      else this.position.z = amount > 0 ? c.min.z - half : c.max.z + half;
      this.speed *= 0.4; // bounce off
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
  }
}

// ---------- coordinator ----------
export class Warfare {
  constructor(game) {
    this.game = game;
    this.heli = null;
    this.bikes = [];

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyE' || !game.playing) return;
      if (game.cheats && game.cheats.open) return;
      this.toggleMount();
    });
  }

  spawnVehicles() {
    for (const b of this.bikes) b.dispose();
    this.bikes = [];
    this.game.world.vehicleSpawns.forEach((v, i) => {
      this.bikes.push(new Hoverbike(this.game, v.x, v.z, v.yaw, i));
    });
    if (this.heli) { this.game.scene.remove(this.heli.group); this.heli = null; }
  }

  callHelicopter() {
    if (this.heli) this.heli.life = 30; // extend
    else this.heli = new Helicopter(this.game);
    this.game.hud.killfeed(t('streakr.heli'), 'cheat');
  }

  setRemoteBike(index, occupied) {
    const b = this.bikes[index];
    if (b) {
      b.remoteOccupied = occupied;
      b._sync(0);
    }
  }

  toggleMount() {
    const p = this.game.player;
    if (p.vehicle) {
      // dismount to the side
      const bike = p.vehicle;
      bike.mounted = false;
      p.vehicle = null;
      if (this.game.mp.active) this.game.mp.sendBikeState(bike.index, false);
      p.position.set(
        bike.position.x + Math.cos(bike.yaw) * 1.2, bike.position.y,
        bike.position.z - Math.sin(bike.yaw) * 1.2);
      this.game.weapons.rig.visible = true;
      return;
    }
    if (!p.alive) return;
    for (const bike of this.bikes) {
      if (bike.destroyed || bike.remoteOccupied) continue;
      const d = Math.hypot(bike.position.x - p.position.x, bike.position.z - p.position.z);
      if (d < 2.4) {
        p.vehicle = bike;
        bike.mounted = true;
        this.game.weapons.rig.visible = false;
        this.game.weapons.triggerHeld = false;
        this.game.weapons.ads = false;
        this.game.hud.killfeed(t('vehicle.mounted'), 'cheat');
        if (this.game.mp.active) this.game.mp.sendBikeState(bike.index, true);
        return;
      }
    }
  }

  update(dt) {
    if (this.heli && !this.heli.update(dt)) this.heli = null;
    const p = this.game.player;
    for (const b of this.bikes) {
      b.tickRespawn(dt);
      if (!b.mounted) b._sync(dt);
    }
    if (p.vehicle) p.vehicle.drive(dt);

    // mount hint
    if (!p.vehicle && p.alive) {
      const near = this.bikes.some((b) =>
        Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z) < 2.4);
      this.game.hud.setMountHint(near);
    } else {
      this.game.hud.setMountHint(false);
    }
  }

  reset() {
    if (this.game.player.vehicle) {
      this.game.player.vehicle.mounted = false;
      this.game.player.vehicle = null;
    }
    if (this.heli) { this.game.scene.remove(this.heli.group); this.heli = null; }
  }
}
