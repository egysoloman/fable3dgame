// DOM/canvas HUD: health, ammo, radar, compass, kill feed, hitmarkers, banners.
import { t } from './i18n.js';
const COMPASS_POINTS = [
  [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
];

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      healthPanel: document.getElementById('health-panel'),
      healthValue: document.getElementById('health-value'),
      healthBar: document.getElementById('health-bar'),
      weaponName: document.getElementById('weapon-name'),
      ammoValue: document.getElementById('ammo-value'),
      ammoReserve: document.getElementById('ammo-reserve'),
      grenadeRow: document.getElementById('grenade-row'),
      reloadHint: document.getElementById('reload-hint'),
      scoreValue: document.getElementById('score-value'),
      waveValue: document.getElementById('wave-value'),
      enemiesLeft: document.getElementById('enemies-left'),
      streakValue: document.getElementById('streak-value'),
      killfeed: document.getElementById('killfeed'),
      banner: document.getElementById('banner'),
      subbanner: document.getElementById('subbanner'),
      hitmarker: document.getElementById('hitmarker'),
      vignette: document.getElementById('vignette'),
      lowhp: document.getElementById('lowhp'),
      crosshair: document.getElementById('crosshair'),
      scope: document.getElementById('scope'),
      dmgdirs: document.getElementById('dmgdirs'),
      menuScreen: document.getElementById('menu-screen'),
      pauseScreen: document.getElementById('pause-screen'),
      gameoverScreen: document.getElementById('gameover-screen'),
      finalScore: document.getElementById('final-score'),
      finalWave: document.getElementById('final-wave'),
      finalKills: document.getElementById('final-kills'),
      finalStreak: document.getElementById('final-streak'),
      bestScore: document.getElementById('best-score'),
      finalRank: document.getElementById('final-rank'),
      finalCheatnote: document.getElementById('final-cheatnote'),
      rankValue: document.getElementById('rank-value'),
      menuRank: document.getElementById('menu-rank'),
      arsenal: document.getElementById('arsenal'),
      armorBar: document.getElementById('armor-bar'),
      mountHint: document.getElementById('mount-hint'),
      vehicleHp: document.getElementById('vehicle-hp'),
      oobWarning: document.getElementById('oob-warning'),
    };
    this.game = null; // bound by Game after construction
    this.radarCtx = document.getElementById('radar').getContext('2d');
    this.compassCtx = document.getElementById('compass').getContext('2d');
    this._hitTimeout = null;
    this._bannerTimeout = null;
    this._vignetteTimeout = null;
    this._crossSpans = {
      t: this.el.crosshair.querySelector('.t'),
      b: this.el.crosshair.querySelector('.b'),
      l: this.el.crosshair.querySelector('.l'),
      r: this.el.crosshair.querySelector('.r'),
    };
  }

  show() { this.el.hud.classList.add('visible'); }
  hide() { this.el.hud.classList.remove('visible'); }

  screen(name) {
    this.el.menuScreen.classList.toggle('visible', name === 'menu');
    this.el.pauseScreen.classList.toggle('visible', name === 'pause');
    this.el.gameoverScreen.classList.toggle('visible', name === 'gameover');
    document.getElementById('mp-screen').classList.toggle('visible', name === 'mp');
    document.getElementById('lobby-screen').classList.toggle('visible', name === 'lobby');
    document.getElementById('mpover-screen').classList.toggle('visible', name === 'mpover');
    document.getElementById('setup-screen').classList.toggle('visible', name === 'setup');
    document.getElementById('loadout-screen').classList.toggle('visible', name === 'loadout');
  }

  setArmor(v) {
    this.el.armorBar.style.width = `${Math.max(0, Math.min(100, (v / 75) * 100))}%`;
  }

  setMountHint(on) {
    this.el.mountHint.classList.toggle('visible', on);
  }

  flashBang(intensity) {
    const el = document.getElementById('flash-overlay');
    el.style.transition = 'none';
    el.style.opacity = String(Math.min(1, intensity));
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${1.2 + intensity * 1.6}s ease-out`;
      el.style.opacity = '0';
    });
  }

  setOob(secondsLeft) {
    const el = this.el.oobWarning;
    if (secondsLeft === null || secondsLeft === undefined) {
      el.classList.remove('visible');
      return;
    }
    el.classList.add('visible');
    el.textContent = t('oob.warn', { s: Math.ceil(secondsLeft) });
  }

  setVehicleHp(v) {
    const el = this.el.vehicleHp;
    if (!v) { el.classList.remove('visible'); return; }
    el.classList.add('visible');
    el.textContent =
      `${t(`vehicle.${v.type}`)} ${Math.max(0, Math.ceil(v.hp))}/${v.maxHp}`;
  }

  setHealth(hp, maxHp) {
    const v = Math.max(0, Math.ceil(hp));
    this.el.healthValue.textContent = v;
    this.el.healthBar.style.width = `${(v / maxHp) * 100}%`;
    this.el.healthPanel.classList.toggle('hurt', v <= 35);
    this.el.lowhp.classList.toggle('active', v <= 35 && v > 0);
  }

  setAmmo(name, ammo, reserve, reloading) {
    this.el.weaponName.textContent = name;
    this.el.ammoValue.innerHTML = reloading ? '&mdash;' : String(ammo);
    this.el.ammoReserve.textContent = reserve === Infinity ? '∞' : `/ ${reserve}`;
    this.el.reloadHint.classList.toggle('visible', !reloading && ammo === 0 && reserve !== 0);
    if (reloading) this.el.reloadHint.classList.remove('visible');
  }

  setGrenades(n, infinite = false) {
    this.el.grenadeRow.textContent = infinite ? '⬢ ∞' : (n > 0 ? '⬢'.repeat(n) : '');
    this.el.grenadeRow.title = t('hud.grenades', { n: infinite ? '∞' : n });
  }

  setRank(label) {
    this.el.rankValue.textContent = t('hud.rank', { rank: label });
  }

  renderArsenal() {
    if (!this.game) return;
    const prog = this.game.progression;
    const defs = this.game.weapons.weapons.map((w) => w.def)
      .filter((d) => !d.streakOnly);
    const parts = defs.map((d, i) => {
      const name = t(`weapon.${d.id}`);
      return prog.isUnlocked(d)
        ? `<b>${i + 1}</b> ${name}`
        : `<span class="locked">${t('menu.locked', { weapon: name, need: d.unlockRank })}</span>`;
    });
    this.el.arsenal.innerHTML =
      `${t('menu.arsenal')}: ` + parts.slice(0, 5).join(' &middot; ') + '<br>' +
      parts.slice(5).join(' &middot; ');

    const next = prog.nextUnlock(defs);
    this.el.menuRank.textContent = next
      ? t('menu.nextUnlock', {
          rank: prog.rankLabel, weapon: t(`weapon.${next.id}`), need: next.unlockRank })
      : t('menu.fullArsenal', { rank: prog.rankLabel });
  }

  setScore(score) {
    this.el.scoreValue.textContent = String(score);
  }

  setStreak(streak) {
    this.el.streakValue.textContent = streak >= 3 ? t('hud.streak', { n: streak }) : '';
  }

  setWave(wave) {
    this.el.waveValue.textContent = String(wave);
  }

  setEnemiesLeft(n) {
    this.el.enemiesLeft.textContent = n > 0 ? t('hud.hostiles', { n }) : '';
  }

  // spread: radian cone half-angle; -1 hides the crosshair (sniper scope)
  setCrosshair(spread, adsAmount) {
    if (spread < 0) {
      this.el.crosshair.classList.add('hidden');
      return;
    }
    this.el.crosshair.classList.remove('hidden');
    const gap = Math.round(4 + spread * 900 * (1 - adsAmount * 0.5));
    this._crossSpans.t.style.bottom = `${gap}px`;
    this._crossSpans.b.style.top = `${gap}px`;
    this._crossSpans.l.style.right = `${gap}px`;
    this._crossSpans.r.style.left = `${gap}px`;
  }

  setScope(on) {
    this.el.scope.classList.toggle('visible', on);
  }

  banner(text, cls = '') {
    clearTimeout(this._bannerTimeout);
    const b = this.el.banner;
    b.textContent = text;
    b.className = cls ? `visible ${cls}` : 'visible';
    this._bannerTimeout = setTimeout(() => { b.className = b.className.replace('visible', '').trim(); }, 2200);
  }

  bannerFadeSoon() {
    clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => {
      this.el.banner.className = this.el.banner.className.replace('visible', '').trim();
    }, 1400);
  }

  subbanner(text) {
    const s = this.el.subbanner;
    if (text) {
      s.textContent = text;
      s.classList.add('visible');
    } else {
      s.classList.remove('visible');
    }
  }

  killfeed(text, cls = '') {
    const div = document.createElement('div');
    div.textContent = text;
    if (cls) div.className = cls;
    this.el.killfeed.prepend(div);
    while (this.el.killfeed.children.length > 5) {
      this.el.killfeed.lastChild.remove();
    }
    setTimeout(() => div.classList.add('fading'), 2600);
    setTimeout(() => div.remove(), 3300);
  }

  hitmarker(kill) {
    const h = this.el.hitmarker;
    clearTimeout(this._hitTimeout);
    h.classList.toggle('kill', kill);
    h.style.opacity = '1';
    this._hitTimeout = setTimeout(() => { h.style.opacity = '0'; }, kill ? 220 : 120);
  }

  damageFlash() {
    const v = this.el.vignette;
    clearTimeout(this._vignetteTimeout);
    v.style.opacity = '1';
    this._vignetteTimeout = setTimeout(() => { v.style.opacity = '0'; }, 250);
  }

  // rel: radians, 0 = threat straight ahead, positive clockwise on screen
  damageDirection(rel) {
    const div = document.createElement('div');
    div.className = 'dmgdir';
    div.style.transform = `rotate(${rel}rad)`;
    this.el.dmgdirs.appendChild(div);
    requestAnimationFrame(() => { div.style.opacity = '1'; });
    setTimeout(() => { div.style.opacity = '0'; }, 500);
    setTimeout(() => div.remove(), 1100);
  }

  updateRadar(player, enemies, pickups, teammates = []) {
    const ctx = this.radarCtx;
    const S = 140, C = S / 2, RANGE = 34;
    ctx.clearRect(0, 0, S, S);

    ctx.strokeStyle = 'rgba(39, 232, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(C, C, C - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(C, C, (C - 1) * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(C, 4); ctx.lineTo(C, S - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, C); ctx.lineTo(S - 4, C); ctx.stroke();

    const showAll = !!(this.game && this.game.cheats && this.game.cheats.is('radarAll'));
    const cos = Math.cos(player.yaw);
    const sin = Math.sin(player.yaw);
    const plot = (wx, wz, clampToRim) => {
      const dx = wx - player.position.x;
      const dz = wz - player.position.z;
      // project onto the player's right/forward axes (forward = up on the radar)
      let rx = dx * cos - dz * sin;
      let fw = -dx * sin - dz * cos;
      const d = Math.hypot(rx, fw);
      if (d > RANGE) {
        if (!clampToRim) return null;
        rx *= RANGE / d;   // UAV-style: pin distant contacts to the rim
        fw *= RANGE / d;
      }
      const k = (C - 6) / RANGE;
      return [C + rx * k, C - fw * k];
    };

    ctx.fillStyle = 'rgba(80, 255, 160, 0.9)';
    for (const pk of pickups) {
      const p = plot(pk.group.position.x, pk.group.position.z);
      if (p) ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      const p = plot(e.position.x, e.position.z, showAll);
      if (!p) continue;
      ctx.fillStyle = e.type.attack === 'ranged' ? 'rgba(90, 160, 255, 0.95)' : 'rgba(255, 70, 70, 0.95)';
      ctx.beginPath();
      ctx.arc(p[0], p[1], e.type.scale > 1.2 ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // teammates
    ctx.fillStyle = 'rgba(120, 240, 255, 0.95)';
    for (const tm of teammates) {
      if (!tm.alive) continue;
      const p = plot(tm.position.x, tm.position.z, true);
      if (p) ctx.fillRect(p[0] - 2.5, p[1] - 2.5, 5, 5);
    }

    // player wedge
    ctx.fillStyle = '#27e8ff';
    ctx.beginPath();
    ctx.moveTo(C, C - 7);
    ctx.lineTo(C - 5, C + 5);
    ctx.lineTo(C + 5, C + 5);
    ctx.closePath();
    ctx.fill();
  }

  updateCompass(yaw) {
    const ctx = this.compassCtx;
    const W = 340, H = 30;
    ctx.clearRect(0, 0, W, H);
    // heading in degrees, 0 = North (-Z), increasing clockwise
    let heading = (-yaw * 180 / Math.PI) % 360;
    if (heading < 0) heading += 360;
    const PX_PER_DEG = 2.4;

    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (const [deg, label] of COMPASS_POINTS) {
      let diff = deg - heading;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      const x = W / 2 + diff * PX_PER_DEG;
      if (x < -20 || x > W + 20) continue;
      const major = label.length === 1;
      ctx.fillStyle = major ? 'rgba(39,232,255,0.95)' : 'rgba(120,200,220,0.7)';
      ctx.fillText(label, x, major ? 13 : 12);
      ctx.fillRect(x - 0.5, 18, 1, major ? 8 : 5);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(W / 2 - 1, 20, 2, 8);
  }

  showGameOver(score, wave, kills, bestStreak, best, rankLine, cheated) {
    this.el.finalScore.textContent = String(score);
    this.el.finalWave.textContent = String(wave);
    this.el.finalKills.textContent = String(kills);
    this.el.finalStreak.textContent = String(bestStreak);
    this.el.bestScore.textContent = String(best);
    this.el.finalRank.textContent = rankLine || '';
    this.el.finalCheatnote.textContent = cheated
      ? '⚠ CHEATS WERE ACTIVE — XP AND BEST SCORE NOT SAVED' : '';
    this.screen('gameover');
  }
}
