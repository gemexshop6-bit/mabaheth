const crypto = require('crypto'), http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, SP = +process.env.WSPEED || 1;
const read = f => fs.readFileSync(path.join(__dirname, f));
const DATA = JSON.parse(read('data.json').toString());
const CATS = {}; for (const c of DATA) CATS[c.id] = c;
const HTML = read('index.html'), JS = read('game.js'), SWJS = read('sw.js'), MANI = read('manifest.webmanifest');
const T = () => Date.now() * SP;
const MAXSEATS = 8, PTS = [100, 70, 50, 30, 20, 10], HINT = 10, TURN = 30000;
/* ===== player profiles + leaderboard in Upstash Redis (free tier) ===== */
const UR = process.env.UPSTASH_URL, UTK = process.env.UPSTASH_TOKEN, RL = {}, LBC = {};
const WKN = () => Math.floor((Date.now() / 864e5 + 3) / 7);
async function rc(cmds) { const x = await fetch(UR + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + UTK, 'content-type': 'application/json' }, body: JSON.stringify(cmds), signal: AbortSignal.timeout(6000) }); const j = await x.json(); if (!Array.isArray(j)) throw new Error('db'); return j.map(a => a.result) }
function okProf(p) { if (!p || typeof p !== 'object' || Array.isArray(p)) return null; const s = JSON.stringify(p); if (s.length > 4000) return null; return p }

/* daily snapshot of all profiles, kept 8 days inside the same free DB (about 3 commands + one per 200 players per day) */
let BKD = '';
async function backupDay() {
  const day = new Date().toISOString().slice(0, 10); if (BKD === day) return; BKD = day;
  try {
    const [g] = await rc([['SET', 'bk:done:' + day, '1', 'NX', 'EX', '172800']]); if (g !== 'OK') return;
    let cur = '0', keys = []; do { const [r] = await rc([['SCAN', cur, 'MATCH', 'p:*', 'COUNT', '500']]); cur = r[0]; keys = keys.concat(r[1]) } while (cur !== '0' && keys.length < 20000);
    const all = {}; for (let i = 0; i < keys.length; i += 200) { const ch = keys.slice(i, i + 200), v = (await rc([['MGET', ...ch]]))[0]; ch.forEach((k, j) => { if (v[j]) all[k.slice(2)] = v[j] }) }
    const info = (await rc([['HGETALL', 'info']]))[0] || [];
    await rc([['SET', 'bk:' + day, JSON.stringify({ day, n: keys.length, all, info }), 'EX', '691200']]);
  } catch (e) { BKD = '' }
}

const INF = new Map();
async function infoOf(pid) { const c = INF.get(pid); if (c && Date.now() - c.t < 300000) return c.v; const [v] = await rc([['HGET', 'info', pid]]); let o = null; try { o = v ? JSON.parse(v) : null } catch (e) { } if (INF.size > 500) INF.clear(); INF.set(pid, { t: Date.now(), v: o }); return o }
function applyProf(room, q, m) {
  q.av = Math.max(0, Math.min(19, m.av | 0)); q.lv = Math.max(1, Math.min(999, m.lv | 0));
  const pid = String(m.pid || ''); if (!UR || !UTK || !/^\d{6}$/.test(pid)) { q.bd = ''; q.ap = 0; q.pk = ''; return }
  q.pid = pid; if (m.t === 'prof') INF.delete(pid);
  const pk = /^[a-z0-9]{8}$/.test(String(m.pk || '')) && m.ap ? m.pk : '';
  Promise.all([infoOf(pid), pk ? rc([['HGET', 'pko', pk]]) : null]).then(([i, o]) => { q.bd = (i && i.bd) || ''; if (pk && o && o[0] === pid) { q.pk = pk; q.ap = 1 } else { q.pk = ''; q.ap = 0 } bcast(room) }).catch(() => { })
}

