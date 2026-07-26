import * as THREE from 'three';
import { ENEMY_TYPES, buildEnemyBody } from './enemies.js';
import { t } from './i18n.js';

// Co-op wave survival: the server manages rooms and relays; the room HOST's
// client simulates enemies with the same code as solo play and broadcasts
// snapshots. Other clients render interpolated replicas, raycast locally, and
// send damage claims that the host applies authoritatively.

const PSTATE_HZ = 15;
const SNAP_HZ = 10;
const TYPE_IDS = ['grunt', 'ranger', 'tank'];

function makeNameSprite(name, color = '#7ff3ff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(4, 10, 16, 0.6)';
  const w = Math.min(240, g.measureText(name).width + 24);
  g.fillRect(128 - w / 2, 8, w, 46);
  g.fillStyle = color;
  g.fillText(name, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.9, 0.48, 1);
  sprite.renderOrder = 998;
  return sprite;
}

// ---------- remote teammate avatar ----------
class RemotePlayer {
  constructor(game, id, name) {
    this.game = game;
    this.id = id;
    this.name = name;
    this.alive = true;
    this.hp = 100;
    this.position = new THREE.Vector3(0, 0, 10);
    this.targetPos = this.position.clone();
    this.yaw = 0;
    this.targetYaw = 0;
    this.crouch = 0;
    this.walkPhase = 0;

    const body = buildEnemyBody(
      { color: 0x27b8d8, eyeColor: 0xbfffff, scale: 1 }, false);
    this.group = body.group;
    this.parts = body;
    this.group.traverse((o) => { o.userData.rp = this; });
    this.tag = makeNameSprite(name);
    this.tag.position.y = 2.35;
    this.tag.raycast = () => {};
    this.group.add(this.tag);
    this.group.position.copy(this.position);
    game.scene.add(this.group);
  }

  applyState(s) {
    this.targetPos.set(s.x, s.y, s.z);
    this.targetYaw = s.yaw;
    this.crouch = s.c || 0;
    this.hp = s.hp;
    const wasAlive = this.alive;
    this.alive = !!s.a;
    if (wasAlive !== this.alive) this.group.visible = this.alive;
  }

  update(dt) {
    const prevX = this.position.x, prevZ = this.position.z;
    const k = 1 - Math.exp(-12 * dt);
    this.position.lerp(this.targetPos, k);
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * k;

    const speed = Math.hypot(this.position.x - prevX, this.position.z - prevZ) / Math.max(dt, 0.001);
    if (speed > 0.5) this.walkPhase += dt * (4 + speed);
    const swing = speed > 0.5 ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.group.scale.y = 1 - this.crouch * 0.25;
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.parts.dispose();
    this.tag.material.map.dispose();
    this.tag.material.dispose();
  }
}

// ---------- client-side enemy replica ----------
class EnemyReplica {
  constructor(game, mp, id, typeName, x, z) {
    this.game = game;
    this.mp = mp;
    this.id = id;
    this.type = ENEMY_TYPES[typeName];
    this.alive = true;
    this.dying = -1;
    this.spawnTimer = 0;
    this.hp = this.type.hp;
    this.maxHp = this.type.hp;
    this.halfW = 0.42 * this.type.scale;
    this.height = 1.85 * this.type.scale;
    this.position = new THREE.Vector3(x, 0, z);
    this.targetPos = this.position.clone();
    this.yaw = 0;
    this.targetYaw = 0;
    this.walkPhase = Math.random() * 10;
    this.flashTime = 0;

    const body = buildEnemyBody(this.type, true);
    this.group = body.group;
    this.parts = body;
    this.group.traverse((o) => { o.userData.enemy = this; });
    this.parts.head.userData.headshot = true;
    this.group.position.copy(this.position);
    this.group.scale.setScalar(this.type.scale);
    game.scene.add(this.group);
  }

  applySnap(x, z, yaw, hpFrac) {
    this.targetPos.set(x, 0, z);
    this.targetYaw = yaw;
    this.hp = hpFrac * this.maxHp;
  }

