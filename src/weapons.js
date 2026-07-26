import * as THREE from 'three';
import { t } from './i18n.js';

const HIP_POS = new THREE.Vector3(0.28, -0.26, -0.5);

export const WEAPON_DEFS = [
  {
    id: 'pistol', cat: 'secondary', wclass: 'pistol', unlockRank: 1, name: 'P-9 SIDEARM', sound: 'pistol',
    damage: 25, pellets: 1, fireDelay: 0.22, auto: false,
    spreadHip: 0.014, spreadAds: 0.004, bloom: 0.006,
    magSize: 12, reserve: Infinity, reloadTime: 0.9,
    recoil: 0.035, kick: 0.006, tracer: 0xaef4ff,
    adsFov: 62, scope: false, moveMul: 1.0, headshotMul: 2,
    bodyColor: 0x3d4f66, accentColor: 0x27e8ff,
    barrelLen: 0.3, bodyLen: 0.22, thickness: 0.07,
  },
  {
    id: 'smg', cat: 'primary', wclass: 'smg', unlockRank: 1, name: 'VIPER SMG', sound: 'smg',
    damage: 11, pellets: 1, fireDelay: 0.075, auto: true,
    spreadHip: 0.026, spreadAds: 0.012, bloom: 0.004,
    magSize: 32, reserve: 160, reloadTime: 1.4,
    recoil: 0.02, kick: 0.0035, tracer: 0xd0a8ff,
    adsFov: 60, scope: false, moveMul: 1.0, headshotMul: 2,
    bodyColor: 0x46405e, accentColor: 0xb06aff,
    barrelLen: 0.3, bodyLen: 0.3, thickness: 0.075,
  },
  {
    id: 'rifle', cat: 'primary', wclass: 'ar', unlockRank: 1, name: 'HELIX AR', sound: 'rifle',
    damage: 16, pellets: 1, fireDelay: 0.105, auto: true,
    spreadHip: 0.022, spreadAds: 0.006, bloom: 0.005,
    magSize: 30, reserve: 150, reloadTime: 1.7,
    recoil: 0.028, kick: 0.005, tracer: 0x8affd0,
    adsFov: 58, scope: false, moveMul: 0.95, headshotMul: 2,
    bodyColor: 0x35455c, accentColor: 0x27ff8a,
    barrelLen: 0.5, bodyLen: 0.34, thickness: 0.085, sight: true,
  },
  {
    id: 'dmr', cat: 'primary', wclass: 'dmr', unlockRank: 2, name: 'JUDGE DMR', sound: 'dmr',
    damage: 42, pellets: 1, fireDelay: 0.28, auto: false,
    spreadHip: 0.014, spreadAds: 0.003, bloom: 0.006,
    magSize: 12, reserve: 48, reloadTime: 1.8,
    recoil: 0.055, kick: 0.011, tracer: 0xfff2a8,
    adsFov: 45, scope: false, moveMul: 0.92, headshotMul: 2,
    bodyColor: 0x4c4a3a, accentColor: 0xe8d86a,
    barrelLen: 0.58, bodyLen: 0.36, thickness: 0.08, sight: true,
  },
  {
    id: 'shotgun', cat: 'primary', wclass: 'shotgun', unlockRank: 3, name: 'BREACHER', sound: 'shotgun',
    damage: 9, pellets: 8, fireDelay: 0.85, auto: false,
    spreadHip: 0.07, spreadAds: 0.05, bloom: 0.008,
    magSize: 6, reserve: 30, reloadTime: 2.2,
    recoil: 0.12, kick: 0.02, tracer: 0xffc98a,
    adsFov: 65, scope: false, moveMul: 0.95, headshotMul: 2,
    bodyColor: 0x4d3f39, accentColor: 0xffb347,
    barrelLen: 0.44, bodyLen: 0.32, thickness: 0.105,
  },
  {
    id: 'lmg', cat: 'primary', wclass: 'lmg', unlockRank: 4, name: 'BASTION LMG', sound: 'lmg',
    damage: 14, pellets: 1, fireDelay: 0.09, auto: true,
    spreadHip: 0.032, spreadAds: 0.014, bloom: 0.0045,
    magSize: 75, reserve: 150, reloadTime: 3.6,
    recoil: 0.032, kick: 0.006, tracer: 0xffa8a8,
    adsFov: 60, scope: false, moveMul: 0.85, headshotMul: 2,
    bodyColor: 0x50384a, accentColor: 0xff5b8a,
    barrelLen: 0.55, bodyLen: 0.42, thickness: 0.1, mag: true,
  },
  {
    id: 'sniper', cat: 'primary', wclass: 'sniper', unlockRank: 5, name: 'SPECTRE', sound: 'sniper',
    damage: 120, pellets: 1, fireDelay: 1.25, auto: false,
    spreadHip: 0.05, spreadAds: 0.0006, bloom: 0.01,
    magSize: 5, reserve: 20, reloadTime: 2.6,
    recoil: 0.14, kick: 0.02, tracer: 0xffffff,
    adsFov: 24, scope: true, moveMul: 0.9, headshotMul: 2.5,
    bodyColor: 0x2e4050, accentColor: 0x9fdcff,
    barrelLen: 0.72, bodyLen: 0.38, thickness: 0.08, sight: true,
  },
  {
    id: 'launcher', cat: 'primary', wclass: 'heavy', unlockRank: 6, name: 'HAVOC RL', sound: 'rocket',
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
    id: 'carbine', cat: 'primary', wclass: 'ar', unlockRank: 7, name: 'VOLT CARBINE', sound: 'dmr',
    damage: 20, pellets: 1, fireDelay: 0.34, auto: false, burst: 3, burstDelay: 0.07,
    spreadHip: 0.018, spreadAds: 0.004, bloom: 0.005,
    magSize: 24, reserve: 96, reloadTime: 1.9,
    recoil: 0.04, kick: 0.007, tracer: 0x7affff,
    adsFov: 52, scope: false, moveMul: 0.94, headshotMul: 2,
    bodyColor: 0x2f4a4a, accentColor: 0x3affd8,
    barrelLen: 0.5, bodyLen: 0.34, thickness: 0.08, sight: true,
  },
  // ---- expanded primaries ----
  {
    id: 'akr', cat: 'primary', wclass: 'ar', unlockRank: 3, name: 'RAVAGER-47', sound: 'rifle',
    damage: 22, pellets: 1, fireDelay: 0.13, auto: true,
    spreadHip: 0.027, spreadAds: 0.009, bloom: 0.006,
    magSize: 30, reserve: 120, reloadTime: 1.9,
    recoil: 0.042, kick: 0.008, tracer: 0xffb06a,
    adsFov: 58, scope: false, moveMul: 0.94, headshotMul: 2,
    bodyColor: 0x53392e, accentColor: 0xff7a3b,
    barrelLen: 0.52, bodyLen: 0.34, thickness: 0.09, sight: true, mag: true,
  },
  {
    id: 'p90', cat: 'primary', wclass: 'smg', unlockRank: 4, name: 'HORNET-90', sound: 'smg',
    damage: 10, pellets: 1, fireDelay: 0.068, auto: true,
    spreadHip: 0.024, spreadAds: 0.011, bloom: 0.0035,
    magSize: 50, reserve: 150, reloadTime: 2.0,
    recoil: 0.017, kick: 0.003, tracer: 0xfff06a,
    adsFov: 60, scope: false, moveMul: 1.0, headshotMul: 2,
    bodyColor: 0x4a4a30, accentColor: 0xe8e83b,
    barrelLen: 0.26, bodyLen: 0.36, thickness: 0.085,
  },
  {
    id: 'vector', cat: 'primary', wclass: 'smg', unlockRank: 6, name: 'TEMPO SMG', sound: 'smg',
    damage: 9, pellets: 1, fireDelay: 0.055, auto: true,
    spreadHip: 0.02, spreadAds: 0.009, bloom: 0.003,
    magSize: 28, reserve: 140, reloadTime: 1.5,
    recoil: 0.013, kick: 0.0028, tracer: 0x8ad0ff,
    adsFov: 60, scope: false, moveMul: 1.0, headshotMul: 2,
    bodyColor: 0x2e3e52, accentColor: 0x6ab8ff,
    barrelLen: 0.3, bodyLen: 0.28, thickness: 0.07,
  },
  {
    id: 'autoshotgun', cat: 'primary', wclass: 'shotgun', unlockRank: 7, name: 'MAULER-12', sound: 'shotgun',
    damage: 7, pellets: 8, fireDelay: 0.45, auto: false,
    spreadHip: 0.075, spreadAds: 0.055, bloom: 0.007,
    magSize: 8, reserve: 32, reloadTime: 2.6,
    recoil: 0.1, kick: 0.017, tracer: 0xffd98a,
    adsFov: 65, scope: false, moveMul: 0.92, headshotMul: 2,
    bodyColor: 0x5a3a30, accentColor: 0xff9a47,
    barrelLen: 0.48, bodyLen: 0.34, thickness: 0.11, mag: true,
  },
  {
    id: 'pkm', cat: 'primary', wclass: 'lmg', unlockRank: 8, name: 'WARHOUND', sound: 'lmg',
    damage: 17, pellets: 1, fireDelay: 0.115, auto: true,
    spreadHip: 0.035, spreadAds: 0.016, bloom: 0.005,
    magSize: 90, reserve: 180, reloadTime: 4.2,
    recoil: 0.042, kick: 0.008, tracer: 0xff8a6a,
    adsFov: 60, scope: false, moveMul: 0.8, headshotMul: 2,
    bodyColor: 0x463226, accentColor: 0xd85a2a,
    barrelLen: 0.6, bodyLen: 0.44, thickness: 0.105, mag: true,
  },
  {
    id: 'sks', cat: 'primary', wclass: 'dmr', unlockRank: 5, name: 'FALCON-S', sound: 'dmr',
    damage: 32, pellets: 1, fireDelay: 0.19, auto: false,
    spreadHip: 0.015, spreadAds: 0.0035, bloom: 0.005,
    magSize: 15, reserve: 60, reloadTime: 1.7,
    recoil: 0.048, kick: 0.009, tracer: 0xd8ffa8,
    adsFov: 48, scope: false, moveMul: 0.93, headshotMul: 2,
    bodyColor: 0x3e4a34, accentColor: 0xa8d86a,
    barrelLen: 0.56, bodyLen: 0.34, thickness: 0.078, sight: true,
  },
  // ---- expanded secondaries ----
  {
    id: 'mpistol', cat: 'secondary', wclass: 'mpistol', unlockRank: 2, name: 'WASP-18', sound: 'smg',
    damage: 9, pellets: 1, fireDelay: 0.07, auto: true,
    spreadHip: 0.03, spreadAds: 0.014, bloom: 0.005,
    magSize: 18, reserve: 144, reloadTime: 1.3,
    recoil: 0.024, kick: 0.004, tracer: 0xffe86a,
    adsFov: 62, scope: false, moveMul: 1.0, headshotMul: 2,
    bodyColor: 0x4a4436, accentColor: 0xffd83b,
    barrelLen: 0.24, bodyLen: 0.2, thickness: 0.065,
  },
  {
    id: 'awm', cat: 'primary', wclass: 'sniper', unlockRank: 9, name: 'LONGBOW-50', sound: 'sniper',
    damage: 200, pellets: 1, fireDelay: 1.6, auto: false,
    spreadHip: 0.06, spreadAds: 0.0004, bloom: 0.012,
    magSize: 4, reserve: 16, reloadTime: 3.0,
    recoil: 0.18, kick: 0.024, tracer: 0xfff0c8,
    adsFov: 20, scope: true, moveMul: 0.85, headshotMul: 2.5,
    bodyColor: 0x3a3226, accentColor: 0xffcf3b,
    barrelLen: 0.8, bodyLen: 0.4, thickness: 0.085, sight: true, mag: true,
  },
  {
    id: 'energy', cat: 'primary', wclass: 'energy', unlockRank: 10, name: 'ARC RIFLE', sound: 'dmr',
    damage: 26, pellets: 1, fireDelay: 0.32, auto: false, burst: 2, burstDelay: 0.06,
    spreadHip: 0.014, spreadAds: 0.003, bloom: 0.003,
    magSize: 20, reserve: 100, reloadTime: 1.6,
    recoil: 0.03, kick: 0.006, tracer: 0x6affff,
    adsFov: 50, scope: false, moveMul: 0.96, headshotMul: 2,
    bodyColor: 0x1e3448, accentColor: 0x62f0ff,
    barrelLen: 0.55, bodyLen: 0.36, thickness: 0.085, sight: true,
  },
  {
    id: 'revolver', cat: 'secondary', wclass: 'revolver', unlockRank: 4, name: 'IRONCLAD .44', sound: 'dmr',
    damage: 55, pellets: 1, fireDelay: 0.5, auto: false,
    spreadHip: 0.016, spreadAds: 0.004, bloom: 0.008,
    magSize: 6, reserve: 36, reloadTime: 2.4,
    recoil: 0.11, kick: 0.018, tracer: 0xffc9c9,
    adsFov: 56, scope: false, moveMul: 0.98, headshotMul: 2.5,
    bodyColor: 0x50403c, accentColor: 0xff8a7a,
    barrelLen: 0.36, bodyLen: 0.2, thickness: 0.08,
  },
  {
    id: 'crossbow', cat: 'secondary', wclass: 'crossbow', unlockRank: 6, name: 'STALKER-X', sound: 'dmr',
    damage: 90, pellets: 1, fireDelay: 1.1, auto: false,
    spreadHip: 0.01, spreadAds: 0.002, bloom: 0,
    magSize: 1, reserve: 24, reloadTime: 1.5,
    recoil: 0.06, kick: 0.01, tracer: 0x8aff8a,
    adsFov: 50, scope: false, moveMul: 0.98, headshotMul: 2.5,
    bodyColor: 0x2e3a2e, accentColor: 0x8aff8a,
    barrelLen: 0.4, bodyLen: 0.3, thickness: 0.09, sight: true,
  },
];