const PHC = new Map();
async function photo(q, r, u) {
  const m = /^\/api\/ph\/([a-z0-9]{8})\.jpg$/.exec(u); if (!m || !UR || !UTK) { r.writeHead(404); return r.end() }
  const send = b => { r.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' }); r.end(b) };
  const c = PHC.get(m[1]); if (c) return send(c);
  const ip = (q.headers['x-forwarded-for'] || q.socket.remoteAddress || '').split(',')[0].trim(), now = Date.now(), b = RL['p' + ip] = RL['p' + ip] && now - RL['p' + ip].t < 60000 ? RL['p' + ip] : { t: now, n: 0 };
  if (++b.n > 120) { r.writeHead(429); return r.end() }
  try { const [v] = await rc([['GET', 'ph:' + m[1]]]); if (!v) { r.writeHead(404, { 'cache-control': 'no-store' }); return r.end() } const buf = Buffer.from(v, 'base64'); if (PHC.size > 300) PHC.clear(); PHC.set(m[1], buf); send(buf) } catch (e) { r.writeHead(500); r.end() }
}
function jr(r, c, o) { r.writeHead(c, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(o)) }

const nk = s => String(s || '').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
const nwords = n => [...new Set(nk(n).split(/\s+/).filter(Boolean).map(w => w.slice(0, 20)))].slice(0, 3);
const FKY = crypto.createHash('sha256').update('lamma-h' + (UTK || '')).digest().subarray(0, 16);
const henc = id => { const c = crypto.createCipheriv('aes-128-ecb', FKY, null); c.setAutoPadding(false); return Buffer.concat([c.update(Buffer.from(id.padEnd(16, ' '))), c.final()]).toString('hex') };
const hdec = h => { if (!/^[0-9a-f]{32}$/.test(String(h))) return ''; try { const c = crypto.createDecipheriv('aes-128-ecb', FKY, null); c.setAutoPadding(false); const id = Buffer.concat([c.update(Buffer.from(h, 'hex')), c.final()]).toString().trim(); return /^\d{6}$/.test(id) ? id : '' } catch (e) { return '' } };
const FC = new Map(), PRS = new Map(), INV = new Map(), SC = new Map();
setInterval(() => { const n = Date.now(); for (const [k, v] of PRS) if (n - v.t > 120000) PRS.delete(k); for (const [k, v] of INV) { const a = v.filter(x => n - x.ts < 120000); if (a.length) INV.set(k, a); else INV.delete(k) } }, 300000).unref();
async function infosOf(ids) {
  const out = {}, miss = [], now = Date.now();
  for (const id of ids) { const c = INF.get(id); if (c && now - c.t < 300000) out[id] = c.v; else miss.push(id) }
  if (miss.length) { const [vs] = await rc([['HMGET', 'info', ...miss]]); miss.forEach((id, i) => { let o = null; try { o = vs[i] ? JSON.parse(vs[i]) : null } catch (e) { } if (INF.size > 800) INF.clear(); INF.set(id, { t: now, v: o }); out[id] = o }) }
  return out
}
async function getF(id) {
  const c = FC.get(id); if (c && Date.now() - c.t < 60000) return c;
  const [fr, rq] = await rc([['SMEMBERS', 'fr:' + id], ['SMEMBERS', 'rq:' + id]]);
  const v = { t: Date.now(), fr: new Set(fr || []), rq: new Set(rq || []) }; if (FC.size > 1000) FC.clear(); FC.set(id, v); return v
}
const pub = (id, o) => ({ h: henc(id), n: o.n || 'لاعب', av: o.av | 0, lv: o.lv || 1, pk: o.ap ? o.pk || '' : '', bd: o.bd || '' });
const stOf = id => { const p = PRS.get(id); if (!p || Date.now() - p.t > 30000) return ['off', '']; return p.rm && rooms[p.rm] ? ['rm', p.rm] : ['on', ''] };
async function fapi(u, b, r) {
  const act = u.slice(7), id = String(b.id || '');
  if (act === 'search') {
    const q = nk(String(b.q || '').slice(0, 24)); if (q.length < 2) return jr(r, 200, { rows: [] });
    const c = SC.get(q); if (c && Date.now() - c.t < 60000) return jr(r, 200, { rows: c.rows.filter(x => x.i !== id).map(x => x.o) });
    let ids = [];
    if (/^\d{6}$/.test(q)) ids = [q]; else { const [ms] = await rc([['ZRANGEBYLEX', 'nm', '[' + q, '[' + q + '\u{10FFFF}', 'LIMIT', '0', '24']]); ids = [...new Set((ms || []).map(m => m.split('|')[1]))].slice(0, 12) }
    const inf = await infosOf(ids), rows = ids.filter(i => inf[i]).map(i => ({ i, o: pub(i, inf[i]) }));
    if (SC.size > 300) SC.clear(); SC.set(q, { t: Date.now(), rows }); return jr(r, 200, { rows: rows.filter(x => x.i !== id).map(x => x.o) })
  }
  if (!/^\d{6}$/.test(id)) return jr(r, 400, { e: 'bad' });
  const me = (await infosOf([id]))[id]; if (!me) return jr(r, 404, { e: 'none' });
  if (act === 'poll') {
    const rm = String(b.rm || ''); PRS.set(id, { t: Date.now(), rm: rooms[rm] ? rm : '' });
    const F = await getF(id), fl = [...F.fr].slice(0, 100), rl = [...F.rq].slice(0, 30), inf = await infosOf([...fl, ...rl]);
    const fr = fl.filter(i => inf[i]).map(i => { const [st, code] = stOf(i); return { ...pub(i, inf[i]), st, rm: code } }).sort((a, b) => (b.st === 'rm') - (a.st === 'rm') || (b.st === 'on') - (a.st === 'on'));
    const rq = rl.filter(i => inf[i]).map(i => pub(i, inf[i])), now = Date.now(), iv = (INV.get(id) || []).filter(x => now - x.ts < 120000 && rooms[x.rm]); INV.delete(id);
    const ii = await infosOf([...new Set(iv.map(x => x.from))]);
    return jr(r, 200, { fr, rq, inv: iv.filter(x => ii[x.from]).map(x => ({ from: pub(x.from, ii[x.from]), rm: x.rm, ts: x.ts })) })
  }
  const t = hdec(b.h); if (!t || t === id) return jr(r, 400, { e: 'bad' });
  const ti = (await infosOf([t]))[t]; if (!ti) return jr(r, 404, { e: 'none' });
  const F = await getF(id);
  if (act === 'add') {
    if (F.fr.has(t)) return jr(r, 200, { st: 'friends' });
    if (F.rq.has(t)) { await rc([['SREM', 'rq:' + id, t], ['SADD', 'fr:' + id, t], ['SADD', 'fr:' + t, id]]); FC.delete(id); FC.delete(t); return jr(r, 200, { st: 'friends' }) }
    if (F.fr.size >= 100) return jr(r, 400, { e: 'full' });
    await rc([['SADD', 'rq:' + t, id]]); FC.delete(t); return jr(r, 200, { st: 'sent' })
  }
  if (act === 'ans') {
    if (!F.rq.has(t)) return jr(r, 200, { st: 'none' });
    if (b.ok) await rc([['SREM', 'rq:' + id, t], ['SADD', 'fr:' + id, t], ['SADD', 'fr:' + t, id]]); else await rc([['SREM', 'rq:' + id, t]]);
    FC.delete(id); FC.delete(t); return jr(r, 200, { st: b.ok ? 'friends' : 'no' })
  }
  if (act === 'del') { await rc([['SREM', 'fr:' + id, t], ['SREM', 'fr:' + t, id]]); FC.delete(id); FC.delete(t); return jr(r, 200, { ok: 1 }) }
  if (act === 'inv') {
    const rm = String(b.rm || ''); if (!F.fr.has(t)) return jr(r, 403, { e: 'not friends' }); if (!rooms[rm]) return jr(r, 400, { e: 'noroom' });
    const p = PRS.get(t); if (!p || Date.now() - p.t > 30000) return jr(r, 200, { st: 'off' });
    const a = (INV.get(t) || []).filter(x => !(x.from === id && x.rm === rm)); a.push({ from: id, rm, ts: Date.now() }); INV.set(t, a.slice(-5)); return jr(r, 200, { st: 'sent' })
  }
  jr(r, 404, { e: 'no' })
}

/* ===== تحدي اليوم: ٥ أسئلة كل يوم بتوقيت القاهرة + سلسلة أيام + جوايز عملات ===== */
const DCTZ = 'Africa/Cairo', DCN = 5, DCC = new Map();
function dcDay(o) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: DCTZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(o || new Date()) } catch (e) { return (o || new Date()).toISOString().slice(0, 10) } }
function dcPrev(day) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }
function dcSeed(day) { let h = 2166136261; for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function dcRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }
let DCPL = null;
function dcPool() {
  if (DCPL) return DCPL;
  const seen = new Set(); DCPL = [];
  for (const x of DB.L) { if (!x || !x.q || !x.a) continue; const k = x.q + '|' + x.a; if (seen.has(k)) continue; if (x.a.length > 26 || x.q.length > 90) continue; seen.add(k); DCPL.push(x) }
  return DCPL
}
function dcMake(day) {
  const c = DCC.get(day); if (c) return c;
  const r = dcRng(dcSeed(day)), sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a };
  const pool = sh(dcPool().slice()), picked = [], cats = new Set();
  for (const x of pool) { if (picked.length >= DCN) break; if (cats.has(x.c)) continue; cats.add(x.c); picked.push(x) }
  for (const x of pool) { if (picked.length >= DCN) break; if (!picked.some(p => p.q === x.q)) picked.push(x) }
  const qs = [], ks = [];
  for (const x of picked) {
    const opts = [x.a], near = sh(dcPool().filter(z => z.c === x.c && z.a !== x.a)).sort((a, b) => Math.abs(a.a.length - x.a.length) - Math.abs(b.a.length - x.a.length));
    for (const y of near) { if (opts.length >= 4) break; if (opts.indexOf(y.a) < 0 && y.a.indexOf(x.a) < 0 && x.a.indexOf(y.a) < 0) opts.push(y.a) }
    for (const y of sh(dcPool().slice())) { if (opts.length >= 4) break; if (opts.indexOf(y.a) < 0) opts.push(y.a) }
    sh(opts); qs.push({ q: x.q, o: opts }); ks.push(opts.indexOf(x.a))
  }
  const v = { d: day, qs, ks };
  if (DCC.size > 30) DCC.clear(); DCC.set(day, v); return v
}
const dcCoins = (s, ok) => 10 * ok + 15 * Math.min(Math.max(s, 1), 5);

