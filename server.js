const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const C = require('./case1.js');
const W = require('./who.js');
const PORT = process.env.PORT || 3000;
const read = f => fs.readFileSync(path.join(__dirname, f));
const IMG = {};
for (const k of ['scene', 's1', 's2', 's3', 'board']) IMG[k] = Buffer.from(require('./img_' + k + '.js'), 'base64');
const HTML = read('index.html'), JS = read('game.js'), WJS = read('whoc.js');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/health') { r.end('ok'); return }
  if (u === '/rooms') {
    const l = Object.values(rooms).filter(x => x.phase === 'lobby' && Object.keys(x.players).length + (x.bots ? x.bots.length : 0) < (x.mode === 'who' ? 3 : 4) && Object.values(x.players).some(p => p.ws)).map(x => ({ code: x.code, host: (x.players[x.host] || {}).name, n: Object.keys(x.players).length, mode: x.mode || 'co' }));
    r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(l)); return;
  }
  let m = u.match(/^\/img\/(\w+)\.jpg$/);
  if (m && IMG[m[1]]) { r.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public,max-age=86400' }); r.end(IMG[m[1]]); return }
  if (u === '/whoc.js') { r.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache' }); r.end(WJS); return }
  if (u === '/game.js') { r.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache' }); r.end(JS); return }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); r.end(HTML);
});
const wss = new WebSocketServer({ server: srv, maxPayload: 8192 });
const rooms = {};
const rid = () => Math.random().toString(36).slice(2, 10);
const mkcode = () => { let c; do { c = String(Math.floor(1000 + Math.random() * 9000)) } while (rooms[c]); return c };
const clean = (s, n) => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, n || 200);
const pick = a => a[Math.floor(Math.random() * a.length)];
const ROLES = { field: 'المحقق الميداني', coroner: 'الطبيب الشرعي', prints: 'خبير البصمات', chief: 'رئيس المباحث' };
const norm = s => String(s).replace(/[\u064B-\u065F\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ي').replace(/[؟?!.,،؛:"'()\-_]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
// تطبيع الكلمات المفتاحية مرة واحدة
for (const sid of C.sus) for (const t of C.S[sid].topics) t.kn = t.k.map(norm);

function newRoom() {
  const sus = {};
  for (const s of C.sus) sus[s] = { stress: 0, gone: false, pres: [], cracked: [], asked: {}, log: [] };
  return { code: mkcode(), phase: 'lobby', players: {}, chat: [], found: [], spots: [], lifted: [], gates: {}, sus, board: { items: [], links: [] }, strikes: 0, votes: {}, tod: false, pmiss: 0, result: null, created: Date.now() };
}
function send(ws, m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)) }
const roleOf = (room, role) => Object.values(room.players).find(x => x.role === role);
const can = (room, p, role) => p.role === role || !roleOf(room, role);
const mood = (S) => S.cracked.length ? 'انهار' : S.stress >= 70 ? 'على وشك الانهيار' : S.stress >= 35 ? 'متوتر' : 'هادي';
function state(room, p) {
  if (room.mode === 'who') return W.state(room, p);
  return {
    t: 'state', code: room.code, phase: room.phase, you: p.id, host: room.host,
    players: Object.values(room.players).map(x => ({ id: x.id, name: x.name, role: x.role, on: !!x.ws })),
    found: room.found.map(id => ({ id, kind: C.ev[id].kind, title: C.ev[id].title, desc: C.ev[id].desc })),
    spots: room.spots, gates: room.gates, board: room.board, strikes: room.strikes, votes: room.votes,
    lifted: room.lifted.map(id => ({ id, name: C.prints[id].name, seed: C.prints[id].seed, done: room.found.includes(C.prints[id].ev) })),
    canLift: room.found.filter(id => C.ev[id].print && !room.lifted.includes(C.ev[id].print)).map(id => ({ clue: id, title: C.ev[id].title })),
    tod: room.tod, todDone: room.found.includes('f_tod'),
    sus: Object.fromEntries(C.sus.map(s => [s, { mood: mood(room.sus[s]), stress: room.sus[s].stress, gone: room.sus[s].gone, cracked: room.sus[s].cracked.length, log: room.sus[s].log.slice(-40) }])),
    chat: room.chat.slice(-80), result: room.result
  };
}
function bcast(room) { for (const p of Object.values(room.players)) send(p.ws, state(room, p)) }
function sys(room, text) { room.chat.push({ s: 1, text }); if (room.chat.length > 200) room.chat.shift() }
function toast(p, text) { send(p.ws, { t: 'toast', text }) }
function find(room, id, by, label) {
  if (room.found.includes(id)) return false;
  room.found.push(id);
  sys(room, '🔎 ' + (label || '') + 'اتضاف دليل: ' + C.ev[id].title);
  return true;
}
function score(room, win) {
  const keys = C.keyEv.filter(k => room.found.includes(k)).length;
  const linked = new Set(room.board.links.map(l => [l[0], l[1]].sort().join('|')));
  const good = C.goodLinks.filter(l => linked.has([l[0], l[1]].sort().join('|'))).length;
  let sc = keys * 10 + good * 6 + (room.found.includes('t_man2') ? 15 : 0) - room.strikes * 20 - room.pmiss * 2;
  if (!win) sc = Math.max(0, sc - 30);
  const rank = sc >= 170 ? 'لواء' : sc >= 130 ? 'عميد' : sc >= 95 ? 'عقيد' : sc >= 60 ? 'رائد' : 'نقيب';
  return { sc, rank, keys, totalKeys: C.keyEv.length, good, totalGood: C.goodLinks.length };
}
function unlockStage(room, id) { return !id || room.gates[id] }

