import * as THREE from 'three';

const EYE_STAND = 1.62;
const EYE_CROUCH = 1.12;
const PLAYER_HALF_W = 0.35;
const PLAYER_HEIGHT = 1.78;
const WALK_SPEED = 6.0;
const SPRINT_SPEED = 8.8;
const ACCEL_GROUND = 55;
const ACCEL_AIR = 12;
const FRICTION = 9.0;
const GRAVITY = 26;
const JUMP_SPEED = 8.6;
const MAX_HP = 100;
const REGEN_DELAY = 4.5;   // CoD-style regen: seconds without damage before healing
const REGEN_RATE = 22;     // hp per second

export class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;

    this.position = new THREE.Vector3(0, 0, 10);  // feet position
    this.velocity = new THREE.Vector3();
    this.yaw = 0;   // spawn at (0,0,10) facing -Z, toward the arena center
    this.pitch = 0;
    this.grounded = false;
    this.wasGrounded = false;
    this.sprinting = false;
    this.sprintingHard = false;
    this.crouchHeld = false;
    this.crouchToggle = false;
    this.crouchAmount = 0;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.alive = true;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.landBump = 0;
    this.timeSinceDamage = 999;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.vehicle = null;
    this.armor = 0;

    this.keys = new Set();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyC' && this.game.playing) this.crouchToggle = !this.crouchToggle;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.game.pointerLocked || !this.game.playing) return;
      const ads = this.game.weapons ? this.game.weapons.adsAmount : 0;
      const sens = 0.0022 * this.game.settings.sensitivity * (1 - ads * 0.45);
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });

    this.camera.rotation.order = 'YXZ';
    this.syncCamera(0);
  }

  reset() {
    const sp = this.game.world.map.playerSpawn;
    this.position.set(sp[0], 0, sp[1]);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.maxHp = this.game.progression ? this.game.progression.maxHp() : MAX_HP;
    this.hp = this.maxHp;
    this.vehicle = null;
    this.armor = this.game.hasEquip && this.game.hasEquip('plates') ? 50 : 0;
    this.game.hud.setArmor(this.armor);
    this.alive = true;
    this.grounded = false;
    this.crouchToggle = false;
    this.crouchAmount = 0;
    this.timeSinceDamage = 999;
    this.shakeTime = 0;
    this.keys.clear();
    this.syncCamera(0);
  }

  get eyeHeight() {
    return EYE_STAND + (EYE_CROUCH - EYE_STAND) * this.crouchAmount;
  }

  get eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
  }

  forwardDir() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  rightDir() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  update(dt) {
    if (!this.alive || this.vehicle) return;

    // --- input ---
    const fwd = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    this.crouchHeld = this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.crouchToggle;
    const wantSprint = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
      !this.crouchHeld && fwd > 0;
    this.sprinting = wantSprint;
    if (this.sprinting) this.crouchToggle = false;

    this.crouchAmount += ((this.crouchHeld ? 1 : 0) - this.crouchAmount) * Math.min(1, dt * 10);

    const wish = new THREE.Vector3();
    if (fwd || strafe) {
      wish.addScaledVector(this.forwardDir(), fwd);
      wish.addScaledVector(this.rightDir(), strafe);
      wish.normalize();
    }

    const weapons = this.game.weapons;
    const moveMul = (weapons ? weapons.current.def.moveMul : 1) *
      (1 - (weapons ? weapons.adsAmount : 0) * 0.25) *
      (1 - this.crouchAmount * 0.45);
    const boots = this.game.hasEquip && this.game.hasEquip('boots') ? 1.08 : 1;
    const sprintSpeed = SPRINT_SPEED * this.game.progression.sprintMul() * boots;
    const maxSpeed = (this.sprinting ? sprintSpeed : WALK_SPEED * boots) * moveMul;

    // --- horizontal velocity: friction + acceleration ---
    const hv = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    if (this.grounded) {
      const drop = Math.max(0, 1 - FRICTION * dt);
      hv.multiplyScalar(drop);
    }
    const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
    hv.addScaledVector(wish, accel * dt);
    if (hv.length() > maxSpeed) hv.setLength(maxSpeed);
    this.velocity.x = hv.x;
    this.velocity.z = hv.z;

    // sprint-out: weapon is raised while sprinting at speed
    const hSpeedNow = hv.length();
    this.sprintingHard = this.sprinting && this.grounded && hSpeedNow > WALK_SPEED * 0.95;

    // --- jump & gravity ---
    if (this.keys.has('Space') && this.grounded) {
      this.velocity.y = JUMP_SPEED *
        (this.game.hasEquip && this.game.hasEquip('boots') ? 1.05 : 1);
      this.grounded = false;
      this.crouchToggle = false;
      this.game.audio.jump();
    }
    this.velocity.y -= GRAVITY * (this.game.world.map.gravityMul || 1) * dt;

    // --- integrate with collision, axis by axis ---
    this.wasGrounded = this.grounded;
    this.grounded = false;
    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);
    this._moveAxis('y', this.velocity.y * dt);

    // floor
    if (this.position.y <= 0) {
      this.position.y = 0;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.grounded = true;
    }
    // hard arena bounds as a safety net
    const lim = this.game.world.half - 0.6;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));

    if (this.grounded && !this.wasGrounded) {
      this.landBump = 0.14;
      this.game.audio.land();
    }

    // --- health regen (STIM shortens the delay and speeds it up) ---
    this.timeSinceDamage += dt;
    const stim = this.game.hasEquip && this.game.hasEquip('stim');
    const regenDelay = stim ? 2.5 : REGEN_DELAY;
    const regenRate = REGEN_RATE * (stim ? 1.5 : 1);
    if (this.timeSinceDamage > regenDelay && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + regenRate * dt);
      this.game.hud.setHealth(this.hp, this.maxHp);
    }

    // --- head bob ---
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && hSpeed > 0.5) {
      this.bobPhase += dt * (6 + hSpeed * 0.9);
      this.bobAmount = Math.min(1, this.bobAmount + dt * 6);
    } else {
      this.bobAmount = Math.max(0, this.bobAmount - dt * 4);
    }
    this.landBump = Math.max(0, this.landBump - dt * 0.6);
    this.shakeTime = Math.max(0, this.shakeTime - dt);

    this.syncCamera(dt);
  }

  _aabb(pos) {
    return {
      minX: pos.x - PLAYER_HALF_W, maxX: pos.x + PLAYER_HALF_W,
      minY: pos.y, maxY: pos.y + PLAYER_HEIGHT,
      minZ: pos.z - PLAYER_HALF_W, maxZ: pos.z + PLAYER_HALF_W,
    };
  }

  _moveAxis(axis, amount) {
    if (amount === 0) return;
    this.position[axis] += amount;
    const colliders = this.game.world.colliders;
    for (const c of colliders) {
      const b = this._aabb(this.position);
      const overlaps =
        b.maxX > c.min.x && b.minX < c.max.x &&
        b.maxY > c.min.y && b.minY < c.max.y &&
        b.maxZ > c.min.z && b.minZ < c.max.z;
      if (!overlaps) continue;
      if (axis === 'x') {
        this.position.x = amount > 0 ? c.min.x - PLAYER_HALF_W : c.max.x + PLAYER_HALF_W;
        this.velocity.x = 0;
      } else if (axis === 'z') {
        this.position.z = amount > 0 ? c.min.z - PLAYER_HALF_W : c.max.z + PLAYER_HALF_W;
        this.velocity.z = 0;
      } else {
        if (amount > 0) {
          this.position.y = c.min.y - PLAYER_HEIGHT;
        } else {
          this.position.y = c.max.y;
          this.grounded = true;
        }
        this.velocity.y = 0;
      }
    }
  }

  addShake(mag) {
    this.shakeTime = 0.3;
    this.shakeMag = mag;
  }

  syncCamera(dt) {
    const ads = this.game.weapons ? this.game.weapons.adsAmount : 0;
    const bobScale = 1 - ads * 0.8;
    const bobY = Math.sin(this.bobPhase * 2) * 0.045 * this.bobAmount * bobScale;
    const bobX = Math.sin(this.bobPhase) * 0.03 * this.bobAmount * bobScale;
    let shakeX = 0, shakeY = 0;
    if (this.shakeTime > 0) {
      const s = this.shakeMag * (this.shakeTime / 0.3);
      shakeX = (Math.random() - 0.5) * s;
      shakeY = (Math.random() - 0.5) * s;
    }
    this.camera.position.set(
      this.position.x + bobX * Math.cos(this.yaw) + shakeX,
      this.position.y + this.eyeHeight + bobY - this.landBump + shakeY,
      this.position.z - bobX * Math.sin(this.yaw)
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // FOV: sprint widens, ADS narrows
    if (dt > 0) {
      let targetFov = 75;
      if (this.sprintingHard) targetFov = 82;
      if (this.game.weapons && ads > 0.01) {
        targetFov = 75 + (this.game.weapons.current.def.adsFov - 75) * ads;
      }
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }
  }

  takeDamage(amount, sourcePos = null, dmgType = 'melee') {
    if (!this.alive || this.game.godMode) return;
    // COMBAT HELMET blunts explosions and incoming fire
    if (this.game.hasEquip && this.game.hasEquip('helmet')) {
      if (dmgType === 'splash') amount *= 0.6;
      else if (dmgType === 'bullet' || dmgType === 'bolt') amount *= 0.75;
    }
    // ARMOR PLATES absorb before health
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.7);
      this.armor -= absorbed;
      amount -= absorbed;
      this.game.hud.setArmor(this.armor);
    }
    this.hp -= amount;
    this.timeSinceDamage = 0;
    this.game.resetStreak();
    this.game.audio.hurt();
    this.game.hud.damageFlash();
    if (sourcePos) {
      const dx = sourcePos.x - this.position.x;
      const dz = sourcePos.z - this.position.z;
      const worldAngle = Math.atan2(dx, -dz);       // angle of the threat
      const rel = worldAngle + this.yaw;            // relative to facing
      this.game.hud.damageDirection(rel);
    }
    this.addShake(Math.min(0.08, amount * 0.0025));
    this.game.hud.setHealth(this.hp, this.maxHp);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.game.gameOver();
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.game.hud.setHealth(this.hp, this.maxHp);
  }
}
