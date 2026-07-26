// NEON STRIKE server: static file host + WebSocket room hub.
// The server manages rooms and relays messages; gameplay simulation runs on
// the room host's client, so server CPU stays negligible.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
// CORS for cross-origin frontends; '*' by default, restrict via ALLOW_ORIGIN
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
// Injected into index.html as the client's default server address
const DEFAULT_SERVER_ADDRESS = process.env.DEFAULT_SERVER_ADDRESS || '';
const ROOT = path.join(__dirname, '..');
// Room capacity: default 8, raise up to 16 with MAX_PLAYERS
const MAX_PLAYERS = Math.min(16,
  Math.max(2, parseInt(process.env.MAX_PLAYERS || '8', 10) || 8));
const MAX_ROOMS = 200;
const MAX_MSG_BYTES = 32 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: clients.size }));
    return;
  }
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    if (DEFAULT_SERVER_ADDRESS && urlPath === '/index.html') {
      res.end(data.toString().replace('</head>',
        `<script>window.NEON_SERVER_ADDRESS=${JSON.stringify(DEFAULT_SERVER_ADDRESS)};</script></head>`));
      return;
    }
    res.end(data);
  });
});

// ---------- rooms ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MSG_BYTES });
const clients = new Map(); // id -> { ws, name, roomCode }
const rooms = new Map();   // code -> { code, players: Map<id, {name, ready}>, hostId, started }

let nextId = 1;

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tries = 0; tries < 50; tries++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    if (!rooms.has(code)) return code;
  }
  return null;
}

function send(id, obj) {
  const c = clients.get(id);
  if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(obj));
}

function roomStatePayload(room) {
  return {
    t: 'roomState',
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    players: [...room.players.entries()].map(([id, p]) => ({
      id, name: p.name, ready: p.ready, host: id === room.hostId,
    })),
  };
}

function broadcastRoom(room, obj, exceptId = null) {
  for (const id of room.players.keys()) {
    if (id !== exceptId) send(id, obj);
  }
}

function roomListPayload() {
  const list = [];
  for (const room of rooms.values()) {
    list.push({
      code: room.code,
      count: room.players.size,
      max: MAX_PLAYERS,
      avgRank: (() => {
        let sum = 0, n = 0;
        for (const pid of room.players.keys()) {
          const pc = clients.get(pid);
          sum += (pc && pc.rank) || 1;
          n++;
        }
        return n ? Math.round(sum / n) : 1;
      })(),
      started: room.started,
      host: room.players.get(room.hostId)?.name || '?',
    });
    if (list.length >= 50) break;
  }
  return { t: 'roomList', rooms: list };
}

function leaveRoom(id, notifySelf) {
  const c = clients.get(id);
  if (!c || !c.roomCode) return;
  const room = rooms.get(c.roomCode);
  c.roomCode = null;
  if (!room) return;
  room.players.delete(id);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === id) {
    // promote the longest-standing remaining player
    room.hostId = room.players.keys().next().value;
    if (room.started) {
      // gameplay is simulated on the host client; a mid-match host loss ends the match
      room.started = false;
      for (const p of room.players.values()) p.ready = false;
      broadcastRoom(room, { t: 'hostLeft' });
    }
  }
  broadcastRoom(room, roomStatePayload(room));
  if (notifySelf) send(id, { t: 'leftRoom' });
}

