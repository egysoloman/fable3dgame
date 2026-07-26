import * as THREE from 'three';

export const WALL_HEIGHT = 6;

// Deterministic pseudo-random so arena layouts are stable between runs.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGridTexture(bg, line, border) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line;
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  g.strokeStyle = border;
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

// ---------------------------------------------------------------------------
// Map registry. Each map def builds its own geometry via build(world).
// ---------------------------------------------------------------------------
export const MAPS = {
  arena: {
    id: 'arena',
    size: 60,
    fog: [0x05070d, 30, 95],
    bg: 0x05070d,
    hemi: [0x3a5f8a, 0x0c1018, 0.9],
    sun: [0x9fc4ff, 1.4],
    floorColors: ['#0b1220', '#1d3552', '#2ba9c9'],
    accents: [
      [-24, 0x27e8ff, -24], [24, 0xff3bd4, -24], [-24, 0xffb347, 24], [24, 0x27ff8a, 24],
    ],
    playerSpawn: [0, 10],
    domPoints: [[-13, -13], [13, 13], [0, -20]],
    vehicles: [],
    build(w) {
      const rand = mulberry32(1337);
      // four glowing pillars
      const pillarPositions = [[-13, -13], [13, -13], [-13, 13], [13, 13]];
      for (const [x, z] of pillarPositions) {
        w.addBox(x, WALL_HEIGHT / 2, z, 2.4, WALL_HEIGHT, 2.4, w.mats.pillar);
        w.addTrim(x, 2.2, z, 2.55, 0.25, 2.55);
      }
      w.addBox(0, 0.7, 0, 4, 1.4, 4, w.mats.crate); // central cover
      let placed = 0, attempts = 0;
      while (placed < 14 && attempts < 200) {
        attempts++;
        const x = (rand() - 0.5) * (this.size - 10);
        const z = (rand() - 0.5) * (this.size - 10);
        if (Math.hypot(x, z) < 7) continue;
        if (pillarPositions.some(([px, pz]) => Math.hypot(x - px, z - pz) < 4.5)) continue;
        const size = 1.2 + rand() * 1.3;
        const h = 0.9 + rand() * 1.1;
        w.addBox(x, h / 2, z, size, h, size, w.mats.crate);
        placed++;
      }
      w.spawnPoints = w.ringSpawns(8, this.size / 2 - 4);
    },
  },

  battlefield: {
    id: 'battlefield',
    size: 140,
    fog: [0x120c06, 45, 220],
    bg: 0x120c06,
    hemi: [0x8a6a3a, 0x14100a, 0.85],
    sun: [0xffb877, 1.5],
    floorColors: ['#161208', '#2e2410', '#8a6a2a'],
    accents: [
      [-55, 0xffb347, -55], [55, 0xff6a3b, -55], [-55, 0xffcf3b, 55], [55, 0xff8a5a, 55],
      [0, 0xffa04a, 0],
    ],
    playerSpawn: [0, 52],
    domPoints: [[-18, -18], [18, 18], [0, 0]],
    vehicles: [[-6, 46, 0.5], [6, 46, -0.5]], // hoverbike pads: x, z, yaw
    build(w) {
      const rand = mulberry32(4242);
      const S = this.size;

      // central compound: four bunkers with door gaps facing outward
      const bunkers = [[-18, -18, 0], [18, -18, 1], [-18, 18, 2], [18, 18, 3]];
      for (const [bx, bz] of bunkers) {
        // two L walls per bunker leave entrances open
        w.addBox(bx - 3, 1.5, bz, 1, 3, 8, w.mats.bunker);
        w.addBox(bx, 1.5, bz - 3.5, 7, 3, 1, w.mats.bunker);
        w.addBox(bx, 3.2, bz, 8, 0.4, 8, w.mats.bunker); // roof slab (cover from above visuals)
        w.addTrim(bx, 3.5, bz, 8.2, 0.15, 8.2);
      }

      // central hill: climbable stacked platform
      w.addBox(0, 0.6, 0, 14, 1.2, 14, w.mats.dirt);
      w.addBox(0, 1.7, 0, 9, 1.0, 9, w.mats.dirt);
      w.addBox(0, 2.6, 0, 5, 0.8, 5, w.mats.dirt);

      // container rows
      for (let i = 0; i < 3; i++) {
        w.addBox(-45 + i * 7, 1.5, -34, 6, 3, 2.6, w.mats.container);
        w.addBox(38 + i * 7, 1.5, 30, 6, 3, 2.6, w.mats.container);
      }

      // sandbag lines (low, climbable cover)
      const bagLines = [
        [-30, 8, 10, 0], [30, -6, 10, 0], [0, -38, 12, 0], [0, 34, 12, 0],
        [-48, 40, 8, 1], [48, -40, 8, 1],
      ];
      for (const [x, z, len, rot] of bagLines) {
        if (rot) w.addBox(x, 0.55, z, 1.4, 1.1, len, w.mats.sandbag);
        else w.addBox(x, 0.55, z, len, 1.1, 1.4, w.mats.sandbag);
      }

      // watchtowers: pillar + jump-reachable crate stair
      for (const [tx, tz] of [[-52, -8], [52, 8]]) {
        w.addBox(tx, 2.6, tz, 3.4, 5.2, 3.4, w.mats.bunker);
        w.addBox(tx + 3.2, 0.7, tz, 2, 1.4, 2, w.mats.crate);
        w.addBox(tx + 3.2, 1.9, tz + 2.6, 2, 3.8, 2, w.mats.crate);
        w.addTrim(tx, 5.4, tz, 3.6, 0.2, 3.6);
      }

      // scattered rocks/crates
      for (let i = 0; i < 26; i++) {
        const x = (rand() - 0.5) * (S - 16);
        const z = (rand() - 0.5) * (S - 16);
        if (Math.hypot(x, z) < 12) continue;
        if (Math.hypot(x - this.playerSpawn[0], z - this.playerSpawn[1]) < 10) continue;
        const size = 1.3 + rand() * 2.2;
        const h = 0.8 + rand() * 1.6;
        w.addBox(x, h / 2, z, size, h, size, rand() < 0.5 ? w.mats.crate : w.mats.dirt);
      }

      w.spawnPoints = w.ringSpawns(12, S / 2 - 6);
    },
  },

  station: {
    id: 'station',
    size: 80,
    fog: [0x04060c, 22, 90],
    bg: 0x04060c,
    hemi: [0x9fb8d8, 0x0a0e18, 1.0],
    sun: [0xcfe4ff, 1.1],
    floorColors: ['#0a0e18', '#22344a', '#5accdd'],
    accents: [
      [-28, 0x62f0ff, -28], [28, 0xffffff, -28], [-28, 0x62f0ff, 28],
      [28, 0xffffff, 28], [0, 0x8affd0, 0],
    ],
    playerSpawn: [0, 30],
    domPoints: [[-24, 0], [24, 0], [0, -24]],
    vehicles: [],
    gravityMul: 0.55,   // low-grav: float on jumps
    build(w) {
      // central reactor core
      w.addBox(0, 3, 0, 3, 6, 3, w.mats.pillar);
      w.addTrim(0, 1.4, 0, 3.2, 0.3, 3.2);
      w.addTrim(0, 4.6, 0, 3.2, 0.3, 3.2);

      // module walls forming four rooms with door gaps (CQB corridors)
      const H = 4;
      for (const s of [-1, 1]) {
        // long corridor walls with two gaps each
        w.addBox(s * 14, H / 2, -10, 1, H, 20, w.mats.bunker);
        w.addBox(s * 14, H / 2, 15, 1, H, 12, w.mats.bunker);
        w.addBox(-10, H / 2, s * 14, 20, H, 1, w.mats.bunker);
        w.addBox(15, H / 2, s * 14, 12, H, 1, w.mats.bunker);
        w.addTrim(s * 14, H + 0.1, 0, 1.1, 0.15, 30);
        w.addTrim(0, H + 0.1, s * 14, 30, 0.15, 1.1);
      }
      // cargo pods scattered in the rooms
      const spots = [
        [-24, -24, 2.2], [24, -22, 1.8], [-22, 24, 2.0], [25, 25, 2.4],
        [-7, -24, 1.4], [24, 7, 1.4], [-24, 6, 1.6], [8, 24, 1.4],
        [-7, 7, 1.2], [7, -7, 1.2],
      ];
      for (const [x, z, size] of spots) {
        w.addBox(x, size / 2, z, size, size, size, w.mats.container);
      }
      w.spawnPoints = w.ringSpawns(10, this.size / 2 - 5);
    },
  },
};

