import * as THREE from 'three';

const healthGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
const crossGeoA = new THREE.BoxGeometry(0.28, 0.1, 0.1);
const crossGeoB = new THREE.BoxGeometry(0.1, 0.28, 0.1);
const ammoGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.4, 6);
const nadeGeo = new THREE.OctahedronGeometry(0.24, 0);

class Pickup {
  constructor(game, kind, pos) {
    this.game = game;
    this.kind = kind; // 'health' | 'ammo'
    this.life = 20;
    this.baseY = 0.55;
    this.spin = Math.random() * Math.PI * 2;

    const group = new THREE.Group();
    if (kind === 'health') {
      const shell = new THREE.Mesh(healthGeo, new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.3, metalness: 0.2,
        transparent: true, opacity: 0.35,
      }));
      const crossMat = new THREE.MeshStandardMaterial({
        color: 0xff4d5e, emissive: 0xff4d5e, emissiveIntensity: 1.4,
      });
      group.add(shell);
      group.add(new THREE.Mesh(crossGeoA, crossMat));
      group.add(new THREE.Mesh(crossGeoB, crossMat));
    } else if (kind === 'grenade') {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xa8ff6a, emissive: 0xa8ff6a, emissiveIntensity: 0.9,
        roughness: 0.35, metalness: 0.5,
      });
      group.add(new THREE.Mesh(nadeGeo, mat));
    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 1.0,
        roughness: 0.35, metalness: 0.6,
      });
      const m = new THREE.Mesh(ammoGeo, mat);
      m.rotation.z = Math.PI / 2;
      group.add(m);
    }
    group.position.set(pos.x, this.baseY, pos.z);
    this.group = group;
    game.scene.add(group);
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) return false;
    this.spin += dt * 2.4;
    this.group.rotation.y = this.spin;
    this.group.position.y = this.baseY + Math.sin(this.spin * 1.3) * 0.12;

    // blink when about to expire
    this.group.visible = this.life > 5 || (this.life * 6) % 2 > 0.8;

    const p = this.game.player;
    const dx = p.position.x - this.group.position.x;
    const dz = p.position.z - this.group.position.z;
    const dy = (p.position.y + 0.9) - this.group.position.y;
    if (dx * dx + dz * dz + dy * dy < 1.5 * 1.5 && p.alive) {
      this._apply();
      return false;
    }
    return true;
  }

  _apply() {
    const g = this.game;
    if (this.kind === 'health') {
      g.player.heal(35);
    } else if (this.kind === 'grenade') {
      g.weapons.addGrenade(1);
    } else {
      g.weapons.addReserveAll(1); // one magazine's worth for every weapon
    }
    g.audio.pickup(this.kind);
    const colors = { health: 0xff4d5e, grenade: 0xa8ff6a, ammo: 0xffb347 };
    g.effects.burst(this.group.position, colors[this.kind], 14, 3, 0.4, 2);
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh && o.material) o.material.dispose();
    });
  }
}

export class PickupManager {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  maybeDrop(pos) {
    const roll = Math.random();
    if (roll < 0.1) this.spawn('health', pos);       // rarer now that health regenerates
    else if (roll < 0.32) this.spawn('ammo', pos);
    else if (roll < 0.42) this.spawn('grenade', pos);
  }

  spawn(kind, pos) {
    this.list.push(new Pickup(this.game, kind, pos));
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].update(dt)) {
        this.list[i].dispose();
        this.list.splice(i, 1);
      }
    }
  }

  reset() {
    for (const p of this.list) p.dispose();
    this.list = [];
  }
}
