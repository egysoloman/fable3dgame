import * as THREE from 'three';

export const ARENA_SIZE = 60;      // playable square, walls at ±ARENA_SIZE/2
export const WALL_HEIGHT = 6;

// Deterministic pseudo-random so the arena layout is stable between runs.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1220';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#1d3552';
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  g.strokeStyle = '#2ba9c9';
  g.lineWidth = 3;
  g.strokeRect(1, 1, 254, 254);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePanelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#131a2a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#0a0f1a';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 124, 124);
  g.fillStyle = '#1b2436';
  g.fillRect(14, 14, 100, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];       // { min: Vector3, max: Vector3 } for movement physics
    this.colliderMeshes = [];  // meshes bullets can hit
    this.spawnPoints = [];

    this._buildLights();
    this._buildFloor();
    this._buildWalls();
    this._buildObstacles();
    this._buildSpawnPoints();
  }

  _buildLights() {
    this.scene.background = new THREE.Color(0x05070d);
    this.scene.fog = new THREE.Fog(0x05070d, 30, 95);

    const hemi = new THREE.HemisphereLight(0x3a5f8a, 0x0c1018, 0.9);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0x9fc4ff, 1.4);
    moon.position.set(18, 30, 12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const s = ARENA_SIZE / 2 + 6;
    moon.shadow.camera.left = -s;
    moon.shadow.camera.right = s;
    moon.shadow.camera.top = s;
    moon.shadow.camera.bottom = -s;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 80;
    moon.shadow.bias = -0.0005;
    this.scene.add(moon);

    // Neon corner accents
    const accents = [
      [-24, 0x27e8ff, -24], [24, 0xff3bd4, -24], [-24, 0xffb347, 24], [24, 0x27ff8a, 24],
    ];
    for (const [x, color, z] of accents) {
      const p = new THREE.PointLight(color, 60, 40, 1.8);
      p.position.set(x, 5, z);
      this.scene.add(p);
    }
  }

  _buildFloor() {
    const tex = makeGridTexture();
    tex.repeat.set(ARENA_SIZE / 4, ARENA_SIZE / 4);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.25 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.colliderMeshes.push(floor);

    // Ground outside the arena so the horizon isn't a void
    const outerMat = new THREE.MeshStandardMaterial({ color: 0x060a12, roughness: 1 });
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    this.scene.add(outer);
  }

  _addBoxCollider(mesh) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    this.colliders.push({ min: box.min.clone(), max: box.max.clone() });
    this.colliderMeshes.push(mesh);
  }

  _buildWalls() {
    const half = ARENA_SIZE / 2;
    const panelTex = makePanelTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: panelTex, color: 0x9fb4cc, roughness: 0.7, metalness: 0.4,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x27e8ff, emissive: 0x27e8ff, emissiveIntensity: 1.6, roughness: 0.4,
    });

    const walls = [
      { pos: [0, WALL_HEIGHT / 2, -half], size: [ARENA_SIZE + 2, WALL_HEIGHT, 1], repeat: [15, 2] },
      { pos: [0, WALL_HEIGHT / 2, half],  size: [ARENA_SIZE + 2, WALL_HEIGHT, 1], repeat: [15, 2] },
      { pos: [-half, WALL_HEIGHT / 2, 0], size: [1, WALL_HEIGHT, ARENA_SIZE + 2], repeat: [15, 2] },
      { pos: [half, WALL_HEIGHT / 2, 0],  size: [1, WALL_HEIGHT, ARENA_SIZE + 2], repeat: [15, 2] },
    ];
    for (const w of walls) {
      const tex = panelTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(w.repeat[0], w.repeat[1]);
      const mat = wallMat.clone();
      mat.map = tex;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), mat);
      mesh.position.set(...w.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._addBoxCollider(mesh);

      // glowing trim strip along the top of each wall
      const trimSize = w.size[0] > w.size[2]
        ? [w.size[0], 0.18, w.size[2] + 0.1]
        : [w.size[0] + 0.1, 0.18, w.size[2]];
      const trim = new THREE.Mesh(new THREE.BoxGeometry(...trimSize), trimMat);
      trim.position.set(w.pos[0], WALL_HEIGHT + 0.09, w.pos[2]);
      this.scene.add(trim);
    }
  }

  _buildObstacles() {
    const rand = mulberry32(1337);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x33465e, roughness: 0.8, metalness: 0.3 });
    const crateEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x27e8ff, emissive: 0x27e8ff, emissiveIntensity: 0.8, roughness: 0.5,
    });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a3a52, roughness: 0.6, metalness: 0.5 });

    // Four large pillars with glowing bands
    const pillarPositions = [[-13, -13], [13, -13], [-13, 13], [13, 13]];
    for (const [x, z] of pillarPositions) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, WALL_HEIGHT, 2.4), pillarMat);
      pillar.position.set(x, WALL_HEIGHT / 2, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
      this._addBoxCollider(pillar);

      const band = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.25, 2.55), crateEdgeMat);
      band.position.set(x, 2.2, z);
      this.scene.add(band);
    }

    // Central cover block
    const center = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 4), crateMat);
    center.position.set(0, 0.7, 0);
    center.castShadow = true;
    center.receiveShadow = true;
    this.scene.add(center);
    this._addBoxCollider(center);

    // Scattered crates (jump-on-able); keep the middle clear for the player start
    let placed = 0;
    let attempts = 0;
    while (placed < 14 && attempts < 200) {
      attempts++;
      const x = (rand() - 0.5) * (ARENA_SIZE - 10);
      const z = (rand() - 0.5) * (ARENA_SIZE - 10);
      if (Math.hypot(x, z) < 7) continue;                        // player start area
      if (pillarPositions.some(([px, pz]) => Math.hypot(x - px, z - pz) < 4.5)) continue;
      const size = 1.2 + rand() * 1.3;
      const h = 0.9 + rand() * 1.1;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), crateMat);
      crate.position.set(x, h / 2, z);
      crate.rotation.y = 0; // axis-aligned so AABB colliders are exact
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
      this._addBoxCollider(crate);
      placed++;
    }
  }

  _buildSpawnPoints() {
    const m = ARENA_SIZE / 2 - 4;
    this.spawnPoints = [
      new THREE.Vector3(-m, 0, -m), new THREE.Vector3(0, 0, -m), new THREE.Vector3(m, 0, -m),
      new THREE.Vector3(-m, 0, 0), new THREE.Vector3(m, 0, 0),
      new THREE.Vector3(-m, 0, m), new THREE.Vector3(0, 0, m), new THREE.Vector3(m, 0, m),
    ];
  }
}