function api(q, r, u) {
  if (!UR || !UTK) return jr(r, 503, { e: 'db off' });
  const isF = u.startsWith('/api/f/'); if (!isF) backupDay();
  const ip = (q.headers['x-forwarded-for'] || q.socket.remoteAddress || '').split(',')[0].trim(), now = Date.now(), b = RL[ip] = RL[ip] && now - RL[ip].t < 60000 ? RL[ip] : { t: now, n: 0 };
  if (isF) { const fb = RL['f' + ip] = RL['f' + ip] && now - RL['f' + ip].t < 60000 ? RL['f' + ip] : { t: now, n: 0 }; if (++fb.n > 150) return jr(r, 429, { e: 'slow down' }) } else if (++b.n > 40) return jr(r, 429, { e: 'slow down' });
  const run = async body => {
    const nm = s => String(s || '').replace(/[<>&"]/g, '').slice(0, 20) || 'لاعب';
    if (isF) return fapi(u, body, r);
    if (u === '/api/p/new') {
      const p = okProf(body.prof); if (!p) return jr(r, 400, { e: 'bad' }); delete p.bd; delete p.pk; delete p.ap;
      for (let i = 0; i < 6; i++) { const id = String(100000 + Math.floor(Math.random() * 900000)); const [s] = await rc([['SET', 'p:' + id, JSON.stringify(p), 'NX']]); if (s === 'OK') { const n0 = nm(body.name), w0 = nwords(n0); await rc([['HSET', 'info', id, JSON.stringify({ n: n0, av: Math.max(0, Math.min(19, p.av | 0)), lv: 1, w: w0 })], ...w0.map(w => ['ZADD', 'nm', '0', w + '|' + id])]); return jr(r, 200, { id }) } }
      return jr(r, 500, { e: 'full' })
    }
    if (u === '/api/p/save') {
      const id = String(body.id || ''), p = okProf(body.prof); if (!/^\d{6}$/.test(id) || !p) return jr(r, 400, { e: 'bad' });
      const w = WKN(), xp = Math.max(0, +p.xp | 0), wp = p.wk && p.wk.w === w ? Math.max(0, +p.wk.p | 0) : 0, lv = Math.max(1, Math.min(999, +body.lv | 0));
      const pk = typeof p.pk === 'string' && /^[a-z0-9]{8}$/.test(p.pk) ? p.pk : '', cs = [['HGET', 'bd', id], ['HGET', 'info', id]]; if (pk) cs.push(['HGET', 'pko', pk]);
      const rr = await rc(cs), bd = rr[0] || '', own = !!pk && rr[2] === id; let oi = {}; try { oi = JSON.parse(rr[1] || '{}') } catch (e) { }
      if (own) p.ap = p.ap ? 1 : 0; else { delete p.pk; p.ap = 0 } if (bd) p.bd = bd; else delete p.bd; p.av = Math.max(0, Math.min(19, p.av | 0));
      const [s] = await rc([['SET', 'p:' + id, JSON.stringify(p), 'XX']]); if (s !== 'OK') return jr(r, 404, { e: 'none' });
      const n1 = nm(body.name), w1 = nwords(n1), ow = Array.isArray(oi.w) ? oi.w : [];
      const c = [['HSET', 'info', id, JSON.stringify({ n: n1, av: p.av, lv, pk: own ? p.pk : '', ap: own && p.ap ? 1 : 0, bd, w: w1 })], ['ZADD', 'lb:all', String(xp), id]];
      if (ow.join() !== w1.join()) { ow.forEach(w => c.push(['ZREM', 'nm', w + '|' + id])); w1.forEach(w => c.push(['ZADD', 'nm', '0', w + '|' + id])) }
      if (wp > 0) { c.push(['ZADD', 'lb:w:' + w, String(wp), id], ['EXPIRE', 'lb:w:' + w, '1300000']) }
      await rc(c); INF.delete(id); return jr(r, 200, { ok: 1 })
    }
    if (u === '/api/p/photo') {
      const id = String(body.id || ''), im = String(body.img || ''); if (!/^\d{6}$/.test(id) || im.length < 200 || im.length > 45000 || !/^[A-Za-z0-9+\/=]+$/.test(im) || !im.startsWith('/9j/')) return jr(r, 400, { e: 'bad' });
      const [v] = await rc([['GET', 'p:' + id]]); if (!v) return jr(r, 404, { e: 'none' }); let o; try { o = JSON.parse(v) } catch (e) { return jr(r, 500, { e: 'db' }) }
      const pk = Array.from({ length: 8 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join(''), old = typeof o.pk === 'string' && /^[a-z0-9]{8}$/.test(o.pk) ? o.pk : '';
      o.pk = pk; o.ap = 1; const c = [['SET', 'ph:' + pk, im], ['HSET', 'pko', pk, id], ['SET', 'p:' + id, JSON.stringify(o), 'XX']]; if (old) c.push(['DEL', 'ph:' + old], ['HDEL', 'pko', old]);
      await rc(c); INF.delete(id); return jr(r, 200, { pk })
    }
    if (u === '/api/p/get') { const id = String(body.id || ''); if (!/^\d{6}$/.test(id)) return jr(r, 400, { e: 'bad' }); const [v, bd] = await rc([['GET', 'p:' + id], ['HGET', 'bd', id]]); if (!v) return jr(r, 404, { e: 'none' }); const pf = JSON.parse(v); if (bd) pf.bd = bd; else delete pf.bd; return jr(r, 200, { prof: pf }) }
    if (u === '/api/dc') {
      const day = dcDay(), ch = dcMake(day), pid = String(body.id || '');
      if (body.sub) {
        if (!/^\d{6}$/.test(pid)) return jr(r, 400, { e: 'bad' });
        if (String(body.d || '') !== day) return jr(r, 400, { e: 'old' });
        const picks = Array.isArray(body.picks) ? body.picks : [];
        const ok = ch.ks.reduce((n, k, i) => n + (picks[i] === k ? 1 : 0), 0);
        const [pv] = await rc([['GET', 'p:' + pid]]); if (!pv) return jr(r, 404, { e: 'none' });
        let st = null; try { const [sv] = await rc([['HGET', 'dcs', pid]]); st = sv ? JSON.parse(sv) : null } catch (e) { st = null }
        const [lk] = await rc([['SET', 'dcl:' + pid + ':' + day, '1', 'NX', 'EX', '172800']]);
        if (lk !== 'OK') return jr(r, 200, { already: 1, correct: ok, n: DCN, streak: (st && st.s) | 0, best: (st && st.b) | 0, coins: 0, xp: 0, ans: ch.ks });
        const s = st && st.d === dcPrev(day) ? Math.max(1, st.s | 0) + 1 : 1, best = Math.max(s, (st && st.b) | 0);
        const coins = dcCoins(s, ok), xp = 20 + 5 * ok;
        await rc([['HSET', 'dcs', pid, JSON.stringify({ s, b: best, d: day })]]);
        return jr(r, 200, { ok: 1, correct: ok, n: DCN, streak: s, best, coins, xp, ans: ch.ks })
      }
      const out = { d: day, qs: ch.qs, n: DCN };
      if (/^\d{6}$/.test(pid)) { try { const [sv] = await rc([['HGET', 'dcs', pid]]); const st = sv ? JSON.parse(sv) : null; if (st) out.st = { s: st.s | 0, b: st.b | 0, done: st.d === day } } catch (e) { } }
      return jr(r, 200, out)
    }
    if (u === '/api/lb') {
      const k = body.k === 'all' ? 'lb:all' : 'lb:w:' + WKN(), c = LBC[k]; if (c && now - c.t < 120000) return jr(r, 200, c.d);
      const [z] = await rc([['ZREVRANGE', k, '0', '19', 'WITHSCORES']]), ids = [], sc = []; for (let i = 0; i < (z || []).length; i += 2) { ids.push(z[i]); sc.push(+z[i + 1]) }
      let inf = ids.length ? (await rc([['HMGET', 'info', ...ids]]))[0] : [];
      const d = { rows: ids.map((id, i) => { let o = {}; try { o = JSON.parse(inf[i] || '{}') } catch (e) { } return { n: o.n || 'لاعب', av: o.av | 0, lv: o.lv || 1, s: sc[i], pk: o.ap ? o.pk || '' : '', bd: o.bd || '' } }) }; LBC[k] = { t: now, d }; return jr(r, 200, d)
    }
    jr(r, 404, { e: 'no' })
  };
  if (q.method === 'GET') return run({ k: new URL(q.url, 'http://x').searchParams.get('k') }).catch(() => jr(r, 500, { e: 'db' }));
  let raw = ''; q.on('data', d => { raw += d; if (raw.length > (u === '/api/p/photo' ? 70000 : 8000)) q.destroy() }); q.on('end', () => { let b; try { b = JSON.parse(raw || '{}') } catch (e) { return jr(r, 400, { e: 'json' }) } run(b).catch(() => jr(r, 500, { e: 'db' })) })
}
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/api/ph/')) { photo(q, r, u); return }
  if (u.startsWith('/api/')) { api(q, r, u); return }
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
const yes = (it, q) => q.fn ? !!q.fn(it) : q.a.split('').some(ch => (it.f || '').includes(ch));
// أسئلة إضافية بتتولد من الأسماء نفسها، عشان الجولة تبقى فيها معلومات كفاية (مش سؤالين وخلاص)
const QCACHE = {};
function qsOf(cat) {
  if (QCACHE[cat.id]) return QCACHE[cat.id];
  const words = it => String(it.n || '').trim().split(/\s+/).filter(Boolean);
  const people = ['singers', 'actors', 'football', 'tiktok'].includes(cat.id);
  const extra = [
    { t: 'اسمي أكتر من كلمة؟', fn: it => words(it).length >= 2 },
    { t: 'اسمي ٣ كلمات أو أكتر؟', fn: it => words(it).length >= 3 }
  ];
  if (people) extra.push(
    { t: "اسمي فيه كلمة 'محمد'؟", fn: it => words(it).includes('محمد') },
    { t: "اسمي فيه كلمة 'أحمد'؟", fn: it => words(it).includes('أحمد') },
    { t: "اسمي فيه كلمة 'عبد'؟", fn: it => words(it).includes('عبد') }
  );
  else extra.push({ t: "اسمي بيبدأ بـ'ال'؟", fn: it => /^ال/.test(String(it.n || '').trim()) });
  const byLetter = {};
  for (const it of cat.items) { const w = words(it)[0] || '', ch = w[0]; if (ch) byLetter[ch] = (byLetter[ch] || 0) + 1 }
  const n = cat.items.length;
  if (people) {
    const letters = Object.keys(byLetter).filter(ch => byLetter[ch] >= Math.max(2, n * .08) && byLetter[ch] <= n * .6).sort((a, b) => byLetter[b] - byLetter[a]).slice(0, 4);
    for (const ch of letters) extra.push({ t: 'اسمي بيبدأ بحرف ' + ch + '؟', fn: it => ((words(it)[0] || '')[0] === ch) });
  }
  const all = cat.q.map(q => ({ t: q.t, a: q.a })).concat(extra).filter(q => { const y = cat.items.filter(it => yes(it, q)).length; return y > 0 && y < n });
  QCACHE[cat.id] = all; return all;
}
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
    players: Object.values(room.players).map(x => ({ id: x.id, name: x.name, bot: !!x.bot, on: !!x.ws || !!x.bot, score: x.score, av: x.av|0, lv: x.lv|0, pk: x.ap && x.pk ? x.pk : '', bd: x.bd || '', ready: !!x.ready, mic: x.mic ? (x.mm ? 2 : 1) : 0 })),
    ln: room.logn || 0, chat: room.chat.slice(-60), log: room.log.slice(-40), q: qsOf(cat).map((x, i) => ({ i, t: x.t }))
  };
  o.sdiff = Math.max(1, Math.min(3, +room.sdiff || 2));
  if (room.game === 'snake' && room.sn) o.sn = { pos: room.sn.pos, order: room.sn.order, turn: room.sn.order[room.sn.turn] || null, dice: room.sn.dice, seq: room.sn.seq, win: room.sn.win, diff: room.sn.diff, left: room.sn.win ? 0 : Math.max(0, Math.round(((room.sn.turnAt || T()) + SNTURN - T()) / 1000)), log: room.sn.log.slice(-6) };
  if (room.game === 'spy' && room.sp && room.phase[0] === 's') o.sp = spyView(room, p);
  if (room.game === 'duel' && room.du && room.phase[0] === 'd') { o.du = duelView(room, p); o.dcat = room.dcat }
  o.dcat = room.dcat; o.dT = room.dT;
  if (room.phase !== 'lobby' && room.game !== 'snake') {
    o.seats = room.seats.map(sd => {
      const it = itemOf(room, sd), me = sd.id === p.id, show = !me || sd.done || res;
      const candN = me && !room.players[sd.id].bot ? catItems(room, sd) : undefined;
      return { id: sd.id, done: sd.done, rank: sd.rank, miss: sd.miss, hints: me ? sd.hints : undefined, card: show ? { n: it.n, e: it.e, i: it.i } : null, gain: sd.gain, cand: candN }
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
    room.turnEnd = T() + TURN; room.botAt = pl.bot ? T() + (1600 + Math.random() * 1600) : 0; room.pend = null; bcast(room); return;
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
function catItems(room, sd) {
  const cat = CATS[room.cat], qs = qsOf(cat), asked = sd.asked || {};
  const keys = Object.keys(asked); if (!keys.length) return cat.items.length;
  return cat.items.filter(it => keys.every(k => yes(it, qs[k | 0]) === asked[k])).length
}
function ask(room, sd, qi) {
  const q = qsOf(CATS[room.cat])[qi]; if (!q) return; const it = itemOf(room, sd), a = yes(it, q), p = room.players[sd.id];
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
  const cat = CATS[room.cat], p = room.players[sd.id];
  let c = sd.cand && sd.cand.length ? sd.cand : cat.items.map((_, i) => i);
  sd.cand = c;
  if (c.length <= 1) {
    const k = c.length ? c[0] : Math.floor(Math.random() * cat.items.length);
    sd.guessing = k; lg(room, '🤔 ' + p.name + ' بيخمّن...', 'q');
    return guess(room, sd, cat.items[k].n);
  }
  const qs = qsOf(cat);
  let best = -1, bs = 1e9;
  for (let i = 0; i < qs.length; i++) {
    if (i in sd.asked) continue;
    const y = c.filter(k => yes(cat.items[k], qs[i])).length;
    if (y <= 0 || y >= c.length) continue;
    const sc = Math.min(y, c.length - y);
    if (sc < bs) { bs = sc; best = i }
  }
  const hunch = c.length <= 3 && Math.random() < .1;
  if (best < 0 || hunch) {
    const k = pick(c); sd.guessing = k; lg(room, '🤔 ' + p.name + ' بيخمّن...', 'q');
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
      } else if (room.phase === 'snake') { snTick(room, now)
      } else if (room.phase[0] === 's') { spyTick(room, now)
      } else if (room.phase[0] === 'd') { duelTick(room, now)
      } else if (room.phase === 'break' && Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000) }
    } catch (e) { console.error(e) }
  }
}, 400);

/* ================= السلم والتعبان ================= */
const SNL = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
const SNS = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
function snLog(room, t) { if (!room.sn) return; room.sn.log.push(t); if (room.sn.log.length > 10) room.sn.log.shift() }
function snStart(room) {
  room.phase = 'snake'; room.seats = []; room.pend = null; room.bs = {};
  const ps = Object.values(room.players);
  room.sn = { pos: {}, order: ps.map(p => p.id), turn: 0, dice: 0, seq: 0, win: null, log: [], turnAt: T(), diff: Math.max(1, Math.min(3, +room.sdiff || 2)) };
  ps.forEach(p => { room.sn.pos[p.id] = 0; p.ready = false; p.score = 0 });
  snLog(room, 'السلم والتعبان — يلا نبدأ!');
  bcast(room); snBot(room);
}
function snDice(room, pid) {
  const p = room.players[pid], d = (room.sn && room.sn.diff) || 2;
  if (!p || !p.bot) return 1 + Math.floor(Math.random() * 6);
  const r = Math.random();
  if (d === 1) return 1 + Math.floor(Math.random() * 4);
  if (d === 3) return r < 0.2 ? 6 : 2 + Math.floor(Math.random() * 5);
  return 1 + Math.floor(Math.random() * 6);
}
function snNext(room) {
  const sn = room.sn, n = sn.order.length;
  for (let i = 1; i <= n; i++) { const t = (sn.turn + i) % n; if (room.players[sn.order[t]]) { sn.turn = t; return } }
}
function snRoll(room, pid) {
  const sn = room.sn; if (!sn || sn.win || room.phase !== 'snake') return;
  if (sn.order[sn.turn] !== pid) return;
  const p = room.players[pid]; if (!p) { snNext(room); bcast(room); snBot(room); return }
  const d = snDice(room, pid); let to = (sn.pos[pid] | 0) + d, msg = '';
  if (to > 100) { to = 200 - to; msg = 'عدّى الـ١٠٠ فرجع لـ' + to }
  let land = to;
  if (SNL[to]) { land = SNL[to]; msg = '⬆ سلم! من ' + to + ' لـ' + land }
  else if (SNS[to]) { land = SNS[to]; msg = '⬇ تعبان! من ' + to + ' لـ' + land }
  sn.pos[pid] = land; sn.dice = d; sn.seq++; p.score = land;
  snLog(room, p.name + ': ' + d + (msg ? ' — ' + msg : ' → ' + land));
  if (land >= 100) { sn.win = pid; snLog(room, '🏆 ' + p.name + ' وصل ١٠٠ وكسب!'); bcast(room); return }
  snNext(room); sn.turnAt = T(); bcast(room); snBot(room);
}
const SNTURN = 25000;
function snTick(room, now) {
  const sn = room.sn; if (!sn || sn.win || room.phase !== 'snake') return;
  if (Math.floor(now / 1000) !== room.lastB) { room.lastB = Math.floor(now / 1000); bcast(room) }
  const pid = sn.order[sn.turn], p = room.players[pid];
  if (!p) { snNext(room); sn.turnAt = T(); bcast(room); snBot(room); return }
  if (p.bot) return;
  if (!p.ws) { snLog(room, '⏳ ' + p.name + ' مش متصل — الدور عدّى'); snNext(room); sn.turnAt = T(); bcast(room); snBot(room); return }
  if (now - (sn.turnAt || now) >= SNTURN) { snLog(room, '⌛ الوقت خلص على ' + p.name + ' — رمينا الزهر بداله'); snRoll(room, pid) }
}
function snBot(room) {
  const sn = room.sn; if (!sn || sn.win || room.phase !== 'snake') return;
  const pid = sn.order[sn.turn], p = room.players[pid];
  if (!p) { snNext(room); bcast(room); return setTimeout(() => { if (room.sn === sn) snBot(room) }, 500) }
  if (p.bot) setTimeout(() => { if (room.sn === sn && room.phase === 'snake') snRoll(room, pid) }, 1300);
}
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
    sp.tEnd = T() + room.clueT * 1000; sp.botAt = pl.bot ? T() + 1300 + Math.random() * 1500 : 0; bcast(room); return;
  }
  startVote(room);
}
function startVote(room) {
  const sp = room.sp; room.phase = 'svote'; sp.ti = sp.order.length; sp.votes = {}; sp.tEnd = T() + room.voteT * 1000;
  for (const id of sp.order) { const p = room.players[id]; if (p && p.bot) sp.bv[id] = T() + 2200 + Math.random() * Math.min(4500, room.voteT * 320) }
  lg(room, '🗳 كل واحد قال كلمته. اتناقشوا وصوتوا مين الجاسوس!', 'sys'); bcast(room);
}
function botClue(room, id) {
  const sp = room.sp, cat = CATS[room.cat], it = cat.items[sp.secret], isSpy = sp.spies.includes(id), said = sp.clues.map(c => c.text);
  let w;
  if (!isSpy) {
    const A = attrs(cat, it), nm = it.n.split(' '), cand = [];
    const total = cat.items.length;
    for (const word of A.y) {
      const hits = cat.items.filter(x => attrs(cat, x).y.includes(word)).length;
      // كلمة وصفها صح وبتميّز شوية من غير ما تبقى واضحة أوي
      cand.push({ w: word, s: hits <= 1 ? 1.1 : hits <= Math.max(3, Math.round(total * .4)) ? 2.6 : .5 });
    }
    for (const word of A.n) cand.push({ w: word, s: 1.2 });
    cand.push({ w: nm.length === 2 ? 'اسمه كلمتين' : nm.length === 3 ? 'اسمه تلات كلمات' : 'اسمه كلمة واحدة', s: 1.5 });
    cand.push({ w: 'أول حرف ' + it.n[0], s: 1.1 });
    const fresh = cand.filter(x => !said.includes(x.w));
    const pool = fresh.length ? fresh : cand;
    pool.sort((x, y2) => (y2.s + Math.random() * .9) - (x.s + Math.random() * .9));
    w = pool[0].w;
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
function wordsOf(t) { return norm(t || '').split(/\s+/).filter(x => x.length > 1) }
function botVoteFor(room, id) {
  const sp = room.sp, cat = CATS[room.cat], it = cat.items[sp.secret], others = sp.order.filter(x => x !== id && room.players[x]);
  if (sp.spies.includes(id)) {
    // الجاسوس ميعرفش الكلمة، فبيصوّت مع الكلام الغريب: اللي كلامه أقل تشابه مع كلام الباقيين
    const pool = others.filter(o => !sp.spies.includes(o));
    const sc = (pool.length ? pool : others).map(o => {
      const mine = wordsOf(sp.clues.filter(x => x.id === o).map(x => x.text).join(' '));
      let sim = 0;
      for (const q of sp.clues) { if (q.id === o) continue; const w2 = wordsOf(q.text); sim += mine.filter(x => w2.includes(x)).length }
      return { o, s: sim + Math.random() * .7 };
    });
    sc.sort((a, b) => a.s - b.s); return sc[0].o;
  }
  const sc = others.map(o => {
    const list = sp.clues.filter(x => x.id === o).map(x => x.text);
    let s = fit(cat, it, list.join(' ')) + Math.random() * .7;
    // الكلام العام ("مشهور") مش دليل، والجاسوس بيلجأ ليه
    if (list.some(t => /^مشهور$/.test(t.trim()))) s -= 1.4;
    if (!list.filter(Boolean).length) s -= 1;
    return { o, s };
  });
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
  const o = { n: sp.n, k: sp.spies.length, order: sp.order, turn: sp.order[sp.ti] || null, clues: sp.clues, left: Math.max(0, Math.round((sp.tEnd - T()) / 1000)), spy: isSpy, mates: isSpy ? sp.spies.filter(x => x !== me) : [], len: isSpy ? String(sec.n).replace(/\s/g, '').length : 0, catn: isSpy ? cat.name : '', secret: res || (!isSpy && sp.order.includes(me)) ? item(sp.secret) : null, voted: Object.keys(sp.votes), mine: sp.votes[me] || null, guesser: room.phase === 'sguess' ? sp.guesser : null, opts: (room.phase === 'sguess' && me === sp.guesser) ? sp.opts.map(item) : null, tdur: room.phase === 'sclue' ? room.clueT : room.phase === 'svote' ? room.voteT : 25 };
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
  if (room.game === 'snake' && room.sn) { const i = room.sn.order.indexOf(p.id); if (i >= 0) { room.sn.order.splice(i, 1); delete room.sn.pos[p.id]; if (i < room.sn.turn) room.sn.turn--; if (room.sn.turn >= room.sn.order.length) room.sn.turn = 0; if (!room.sn.order.length) { room.phase = 'lobby'; room.sn = null } else if (room.sn.order.length === 1 && !room.sn.win && room.phase === 'snake') { const w = room.sn.order[0], wp = room.players[w]; room.sn.win = w; snLog(room, '🚪 الخصم خرج — ' + (wp ? wp.name : '') + ' كسب!') } } bcast(room); return }
  if (room.game === 'spy' && room.sp) { spyDrop(room, p.id); bcast(room); return }
  if (room.game === 'duel' && room.du && room.phase[0] === 'd') { duelDrop(room, p.id); bcast(room); return }
  if (room.phase !== 'lobby' && room.game === 'who') { const i = room.seats.findIndex(s => s.id === p.id); if (i >= 0) { const wasTurn = i === room.turn; room.seats.splice(i, 1); if (i < room.turn) room.turn--; if (wasTurn) room.turn--; if (room.phase === 'play') { if (live(room).length <= 1) finish(room); else if (wasTurn) nextTurn(room) } } }
  if (room.phase !== 'lobby' && room.game === 'who' && checkVote(room)) return;
  bcast(room);
}
function msg(ws, m) {
  if (m.t === 'prof') { const r = ws.room, q = r && r.players[ws.pid]; if (q) applyProf(r, q, m); return }
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
    applyProf(room, p, m);
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
  const startGame = () => { room.game === 'spy' ? startSpy(room) : room.game === 'duel' ? startDuel(room) : room.game === 'snake' ? snStart(room) : startRound(room) };
  if (room.game === 'snake' && room.sn && room.phase === 'snake') {
    if (m.t === 'roll') { snRoll(room, p.id); return }
    if (m.t === 'snre') { if (host) snStart(room); return }
    if (m.t === 'sndiff' && host) { room.sn.diff = Math.max(1, Math.min(3, +m.v | 0)); bcast(room); return }
    return
  }
  const chkReady = () => { const hum = Object.values(room.players).filter(x => !x.bot && x.ws); if (hum.length && hum.every(x => x.ready)) startGame(); else bcast(room) };
  if (room.phase === 'lobby') {
    if (m.t === 'ready') { p.ready = !p.ready; chkReady(); return }
    if (!host) return;
    if (m.t === 'set') {
      if (CATS[m.cat]) room.cat = m.cat; if (m.game === 'who' || m.game === 'spy' || m.game === 'duel' || m.game === 'snake') room.game = m.game;
      if (m.sdiff) room.sdiff = Math.max(1, Math.min(3, +m.sdiff | 0));
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