// ======= الاستجواب =======
function checkCrack(room, sid) {
  const S = C.S[sid], st = room.sus[sid];
  const list = Array.isArray(S.crack) ? S.crack : [S.crack];
  const out = [];
  for (const c of list) {
    if (st.cracked.includes(c.reveal)) continue;
    if (c.after && !st.cracked.includes(c.after)) continue;
    const n = c.from.filter(e => st.pres.includes(e)).length;
    if (n < c.need) continue;
    if (c.needStress && st.stress < c.needStress) continue;
    st.cracked.push(c.reveal);
    st.stress = Math.min(100, Math.max(st.stress, 90));
    out.push(c.text);
    find(room, c.reveal, null, '');
    if (c.extra) find(room, c.extra, null, '');
    sys(room, '🔓 ' + S.name + ' انهار وقال حاجة جديدة');
    break;
  }
  return out;
}
function ask(room, p, sid, text) {
  const S = C.S[sid], st = room.sus[sid];
  if (!S || st.gone) return;
  text = clean(text, 160); if (!text) return;
  st.log.push({ who: p.name, role: p.role, q: text });
  const nt = norm(text);
  let best = null, bl = 0;
  for (const t of S.topics) for (const k of t.kn) if (nt.includes(k) && k.length > bl) { best = t; bl = k.length }
  let rep, key = st.stress >= 35 ? 'n' : 'c';
  if (best) {
    const cnt = st.asked[best.id] = (st.asked[best.id] || 0) + 1;
    let s = best.s;
    if (best.ev && room.found.includes(best.ev)) { s += 8; key = 'n' }
    if (cnt >= 3) s += 3;
    st.stress = Math.max(0, Math.min(100, st.stress + s));
    if (st.stress >= 35) key = 'n';
    rep = pick(best[key]);
    if (cnt >= 3) rep += ' (قلتلك ده قبل كدا.)';
  } else {
    st.stress = Math.min(100, st.stress + 1);
    rep = pick(S.fb[key]);
  }
  st.log.push({ s: 1, text: rep });
  sys(room, '🗣 ' + p.name + ' سأل ' + S.name);
  room.chat.pop();
  if (st.log.length > 80) st.log.splice(0, 20);
  bcast(room);
}
function confront(room, p, sid, ev) {
  const S = C.S[sid], st = room.sus[sid];
  if (!S || st.gone || !room.found.includes(ev)) return;
  st.log.push({ who: p.name, role: p.role, q: '[واجهه بدليل] ' + C.ev[ev].title, ev: 1 });
  if (!st.pres.includes(ev)) st.pres.push(ev);
  const r = S.evr[ev];
  let rep;
  if (r) { st.stress = Math.max(0, Math.min(100, st.stress + r.s)); rep = st.stress >= 35 ? r.n : r.c }
  else { st.stress = Math.min(100, st.stress + 2); rep = pick(['ده يخصني إزاي؟', 'ماعرفش حاجة عن ده.', 'مش فاهم قصدك بالدليل ده.']) }
  st.log.push({ s: 1, text: rep });
  for (const t of checkCrack(room, sid)) st.log.push({ s: 1, text: t, crack: 1 });
  if (st.log.length > 80) st.log.splice(0, 20);
  bcast(room);
}

