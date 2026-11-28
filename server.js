const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, SP = +process.env.WSPEED || 1;
const read = f => fs.readFileSync(path.join(__dirname, f));
const DATA = JSON.parse(read('data.json').toString());
const CATS = {}; for (const c of DATA) CATS[c.id] = c;
const HTML = read('index.html'), JS = read('game.js'), SWJS = read('sw.js'), MANI = read('manifest.webmanifest');
const T = () => Date.now() * SP;
const MAXSEATS = 8, PTS = [100, 70, 50, 30, 20, 10], HINT = 10, TURN = 30000;
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/health') { r.end('ok'); return }
  if (u === '/ice') {
    const f = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }];
    const tu = process.env.TURN_USER, tc = process.env.TURN_CRED;
    const L = tu && tc ? [{ urls: 'stun:stun.relay.metered.ca:80' }, { urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp', 'turn:global.relay.metered.ca:443', 'turns:global.relay.metered.ca:443?transport=tcp'], username: tu, credential: tc }, { urls: 'stun:stun.l.google.com:19302' }] : f;
    r.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); r.end(JSON.stringify({ iceServers: L, own: !!(tu && tc) })); return
  }
  if (u === '/rooms') {
    const l = Object.values(rooms).filter(x => x.phase === 'lobby' && Object.keys(x.players).length < MAXSEATS && Object.values(x.players).some(p => p.ws && p.id === x.host)).map(x => ({ code: x.code, host: x.players[x.host].name, n: Object.keys(x.players).length }));
    r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(l)); return;
  }
  if (/^\/[\w-]+\.(jpg|png)$/.test(u)) { const f = path.join(__dirname, u.slice(1)); const b64 = f.replace(/\.(jpg|png)$/, '.b64'); if (!fs.existsSync(f) && fs.existsSync(b64)) { r.writeHead(200, { 'content-type': u.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'public, max-age=86400' }); r.end(Buffer.from(fs.readFileSync(b64, 'utf8').trim(), 'base64')); return } if (fs.existsSync(f)) { r.writeHead(200, { 'content-type': u.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'public, max-age=86400' }); r.end(fs.readFileSync(f)); return } }
  if (u === '/sw.js') { r.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache', 'service-worker-allowed': '/' }); r.end(SWJS); return }
  if (u === '/manifest.webmanifest') { r.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-cache' }); r.end(MANI); return }
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
  return { code: mkcode(), phase: 'lobby', players: {}, host: null, chat: [], log: [], cat: 'singers', dur: 300, seats: [], turn: 0, round: 0, pend: null, bp: {}, br: {}, vote: null, game: 'who', rh: [], sp: null, du: null, dcat: 'mixed', dT: 180, spies: 1, clueT: 30, voteT: 60 }
}
function sys(room, text) { room.chat.push({ s: 1, text }); if (room.chat.length > 120) room.chat.shift() }
function lg(room, text, k) { room.logn = (room.logn || 0) + 1; room.log.push({ text, k: k || '' }); if (room.log.length > 80) room.log.shift() }
function itemOf(room, sd) { return CATS[room.cat].items[sd.card] }
function state(room, p) {
  const cat = CATS[room.cat], res = room.phase === 'result';
  const o = {
    t: 'state', code: room.code, phase: room.phase, you: p.id, host: room.host, cat: room.cat, dur: room.dur, round: room.round,
    game: room.game, rh: room.rh.slice(-20), spies: room.spies, clueT: room.clueT, voteT: room.voteT,
    players: Object.values(room.players).map(x => ({ id: x.id, name: x.name, bot: !!x.bot, on: !!x.ws || !!x.bot, score: x.score, ready: !!x.ready, mic: x.mic ? (x.mm ? 2 : 1) : 0 })),
    ln: room.logn || 0, chat: room.chat.slice(-60), log: room.log.slice(-40), q: cat.q.map((x, i) => ({ i, t: x.t }))
  };
  if (room.game === 'spy' && room.sp && room.phase[0] === 's') o.sp = spyView(room, p);
  if (room.game === 'duel' && room.du && room.phase[0] === 'd') { o.du = duelView(room, p); o.dcat = room.dcat }
  o.dcat = room.dcat; o.dT = room.dT;
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
function deal(room, used) {
  const h = room.hist || (room.hist = {}), L = h[room.cat] || (h[room.cat] = []), n = CATS[room.cat].items.length;
  let fresh = []; for (let i = 0; i < n; i++) if (!L.includes(i) && !used.has(i)) fresh.push(i);
  let c;
  if (fresh.length) c = pick(fresh);
  else { // pool exhausted: reuse oldest-used first, never twice in the same round
    if (!room.recyc || room.recyc !== room.round + 1) { room.recyc = room.round + 1; sys(room, '♻️ خلصت كروت المجال ده، هنعيد من الأقدم'); lg(room, '♻️ خلصت كروت المجال، بنعيد من الأقدم', 'sys') }
    c = L.find(i => !used.has(i)); if (c === undefined) c = pick([...Array(n).keys()].filter(i => !used.has(i)));
  }
  const k = L.indexOf(c); if (k >= 0) L.splice(k, 1); L.push(c);
  return c;
}
function startRound(room) {
  const cat = CATS[room.cat]; cleanBots(room, 2); const ids = Object.keys(room.players); room.game = 'who'; room.sp = null;
  for (const p of Object.values(room.players)) p.ready = false;
  const used = new Set(); room.seats = []; room.log = []; room.pend = null; room.bp = {}; room.br = {}; room.bs = {};
  for (const id of ids.sort(() => Math.random() - .5)) {
    let c = deal(room, used); used.add(c);
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
  room.nfin++; sd.rank = room.nfin; sd.done = true; sd.gain = 0;
  const p = room.players[sd.id], it = itemOf(room, sd); lg(room, '🏆 ' + p.name + ' ' + how + ' وطلع ' + it.n + '!', 'win');
}
function checkVote(room) {
  const hum = Object.values(room.players).filter(x => !x.bot && x.ws && room.seats.some(q => q.id === x.id)); if (!hum.length) return false;
  room.bs = room.bs || {}; room.bp = room.bp || {};
  if (hum.every(x => room.bs[x.id])) { lg(room, '⏭ اتخطينا الروند', 'sys'); addRH(room, [], 'اتخطت'); startRound(room); return true }
  if (room.phase === 'play') return false;
  const pk = hum.map(x => room.bp[x.id]);
  if (pk.every(v => v && room.seats.some(s => s.id === v)) && pk.every(v => v === pk[0])) {
    const w = room.seats.find(s => s.id === pk[0]);
    if (w && !w.done) award(room, w, 'اتختار كأحسن واحد');
    const wp = room.players[pk[0]]; if (wp) { wp.score += 5; lg(room, '🏆 ' + wp.name + ' كسب الروند! (+5)', 'win'); addRH(room, [wp.name], '') }
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
      } else if (room.phase[0] === 's') { spyTick(room, now)
      } else if (room.phase[0] === 'd') { duelTick(room, now)
      } else if (room.phase === 'break' && Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000) }
    } catch (e) { console.error(e) }
  }
}, 400);
// ================= الجاسوس =================
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a };
function cleanBots(room, min) {
  for (const b of Object.values(room.players)) if (b.bot && b.auto && Object.keys(room.players).length > min) delete room.players[b.id];
  while (Object.keys(room.players).length < min) {
    const taken = new Set(Object.values(room.players).map(x => x.name)), nm = BOTN.find(x => !taken.has(x)) || ('بوت ' + (Object.keys(room.players).length + 1)), bid = 'b' + rid();
    room.players[bid] = { id: bid, name: nm, bot: true, auto: true, score: 0 };
  }
}
function addRH(room, w, note) { room.rh.push({ n: room.rh.length + 1, g: room.game, cat: room.cat, w, note: note || '' }); if (room.rh.length > 40) room.rh.shift() }
const QW = { 'أنا راجل؟': ['راجل', 'ست'], 'أنا ست؟': ['ست', 'راجل'], 'أنا لسه عايش؟': ['عايش', 'متوفي'], 'أنا لسه بلعب؟': ['لسه بيلعب', 'معتزل'], 'أنا اعتزلت؟': ['معتزل', 'لسه بيلعب'], 'أنا كوميدي؟': ['كوميدي', 'جاد'], 'أنا قديم (قبل 2000)؟': ['قديم', 'جديد'], 'أنا حلو؟': ['حلو', 'مالح'], 'أنا مشروب؟': ['مشروب', 'أكل'], 'بتتاكل سخنة؟': ['سخن', 'ساقع'], 'فيا لحمة؟': ['لحمة', 'خضار'], 'أنا فاست فود؟': ['فاست فود', 'أكل بيت'], 'أنا أثر قديم؟': ['أثري', 'حديث'], 'أنا طبيعة؟': ['طبيعة', 'مبنى'], 'أنا مدينة؟': ['مدينة', 'مكان'], 'أنا بقدم كوميديا؟': ['كوميديا', 'جاد'], 'أنا بمثّل أو بغني كمان؟': ['فنان', 'تيك توكر'] };
function attrs(cat, it) {
  const yesW = [], noW = [];
  for (const q of cat.q) { const w = QW[q.t]; if (!w) continue; if (yes(it, q)) yesW.push(w[0]); else noW.push(w[1]) }
  const f = it.f || ''; if (f.includes('e') || f.includes('E')) yesW.push('مصري'); else if (f.includes('a')) yesW.push('أجنبي');
  return { y: [...new Set(yesW)], n: [...new Set(noW)].filter(x => !yesW.includes(x)) };
}
function fit(cat, it, text) {
  const t = norm(text), A = attrs(cat, it); let s = 0;
  for (const w of A.y) if (t.includes(norm(w))) s += 1.5;
  for (const w of A.n) if (t.includes(norm(w))) s -= 2;
  if (/كلمتين/.test(text)) s += it.n.split(' ').length === 2 ? 1 : -2;
  if (/(تلات|ثلاث)/.test(text)) s += it.n.split(' ').length === 3 ? 1 : -2;
  const m = /حرف\s*(\S)/.exec(text); if (m) s += norm(it.n)[0] === norm(m[1])[0] ? 1.5 : -2;
  for (const w of norm(it.n).split(' ')) if (w.length >= 3 && t.includes(w)) s += .5;
  return s;
}
function startSpy(room) {
  cleanBots(room, 3);
  const ids = shuf(Object.keys(room.players)), n = ids.length, k = Math.max(1, Math.min(room.spies || 1, n >= 6 ? 2 : 1));
  const c = deal(room, new Set());
  room.game = 'spy'; room.seats = []; room.round++; room.log = []; room.pend = null; room.bp = {}; room.bs = {};
  for (const p of Object.values(room.players)) p.ready = false;
  room.sp = { n: room.round, secret: c, spies: ids.slice(0, k), order: shuf(ids), ti: -1, clues: [], votes: {}, bv: {}, guesser: null, opts: null, res: null, tEnd: 0, botAt: 0 };
  room.phase = 'sclue';
  lg(room, '🕵️ الجولة ' + room.round + ' بدأت! فيه ' + (k === 1 ? 'جاسوس واحد' : k + ' جواسيس') + ' وسطكم', 'sys'); nextClue(room);
}
function nextClue(room) {
  const sp = room.sp;
  for (let k = 0; k < sp.order.length; k++) {
    sp.ti++; if (sp.ti >= sp.order.length) break;
    const id = sp.order[sp.ti], pl = room.players[id];
    if (!pl) continue;
    if (!pl.bot && !pl.ws) { sp.clues.push({ id, text: '📵' }); lg(room, '📵 ' + pl.name + ' مش متصل، دوره عدّى'); continue }
    sp.tEnd = T() + room.clueT * 1000; sp.botAt = pl.bot ? T() + 2000 + Math.random() * 2500 : 0; bcast(room); return;
  }
  startVote(room);
}
function startVote(room) {
  const sp = room.sp; room.phase = 'svote'; sp.ti = sp.order.length; sp.votes = {}; sp.tEnd = T() + room.voteT * 1000;
  for (const id of sp.order) { const p = room.players[id]; if (p && p.bot) sp.bv[id] = T() + 3000 + Math.random() * Math.min(6000, room.voteT * 400) }
  lg(room, '🗳 كل واحد قال كلمته. اتناقشوا وصوتوا مين الجاسوس!', 'sys'); bcast(room);
}
function botClue(room, id) {
  const sp = room.sp, cat = CATS[room.cat], it = cat.items[sp.secret], isSpy = sp.spies.includes(id), said = sp.clues.map(c => c.text);
  let w;
  if (!isSpy) {
    const A = attrs(cat, it), nm = it.n.split(' '), pool = [...A.y, ...A.n.filter(() => Math.random() < .25)];
    pool.push(nm.length === 2 ? 'اسمه كلمتين' : nm.length === 3 ? 'اسمه تلات كلمات' : 'اسمه كلمة واحدة', 'أول حرف ' + it.n[0], 'مشهور');
    const fresh = pool.filter(x => !said.includes(x)); w = pick(fresh.length ? fresh : pool);
  } else {
    // جاسوس: بيدوّر على أكتر صفة متكررة في كلام الباقيين عشان يداري نفسه
    const real = sp.clues.filter(c => c.text && c.text.length > 1 && !'⌛📵—'.includes(c.text));
    let best = null, bs = -9;
    for (const it2 of cat.items) { const s = real.reduce((a, c) => a + fit(cat, it2, c.text), 0) + Math.random() * .6; if (s > bs) { bs = s; best = it2 } }
    const A = best ? attrs(cat, best) : { y: [] }, f = A.y.filter(x => !said.includes(x));
    w = f.length ? pick(f) : (real.length ? pick(real).text : 'مشهور'); if (said.includes(w) && Math.random() < .5) w = 'مشهور';
  }
  sp.clues.push({ id, text: w }); lg(room, '🗣 ' + room.players[id].name + ': ' + w, 'q'); nextClue(room);
}
function botVoteFor(room, id) {
  const sp = room.sp, cat = CATS[room.cat], it = cat.items[sp.secret], others = sp.order.filter(x => x !== id && room.players[x]);
  if (sp.spies.includes(id)) {
    // الجاسوس بيصوّت على اللي كلامه شبه غريب بالنسبة لأحسن تخمين
    const sc = others.map(o => ({ o, s: Math.random() })); sc.sort((a, b) => a.s - b.s); return sc[0].o;
  }
  const sc = others.map(o => { const c = sp.clues.filter(x => x.id === o).map(x => x.text).join(' '); return { o, s: fit(cat, it, c) + Math.random() * .8 } });
  sc.sort((a, b) => a.s - b.s); return sc[0].o;
}
function voteDone(room) {
  const sp = room.sp; if (room.phase !== 'svote') return false;
  const need = sp.order.filter(id => { const p = room.players[id]; return p && (p.bot || p.ws) });
  if (need.every(id => sp.votes[id])) { endVote(room); return true } return false;
}
function endVote(room) {
  const sp = room.sp, tally = {}; for (const v of Object.values(sp.votes)) tally[v] = (tally[v] || 0) + 1;
  const elig = sp.order.filter(id => { const p = room.players[id]; return p && (p.bot || p.ws) }).length;
  let top = null, tc = 0, tie = false; for (const id in tally) { if (tally[id] > tc) { top = id; tc = tally[id]; tie = false } else if (tally[id] === tc) tie = true }
  sp.tally = tally; const maj = top && !tie && tc * 2 > elig;
  if (maj && sp.spies.includes(top)) {
    sp.caught = top; sp.guesser = top; const cat = CATS[room.cat], it = cat.items[sp.secret];
    const oth = cat.items.map((x, i) => i).filter(i => i !== sp.secret).sort((a, b) => { const o = x => [...(it.f || '')].filter(ch => (cat.items[x].f || '').includes(ch)).length; return (o(b) - o(a)) || (Math.random() - .5) });
    sp.opts = shuf([sp.secret, ...shuf(oth.slice(0, 8)).slice(0, 3)]);
    room.phase = 'sguess'; sp.tEnd = T() + 25000; sp.botAt = T() + 3000 + Math.random() * 2000;
    lg(room, '🎯 اتكشف! ' + room.players[top].name + ' كان جاسوس، وهيخمّن الكلمة السرية', 'sys'); bcast(room);
  } else {
    sp.caught = null; lg(room, maj ? '🙈 صوتوا على واحد بريء!' : '🤷 مفيش أغلبية اتفقت على حد', 'bad'); finishSpy(room, 'spy', false);
  }
}
function finishSpy(room, winner, guessed) {
  const sp = room.sp, pts = {};
  if (winner === 'spy') { for (const id of sp.spies) if (room.players[id]) pts[id] = 5 }
  else { for (const id of sp.order) if (!sp.spies.includes(id) && room.players[id] && sp.votes[id] && sp.spies.includes(sp.votes[id])) pts[id] = 5 }
  if (winner === 'town' && !Object.keys(pts).length) for (const id of sp.order) if (!sp.spies.includes(id) && room.players[id]) pts[id] = 5;
  for (const id in pts) room.players[id].score += 5;
  sp.res = { winner, guessed, caught: sp.caught || null, pts };
  addRH(room, Object.keys(pts).map(id => room.players[id].name), (winner === 'spy' ? 'كسب الجاسوس' : 'كسب الفريق') + (guessed ? ' (خمّن الكلمة صح)' : ''));
  lg(room, winner === 'spy' ? '🕵️ الجاسوس كسب!' : '🎉 الفريق كسب!', 'win');
  room.phase = 'sres'; for (const p of Object.values(room.players)) p.ready = false; bcast(room);
}
function spyGuess(room, idx) {
  const sp = room.sp, ok = sp.opts[idx] === sp.secret; lg(room, (ok ? '✅ ' : '❌ ') + room.players[sp.guesser].name + ' اختار "' + CATS[room.cat].items[sp.opts[idx]].n + '"', ok ? 'win' : 'bad');
  finishSpy(room, ok ? 'spy' : 'town', ok);
}
function botGuess(room) {
  const sp = room.sp, cat = CATS[room.cat], real = sp.clues.filter(c => c.text && c.text.length > 1);
  const sc = sp.opts.map((i, k) => ({ k, s: real.reduce((a, c) => a + fit(cat, cat.items[i], c.text), 0) + Math.random() * .7 })); sc.sort((a, b) => b.s - a.s); spyGuess(room, sc[0].k);
}
function spyDrop(room, id) {
  const sp = room.sp; if (!sp || room.phase === 'sres') return;
  const i = sp.order.indexOf(id); if (i < 0) return;
  const wasTurn = room.phase === 'sclue' && i === sp.ti; sp.order.splice(i, 1); if (i < sp.ti || wasTurn) sp.ti--;
  delete sp.votes[id]; for (const k in sp.votes) if (sp.votes[k] === id) delete sp.votes[k];
  const gone = sp.spies.includes(id); sp.spies = sp.spies.filter(x => x !== id);
  if (!sp.spies.length || sp.order.length < 3 || (room.phase === 'sguess' && sp.guesser === id)) { room.phase = 'lobby'; room.sp = null; room.seats = []; lg(room, '🚫 الجولة اتلغت لأن ' + (gone ? 'الجاسوس' : 'لاعب') + ' خرج', 'bad'); return }
  if (room.phase === 'sclue' && wasTurn) nextClue(room); else if (room.phase === 'svote') voteDone(room);
}
function spyView(room, p) {
  const sp = room.sp, me = p.id, isSpy = sp.spies.includes(me), res = room.phase === 'sres', cat = CATS[room.cat], sec = cat.items[sp.secret];
  const item = i => ({ n: cat.items[i].n, i: cat.items[i].i });
  const o = { n: sp.n, k: sp.spies.length, order: sp.order, turn: sp.order[sp.ti] || null, clues: sp.clues, left: Math.max(0, Math.round((sp.tEnd - T()) / 1000)), spy: isSpy, mates: isSpy ? sp.spies.filter(x => x !== me) : [], secret: res || (!isSpy && sp.order.includes(me)) ? item(sp.secret) : null, voted: Object.keys(sp.votes), mine: sp.votes[me] || null, guesser: room.phase === 'sguess' ? sp.guesser : null, opts: (room.phase === 'sguess' && me === sp.guesser) ? sp.opts.map(item) : null, tdur: room.phase === 'sclue' ? room.clueT : room.phase === 'svote' ? room.voteT : 25 };
  if (res) o.res = { ...sp.res, spies: sp.spies, votes: sp.votes, tally: sp.tally || {}, opts: sp.opts ? sp.opts.map(item) : null, secretIdx: sp.opts ? sp.opts.indexOf(sp.secret) : -1 };
  return o;
}
function spyTick(room, now) {
  const sp = room.sp; if (!sp) return;
  if (room.phase === 'sclue') {
    const id = sp.order[sp.ti], pl = room.players[id];
    if (!pl) return nextClue(room);
    if (pl.bot) { if (now >= sp.botAt) botClue(room, id) }
    else if (!pl.ws) { sp.clues.push({ id, text: '📵' }); nextClue(room) }
    else if (now >= sp.tEnd) { sp.clues.push({ id, text: '⌛' }); lg(room, '⌛ ' + pl.name + ' الوقت خلص عليه'); nextClue(room) }
    else if (Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000); bcast(room) }
  } else if (room.phase === 'svote') {
    for (const id in sp.bv) if (now >= sp.bv[id] && !sp.votes[id] && room.players[id]) { sp.votes[id] = botVoteFor(room, id); delete sp.bv[id]; bcast(room) }
    if (voteDone(room)) return;
    if (now >= sp.tEnd) endVote(room);
    else if (Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000); bcast(room) }
  } else if (room.phase === 'sguess') {
    const g = room.players[sp.guesser];
    if (!g) return;
    if (g.bot) { if (now >= sp.botAt) botGuess(room) }
    else if (now >= sp.tEnd || !g.ws) { lg(room, '⌛ الجاسوس مخمّنش في الوقت', 'bad'); finishSpy(room, 'town', false) }
    else if (Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000); bcast(room) }
  }
}
function spyMsg(room, p, m) {
  const sp = room.sp; if (!sp) return;
  if (room.phase === 'sclue' && m.t === 'clue' && sp.order[sp.ti] === p.id) {
    const x = clean(m.text, 24).split(/\s+/).slice(0, 3).join(' '); if (!x) return;
    sp.clues.push({ id: p.id, text: x }); lg(room, '🗣 ' + p.name + ': ' + x, 'q'); nextClue(room);
  } else if (room.phase === 'svote' && m.t === 'svote') {
    if (sp.order.includes(p.id) && sp.order.includes(m.id) && m.id !== p.id && room.players[m.id]) { sp.votes[p.id] = m.id; if (!voteDone(room)) bcast(room) }
  } else if (room.phase === 'sguess' && m.t === 'sguess' && p.id === sp.guesser) {
    const k = m.k | 0; if (k >= 0 && k < sp.opts.length) spyGuess(room, k);
  }
}
// ================= المبارزة =================
const DB = (() => { const b = JSON.parse(read('bank.json').toString()), L = []; for (const k of Object.keys(b)) for (const [q, a] of b[k]) L.push({ c: k, q, a }); return { L, cats: [['mixed', 'منوّع (كله)', '🎲'], ['egypt', 'مصر ومعالمها', '🏛️'], ['food', 'أكل مصري', '🍲'], ['art', 'فن ومسلسلات ومشاهير', '🎬'], ['sport', 'رياضة', '⚽'], ['hist', 'تاريخ وجغرافيا', '🌍'], ['riddle', 'ألغاز وتخمين', '🧩'], ['funny', 'هزار ومواقف مضحكة', '😂'], ['whatif', 'إيه اللي هيحصل لو', '🤔'], ['games', 'ألعاب فيديو وإنترنت', '🎮'], ['unexp', 'حاجات مش متوقعة', '😲'], ['icon', 'أسئلة أيقونية', '🏆']].map(x => ({ id: x[0], name: x[1], emoji: x[2], n: x[0] === 'mixed' ? L.length : L.filter(y => y.c === x[0]).length })) } })();
function dealQ(room) {
  const du = room.du, pool = []; DB.L.forEach((x, i) => { if ((room.dcat === 'mixed' || x.c === room.dcat) && !du.used.has(i)) pool.push(i) });
  if (!pool.length) { du.used.clear(); lg(room, '♻️ خلصت أسئلة المجال، بنعيد', 'sys'); DB.L.forEach((x, i) => { if (room.dcat === 'mixed' || x.c === room.dcat) pool.push(i) }) }
  const i = pick(pool); du.used.add(i); return DB.L[i];
}
function startDuel(room) {
  cleanBots(room, 2);
  const ids = Object.keys(room.players);
  room.game = 'duel'; room.round++; room.seats = []; room.pend = null; room.bp = {}; room.bs = {}; room.log = [];
  for (const p of Object.values(room.players)) p.ready = false;
  const used = room.dused || (room.dused = new Set());
  room.du = { alive: ids.slice(), rounds: [], r: -1, pairs: [], pi: -1, cur: null, res: null, champ: null, used, hadBye: {}, skt: {}, tEnd: 0, off: {} };
  lg(room, '⚔️ بدأت بطولة المبارزة!', 'win'); duelRound(room);
}
function duelRound(room) {
  const du = room.du, al = shuf(du.alive); let bye = null;
  if (al.length % 2) { const c = al.filter(x => !du.hadBye[x]); bye = (c.length ? c : al)[Math.floor(Math.random() * (c.length || al.length))]; du.hadBye[bye] = 1; al.splice(al.indexOf(bye), 1) }
  const pairs = []; for (let i = 0; i < al.length; i += 2) pairs.push({ a: al[i], b: al[i + 1], w: null });
  if (bye) pairs.push({ a: bye, b: null, w: bye, bye: true, done: true });
  du.r++; du.pairs = pairs; du.rounds.push(pairs); du.pi = -1; du.cur = null;
  if (bye) lg(room, '🎫 ' + room.players[bye].name + ' عدّى بالـ bye', 'sys');
  room.phase = 'dwait'; du.tEnd = T() + 6000; bcast(room);
}
const dnm = (room, id) => room.players[id] ? room.players[id].name : '؟';
function duelNext(room) {
  const du = room.du;
  while (true) {
    du.pi++;
    if (du.pi >= du.pairs.length) { // round done
      const w = du.pairs.map(p => p.w).filter(x => x && room.players[x]);
      du.alive = w;
      if (w.length <= 1) return duelChamp(room, w[0] || null);
      return duelRound(room);
    }
    const pr = du.pairs[du.pi]; if (pr.done) continue;
    const ga = room.players[pr.a] && du.alive.includes(pr.a), gb = room.players[pr.b] && du.alive.includes(pr.b);
    if (!ga || !gb) { pr.w = ga ? pr.a : gb ? pr.b : null; pr.done = true; pr.ff = 1; continue }
    return duelBegin(room, pr);
  }
}
function duelBegin(room, pr) {
  const du = room.du;
  du.cur = { a: pr.a, b: pr.b, half: 1, asker: pr.a, ans: pr.b, sc: { [pr.a]: 0, [pr.b]: 0 }, sk: { [pr.a]: 0, [pr.b]: 0 }, q: null, sd: 0, sdL: {}, n: 0 };
  room.phase = 'dintro'; du.tEnd = T() + 5000; lg(room, '⚔️ ' + dnm(room, pr.a) + ' ضد ' + dnm(room, pr.b), 'sys'); bcast(room);
}
function duelAsk(room) {
  const du = room.du, c = du.cur; c.q = dealQ(room); c.n++; c.botAt = T() + 3500 + Math.random() * 4500;
}
function duelHalf(room) {
  const du = room.du, c = du.cur; room.phase = 'dplay'; du.tEnd = c.sd ? 0 : T() + room.dT * 1000; duelAsk(room); bcast(room);
}
function duelJudge(room, ok, skip) {
  const du = room.du, c = du.cur; if (room.phase !== 'dplay' || !c.q) return;
  if (c.sd) {
    if (skip) return;
    c.sdL[c.ans] = !!ok; lg(room, (ok ? '✅ ' : '❌ ') + dnm(room, c.ans), ok ? 'win' : 'bad');
    if (c.sd === 1) { c.sd = 2; const t = c.asker; c.asker = c.ans; c.ans = t; duelAsk(room); bcast(room); return }
    const ra = c.sdL[c.a], rb = c.sdL[c.b];
    if (ra !== rb) return duelEnd(room, ra ? c.a : c.b, 'sd');
    c.sd = 1; c.sdL = {}; c.asker = c.half % 2 ? c.b : c.a; c.ans = c.asker === c.a ? c.b : c.a; c.sdr = (c.sdr || 0) + 1; c.half++; duelAsk(room); bcast(room); return;
  }
  if (skip) { c.sk[c.asker]++; du.skt[c.asker] = (du.skt[c.asker] || 0) + 1; lg(room, '⏭️ ' + dnm(room, c.asker) + ' تخطى سؤال', 'sys') }
  else if (ok) { c.sc[c.ans]++; lg(room, '✅ ' + dnm(room, c.ans) + ' جاوب صح', 'win') } else lg(room, '❌ ' + dnm(room, c.ans) + ' غلط', 'bad');
  duelAsk(room); bcast(room);
}
function duelTimeUp(room) {
  const du = room.du, c = du.cur;
  if (c.half === 1) { c.half = 2; const t = c.asker; c.asker = c.ans; c.ans = t; c.q = null; room.phase = 'dmid'; du.tEnd = T() + 5000; lg(room, '🔄 النص التاني: اتبدلت الأدوار', 'sys'); return bcast(room) }
  const A = c.sc[c.a], B = c.sc[c.b];
  if (A !== B) return duelEnd(room, A > B ? c.a : c.b, 'score');
  if (c.sk[c.a] !== c.sk[c.b]) return duelEnd(room, c.sk[c.a] < c.sk[c.b] ? c.a : c.b, 'skips');
  c.sd = 1; c.sdL = {}; c.half = 3; c.asker = c.a; c.ans = c.b; c.q = null; c.tie = 1; room.phase = 'dsd'; du.tEnd = T() + 4000; lg(room, '⚡ تعادل! سؤال واحد لكل واحد (موت مفاجئ)', 'sys'); bcast(room);
}
function duelEnd(room, w, how) {
  const du = room.du, c = du.cur, l = w === c.a ? c.b : c.a, pr = du.pairs[du.pi];
  pr.w = w; pr.done = true; pr.sa = c.sc[c.a]; pr.sb = c.sc[c.b];
  if (room.players[w]) room.players[w].score += 10;
  if (how !== 'ff' && room.players[l]) room.players[l].score += 5;
  addRH(room, [dnm(room, w)], 'مبارزة ضد ' + dnm(room, l) + ' (' + c.sc[w] + '-' + c.sc[l] + (how === 'sd' ? ' بالموت المفاجئ' : how === 'skips' ? ' بالتخطي الأقل' : how === 'ff' ? ' انسحاب' : '') + ')');
  du.res = { w, l, a: c.a, b: c.b, sa: c.sc[c.a], sb: c.sc[c.b], ka: c.sk[c.a], kb: c.sk[c.b], how };
  lg(room, '🏅 ' + dnm(room, w) + ' كسب المبارزة', 'win');
  room.phase = 'dres'; du.tEnd = T() + 7000; c.q = null; bcast(room);
}
function duelChamp(room, id) {
  const du = room.du; du.champ = id; room.phase = 'dchamp'; du.cur = null; du.tEnd = 0;
  if (id) { addRH(room, [dnm(room, id)], '👑 بطل المبارزة'); lg(room, '👑 ' + dnm(room, id) + ' بطل المبارزة!', 'win') }
  for (const p of Object.values(room.players)) p.ready = false; bcast(room);
}
function duelDrop(room, id) {
  const du = room.du; if (!du || room.phase === 'dchamp') return;
  du.alive = du.alive.filter(x => x !== id);
  const c = du.cur, inDuel = c && (c.a === id || c.b === id);
  if (inDuel && ['dintro', 'dplay', 'dmid', 'dsd'].includes(room.phase)) { duelEnd(room, id === c.a ? c.b : c.a, 'ff'); return }
  if (room.phase === 'dwait' && du.pi < 0) { // future pairs adjust at duelNext
  }
  if (du.alive.length < 2 && ['dwait'].includes(room.phase) && du.pi < 0 && du.pairs.every(p => p.done || !room.players[p.a] || !room.players[p.b])) { /* tick will proceed */ }
}
function duelTick(room, now) {
  const du = room.du; if (!du) return;
  const c = du.cur, ph = room.phase;
  if (c && ['dintro', 'dplay', 'dmid', 'dsd'].includes(ph)) { // offline forfeit
    for (const id of [c.a, c.b]) { const p = room.players[id]; if (p && !p.bot && !p.ws) { du.off[id] = du.off[id] || now; if (now - du.off[id] > 20000) { delete du.off[id]; duelEnd(room, id === c.a ? c.b : c.a, 'ff'); return } } else delete du.off[id] }
  }
  if (ph === 'dwait') { if (now >= du.tEnd) duelNext(room) }
  else if (ph === 'dintro') { if (now >= du.tEnd) duelHalf(room) }
  else if (ph === 'dmid') { if (now >= du.tEnd) duelHalf(room) }
  else if (ph === 'dsd') { if (now >= du.tEnd) duelHalf(room) }
  else if (ph === 'dres') { if (now >= du.tEnd) duelNext(room) }
  else if (ph === 'dplay') {
    if (!c.sd && now >= du.tEnd) return duelTimeUp(room);
    const ap = room.players[c.asker];
    if (ap && ap.bot && now >= c.botAt) { const ok = Math.random() < .6; if (!c.sd && Math.random() < .08) duelJudge(room, false, true); else duelJudge(room, ok, false); return }
    if (Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000); bcast(room) }
  }
}
function duelView(room, p) {
  const du = room.du, c = du.cur, me = p.id, ph = room.phase;
  const o = { r: du.r, pairs: du.pairs.map(x => ({ a: x.a, b: x.b, w: x.w, bye: !!x.bye, done: !!x.done, sa: x.sa, sb: x.sb })), pi: du.pi, rounds: du.rounds.map(rr => rr.map(x => ({ a: x.a, b: x.b, w: x.w, bye: !!x.bye }))), champ: du.champ, res: ph === 'dres' ? du.res : null, tl: du.tEnd ? Math.max(0, Math.round((du.tEnd - T()) / 1000)) : 0, dT: room.dT, alive: du.alive };
  if (c) { o.cur = { a: c.a, b: c.b, asker: c.asker, ans: c.ans, half: c.half, sc: c.sc, sk: c.sk, sd: c.sd, n: c.n, q: (me === c.asker && ph === 'dplay' && c.q) ? { q: c.q.q, a: c.q.a, c: c.q.c } : null } }
  return o;
}
function leaveRoom(room, p, ws) {
  delete room.players[p.id]; ws.room = null; ws.pid = null; if (room.bp) delete room.bp[p.id]; if (room.bs) delete room.bs[p.id];
  for (const q of Object.values(room.players)) send(q.ws, { t: 'vleave', from: p.id });
  const hum = Object.values(room.players).filter(x => !x.bot);
  if (!hum.length) { delete rooms[room.code]; return }
  if (room.host === p.id) { const n = hum.find(x => x.ws) || hum[0]; room.host = n.id }
  sys(room, p.name + ' خرج من الغرفة');
  if (room.game === 'spy' && room.sp) { spyDrop(room, p.id); bcast(room); return }
  if (room.game === 'duel' && room.du && room.phase[0] === 'd') { duelDrop(room, p.id); bcast(room); return }
  if (room.phase !== 'lobby' && room.game === 'who') { const i = room.seats.findIndex(s => s.id === p.id); if (i >= 0) { const wasTurn = i === room.turn; room.seats.splice(i, 1); if (i < room.turn) room.turn--; if (wasTurn) room.turn--; if (room.phase === 'play') { if (live(room).length <= 1) finish(room); else if (wasTurn) nextTurn(room) } } }
  if (room.phase !== 'lobby' && room.game === 'who' && checkVote(room)) return;
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
        const hn = Object.keys(room.players).length;
        if (hn >= MAXSEATS) { const b = Object.values(room.players).find(x => x.bot && x.auto) || Object.values(room.players).find(x => x.bot); if (b) delete room.players[b.id]; else return send(ws, { t: 'err', e: 'الغرفة كاملة' }) }
      }
    }
    if (!p) { const id = rid(); p = room.players[id] = { id, name, score: 0 }; if (!room.host) room.host = id; sys(room, name + ' دخل الغرفة') }
    p.ws = ws; ws.room = room; ws.pid = p.id;
    send(ws, { t: 'hello', cats: DATA.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, n: c.items.length })), dcats: DB.cats, token: p.id, code: room.code }); bcast(room); return;
  }
  const room = ws.room, p = room && room.players[ws.pid]; if (!p) return;
  const host = room.host === p.id;
  if (m.t === 'leave') { leaveRoom(room, p, ws); return }
  if (m.t === 'rtc') { const q = room.players[m.to]; if (q && q.ws && m.d && typeof m.d === 'object') send(q.ws, { t: 'rtc', from: p.id, d: m.d }); return }
  if (m.t === 'vjoin' || m.t === 'vleave') { p.mic = m.t === 'vjoin' ? 1 : 0; p.mm = 0; for (const q of Object.values(room.players)) if (q.id !== p.id) send(q.ws, { t: m.t, from: p.id }); bcast(room); return }
  if (m.t === 'vflag') { p.mic = 1; p.mm = m.m ? 1 : 0; bcast(room); return }
  if (m.t === 'chat') { const x = clean(m.text, 200); if (x) { room.chat.push({ id: p.id, name: p.name, text: x }); if (room.chat.length > 120) room.chat.shift(); bcast(room) } return }
  if (m.t === 'emo') { const e = String(m.e || '').slice(0, 8); for (const q of Object.values(room.players)) send(q.ws, { t: 'emo', from: p.id, name: p.name, e }); return }
  if (m.t === 'vmute') { p.mm = m.m ? 1 : 0; bcast(room); return }
  if (host && m.t === 'kick') { const q = room.players[m.id]; if (q && q.id !== p.id) { if (q.ws) send(q.ws, { t: 'kicked' }); const w = q.ws || {}; leaveRoom(room, q, w) } return }
  if (host && m.t === 'host') { const q = room.players[m.id]; if (q && !q.bot && q.ws) { room.host = q.id; sys(room, q.name + ' بقى الهوست 👑'); bcast(room) } return }
  if (host && m.t === 'tolobby' && room.phase !== 'lobby') { room.phase = 'lobby'; room.seats = []; room.sp = null; room.du = null; room.pend = null; for (const x of Object.values(room.players)) x.ready = false; bcast(room); return }
  const startGame = () => { room.game === 'spy' ? startSpy(room) : room.game === 'duel' ? startDuel(room) : startRound(room) };
  const chkReady = () => { const hum = Object.values(room.players).filter(x => !x.bot && x.ws); if (hum.length && hum.every(x => x.ready)) startGame(); else bcast(room) };
  if (room.phase === 'lobby') {
    if (m.t === 'ready') { p.ready = !p.ready; chkReady(); return }
    if (!host) return;
    if (m.t === 'set') {
      if (CATS[m.cat]) room.cat = m.cat; if (m.game === 'who' || m.game === 'spy' || m.game === 'duel') room.game = m.game;
      if (m.dcat && DB.cats.some(c => c.id === m.dcat)) room.dcat = m.dcat; if (m.dT) room.dT = Math.max(20, Math.min(600, +m.dT | 0));
      if (m.dur) room.dur = Math.max(20, Math.min(1800, +m.dur | 0)); if (m.spies) room.spies = m.spies == 2 ? 2 : 1;
      if (m.clueT) room.clueT = Math.max(10, Math.min(90, +m.clueT | 0)); if (m.voteT) room.voteT = Math.max(20, Math.min(240, +m.voteT | 0));
      for (const x of Object.values(room.players)) x.ready = false; bcast(room)
    }
    else if (m.t === 'addbot') { if (Object.keys(room.players).length < MAXSEATS) { const bid = 'b' + rid(), taken = new Set(Object.values(room.players).map(x => x.name)); room.players[bid] = { id: bid, name: BOTN.find(x => !taken.has(x)) || 'بوت ' + bid.slice(1, 3), bot: true, score: 0 }; bcast(room) } }
    else if (m.t === 'rmbot') { const b = Object.values(room.players).find(x => x.bot); if (b) delete room.players[b.id]; bcast(room) }
    else if (m.t === 'start') { startGame() }
    return;
  }
  if (room.game === 'duel' && room.phase[0] === 'd' && room.du) {
    const c = room.du.cur;
    if (room.phase === 'dchamp' && m.t === 'ready') { p.ready = !p.ready; chkReady(); return }
    if (room.phase === 'dplay' && c && c.asker === p.id) { if (m.t === 'ans') duelJudge(room, !!m.ok, false); else if (m.t === 'skip') duelJudge(room, false, true) }
    return;
  }
  if (room.game === 'spy' && room.phase[0] === 's') {
    if (room.phase === 'sres' && m.t === 'ready') { p.ready = !p.ready; chkReady(); return }
    return spyMsg(room, p, m);
  }
  const sd = room.seats.find(s => s.id === p.id);
  if (room.phase === 'break' || room.phase === 'result') {
    room.bs = room.bs || {};
    if (m.t === 'bpick') { if (room.seats.some(s => s.id === m.id)) { room.bp[p.id] = m.id; delete room.bs[p.id]; if (!checkVote(room)) bcast(room) } }
    else if (m.t === 'bskip') { if (room.bs[p.id]) delete room.bs[p.id]; else { room.bs[p.id] = 1; delete room.bp[p.id] } if (!checkVote(room)) bcast(room) }
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
    sd.hints.push(h); sd.hu++; lg(room, '💡 ' + p.name + ' أخد تلميح', 'hint'); bcast(room)
  }
}
wss.on('connection', ws => {
  ws.on('message', d => { try { msg(ws, JSON.parse(d)) } catch (e) { console.error(e) } });
  ws.on('close', () => { const room = ws.room; if (room) { const p = room.players[ws.pid]; if (p && p.ws === ws) { p.ws = null; p.mic = 0; p.ready = false; if (room.phase !== 'lobby' && room.game === 'who' && checkVote(room)) return; if (room.phase === 'svote') voteDone(room); bcast(room) } } });
});
srv.listen(PORT, () => console.log('up ' + PORT));