export class World {
  constructor(scene, mapId = 'arena') {
    this.scene = scene;
    this.root = null;
    this.colliders = [];
    this.colliderMeshes = [];
    this.spawnPoints = [];
    this.vehicleSpawns = [];
    this.map = MAPS.arena;
    this.mats = {};
    this._buildGlobalLights();
    this.load(mapId);
  }

  get size() { return this.map.size; }
  get half() { return this.map.size / 2; }

  _buildGlobalLights() {
    this.hemi = new THREE.HemisphereLight(0x3a5f8a, 0x0c1018, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0x9fc4ff, 1.4);
    this.sun.position.set(18, 30, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
  }

  load(mapId) {
    const map = MAPS[mapId] || MAPS.arena;
    this.map = map;

    // tear down the previous map
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
    }
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.colliders = [];
    this.colliderMeshes = [];
    this.spawnPoints = [];
    this.vehicleSpawns = map.vehicles.map(([x, z, yaw]) => ({ x, z, yaw }));

    // palette
    this.scene.background = new THREE.Color(map.bg);
    this.scene.fog = new THREE.Fog(...map.fog);
    this.hemi.color.setHex(map.hemi[0]);
    this.hemi.groundColor.setHex(map.hemi[1]);
    this.hemi.intensity = map.hemi[2];
    this.sun.color.setHex(map.sun[0]);
    this.sun.intensity = map.sun[1];
    const s = map.size / 2 + 8;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.updateProjectionMatrix();

    // shared materials (fresh per load so disposal is safe)
    this.mats = {
      crate: new THREE.MeshStandardMaterial({ color: 0x33465e, roughness: 0.8, metalness: 0.3 }),
      pillar: new THREE.MeshStandardMaterial({ color: 0x2a3a52, roughness: 0.6, metalness: 0.5 }),
      bunker: new THREE.MeshStandardMaterial({ color: 0x4a4234, roughness: 0.85, metalness: 0.2 }),
      container: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.7, metalness: 0.4 }),
      sandbag: new THREE.MeshStandardMaterial({ color: 0x5a5038, roughness: 1, metalness: 0 }),
      dirt: new THREE.MeshStandardMaterial({ color: 0x3a2f1c, roughness: 1, metalness: 0 }),
      trim: new THREE.MeshStandardMaterial({
        color: 0x27e8ff, emissive: 0x27e8ff, emissiveIntensity: 1.6, roughness: 0.4,
      }),
    };
    if (map.id === 'battlefield') {
      this.mats.trim.color.setHex(0xffb347);
      this.mats.trim.emissive.setHex(0xffb347);
    }

    this._buildFloor();
    this._buildWalls();
    this._buildAccents();
    map.build(this);
  }

  ringSpawns(n, radius) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return pts;
  }

  addBox(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    this.colliders.push({ min: box.min.clone(), max: box.max.clone() });
    this.colliderMeshes.push(mesh);
    return mesh;
  }

  addTrim(x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mats.trim);
    mesh.position.set(x, y, z);
    this.root.add(mesh);
    return mesh;
  }

  _buildFloor() {
    const map = this.map;
    const tex = makeGridTexture(...map.floorColors);
    tex.repeat.set(map.size / 4, map.size / 4);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.25 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.size, map.size), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);
    this.colliderMeshes.push(floor);

    const outerMat = new THREE.MeshStandardMaterial({ color: map.bg, roughness: 1 });
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    this.root.add(outer);
  }

  _buildWalls() {
    const half = this.half;
    const size = this.map.size;
    const panelTex = makePanelTexture();
    const walls = [
      { pos: [0, WALL_HEIGHT / 2, -half], size: [size + 2, WALL_HEIGHT, 1] },
      { pos: [0, WALL_HEIGHT / 2, half], size: [size + 2, WALL_HEIGHT, 1] },
      { pos: [-half, WALL_HEIGHT / 2, 0], size: [1, WALL_HEIGHT, size + 2] },
      { pos: [half, WALL_HEIGHT / 2, 0], size: [1, WALL_HEIGHT, size + 2] },
    ];
    for (const wl of walls) {
      const tex = panelTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.round(size / 4), 2);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, color: 0x9fb4cc, roughness: 0.7, metalness: 0.4,
      });
      if (this.map.id === 'battlefield') mat.color.setHex(0xa89878);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...wl.size), mat);
      mesh.position.set(...wl.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ min: box.min.clone(), max: box.max.clone() });
      this.colliderMeshes.push(mesh);

      const trimSize = wl.size[0] > wl.size[2]
        ? [wl.size[0], 0.18, wl.size[2] + 0.1]
        : [wl.size[0] + 0.1, 0.18, wl.size[2]];
      this.addTrim(wl.pos[0], WALL_HEIGHT + 0.09, wl.pos[2], ...trimSize);
    }
  }

  _buildAccents() {
    for (const [x, color, z] of this.map.accents) {
      const p = new THREE.PointLight(color, 60, 44, 1.8);
      p.position.set(x, 5, z);
      this.root.add(p);
    }
  }
}