// Throwables: one type carried per loadout. Lethal types splash; tacticals
// flash (blind + stun) or smoke (blocks AI line of sight).
export const THROWABLES = {
  frag: { id: 'frag', lethal: true, fuse: 2.2, splashRadius: 5, splashDmg: 110,
    throwSpeed: 17, max: 5, color: 0x3a4436 },
  sticky: { id: 'sticky', lethal: true, fuse: 1.7, splashRadius: 4.5, splashDmg: 130,
    throwSpeed: 15, max: 4, sticky: true, color: 0x27e8ff },
  flash: { id: 'flash', lethal: false, fuse: 1.4, splashRadius: 12, splashDmg: 0,
    throwSpeed: 18, max: 4, flash: true, color: 0xf0f0e0 },
  smoke: { id: 'smoke', lethal: false, fuse: 1.2, splashRadius: 5, splashDmg: 0,
    throwSpeed: 14, max: 4, smoke: true, color: 0x8a97a8 },
  molotov: { id: 'molotov', lethal: true, fuse: 4, splashRadius: 4.5, splashDmg: 0,
    throwSpeed: 15, max: 3, molotov: true, color: 0xff7a3b },
};
const GRENADE = THROWABLES.frag;

// ---- loadout: one primary + one secondary + one throwable ----
const LOADOUT_KEY = 'neonstrike.loadout';
const PRESETS_KEY = 'neonstrike.presets';
export const DEFAULT_LOADOUT = { primary: 'rifle', secondary: 'pistol', throwable: 'frag' };

