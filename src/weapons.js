import * as THREE from 'three';
import { t } from './i18n.js';

const HIP_POS = new THREE.Vector3(0.28, -0.26, -0.5);

export const WEAPON_DEFS = [
  {
    id: 'pistol', unlockRank: 1, name: 'P-9 SIDEARM', sound: 'pistol',
    damage: 25, pellets: 1, fireDelay: 0.22, auto: false,
    spreadHip: 0.014, spreadAds: 0.004, bloom: 0.006,
    magSize: 12, reserve: Infinity, reloadTime: 0.9,
    recoil: 0.035, kick: 0.006, tracer: 0xaef4ff,
    adsFov: 62, scope: false, moveMul: 1.0, headshotMul: 2,
    bodyColor: 0x3d4f66, accentColor: 0x27e8ff,
    barrelLen: 0.3, bodyLen: 0.22, thickness: 0.07,
  },
  {
    id: 'smg', unlockRank: 1, name: 'VIPER SMG', sound: 'smg',
    damage: 11, pellets: 1, fireDelay: 0.075, auto: true,
    spreadHip: 0.026, spreadAds: 0.012, bloom: 0.004,
    magSize: 32, reserve: 160, reloadTime: 1.4,
    recoil: 0.02, kick: 0.0035, tracer: 0xd0a8ff,
    adsFov: 60, scope: false, moveMul: 1.0, headshotMul: 2,
    bodyColor: 0x46405e, accentColor: 0xb06aff,
    barrelLen: 0.3, bodyLen: 0.3, thickness: 0.075,
  },
  {
    id: 'rifle', unlockRank: 1, name: 'HELIX AR', sound: 'rifle',
    damage: 16, pellets: 1, fireDelay: 0.105, auto: true,
    spreadHip: 0.022, spreadAds: 0.006, bloom: 0.005,
    magSize: 30, reserve: 150, reloadTime: 1.7,
    recoil: 0.028, kick: 0.005, tracer: 0x8affd0,
    adsFov: 58, scope: false, moveMul: 0.95, headshotMul: 2,
    bodyColor: 0x35455c, accentColor: 0x27ff8a,
    barrelLen: 0.5, bodyLen: 0.34, thickness: 0.085, sight: true,
  },
  {
    id: 'dmr', unlockRank: 2, name: 'JUDGE DMR', sound: 'dmr',
    damage: 42, pellets: 1, fireDelay: 0.28, auto: false,
    spreadHip: 0.014, spreadAds: 0.003, bloom: 0.006,
    magSize: 12, reserve: 48, reloadTime: 1.8,
    recoil: 0.055, kick: 0.011, tracer: 0xfff2a8,
    adsFov: 45, scope: false, moveMul: 0.92, headshotMul: 2,
    bodyColor: 0x4c4a3a, accentColor: 0xe8d86a,
    barrelLen: 0.58, bodyLen: 0.36, thickness: 0.08, sight: true,
  },
  {
    id: 'shotgun', unlockRank: 3, name: 'BREACHER', sound: 'shotgun',
    damage: 9, pellets: 8, fireDelay: 0.85, auto: false,
    spreadHip: 0.07, spreadAds: 0.05, bloom: 0.008,
    magSize: 6, reserve: 30, reloadTime: 2.2,
    recoil: 0.12, kick: 0.02, tracer: 0xffc98a,
    adsFov: 65, scope: false, moveMul: 0.95, headshotMul: 2,
    bodyColor: 0x4d3f39, accentColor: 0xffb347,
    barrelLen: 0.44, bodyLen: 0.32, thickness: 0.105,
  },
  {
    id: 'lmg', unlockRank: 4, name: 'BASTION LMG', sound: 'lmg',
    damage: 14, pellets: 1, fireDelay: 0.09, auto: true,
    spreadHip: 0.032, spreadAds: 0.014, bloom: 0.0045,
    magSize: 75, reserve: 150, reloadTime: 3.6,
    recoil: 0.032, kick: 0.006, tracer: 0xffa8a8,
    adsFov: 60, scope: false, moveMul: 0.85, headshotMul: 2,
    bodyColor: 0x50384a, accentColor: 0xff5b8a,
    barrelLen: 0.55, bodyLen: 0.42, thickness: 0.1, mag: true,
  },
  {
    id: 'sniper', unlockRank: 5, name: 'SPECTRE', sound: 'sniper',
    damage: 120, pellets: 1, fireDelay: 1.25, auto: false,
    spreadHip: 0.05, spreadAds: 0.0006, bloom: 0.01,
    magSize: 5, reserve: 20, reloadTime: 2.6,
    recoil: 0.14, kick: 0.02, tracer: 0xffffff,
    adsFov: 24, scope: true, moveMul: 0.9, headshotMul: 2.5,
    bodyColor: 0x2e4050, accentColor: 0x9fdcff,
    barrelLen: 0.72, bodyLen: 0.38, thickness: 0.08, sight: true,
  },
  {
    id: 'launcher', unlockRank: 6, name: 'HAVOC RL', sound: 'rocket',
    damage: 0, pellets: 0, fireDelay: 1.6, auto: false,
    spreadHip: 0.01, spreadAds: 0.004, bloom: 0,
    magSize: 1, reserve: 7, reloadTime: 2.8,
    recoil: 0.16, kick: 0.016, tracer: 0xffc98a,
    adsFov: 62, scope: false, moveMul: 0.85, headshotMul: 1,
    bodyColor: 0x3a4436, accentColor: 0xa8ff6a,
    barrelLen: 0.65, bodyLen: 0.3, thickness: 0.15,
    rocket: { speed: 30, splashRadius: 4.5, splashDmg: 95 },
  },
  {
    id: 'carbine', unlockRank: 7, name: 'VOLT CARBINE', sound: 'dmr',
    damage: 20, pellets: 1, fireDelay: 0.34, auto: false, burst: 3, burstDelay: 0.07,
    spreadHip: 0.018, spreadAds: 0.004, bloom: 0.005,
    magSize: 24, reserve: 96, reloadTime: 1.9,
    recoil: 0.04, kick: 0.007, tracer: 0x7affff,
    adsFov: 52, scope: false, moveMul: 0.94, headshotMul: 2,
    bodyColor: 0x2f4a4a, accentColor: 0x3affd8,
    barrelLen: 0.5, bodyLen: 0.34, thickness: 0.08, sight: true,
  },
  {
    id: 'railgun', unlockRank: 99, streakOnly: true, name: 'AEGIS RAILGUN', sound: 'sniper',
    damage: 250, pellets: 1, fireDelay: 1.1, auto: false, pierce: true,
    spreadHip: 0.002, spreadAds: 0.0004, bloom: 0,
    magSize: 5, reserve: 0, reloadTime: 99,
    recoil: 0.18, kick: 0.022, tracer: 0x62f0ff,
    adsFov: 40, scope: false, moveMul: 0.88, headshotMul: 1.5,
    bodyColor: 0x1e3448, accentColor: 0x62f0ff,
    barrelLen: 0.85, bodyLen: 0.4, thickness: 0.1, sight: true, mag: true,
  },
];

