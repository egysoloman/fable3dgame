import * as THREE from 'three';

const MAX_PARTICLES = 600;
const MAX_TRACERS = 24;

export class Effects {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;

    // --- particle pool (Points with per-vertex colors) ---
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({ alive: false, vel: new THREE.Vector3(), life: 0, maxLife: 1, gravity: 1 });
      this.pPos[i * 3 + 1] = -1000;
    }
    this.pCursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // --- tracer pool (thin stretched boxes) ---
    this.tracers = [];
    const tGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
    for (let i = 0; i < MAX_TRACERS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xaef4ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(tGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, life: 0, maxLife: 0.08 });
    }
    this.tCursor = 0;

    // --- shared flash light for muzzle / explosions ---
    this.flashLight = new THREE.PointLight(0xfff2c0, 0, 18, 2);
    this.scene.add(this.flashLight);
    this.flashTime = 0;

    // --- shock ring pool for explosions ---
    this._rings = [];
    const ringGeo = new THREE.RingGeometry(0.8, 1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd9a0, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this._rings.push({ mesh, life: 0 });
    }
  }

  spawnParticle(pos, vel, color, life, gravity = 1) {
    const i = this.pCursor;
    this.pCursor = (this.pCursor + 1) % MAX_PARTICLES;
    const p = this.particles[i];
    p.alive = true;
    p.vel.copy(vel);
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;
    this.pPos[i * 3] = pos.x;
    this.pPos[i * 3 + 1] = pos.y;
    this.pPos[i * 3 + 2] = pos.z;
    this.pCol[i * 3] = color.r;
    this.pCol[i * 3 + 1] = color.g;
    this.pCol[i * 3 + 2] = color.b;
  }

  burst(pos, colorHex, count, speed, life = 0.5, gravity = 6) {
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5
      ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.spawnParticle(pos, dir, color, life * (0.5 + Math.random() * 0.5), gravity);
    }
  }

  impactSparks(pos, normalHint) {
    this.burst(pos, 0xffd27f, 10, 5, 0.4, 9);
  }

  enemyHitSparks(pos) {
    this.burst(pos, 0xff8a3b, 12, 4.5, 0.45, 7);
  }

  enemyDeathBurst(pos, colorHex) {
    this.burst(pos, colorHex, 40, 7, 0.8, 6);
    this.burst(pos, 0xffffff, 12, 9, 0.4, 4);
    this.flash(pos, 3.5, 0xaef4ff);
  }

  explosion(pos) {
    this.burst(pos, 0xffc36a, 50, 11, 0.7, 7);
    this.burst(pos, 0xff5a2a, 30, 6, 0.9, 4);
    this.burst(pos, 0x8a8a8a, 20, 3.5, 1.3, 1.5);
    this.flash(pos, 9, 0xffb24a);
    // expanding shock ring
    const ring = this._rings && this._rings.find((r) => !r.mesh.visible);
    if (ring) {
      ring.mesh.position.copy(pos);
      ring.mesh.position.y = Math.max(0.15, pos.y);
      ring.mesh.visible = true;
      ring.life = 0.4;
    }
  }

  spawnPortal(pos, colorHex) {
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const p = new THREE.Vector3(pos.x + Math.cos(a) * 0.8, pos.y + 0.1, pos.z + Math.sin(a) * 0.8);
      this.spawnParticle(p, new THREE.Vector3(0, 3 + Math.random() * 2, 0), color, 0.7, 0.5);
    }
  }

  tracer(from, to, colorHex = 0xaef4ff) {
    const t = this.tracers[this.tCursor];
    this.tCursor = (this.tCursor + 1) % MAX_TRACERS;
    const dist = from.distanceTo(to);
    if (dist < 0.5) return;
    t.mesh.material.color.setHex(colorHex);
    t.mesh.position.copy(from).add(to).multiplyScalar(0.5);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, dist);
    t.mesh.visible = true;
    t.life = t.maxLife;
  }

  flash(pos, intensity = 6, colorHex = 0xfff2c0) {
    this.flashLight.position.copy(pos);
    this.flashLight.color.setHex(colorHex);
    this.flashLight.intensity = intensity * 10;
    this.flashTime = 0.06;
  }

  update(dt) {
    // particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.pPos[i * 3 + 1] = -1000;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      this.pPos[i * 3] += p.vel.x * dt;
      this.pPos[i * 3 + 1] += p.vel.y * dt;
      this.pPos[i * 3 + 2] += p.vel.z * dt;
      const fade = p.life / p.maxLife;
      this.pCol[i * 3] *= (0.9 + fade * 0.1);
      this.pCol[i * 3 + 1] *= (0.9 + fade * 0.1);
      this.pCol[i * 3 + 2] *= (0.9 + fade * 0.1);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    // tracers
    for (const t of this.tracers) {
      if (!t.mesh.visible) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.mesh.visible = false;
        continue;
      }
      t.mesh.material.opacity = (t.life / t.maxLife) * 0.9;
    }

    // shock rings
    for (const r of this._rings) {
      if (!r.mesh.visible) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.mesh.visible = false;
        continue;
      }
      const t = 1 - r.life / 0.4;
      const s = 1 + t * 10;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = 0.8 * (1 - t);
    }

    // flash light decay
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flashLight.intensity = 0;
      else this.flashLight.intensity *= Math.max(0, 1 - dt * 18);
    }
  }

  reset() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles[i].alive = false;
      this.pPos[i * 3 + 1] = -1000;
    }
    for (const t of this.tracers) t.mesh.visible = false;
    for (const r of this._rings) r.mesh.visible = false;
    this.flashLight.intensity = 0;
  }
}