  // local hit: optimistic feedback, host applies the real damage
  takeDamage(dmg, point, headshot) {
    if (!this.alive) return;
    this.flashTime = 0.08;
    if (point) this.game.effects.enemyHitSparks(point);
    this.game.audio.hit(headshot);
    this.game.hud.hitmarker(false);
    this.mp.sendDamage(this.id, dmg, headshot);
  }

  die() {
    this.alive = false;
    this.dying = 0;
    const center = new THREE.Vector3(
      this.position.x, this.position.y + this.height * 0.55, this.position.z);
    this.game.effects.enemyDeathBurst(center, this.type.color);
    this.parts.bodyMat.transparent = true;
    this.parts.bar.visible = false;
    this.parts.barBg.visible = false;
  }

  update(dt) {
    const g = this.group;
    if (!this.alive) {
      this.dying += dt;
      const tt = Math.min(1, this.dying / 0.6);
      g.scale.set(
        this.type.scale * (1 + tt * 0.4),
        Math.max(0.01, this.type.scale * (1 - tt)),
        this.type.scale * (1 + tt * 0.4));
      this.parts.bodyMat.opacity = 1 - tt;
      return this.dying < 0.65;
    }
    const prevX = this.position.x, prevZ = this.position.z;
    const k = 1 - Math.exp(-10 * dt);
    this.position.lerp(this.targetPos, k);
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * k;
    g.position.copy(this.position);
    g.rotation.y = this.yaw;

    const speed = Math.hypot(this.position.x - prevX, this.position.z - prevZ) / Math.max(dt, 0.001);
    if (speed > 0.4) this.walkPhase += dt * speed * 2.2;
    const swing = speed > 0.4 ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      const f = Math.max(0, this.flashTime / 0.08);
      this.parts.bodyMat.emissive.setRGB(f + 0.1, f + 0.1, f + 0.1);
      this.parts.bodyMat.emissiveIntensity = 0.12 + f * 2.2;
      if (this.flashTime <= 0) {
        this.parts.bodyMat.emissive.setHex(this.type.color);
        this.parts.bodyMat.emissiveIntensity = 0.12;
      }
    }

    const frac = Math.max(0, this.hp / this.maxHp);
    this.parts.bar.scale.x = Math.max(0.001, frac);
    this.parts.bar.position.x = -(1 - frac) * 0.45;
    this.parts.barMat.color.setHSL(frac * 0.33, 0.9, 0.55);
    const camPos = this.game.camera.position;
    this.parts.barBg.lookAt(camPos.x, this.parts.barBg.getWorldPosition(_tmpV).y, camPos.z);
    this.parts.bar.rotation.copy(this.parts.barBg.rotation);
    const show = this.hp < this.maxHp;
    this.parts.bar.visible = show;
    this.parts.barBg.visible = show;
    return true;
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.parts.dispose();
  }
}

const _tmpV = new THREE.Vector3();
const boltGeo = new THREE.SphereGeometry(0.13, 8, 8);
const boltMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a });

// Client-side stand-in for EnemyManager: same read interface, fed by snapshots.
class ReplicaManager {
  constructor(game, mp) {
    this.game = game;
    this.mp = mp;
    this.list = [];
    this.byId = new Map();
    this.projectiles = [];       // visual bolt meshes
    this.wave = 0;
    this.state = 'idle';
    this.left = 0;
    this.timer = 0;
  }

  aliveGroups() {
    return this.list.filter((e) => e.alive).map((e) => e.group);
  }

  aliveCount() {
    return this.list.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  }