export function loadLoadout() {
  const out = { ...DEFAULT_LOADOUT };
  try {
    const st = JSON.parse(localStorage.getItem(LOADOUT_KEY) || '{}');
    for (const cat of ['primary', 'secondary']) {
      if (WEAPON_DEFS.some((d) => d.id === st[cat] && d.cat === cat)) out[cat] = st[cat];
    }
    if (THROWABLES[st.throwable]) out.throwable = st.throwable;
  } catch (e) { /* defaults */ }
  return out;
}

export function saveLoadout(l) {
  try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(l)); } catch (e) { /* ok */ }
}

export function loadPresets() {
  try {
    const v = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
    return [v[0] || null, v[1] || null, v[2] || null];
  } catch (e) { return [null, null, null]; }
}

export function savePresets(list) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch (e) { /* ok */ }
}

// Attachment system: one option per slot, chosen pre-match, multiplies the
// arsenal's stats. Omitted fields default to 1 (neutral).
export const ATTACHMENTS = {
  optic: [
    { id: 'none' },
    { id: 'reflex', adsSpeed: 1.3 },
    { id: 'scope3x', adsFov: 0.7, move: 0.97 },
  ],
  barrel: [
    { id: 'none' },
    { id: 'longbarrel', dmg: 1.08, move: 0.97 },
    { id: 'lightbarrel', move: 1.04, spread: 1.1 },
  ],
  mag: [
    { id: 'none' },
    { id: 'extmag', mag: 1.4, reload: 1.15 },
    { id: 'fastmag', reload: 0.8 },
  ],
  grip: [
    { id: 'none' },
    { id: 'vgrip', recoil: 0.75 },
    { id: 'stubby', spread: 0.85 },
  ],
  muzzle: [
    { id: 'none' },
    { id: 'comp', spread: 0.85 },
    { id: 'brake', recoil: 0.8, spread: 1.08 },
  ],
};
const ATTACH_KEY = 'neonstrike.attach';