wss.on('connection', (ws) => {
  const id = String(nextId++);
  clients.set(id, { ws, name: 'PLAYER', roomCode: null });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(id, { t: 'welcome', id });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const c = clients.get(id);
    if (!c) return;
    const room = c.roomCode ? rooms.get(c.roomCode) : null;

    switch (msg.t) {
      case 'hello': {
        c.name = String(msg.name || 'PLAYER').slice(0, 16).trim() || 'PLAYER';
        c.rank = Math.max(1, Math.min(10, parseInt(msg.rank, 10) || 1));
        break;
      }
      case 'list': {
        send(id, roomListPayload());
        break;
      }
      case 'create': {
        if (room) leaveRoom(id, false);
        if (rooms.size >= MAX_ROOMS) { send(id, { t: 'error', code: 'serverFull' }); break; }
        const code = makeCode();
        if (!code) { send(id, { t: 'error', code: 'serverFull' }); break; }
        const newRoom = {
          code,
          players: new Map([[id, { name: c.name, ready: false }]]),
          hostId: id,
          started: false,
        };
        rooms.set(code, newRoom);
        c.roomCode = code;
        send(id, roomStatePayload(newRoom));
        break;
      }
      case 'join': {
        if (room) leaveRoom(id, false);
        const code = String(msg.code || '').toUpperCase().trim();
        const target = rooms.get(code);
        if (!target) { send(id, { t: 'error', code: 'noRoom' }); break; }
        if (target.players.size >= MAX_PLAYERS) { send(id, { t: 'error', code: 'roomFull' }); break; }
        target.players.set(id, { name: c.name, ready: false });
        c.roomCode = code;
        broadcastRoom(target, roomStatePayload(target));
        break;
      }
      case 'quick': {
        // skill-based quick play: prefer the open lobby whose average rank
        // is closest to the requester's, then the fullest
        if (room) leaveRoom(id, false);
        const myRank = c.rank || 1;
        let target = null, bestKey = null;
        for (const r of rooms.values()) {
          if (r.started || r.players.size >= MAX_PLAYERS) continue;
          let sum = 0, n = 0;
          for (const pid of r.players.keys()) {
            const pc = clients.get(pid);
            sum += (pc && pc.rank) || 1;
            n++;
          }
          const avg = n ? sum / n : myRank;
          const key = [Math.abs(avg - myRank), -r.players.size];
          if (!target || key[0] < bestKey[0] ||
              (key[0] === bestKey[0] && key[1] < bestKey[1])) {
            target = r;
            bestKey = key;
          }
        }
        if (target) {
          target.players.set(id, { name: c.name, ready: false });
          c.roomCode = target.code;
          broadcastRoom(target, roomStatePayload(target));
          break;
        }
        if (rooms.size >= MAX_ROOMS) { send(id, { t: 'error', code: 'serverFull' }); break; }
        const code = makeCode();
        if (!code) { send(id, { t: 'error', code: 'serverFull' }); break; }
        const newRoom = {
          code,
          players: new Map([[id, { name: c.name, ready: false }]]),
          hostId: id,
          started: false,
        };
        rooms.set(code, newRoom);
        c.roomCode = code;
        send(id, roomStatePayload(newRoom));
        break;
      }
      case 'leave': {
        leaveRoom(id, true);
        break;
      }
      case 'ready': {
        if (!room || room.started) break;
        const p = room.players.get(id);
        if (p) p.ready = !!msg.v;
        broadcastRoom(room, roomStatePayload(room));
        break;
      }
      case 'start': {
        if (!room || room.hostId !== id || room.started) break;
        let allReady = true;
        for (const [pid, p] of room.players) {
          if (pid !== room.hostId && !p.ready) allReady = false;
        }
        if (!allReady) { send(id, { t: 'error', code: 'notReady' }); break; }
        room.started = true;
        room.map = typeof msg.map === 'string' ? msg.map.slice(0, 20) : 'arena';
        room.mode = msg.mode === 'versus' ? 'versus' : 'survival';
        room.difficulty = ['easy', 'normal', 'hard', 'expert'].includes(msg.difficulty)
          ? msg.difficulty : 'normal';
        room.bots = Math.max(0, Math.min(3, parseInt(msg.bots, 10) || 0));
        broadcastRoom(room, {
          t: 'started', hostId: room.hostId, map: room.map, mode: room.mode,
          difficulty: room.difficulty, bots: room.bots });
        broadcastRoom(room, roomStatePayload(room));
        break;
      }
      case 'end': {
        // host declares the match over; room returns to lobby
        if (!room || room.hostId !== id) break;
        room.started = false;
        for (const p of room.players.values()) p.ready = false;
        broadcastRoom(room, roomStatePayload(room));
        break;
      }
      case 'msg': {
        // gameplay relay to everyone else in the room
        if (!room) break;
        broadcastRoom(room, { t: 'relay', from: id, d: msg.d }, id);
        break;
      }
      case 'msgTo': {
        if (!room) break;
        const to = String(msg.to || '');
        if (room.players.has(to)) send(to, { t: 'relay', from: id, d: msg.d });
        break;
      }
      case 'ping': {
        send(id, { t: 'pong', ts: msg.ts });
        break;
      }
    }
  });

  ws.on('close', () => {
    leaveRoom(id, false);
    clients.delete(id);
  });
  ws.on('error', () => { /* close will follow */ });
});

// drop dead connections
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  console.log(`NEON STRIKE server listening on http://${HOST}:${PORT}`);
});
