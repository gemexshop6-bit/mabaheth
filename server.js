const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, SP = +process.env.WSPEED || 1;
const read = f => fs.readFileSync(path.join(__dirname, f));
const DATA = JSON.parse(read('data.json').toString());
const CATS = {}; for (const c of DATA) CATS[c.id] = c;
const HTML = read('index.html'), JS = read('game.js');
const T = () => Date.now() * SP;
const MAXSEATS = 6, PTS = [100, 70, 50, 30, 20, 10], HINT = 10, TURN = 30000;
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/health') { r.end('ok'); return }
  if (u === '/rooms') {
    const l = Object.values(rooms).filter(x => x.phase === 'lobby' && Object.keys(x.players).length < MAXSEATS && Object.values(x.players).some(p => p.ws && p.id === x.host)).map(x => ({ code: x.code, host: x.players[x.host].name, n: Object.keys(x.players).length }));
    r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(l)); return;
  }
  if (u === '/game.js') { r.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache' }); r.end(JS); return }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); r.end(HTML);
});
const wss = new WebSocketServer({ server: srv, maxPayload: 8192 });
const rooms = {};
const rid = () => Math.random().toString(36).slice(2, 10);
const mkcode = () => { let c; do { c = String(Math.floor(1000 + Math.random() * 9000)) } while (rooms[c]); return c };
const clean = (s, n) => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, n || 200);
const pick = a => a[Math.floor(Math.random() * a.length)];
const norm = s => String(s).toLowerCase().replace(/[\u064B-\u065F\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^a-z0-9\u0621-\u064A ]/g, ' ').split(/\s+/).filter(Boolean).map(w => w.replace(/^ال/, '')).join(' ');
const BOTN = ['بوت زيزو', 'بوت فريدة', 'بوت حودة', 'بوت نانا', 'بوت كيمو', 'بوت ميمي'];
const BOTC = [];
function send(ws, m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)) }
const yes = (it, q) => q.a.split('').some(ch => (it.f || '').includes(ch));
function newRoom() {
  return { code: mkcode(), phase: 'lobby', players: {}, host: null, chat: [], log: [], cat: 'singers', dur: 300, seats: [], turn: 0, round: 0, pend: null, bp: {}, br: {}, vote: null }
}
function sys(room, text) { room.chat.push({ s: 1, text }); if (room.chat.length > 120) room.chat.shift() }
function lg(room, text, k) { room.logn = (room.logn || 0) + 1; room.log.push({ text, k: k || '' }); if (room.log.length > 80) room.log.shift() }
function itemOf(room, sd) { return CATS[room.cat].items[sd.card] }
function state(room, p) {
  const cat = CATS[room.cat], res = room.phase === 'result';
  const o = {
    t: 'state', code: room.code, phase: room.phase, you: p.id, host: room.host, cat: room.cat, dur: room.dur, round: room.round,
    players: Object.values(room.players).map(x => ({ id: x.id, name: x.name, bot: !!x.bot, on: !!x.ws || !!x.bot, score: x.score })),
    ln: room.logn || 0, chat: room.chat.slice(-60), log: room.log.slice(-40), q: cat.q.map((x, i) => ({ i, t: x.t }))
  };
  if (room.phase !== 'lobby') {
    o.seats = room.seats.map(sd => {
      const it = itemOf(room, sd), me = sd.id === p.id, show = !me || sd.done || res;
      return { id: sd.id, done: sd.done, rank: sd.rank, miss: sd.miss, hints: me ? sd.hints : undefined, card: show ? { n: it.n, e: it.e, i: it.i } : null, gain: sd.gain }
    });
    o.turn = room.seats[room.turn] && room.seats[room.turn].id;
    o.left = Math.max(0, Math.round((room.endAt - T()) / 1000)); o.tLeft = Math.max(0, Math.round((room.turnEnd - T()) / 1000));
    o.pend = room.pend ? { by: room.pend.by, text: room.pend.text, voted: !!room.pend.votes[p.id], mine: room.pend.by === p.id } : null;
    if (room.phase === 'break' || room.phase === 'result') o.bp = room.bp;
    o.bs = room.bs || {};
  }
  return o;
}
function bcast(room) { for (const p of Object.values(room.players)) if (p.ws) send(p.ws, state(room, p)) }
function toast(p, text) { send(p.ws, { t: 'toast', text }) }
function live(room) { return room.seats.filter(s => !s.done) }
function startRound(room) {
  const cat = CATS[room.cat], ids = Object.keys(room.players);
  while (ids.length < 2 && ids.length < MAXSEATS) { const bid = 'b' + rid(); room.players[bid] = { id: bid, name: BOTN[ids.length % BOTN.length], bot: true, score: 0 }; ids.push(bid) }
  const used = new Set(); room.seats = []; room.log = []; room.pend = null; room.bp = {}; room.br = {}; room.bs = {};
  for (const id of ids.sort(() => Math.random() - .5)) {
    let c; do { c = Math.floor(Math.random() * cat.items.length) } while (used.has(c)); used.add(c);
    room.seats.push({ id, card: c, done: false, rank: 0, miss: 0, hints: [], hu: 0, cand: cat.items.map((_, i) => i), asked: {}, gain: 0 });
  }
  room.round++; room.phase = 'play'; room.turn = -1; room.endAt = T() + room.dur * 1000; room.nfin = 0;
  lg(room, '🎬 الجولة ' + room.round + ' بدأت! كل واحد شايف كروت التانيين ماعدا كارته', 'sys'); nextTurn(room);
}
function nextTurn(room) {
  const n = room.seats.length;
  if (live(room).length <= 1) return finish(room);
  for (let k = 0; k < n; k++) {
    room.turn = (room.turn + 1) % n; const sd = room.seats[room.turn], pl = room.players[sd.id];
    if (sd.done) continue;
    if (sd.miss > 0) { sd.miss--; lg(room, '⏭ ' + pl.name + ' بيفوّت دوره (غلط في التخمين)', 'miss'); continue }
    if (!pl.bot && !pl.ws) { lg(room, '📵 ' + pl.name + ' مش متصل، دوره عدّى'); continue }
    room.turnEnd = T() + TURN; room.botAt = pl.bot ? T() + (2500 + Math.random() * 2500) : 0; room.pend = null; bcast(room); return;
  }
  finish(room);
}
function finish(room) {
  const last = live(room); for (const s of last) { s.done = true; s.rank = 99 }
  room.phase = 'result'; room.pend = null; room.bp = {}; room.bs = {}; lg(room, '🏁 خلصت الجولة! اختاروا مين كسب أو اتخطوا', 'sys');
  for (const s of room.seats) if (s.rank === 99) s.rank = 0;
  bcast(room);
}
function award(room, sd, how) {
  const pts = PTS[Math.min(room.nfin, PTS.length - 1)] - sd.hu * HINT; room.nfin++; sd.rank = room.nfin; sd.done = true;
  const p = room.players[sd.id], g = Math.max(10, pts); sd.gain = g; p.score += g;
  const it = itemOf(room, sd); lg(room, '🏆 ' + p.name + ' ' + how + ' وطلع ' + it.n + '! (+' + g + ' نقطة)', 'win');
}
function checkVote(room) {
  const hum = Object.values(room.players).filter(x => !x.bot && x.ws); if (!hum.length) return false;
  room.bs = room.bs || {}; room.bp = room.bp || {};
  if (hum.every(x => room.bs[x.id])) { lg(room, '⏭ اتخطينا الروند', 'sys'); startRound(room); return true }
  if (room.phase === 'play') return false;
  const pk = hum.map(x => room.bp[x.id]);
  if (pk.every(v => v && room.seats.some(s => s.id === v)) && pk.every(v => v === pk[0])) {
    const w = room.seats.find(s => s.id === pk[0]);
    if (w && !w.done) award(room, w, 'اتختار كأحسن واحد'); else if (w) lg(room, '🏆 ' + room.players[w.id].name + ' كسب الروند!', 'win');
    startRound(room); return true
  }
  return false;
}
function ask(room, sd, qi) {
  const q = CATS[room.cat].q[qi]; if (!q) return; const it = itemOf(room, sd), a = yes(it, q), p = room.players[sd.id];
  sd.asked[qi] = a; lg(room, '❓ ' + p.name + ': ' + q.t + ' ← ' + (a ? 'أيوه ✅' : 'لأ ❌'), 'q');
  if (p.bot) { sd.cand = sd.cand.filter(i => yes(CATS[room.cat].items[i], q) === a) }
  nextTurn(room);
}
function guess(room, sd, text) {
  const g = norm(text), it = itemOf(room, sd), p = room.players[sd.id];
  const ok = c => { c = norm(c); return g.length >= 3 && (g === c || (' ' + c + ' ').includes(' ' + g + ' ')) };
  if (g && (ok(it.n) || ok(it.e))) { award(room, sd, 'خمّن صح'); if (live(room).length <= 1) return finish(room); return nextTurn(room) }
  sd.miss = 1; lg(room, '❌ ' + p.name + ' خمّن "' + clean(text, 30) + '" وغلط، هيفوّت الدور الجاي', 'bad');
  if (p.bot) sd.cand = sd.cand.filter(i => i !== sd.guessing);
  nextTurn(room);
}
function resolvePend(room) {
  const pe = room.pend; if (!pe) return; const v = Object.values(pe.votes), y = v.filter(x => x).length, n = v.length - y;
  const r = !v.length ? 'محدش رد 🤷' : y >= n ? 'أيوه ✅' : 'لأ ❌';
  lg(room, '❓ ' + room.players[pe.by].name + ': "' + pe.text + '" ← ' + r, 'q'); room.pend = null; nextTurn(room);
}
function botPlay(room, sd) {
  const cat = CATS[room.cat], c = sd.cand, p = room.players[sd.id];
  const qs = cat.q.map((q, i) => i).filter(i => !(i in sd.asked));
  let best = -1, bs = 1e9;
  for (const i of qs) { const y = c.filter(k => yes(cat.items[k], cat.q[i])).length, s = Math.abs(y - c.length / 2); if (y > 0 && y < c.length && s < bs) { bs = s; best = i } }
  const reckless = Math.random() < .08 && c.length < 12;
  if (c.length <= 2 || best < 0 || reckless || (c.length <= 4 && Math.random() < .6)) {
    const k = pick(c.length ? c : cat.items.map((_, i) => i)); sd.guessing = k; lg(room, '🤔 ' + p.name + ' بيخمّن...', 'q');
    return guess(room, sd, cat.items[k].n);
  }
  ask(room, sd, best);
}
setInterval(() => {
  for (const room of Object.values(rooms)) {
    try {
      const now = T();
      if (room.phase === 'play') {
        if (now >= room.endAt) { room.phase = 'break'; room.pend = null; room.bp = {}; room.bs = {}; lg(room, '⏰ الوقت خلص! اختاروا مين كسب', 'sys'); bcast(room); continue }
        const sd = room.seats[room.turn], pl = sd && room.players[sd.id];
        if (!sd) continue;
        if (room.pend) { const hv = Object.values(room.players).filter(x => !x.bot && x.ws && x.id !== room.pend.by); if (now >= room.pend.end || hv.every(x => x.id in room.pend.votes)) resolvePend(room); continue }
        if (pl.bot) { if (now >= room.botAt) botPlay(room, sd) }
        else if (now >= room.turnEnd) { lg(room, '⌛ ' + pl.name + ' الوقت خلص عليه'); nextTurn(room) }
        else if (!pl.ws) nextTurn(room);
        else if (Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000); bcast(room) }
      } else if (room.phase === 'break' && Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000) }
    } catch (e) { console.error(e) }
  }
}, 400);
function leaveRoom(room, p, ws) {
  delete room.players[p.id]; ws.room = null; ws.pid = null; if (room.bp) delete room.bp[p.id]; if (room.bs) delete room.bs[p.id];
  for (const q of Object.values(room.players)) send(q.ws, { t: 'vleave', from: p.id });
  const hum = Object.values(room.players).filter(x => !x.bot);
  if (!hum.length) { delete rooms[room.code]; return }
  if (room.host === p.id) { const n = hum.find(x => x.ws) || hum[0]; room.host = n.id }
  sys(room, p.name + ' خرج من الغرفة');
  if (room.phase !== 'lobby') { const i = room.seats.findIndex(s => s.id === p.id); if (i >= 0) { const wasTurn = i === room.turn; room.seats.splice(i, 1); if (i < room.turn) room.turn--; if (wasTurn) room.turn--; if (room.phase === 'play') { if (live(room).length <= 1) finish(room); else if (wasTurn) nextTurn(room) } } }
  if (room.phase !== 'lobby' && checkVote(room)) return;
  bcast(room);
}
function msg(ws, m) {
  if (m.t === 'create' || m.t === 'join') {
    let room, p; const name = clean(m.name, 20) || 'لاعب';
    if (m.t === 'create') { room = newRoom(); rooms[room.code] = room }
    else {
      room = rooms[clean(m.code)]; if (!room) return send(ws, { t: 'err', e: 'الكود ده مش موجود' });
      if (m.token && room.players[m.token]) p = room.players[m.token];
      else {
        if (room.phase !== 'lobby') return send(ws, { t: 'err', e: 'اللعبة شغالة، استنى الجولة الجاية' });
        const hn = Object.keys(room.players).length;
        if (hn >= MAXSEATS) { const b = Object.values(room.players).find(x => x.bot); if (b) delete room.players[b.id]; else return send(ws, { t: 'err', e: 'الغرفة كاملة' }) }
      }
    }
    if (!p) { const id = rid(); p = room.players[id] = { id, name, score: 0 }; if (!room.host) room.host = id; sys(room, name + ' دخل الغرفة') }
    p.ws = ws; ws.room = room; ws.pid = p.id;
    send(ws, { t: 'hello', cats: DATA.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, n: c.items.length })), token: p.id, code: room.code }); bcast(room); return;
  }
  const room = ws.room, p = room && room.players[ws.pid]; if (!p) return;
  const host = room.host === p.id;
  if (m.t === 'leave') { leaveRoom(room, p, ws); return }
  if (m.t === 'rtc') { const q = room.players[m.to]; if (q && q.ws && m.d && typeof m.d === 'object') send(q.ws, { t: 'rtc', from: p.id, d: m.d }); return }
  if (m.t === 'vjoin' || m.t === 'vleave') { for (const q of Object.values(room.players)) if (q.id !== p.id) send(q.ws, { t: m.t, from: p.id }); return }
  if (m.t === 'chat') { const x = clean(m.text, 200); if (x) { room.chat.push({ id: p.id, name: p.name, text: x }); if (room.chat.length > 120) room.chat.shift(); bcast(room) } return }
  if (m.t === 'emo') { const e = String(m.e || '').slice(0, 8); for (const q of Object.values(room.players)) send(q.ws, { t: 'emo', from: p.id, name: p.name, e }); return }
  if (room.phase === 'lobby') {
    if (!host) return;
    if (m.t === 'set') { if (CATS[m.cat]) room.cat = m.cat; if (m.dur) room.dur = Math.max(20, Math.min(1800, +m.dur | 0)); bcast(room) }
    else if (m.t === 'addbot') { if (Object.keys(room.players).length < MAXSEATS) { const bid = 'b' + rid(); room.players[bid] = { id: bid, name: BOTN[Object.keys(room.players).length % BOTN.length], bot: true, score: 0 }; bcast(room) } }
    else if (m.t === 'rmbot') { const b = Object.values(room.players).find(x => x.bot); if (b) delete room.players[b.id]; bcast(room) }
    else if (m.t === 'start') { startRound(room) }
    return;
  }
  const sd = room.seats.find(s => s.id === p.id);
  if (room.phase === 'break' || room.phase === 'result') {
    room.bs = room.bs || {};
    if (m.t === 'bpick') { if (room.seats.some(s => s.id === m.id)) { room.bp[p.id] = m.id; delete room.bs[p.id]; if (!checkVote(room)) bcast(room) } }
    else if (m.t === 'bskip') { if (room.bs[p.id]) delete room.bs[p.id]; else { room.bs[p.id] = 1; delete room.bp[p.id] } if (!checkVote(room)) bcast(room) }
    else if (room.phase === 'result' && host && m.t === 'again') { room.phase = 'lobby'; room.seats = []; bcast(room) }
    return;
  }
  if (m.t === 'bskip' && room.phase === 'play') { room.bs = room.bs || {}; if (room.bs[p.id]) delete room.bs[p.id]; else room.bs[p.id] = 1; if (!checkVote(room)) bcast(room); return }
  if (!sd || sd.done) return;
  if (m.t === 'vote') { if (room.pend && room.pend.by !== p.id && !(p.id in room.pend.votes)) { room.pend.votes[p.id] = !!m.y; bcast(room) } return }
  if (room.seats[room.turn].id !== p.id || room.pend) return;
  if (m.t === 'ask') ask(room, sd, m.qi | 0);
  else if (m.t === 'askf') { const x = clean(m.text, 80); if (!x) return; room.pend = { by: p.id, text: x, votes: {}, end: T() + 15000 }; lg(room, '💬 ' + p.name + ' بيسأل: ' + x, 'q'); bcast(room) }
  else if (m.t === 'guess') guess(room, sd, m.text);
  else if (m.t === 'hint') {
    if (sd.hints.length >= 3) return toast(p, 'خلصت التلميحات'); const it = itemOf(room, sd), w = it.n.split(' ');
    const h = [`الاسم ${w.length} كلمة وأول حرف "${it.n[0]}"`, `آخر حرف في الاسم "${it.n[it.n.length - 1]}"`, `الاسم بالإنجليزي بيبدأ بـ "${it.e[0]}"، وعدد حروفه ${it.n.replace(/ /g, '').length} حرف`][sd.hints.length];
    sd.hints.push(h); sd.hu++; p.score = Math.max(0, p.score - HINT); lg(room, '💡 ' + p.name + ' أخد تلميح (-' + HINT + ')', 'hint'); bcast(room)
  }
}
wss.on('connection', ws => {
  ws.on('message', d => { try { msg(ws, JSON.parse(d)) } catch (e) { console.error(e) } });
  ws.on('close', () => { const room = ws.room; if (room) { const p = room.players[ws.pid]; if (p && p.ws === ws) { p.ws = null; if (room.phase !== 'lobby' && checkVote(room)) return; bcast(room) } } });
});
srv.listen(PORT, () => console.log('up ' + PORT));