function leaveRoom(room, p, ws) {
  delete room.players[p.id]; ws.room = null; ws.pid = null;
  for (const q of Object.values(room.players)) send(q.ws, { t: 'vleave', from: p.id });
  if (!Object.keys(room.players).length) { delete rooms[room.code]; return }
  if (room.host === p.id) { const n = Object.values(room.players).find(x => x.ws) || Object.values(room.players)[0]; room.host = n.id }
  sys(room, p.name + ' خرج من الغرفة'); bcast(room);
}
function msg(ws, m) {
  if (m.t === 'create' || m.t === 'join') {
    let room, p;
    const name = clean(m.name, 20) || 'لاعب';
    if (m.t === 'create') { if (m.mode === 'who') { room = W.newRoom(mkcode()); room.bcast = bcast } else room = newRoom(); rooms[room.code] = room }
    else {
      room = rooms[clean(m.code)]; if (!room) return send(ws, { t: 'err', e: 'الكود ده مش موجود' });
      if (m.token && room.players[m.token]) p = room.players[m.token];
      else {
        if (room.phase !== 'lobby' && !(room.mode === 'who' && room.phase === 'result')) return send(ws, { t: 'err', e: 'اللعبة بدأت بالفعل' });
        if (room.mode === 'who') { const hn = Object.values(room.players).filter(x => x.ws).length; if (hn + room.bots.length >= 3) { if (room.bots.length) room.bots.pop(); else return send(ws, { t: 'err', e: 'الغرفة كاملة (3 لاعبين)' }) } }
        else if (Object.keys(room.players).length >= 4) return send(ws, { t: 'err', e: 'الغرفة كاملة' })
      }
    }
    if (!p) { const id = rid(); p = room.players[id] = { id, name, role: null }; if (!room.host) room.host = id; sys(room, name + ' دخل الغرفة') }
    p.ws = ws; ws.room = room; ws.pid = p.id;
    send(ws, { t: 'hello', cfg: room.mode === 'who' ? W.cfg() : CFG, token: p.id, code: room.code }); bcast(room); return;
  }
  const room = ws.room, p = room && room.players[ws.pid]; if (!p) return;
  const isChief = can(room, p, 'chief') || p.id === room.host && !roleOf(room, 'chief');
  if (m.t === 'leave') { leaveRoom(room, p, ws); return }
  if (m.t === 'rtc') { const q = room.players[m.to]; if (q && q.ws && m.d && typeof m.d === 'object') send(q.ws, { t: 'rtc', from: p.id, d: m.d }); return }
  if (m.t === 'vjoin' || m.t === 'vleave') { for (const q of Object.values(room.players)) if (q.id !== p.id) send(q.ws, { t: m.t, from: p.id }); return }
  if (room.mode === 'who') return W.msg(room, p, m);
  if (m.t === 'chat') { const text = clean(m.text); if (!text) return; room.chat.push({ n: p.name, role: p.role, text }); if (room.chat.length > 200) room.chat.shift(); return bcast(room) }
  if (m.t === 'role' && room.phase === 'lobby') {
    if (m.role === null) p.role = null;
    else if (ROLES[m.role] && !Object.values(room.players).some(x => x.role === m.role && x !== p)) p.role = m.role;
    return bcast(room);
  }
  if (m.t === 'start' && room.phase === 'lobby' && p.id === room.host) {
    room.phase = 'play'; sys(room, 'بدأ التحقيق. ' + C.title); return bcast(room);
  }
  if (room.phase === 'over' && m.t === 'again' && p.id === room.host) {
    const players = room.players, code = room.code; const n = newRoom(); n.code = code; n.players = players; n.host = room.host; n.created = room.created;
    for (const q of Object.values(n.players)) q.role = q.role;
    rooms[code] = n; for (const q of Object.values(players)) if (q.ws) q.ws.room = n; return bcast(n);
  }
  if (room.phase !== 'play') return;

  // --- المحقق الميداني ---
  if (m.t === 'collect') {
    if (!can(room, p, 'field')) return toast(p, 'ده شغل المحقق الميداني');
    const sp = C.spots.find(s => s.id === m.h); if (!sp) return;
    if (sp.gate && !room.gates[sp.gate]) return toast(p, 'المكان ده مقفول. اطلب من رئيس المباحث يفتحه');
    if (!sp.clue) { return toast(p, sp.empty) }
    if (room.spots.includes(sp.id)) return toast(p, 'جمعتوا الدليل ده قبل كدا');
    room.spots.push(sp.id); find(room, sp.clue, p, '[' + p.name + '] '); return bcast(room);
  }
  if (m.t === 'lift') {
    if (!can(room, p, 'field')) return toast(p, 'ده شغل المحقق الميداني');
    const e = C.ev[m.clue]; if (!e || !e.print || !room.found.includes(m.clue) || room.lifted.includes(e.print)) return;
    room.lifted.push(e.print); sys(room, '🧤 اترفعت بصمة: ' + C.prints[e.print].name + '. خبير البصمات يطابقها'); return bcast(room);
  }
  // --- الطبيب الشرعي ---
  if (m.t === 'exam') {
    if (!can(room, p, 'coroner')) return toast(p, 'ده شغل الطبيب الشرعي');
    const r = C.exam[m.tool + ':' + m.region];
    if (!r) return toast(p, 'مفيش حاجة مفيدة من الأداة دي على المنطقة دي');
    if (r === 'TOD') { if (room.found.includes('f_tod')) return toast(p, 'حسبتوا وقت الوفاة قبل كدا'); room.tod = true; return bcast(room) }
    if (room.found.includes(r)) return toast(p, 'فحصتوا ده قبل كدا');
    find(room, r, p, '[' + p.name + '] '); return bcast(room);
  }
  if (m.t === 'tod') {
    if (!can(room, p, 'coroner') || !room.tod) return;
    if (+m.choice === C.todCorrect) { room.tod = false; find(room, 'f_tod', p, '[' + p.name + '] '); return bcast(room) }
    return toast(p, 'الحساب غلط. ٣٧ ناقص ٣٥.٦ يطلع كام ساعة؟ ارجع من ٢:٣٥');
  }
  // --- البصمات ---
  if (m.t === 'pmatch') {
    if (!can(room, p, 'prints')) return toast(p, 'ده شغل خبير البصمات');
    const pr = C.prints[m.pid]; if (!pr || !room.lifted.includes(m.pid)) return;
    if (room.found.includes(pr.ev)) return toast(p, 'البصمة دي اتطابقت قبل كدا');
    if (m.cand === pr.owner) { find(room, pr.ev, p, '[' + p.name + '] '); return bcast(room) }
    room.pmiss++; return toast(p, 'مفيش تطابق. الحلقات مش نفس الشكل، جرب صاحب بصمة تاني');
  }
  // --- رئيس المباحث ---
  if (m.t === 'unlock') {
    if (!isChief) return toast(p, 'ده قرار رئيس المباحث');
    const g = C.gates[m.g]; if (!g || room.gates[m.g]) return;
    if (room.found.length < g.need) return toast(p, 'لازم ' + g.need + ' أدلة على الأقل الأول. عندكم ' + room.found.length);
    room.gates[m.g] = true; sys(room, '📋 رئيس المباحث: ' + g.title); return bcast(room);
  }
  // --- الاستجواب ---
  if (m.t === 'ask') { return ask(room, p, m.s, m.text) }
  if (m.t === 'confront') { return confront(room, p, m.s, m.ev) }
  // --- اللوحة ---
  if (m.t === 'pin') {
    const id = m.id; const ok = C.sus.includes(id) || room.found.includes(id);
    if (!ok || room.board.items.some(i => i.id === id)) return;
    const n = room.board.items.length;
    room.board.items.push({ id, x: 6 + (n % 4) * 23 + Math.random() * 3, y: 6 + Math.floor(n / 4) * 34 + Math.random() * 3 }); return bcast(room);
  }
  if (m.t === 'move') {
    const it = room.board.items.find(i => i.id === m.id); if (!it) return;
    it.x = Math.max(0, Math.min(88, +m.x || 0)); it.y = Math.max(0, Math.min(86, +m.y || 0)); return bcast(room);
  }
  if (m.t === 'unpin') {
    room.board.items = room.board.items.filter(i => i.id !== m.id); room.board.links = room.board.links.filter(l => l[0] !== m.id && l[1] !== m.id); return bcast(room);
  }
  if (m.t === 'link') {
    const a = m.a, b = m.b; if (a === b) return;
    if (!room.board.items.some(i => i.id === a) || !room.board.items.some(i => i.id === b)) return;
    const k = [a, b].sort().join('|');
    const ex = room.board.links.findIndex(l => [l[0], l[1]].sort().join('|') === k);
    if (ex >= 0) room.board.links.splice(ex, 1); else room.board.links.push([a, b]);
    return bcast(room);
  }
  // --- الاتهام ---
  if (m.t === 'vote') { if (C.sus.includes(m.s) && room.gates.accuse && !room.sus[m.s].gone) { room.votes[p.id] = m.s; bcast(room) } return }
  if (m.t === 'unvote') { delete room.votes[p.id]; return bcast(room) }
  if (m.t === 'accuse') {
    if (!isChief) return toast(p, 'رئيس المباحث هو اللي بيقدم الاتهام');
    if (!room.gates.accuse) return toast(p, 'باب الاتهام لسه مفتوحش');
    const s = m.s; if (!C.sus.includes(s) || room.sus[s].gone) return;
    const n = Object.keys(room.players).length, v = Object.values(room.votes).filter(x => x === s).length;
    if (v * 2 <= n) return toast(p, 'لازم أغلبية الفريق تصوّت على نفس الشخص');
    room.votes = {};
    if (s === C.killer) {
      room.phase = 'over'; room.result = Object.assign({ win: true, accused: s, text: C.verdict.win }, score(room, true)); sys(room, '⚖ الفريق اتهم ' + C.S[s].name + ' وكان القاتل');
    } else {
      room.strikes++; room.sus[s].gone = true; sys(room, '⚖ اتهمتوا ' + C.S[s].name + ' غلط. خرج من القسم والقضية بقت أصعب');
      for (const x of C.sus) if (!room.sus[x].gone) room.sus[x].stress = Math.max(0, room.sus[x].stress - 25);
      if (room.strikes >= 2) { room.phase = 'over'; room.result = Object.assign({ win: false, accused: s, text: C.verdict.lose }, score(room, false)) }
    }
    return bcast(room);
  }
}
const CFG = {
  roles: ROLES, title: C.title, intro: C.intro,
  spots: C.spots.map(s => ({ id: s.id, x: s.x, y: s.y, r: s.r, label: s.label, gate: s.gate || null })),
  sus: Object.fromEntries(C.sus.map(s => [s, { name: C.S[s].name, title: C.S[s].title, age: C.S[s].age, img: C.S[s].img, intro: C.S[s].intro }])),
  gates: C.gates, todText: C.todText, todOptions: C.todOptions, cands: C.cands,
  evMeta: Object.fromEntries(Object.entries(C.ev).map(([k, v]) => [k, { kind: v.kind, title: v.title }]))
};
wss.on('connection', ws => {
  ws.on('message', d => { try { msg(ws, JSON.parse(d)) } catch (e) { console.log('err', e.message) } });
  ws.on('close', () => { const r = ws.room; if (!r) return; const p = r.players[ws.pid]; if (p && p.ws === ws) { p.ws = null; bcast(r) } });
});
setInterval(() => W.tick(rooms), 1000);
setInterval(() => { const now = Date.now(); for (const c in rooms) { const r = rooms[c]; if (!Object.values(r.players).some(p => p.ws) && now - r.created > 6 * 3600e3) delete rooms[c] } }, 600000);
srv.listen(PORT, () => console.log('up', PORT));
