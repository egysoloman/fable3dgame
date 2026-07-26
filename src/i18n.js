// Lightweight i18n: en + zh-TW (Traditional Chinese, Taiwan).
// Static DOM nodes carry data-i18n="key"; dynamic strings use t(key, vars).
const LANG_KEY = 'neonstrike.lang';

const STRINGS = {
  en: {
    // menu
    'menu.subtitle': 'HOSTILE MACHINES DETECTED — SURVIVE THE WAVES',
    'menu.solo': 'SOLO',
    'menu.multiplayer': 'MULTIPLAYER',
    'menu.controls': '<b>W A S D</b> move · <b>MOUSE</b> aim · <b>LMB</b> fire · <b>RMB</b> aim down sights · <b>G</b> grenade<br><b>SHIFT</b> sprint · <b>C / CTRL</b> crouch · <b>SPACE</b> jump · <b>1–8</b> / <b>WHEEL</b> weapons · <b>R</b> reload · <b>ESC</b> pause · <b>~ / F1</b> dev console',
    'menu.arsenal': 'ARSENAL',
    'menu.rank': 'RANK {rank}',
    'menu.nextUnlock': 'RANK {rank} — NEXT UNLOCK: {weapon} AT RANK {need}',
    'menu.fullArsenal': 'RANK {rank} — FULL ARSENAL UNLOCKED',
    'menu.locked': '🔒 {weapon} (RANK {need})',

    // multiplayer lobby
    'mp.title': 'MULTIPLAYER',
    'mp.subtitle': 'CO-OP WAVE SURVIVAL — UP TO 4 OPERATIVES',
    'mp.nickname': 'CALLSIGN',
    'mp.create': 'CREATE ROOM',
    'mp.joinCode': 'ROOM CODE',
    'mp.join': 'JOIN',
    'mp.rooms': 'OPEN ROOMS',
    'mp.refresh': 'REFRESH',
    'mp.noRooms': 'NO OPEN ROOMS — CREATE ONE',
    'mp.back': 'BACK',
    'mp.connecting': 'CONNECTING…',
    'mp.offline': 'SERVER OFFLINE — SOLO ONLY. Run `npm start` to host rooms.',
    'mp.room': 'ROOM {code}',
    'mp.players': 'OPERATIVES',
    'mp.ready': 'READY',
    'mp.unready': 'NOT READY',
    'mp.start': 'START MISSION',
    'mp.leave': 'LEAVE',
    'mp.waitHost': 'WAITING FOR HOST…',
    'mp.waitReady': 'WAITING FOR OPERATIVES TO READY UP',
    'mp.host': 'HOST',
    'mp.inMatch': 'IN MATCH',
    'mp.err.noRoom': 'ROOM NOT FOUND',
    'mp.err.roomFull': 'ROOM FULL',
    'mp.err.serverFull': 'SERVER FULL',
    'mp.err.notReady': 'NOT EVERYONE IS READY',
    'mp.err.lost': 'CONNECTION LOST',
    'mp.hostLeft': 'HOST LEFT — MATCH ENDED',
    'mp.joined': '{name} JOINED',
    'mp.left': '{name} LEFT',
    'mp.spectating': 'DOWN — REDEPLOYING NEXT WAVE',
    'mp.matchOver': 'MISSION FAILED',
    'mp.backToLobby': 'BACK TO LOBBY',
    'mp.score': 'SCORE',
    'mp.kills': 'KILLS',
    'mp.playerKilled': '{player} eliminated {enemy}',
    'mp.playerDown': '{player} IS DOWN',
    'mp.cheatsDisabled': 'CHEATS DISABLED IN MULTIPLAYER',

    // HUD
    'hud.integrity': 'INTEGRITY',
    'hud.score': 'SCORE',
    'hud.wave': 'WAVE',
    'hud.rank': 'RANK {rank}',
    'hud.hostiles': 'HOSTILES: {n}',
    'hud.streak': 'STREAK ×{n}',
    'hud.reload': '[R] RELOAD',
    'hud.grenades': '{n} grenades [G]',

    // banners / waves
    'banner.survive': 'SURVIVE',
    'banner.wave': 'WAVE {n}',
    'banner.waveClear': 'WAVE CLEAR',
    'banner.nextWave': 'NEXT WAVE IN {s}',
    'banner.rank': 'RANK {rank}',

    // killfeed / events
    'feed.eliminated': '{enemy} ELIMINATED',
    'feed.unlocked': '{weapon} UNLOCKED',
    'feed.perk': 'PERK: {perk}',
    'feed.locked': '{weapon} LOCKED — RANK {need}',
    'feed.cheatOn': 'CHEAT: {cheat} ON',
    'feed.cheatOff': 'CHEAT: {cheat} OFF',
    'feed.cheatsReset': 'CHEATS RESET',
    'feed.waveForced': 'CHEAT: WAVE FORCED',
    'feed.startRun': 'START A RUN FIRST',

    // pause / settings
    'pause.title': 'PAUSED',
    'pause.resume': 'RESUME',
    'pause.sensitivity': 'SENSITIVITY',
    'pause.volume': 'VOLUME',
    'pause.language': 'LANGUAGE',

    // game over
    'over.title': 'SIGNAL LOST',
    'over.score': 'SCORE',
    'over.wave': 'WAVE',
    'over.kills': 'KILLS',
    'over.bestStreak': 'BEST STREAK',
    'over.bestScore': 'BEST SCORE',
    'over.restart': 'RE-ENGAGE',
    'over.rank': 'RANK {rank}',
    'over.rankXp': 'RANK {rank} — {xp} / {next} XP',
    'over.cheated': '⚠ CHEATS WERE ACTIVE — XP AND BEST SCORE NOT SAVED',

    // cheats
    'cheat.title': 'DEV CONSOLE',
    'cheat.hint': '↑↓ NAVIGATE · ENTER TOGGLE · ~ / F1 CLOSE',
    'cheat.active': '⚠ CHEATS ACTIVE ({n})',
    'cheat.god': 'GOD MODE', 'cheat.god.d': 'player takes no damage',
    'cheat.infiniteAmmo': 'INFINITE AMMO', 'cheat.infiniteAmmo.d': 'magazine never depletes',
    'cheat.noReload': 'NO RELOAD', 'cheat.noReload.d': 'reloads complete instantly',
    'cheat.instantKill': 'INSTANT KILL', 'cheat.instantKill.d': 'one shot eliminates anything',
    'cheat.unlockAll': 'UNLOCK ALL WEAPONS', 'cheat.unlockAll.d': 'full arsenal regardless of rank',
    'cheat.maxLevel': 'MAX LEVEL', 'cheat.maxLevel.d': 'max rank, all perks active',
    'cheat.slowMotion': 'SLOW MOTION', 'cheat.slowMotion.d': 'cinematic 45% game speed',
    'cheat.radarAll': 'FULL RADAR', 'cheat.radarAll.d': 'radar shows every hostile',
    'cheat.infiniteGrenades': 'INFINITE GRENADES', 'cheat.infiniteGrenades.d': 'unlimited throwables',
    'cheat.spawnWave': 'SPAWN NEXT WAVE', 'cheat.spawnWave.d': 'force the next wave now',
    'cheat.reset': 'RESET ALL CHEATS', 'cheat.reset.d': 'turn everything off',

    // setup / modes / maps / equipment / vehicles / streak rewards
    'setup.title': 'MISSION SETUP',
    'setup.mode': 'MODE',
    'setup.map': 'MAP',
    'setup.equip': 'EQUIPMENT (PICK 2)',
    'setup.deploy': 'DEPLOY',
    'mode.survival': 'SURVIVAL', 'mode.survival.d': 'endless robot waves',
    'mode.strike': 'SQUAD STRIKE', 'mode.strike.d': '30 eliminations vs armed AI soldiers',
    'map.arena': 'NEON ARENA',
    'map.battlefield': 'SECTOR K BATTLEFIELD',
    'equip.plates': 'ARMOR PLATES', 'equip.plates.d': 'blue armor absorbs damage',
    'equip.helmet': 'COMBAT HELMET', 'equip.helmet.d': '-40% explosive, -25% gunfire',
    'equip.stim': 'STIM INJECTOR', 'equip.stim.d': 'faster health regen',
    'equip.boots': 'RAIDER BOOTS', 'equip.boots.d': '+8% speed, higher jump',
    'vehicle.hint': '[E] RIDE',
    'vehicle.mounted': 'HOVERBIKE — W/S THROTTLE · A/D STEER · E DISMOUNT',
    'streakr.resupply': 'RESUPPLY DROP',
    'streakr.railgun': 'AEGIS RAILGUN ONLINE',
    'streakr.heli': 'ATTACK HELICOPTER INBOUND',
    'strike.win': 'MISSION ACCOMPLISHED',
    'strike.lose': 'MISSION FAILED',
    'strike.redeploy': 'REDEPLOY IN {s}',
    'strike.timer': '{s}s REMAINING',
    'enemy.soldier': 'SOLDIER',

    // weapons
    'weapon.pistol': 'P-9 SIDEARM',
    'weapon.smg': 'VIPER SMG',
    'weapon.rifle': 'HELIX AR',
    'weapon.dmr': 'JUDGE DMR',
    'weapon.shotgun': 'BREACHER',
    'weapon.lmg': 'BASTION LMG',
    'weapon.sniper': 'SPECTRE',
    'weapon.launcher': 'HAVOC RL',
    'weapon.carbine': 'VOLT CARBINE',
    'weapon.railgun': 'AEGIS RAILGUN',

    // enemies
    'enemy.grunt': 'GRUNT',
    'enemy.ranger': 'RANGER',
    'enemy.tank': 'TANK',

    // perks
    'perk.swift': 'SWIFT HANDS', 'perk.swift.d': '20% faster reloads',
    'perk.conditioning': 'CONDITIONING', 'perk.conditioning.d': '8% faster sprint',
    'perk.bandolier': 'BANDOLIER', 'perk.bandolier.d': '+1 grenade, +2 capacity',
    'perk.juggernaut': 'JUGGERNAUT', 'perk.juggernaut.d': '125 max integrity',
    'perk.deadeye': 'DEAD EYE', 'perk.deadeye.d': '+10% bullet damage',

    // streaks
    'streak.5': 'RAMPAGE',
    'streak.10': 'ONSLAUGHT',
    'streak.15': 'UNSTOPPABLE',
    'streak.20': 'GODLIKE',
  },

  'zh-TW': {
    'menu.subtitle': '偵測到敵對機械 — 在波次中生存下來',
    'menu.solo': '單人遊戲',
    'menu.multiplayer': '多人遊戲',
    'menu.controls': '<b>W A S D</b> 移動 · <b>滑鼠</b> 瞄準 · <b>左鍵</b> 開火 · <b>右鍵</b> 開鏡瞄準 · <b>G</b> 手榴彈<br><b>SHIFT</b> 衝刺 · <b>C / CTRL</b> 蹲下 · <b>SPACE</b> 跳躍 · <b>1–8</b> / <b>滾輪</b> 切換武器 · <b>R</b> 換彈 · <b>ESC</b> 暫停 · <b>~ / F1</b> 開發者控制台',
    'menu.arsenal': '武器庫',
    'menu.rank': '階級 {rank}',
    'menu.nextUnlock': '階級 {rank} — 下一項解鎖：{weapon}（階級 {need}）',
    'menu.fullArsenal': '階級 {rank} — 武器庫全數解鎖',
    'menu.locked': '🔒 {weapon}（階級 {need}）',

    'mp.title': '多人遊戲',
    'mp.subtitle': '合作波次生存 — 最多 4 名幹員',
    'mp.nickname': '代號',
    'mp.create': '建立房間',
    'mp.joinCode': '房間代碼',
    'mp.join': '加入',
    'mp.rooms': '開放房間',
    'mp.refresh': '重新整理',
    'mp.noRooms': '目前沒有房間 — 建立一個吧',
    'mp.back': '返回',
    'mp.connecting': '連線中…',
    'mp.offline': '伺服器離線 — 僅限單人遊戲。執行 `npm start` 以開設房間。',
    'mp.room': '房間 {code}',
    'mp.players': '幹員',
    'mp.ready': '準備完成',
    'mp.unready': '尚未準備',
    'mp.start': '開始任務',
    'mp.leave': '離開',
    'mp.waitHost': '等待房主開始…',
    'mp.waitReady': '等待所有幹員準備',
    'mp.host': '房主',
    'mp.inMatch': '進行中',
    'mp.err.noRoom': '找不到房間',
    'mp.err.roomFull': '房間已滿',
    'mp.err.serverFull': '伺服器已滿',
    'mp.err.notReady': '尚有幹員未準備',
    'mp.err.lost': '連線中斷',
    'mp.hostLeft': '房主已離開 — 任務結束',
    'mp.joined': '{name} 加入了',
    'mp.left': '{name} 離開了',
    'mp.spectating': '已陣亡 — 下一波重新部署',
    'mp.matchOver': '任務失敗',
    'mp.backToLobby': '返回大廳',
    'mp.score': '分數',
    'mp.kills': '擊殺',
    'mp.playerKilled': '{player} 殲滅了 {enemy}',
    'mp.playerDown': '{player} 已陣亡',
    'mp.cheatsDisabled': '多人遊戲中已停用作弊',

    'hud.integrity': '機體完整度',
    'hud.score': '分數',
    'hud.wave': '波次',
    'hud.rank': '階級 {rank}',
    'hud.hostiles': '敵人：{n}',
    'hud.streak': '連殺 ×{n}',
    'hud.reload': '[R] 換彈',
    'hud.grenades': '{n} 顆手榴彈 [G]',

    'banner.survive': '生存下去',
    'banner.wave': '第 {n} 波',
    'banner.waveClear': '波次肅清',
    'banner.nextWave': '下一波 {s} 秒後來襲',
    'banner.rank': '階級 {rank}',

    'feed.eliminated': '已殲滅{enemy}',
    'feed.unlocked': '已解鎖 {weapon}',
    'feed.perk': '特長：{perk}',
    'feed.locked': '{weapon} 未解鎖 — 需要階級 {need}',
    'feed.cheatOn': '作弊：{cheat} 開啟',
    'feed.cheatOff': '作弊：{cheat} 關閉',
    'feed.cheatsReset': '作弊已全部重設',
    'feed.waveForced': '作弊：強制生成波次',
    'feed.startRun': '請先開始遊戲',

    'pause.title': '已暫停',
    'pause.resume': '繼續',
    'pause.sensitivity': '靈敏度',
    'pause.volume': '音量',
    'pause.language': '語言',

    'over.title': '訊號中斷',
    'over.score': '分數',
    'over.wave': '波次',
    'over.kills': '擊殺',
    'over.bestStreak': '最佳連殺',
    'over.bestScore': '最佳分數',
    'over.restart': '再次出擊',
    'over.rank': '階級 {rank}',
    'over.rankXp': '階級 {rank} — {xp} / {next} XP',
    'over.cheated': '⚠ 曾啟用作弊 — XP 與最佳分數不予保存',

    'cheat.title': '開發者控制台',
    'cheat.hint': '↑↓ 選擇 · ENTER 切換 · ~ / F1 關閉',
    'cheat.active': '⚠ 作弊啟用中（{n}）',
    'cheat.god': '無敵模式', 'cheat.god.d': '玩家不受任何傷害',
    'cheat.infiniteAmmo': '無限彈藥', 'cheat.infiniteAmmo.d': '彈匣永不減少',
    'cheat.noReload': '免換彈', 'cheat.noReload.d': '換彈立即完成',
    'cheat.instantKill': '一擊必殺', 'cheat.instantKill.d': '任何攻擊直接殲滅敵人',
    'cheat.unlockAll': '解鎖所有武器', 'cheat.unlockAll.d': '無視階級取得全部武器',
    'cheat.maxLevel': '最高等級', 'cheat.maxLevel.d': '最高階級並啟用所有特長',
    'cheat.slowMotion': '慢動作', 'cheat.slowMotion.d': '電影感 45% 遊戲速度',
    'cheat.radarAll': '全域雷達', 'cheat.radarAll.d': '雷達顯示所有敵人',
    'cheat.infiniteGrenades': '無限手榴彈', 'cheat.infiniteGrenades.d': '投擲物用之不竭',
    'cheat.spawnWave': '生成下一波', 'cheat.spawnWave.d': '立即強制下一波來襲',
    'cheat.reset': '重設所有作弊', 'cheat.reset.d': '關閉全部作弊',

    'setup.title': '任務設定',
    'setup.mode': '模式',
    'setup.map': '地圖',
    'setup.equip': '裝備（選 2 項）',
    'setup.deploy': '部署出擊',
    'mode.survival': '生存模式', 'mode.survival.d': '無盡機械波次',
    'mode.strike': '小隊突擊', 'mode.strike.d': '對抗持槍 AI 士兵，達成 30 次殲滅',
    'map.arena': '霓虹競技場',
    'map.battlefield': 'K 區大戰場',
    'equip.plates': '防彈插板', 'equip.plates.d': '藍色護甲優先吸收傷害',
    'equip.helmet': '戰鬥頭盔', 'equip.helmet.d': '爆炸傷害 -40%、槍火 -25%',
    'equip.stim': '刺激針劑', 'equip.stim.d': '生命回復更快',
    'equip.boots': '突襲戰靴', 'equip.boots.d': '速度 +8%、跳更高',
    'vehicle.hint': '[E] 騎乘',
    'vehicle.mounted': '懸浮機車 — W/S 油門 · A/D 轉向 · E 下車',
    'streakr.resupply': '補給空投',
    'streakr.railgun': 'AEGIS 磁軌砲啟動',
    'streakr.heli': '攻擊直升機抵達',
    'strike.win': '任務完成',
    'strike.lose': '任務失敗',
    'strike.redeploy': '{s} 秒後重新部署',
    'strike.timer': '剩餘 {s} 秒',
    'enemy.soldier': '敵方士兵',

    'weapon.pistol': 'P-9 手槍',
    'weapon.smg': 'VIPER 衝鋒槍',
    'weapon.rifle': 'HELIX 突擊步槍',
    'weapon.dmr': 'JUDGE 精準步槍',
    'weapon.shotgun': 'BREACHER 霰彈槍',
    'weapon.lmg': 'BASTION 輕機槍',
    'weapon.sniper': 'SPECTRE 狙擊槍',
    'weapon.launcher': 'HAVOC 火箭筒',
    'weapon.carbine': 'VOLT 點放卡賓槍',
    'weapon.railgun': 'AEGIS 磁軌砲',

    'enemy.grunt': '雜兵',
    'enemy.ranger': '遊擊兵',
    'enemy.tank': '重裝兵',

    'perk.swift': '快手', 'perk.swift.d': '換彈速度提升 20%',
    'perk.conditioning': '體能強化', 'perk.conditioning.d': '衝刺速度提升 8%',
    'perk.bandolier': '彈藥背帶', 'perk.bandolier.d': '手榴彈 +1，上限 +2',
    'perk.juggernaut': '重裝甲', 'perk.juggernaut.d': '機體完整度上限 125',
    'perk.deadeye': '神射手', 'perk.deadeye.d': '子彈傷害 +10%',

    'streak.5': '橫掃',
    'streak.10': '猛攻',
    'streak.15': '勢不可擋',
    'streak.20': '如神附體',
  },
};

let current = 'en';
try {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored && STRINGS[stored]) {
    current = stored;
  } else if ((navigator.language || '').toLowerCase().startsWith('zh')) {
    current = 'zh-TW';
  }
} catch (e) { /* default en */ }

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!STRINGS[lang]) return;
  current = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ok */ }
  applyDom();
}

export function t(key, vars) {
  let s = STRINGS[current][key];
  if (s === undefined) s = STRINGS.en[key];
  if (s === undefined) return key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

// Fill every element carrying data-i18n (textContent) or data-i18n-html (innerHTML).
export function applyDom() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.documentElement.lang = current === 'zh-TW' ? 'zh-Hant-TW' : 'en';
}