const GRENADE = { fuse: 2.2, splashRadius: 5, splashDmg: 110, throwSpeed: 17, max: 5 };

function buildViewModel(def) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.bodyColor, roughness: 0.5, metalness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: def.accentColor, emissive: def.accentColor, emissiveIntensity: 1.2, roughness: 0.4,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(def.thickness, def.thickness * 1.4, def.bodyLen), bodyMat);
  group.add(body);

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(def.thickness * 0.6, def.thickness * 0.6, def.barrelLen), bodyMat);
  barrel.position.set(0, def.thickness * 0.25, -(def.bodyLen + def.barrelLen) / 2);
  group.add(barrel);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(def.thickness * 0.7, 0.14, def.thickness * 0.9), bodyMat);
  grip.position.set(0, -def.thickness * 1.3, def.bodyLen * 0.28);
  grip.rotation.x = 0.35;
  group.add(grip);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(def.thickness * 1.06, def.thickness * 0.3, def.bodyLen * 0.8), accentMat);
  stripe.position.set(0, def.thickness * 0.45, 0);
  group.add(stripe);

  if (def.sight) {
    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(def.thickness * 0.5, def.thickness * 0.6, def.bodyLen * 0.4), bodyMat);
    sight.position.set(0, def.thickness * 1.05, -def.bodyLen * 0.15);
    group.add(sight);
  }
  if (def.mag) {
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(def.thickness * 1.3, def.thickness * 1.1, def.bodyLen * 0.5), accentMat);
    mag.position.set(0, -def.thickness * 1.2, -def.bodyLen * 0.1);
    group.add(mag);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, def.thickness * 0.25, -(def.bodyLen / 2 + def.barrelLen));
  group.add(muzzle);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
  flash.rotation.y = Math.PI / 4;
  muzzle.add(flash);

  group.traverse((o) => { o.frustumCulled = false; if (o.isMesh) o.renderOrder = 999; });
  return { group, muzzle, flash };
}

