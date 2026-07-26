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

// Night-tower facade: dark curtain wall with a grid of randomly lit windows.
function makeWindowTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  const rand = mulberry32(seed);
  g.fillStyle = '#0a101e';
  g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 8) {
    for (let x = 4; x < 60; x += 8) {
      const lit = rand() < 0.32;
      g.fillStyle = lit
        ? (rand() < 0.8 ? '#ffd890' : '#9fd8ff')
        : '#151d30';
      g.globalAlpha = lit ? 0.55 + rand() * 0.45 : 1;
      g.fillRect(x, y, 5, 5);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Procedural 360° panoramic skyboxes: each painter fills an equirectangular
// canvas that wraps a BackSide sphere. Painted once per map load.
// ---------------------------------------------------------------------------
function skyGradient(g, w, h, stops) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function paintSun(g, x, y, r, core, glow) {
  const halo = g.createRadialGradient(x, y, r * 0.3, x, y, r * 4);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  g.fillStyle = core;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function paintClouds(g, w, band, n, rand, alpha = 0.85) {
  for (let i = 0; i < n; i++) {
    const cx = rand() * w;
    const cy = band[0] + rand() * (band[1] - band[0]);
    const cw = 40 + rand() * 90;
    const ch = 9 + rand() * 15;
    g.fillStyle = `rgba(255,255,255,${(0.25 + rand() * 0.5) * alpha})`;
    for (let b = 0; b < 5; b++) {
      g.beginPath();
      g.ellipse(cx + (rand() - 0.5) * cw, cy + (rand() - 0.5) * ch,
        cw * (0.25 + rand() * 0.3), ch * (0.5 + rand() * 0.5), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

const SKY_PAINTERS = {
  // deep space: starfield, nebulae, and Earth hanging near the horizon
  space(g, w, h) {
    const rand = mulberry32(31337);
    skyGradient(g, w, h, [[0, '#01010a'], [0.5, '#050818'], [1, '#01010a']]);
    for (let i = 0; i < 4; i++) { // faint nebulae
      const nx = rand() * w, ny = rand() * h * 0.7;
      const nr = 90 + rand() * 160;
      const neb = g.createRadialGradient(nx, ny, 0, nx, ny, nr);
      const hue = rand() < 0.5 ? '80,60,160' : '40,110,150';
      neb.addColorStop(0, `rgba(${hue},0.16)`);
      neb.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = neb;
      g.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
    }
    for (let i = 0; i < 900; i++) { // stars
      const sx = rand() * w, sy = rand() * h;
      const sr = rand() < 0.94 ? rand() * 1.1 : 1.2 + rand() * 1.4;
      g.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.65})`;
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
    }
    // Earth: lit blue disc with cloud swirls and an atmosphere rim
    const ex = w * 0.68, ey = h * 0.46, er = h * 0.20;
    const atm = g.createRadialGradient(ex, ey, er * 0.9, ex, ey, er * 1.25);
    atm.addColorStop(0, 'rgba(90,170,255,0.5)');
    atm.addColorStop(1, 'rgba(90,170,255,0)');
    g.fillStyle = atm;
    g.fillRect(ex - er * 1.4, ey - er * 1.4, er * 2.8, er * 2.8);
    const earth = g.createRadialGradient(
      ex - er * 0.4, ey - er * 0.35, er * 0.1, ex, ey, er);
    earth.addColorStop(0, '#6ab8ff');
    earth.addColorStop(0.55, '#1e5fb0');
    earth.addColorStop(1, '#06182e');
    g.fillStyle = earth;
    g.beginPath();
    g.arc(ex, ey, er, 0, Math.PI * 2);
    g.fill();
    g.save(); // clouds + landmasses clipped to the disc
    g.beginPath();
    g.arc(ex, ey, er, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(70,160,90,0.55)';
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.ellipse(ex + (rand() - 0.5) * er * 1.6, ey + (rand() - 0.5) * er * 1.6,
        er * (0.12 + rand() * 0.2), er * (0.07 + rand() * 0.12),
        rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.ellipse(ex + (rand() - 0.5) * er * 1.8, ey + (rand() - 0.5) * er * 1.8,
        er * (0.2 + rand() * 0.25), er * (0.04 + rand() * 0.05),
        rand() * Math.PI * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  },

  // open ocean: blue sky, cumulus, sun, and sea below the horizon
  ocean(g, w, h) {
    const rand = mulberry32(4444);
    skyGradient(g, w, h, [
      [0, '#1a4f9e'], [0.35, '#4f8ed0'], [0.5, '#bcd8ea'],
      [0.505, '#0e3a5c'], [0.72, '#0a2a44'], [1, '#051826'],
    ]);
    paintSun(g, w * 0.3, h * 0.24, 26, '#fff8e0', 'rgba(255,244,200,0.55)');
    paintClouds(g, w, [h * 0.18, h * 0.42], 16, rand);
    // sea sparkle streaks + a crisp horizon line
    g.fillStyle = 'rgba(180,220,255,0.14)';
    for (let i = 0; i < 60; i++) {
      const sy = h * (0.52 + rand() * 0.4);
      g.fillRect(rand() * w, sy, 30 + rand() * 90, 1.5);
    }
    g.fillStyle = 'rgba(220,240,255,0.5)';
    g.fillRect(0, h * 0.5 - 1, w, 2);
  },

  // desert noon: clear sky, blazing sun, hazy horizon, distant dunes
  desert(g, w, h) {
    const rand = mulberry32(9090);
    skyGradient(g, w, h, [
      [0, '#3f7fd0'], [0.3, '#7fb2e2'], [0.47, '#e8ddc2'], [0.5, '#d8c49a'],
      [0.53, '#c2a878'], [1, '#8a6f45'],
    ]);
    paintSun(g, w * 0.62, h * 0.18, 30, '#fffbe8', 'rgba(255,246,214,0.6)');
    // horizon haze band
    const haze = g.createLinearGradient(0, h * 0.38, 0, h * 0.52);
    haze.addColorStop(0, 'rgba(240,228,196,0)');
    haze.addColorStop(1, 'rgba(240,228,196,0.85)');
    g.fillStyle = haze;
    g.fillRect(0, h * 0.38, w, h * 0.14);
    // far dune silhouettes
    for (const [band, tone] of [[0.485, 'rgba(170,140,92,0.7)'], [0.495, 'rgba(150,120,76,0.8)']]) {
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(0, h * 0.5);
      for (let x = 0; x <= w; x += 8) {
        g.lineTo(x, h * (band + Math.sin(x * 0.011 + band * 90) * 0.006 +
          Math.sin(x * 0.031) * 0.003));
      }
      g.lineTo(w, h * 0.52);
      g.lineTo(0, h * 0.52);
      g.fill();
    }
    paintClouds(g, w, [h * 0.1, h * 0.24], 5, rand, 0.4);
  },

  // skyscraper night: a starry sky — the skyline itself is real low-poly
  // tower models placed around the roof (see the rooftop map build)
  city(g, w, h) {
    const rand = mulberry32(6060);
    skyGradient(g, w, h, [
      [0, '#04060f'], [0.3, '#0a1024'], [0.46, '#141d38'], [0.5, '#1c2440'],
      [0.56, '#12182c'], [1, '#080c18'],
    ]);
    for (let i = 0; i < 800; i++) { // dense starfield
      const sx = rand() * w, sy = rand() * h * 0.52;
      const sr = rand() < 0.93 ? rand() * 1.1 : 1.2 + rand() * 1.3;
      g.fillStyle = `rgba(255,250,255,${0.3 + rand() * 0.7})`;
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
    }
    paintSun(g, w * 0.24, h * 0.2, 15, '#e8f0ff', 'rgba(190,210,255,0.35)'); // moon
    // city glow along the horizon
    const glow = g.createLinearGradient(0, h * 0.4, 0, h * 0.52);
    glow.addColorStop(0, 'rgba(90,110,180,0)');
    glow.addColorStop(1, 'rgba(120,140,210,0.35)');
    g.fillStyle = glow;
    g.fillRect(0, h * 0.4, w, h * 0.12);
    // faint cloud sea below the horizon
    const sea = g.createLinearGradient(0, h * 0.52, 0, h * 0.7);
    sea.addColorStop(0, 'rgba(90,102,128,0.0)');
    sea.addColorStop(0.5, 'rgba(88,98,124,0.85)');
    sea.addColorStop(1, 'rgba(58,66,88,1)');
    g.fillStyle = sea;
    g.fillRect(0, h * 0.52, w, h * 0.48);
    paintClouds(g, w, [h * 0.54, h * 0.66], 18, rand, 0.35);
  },

  // battlefield dusk: burning gradient, low sun, streak clouds
  dusk(g, w, h) {
    const rand = mulberry32(2222);
    skyGradient(g, w, h, [
      [0, '#241a3e'], [0.3, '#63315a'], [0.44, '#c25a30'], [0.5, '#f0a04a'],
      [0.52, '#3a2413'], [1, '#120c06'],
    ]);
    paintSun(g, w * 0.5, h * 0.465, 22, '#ffe8b0', 'rgba(255,170,90,0.6)');
    // wind-sheared cloud streaks
    for (let i = 0; i < 26; i++) {
      const cy = h * (0.16 + rand() * 0.3);
      g.fillStyle = `rgba(40,22,48,${0.25 + rand() * 0.35})`;
      g.fillRect(rand() * w, cy, 80 + rand() * 220, 3 + rand() * 6);
    }
    for (let i = 0; i < 120; i++) { // early stars up high
      g.fillStyle = `rgba(255,240,255,${0.2 + rand() * 0.4})`;
      g.fillRect(rand() * w, rand() * h * 0.16, 1.4, 1.4);
    }
  },
};

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
    sky: 'dusk',
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
    // vehicle pads: x, z, yaw, type ('bike' default)
    vehicles: [[-6, 46, 0.5], [6, 46, -0.5], [-16, 40, 0, 'tank'], [16, 40, 3.14, 'heli']],
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
    sky: 'space',
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

  carrier: {
    id: 'carrier',
    size: 120,
    sky: 'ocean',
    edge: 'fall',        // open deck: falling off means the ocean
    outerY: -16,
    outerColor: 0x0a2a44,
    fog: [0x0a1420, 40, 190],
    bg: 0x0a1420,
    hemi: [0x9fc4e0, 0x2a3e50, 1.25],
    sun: [0xd8e8ff, 1.35],
    floorColors: ['#1c2228', '#2e3a44', '#8a97a8'],
    accents: [
      [-18, 0x62f0ff, -30], [18, 0xffcf3b, -30], [-18, 0xffcf3b, 30], [18, 0x62f0ff, 30],
    ],
    playerSpawn: [0, 46],
    domPoints: [[0, -34], [-20, 10], [20, 18]],
    vehicles: [[-8, 38, 0.4], [8, 38, -0.4], [10, 32, 3.14, 'tank'],
      [-9, -42, 0, 'heli'], [9, -42, 0, 'heli']],
    // warship hull: long deck, tapered bow forward (-z), chamfered stern
    footprint(x, z) {
      if (z < -58 || z > 58) return false;
      let hw = 30;
      if (z < -20) hw = 30 * (1 - (-20 - z) / 40);
      else if (z > 46) hw = 30 - (z - 46) * (10 / 12);
      return Math.abs(x) <= hw;
    },
    floorOutline: [[-30, 46], [-30, -20], [0, -58], [30, -20], [30, 46],
      [20, 58], [-20, 58]],
    build(w) {
      // bridge tower: a tall, climbable multi-level command island with
      // observation decks that overlook the whole flight deck
      w.addBox(22, 2.5, -8, 10, 5, 8, w.mats.bunker);      // base block
      w.addBox(22, 6.2, -8, 7, 2.4, 6, w.mats.bunker);     // bridge level
      w.addBox(24, 8.6, -8, 4, 2.4, 4, w.mats.pillar);     // control level
      w.addBox(24, 11.0, -8, 3, 2.4, 3, w.mats.pillar);    // observation top
      w.addTrim(22, 5.1, -8, 10.2, 0.2, 8.2);
      w.addTrim(22, 7.5, -8, 7.2, 0.2, 6.2);
      w.addTrim(24, 9.9, -8, 4.2, 0.2, 4.2);
      w.addTrim(24, 12.3, -8, 3.2, 0.2, 3.2);
      // radar mast + antenna arrays
      w.addBox(24, 14.0, -8, 0.4, 3.6, 0.4, w.mats.pillar);
      w.addTrim(24, 15.9, -8, 2.6, 0.12, 0.3);
      w.addTrim(24, 15.2, -8, 0.3, 0.12, 2.2);
      // crate stairs winding up the island, one hop per landing
      w.addBox(15.5, 0.7, -8, 3, 1.4, 3, w.mats.container);
      w.addBox(18.5, 1.9, -8, 3, 3.8, 3, w.mats.container);
      w.addBox(19, 5.7, -10.4, 2, 1.4, 2, w.mats.container);
      w.addBox(20, 8.1, -6.4, 2, 1.4, 2, w.mats.container);
      w.addBox(25.2, 10.5, -6.2, 1.6, 1.4, 1.6, w.mats.container);

      // parked jets on the bow: fuselage + wing blocks, good hard cover
      const jets = [[-15, -28, 0], [-1, -36, 1], [13, -26, 0]];
      for (const [jx, jz] of jets) {
        w.addBox(jx, 1.1, jz, 2.2, 2.2, 9, w.mats.container);
        w.addBox(jx, 0.8, jz + 1, 8, 0.5, 3, w.mats.bunker);
      }

      // hangar bay: roofed section with support pillars (CQB)
      w.addBox(-14, 3.4, 14, 24, 0.6, 22, w.mats.bunker);   // roof slab
      for (const [px, pz] of [[-24, 5], [-4, 5], [-24, 23], [-4, 23]]) {
        w.addBox(px, 1.55, pz, 1.2, 3.1, 1.2, w.mats.pillar);
      }
      w.addBox(-14, 1.5, 25, 24, 3, 1, w.mats.bunker);      // hangar back wall
      for (let i = 0; i < 4; i++) {
        w.addBox(-22 + i * 6, 1, 12, 2.4, 2, 2.4, w.mats.container);
      }
      w.addTrim(-14, 3.8, 14, 24.2, 0.15, 22.2);

      // catapult ramps & deck clutter
      w.addBox(8, 0.55, -14, 12, 1.1, 1.6, w.mats.sandbag);
      w.addBox(-22, 0.55, -4, 1.6, 1.1, 12, w.mats.sandbag);
      w.addBox(20, 0.9, 34, 3, 1.8, 3, w.mats.container);
      w.addBox(-16, 0.9, 36, 3, 1.8, 3, w.mats.container);
      w.addBox(24, 0.9, 30, 3, 1.8, 3, w.mats.container);

      w.spawnPoints = [
        [-12, -24], [12, -24], [0, -40], [-16, 0], [16, 0], [-26, 20],
        [26, 20], [-12, 40], [12, 40], [0, 52], [-22, 34], [26, -2],
      ].map(([sx, sz]) => new THREE.Vector3(sx, 0, sz));
    },
  },

  desert: {
    id: 'desert',
    size: 150,
    sky: 'desert',
    edge: 'oob',         // no walls: leaving the zone starts a countdown
    fog: [0xd8c49a, 50, 240],
    bg: 0xd8c49a,
    hemi: [0xffe8c0, 0xa8895a, 1.45],
    sun: [0xfff2d0, 1.7],
    floorColors: ['#8a6f45', '#a8895a', '#c8a868'],
    accents: [
      [-55, 0xffcf3b, -55], [55, 0xff8a3b, 55], [0, 0xffe8a0, 0],
    ],
    playerSpawn: [0, 58],
    domPoints: [[-30, 10], [30, -8], [0, -40]],
    vehicles: [[-8, 50, 0.4], [8, 50, -0.4], [-18, 44, 0, 'tank'], [18, 44, 3.14, 'heli']],
    build(w) {
      const rand = mulberry32(7777);
      // dune plateaus: broad, low, climbable stacked mounds
      const dunes = [[-34, -30, 26], [30, 26, 30], [38, -38, 22], [-42, 30, 20]];
      for (const [dx, dz, dw] of dunes) {
        w.addBox(dx, 0.55, dz, dw, 1.1, dw * 0.8, w.mats.sand);
        w.addBox(dx, 1.5, dz, dw * 0.62, 0.9, dw * 0.5, w.mats.sand);
        w.addBox(dx, 2.3, dz, dw * 0.34, 0.7, dw * 0.28, w.mats.sand);
      }
      // rock formations: clustered angular spires, hard cover
      const rocks = [[-8, -20], [16, 6], [-26, 14], [8, -46], [46, 4]];
      for (const [rx, rz] of rocks) {
        const n = 3 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) {
          const ox = (rand() - 0.5) * 6, oz = (rand() - 0.5) * 6;
          const hgt = 2 + rand() * 4.5;
          const s = 1.2 + rand() * 2;
          w.addBox(rx + ox, hgt / 2, rz + oz, s, hgt, s * (0.7 + rand() * 0.6), w.mats.rock);
        }
      }
      // ruins: broken walls, a colonnade, and an arch gate
      w.addBox(-14, 1.6, 34, 12, 3.2, 1, w.mats.ruin);
      w.addBox(-8.5, 0.9, 30, 1, 1.8, 8, w.mats.ruin);
      w.addBox(12, 1.1, 30, 8, 2.2, 1, w.mats.ruin);
      for (let i = 0; i < 4; i++) {
        w.addBox(-2 + i * 4, 1.9, -12, 1.1, 3.8, 1.1, w.mats.ruin);
      }
      w.addBox(4, 4.05, -12, 14, 0.5, 1.3, w.mats.ruin);
      w.addBox(-30, 2.2, -8, 1.2, 4.4, 1.2, w.mats.ruin);
      w.addBox(-24, 2.2, -8, 1.2, 4.4, 1.2, w.mats.ruin);
      w.addBox(-27, 4.7, -8, 8, 0.6, 1.4, w.mats.ruin);
      // scattered rubble, clear of spawn and vehicle pads
      for (let i = 0; i < 18; i++) {
        const x = (rand() - 0.5) * (this.size - 18);
        const z = (rand() - 0.5) * (this.size - 18);
        if (Math.hypot(x - this.playerSpawn[0], z - this.playerSpawn[1]) < 12) continue;
        if (Math.hypot(x, z) < 10) continue;
        if (this.vehicles.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < 6)) continue;
        const s2 = 1 + rand() * 1.8;
        const h2 = 0.6 + rand() * 1.2;
        w.addBox(x, h2 / 2, z, s2, h2, s2, rand() < 0.5 ? w.mats.ruin : w.mats.rock);
      }
      w.spawnPoints = w.ringSpawns(12, this.size / 2 - 6);
    },
  },

  rooftop: {
    id: 'rooftop',
    size: 100,
    sky: 'city',
    edge: 'fall',        // no railings up here
    outerY: -60,
    outerColor: 0x3e4658, // the moonlit cloud sea far below
    fog: [0x0a0e1c, 48, 240],
    bg: 0x0a0e1c,
    hemi: [0x4a5f8a, 0x0c1018, 1.0],
    sun: [0xbfd4ff, 1.0],
    floorColors: ['#1a1f2c', '#2c3446', '#5a6a8a'],
    accents: [
      [-34, 0xffcf3b, -34], [34, 0x27e8ff, -34], [-34, 0xff3bd4, 34], [34, 0xffb347, 34],
    ],
    playerSpawn: [0, 38],
    domPoints: [[-30, -20], [30, 10], [0, 26]],
    vehicles: [[-30, 30, 0.5], [30, 30, -0.5], [0, -36, 3.14, 'heli']],
    build(w) {
      const rand = mulberry32(8181);
      // penthouse block: glass-walled rooms under a walkable roof deck.
      // Upper layer = the roof slab; lower layer = the terrace around it.
      const PH = 4.2;                                     // penthouse wall height
      w.addBox(0, PH / 2, -8.5, 36, PH, 1, w.mats.pillar);   // north wall
      w.addBox(0, PH / 2, 8.5, 36, PH, 1, w.mats.pillar);    // south wall
      w.addBox(-17.5, PH / 2, -3, 1, PH, 12, w.mats.pillar); // west wall (door gap south)
      w.addBox(17.5, PH / 2, 3, 1, PH, 12, w.mats.pillar);   // east wall (door gap north)
      w.addBox(-6, PH / 2, 0, 1, PH, 10, w.mats.bunker);     // interior dividers
      w.addBox(7, PH / 2, -2, 8, PH, 1, w.mats.bunker);
      w.addBox(0, PH + 0.25, 0, 36, 0.5, 18, w.mats.bunker); // roof deck slab
      w.addTrim(0, PH + 0.55, 0, 36.2, 0.15, 18.2);
      // crate stairs up to the roof deck at two corners
      w.addBox(-21, 0.6, 11, 2.4, 1.2, 2.4, w.mats.crate);
      w.addBox(-19, 1.8, 13.5, 2.4, 1.2, 2.4, w.mats.crate);
      w.addBox(-16, 3.0, 11.5, 2.4, 1.2, 2.4, w.mats.crate);
      w.addBox(21, 0.6, -11, 2.4, 1.2, 2.4, w.mats.crate);
      w.addBox(19, 1.8, -13.5, 2.4, 1.2, 2.4, w.mats.crate);
      w.addBox(16, 3.0, -11.5, 2.4, 1.2, 2.4, w.mats.crate);
      // rooftop furniture on the slab: antenna masts + HVAC units
      w.addBox(-12, PH + 0.5 + 3.2, -4, 0.5, 6.4, 0.5, w.mats.pillar);
      w.addTrim(-12, PH + 7.4, -4, 1.8, 0.1, 0.25);
      w.addBox(12, PH + 0.5 + 2.4, 4, 0.5, 4.8, 0.5, w.mats.pillar);
      w.addBox(-2, PH + 0.5 + 0.8, 4.5, 3, 1.6, 2.2, w.mats.container);
      w.addBox(6, PH + 0.5 + 0.8, -4.5, 3, 1.6, 2.2, w.mats.container);
      // terrace props: elevator housing, HVAC, dishes, glass deck rail
      w.addBox(-28, 2.2, -12, 6, 4.4, 5, w.mats.bunker);     // elevator shaft
      w.addBox(28, 1.2, 16, 4, 2.4, 3, w.mats.container);    // HVAC
      w.addBox(-14, 1.2, 24, 3, 2.4, 3, w.mats.container);
      w.addBox(24, 0.9, -22, 2.6, 1.8, 2.6, w.mats.crate);   // dish bases
      w.addBox(-30, 0.9, 14, 2.6, 1.8, 2.6, w.mats.crate);
      w.addTrim(0, 0.5, -36, 10, 0.1, 10.2);                 // helipad marking
      // scattered crates for terrace cover
      for (let i = 0; i < 10; i++) {
        const x = (rand() - 0.5) * (this.size - 16);
        const z = (rand() - 0.5) * (this.size - 16);
        if (Math.abs(x) < 22 && Math.abs(z) < 13) continue;  // keep penthouse clear
        if (Math.hypot(x - 0, z - 38) < 8) continue;
        if (Math.hypot(x - 0, z + 36) < 7) continue;
        if (this.vehicles.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < 5)) continue;
        const s = 1.4 + rand() * 1.6;
        w.addBox(x, 0.7, z, s, 1.4, s, w.mats.crate);
      }
      // the surrounding city: rings of low-poly towers with lit windows,
      // rising out of the cloud sea — real models, unreachable across the drop
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + rand() * 0.18;
        const radius = 72 + rand() * 58;
        const bw = 9 + rand() * 12;
        const top = -12 + rand() * 34;              // relative to the roof
        const bh = top + 62;                        // base hidden in the clouds
        const tex = makeWindowTexture(8181 + i);
        tex.repeat.set(Math.max(1, Math.round(bw / 6)), Math.max(2, Math.round(bh / 12)));
        const mat = new THREE.MeshStandardMaterial({
          color: 0xcfd8ea, map: tex, roughness: 0.85, metalness: 0.15 });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, bw * (0.7 + rand() * 0.6)), mat);
        mesh.position.set(Math.cos(a) * radius, top - bh / 2, Math.sin(a) * radius);
        mesh.rotation.y = rand() * Math.PI;
        w.root.add(mesh);
        if (rand() < 0.3) {  // a few rooftop beacons
          const beacon = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.6, 0.5),
            new THREE.MeshStandardMaterial({
              color: 0xff4d4d, emissive: 0xff4d4d, emissiveIntensity: 1.5 }));
          beacon.position.set(mesh.position.x, top + 0.8, mesh.position.z);
          w.root.add(beacon);
        }
      }
      w.spawnPoints = w.ringSpawns(12, this.size / 2 - 6);
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

  // On open-edge 'fall' maps the ground only exists inside the footprint;
  // step past it and there is nothing below you.
  groundAt(x, z) {
    if (this.map.edge !== 'fall') return true;
    if (this.map.footprint) return this.map.footprint(x, z);
    return Math.abs(x) <= this.half && Math.abs(z) <= this.half;
  }

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
    this.vehicleSpawns = map.vehicles.map(
      ([x, z, yaw, type]) => ({ x, z, yaw, type: type || 'bike' }));

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
      sand: new THREE.MeshStandardMaterial({ color: 0xb08d58, roughness: 1, metalness: 0 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x7a5f46, roughness: 0.95, metalness: 0.05 }),
      ruin: new THREE.MeshStandardMaterial({ color: 0xa89272, roughness: 0.9, metalness: 0 }),
      trim: new THREE.MeshStandardMaterial({
        color: 0x27e8ff, emissive: 0x27e8ff, emissiveIntensity: 1.6, roughness: 0.4,
      }),
    };
    if (map.id === 'battlefield' || map.id === 'desert') {
      this.mats.trim.color.setHex(0xffb347);
      this.mats.trim.emissive.setHex(0xffb347);
    }

    this._buildSky(map);
    this._buildFloor();
    this._buildWalls();
    this._buildAccents();
    map.build(this);
  }

  // 360° panoramic sky: an equirect canvas texture on an inside-out sphere
  _buildSky(map) {
    this.skyDome = null;
    const painter = SKY_PAINTERS[map.sky];
    if (!painter) return;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    painter(c.getContext('2d'), c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.SphereGeometry(Math.max(map.size * 1.05, 90), 48, 24);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, side: THREE.BackSide, fog: false, depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(geo, mat);
    this.skyDome.renderOrder = -1;
    this.root.add(this.skyDome);
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
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.25 });
    let floor;
    if (map.floorOutline) {
      // non-square deck (e.g. the carrier hull): shape polygon in the XZ plane
      const shape = new THREE.Shape();
      map.floorOutline.forEach(([px, pz], i) => {
        if (i === 0) shape.moveTo(px, -pz);
        else shape.lineTo(px, -pz);
      });
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
      mat.side = THREE.DoubleSide; // winding-proof
      floor = new THREE.Mesh(geo, mat);
    } else {
      tex.repeat.set(map.size / 4, map.size / 4);
      floor = new THREE.Mesh(new THREE.PlaneGeometry(map.size, map.size), mat);
      floor.rotation.x = -Math.PI / 2;
    }
    floor.receiveShadow = true;
    this.root.add(floor);
    this.colliderMeshes.push(floor);

    // open-edge maps drop the surroundings far below (ocean, cloud sea)
    const outerMat = new THREE.MeshStandardMaterial({
      color: map.outerColor !== undefined ? map.outerColor : map.bg, roughness: 1 });
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = map.outerY !== undefined ? map.outerY : -0.02;
    this.root.add(outer);
  }

  _buildWalls() {
    if (this.map.edge && this.map.edge !== 'walls') return; // open horizon
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
      let mat;
      if (this.map.id === 'desert') {
        // sandstone rampart — the dark panel texture would go black in daylight
        mat = new THREE.MeshStandardMaterial({
          color: 0xc0a070, roughness: 0.95, metalness: 0.05 });
      } else {
        const tex = panelTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.round(size / 4), 2);
        mat = new THREE.MeshStandardMaterial({
          map: tex, color: 0x9fb4cc, roughness: 0.7, metalness: 0.4,
        });
        if (this.map.id === 'battlefield') mat.color.setHex(0xa89878);
      }
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