  applySnapshot(snap) {
    const seen = new Set();
    for (const [id, ti, x, z, yaw, hpf, dying] of snap.e) {
      seen.add(id);
      if (dying) continue;
      let r = this.byId.get(id);
      if (!r) {
        r = new EnemyReplica(this.game, this.mp, id, TYPE_IDS[ti], x, z);
        this.byId.set(id, r);
        this.list.push(r);
        this.game.effects.spawnPortal(r.position, r.type.color);
      }
      r.applySnap(x, z, yaw, hpf);
    }
    // anything alive that the host no longer reports is gone (missed die event)
    for (const r of this.list) {
      if (r.alive && !seen.has(r.id)) r.die();
    }

    // bolts
    while (this.projectiles.length < snap.p.length) {
      const m = new THREE.Mesh(boltGeo, boltMat);
      this.game.scene.add(m);
      this.projectiles.push({ mesh: m, target: new THREE.Vector3() });
    }
    while (this.projectiles.length > snap.p.length) {
      const b = this.projectiles.pop();
      this.game.scene.remove(b.mesh);
    }
    snap.p.forEach(([x, y, z], i) => {
      const b = this.projectiles[i];
      b.target.set(x, y, z);
      if (b.mesh.position.lengthSq() === 0) b.mesh.position.copy(b.target);
    });

    const [wave, stateCode, left, timer] = snap.w;
    this.wave = wave;
    this.state = ['idle', 'intermission', 'spawning', 'active'][stateCode] || 'active';
    this.left = left;
    this.timer = timer;
  }

  handleDie(id) {
    const r = this.byId.get(id);
    if (r && r.alive) r.die();
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].update(dt)) {
        const r = this.list[i];
        this.byId.delete(r.id);
        r.dispose();
        this.list.splice(i, 1);
      }
    }
    for (const b of this.projectiles) {
      b.mesh.position.lerp(b.target, 1 - Math.exp(-14 * dt));
    }
    if (this.state === 'intermission') {
      this.game.hud.subbanner(t('banner.nextWave', { s: Math.max(1, Math.ceil(this.timer)) }));
    } else {
      this.game.hud.subbanner('');
    }
    this.game.hud.setEnemiesLeft(this.aliveCount() + this.left);
    this.game.hud.setWave(Math.max(1, this.wave));
  }

  reset() {
    for (const r of this.list) r.dispose();
    this.list = [];
    this.byId.clear();
    for (const b of this.projectiles) this.game.scene.remove(b.mesh);
    this.projectiles = [];
    this.wave = 0;
    this.state = 'idle';
  }
}

// ---------- the multiplayer client ----------
export class Multiplayer {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.connected = false;
    this.myId = null;
    this.name = 'PLAYER';
    try { this.name = localStorage.getItem('neonstrike.name') || 'PLAYER'; } catch (e) { /* ok */ }

    this.serverAddress = '';
    try { this.serverAddress = localStorage.getItem('neonstrike.server') || ''; } catch (e) { /* ok */ }
    if (!this.serverAddress) {
      this.serverAddress = (typeof window !== 'undefined' && window.NEON_SERVER_ADDRESS) ||
        location.host;
    }

    this.room = null;          // latest roomState payload
    this.active = false;       // in a started match
    this.isHost = false;
    this.remotes = new Map();  // id -> RemotePlayer
    this.scores = new Map();   // id -> {name, score, kills}
    this.replicas = null;      // ReplicaManager while a client in a match