class Weapon {
  constructor(def) {
    this.def = def;
    this.ammo = def.magSize;
    this.reserve = def.reserve;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.bloom = 0;
    const vm = buildViewModel(def);
    this.model = vm.group;
    this.muzzle = vm.muzzle;
    this.flashMesh = vm.flash;
  }

  refill() {
    this.ammo = this.def.magSize;
    this.reserve = this.def.reserve;
    this.reloading = false;
    this.cooldown = 0;
    this.bloom = 0;
  }
}

// Rockets and grenades share this projectile with different behaviors.
class Explosive {
  constructor(game, kind, pos, vel, config) {
    this.game = game;
    this.kind = kind; // 'rocket' | 'grenade'
    this.vel = vel.clone();
    this.config = config;
    this.fuse = kind === 'grenade' ? GRENADE.fuse : 8;
    if (kind === 'rocket') {
      const geo = new THREE.ConeGeometry(0.09, 0.34, 6);
      geo.rotateX(Math.PI / 2);
      this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xc8ff8a }));
    } else {
      this.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a4436, roughness: 0.4, metalness: 0.6 }));
    }
    this.mesh.position.copy(pos);
    game.scene.add(this.mesh);
  }

  update(dt) {
    this.fuse -= dt;
    if (this.fuse <= 0) {
      this.explode();
      return false;
    }

    // substep so fast projectiles can't tunnel through 1-unit walls when
    // dt hits the 0.05s clamp (rocket: 30 * 0.05 = 1.5 units/frame)
    const speed = this.vel.length();
    const steps = Math.max(1, Math.ceil((speed * dt) / 0.3));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      if (!this._step(h)) return false;
    }

    const pos = this.mesh.position;
    if (this.kind === 'rocket') {
      this.mesh.lookAt(pos.clone().add(this.vel));
      if (Math.random() < 0.8) {
        this.game.effects.spawnParticle(pos, new THREE.Vector3(0, 0.5, 0), _rocketTrail, 0.35, 0);
      }
    } else {
      this.mesh.rotation.x += dt * 6;
      this.mesh.rotation.z += dt * 4;
    }
    return true;
  }

  // One integration substep. Returns false if the explosive detonated.
  _step(h) {
    const pos = this.mesh.position;
    if (this.kind === 'grenade') this.vel.y -= 22 * h;

    const step = this.vel.clone().multiplyScalar(h);
    pos.add(step);

    let hit = null;
    for (const c of this.game.world.colliders) {
      if (
        pos.x > c.min.x - 0.12 && pos.x < c.max.x + 0.12 &&
        pos.y > c.min.y - 0.12 && pos.y < c.max.y + 0.12 &&
        pos.z > c.min.z - 0.12 && pos.z < c.max.z + 0.12
      ) { hit = c; break; }
    }
    const hitFloor = pos.y < 0.11;

    if (this.kind === 'rocket') {
      if (hit || hitFloor) { this.explode(); return false; }
      // direct hit detonates: distance to the closest point on the enemy AABB
      for (const e of this.game.enemies.list) {
        if (!e.alive) continue;
        const cx = Math.max(e.position.x - e.halfW, Math.min(pos.x, e.position.x + e.halfW));
        const cy = Math.max(e.position.y, Math.min(pos.y, e.position.y + e.height));
        const cz = Math.max(e.position.z - e.halfW, Math.min(pos.z, e.position.z + e.halfW));
        const dx = pos.x - cx, dy = pos.y - cy, dz = pos.z - cz;
        if (dx * dx + dy * dy + dz * dz < 0.35 * 0.35) { this.explode(); return false; }
      }
    } else {
      // grenades bounce
      if (hitFloor && this.vel.y < 0) {
        pos.y = 0.11;
        this.vel.y *= -0.4;
        this.vel.x *= 0.7;
        this.vel.z *= 0.7;
        if (Math.abs(this.vel.y) < 1) this.vel.y = 0;
      } else if (hit) {
        pos.sub(step);
        // reflect off whichever face we struck: pick the dominant axis of approach
        const ax = Math.abs(step.x), ay = Math.abs(step.y), az = Math.abs(step.z);
        if (ax > ay && ax > az) this.vel.x *= -0.4;
        else if (az > ay) this.vel.z *= -0.4;
        else this.vel.y *= -0.4;
      }
    }
    return true;
  }

  explode() {
    this.game.applySplash(this.mesh.position, this.config.splashRadius, this.config.splashDmg);
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

const _rocketTrail = new THREE.Color(0xd8ff9a);

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.weapons = WEAPON_DEFS.map((d) => new Weapon(d));
    this.index = 0;
    this.triggerHeld = false;
    this.ads = false;
    this.adsAmount = 0;
    this.grenades = 3;
    this.explosives = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 300;

    this.rig = new THREE.Group();
    this.rig.position.copy(HIP_POS);
    this.camera.add(this.rig);
    for (const w of this.weapons) {
      w.model.visible = false;
      this.rig.add(w.model);
    }
    this.current.model.visible = true;

    this.recoilOffset = 0;
    this.swayTime = 0;
    this.flashTimer = 0;
    this.switchAnim = 0;
    this.grenadeCooldown = 0;
    this.burstQueue = 0;
    this.burstTimer = 0;
    this.railgunActive = false;

    window.addEventListener('mousedown', (e) => {
      if (!this.game.playing || !this.game.pointerLocked) return;
      if (this.game.cheats && this.game.cheats.open) return;
      if (e.button === 0) {
        this.triggerHeld = true;
        this.tryFire();
      } else if (e.button === 2) {
        this.ads = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.triggerHeld = false;
      else if (e.button === 2) this.ads = false;
    });
    window.addEventListener('contextmenu', (e) => {
      if (this.game.playing || this.game.state === 'paused') e.preventDefault();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.game.playing) return;
      if (this.game.cheats && this.game.cheats.open) return;
      const digits = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
        'Digit8', 'Digit9', 'Digit0'];
      const di = digits.indexOf(e.code);
      if (di >= 0) this.switchTo(di);
      else if (e.code === 'KeyR') this.startReload();
      else if (e.code === 'KeyG') this.throwGrenade();
    });
    window.addEventListener('wheel', (e) => {
      if (!this.game.playing || !this.game.pointerLocked) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      // step to the next unlocked weapon
      let i = this.index;
      for (let step = 0; step < this.weapons.length; step++) {
        i = (i + dir + this.weapons.length) % this.weapons.length;
        if (this.game.progression.isUnlocked(this.weapons[i].def)) break;
      }
      this.switchTo(i);
    });
  }

  get current() {
    return this.weapons[this.index];
  }

  grantRailgun() {
    const rg = this.weapons.find((w) => w.def.id === 'railgun');
    rg.ammo = rg.def.magSize;
    this.railgunActive = true;
    this.switchTo(this.weapons.indexOf(rg));
    this.updateHud();
  }

  _expireRailgun() {
    this.railgunActive = false;
    if (this.current.def.id === 'railgun') {
      this.switchTo(2, true); // back to the AR
    }
    this.updateHud();
  }

  reset() {
    for (const w of this.weapons) w.refill();
    this.railgunActive = false;
    this.burstQueue = 0;
    for (const ex of this.explosives) ex.dispose();
    this.explosives = [];
    this.grenades = 3 + this.game.progression.grenadeBonus();
    this.ads = false;
    this.adsAmount = 0;
    this.switchTo(0, true);
    this.triggerHeld = false;
    this.updateHud();
  }

  switchTo(i, silent = false) {
    if (i === this.index && !silent) return;
    if (i < 0 || i >= this.weapons.length) return;
    if (!this.game.progression.isUnlocked(this.weapons[i].def)) {
      if (!silent) {
        this.game.audio.empty();
        this.game.hud.killfeed(t('feed.locked', {
          weapon: t(`weapon.${this.weapons[i].def.id}`),
          need: this.weapons[i].def.unlockRank,
        }), 'cheat');
      }
      return;
    }
    this.current.model.visible = false;
    this.current.reloading = false;   // cancel reload on switch
    this.index = i;
    this.current.model.visible = true;
    this.switchAnim = 1;
    if (!silent) this.game.audio.weaponSwitch();
    this.updateHud();
  }

  startReload() {
    const w = this.current;
    if (w.reloading || w.ammo >= w.def.magSize || w.reserve <= 0) return;
    const cheats = this.game.cheats;
    if (cheats && cheats.is('noReload')) {
      // instant reload: still consumes reserve, skips the animation
      const need = w.def.magSize - w.ammo;
      const take = w.reserve === Infinity ? need : Math.min(need, w.reserve);
      w.ammo += take;
      if (w.reserve !== Infinity) w.reserve -= take;
      this.game.audio.weaponSwitch();
      this.updateHud();
      return;
    }
    w.reloading = true;
    w.reloadTotal = w.def.reloadTime * this.game.progression.reloadMul();
    w.reloadTimer = w.reloadTotal;
    this.game.audio.reload(w.def.id);
    this.updateHud();
  }

  throwGrenade() {
    const infinite = this.game.cheats && this.game.cheats.is('infiniteGrenades');
    if ((this.grenades <= 0 && !infinite) || this.grenadeCooldown > 0) return;
    if (!infinite) this.grenades--;
    this.grenadeCooldown = 0.7;
    this.game.audio.grenadeThrow();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const from = this.game.player.eyePosition.addScaledVector(dir, 0.5);
    const vel = dir.multiplyScalar(GRENADE.throwSpeed);
    vel.y += 3.5;
    this.explosives.push(new Explosive(this.game, 'grenade', from, vel, GRENADE));
    this.updateHud();
  }

  addGrenade(n = 1) {
    const cap = GRENADE.max + this.game.progression.grenadeCapBonus();
    this.grenades = Math.min(cap, this.grenades + n);
    this.updateHud();
  }

  currentSpread() {
    const w = this.current;
    const base = w.def.spreadHip + (w.def.spreadAds - w.def.spreadHip) * this.adsAmount;
    const p = this.game.player;
    const moveFactor = Math.min(1, Math.hypot(p.velocity.x, p.velocity.z) / 6) * 0.6;
    const crouchFactor = p.crouchAmount * -0.25;
    return Math.max(0.0004, base * (1 + moveFactor + crouchFactor) + w.bloom);
  }

  get sprintBlocked() {
    return this.game.player.sprintingHard && this.adsAmount < 0.3;
  }

  tryFire() {
    if (this.game.player.vehicle) return;
    const w = this.current;
    if (w.cooldown > 0 || this.switchAnim > 0.5 || this.grenadeCooldown > 0.3) return;
    if (w.reloading) return;
    if (this.sprintBlocked) return;
    if (w.ammo <= 0) {
      this.game.audio.empty();
      this.startReload();
      w.cooldown = 0.25;
      return;
    }

    if (!(this.game.cheats && this.game.cheats.is('infiniteAmmo'))) w.ammo--;
    w.cooldown = w.def.fireDelay;
    w.bloom = Math.min(w.def.bloom * 6, w.bloom + w.def.bloom);
    this.game.audio.shot(w.def.sound);
    this.recoilOffset = Math.min(0.22, this.recoilOffset + w.def.recoil * 1.6);
    const player = this.game.player;
    player.pitch += w.def.kick * (1 - this.adsAmount * 0.4);
    const pitchLim = Math.PI / 2 - 0.01;
    player.pitch = Math.max(-pitchLim, Math.min(pitchLim, player.pitch));
    this.flashTimer = 0.05;
    w.flashMesh.material.opacity = 1;
    w.flashMesh.rotation.z = Math.random() * Math.PI;

    const muzzlePos = new THREE.Vector3();
    w.muzzle.getWorldPosition(muzzlePos);
    this.game.effects.flash(muzzlePos, 2.2);

    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    const baseDir = new THREE.Vector3();
    this.camera.getWorldDirection(baseDir);

    if (w.def.rocket) {
      const vel = baseDir.clone().multiplyScalar(w.def.rocket.speed);
      // spawn at the eye, not the muzzle: a muzzle pressed into a wall would
      // put the rocket on the far side of it
      const spawn = camPos.clone().addScaledVector(baseDir, 0.3);
      this.explosives.push(new Explosive(
        this.game, 'rocket', spawn, vel, w.def.rocket));
    } else {
      const targets = [
        ...this.game.world.colliderMeshes,
        ...this.game.enemies.aliveGroups(),
      ];
      if (this.game.mp && this.game.mp.versus) {
        targets.push(...this.game.mp.pvpTargets());
      }
      const spread = this.currentSpread();
      let lastEnd = null;
      for (let p = 0; p < w.def.pellets; p++) {
        const dir = baseDir.clone();
        dir.x += (Math.random() - 0.5) * 2 * spread;
        dir.y += (Math.random() - 0.5) * 2 * spread;
        dir.z += (Math.random() - 0.5) * 2 * spread;
        dir.normalize();

        this.raycaster.set(camPos, dir);
        const hits = this.raycaster.intersectObjects(targets, true);
        let end = null;
        let hitEnemyPart = null;
        let hitRp = null;
        const pierced = [];
        for (const h of hits) {
          if (!h.object.visible) continue;
          if (h.object.userData.rp) {
            end = h.point;
            hitRp = h.object.userData.rp;
            break;
          }
          if (w.def.pierce && h.object.userData.enemy) {
            // rail slug passes through bodies until it meets world geometry
            const en = h.object.userData.enemy;
            if (!pierced.some((q) => q.enemy === en)) {
              pierced.push({ enemy: en, point: h.point, headshot: !!h.object.userData.headshot });
            }
            continue;
          }
          end = h.point;
          if (h.object.userData.enemy) hitEnemyPart = h.object;
          break;
        }
        if (!end) end = camPos.clone().addScaledVector(dir, 150);
        lastEnd = end;

        this.game.effects.tracer(muzzlePos, end, w.def.tracer);

        for (const q of pierced) {
          const dmg = w.def.damage * (q.headshot ? w.def.headshotMul : 1) *
            this.game.progression.damageMul();
          q.enemy.takeDamage(dmg, q.point, q.headshot);
        }
        if (hitRp) {
          this.game.effects.enemyHitSparks(end);
          this.game.hud.hitmarker(false);
          this.game.audio.hit(false);
          this.game.mp.sendPvpHit(hitRp.id, w.def.damage * 0.8, end);
        } else if (hitEnemyPart) {
          const enemy = hitEnemyPart.userData.enemy;
          const headshot = !!hitEnemyPart.userData.headshot;
          const dmg = w.def.damage * (headshot ? w.def.headshotMul : 1) *
            this.game.progression.damageMul();
          enemy.takeDamage(dmg, end, headshot);
        } else if (end) {
          this.game.effects.impactSparks(end);
        }
      }
      if (this.game.mp && this.game.mp.active && lastEnd) {
        this.game.mp.sendShot(muzzlePos, lastEnd, w.def.tracer);
      }
    }

    if (w.def.burst && this.burstQueue === 0 && !this._inBurst) {
      this.burstQueue = w.def.burst - 1;
      this.burstTimer = w.def.burstDelay;
    }
    if (w.ammo === 0) {
      if (w.def.streakOnly) this._expireRailgun();
      else this.startReload();
    }
    this.updateHud();
  }

  update(dt) {
    const w = this.current;
    if (w.cooldown > 0) w.cooldown -= dt;
    if (this.burstQueue > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0 && w.ammo > 0) {
        this.burstTimer = w.def.burstDelay || 0.07;
        this.burstQueue--;
        w.cooldown = 0;
        const held = this.triggerHeld;
        this.triggerHeld = false;
        this._inBurst = true;
        this.tryFire();
        this._inBurst = false;
        this.triggerHeld = held;
        w.cooldown = this.burstQueue > 0 ? 0 : w.def.fireDelay;
      } else if (w.ammo <= 0) {
        this.burstQueue = 0;
      }
    }
    if (this.grenadeCooldown > 0) this.grenadeCooldown -= dt;
    w.bloom = Math.max(0, w.bloom - w.def.bloom * 8 * dt);

    // ADS blend (blocked while sprinting hard or reloading the launcher)
    const wantAds = this.ads && !this.game.player.sprintingHard && this.game.playing;
    this.adsAmount += ((wantAds ? 1 : 0) - this.adsAmount) * Math.min(1, dt * 10);
    if (this.adsAmount < 0.001) this.adsAmount = 0;

    if (w.reloading) {
      w.reloadTimer -= dt;
      if (w.reloadTimer <= 0) {
        const need = w.def.magSize - w.ammo;
        const take = w.reserve === Infinity ? need : Math.min(need, w.reserve);
        w.ammo += take;
        if (w.reserve !== Infinity) w.reserve -= take;
        w.reloading = false;
        this.updateHud();
      }
    }

    if (w.def.auto && this.triggerHeld) this.tryFire();

    // explosives
    for (let i = this.explosives.length - 1; i >= 0; i--) {
      if (!this.explosives[i].update(dt)) {
        this.explosives[i].dispose();
        this.explosives.splice(i, 1);
      }
    }

    // --- view model motion ---
    this.swayTime += dt;
    const player = this.game.player;
    const hSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    const bob = player.grounded ? Math.min(1, hSpeed / 6) * (1 - this.adsAmount * 0.85) : 0;

    this.recoilOffset = Math.max(0, this.recoilOffset - dt * 1.4);
    this.switchAnim = Math.max(0, this.switchAnim - dt * 4);

    const reloadDip = w.reloading
      ? Math.sin(Math.min(1, 1 - w.reloadTimer / (w.reloadTotal || w.def.reloadTime)) * Math.PI) * 0.18
      : 0;
    const sprintRaise = this.sprintBlocked ? 1 : 0;
    this._sprintRaiseSmooth = (this._sprintRaiseSmooth || 0);
    this._sprintRaiseSmooth += (sprintRaise - this._sprintRaiseSmooth) * Math.min(1, dt * 8);

    // rig: hip position -> centered ADS position
    const adsY = -0.075 - w.def.thickness * 0.25;
    this.rig.position.set(
      HIP_POS.x * (1 - this.adsAmount),
      HIP_POS.y + (adsY - HIP_POS.y) * this.adsAmount,
      HIP_POS.z + (-0.36 - HIP_POS.z) * this.adsAmount
    );

    w.model.position.set(
      Math.sin(player.bobPhase) * 0.012 * bob,
      Math.sin(player.bobPhase * 2) * 0.014 * bob - reloadDip - this.switchAnim * 0.3,
      this.recoilOffset
    );
    w.model.rotation.set(
      this.recoilOffset * 1.2 - reloadDip * 1.5 - this.switchAnim * 0.8 - this._sprintRaiseSmooth * 0.7,
      this._sprintRaiseSmooth * 0.3,
      Math.sin(this.swayTime * 1.7) * 0.008 * (1 - this.adsAmount)
    );

    // sniper: hide the gun when fully scoped
    const scoped = w.def.scope && this.adsAmount > 0.85;
    w.model.visible = !scoped;
    this.game.hud.setScope(scoped);
    this.game.hud.setCrosshair(
      this.adsAmount > 0.6 && w.def.scope ? -1 : this.currentSpread(),
      this.adsAmount);

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      w.flashMesh.material.opacity = Math.max(0, this.flashTimer / 0.05);
    }
  }

  addReserveAll(frac) {
    for (const w of this.weapons) {
      if (w.reserve === Infinity) continue;
      w.reserve = Math.min(w.def.reserve, w.reserve + Math.ceil(w.def.magSize * frac));
    }
    this.updateHud();
  }

  updateHud() {
    const w = this.current;
    this.game.hud.setAmmo(t(`weapon.${w.def.id}`), w.ammo, w.reserve, w.reloading);
    this.game.hud.setGrenades(this.grenades,
      !!(this.game.cheats && this.game.cheats.is('infiniteGrenades')));
  }
}