export function loadAttachments() {
  const out = {};
  try {
    const st = JSON.parse(localStorage.getItem(ATTACH_KEY) || '{}');
    for (const slot of Object.keys(ATTACHMENTS)) {
      out[slot] = ATTACHMENTS[slot].some((o) => o.id === st[slot]) ? st[slot] : 'none';
    }
  } catch (e) {
    for (const slot of Object.keys(ATTACHMENTS)) out[slot] = 'none';
  }
  return out;
}

export function saveAttachments(sel) {
  try { localStorage.setItem(ATTACH_KEY, JSON.stringify(sel)); } catch (e) { /* ok */ }
}

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
    this.capacity = def.magSize;   // attachment-modified magazine size
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
    this.ammo = this.capacity;
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
    this.fuse = config.fuse !== undefined ? config.fuse : 8;
    if (kind === 'rocket') {
      const geo = new THREE.ConeGeometry(0.09, 0.34, 6);
      geo.rotateX(Math.PI / 2);
      this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xc8ff8a }));
    } else {
      this.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshStandardMaterial({
          color: config.color || 0x3a4436, roughness: 0.4, metalness: 0.6,
          emissive: config.sticky ? (config.color || 0) : 0,
          emissiveIntensity: config.sticky ? 0.8 : 0 }));
    }
    this.stuck = false;
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
    if (this.stuck) return true;
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
      // molotovs shatter on the first contact
      if (this.config.molotov && (hit || hitFloor)) {
        this.explode();
        return false;
      }
      // sticky grenades latch onto the first thing they touch
      if (this.config.sticky && (hit || hitFloor)) {
        if (hitFloor) pos.y = 0.11;
        else pos.sub(step);
        this.vel.set(0, 0, 0);
        this.stuck = true;
        return true;
      }
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
    if (this.config.flash) {
      this.game.applyFlash(this.mesh.position, this.config.splashRadius);
      return;
    }
    if (this.config.smoke) {
      this.game.applySmoke(this.mesh.position.clone(), 8);
      return;
    }
    if (this.config.molotov) {
      this.game.applyFire(this.mesh.position.clone(), this.config.splashRadius, 6);
      return;
    }
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

    this.attachments = loadAttachments();
    this.loadout = loadLoadout();
    this.throwable = THROWABLES[this.loadout.throwable] || THROWABLES.frag;
    this.mods = { dmg: 1, mag: 1, reload: 1, spread: 1, recoil: 1, adsFov: 1, move: 1, adsSpeed: 1 };

    this.rig = new THREE.Group();
    this.rig.position.copy(HIP_POS);
    this.camera.add(this.rig);
    for (const w of this.weapons) {
      w.model.visible = false;
      this.rig.add(w.model);
    }
    this.current.model.visible = true;
    this._recomputeMods();
    this.applyLoadout(true);

    this.recoilOffset = 0;
    this.swayTime = 0;
    this.flashTimer = 0;
    this.switchAnim = 0;
    this.grenadeCooldown = 0;
    this.meleeCooldown = 0;
    this.burstQueue = 0;
    this.burstTimer = 0;

    window.addEventListener('mousedown', (e) => {
      if (!this.game.playing || !this.game.pointerLocked) return;
      if (this.game.cheats && this.game.cheats.open) return;
      if (this.game.orbital && this.game.orbital.active) {
        if (e.button === 0) this.game.orbital.fire();
        return;
      }
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
      if (e.code === 'Digit0') {
        // orbital railgun tactical view (7-killstreak)
        if (this.game.orbital) this.game.orbital.toggle();
        return;
      }
      if (this.game.orbital && this.game.orbital.active) return;
      // loadout carry: 1 = primary, 2 = secondary
      if (e.code === 'Digit1') this.switchTo(this.carryIndex('primary'));
      else if (e.code === 'Digit2') this.switchTo(this.carryIndex('secondary'));
      else if (e.code === 'KeyR') this.startReload();
      else if (e.code === 'KeyG') this.throwGrenade();
      else if (e.code === 'KeyV') this.meleeAttack();
    });
    window.addEventListener('wheel', (e) => {
      if (!this.game.playing || !this.game.pointerLocked) return;
      // wheel swaps between the two carried weapons
      const p = this.carryIndex('primary');
      const s = this.carryIndex('secondary');
      this.switchTo(this.index === p ? s : p);
    });
  }

  carryIndex(cat) {
    return this.weapons.findIndex((w) => w.def.id === this.loadout[cat]);
  }

  // Enforce the loadout: locked picks fall back to defaults, the throwable
  // def is resolved, and the primary is raised.
  applyLoadout(silent = true) {
    const prog = this.game.progression;
    for (const cat of ['primary', 'secondary']) {
      const def = WEAPON_DEFS.find((d) => d.id === this.loadout[cat]);
      if (!def || def.cat !== cat || !prog.isUnlocked(def)) {
        this.loadout[cat] = DEFAULT_LOADOUT[cat];
      }
    }
    this.throwable = THROWABLES[this.loadout.throwable] || THROWABLES.frag;
    this.switchTo(this.carryIndex('primary'), silent);
  }

  setLoadoutItem(cat, id) {
    if (cat === 'throwable') {
      if (!THROWABLES[id]) return false;
    } else {
      const def = WEAPON_DEFS.find((d) => d.id === id);
      if (!def || def.cat !== cat) return false;
      if (!this.game.progression.isUnlocked(def)) return false;
    }
    this.loadout[cat] = id;
    saveLoadout(this.loadout);
    this.applyLoadout(true);
    return true;
  }

  get current() {
    return this.weapons[this.index];
  }

  _recomputeMods() {
    const m = { dmg: 1, mag: 1, reload: 1, spread: 1, recoil: 1, adsFov: 1, move: 1, adsSpeed: 1 };
    for (const slot of Object.keys(ATTACHMENTS)) {
      const opt = ATTACHMENTS[slot].find((o) => o.id === this.attachments[slot]);
      if (!opt) continue;
      for (const k of Object.keys(m)) {
        if (opt[k] !== undefined) m[k] *= opt[k];
      }
    }
    this.mods = m;
    for (const w of this.weapons) {
      w.capacity = Math.round(w.def.magSize * m.mag);
      w.ammo = Math.min(w.ammo, w.capacity);
    }
  }

  setAttachment(slot, id) {
    if (!ATTACHMENTS[slot] || !ATTACHMENTS[slot].some((o) => o.id === id)) return;
    this.attachments[slot] = id;
    saveAttachments(this.attachments);
    this._recomputeMods();
    this.updateHud();
  }

  effAdsFov() {
    return Math.max(18, this.current.def.adsFov * this.mods.adsFov);
  }

  reset() {
    for (const w of this.weapons) w.refill();
    this.burstQueue = 0;
    for (const ex of this.explosives) ex.dispose();
    this.explosives = [];
    this.grenades = 3 + this.game.progression.grenadeBonus();
    this.ads = false;
    this.adsAmount = 0;
    this.applyLoadout(true);
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
    if (w.reloading || w.ammo >= w.capacity || w.reserve <= 0) return;
    const cheats = this.game.cheats;
    if (cheats && cheats.is('noReload')) {
      // instant reload: still consumes reserve, skips the animation
      const need = w.capacity - w.ammo;
      const take = w.reserve === Infinity ? need : Math.min(need, w.reserve);
      w.ammo += take;
      if (w.reserve !== Infinity) w.reserve -= take;
      this.game.audio.weaponSwitch();
      this.updateHud();
      return;
    }
    w.reloading = true;
    w.reloadTotal = w.def.reloadTime * this.game.progression.reloadMul() * this.mods.reload;
    w.reloadTimer = w.reloadTotal;
    this.game.audio.reload(w.def.id);
    this.updateHud();
  }

  // quick melee (V): a fast knife jab at anything in arm's reach
  meleeAttack() {
    if (this.game.player.vehicle) return;
    if (this.game.orbital && this.game.orbital.active) return;
    if (this.meleeCooldown > 0 || !this.game.player.alive) return;
    this.meleeCooldown = 0.8;
    this.game.audio.melee();
    this.recoilOffset = Math.min(0.3, this.recoilOffset + 0.14);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const from = this.game.player.eyePosition;
    for (const e of this.game.enemies.list) {
      if (!e.alive || e.spawnTimer > 0) continue;
      const c = new THREE.Vector3(
        e.position.x, e.position.y + (e.height || 1.6) * 0.5, e.position.z);
      const to = c.clone().sub(from);
      if (to.length() > 2.6) continue;
      if (to.normalize().dot(dir) < 0.45) continue;
      e.takeDamage(60, c, false);
      this.game.effects.enemyHitSparks(c);
      this.game.hud.hitmarker(false);
      this.game.audio.hit(false);
      return;
    }
    if (this.game.mp && this.game.mp.versus) {
      for (const r of this.game.mp.remoteList()) {
        if (!r.alive) continue;
        const c = new THREE.Vector3(r.position.x, r.position.y + 1.2, r.position.z);
        const to = c.clone().sub(from);
        if (to.length() > 2.6) continue;
        if (to.normalize().dot(dir) < 0.45) continue;
        this.game.effects.enemyHitSparks(c);
        this.game.hud.hitmarker(false);
        this.game.audio.hit(false);
        this.game.mp.sendPvpHit(r.id, 60, c);
        return;
      }
    }
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
    const cfg = this.throwable || THROWABLES.frag;
    const vel = dir.multiplyScalar(cfg.throwSpeed);
    vel.y += 3.5;
    this.explosives.push(new Explosive(this.game, 'grenade', from, vel, cfg));
    this.updateHud();
  }

  addGrenade(n = 1) {
    const cap = (this.throwable || THROWABLES.frag).max +
      this.game.progression.grenadeCapBonus();
    this.grenades = Math.min(cap, this.grenades + n);
    this.updateHud();
  }

  currentSpread() {
    const w = this.current;
    const base = w.def.spreadHip + (w.def.spreadAds - w.def.spreadHip) * this.adsAmount;
    const p = this.game.player;
    const moveFactor = Math.min(1, Math.hypot(p.velocity.x, p.velocity.z) / 6) * 0.6;
    const crouchFactor = p.crouchAmount * -0.25;
    return Math.max(0.0004,
      base * this.mods.spread * (1 + moveFactor + crouchFactor) + w.bloom);
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
    this.recoilOffset = Math.min(0.22,
      this.recoilOffset + w.def.recoil * this.mods.recoil * 1.6);
    const player = this.game.player;
    player.pitch += w.def.kick * this.mods.recoil * (1 - this.adsAmount * 0.4);
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
          const dmg = w.def.damage * this.mods.dmg * (q.headshot ? w.def.headshotMul : 1) *
            this.game.progression.damageMul();
          q.enemy.takeDamage(dmg, q.point, q.headshot);
        }
        if (hitRp) {
          this.game.effects.enemyHitSparks(end);
          this.game.hud.hitmarker(false);
          this.game.audio.hit(false);
          this.game.mp.sendPvpHit(hitRp.id, w.def.damage * this.mods.dmg * 0.8, end);
        } else if (hitEnemyPart) {
          const enemy = hitEnemyPart.userData.enemy;
          const headshot = !!hitEnemyPart.userData.headshot;
          const dmg = w.def.damage * this.mods.dmg * (headshot ? w.def.headshotMul : 1) *
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
    if (w.ammo === 0) this.startReload();
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
    if (this.meleeCooldown > 0) this.meleeCooldown -= dt;
    w.bloom = Math.max(0, w.bloom - w.def.bloom * 8 * dt);

    // ADS blend (blocked while sprinting hard or reloading the launcher)
    const wantAds = this.ads && !this.game.player.sprintingHard && this.game.playing;
    this.adsAmount += ((wantAds ? 1 : 0) - this.adsAmount) *
      Math.min(1, dt * 10 * this.mods.adsSpeed);
    if (this.adsAmount < 0.001) this.adsAmount = 0;

    if (w.reloading) {
      w.reloadTimer -= dt;
      if (w.reloadTimer <= 0) {
        const need = w.capacity - w.ammo;
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