    this.psAcc = 0;
    this.snapAcc = 0;
    this.overSent = false;
    this._overTimer = 0;
    this.matchMode = 'survival';
    this.matchTimer = 0;
    this.lastAttacker = null;
    this.pvpRespawn = 0;
  }

  get versus() {
    return this.active && this.matchMode === 'versus';
  }

  pvpTargets() {
    return [...this.remotes.values()].filter((r) => r.alive).map((r) => r.group);
  }

  sendPvpHit(id, dmg, pos) {
    this.relayTo(id, {
      k: 'pvpHit', dmg: Math.round(dmg),
      sx: +this.game.player.position.x.toFixed(1),
      sz: +this.game.player.position.z.toFixed(1),
    });
  }

  sendBikeState(i, on) {
    this.relay({ k: 'bike', i, on: on ? 1 : 0 });
  }

  // Accepts host, host:port, ws://.., wss://.., http://.., https://..;
  // scheme defaults to the page's security level, path defaults to /ws.
  resolveWsUrl(addr) {
    let a = (addr || '').trim();
    if (!a) return null;
    if (!a.includes('://')) {
      a = (location.protocol === 'https:' ? 'wss://' : 'ws://') + a;
    }
    a = a.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    try {
      const u = new URL(a);
      if (!u.pathname || u.pathname === '/') u.pathname = '/ws';
      return u.toString();
    } catch (e) {
      return null;
    }
  }

  setServerAddress(addr) {
    const a = (addr || '').trim();
    if (!a || this.resolveWsUrl(a) === null) return false;
    this.serverAddress = a;
    try { localStorage.setItem('neonstrike.server', a); } catch (e) { /* ok */ }
    return true;
  }

  disconnect() {
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      this.connected = false;
      ws.onclose = null;
      try { ws.close(); } catch (e) { /* ok */ }
      this.room = null;
      this.game.ui.setServerStatus('disconnected');
    }
  }

  // ---- connection ----
  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      return Promise.resolve(this.connected);
    }
    const url = this.resolveWsUrl(this.serverAddress);
    if (!url) {
      this.game.ui.setServerStatus('failed', 'badAddress');
      return Promise.resolve(false);
    }
    this.game.ui.setServerStatus('connecting');
    return new Promise((resolve) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        this.game.ui.setServerStatus('failed', 'badAddress');
        resolve(false);
        return;
      }
      this.ws = ws;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; ws.close(); resolve(false); }
      }, 4000);
      ws.onopen = () => {
        this.connected = true;
        this.game.ui.setServerStatus('connected');
        this.send({ t: 'hello', name: this.name });
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.t === 'welcome') {
          this.myId = msg.id;
          if (!settled) { settled = true; clearTimeout(timeout); resolve(true); }
        }
        this._onMessage(msg);
      };
      ws.onclose = () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.ws = null;
        this.game.ui.setServerStatus(wasConnected ? 'disconnected' : 'failed');
        if (!settled) { settled = true; clearTimeout(timeout); resolve(false); }
        if (wasConnected) this._onDisconnected();
      };
      ws.onerror = () => { /* close follows */ };
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  relay(d) { this.send({ t: 'msg', d }); }
  relayTo(to, d) { this.send({ t: 'msgTo', to, d }); }

  setName(name) {
    this.name = (name || 'PLAYER').slice(0, 16).trim() || 'PLAYER';
    try { localStorage.setItem('neonstrike.name', this.name); } catch (e) { /* ok */ }
    this.send({ t: 'hello', name: this.name });
  }

  // ---- lobby actions (wired to UI in main.js) ----
  listRooms() { this.send({ t: 'list' }); }
  createRoom() { this.send({ t: 'create' }); }
  joinRoom(code) { this.send({ t: 'join', code }); }
  leaveRoom() { this.send({ t: 'leave' }); }
  setReady(v) { this.send({ t: 'ready', v }); }
  requestStart(map, mode, difficulty) { this.send({ t: 'start', map, mode, difficulty }); }

  inRoom() { return !!this.room; }

  // ---- message handling ----
  _onMessage(msg) {
    const game = this.game;
    switch (msg.t) {
      case 'roomList':
        game.ui.renderRoomList(msg.rooms);
        break;
      case 'roomState': {
        const prev = this.room;
        this.room = msg;
        if (this.active) {
          // players may join/leave mid-match
          this._syncMatchPlayers();
          if (prev && prev.players.length < msg.players.length) {
            const newIds = msg.players.filter((p) => !prev.players.some((q) => q.id === p.id));
            for (const p of newIds) game.hud.killfeed(t('mp.joined', { name: p.name }), 'cheat');
          }
        } else {
          // don't yank players off the match-over scoreboard; the BACK TO
          // LOBBY button renders the stored room state instead
          const overVisible =
            document.getElementById('mpover-screen').classList.contains('visible');
          if (!overVisible) game.ui.renderLobby(msg);
        }
        break;
      }
      case 'leftRoom':
        this.room = null;
        game.ui.showMpBrowser();
        break;
      case 'started':
        this.game.matchDifficulty = msg.difficulty || 'normal';
        this._startMatch(msg.hostId === this.myId, msg.map || 'arena', msg.mode || 'survival');
        break;
      case 'hostLeft':
        if (this.active) this._endMatch('hostLeft');
        break;
      case 'error':
        game.ui.mpStatus(t(`mp.err.${msg.code}`) || msg.code);
        break;
      case 'relay':
        this._onGameMessage(msg.from, msg.d);
        break;
    }
  }

  _onDisconnected() {
    const game = this.game;
    this.room = null;
    if (this.active) {
      this._endMatch('lost');
    } else if (game.state === 'menu') {
      game.ui.mpStatus(t('mp.err.lost'));
      game.ui.showMenu();
    }
  }

  _onGameMessage(from, d) {
    const game = this.game;
    if (!d || !this.active) return;
    switch (d.k) {
      case 'ps': {
        const r = this.remotes.get(from);
        if (r) r.applyState(d);
        break;
      }
      case 'shot': {
        game.effects.tracer(
          new THREE.Vector3(d.fx, d.fy, d.fz), new THREE.Vector3(d.tx, d.ty, d.tz), d.c);
        game.audio.remoteShot();
        break;
      }
      case 'boom': {
        game.effects.explosion(new THREE.Vector3(d.x, d.y, d.z));
        game.audio.explosion();
        break;
      }
      case 'snap': {
        if (!this.isHost && this.replicas) this.replicas.applySnapshot(d);
        break;
      }
      case 'dmg': {
        if (this.isHost) {
          const enemy = game.enemies.byId && game.enemies.byId.get(d.id);
          if (enemy && enemy.alive) {
            enemy.takeDamage(d.dmg, null, d.hs, from);
          }
        }
        break;
      }
      case 'die': {
        if (!this.isHost && this.replicas) this.replicas.handleDie(d.id);
        this._creditKill(d.by, d.ti, d.pts);
        break;
      }
      case 'hurt': {
        game.player.takeDamage(d.dmg, d.sx !== undefined
          ? new THREE.Vector3(d.sx, 0, d.sz) : null);
        break;
      }
      case 'wave': {
        if (!this.isHost) {
          game.hud.banner(t('banner.wave', { n: d.n }), d.n % 5 === 0 ? 'danger' : '');
          game.audio.waveStart();
        }
        if (!game.player.alive) this._respawnLocal();
        break;
      }
      case 'clear': {
        if (!this.isHost) {
          game.hud.banner(t('banner.waveClear'), '');
          game.hud.bannerFadeSoon();
          game.audio.waveClear();
        }
        this._waveResupply();
        break;
      }
      case 'down': {
        const name = this._nameOf(from);
        game.hud.killfeed(t('mp.playerDown', { player: name }), 'cheat');
        break;
      }
      case 'bike': {
        game.warfare.setRemoteBike(d.i, !!d.on);
        break;
      }
      case 'pvpHit': {
        this.lastAttacker = from;
        game.player.takeDamage(d.dmg, d.sx !== undefined
          ? new THREE.Vector3(d.sx, 0, d.sz) : null, 'bullet');
        break;
      }
      case 'pvpDeath': {
        // sent by the victim; d.by is the killer
        const killer = this._nameOf(d.by);
        const victim = this._nameOf(from);
        const entry = this.scores.get(d.by);
        if (entry) { entry.kills++; entry.score += 100; }
        if (d.by === this.myId) {
          game.addScore(100);
          game.addKillMp();
          game.hud.hitmarker(true);
        }
        game.hud.killfeed(t('mp.playerKilled', { player: killer, enemy: victim }));
        break;
      }
      case 'over': {
        if (!this.isHost) this._endMatch('over');
        break;
      }
    }
  }

  _nameOf(id) {
    if (id === this.myId) return this.name;
    if (this.room) {
      const p = this.room.players.find((q) => q.id === id);
      if (p) return p.name;
    }
    return '?';
  }

  // ---- match lifecycle ----
  _startMatch(isHost, map = 'arena', mode = 'survival') {
    this.active = true;
    this.map = map;
    this.matchMode = mode;
    this.matchTimer = 240;
    this.lastAttacker = null;
    this.pvpRespawn = 0;
    this.isHost = isHost;
    this.overSent = false;
    this.scores.clear();
    for (const p of this.room.players) {
      this.scores.set(p.id, { name: p.name, score: 0, kills: 0 });
    }
    this.replicas = (isHost || mode === 'versus') ? null : new ReplicaManager(this.game, this);
    this.game.startMatch(this, map, mode);
    this._syncMatchPlayers();
  }

  _syncMatchPlayers() {
    if (!this.room) return;
    const present = new Set(this.room.players.map((p) => p.id));
    for (const [id, r] of this.remotes) {
      if (!present.has(id)) {
        this.game.hud.killfeed(t('mp.left', { name: r.name }), 'cheat');
        r.dispose();
        this.remotes.delete(id);
      }
    }
    for (const p of this.room.players) {
      if (p.id !== this.myId && !this.remotes.has(p.id)) {
        this.remotes.set(p.id, new RemotePlayer(this.game, p.id, p.name));
        if (!this.scores.has(p.id)) this.scores.set(p.id, { name: p.name, score: 0, kills: 0 });
      }
    }
  }

  _respawnLocal() {
    const game = this.game;
    const p = game.player;
    p.alive = true;
    p.hp = Math.round(p.maxHp * 0.6);
    const sp = game.world.map.playerSpawn;
    p.position.set(sp[0] + (Math.random() - 0.5) * 4, 0, sp[1]);
    p.velocity.set(0, 0, 0);
    p.timeSinceDamage = 999;
    game.hud.setHealth(p.hp, p.maxHp);
    game.hud.subbanner('');
    game.weapons.rig.visible = true;
    document.getElementById('spectate-note').classList.remove('visible');
  }

  onLocalDeath() {
    if (this.versus) {
      const by = this.lastAttacker || this.myId;
      const mine = this.scores.get(this.myId);
      this.relay({ k: 'pvpDeath', by });
      const entry = this.scores.get(by);
      if (entry && by !== this.myId) { entry.kills++; entry.score += 100; }
      this.game.hud.killfeed(t('mp.playerKilled', {
        player: this._nameOf(by), enemy: this.name }));
      this.pvpRespawn = 3;
      if (mine) mine.score = this.game.score;
    } else {
      this.relay({ k: 'down' });
    }
    this.game.weapons.rig.visible = false;
    this.game.hud.setScope(false);
    document.getElementById('spectate-note').classList.add('visible');
  }

  _waveResupply() {
    const game = this.game;
    game.weapons.addReserveAll(1);
    game.weapons.addGrenade(1);
  }

  _creditKill(by, typeIndex, pts) {
    const game = this.game;
    const typeName = TYPE_IDS[typeIndex] || 'grunt';
    const entry = this.scores.get(by);
    if (entry) { entry.score += pts; entry.kills++; }
    if (by === this.myId) {
      game.addScore(pts);
      game.addKillMp();
      game.hud.hitmarker(true);
    }
    game.hud.killfeed(t('mp.playerKilled', {
      player: this._nameOf(by), enemy: t(`enemy.${typeName}`) }));
  }

  // host: called by Enemy.die with attribution
  hostEnemyKilled(enemy, attackerId) {
    const by = attackerId || this.myId;
    const ti = TYPE_IDS.indexOf(enemy.type.name);
    const pts = enemy.type.score;
    this.relay({
      k: 'die', id: enemy.id, ti, x: enemy.position.x, z: enemy.position.z, by, pts,
    });
    this._creditKill(by, ti, pts);
  }

  hostWaveBegin(n) {
    this.relay({ k: 'wave', n });
    if (!this.game.player.alive) this._respawnLocal();
  }

  hostWaveClear() {
    this.relay({ k: 'clear' });
    this._waveResupply();
  }

  hostHurtPlayer(playerId, dmg, sourcePos) {
    this.relayTo(playerId, {
      k: 'hurt', dmg, sx: sourcePos ? sourcePos.x : undefined, sz: sourcePos ? sourcePos.z : undefined,
    });
  }

  sendDamage(enemyId, dmg, headshot) {
    if (this.isHost) return;
    this.relay({ k: 'dmg', id: enemyId, dmg, hs: headshot });
  }

  sendShot(from, to, color) {
    this.relay({
      k: 'shot', fx: +from.x.toFixed(2), fy: +from.y.toFixed(2), fz: +from.z.toFixed(2),
      tx: +to.x.toFixed(2), ty: +to.y.toFixed(2), tz: +to.z.toFixed(2), c: color,
    });
  }

  sendBoom(pos) {
    this.relay({ k: 'boom', x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) });
  }

  // targets for host-side enemy AI: local player + all remotes
  targetList() {
    const out = [];
    const p = this.game.player;
    if (p.alive) out.push({ id: this.myId, position: p.position, isLocal: true });
    for (const [id, r] of this.remotes) {
      if (r.alive) out.push({ id, position: r.position, isLocal: false });
    }
    return out;
  }

  remoteList() {
    return [...this.remotes.values()];
  }

  update(dt) {
    if (!this.active) return;
    const game = this.game;

    for (const r of this.remotes.values()) r.update(dt);
    if (this.replicas) this.replicas.update(dt);

    // broadcast our state
    this.psAcc += dt;
    if (this.psAcc >= 1 / PSTATE_HZ) {
      this.psAcc = 0;
      const p = game.player;
      this.relay({
        k: 'ps',
        x: +p.position.x.toFixed(2), y: +p.position.y.toFixed(2), z: +p.position.z.toFixed(2),
        yaw: +p.yaw.toFixed(2), c: +p.crouchAmount.toFixed(1),
        a: p.alive ? 1 : 0, hp: Math.round(p.hp),
      });
    }

    // versus: self-managed respawn + shared end conditions
    if (this.versus) {
      if (this.pvpRespawn > 0) {
        this.pvpRespawn -= dt;
        if (this.pvpRespawn <= 0) this._respawnLocal();
      }
      const mine = this.scores.get(this.myId);
      this.game.hud.setWave(`${mine ? mine.kills : 0}/15`);
      this.matchTimer -= dt;
      if (this.isHost && !this.overSent) {
        const maxKills = Math.max(0, ...[...this.scores.values()].map((s) => s.kills));
        if (maxKills >= 15 || this.matchTimer <= 0) {
          this.overSent = true;
          this.relay({ k: 'over' });
          this.send({ t: 'end' });
          this._endMatch('over');
        }
      }
      return;
    }

    // host: broadcast enemy snapshots + detect match over
    if (this.isHost) {
      this.snapAcc += dt;
      if (this.snapAcc >= 1 / SNAP_HZ) {
        this.snapAcc = 0;
        this.relay({ k: 'snap', ...this._makeSnapshot() });
      }
      const anyAlive = game.player.alive || [...this.remotes.values()].some((r) => r.alive);
      if (!anyAlive) {
        this._overTimer += dt;
        if (this._overTimer > 1.2 && !this.overSent) {
          this.overSent = true;
          this.relay({ k: 'over' });
          this.send({ t: 'end' });
          this._endMatch('over');
        }
      } else {
        this._overTimer = 0;
      }
    }
  }

  _makeSnapshot() {
    const em = this.game.enemies;
    const e = [];
    for (const en of em.list) {
      e.push([
        en.id, TYPE_IDS.indexOf(en.type.name),
        +en.position.x.toFixed(2), +en.position.z.toFixed(2),
        +(en.group.rotation.y).toFixed(2),
        +(Math.max(0, en.hp) / en.maxHp).toFixed(2),
        en.alive ? 0 : 1,
      ]);
    }
    const p = em.projectiles.map((pr) => [
      +pr.mesh.position.x.toFixed(2), +pr.mesh.position.y.toFixed(2), +pr.mesh.position.z.toFixed(2),
    ]);
    const stateCode = { idle: 0, intermission: 1, spawning: 2, active: 3 }[em.state] || 3;
    return { e, p, w: [em.wave, stateCode, em.spawnQueue.length, +em.timer.toFixed(1)] };
  }

  _endMatch(reason) {
    if (!this.active) return;
    this.active = false;
    this.isHost = false;
    for (const r of this.remotes.values()) r.dispose();
    this.remotes.clear();
    if (this.replicas) {
      this.replicas.reset();
      this.replicas = null;
    }
    document.getElementById('spectate-note').classList.remove('visible');
    this.game.endMatch(reason, this.scores);
  }

  leaveMatch() {
    this.leaveRoom();
    if (this.active) this._endMatch('left');
    this.room = null;
  }
}
