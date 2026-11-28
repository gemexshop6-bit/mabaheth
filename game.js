'use strict';
const A = document.getElementById('app');
let ws, S, cfg, inv = '', myname = '', rooms = [], chatTab = 'chat', side = true, lastLog = 0, lastTurn = null, lastPhase = '', guessTxt = '';
try { myname = localStorage.mbName || '' } catch (e) { }
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
const send = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
function toast(t, ms) { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', ms || 3200) }
// ---- sounds
let AC; function tone(f, d, ty, v, at) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime + (at || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = ty || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || .15, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d) } catch (e) { } }
const SFX = { turn: () => { tone(660, .12); tone(880, .15, 'sine', .15, .1) }, win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'triangle', .18, i * .1)), bad: () => { tone(200, .25, 'sawtooth', .12); tone(150, .3, 'sawtooth', .12, .15) }, yes: () => tone(880, .12, 'square', .08), no: () => tone(240, .15, 'square', .08), pop: () => tone(1200, .06, 'sine', .1), tick: () => tone(1000, .05, 'square', .06) };
function conn(first) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { if (first) first(); else { let s = null; try { s = JSON.parse(localStorage.mbSess || 'null') } catch (e) { } if (s) send({ t: 'join', code: s.code, token: s.token, name: myname, ...profInfo() }) } };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'hello') { cfg = m; try { localStorage.mbSess = JSON.stringify({ code: m.code, token: m.token }) } catch (e) { } if (vOn) send({ t: 'vflag', m: vMuted ? 1 : 0 }) }
    else if (m.t === 'state') { S = m; S._t = Date.now(); if (inv) { inv = ''; try { history.replaceState(null, '', location.pathname) } catch (e) { } } fx(); render() }
    else if (m.t === 'kicked') { toast('الهوست طردك من الغرفة'); vstop(); try { localStorage.removeItem('mbSess') } catch (e) { } S = null; home() }
    else if (m.t === 'toast') toast(m.text);
    else if (m.t === 'emo') floatEmo(m);
    else if (m.t === 'err') { toast(m.e); inv = ''; if (!S) { try { localStorage.removeItem('mbSess') } catch (e) { } home() } }
    else if (m.t === 'rtc' || m.t === 'vjoin' || m.t === 'vleave') vmsg(m);
  };
  ws.onclose = () => { if (S) setTimeout(() => conn(), 1500); else toast('مفيش اتصال بالسيرفر، جرب تاني') };
}
function fx() {
  if (S.phase === 'lobby') lastLog = S.ln;
  const nw = Math.min(S.ln - lastLog, S.log.length); lastLog = S.ln;
  for (const l of S.log.slice(S.log.length - nw)) { if (l.k === 'win') SFX.win(); else if (l.k === 'bad' || l.k === 'miss') SFX.bad(); else if (l.k === 'q') { if (l.text.includes('✅')) SFX.yes(); else if (l.text.includes('❌')) SFX.no(); else SFX.pop() } }
  const tn = S.sp ? S.sp.turn : S.turn, key = S.phase + ':' + tn;
  if (tn === S.you && lastTurn !== key && (S.phase === 'play' || S.phase === 'sclue')) SFX.turn(); lastTurn = key;
  if (S.phase === 'break' && lastPhase !== 'break') SFX.bad();
  if (S.phase === 'svote' && lastPhase !== 'svote') SFX.turn();
  lastPhase = S.phase;
}
function floatEmo(m) { const d = document.createElement('div'); d.className = 'emo'; d.style.left = (10 + Math.random() * 70) + '%'; d.innerHTML = `<div>${esc(m.e)}</div><small>${esc(m.name)}</small>`; document.body.appendChild(d); SFX.pop(); setTimeout(() => d.remove(), 2600) }
function nm() { let v = ($('nm').value || '').trim(); if (!v) v = 'لاعب ' + Math.floor(10 + Math.random() * 90); myname = v; try { localStorage.mbName = v } catch (e) { } return v }
function fsToggle() {
  const d = document, e = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { noAuto = 1; (d.exitFullscreen || d.webkitExitFullscreen).call(d); return }
  const f = e.requestFullscreen || e.webkitRequestFullscreen;
  if (!f) return toast('المتصفح ده مش بيدعم ملء الشاشة. من آيفون: شارك ثم "أضف للشاشة الرئيسية"');
  const r = f.call(e); const lock = () => { try { screen.orientation.lock('landscape').catch(() => { }) } catch (x) { } };
  if (r && r.then) r.then(lock).catch(() => toast('مقدرتش أفتح ملء الشاشة')); else lock();
}
function theme(){const d=document.documentElement,n=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=n;try{localStorage.mbTheme=n}catch(e){};if(S)render();else home()}
const thb=()=>`<button class="ib" onclick="theme()">${document.documentElement.dataset.theme==='dark'?'☀️ فاتح':'🌙 غامق'}</button>`;
function fmt(s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
const pl = id => S.players.find(p => p.id === id) || { name: '؟', score: 0 };
// ---------- home
function home() {
  S = null; const iv = inv || '';
  A.innerHTML = `<div class="home"><div class="logo"><div class="big">🎭</div><h1>لمّة</h1><p>اعمل غرفة وكمّلوا ماتش تلات ألعاب: اعرف مين معايا والجاسوس والمبارزة</p><div class="promo" aria-hidden="true"><div class="sl s1"><div class="tx"><b>استمتع إنت وأصحابك</b><small>افتح غرفة وادعي شلتك والعبوا مع بعض</small></div><div class="faces"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#2b2140" stroke-width="3"/><circle cx="14" cy="17" r="2.6" fill="#2b2140"/><circle cx="26" cy="17" r="2.6" fill="#2b2140"/><path d="M11 25Q20 34 29 25" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#FF6B9D" stroke="#2b2140" stroke-width="3"/><path d="M10 17l7-2M30 17l-7-2" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/><path d="M10 25Q20 38 30 25z" fill="#fff" stroke="#2b2140" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#2EC4B6" stroke="#2b2140" stroke-width="3"/><circle cx="14" cy="17" r="2.6" fill="#2b2140"/><circle cx="26" cy="17" r="2.6" fill="#2b2140"/><path d="M11 25Q20 34 29 25" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#2b2140" stroke-width="3"/><path d="M7 15h26v6H7z" fill="#2b2140"/><path d="M11 25Q20 34 29 25" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/></svg></div></div><div class="sl s2"><div class="tx"><span class="soon">جديد 🔥</span><b>المبارزة: تحدي الأسئلة</b><small>واحد يسأل وواحد يجاوب بصوته، والفايز يكمل لحد البطل</small></div><div class="sw">⚔️</div></div><div class="sl s3"><div class="tx"><b>أربع ألعاب في غرفة واحدة</b><small>اعرف مين معايا • الجاسوس • المبارزة • السلم والتعبان</small></div><div class="tri"><span>🎭</span><span>🕵️</span><span>⚔️</span><span>🐍</span></div></div></div></div>
  <div class="panel">${iv ? `<div class="inv">📩 اتدعيت لغرفة <b>${esc(iv)}</b>، اكتب اسمك وادخل</div>` : ''}<input id="nm" class="inp" maxlength="20" placeholder="اسمك" value="${esc(myname)}">
  ${iv ? '' : `<div class="row"><button class="btn y" onclick="mk()">🎉 اعمل غرفة</button></div>`}
  <div class="row"><input id="cd" class="inp" inputmode="numeric" maxlength="4" placeholder="كود الغرفة" value="${esc(iv)}"><button class="btn t" onclick="jn()">ادخل غرفة</button></div>
  <div id="rl" class="rl"></div>
  <div class="row"><button class="btn p" onclick="helpOpen()">📖 إزاي تلعب</button><button class="btn" onclick="fsToggle()">⛶ ملء الشاشة</button><button class="btn" onclick="theme()">${document.documentElement.dataset.theme==='dark'?'☀️ فاتح':'🌙 غامق'}</button></div></div><div class="snc2" onclick="snOpen()"><span class="e"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7.6" y="3" width="3.6" height="26" rx="1.8" fill="#fff" stroke="#2b2140" stroke-width="2.4"/><rect x="20.8" y="3" width="3.6" height="26" rx="1.8" fill="#fff" stroke="#2b2140" stroke-width="2.4"/><path d="M9.8 9.5h12.4M9.8 16h12.4M9.8 22.5h12.4" stroke="#2b2140" stroke-width="2.4" stroke-linecap="round"/></svg></span><div class="t"><b>السلم والتعبان</b><small>العب لوحدك مع بوت بدرجة صعوبة، أو اعمل غرفة لصاحبك</small></div><span class="g">العب</span></div><div class="snc2 upd" onclick="helpOpen()"><span class="e"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.6l3.4 9.6 9.6 3.4-9.6 3.4L16 28.6l-3.4-9.6L3 15.6l9.6-3.4z" fill="#FFD75E" stroke="#2b2140" stroke-width="2.4" stroke-linejoin="round"/></svg></span><div class="t"><b>تحديث جديد</b><small>بوتات أذكى وأسئلة أكتر في "اعرف مين معايا" و"الجاسوس"</small></div><span class="g">اعرف</span></div><div class="cont">📮 للتواصل والاقتراحات: <a href="mailto:lamhgame23@gmail.com" dir="ltr">lamhgame23@gmail.com</a></div><div class="dev">تطوير: elnaholy</div></div>`;
  fetch('/rooms').then(r => r.json()).then(l => { const e = $('rl'); if (!e || S) return; e.innerHTML = l.length ? '<b>غرف مفتوحة:</b> ' + l.map(r => `<button class="chip" onclick="$('cd').value='${r.code}';jn()">${r.code} • ${esc(r.host)} (${r.n})</button>`).join('') : '' }).catch(() => { });
}
function mk() { const n = nm(); const f = () => send({ t: 'create', name: n, ...profInfo() }); if (ws && ws.readyState === 1) f(); else conn(f) }
function jn() { const n = nm(), c = ($('cd').value || '').trim(); if (c.length < 4) return toast('اكتب كود الغرفة (٤ أرقام)'); try { localStorage.removeItem('mbSess') } catch (e) { } const f = () => send({ t: 'join', code: c, name: n, ...profInfo() }); if (ws && ws.readyState === 1) f(); else conn(f) }
function shareLink() {
  const url = location.origin + '/?r=' + S.code, text = 'تعالى العب معايا في لمّة، غرفة ' + S.code + ' 🎭';
  if (navigator.share) { navigator.share({ title: 'لمّة', text, url }).catch(() => { }); return }
  const done = () => toast('اللينك اتنسخ 🔗 ابعته لصحابك: ' + url);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(() => prompt('انسخ اللينك', url)); else prompt('انسخ اللينك', url);
}
function kick(id) { const p = pl(id); if (confirm('تطرد ' + p.name + ' من الغرفة؟')) send({ t: 'kick', id }) }
function leaveRoom() { if (!confirm('تخرج من الغرفة؟')) return; send({ t: 'leave' }); vstop(); try { localStorage.removeItem('mbSess') } catch (e) { } S = null; home() }
// ---------- room
function card(sd, big) {
  const p = pl(sd.id), c = sd.card, turn = S.turn === sd.id && S.phase === 'play';
  return `<div class="pc ${turn ? 'turn' : ''} ${sd.done ? 'done' : ''} ${sd.id === S.you ? 'me' : ''}">
  <div class="img">${c ? `<img src="${esc(c.i)}" referrerpolicy="no-referrer" onerror="this.style.opacity=.15">` : '<div class="qm">❓</div>'}${sd.done && sd.rank ? `<span class="rk">#${sd.rank}</span>` : ''}${sd.miss ? '<span class="rk bad">يفوّت</span>' : ''}</div>
  <div class="cn">${c ? esc(c.n) : 'إنت مش شايف كارتك!'}</div>
  <div class="who">${p.bot ? '🤖 ' + esc(p.name) : PN(p)}${sd.id === S.you ? ' (إنت)' : ''} <b>${p.score}</b>${sd.gain && S.phase === 'result' ? ` <i>+${sd.gain}</i>` : ''}</div></div>`;
}
function board() { return `<div class="sb">${[...S.players].sort((a, b) => b.score - a.score).map((p, i) => `<span class="chip ${p.id === S.you ? 'me' : ''}">${i === 0 && p.score > 0 ? '👑' : ''}${p.bot ? '🤖 ' + esc(p.name) : PN(p)} <b>${p.score}</b></span>`).join('')}</div>` }
function plist() {
  const host = S.host === S.you, ph = S.phase === 'lobby' || S.phase === 'sres' || S.phase === 'dchamp';
  return `<div class="pls">${S.players.map(p => `<div class="pr ${p.on ? '' : 'off'}"><span class="pn">${S.host === p.id ? '👑' : ''}${p.bot ? '🤖 ' + esc(p.name) : PN(p)}${p.id === S.you ? ' <small>(إنت)</small>' : ''}</span><b class="sc" title="النقط">${p.score}</b><span class="st" title="${p.on ? 'موجود' : 'غايب'}">${p.on ? '🟢' : '⚪'}</span><span class="mc ${p.mic ? '' : 'moff'}" title="${p.mic === 1 ? 'المايك شغال' : p.mic === 2 ? 'المايك مكتوم' : 'المايك مقفول'}">${p.mic === 2 ? '🔇' : '🎙️'}</span>${ph && !p.bot ? `<span class="rd">${p.ready ? '✅' : '⏳'}</span>` : ''}${host && p.id !== S.you ? `<button class="ib" title="خليه هوست" ${p.bot || !p.on ? 'disabled' : ''} onclick="send({t:'host',id:'${p.id}'})">👑</button><button class="ib rd" title="اطرده" onclick="kick('${p.id}')">🚫</button>` : ''}</div>`).join('')}</div>`;
}
function rhist() {
  if (!S.rh.length) return '<p class="mut">لسه مفيش جولات اتلعبت</p>';
  return `<div class="rhs">${[...S.rh].reverse().map(r => { const c = cfg.cats.find(x => x.id === r.cat) || {}; return `<div class="rh"><b>#${r.n}</b> ${r.g === 'spy' ? '🕵️' : r.g === 'duel' ? '⚔️' : '🎭'} ${r.g === 'duel' ? '' : c.emoji || ''} <span>${r.w.length ? '🏆 ' + r.w.map(esc).join('، ') : esc(r.note || '—')}</span>${r.w.length && r.note ? ` <small>${esc(r.note)}</small>` : ''}</div>` }).join('')}</div>`;
}
const GAMES = [['who', '🎭', 'اعرف مين معايا'], ['spy', '🕵️', 'الجاسوس'], ['duel', '⚔️', 'المبارزة'], ['snake', '🐍', 'السلم والتعبان']];
function lobby() {
  const host = S.host === S.you, me = pl(S.you), spy = S.game === 'spy', duel = S.game === 'duel', n = S.players.length, hum = S.players.filter(p => !p.bot && p.on), rd = hum.filter(p => p.ready).length;
  const opt = (arr, cur, key, fmtf) => `<div class="row wrap">${arr.map(v => `<button class="chip ${cur === v ? 'sel' : ''}" ${host ? `onclick="send({t:'set',${key}:${v}})"` : 'disabled'}>${fmtf(v)}</button>`).join('')}</div>`;
  return `<div class="lob"><div class="card"><h3>👥 اللاعبين (${n}/8) • كود الغرفة <span class="code">${S.code}</span></h3>${plist()}
    <div class="row wrap"><button class="chip" onclick="shareLink()">🔗 لينك الدعوة</button><button class="chip" onclick="frOpen('f')">👥 ادعو صديق</button>${host ? `<button class="chip" onclick="send({t:'addbot'})">🤖 ضيف بوت</button><button class="chip" onclick="send({t:'rmbot'})">➖ شيل بوت</button>` : ''}</div>
    <h3>🏆 نتايج الجولات</h3>${rhist()}</div>
    <div class="card"><h3>🎮 اللعبة ${host ? '' : '(الهوست بيختار)'}</h3><div class="cats">${GAMES.map(g => `<button class="cat ${S.game === g[0] ? 'sel' : ''}" ${host ? `onclick="send({t:'set',game:'${g[0]}'})"` : 'disabled'}><span>${g[1]}</span>${g[2]}</button>`).join('')}</div>
    ${duel ? `<h3>🎯 مجال الأسئلة</h3><div class="cats">${cfg.dcats.map(c => `<button class="cat ${c.id === S.dcat ? 'sel' : ''}" ${host ? `onclick="send({t:'set',dcat:'${c.id}'})"` : 'disabled'}><span>${c.emoji}</span>${c.name}<small>${c.n}</small></button>`).join('')}</div><h3>⏱ وقت كل نص (النص الأول والتاني)</h3>${opt([60, 120, 180, 300], S.dT, 'dT', v => v / 60 + ' دقيقة')}` : `<h3>🎯 المجال</h3><div class="cats">${cfg.cats.map(c => `<button class="cat ${c.id === S.cat ? 'sel' : ''}" ${host ? `onclick="send({t:'set',cat:'${c.id}'})"` : 'disabled'}><span>${c.emoji}</span>${c.name}<small>${c.n}</small></button>`).join('')}</div>`}
    ${duel ? '' : spy ? `<h3>🕵️ عدد الجواسيس</h3>${opt([1, 2], S.spies, 'spies', v => v === 1 ? 'جاسوس واحد' : 'اتنين (من ٦ لاعبين)')}<h3>🗣 وقت كل كلمة</h3>${opt([20, 30, 45, 60], S.clueT, 'clueT', v => v + ' ث')}<h3>🗳 وقت النقاش والتصويت</h3>${opt([45, 60, 90, 120], S.voteT, 'voteT', v => v + ' ث')}` : `<h3>⏱ وقت الجولة</h3>${opt([60, 180, 300, 600, 900], S.dur, 'dur', v => v / 60 + ' دقيقة')}`}
    <button class="btn ${me.ready ? 't' : 'y'} big2" onclick="send({t:'ready'})">${me.ready ? '✅ إنت جاهز (دوس تلغي)' : '🙋 جاهز'}</button>
    <p class="mut">اللعبة بتبدأ لما كل اللاعبين يدوسوا "جاهز" (${rd}/${hum.length}). ${spy ? 'الجاسوس من ٣ لـ٨ لاعبين، ولو أقل بيتضاف بوتات.' : ''}</p>
    ${host ? `<button class="btn big2" onclick="send({t:'start'})">🚀 ابدأ دلوقتي</button>` : ''}</div></div>`;
}
/* ================= السلم والتعبان (واجهة) ================= */
var SNL = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
var SNS = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
var SNC = ['#FFC93C', '#3BA7E8', '#43C36B', '#A26BFF', '#FF8A3D', '#FF4D6D', '#9AA7B5', '#B07A4A'];
var SNBOOT = null, SNWIN = 0;
function snMark(id) { var i = (S && S.sn ? S.sn.order : []).indexOf(id), c = SNC[i < 0 ? 0 : i % 8]; return '<span class="snm" style="background:' + c + '"></span>' }
function snLobby() {
  var host = S.host === S.you, me = pl(S.you), hum = S.players.filter(function (p) { return !p.bot && p.on }), rd = hum.filter(function (p) { return p.ready }).length;
  var d = (S.sn && S.sn.diff) || S.sdiff || 2;
  var dif = [1, 2, 3].map(function (v) { return '<button class="chip ' + (d === v ? 'sel' : '') + '" ' + (host ? 'onclick="send({t:\'sndiff\',v:' + v + '})"' : 'disabled') + '>' + ['😴 سهل', '🙂 متوسط', '😈 صعب'][v - 1] + '</button>' }).join('');
  return '<div class="lob"><div class="card"><h3>🐍 السلم والتعبان • كود الغرفة <span class="code">' + S.code + '</span></h3>' + plist() +
    '<div class="row wrap"><button class="chip" onclick="shareLink()">🔗 لينك الدعوة</button><button class="chip" onclick="frOpen(\'f\')">👥 ادعو صديق</button>' + (host ? '<button class="chip" onclick="send({t:\'addbot\'})">🤖 ضيف بوت</button><button class="chip" onclick="send({t:\'rmbot\'})">➖ شيل بوت</button>' : '') + '</div>' +
    '<p class="mut">اللعبة دي لاتنين: إنت وصاحبك (بالكود فوق) أو إنت وبوت. اللي يوصل ١٠٠ الأول يكسب.</p>' +
    (host ? '<h3>🤖 صعوبة البوت</h3><div class="row wrap">' + dif + '</div>' : '') +
    '<button class="btn ' + (me.ready ? 't' : 'y') + ' big2" onclick="send({t:\'ready\'})">' + (me.ready ? '✅ إنت جاهز (دوس تلغي)' : '🙋 جاهز') + '</button>' +
    (host ? '<button class="btn big2" onclick="send({t:\'start\'})">🚀 ابدأ</button>' : '<p class="mut">مستني الهوست يبدأ (' + rd + '/' + hum.length + ' جاهز)</p>') +
    (host ? '<button class="btn big2" onclick="send({t:\'set\',game:\'who\'})">🎭 رجّعني لألعاب الغرفة</button>' : '') +
    '</div></div>'
}
function snCell(n) {
  var pos = S.sn.pos || {}, toks = '';
  (S.sn.order || []).forEach(function (id) { if ((pos[id] | 0) === n) toks += '<i class="snt">' + snMark(id) + '</i>' });
  var cls = 'snc' + (SNL[n] ? ' lad' : SNS[n] ? ' snk' : '') + (n === 100 ? ' fin' : '') + (n === 1 ? ' st' : '');
  var ic = SNL[n] ? '<span class="sni">↑</span>' : SNS[n] ? '<span class="sni">↓</span>' : '';
  return '<div class="' + cls + '"><span class="snn">' + n + '</span>' + ic + toks + '</div>'
}
function snBoard() {
  var h = '';
  for (var r = 9; r >= 0; r--) for (var i = 0; i < 10; i++) { var n = r * 10 + (r % 2 === 0 ? i + 1 : 10 - i); h += snCell(n) }
  return '<div class="snb">' + h + '</div>'
}
var SNFP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function snFace(d) { var on = SNFP[d] || [], h = ''; for (var i = 0; i < 9; i++) h += '<b class="sdp' + (on.indexOf(i) >= 0 ? ' on' : '') + '"></b>'; return h }
function snBody() {
  var sn = S.sn, me = S.you, host = S.host === S.you, my = sn.turn === me, won = sn.win;
  var who = sn.order.map(function (id) {
    var p = pl(id), ps = (sn.pos[id] | 0);
    return '<div class="snp' + (id === sn.turn && !won ? ' on' : '') + '"><i>' + snMark(id) + '</i><b>' + esc(p.name) + '</b><small>' + ps + '</small></div>'
  }).join('');
  var dice = '<div class="sndice" id="snd">' + snFace(sn.dice) + '</div>';
  var act;
  if (won) act = '<div class="snw">🏆 ' + esc(pl(won).name) + ' كسب!</div>' + (host ? '<button class="btn y big2" onclick="send({t:\'snre\'})">🔄 العبوا تاني</button>' : '<p class="mut">مستني الهوست يبدأ جولة جديدة</p>');
  else if (my) act = '<button class="btn y big2" onclick="send({t:\'roll\'})">🎲 ارمي الزهر</button>';
  else act = '<p class="mut" style="text-align:center;margin:4px 0">⏳ دور ' + esc(pl(sn.turn).name) + '…</p>';
  var log = (sn.log || []).slice(-4).map(function (t) { return '<div class="snl">' + esc(t) + '</div>' }).join('');
  return '<div class="snwrap"><div class="sntop"><div class="snps">' + who + '</div>' + dice + '</div>' + snBoard() + '<div class="snact">' + act + '</div><div class="snlog">' + log + '</div></div>'
}
function snClose() { var m = document.getElementById('snm'); if (m) m.remove() }
function snOpen() {
  if (document.getElementById('snm')) return;
  var d = document.createElement('div'); d.id = 'snm'; d.className = 'modal'; d.onclick = function (e) { if (e.target === d) snClose() };
  d.innerHTML = '<div class="dcb"><div class="dchd"><span class="dcfl sm">🐍</span><b>السلم والتعبان</b></div>' +
    '<p class="dcq" style="min-height:0;font-size:15px">اللي يوصل ١٠٠ الأول يكسب. في سلالم بتطلعك وتعبانات بتنزّلك.</p>' +
    '<button class="btn y big2" onclick="snSolo(1)">😴 العب لوحدك — بوت سهل</button>' +
    '<button class="btn t big2" onclick="snSolo(2)">🙂 العب لوحدك — بوت متوسط</button>' +
    '<button class="btn r big2" onclick="snSolo(3)">😈 العب لوحدك — بوت صعب</button>' +
    '<button class="btn big2" onclick="snDuo()">👥 غرفة مع صاحبك (كود)</button>' +
    '<div class="row"><button class="btn" onclick="snClose()">قفل</button></div></div>';
  document.body.appendChild(d)
}
function snSolo(d) { snClose(); SNBOOT = { d: d, duo: 0, step: 0 }; mk() }
function snDuo() { snClose(); SNBOOT = { d: 2, duo: 1, step: 0 }; mk() }
function snBoot() {
  if (!SNBOOT || !S || S.phase !== 'lobby' || S.host !== S.you) return;
  var st = SNBOOT;
  if (st.step === 0) {
    st.step = 1;
    if (!st.duo && !S.players.some(function (p) { return p.bot })) send({ t: 'addbot' });
    send({ t: 'set', game: 'snake', sdiff: st.d });
    return
  }
  if (st.step !== 1 || S.game !== 'snake') return;
  var ok = st.duo ? S.players.filter(function (p) { return !p.bot }).length >= 2 : S.players.length >= 2;
  if (!ok) return;
  SNBOOT = null;
  send({ t: 'ready' });
  setTimeout(function () { send({ t: 'start' }) }, 260)
}
var _rd3 = render; render = function () { snBoot(); snWin(); return _rd3.apply(this, arguments) };
function snWin() {
  if (!S || !S.sn || !S.sn.win) { if (!S || !S.sn) SNWIN = 0; return }
  if (SNWIN === S.sn.win + ':' + S.code) return;
  SNWIN = S.sn.win + ':' + S.code;
  setTimeout(function () { var w = document.querySelector('.snw'); if (w && w.scrollIntoView) w.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 200);
  if (S.sn.win === S.you) { try { SFX.win() } catch (e) { } confetti(); setTimeout(confetti, 400) }
  else { try { SFX.turn() } catch (e) { } }
}
// ================= المبارزة (واجهة) =================
function dbracket() {
  const du = S.du, N = id => id ? esc(pl(id).name) : '—';
  return `<div class="brk">${du.rounds.map((rr, ri) => `<div class="brr"><b>${ri === du.rounds.length - 1 && rr.length === 1 ? '🏁 النهائي' : 'الدور ' + (ri + 1)}</b>${rr.map((m, mi) => { const live = ri === du.r && mi === du.pi && S.phase !== 'dwait'; return m.bye ? `<div class="bm"><span class="w">${N(m.a)}</span> <small>🎫 bye</small></div>` : `<div class="bm ${live ? 'live' : ''}"><span class="${m.w === m.a ? 'w' : ''}">${N(m.a)}</span> <small>${m.w ? (m.sa != null ? '' : '') : 'ضد'}</small> <span class="${m.w === m.b ? 'w' : ''}">${N(m.b)}</span>${live ? ' 🔴' : ''}</div>` }).join('')}</div>`).join('')}</div>`;
}
function duelBody() {
  const du = S.du, c = du.cur, ph = S.phase, host = S.host === S.you, N = id => esc(pl(id).name), me = S.you;
  const dc = (cfg.dcats || []).find(x => x.id === S.dcat) || {};
  const bar = c ? `<div class="dsc">${[c.a, c.b].map(id => `<div class="ds ${c.asker === id ? 'ask' : ''} ${id === me ? 'meb' : ''}"><b>${N(id)}${id === me ? ' (إنت)' : ''}</b><i>${c.sc[id]}</i><small>${c.sd ? '' : '⏭ ' + c.sk[id] + ' • '}${c.asker === id ? '🎤 بيسأل' : '🗣 بيجاوب'}</small></div>`).join('<span class="vs">⚔️</span>')}</div>` : '';
  if (ph === 'dwait') return `<div class="dm"><h2>🏟️ البطولة</h2><p class="mut">المبارزة الجاية بعد ${du.tl} ث...</p>${dbracket()}${board()}</div>`;
  if (ph === 'dintro') return `<div class="dm"><h2>⚔️ ${N(c.a)} ضد ${N(c.b)}</h2><p>${c.a === me || c.b === me ? '🎙️ جهّز المايك! ' : '👀 هتتفرج. '}النص الأول: <b>${N(c.asker)}</b> بيسأل و<b>${N(c.ans)}</b> بيجاوب بصوته</p><p class="mut">يبدأ بعد ${du.tl} ث</p>${bar}</div>`;
  if (ph === 'dmid') return `<div class="dm"><h2>🔄 النص التاني</h2><p>اتبدلت الأدوار: <b>${N(c.asker)}</b> بيسأل دلوقتي و<b>${N(c.ans)}</b> بيجاوب</p>${bar}<p class="mut">يبدأ بعد ${du.tl} ث</p></div>`;
  if (ph === 'dsd') return `<div class="dm"><h2>⚡ تعادل! موت مفاجئ</h2><p>سؤال واحد لكل واحد. اللي يجاوب صح والتاني يغلط يكسب. يبدأ بعد ${du.tl} ث</p>${bar}</div>`;
  if (ph === 'dplay') {
    const sd = c.sd;
    let mid;
    if (c.asker === me) mid = `<div class="qcard"><small>${(cfg.dcats.find(x => x.id === (c.q && c.q.c)) || {}).emoji || ''} ${(cfg.dcats.find(x => x.id === (c.q && c.q.c)) || {}).name || ''}</small><div class="qq">${c.q ? esc(c.q.q) : '...'}</div><div class="qa">✔ الإجابة: <b>${c.q ? esc(c.q.a) : ''}</b></div></div>
      <p class="mut">اسأل السؤال بصوتك، وبعدين احكم على إجابة ${N(c.ans)}</p>
      <div class="row wrap" style="justify-content:center"><button class="btn t big2" onclick="send({t:'ans',ok:true})">✅ صح</button><button class="btn r big2" onclick="send({t:'ans',ok:false})">❌ غلط</button>${sd ? '' : `<button class="btn" onclick="send({t:'skip'})">⏭ تخطي</button>`}</div>`;
    else if (c.ans === me) mid = `<div class="qcard wt"><div class="qq">🗣 جاوب بصوتك على سؤال ${N(c.asker)}!</div><div class="qa">${sd ? '⚡ سؤال الموت المفاجئ' : 'كل إجابة صح بتزود نقطتك'}</div></div>`;
    else mid = `<div class="qcard wt"><div class="qq">👀 ${N(c.asker)} بيسأل و${N(c.ans)} بيجاوب</div><div class="qa">${sd ? '⚡ موت مفاجئ' : 'السكور بيتحدث لايف'}</div></div>`;
    return `<div class="dm">${bar}${mid}<p class="mut">${dc.emoji || ''} ${esc(dc.name || '')} • النص ${c.half > 2 ? '⚡' : c.half}</p></div>`;
  }
  if (ph === 'dres') {
    const r = du.res, how = { score: 'بأكتر إجابات صح', skips: 'بتخطي أقل بعد التعادل', sd: 'بالموت المفاجئ', ff: 'بانسحاب المنافس' }[r.how];
    return `<div class="dm"><h2>🏅 ${N(r.w)} كسب المبارزة!</h2><p class="big2s">${N(r.a)} <b>${r.sa}</b> : <b>${r.sb}</b> ${N(r.b)}</p><p>${how} • الفايز +10 والتاني +5</p>${board()}<p class="mut">اللي بعده بعد ${du.tl} ث</p></div>`;
  }
  if (ph === 'dchamp') {
    const me0 = pl(me), hum = S.players.filter(p => !p.bot && p.on), rd = hum.filter(p => p.ready).length;
    return `<div class="dm"><h2>👑 البطل: ${du.champ ? N(du.champ) : '—'}</h2><div class="trophy">🏆</div>${dbracket()}${board()}
    <div class="row wrap" style="justify-content:center"><button class="btn ${me0.ready ? 't' : 'y'}" onclick="send({t:'ready'})">${me0.ready ? '✅ جاهز (' + rd + '/' + hum.length + ')' : '🔁 بطولة جديدة (' + rd + '/' + hum.length + ')'}</button>${host ? `<button class="btn" onclick="send({t:'tolobby'})">🏠 غيّر اللعبة أو المجال</button>` : ''}</div></div>`;
  }
  return '';
}
function body() {
  const host = S.host === S.you, cat = (cfg.cats.find(c => c.id === S.cat) || {});
  if (S.game === 'snake') return S.phase === 'lobby' ? snLobby() : snBody();
  if (S.phase === 'lobby') return lobby();
  if (S.phase[0] === 's') return spyBody();
  if (S.phase[0] === 'd') return duelBody();
  if (S.phase === 'result') {
    const sorted = [...S.seats].sort((a, b) => (a.rank || 99) - (b.rank || 99));
    return `<div class="res"><h2>🏁 النتيجة</h2><div class="cards">${sorted.map(s => card(s)).join('')}</div>${board()}
    ${votePanel('🏁 الجولة خلصت!')}
    ${host ? `<button class="btn" onclick="send({t:'tolobby'})">🏠 اللوبي (غيّر اللعبة أو المجال)</button>` : ''}</div>`;
  }
  const mine = S.seats.find(s => s.id === S.you), last = S.log[S.log.length - 1];
  let act = '';
  if (!mine) act = `<div class="act"><p class="mut">👀 إنت متفرج في الجولة دي، هتلعب في اللي بعدها</p></div>`;
  else if (S.phase === 'break') act = votePanel('⏰ الوقت خلص!');
  else if (mine && mine.done) act = `<div class="act"><p class="mut">🎉 إنت خلصت! كارتك طلع <b>${esc(mine.card.n)}</b>. اتفرج على الباقي وشجّعهم بالإيموجي</p></div>`;
  else if (S.pend) {
    act = S.pend.mine ? `<div class="act"><p>⏳ مستني الباقي يجاوبوا على: <b>${esc(S.pend.text)}</b></p></div>` : S.pend.voted ? `<div class="act"><p class="mut">صوتك اتسجل</p></div>` : `<div class="act"><p>❓ ${esc(pl(S.pend.by).name)} بيسأل: <b>${esc(S.pend.text)}</b> (بالنسبة لكارته)</p><div class="row"><button class="btn t" onclick="send({t:'vote',y:1})">✅ أيوه</button><button class="btn r" onclick="send({t:'vote',y:0})">❌ لأ</button></div></div>`;
  } else if (S.turn === S.you) {
    act = `<div class="act mine"><div class="row cr"><b>🎤 دورك (${S.tLeft}ث)</b>${S.q.map(q => `<button class="chip q" onclick="send({t:'ask',qi:${q.i}})">${esc(q.t)}</button>`).join('')}</div>
    <div class="row"><input id="fq" class="inp" maxlength="80" placeholder="اسأل سؤال أيوه/لأ (الناس تصوّت)"><button class="btn t sm" onclick="askf()">اسأل</button></div>
    <div class="row"><input id="gs" class="inp" maxlength="40" placeholder="عارف إنت مين؟ اكتب الاسم"><button class="btn y sm" onclick="gsend()">خمّن!</button><button class="btn p sm" onclick="send({t:'hint'})">💡 تلميح</button></div>
    ${mine && mine.hints.length ? `<div class="hints">${mine.hints.map(h => '💡 ' + esc(h)).join(' • ')}</div>` : ''}</div>`;
  } else act = `<div class="act"><p class="mut">⏳ دور <b>${esc(pl(S.turn).name)}</b> (${S.tLeft}ث) — اسمع أسئلته وجاوب 😉</p>${mine && mine.hints.length ? `<div class="hints">${mine.hints.map(h => '💡 ' + esc(h)).join(' • ')}</div>` : ''}</div>`;
  const skp = S.phase === 'play' && mine ? (() => { const hum = S.players.filter(p => !p.bot && p.on && S.seats.some(q => q.id === p.id)), n = hum.filter(p => (S.bs || {})[p.id]).length; return `<div class="row"><button class="chip ${(S.bs || {})[S.you] ? 'sel' : ''}" onclick="send({t:'bskip'})">⏭ تخطي روند ${n ? '(' + n + '/' + hum.length + ')' : ''}</button></div>` })() : '';
  return `<div class="play"><div class="cards">${S.seats.map(s => card(s)).join('')}</div><div class="tick">${last ? esc(last.text) : ''}</div>${act}${skp}</div>`;
}
// ---------- الجاسوس
function itemCard(it, cls, click) { return `<div class="pc ${cls || ''}" ${click ? `onclick="${click}" style="cursor:pointer"` : ''}><div class="img"><img src="${esc(it.i)}" referrerpolicy="no-referrer" onerror="this.style.opacity=.15"></div><div class="cn">${esc(it.n)}</div></div>` }
function spyBody() {
  const sp = S.sp, host = S.host === S.you; if (!sp) return '<p class="mut">...</p>';
  const cat = cfg.cats.find(c => c.id === S.cat) || {}, nameOf = id => esc(pl(id).name);
  const secret = sp.spy ? `<div class="spyb"><div class="big">🕵️</div><b>إنت الجاسوس!</b><small>مش عارف الكلمة السرية. اسمع كلام الباقيين وداري على نفسك${sp.mates.length ? '<br>الجاسوس التاني: ' + sp.mates.map(nameOf).join('، ') : ''}</small></div>` : (sp.secret ? `<div class="secb">${itemCard(sp.secret, 'me')}<small>الكلمة السرية (${esc(cat.name || '')}). فيه ${sp.k === 1 ? 'جاسوس واحد' : sp.k + ' جواسيس'} وسطكم، لمّح من غير ما تقولها</small></div>` : '<p class="mut">👀 متفرج</p>');
  const clueOf = id => { const c = sp.clues.find(x => x.id === id); return c ? esc(c.text) : '' };
  const ph = S.phase;
  if (ph === 'sclue') {
    const my = sp.turn === S.you, inOrder = sp.order.includes(S.you);
    return `<div class="spy-g"><div class="spyl">${secret}</div><div class="spyr"><h3>🗣 كل واحد يقول كلمة واحدة بتوصف الكلمة السرية (جولة ${sp.n})</h3>
    <div class="sb">${sp.order.map(id => `<span class="chip ${sp.turn === id ? 'sel' : ''} ${id === S.you ? 'me' : ''}">${pl(id).bot ? '🤖' : ''}${nameOf(id)}: <b>${clueOf(id) || (sp.turn === id ? '🎤...' : '·')}</b></span>`).join('')}</div>
    ${my ? `<div class="act mine"><div class="row"><b>🎤 دورك (${sp.left}ث)</b><input id="cl" class="inp" maxlength="24" placeholder="كلمة واحدة توصف من غير ما تنطق الاسم" onkeydown="if(event.key==='Enter')clsend()"><button class="btn y sm" onclick="clsend()">قول</button></div></div>` : `<div class="act"><p class="mut">⏳ دور <b>${sp.turn ? nameOf(sp.turn) : ''}</b> (${sp.left}ث). تقدر تقول كلمتك صوت في المايك أو تكتبها في الشات</p></div>`}
    ${!inOrder ? '<p class="mut">👀 إنت متفرج، هتلعب الجولة الجاية</p>' : ''}</div></div>`;
  }
  if (ph === 'svote') {
    const voted = sp.voted;
    return `<div class="spy-g"><div class="spyl">${secret}</div><div class="spyr"><h3>🗳 مين الجاسوس؟ اتناقشوا وصوتوا (${sp.left}ث)</h3>
    <div class="vts">${sp.order.map(id => `<div class="vt"><div class="vn">${pl(id).bot ? '🤖 ' + nameOf(id) : PN(pl(id))} ${voted.includes(id) ? '<i>✔ صوّت</i>' : ''}</div><div class="vc">"${clueOf(id) || '—'}"</div>${id !== S.you && sp.order.includes(S.you) ? `<button class="chip ${sp.mine === id ? 'sel' : ''}" onclick="send({t:'svote',id:'${id}'})">${sp.mine === id ? '✅ ' : ''}هو الجاسوس</button>` : '<span class="mut">&nbsp;</span>'}</div>`).join('')}</div>
    <p class="mut">لازم أغلبية تتفق على واحد عشان يتكشف. الجاسوس لو اتكشف بيخمّن الكلمة.</p></div></div>`;
  }
  if (ph === 'sguess') {
    const g = S.sp.opts;
    return `<div class="spy-g"><div class="spyl">${secret}</div><div class="spyr"><h3>🎯 ${nameOf(S.sp.guesser)} اتكشف! فرصته الأخيرة (${sp.left}ث)</h3>
    ${g ? `<div class="cards">${g.map((it, k) => itemCard(it, '', `send({t:'sguess',k:${k}})`)).join('')}</div><p class="mut">اختار الكلمة السرية من الأربعة. لو صح تكسب!</p>` : `<p class="mut">⏳ الجاسوس بيختار الكلمة السرية من ٤ اختيارات...</p>`}</div></div>`;
  }
  if (ph === 'sres') {
    const r = sp.res, win = r.winner === 'spy', meSpy = r.spies.includes(S.you), mine = r.pts[S.you];
    const me = pl(S.you), hum = S.players.filter(p => !p.bot && p.on), rd = hum.filter(p => p.ready).length;
    return `<div class="res"><h2>${win ? '🕵️ الجاسوس كسب!' : '🎉 الفريق كسب!'}</h2>
    <div class="cards">${itemCard(sp.secret, 'me')}${r.spies.map(id => `<div class="pc turn"><div class="img"><div class="qm">🕵️</div></div><div class="cn">${nameOf(id)}</div><div class="who">الجاسوس${r.pts[id] ? ' <i>+5</i>' : ''}</div></div>`).join('')}</div>
    <p>الكلمة السرية: <b>${esc(sp.secret.n)}</b> • ${r.caught ? (r.guessed ? 'اتكشف بس خمّن الكلمة صح' : 'اتكشف وخمّن غلط') : 'محدش كشفه'}</p>
    <div class="sb">${S.players.filter(p => r.tally[p.id]).map(p => `<span class="chip">${esc(p.name)} 🗳${r.tally[p.id]}</span>`).join('')}</div>
    <p>${mine ? '🎁 كسبت +5 نقط! ' : ''}${Object.keys(r.pts).filter(id => id !== S.you).map(id => nameOf(id) + ' +5').join(' • ')}</p>
    ${board()}
    <div class="row wrap" style="justify-content:center"><button class="btn ${me.ready ? 't' : 'y'}" onclick="send({t:'ready'})">${me.ready ? '✅ جاهز (' + rd + '/' + hum.length + ')' : '🔁 جولة جديدة (' + rd + '/' + hum.length + ')'}</button>${host ? `<button class="btn" onclick="send({t:'tolobby'})">🏠 غيّر اللعبة أو المجال</button>` : ''}</div></div>`;
  }
  return '';
}
function clsend() { const e = $('cl'); const v = e && e.value.trim(); if (v) { send({ t: 'clue', text: v }); e.value = '' } }
function votePanel(title) {
  const hum = S.players.filter(p => !p.bot && p.on && S.seats.some(q => q.id === p.id)), bp = S.bp || {}, bs = S.bs || {};
  const picked = hum.filter(p => bp[p.id]), skipped = hum.filter(p => bs[p.id]);
  const vals = picked.map(p => bp[p.id]), diff = vals.length > 1 && vals.some(v => v !== vals[0]);
  const wait = hum.filter(p => !bp[p.id] && !bs[p.id]).map(p => p.name);
  const st = diff ? '⚠️ اختياراتكم مختلفة، اتفقوا على نفس الاسم عشان نكمل' : wait.length ? 'مستنيين: ' + wait.map(esc).join('، ') : '';
  return `<div class="brk"><h2>${title}</h2><p>مين كسب؟ كلكم دوسوا على نفس الاسم عشان نكمل للجولة الجاية</p>
  <div class="row wrap">${S.seats.map(s => { const n = pl(s.id).name, who = hum.filter(p => bp[p.id] === s.id); return `<button class="chip ${bp[S.you] === s.id ? 'sel' : ''}" onclick="send({t:'bpick',id:'${s.id}'})">${esc(n)} كسب ${who.length ? '👍' + who.length : ''}</button>` }).join('')}</div>
  <div class="row wrap"><button class="chip ${bs[S.you] ? 'sel' : ''}" onclick="send({t:'bskip'})">⏭ تخطي روند ${skipped.length ? '(' + skipped.length + '/' + hum.length + ')' : ''}</button></div>
  <small>${st}</small></div>`;
}
function askf() { const v = $('fq').value.trim(); if (v) send({ t: 'askf', text: v }) }
function gsend() { const v = $('gs').value.trim(); if (v) send({ t: 'guess', text: v }) }
function sidebar() {
  let msgs;
  if (chatTab === 'chat') msgs = S.chat.map(m => m.s ? `<div class="m s">${esc(m.text)}</div>` : `<div class="m ${m.id === S.you ? 'me' : ''}"><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('');
  else if (chatTab === 'pl') msgs = plist();
  else if (chatTab === 'rh') msgs = rhist();
  else msgs = S.log.map(l => `<div class="m s ${l.k}">${esc(l.text)}</div>`).join('');
  const tb = [['chat', '💬 شات'], ['pl', '👥'], ['rh', '🏆']]; if (S.phase !== 'lobby') tb.push(['log', '📜']);
  return `<div class="side"><div class="tabs">${tb.map(t => `<button class="${chatTab === t[0] ? 'sel' : ''}" onclick="chatTab='${t[0]}';render()">${t[1]}</button>`).join('')}</div>
  <div class="msgs" id="msgs">${msgs}</div>
  <div class="emos">${['😂', '👏', '😮', '🔥', '🤡', '💀', '❤️'].map(e => `<button onclick="send({t:'emo',e:'${e}'})">${e}</button>`).join('')}</div>
  <div class="row"><input id="ci" class="inp" maxlength="200" placeholder="اكتب رسالة..." onkeydown="if(event.key==='Enter')csend()"><button class="btn t sm" onclick="csend()">إرسال</button></div></div>`;
}
function csend() { const v = $('ci').value.trim(); if (v) { send({ t: 'chat', text: v }); $('ci').value = '' } }
function renderNow() {
  if (!S) return;
  const mid0 = document.querySelector('.mid'), ms0 = mid0 ? mid0.scrollTop : 0, samePh = rPh === S.phase + ':' + S.cat; rPh = S.phase + ':' + S.cat;
  const keep = {}; ['fq', 'gs', 'ci', 'cl'].forEach(id => { const e = $(id); if (e) keep[id] = [e.value, document.activeElement === e] });
  const sc = $('msgs') ? $('msgs').scrollTop : 0, bot = $('msgs') ? ($('msgs').scrollHeight - $('msgs').scrollTop - $('msgs').clientHeight < 40) : true;
  const tl = S.phase === 'play' ? S.left : (S.sp && 'sclue svote sguess'.includes(S.phase) ? S.sp.left : (S.du && S.phase === 'dplay' && S.du.cur && !S.du.cur.sd ? S.du.tl : null)), timer = tl != null ? `<span class="tm" id="tm">⏱ ${fmt(tl)}</span>` : '';
  A.innerHTML = `<div class="hd"><b class="ttl">${S.game === 'spy' ? '🕵️' : S.game === 'duel' ? '⚔️' : S.game === 'snake' ? '🐍' : '🎭'} ${S.game === 'duel' ? '' : esc((cfg.cats.find(c => c.id === S.cat) || {}).emoji || '')} ${S.code}</b><span class="chip me myp" title="نقطك في الغرفة">⭐ ${pl(S.you).score}</span>${timer}<span class="sp"></span><span id="vslot"></span><button class="ib" title="لينك دعوة" onclick="shareLink()">🔗</button><button class="ib" onclick="side=!side;render()">💬</button><button class="ib" onclick="helpOpen()">📖</button><button class="ib" onclick="theme()">${document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'}</button><button class="ib" onclick="fsToggle()">⛶</button><button class="ib rd" onclick="leaveRoom()">🚪</button></div>
  <div class="main ${side ? '' : 'noside'}"><div class="mid">${body()}</div>${side ? sidebar() : ''}</div>`;
  for (const id in keep) { const e = $(id); if (e) { e.value = keep[id][0]; if (keep[id][1]) e.focus() } }
  const mg = $('msgs'); if (mg) mg.scrollTop = bot ? mg.scrollHeight : sc;
  const mid1 = document.querySelector('.mid'); if (mid1 && samePh) mid1.scrollTop = ms0;
  vui();
}
setInterval(() => { if (S) { const base = S.phase === 'play' ? S.left : (S.sp && 'sclue svote sguess'.includes(S.phase) ? S.sp.left : (S.du && S.phase === 'dplay' && S.du.cur && !S.du.cur.sd ? S.du.tl : null)), e = $('tm'); if (base != null && e) { const d = (Date.now() - S._t) / 1000, l = Math.max(0, base - d); e.textContent = '⏱ ' + fmt(l); e.className = 'tm' + (l < 10 ? ' low' : ''); if (l < 6 && l > 0 && Math.floor(l) !== S._lt) { S._lt = Math.floor(l); SFX.tick() } } } }, 500);
// ---------- rules
function helpOpen() {
  if ($('helpm')) return; const d = document.createElement('div'); d.id = 'helpm'; d.className = 'modal'; d.onclick = e => { if (e.target === d) helpClose() };
  const H = [['🏠 الغرفة', 'اعمل غرفة وابعت لينك الدعوة (🔗) لصحابك، أو اكتبوا كود الغرفة. جوه الغرفة الهوست يختار اللعبة والمجال وكله يدوس "جاهز". الغرفة ماتش مستمر: بتلعبوا جولة ورا جولة من غير ما تخرجوا، والنقط بتتجمع.'],
  ['⭐ النقط', 'اللي بيكسب أي جولة ياخد ٥ نقط. نقطك دايمًا ظاهرة فوق، ومعاها نقط كل اللاعبين وسجل الجولات. النقط بتتجمع بين اللعبتين.'],
  ['👥 اللاعبين', 'قايمة اللاعبين بتبيّن مين موجود ومين غايب، ومين فاتح المايك. الهوست (👑) يقدر يطرد لاعب أو يدي الهوست لحد تاني.'],
  ['🎭 اعرف مين معايا', 'كل واحد بيتحط على دماغه كارت وإنت مش شايف كارتك. اسأل أسئلة أيوه/لأ أو خمّن اسمك. آخر الجولة بتظهر أزرار بأسماء اللاعبين ("محمد كسب"): لازم كلهم يدوسوا نفس الاسم عشان نكمل، وزرار "تخطي روند" لازم كلهم يدوسوه. الاسم اللي بيتختار ياخد ٥ نقط.'],
  ['🕵️ الجاسوس (٣ لـ٨ لاعبين)', 'كل اللاعبين بياخدوا نفس الكلمة السرية (من نفس مجالات اللعبة التانية) ما عدا الجاسوس، هو مش بيعرفها. بالدور كل واحد يقول كلمة واحدة توصف الكلمة من غير ما ينطقها (صوت أو كتابة). بعدها نقاش وتصويت على الجاسوس. لو الأغلبية كشفته بيخمّن الكلمة من ٤ اختيارات: لو صح يكسب، لو غلط الفريق يكسب. لو محدش اتكشف الجاسوس يكسب. لو اللاعبين قلال بيتضاف بوت ذكي بيلعب.'],
  ['⚔️ المبارزة (٢ لـ٨ لاعبين)', 'بطولة خروج مغلوب. الهوست يختار مجال الأسئلة (أو منوّع). اللاعبين بيتقسموا اتنين اتنين، ولو العدد فردي واحد بيعدّي بالـ bye. كل مبارزة نصين، كل نص بالوقت اللي الهوست حدده، والأدوار بتتبدل. اللي بيسأل بيشوف السؤال وإجابته على شاشته وبيقراه بصوته، واللي بيجاوب بيرد بصوته. بعدها اللي بيسأل يدوس ✅ أو ❌ وبينقل للسؤال اللي بعده، وممكن يتخطى سؤال. الأكتر في الإجابات الصح يكسب. لو اتعادلوا يكسب اللي تخطّى أقل، ولو لسه تعادل: موت مفاجئ بسؤال لكل واحد. باقي اللاعبين بيتفرجوا على السكور لايف. الفايز بيكمل لحد ما يفضل بطل واحد.'],
  ['🏅 نقط المبارزة', 'الفايز في كل مبارزة +١٠ والخسران +٥، والنقط بتتجمع مع باقي الألعاب في نفس الغرفة. من غير ما أي سؤال يتكرر في الغرفة.'],
  ['🎁 نقط الجاسوس', 'الجاسوس لو كسب ياخد ٥. ولو الفريق كسب، كل واحد صوّت صح على الجاسوس ياخد ٥. من ٦ لاعبين الهوست يقدر يختار جاسوسين.'],
  ['🎙 الصوت والشات', 'الشات الكتابي والمايك شغالين من أول ما تدخل، والإيموجي بتطلع قدام الكل.'],
  ['🤖 البوتات', 'لو اللاعبين أقل من اللازم بيتضاف بوت لوحده. تقدر كمان تضيف بوتات من اللوبي.']];
  d.innerHTML = `<div class="box"><div class="row"><h2 style="flex:1;margin:0">📖 إزاي تلعب في لمّة</h2><button class="ib rd" onclick="helpClose()">✖</button></div>${H.map(h => `<div class="rule"><b>${h[0]}</b><p>${h[1]}</p></div>`).join('')}<div class="dev">تطوير: elnaholy</div></div>`;
  document.body.appendChild(d);
}
function helpClose() { const d = $('helpm'); if (d) d.remove() }
// ================= الشات الصوتي =================
let ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }] };
let vStream = null, vOn = false, vMuted = false; const vPc = {}, vSt = {};
function vstat() {
  let e = $('vstat'); if (!e) { e = document.createElement('div'); e.id = 'vstat'; e.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:60;max-width:70vw;font-size:11px;line-height:1.3;padding:2px 8px;border-radius:10px;background:rgba(0,0,0,.65);pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:none'; document.body.appendChild(e) } if (!vOn) { e.style.display = 'none'; return }
  const v = Object.values(vSt); let t = '⏳ مستني حد تاني يدخل الصوت', c = '#aaa';
  if (v.length) { if (v.includes('fail')) { t = '❌ الصوت مش واصل، اخرج وادخل تاني'; c = '#ff8a80' } else if (v.includes('c')) { t = '⏳ بيتوصل بالصوت...'; c = '#ffd54f' } else { t = v.includes('relay') ? '✅ متصل (عبر وسيط)' : '✅ الصوت متصل'; c = '#69f0ae' } }
  e.textContent = t; e.style.color = c; e.style.display = 'block'
}
async function vkind(id) { const o = vPc[id]; if (!o) return; let k = 'ok'; try { const st = await o.pc.getStats(); st.forEach(r => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') { const l = st.get(r.localCandidateId); if (l && l.candidateType === 'relay') k = 'relay' } }) } catch (e) { } if (vSt[id]) { vSt[id] = k; vstat() } }
function vui() {
  const b = $('vslot'); if (!b) return;
  setTimeout(vstat, 0);
  b.innerHTML = vOn ? `<button class="ib ${vMuted ? '' : 'on'}" onclick="vmute()">${vMuted ? '🔇 مكتوم' : '🎙️ شغال'}</button> <button class="ib rd" onclick="vstop()">اخرج</button>` : `<button class="ib" style="background:#1565c0" onclick="vstart()">🎙️ شات صوتي</button>`;
}
async function vstart() {
  try { vStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 } }) } catch (e) { return toast('مش قادر أفتح المايك. اسمح للمتصفح بالمايك وجرب تاني. على الآيفون: إعدادات ← Safari ← المايك ← اسأل أو سماح، وبعدها حدّث الصفحة', 9000) }
  try { const r = await fetch('/ice', { cache: 'no-store' }); const j = await r.json(); if (j && j.iceServers) ICE = { iceServers: j.iceServers } } catch (e) { }
  vOn = true; vMuted = false; vui(); send({ t: 'vjoin' });
}
function vmute() { vMuted = !vMuted; if (vStream) vStream.getAudioTracks().forEach(t => t.enabled = !vMuted); send({ t: 'vmute', m: vMuted ? 1 : 0 }); vui() }
function vstop() { for (const k in vSt) delete vSt[k]; send({ t: 'vleave' }); for (const k in vPc) vclose(k); if (vStream) vStream.getTracks().forEach(t => t.stop()); vStream = null; vOn = false; vui() }
function vclose(id) { delete vSt[id]; vstat(); const o = vPc[id]; if (!o) return; try { o.pc.close() } catch (e) { }; if (o.el) o.el.remove(); delete vPc[id] }
function vmk(id) {
  if (vPc[id]) return vPc[id];
  const pc = new RTCPeerConnection(ICE), o = { pc, el: null, q: [] }; vPc[id] = o; vSt[id] = 'c'; vstat();
  vStream.getTracks().forEach(t => pc.addTrack(t, vStream));
  pc.onicecandidate = e => { if (e.candidate) send({ t: 'rtc', to: id, d: { c: e.candidate } }) };
  pc.ontrack = e => { if (!o.el) { o.el = document.createElement('audio'); o.el.autoplay = true; o.el.playsInline = true; document.body.appendChild(o.el) } o.el.srcObject = e.streams[0]; o.el.play().catch(() => { }) };
  pc.onconnectionstatechange = () => { const cs = pc.connectionState; if (cs === 'connected') { vSt[id] = 'ok'; vstat(); vkind(id); vbr(pc) } else if (cs === 'failed') { vSt[id] = 'fail'; vstat() } else if (cs === 'connecting' || cs === 'new') { if (vSt[id] !== 'fail') { vSt[id] = 'c'; vstat() } } else if (cs === 'closed') vclose(id) };
  return o;
}
function vsdp(s) { const m = /a=rtpmap:(\d+) opus\/48000/i.exec(s); if (!m) return s; const pt = m[1], f = 'a=fmtp:' + pt + ' minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=48000;maxplaybackrate=48000;cbr=0'; const re = new RegExp('a=fmtp:' + pt + ' [^\\r\\n]*'); return re.test(s) ? s.replace(re, f) : s.replace(m[0], m[0] + '\r\n' + f) }
function vbr(pc) { try { pc.getSenders().forEach(s => { if (s.track && s.track.kind === 'audio') { const p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}]; p.encodings[0].maxBitrate = 48000; s.setParameters(p).catch(() => { }) } }) } catch (e) { } }
async function voff(id) { vclose(id); const o = vmk(id); const off = await o.pc.createOffer(); await o.pc.setLocalDescription({ type: off.type, sdp: vsdp(off.sdp) }); send({ t: 'rtc', to: id, d: { s: o.pc.localDescription } }) }
async function vmsg(m) {
  if (m.t === 'vleave') { vclose(m.from); return }
  if (!vOn) return;
  try {
    if (m.t === 'vjoin') { vclose(m.from); send({ t: 'rtc', to: m.from, d: { h: 1 } }); if (S.you < m.from) await voff(m.from); return }
    const d = m.d;
    if (d.h) { if (S.you < m.from) await voff(m.from); return }
    const o = vmk(m.from);
    if (d.s) {
      if (d.s.type === 'offer' && o.pc.signalingState !== 'stable') { vclose(m.from); return vmsg(m) }
      await o.pc.setRemoteDescription(d.s);
      for (const c of o.q) await o.pc.addIceCandidate(c).catch(() => { }); o.q = [];
      if (d.s.type === 'offer') { const a = await o.pc.createAnswer(); await o.pc.setLocalDescription({ type: a.type, sdp: vsdp(a.sdp) }); send({ t: 'rtc', to: m.from, d: { s: o.pc.localDescription } }) }
    } else if (d.c) { if (o.pc.remoteDescription) await o.pc.addIceCandidate(d.c).catch(() => { }); else o.q.push(d.c) }
  } catch (e) { }
}

/* ===== our own art: icons replace emoji, drawn characters, badges ===== */
var EL = '#2b2140', EY = '#ffd23f', EP = '#ff5d8f', ET = '#3ec9c0', EV = '#7c5cff', EG = '#4caf50', EW = '#ffffff', ER = '#ff4b4b', EO = '#ff9f43';
function eI(s) { return '<svg class="ei" viewBox="0 0 32 32" aria-hidden="true">' + s + '</svg>' }
var _fb = '<circle cx="16" cy="16" r="12.5" fill="' + EY + '"/>', _ey = '<circle cx="11.5" cy="14" r="1.5" fill="' + EL + '" stroke="none"/><circle cx="20.5" cy="14" r="1.5" fill="' + EL + '" stroke="none"/>', _sm = '<path d="M10.5 19.5c2.5 3.5 8.5 3.5 11 0"/>';
var ICON = {
  camera: '<path d="M5 11h4l2-3h10l2 3h4v15H5z" fill="#fff"/><circle cx="16" cy="18" r="4.5" fill="#7c5cff"/>',
  smile: _fb + _ey + _sm,
  laugh: _fb + '<path d="M9.5 14.5q2-2.5 4 0M18.5 14.5q2-2.5 4 0"/><path d="M9.5 19h13q-1 6-6.5 6t-6.5-6z" fill="#fff"/>',
  wow: _fb + _ey + '<ellipse cx="16" cy="21.5" rx="2.6" ry="3.4" fill="' + EL + '"/>',
  wink: _fb + '<circle cx="11.5" cy="14" r="1.5" fill="' + EL + '" stroke="none"/><path d="M18.5 14.5q2-2.5 4 0"/>' + _sm,
  cool: _fb + '<path d="M6.5 12.5h19v3.5a3 3 0 0 1-3 3h-3.5a3 3 0 0 1-3-3v-1h-3v1a3 3 0 0 1-3 3H9.5a3 3 0 0 1-3-3z" fill="' + EL + '"/>' + _sm.replace('19.5', '23').replace('c2.5 3.5 8.5 3.5 11 0', 'c2.5 3 8.5 3 11 0'),
  think: _fb + _ey + '<path d="M11 21.5h8.5q2 0 2.5-2"/><path d="M9.5 10.5l4-1.5"/>',
  clown: '<circle cx="6" cy="9" r="4" fill="' + EP + '"/><circle cx="26" cy="9" r="4" fill="' + EP + '"/><circle cx="16" cy="16" r="12.5" fill="#fff"/>' + _ey + '<circle cx="16" cy="18" r="3" fill="' + ER + '"/><path d="M10.5 22.5c2.5 3 8.5 3 11 0"/>',
  hide: _fb + '<ellipse cx="10.5" cy="15" rx="4.5" ry="3.8" fill="' + EO + '"/><ellipse cx="21.5" cy="15" rx="4.5" ry="3.8" fill="' + EO + '"/><path d="M11 23c3 2.5 7 2.5 10 0"/>',
  hand: '<path d="M8 17V9.5a2 2 0 0 1 4 0V15V6.5a2 2 0 0 1 4 0V15V7.5a2 2 0 0 1 4 0V16V10.5a2 2 0 0 1 4 0V20c0 6-3.5 9-8.5 9S8 25 8 21z" fill="' + EY + '"/>',
  thumb: '<path d="M3 15h6v13H3z" fill="' + ET + '"/><path d="M9 15l5-10c3 0 4.5 2 3.5 5L16.5 14H26a2 2 0 0 1 2 2.5l-2 9a3 3 0 0 1-3 2.5H9z" fill="' + EY + '"/>',
  heart: '<path d="M16 28S3 20 3 11a6.5 6.5 0 0 1 13-2 6.5 6.5 0 0 1 13 2c0 9-13 17-13 17z" fill="' + ER + '"/>',
  skull: '<path d="M16 3C9 3 5 7.500 5 13c0 4 2 6 4 7v5h4v-2h6v2h4v-5c2-1 4-3 4-7 0-5.500-4-10-11-10z" fill="#fff"/><circle cx="11.500" cy="14" r="2.500" fill="' + EL + '"/><circle cx="20.500" cy="14" r="2.500" fill="' + EL + '"/>',
  star: '<path d="M16 3l3.8 8 8.700 1-6.400 6 1.700 8.700L16 22.500 8.200 26.700 9.900 18 3.500 12l8.700-1z" fill="' + EY + '"/>',
  moon: '<path d="M21 4a12 12 0 1 0 7 21A10 10 0 0 1 21 4z" fill="' + EY + '"/>',
  sun: '<circle cx="16" cy="16" r="6" fill="' + EY + '"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.800 6.800l2.800 2.800M22.400 22.400l2.800 2.800M6.800 25.200l2.800-2.800M22.400 9.600l2.800-2.800"/>',
  fire: '<path d="M16 3c1 5 8 8 8 16a8 8 0 0 1-16 0c0-4 2-6 3-8 1 3 2 3 3 1 0-3 1-6 2-9z" fill="' + EO + '"/><path d="M16 19c2 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5z" fill="' + EY + '"/>',
  bolt: '<path d="M18 2L6 18h8l-2 12 12-17h-8z" fill="' + EY + '"/>',
  gift: '<rect x="5" y="13" width="22" height="15" rx="1" fill="' + EP + '"/><rect x="3" y="9" width="26" height="6" rx="1" fill="' + EY + '"/><path d="M16 9v19"/><path d="M16 9c-2-5-8-5-7-1 1 2 7 1 7 1zM16 9c2-5 8-5 7-1-1 2-7 1-7 1z" fill="' + ET + '"/>',
  party: '<path d="M4 28L10 10l12 12z" fill="' + EY + '"/><path d="M17 4l1 4M25 9l-3 3M28 17l-4-1"/><circle cx="24" cy="4" r="1.500" fill="' + EP + '"/><circle cx="12" cy="4" r="1.500" fill="' + ET + '"/><circle cx="28" cy="10" r="1.500" fill="' + EV + '"/>',
  ticket: '<path d="M3 9h26v5a3 3 0 0 0 0 6v5H3v-5a3 3 0 0 0 0-6z" fill="' + EP + '"/><path d="M20 10v14" stroke-dasharray="2 2.500"/>',
  mask: '<path d="M3 6h14v9a7 7 0 0 1-14 0z" fill="' + EY + '"/><path d="M15 12h14v9a7 7 0 0 1-14 0z" fill="' + EP + '"/><circle cx="7" cy="10" r="1" fill="' + EL + '"/><circle cx="13" cy="10" r="1" fill="' + EL + '"/><circle cx="19" cy="17" r="1" fill="' + EL + '"/><circle cx="25" cy="17" r="1" fill="' + EL + '"/><path d="M6.500 14q3 3 6 0M18.500 22q3-3 6 0"/>',
  game: '<path d="M8 9h16a6 6 0 0 1 6 6v4a4 4 0 0 1-7 2.500L21 19h-10l-2 2.500a4 4 0 0 1-7-2.500v-4a6 6 0 0 1 6-6z" fill="' + EV + '"/><path d="M9 12.500v4M7 14.500h4" stroke="#fff"/><circle cx="22" cy="13.500" r="1.300" fill="' + EY + '" stroke="none"/><circle cx="25" cy="16" r="1.300" fill="' + EP + '" stroke="none"/>',
  target: '<circle cx="16" cy="16" r="12.500" fill="#fff"/><circle cx="16" cy="16" r="8" fill="' + ER + '"/><circle cx="16" cy="16" r="3.500" fill="#fff"/>',
  flag: '<path d="M6 3v27"/><path d="M6 5h20v13H6z" fill="#fff"/><path d="M6 5h5v4.300H6zM16 5h5v4.300h-5zM11 9.300h5v4.300h-5zM21 9.300h5v4.300h-5zM6 13.600h5V18H6zM16 13.600h5V18h-5z" fill="' + EL + '" stroke="none"/>',
  medal: '<path d="M10 3l6 11 6-11"/><circle cx="16" cy="20" r="8" fill="' + EY + '"/><path d="M16 15.500l1.500 3 3.300.4-2.400 2.300.6 3.300-3-1.600-3 1.600.6-3.300-2.400-2.300 3.300-.4z" fill="#fff" stroke-width="1.200"/>',
  trophy: '<path d="M9 4h14v9a7 7 0 0 1-14 0z" fill="' + EY + '"/><path d="M9 7H4c0 5 2 7 5 7M23 7h5c0 5-2 7-5 7"/><path d="M16 20v5M10 28h12M12 25h8" /><path d="M13 8v5" stroke="#fff"/>',
  stadium: '<ellipse cx="16" cy="13" rx="13" ry="6" fill="' + ET + '"/><path d="M3 13v8c0 3 6 5 13 5s13-2 13-5v-8" fill="' + EW + '"/><ellipse cx="16" cy="13" rx="7" ry="2.500" fill="' + EG + '"/>',
  home: '<path d="M4 15L16 4l12 11z" fill="' + ER + '"/><path d="M7 14v14h18V14" fill="#fff"/><rect x="13" y="19" width="6" height="9" fill="' + EY + '"/>',
  people: '<circle cx="11" cy="10" r="4.500" fill="' + ET + '"/><path d="M3 27c0-7 4-10 8-10s8 3 8 10z" fill="' + ET + '"/><circle cx="22" cy="11" r="4" fill="' + EP + '"/><path d="M17 27c0-6 2.500-9 6-9s6 3 6 9z" fill="' + EP + '"/>',
  crown: '<path d="M4 25L3 10l8 6 5-10 5 10 8-6-1 15z" fill="' + EY + '"/><path d="M4 28.500h24"/><circle cx="16" cy="19" r="1.800" fill="' + ER + '" stroke-width="1.200"/>',
  bulb: '<path d="M16 3a9 9 0 0 0-5 16.500V23h10v-3.500A9 9 0 0 0 16 3z" fill="' + EY + '"/><path d="M12 27h8M13.500 30h5"/>',
  chat: '<path d="M5 5h22a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H15l-6 6v-6H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="#fff"/><circle cx="10" cy="13.500" r="1.300" fill="' + EL + '"/><circle cx="16" cy="13.500" r="1.300" fill="' + EL + '"/><circle cx="22" cy="13.500" r="1.300" fill="' + EL + '"/>',
  hund: '<text x="16" y="21" text-anchor="middle" font-size="12" font-weight="900" fill="' + ER + '" stroke="none" font-family="Cairo,sans-serif">100</text><path d="M5 25h22M7 28h18" stroke="' + ER + '"/>',
  ten: '<rect x="3" y="3" width="26" height="26" rx="6" fill="' + ET + '"/><text x="16" y="22" text-anchor="middle" font-size="14" font-weight="900" fill="' + EL + '" stroke="none" font-family="Cairo,sans-serif">10</text>',
  book: '<path d="M3 6c5-2 10-1 13 2v20c-3-3-8-4-13-2zM29 6c-5-2-10-1-13 2v20c3-3 8-4 13-2z" fill="' + ET + '"/><path d="M16 8v20"/>',
  scroll: '<path d="M8 4h16a3 3 0 0 1 3 3v3h-3v15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-3h3z" fill="#fff6d8"/><path d="M12 10h8M12 15h8M12 20h8" stroke-width="1.600"/>',
  mail: '<rect x="3" y="7" width="26" height="19" rx="3" fill="#fff"/><path d="M3 9l13 10L29 9"/>',
  phone: '<rect x="8" y="3" width="16" height="26" rx="4" fill="' + EV + '"/><rect x="11" y="7" width="10" height="14" rx="1" fill="#fff" stroke-width="1.400"/><circle cx="16" cy="25" r="1.200" fill="#fff" stroke="none"/>',
  nophone: '<rect x="8" y="3" width="16" height="26" rx="4" fill="' + EV + '"/><rect x="11" y="7" width="10" height="14" rx="1" fill="#fff" stroke-width="1.400"/><path d="M4 4l24 24" stroke="' + ER + '" stroke-width="3"/>',
  repeat: '<path d="M26 12A10 10 0 0 0 7 11M6 20a10 10 0 0 0 19 1"/><path d="M26 5v7h-7M6 27v-7h7"/>',
  mute: '<path d="M4 12h5l7-6v20l-7-6H4z" fill="' + EY + '"/><path d="M21 12l7 8M28 12l-7 8" stroke="' + ER + '" stroke-width="2.500"/>',
  mic: '<rect x="11" y="3" width="10" height="16" rx="5" fill="' + EP + '"/><path d="M6 15a10 10 0 0 0 20 0M16 25v4M11 29h10"/>',
  lock: '<rect x="6" y="14" width="20" height="14" rx="3" fill="' + EY + '"/><path d="M10 14V10a6 6 0 0 1 12 0v4"/><circle cx="16" cy="21" r="2" fill="' + EL + '"/>',
  link: '<path d="M13 19a5 5 0 0 0 7 0l5-5a5 5 0 0 0-7-7l-2 2M19 13a5 5 0 0 0-7 0l-5 5a5 5 0 0 0 7 7l2-2"/>',
  eyes: '<ellipse cx="9" cy="16" rx="6" ry="8" fill="#fff"/><ellipse cx="23" cy="16" rx="6" ry="8" fill="#fff"/><circle cx="10.500" cy="17" r="2.500" fill="' + EL + '"/><circle cx="21.500" cy="17" r="2.500" fill="' + EL + '"/>',
  spy: '<path d="M4 14h24l-4-3-2-7H10L8 11z" fill="' + EL + '"/><path d="M9 14h14" stroke="' + EY + '"/><circle cx="13" cy="22" r="5" fill="#fff"/><path d="M17 26l8 5"/>',
  speak: '<circle cx="11" cy="15" r="7.500" fill="' + EY + '"/><circle cx="9" cy="13" r="1.200" fill="' + EL + '" stroke="none"/><path d="M8 18q3 2 6 0M22 9q4 6 0 12M26 5q7 11 0 22"/>',
  ballot: '<path d="M3 17h26v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="' + EV + '"/><path d="M9 17V5h14v12" fill="#fff"/><path d="M12 9h8M12 13h8" stroke-width="1.600"/><path d="M11 22h10" stroke="#fff"/>',
  rocket: '<path d="M16 3c5 3 7 9 6 16H10C9 12 11 6 16 3z" fill="#fff"/><circle cx="16" cy="12" r="2.500" fill="' + ET + '"/><path d="M10 15l-5 5 2 4 4-3M22 15l5 5-2 4-4-3" fill="' + ER + '"/><path d="M13 22l3 7 3-7z" fill="' + EO + '"/>',
  door: '<path d="M7 3h18v26H7z" fill="' + EO + '"/><circle cx="21" cy="17" r="1.600" fill="' + EY + '"/><path d="M4 29h24"/>',
  no: '<circle cx="16" cy="16" r="12" stroke="' + ER + '" stroke-width="3"/><path d="M7.500 7.500l17 17" stroke="' + ER + '" stroke-width="3"/>',
  dg: '<circle cx="16" cy="16" r="9" fill="' + EG + '"/>', dr: '<circle cx="16" cy="16" r="9" fill="' + ER + '"/>', dw: '<circle cx="16" cy="16" r="9" fill="#fff"/>',
  coin: '<circle cx="16" cy="16" r="12.500" fill="' + EY + '"/><circle cx="16" cy="16" r="8" fill="' + EO + '" stroke-width="1.600"/><path d="M16 11v10M12.500 14.500h7" stroke="' + EL + '" stroke-width="2"/>',
  m1: '<path d="M10 3l6 10 6-10"/><circle cx="16" cy="20" r="9" fill="' + EY + '"/><text x="16" y="25" text-anchor="middle" font-size="12" font-weight="900" fill="' + EL + '" stroke="none" font-family="Cairo,sans-serif">1</text>',
  m2: '<path d="M10 3l6 10 6-10"/><circle cx="16" cy="20" r="9" fill="#cfd8dc"/><text x="16" y="25" text-anchor="middle" font-size="12" font-weight="900" fill="' + EL + '" stroke="none" font-family="Cairo,sans-serif">2</text>',
  m3: '<path d="M10 3l6 10 6-10"/><circle cx="16" cy="20" r="9" fill="#e0955a"/><text x="16" y="25" text-anchor="middle" font-size="12" font-weight="900" fill="' + EL + '" stroke="none" font-family="Cairo,sans-serif">3</text>',
  hour: '<path d="M7 3h18M7 29h18M9 3c0 8 7 9 7 13s-7 5-7 13M23 3c0 8-7 9-7 13s7 5 7 13" /><path d="M11 26c1-3 4-4 5-4s4 1 5 4z" fill="' + EY + '"/>',
  stop: '<circle cx="16" cy="18" r="11" fill="#fff"/><path d="M16 18V11M12 3h8M16 3v4"/>',
  alarm: '<circle cx="16" cy="17" r="10" fill="#fff"/><path d="M16 17v-6M16 17l4 3M4 8l5-4M28 8l-5-4"/>',
  left: '<path d="M26 16H6M14 8l-8 8 8 8"/>', next: '<path d="M7 6l12 10L7 26z" fill="' + EL + '"/><path d="M24 6v20"/>', up: '<path d="M16 28V6M7 14l9-9 9 9" stroke-width="3"/>', minus: '<path d="M7 16h18" stroke-width="3.500"/>',
  full: '<path d="M4 12V4h8M20 4h8v8M28 20v8h-8M12 28H4v-8" stroke-width="2.500"/>',
  ok: '<circle cx="16" cy="16" r="12.500" fill="' + EG + '"/><path d="M9.500 16.500l4.500 4.500 8.500-9" stroke="#fff" stroke-width="3"/>',
  tick: '<path d="M6 17l7 7 13-15" stroke="' + EG + '" stroke-width="4"/>',
  x: '<path d="M8 8l16 16M24 8L8 24" stroke="' + ER + '" stroke-width="4"/>',
  xr: '<circle cx="16" cy="16" r="12.500" fill="' + ER + '"/><path d="M10.500 10.500l11 11M21.500 10.500l-11 11" stroke="#fff" stroke-width="3"/>',
  q: '<circle cx="16" cy="16" r="12.500" fill="' + EV + '"/><path d="M11.500 12.500a4.500 4.500 0 1 1 6.500 4c-1.500 1-2 1.500-2 3" stroke="#fff" stroke-width="3"/><circle cx="16" cy="25" r="1.800" fill="#fff" stroke="none"/>',
  warn: '<path d="M16 4L29 27H3z" fill="' + EY + '"/><path d="M16 12v7" stroke-width="3"/><circle cx="16" cy="23.500" r="1.500" fill="' + EL + '" stroke="none"/>',
  swords: '<path d="M5 5l14 14M27 5L13 19" stroke-width="3"/><path d="M4 22l6 6M28 22l-6 6M3 29l4-4M29 29l-4-4" stroke="' + EO + '" stroke-width="3"/>',
  ball: '<circle cx="16" cy="16" r="12.500" fill="#fff"/><path d="M16 10l5 4-2 6h-6l-2-6z" fill="' + EL + '"/><path d="M16 10V4M21 14l6-2M19 20l4 6M13 20l-4 6M11 14L5 12" stroke-width="1.600"/>',
  pot: '<path d="M4 14h24v3a12 12 0 0 1-24 0z" fill="' + EO + '"/><path d="M11 4c-2 3 2 4 0 7M17 4c-2 3 2 4 0 7M23 4c-2 3 2 4 0 7" stroke-width="1.800"/>',
  clap: '<path d="M3 12h26v16H3z" fill="' + EL + '"/><path d="M3 12l3-8 6 2 3-4 6 2 3-4 6 2-3 8z" fill="#fff"/><path d="M9 12l3-6M17 12l3-6M25 12l3-6" stroke-width="1.800"/>',
  globe: '<circle cx="16" cy="16" r="12.500" fill="' + ET + '"/><path d="M7 11c4-2 6 2 9 1s3-5 7-3M9 22c3-3 5 0 8-1s5 1 6 3" fill="' + EG + '"/>',
  dice: '<rect x="4" y="4" width="24" height="24" rx="5" fill="#fff"/><circle cx="11" cy="11" r="2" fill="' + EL + '"/><circle cx="21" cy="11" r="2" fill="' + EL + '"/><circle cx="16" cy="16" r="2" fill="' + EL + '"/><circle cx="11" cy="21" r="2" fill="' + EL + '"/><circle cx="21" cy="21" r="2" fill="' + EL + '"/>',
  temple: '<path d="M3 11L16 4l13 7z" fill="' + EY + '"/><path d="M6 14v11M12 14v11M20 14v11M26 14v11M3 28h26" stroke-width="2.600"/>',
  puzzle: '<path d="M5 9h7a3 3 0 1 1 6 0h7v7a3 3 0 1 0 0 6v7H5V22a3 3 0 1 0 0-6z" fill="' + EV + '"/>',
  pop: '<path d="M6 12h20l-3 17H9z" fill="#fff"/><path d="M11 12l1 17M16 12v17M21 12l-1 17" stroke="' + ER + '"/><circle cx="10" cy="9" r="4" fill="#fff6d8"/><circle cx="16" cy="7" r="4.500" fill="#fff6d8"/><circle cx="22" cy="9" r="4" fill="#fff6d8"/>',
  tv: '<rect x="3" y="7" width="26" height="17" rx="3" fill="' + ET + '"/><rect x="6" y="10" width="20" height="11" rx="1" fill="#fff" stroke-width="1.400"/><path d="M11 28h10M12 7l-3-4M20 7l3-4"/>',
  burger: '<path d="M5 14c0-7 6-10 11-10s11 3 11 10z" fill="' + EO + '"/><path d="M4 18h24" stroke="' + EG + '" stroke-width="3.500"/><path d="M5 22h22v1a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="' + EO + '"/><path d="M4 18.500h24" stroke="' + ER + '" stroke-width="1.500"/>',
  map: '<path d="M3 7l8-3 10 3 8-3v21l-8 3-10-3-8 3z" fill="#fff6d8"/><path d="M11 4v21M21 7v21"/><path d="M14 13l4 3" stroke="' + ER + '" stroke-width="2.500"/>',
  note: '<path d="M12 24V6l14-3v18"/><circle cx="9" cy="24" r="4" fill="' + EV + '"/><circle cx="23" cy="21" r="4" fill="' + EV + '"/>',
  robot: '<rect x="5" y="10" width="22" height="17" rx="4" fill="#cfd8dc"/><path d="M16 10V5"/><circle cx="16" cy="4" r="2" fill="' + ER + '"/><circle cx="11" cy="17" r="2.500" fill="' + EY + '"/><circle cx="21" cy="17" r="2.500" fill="' + EY + '"/><path d="M11 23h10"/>',
  dot: '<circle cx="16" cy="16" r="9" fill="' + EV + '"/>'
};
var EMAP = {
  '📷': 'camera',
  '🙂': 'smile', '😂': 'laugh', '😮': 'wow', '😲': 'wow', '😉': 'wink', '😎': 'cool', '🤔': 'think', '🤷': 'think', '🤡': 'clown', '🙈': 'hide', '🥳': 'smile', '🙋': 'hand', '👏': 'hand', '👍': 'thumb', '❤': 'heart', '💀': 'skull', '⭐': 'star', '🌙': 'moon', '☀': 'sun', '🔥': 'fire', '⚡': 'bolt', '🎁': 'gift', '🎉': 'party', '🎫': 'ticket', '🎭': 'mask', '🎮': 'game', '🎯': 'target', '🏁': 'flag', '🏅': 'medal', '🏆': 'trophy', '🏟': 'stadium', '🏠': 'home', '👥': 'people', '👑': 'crown', '💡': 'bulb', '💬': 'chat', '💯': 'hund', '🔟': 'ten', '📖': 'book', '📜': 'scroll', '📩': 'mail', '📱': 'phone', '📲': 'phone', '📵': 'nophone', '🔁': 'repeat', '🔄': 'repeat', '♻': 'repeat', '🔇': 'mute', '🎙': 'mic', '🎤': 'mic', '🔒': 'lock', '🔗': 'link', '👀': 'eyes', '🕵': 'spy', '🗣': 'speak', '🗳': 'ballot', '🚀': 'rocket', '🚪': 'door', '🚫': 'no', '🟢': 'dg', '🔴': 'dr', '⚪': 'dw', '🪙': 'coin', '🥇': 'm1', '🥈': 'm2', '🥉': 'm3', '⏳': 'hour', '⌛': 'hour', '⏱': 'stop', '⏰': 'alarm', '←': 'left', '⏭': 'next', '⬆': 'up', '➖': 'minus', '⛶': 'full', '✅': 'ok', '✔': 'tick', '✖': 'x', '❌': 'xr', '❓': 'q', '⚠': 'warn', '⚔': 'swords', '⚽': 'ball', '🍲': 'pot', '🎬': 'clap', '🌍': 'globe', '🎲': 'dice', '🏛': 'temple', '🧩': 'puzzle', '🍿': 'pop', '📺': 'tv', '🍔': 'burger', '🗺': 'map', '🎵': 'note', '🤖': 'robot', '🧞': 'smile', '🦁': 'smile', '🐯': 'smile', '🦊': 'smile', '🐼': 'smile', '🐸': 'smile', '🦄': 'smile', '👽': 'smile', '👻': 'smile', '🐲': 'smile', '🤠': 'smile'
};
var EMRX = /(?:[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}])(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D[\u{1F000}-\u{1FAFF}\u2640\u2642]\uFE0F?)*/gu;
function emKey(s) { var c = s.replace(/\uFE0F/g, ''); var f = String.fromCodePoint(c.codePointAt(0)); return EMAP[f] ? f : '' }
function emSplit(txt) {
  EMRX.lastIndex = 0; var out = [], last = 0, m, hit = 0;
  while ((m = EMRX.exec(txt))) { var k = emKey(m[0]); if (!k) continue; hit = 1; if (m.index > last) out.push(document.createTextNode(txt.slice(last, m.index))); var s = document.createElement('i'); s.className = 'em'; s.innerHTML = eI(ICON[EMAP[k]]); out.push(s); last = m.index + m[0].length }
  if (!hit) return null; if (last < txt.length) out.push(document.createTextNode(txt.slice(last))); return out
}
function deem(root) {
  if (!root) return; var t = root.nodeType;
  if (t === 3) { var p = root.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|TITLE)$/.test(p.nodeName) || (p.closest && p.closest('svg,.nodeem'))) return; var r = emSplit(root.nodeValue); if (r) { var f = document.createDocumentFragment(); r.forEach(function (n) { f.appendChild(n) }); p.replaceChild(f, root) } return }
  if (t !== 1 || /^(SCRIPT|STYLE|TEXTAREA|SVG|svg)$/.test(root.nodeName)) return;
  var w = document.createTreeWalker(root, 4, null), a = [], n; while ((n = w.nextNode())) { if (n.nodeValue && EMRX.test(n.nodeValue)) a.push(n); EMRX.lastIndex = 0 }
  a.forEach(deem)
}
try { new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'characterData') deem(m.target); else m.addedNodes.forEach(deem) }) }).observe(document.documentElement, { childList: true, subtree: true, characterData: true }); deem(document.body) } catch (e) { }
/* characters: drawn, one style */
var CH = [
  { b: EY, s: '#f1c27d', h: EL, hs: 'short', sh: ET, m: 's' },
  { b: EP, s: '#e0ac69', h: '#5b3a1e', hs: 'short', sh: EV, a: 'shades', m: 's' },
  { b: ET, s: '#f1c27d', h: '#5b3a1e', hs: 'short', sh: EP, a: 'cowboy', m: 'o' },
  { b: EV, s: '#f1c27d', h: EL, hs: 'long', sh: EY, m: 's', ch: 1 },
  { b: EG, s: '#e0ac69', h: EL, hs: 'none', sh: '#fff', a: 'tarb,must', m: 's' },
  { b: EY, s: '#f1c27d', hs: 'none', a: 'hijab', hc: ET, sh: ET, m: 's', ch: 1 },
  { b: ET, s: '#c68642', hs: 'none', a: 'nemes', sh: EY, m: 's' },
  { b: EV, s: '#e0ac69', h: '#8a8a8a', hs: 'short', a: 'crown,beard', sh: EP, m: 's' },
  { b: EY, s: '#f1c27d', h: EL, hs: 'curly', a: 'glasses', sh: '#fff', m: 's' },
  { b: EP, s: '#c68642', h: EL, hs: 'short', a: 'phones', sh: EL, m: 'o' },
  { b: EG, s: '#f1c27d', h: '#8b5a2b', hs: 'short', a: 'party', sh: EP, m: 'o', ch: 1 },
  { b: '#cfd8dc', s: '#e0ac69', h: '#e6e6e6', hs: 'none', a: 'glasses,must', sh: EV, m: 's', mc: '#e6e6e6' },
  { b: EY, s: '#f1c27d', h: '#8b5a2b', hs: 'bun', a: 'glasses', sh: EP, m: 's', ch: 1 },
  { b: EV, s: '#8d5524', h: EL, hs: 'curly', a: 'phones', sh: ET, m: 'o' },
  { b: ET, s: '#e0ac69', h: EL, hs: 'short', a: 'glasses,beard', sh: EL, m: 's' },
  { b: EP, s: '#ffffff', h: EP, hs: 'curly', a: 'nose', sh: EV, m: 'o' },
  { sp: 'alien', b: EV }, { sp: 'robot', b: EY },
  { b: EG, s: '#f1c27d', h: EO, hs: 'long', a: 'crown', sh: EV, m: 's', ch: 1 },
  { sp: 'ninja', b: EP }
];
var CHN = ['كابتن', 'كول', 'كاوبوي', 'مدلعة', 'أبو شنب', 'محجبة شيك', 'فرعون', 'الملك', 'دكتور', 'دي جي', 'عيل', 'جدّو', 'سمر', 'جيمر', 'أستاذ', 'مهرج', 'فضائي', 'روبوت', 'الملكة', 'نينجا'];
var AVP = [0, 0, 0, 0, 0, 0, 40, 60, 40, 80, 40, 60, 80, 100, 60, 120, 150, 150, 200, 300];
var _cs = {};
function chSvg(i) {
  if (_cs[i]) return _cs[i]; var c = CH[i] || CH[0], o = ['<svg viewBox="0 0 64 64" aria-hidden="true" stroke="' + EL + '" stroke-width="2.500" stroke-linejoin="round" stroke-linecap="round"><rect width="64" height="64" fill="' + c.b + '" stroke="none"/>'], a = (c.a || '').split(','), has = function (x) { return a.indexOf(x) >= 0 };
  if (c.sp === 'alien') o.push('<path d="M6 64c1-12 11-16 26-16s25 4 26 16z" fill="#7c5cff"/><path d="M26 12l-5-8M38 12l5-8"/><circle cx="20" cy="4" r="3" fill="' + EY + '"/><circle cx="44" cy="4" r="3" fill="' + EY + '"/><ellipse cx="32" cy="32" rx="18" ry="20" fill="#9be564"/><ellipse cx="23" cy="31" rx="5.500" ry="8" fill="' + EL + '" transform="rotate(15 23 31)"/><ellipse cx="41" cy="31" rx="5.500" ry="8" fill="' + EL + '" transform="rotate(-15 41 31)"/><path d="M27 46q5 3 10 0" fill="none"/>');
  else if (c.sp === 'robot') o.push('<path d="M6 64c1-12 11-14 26-14s25 2 26 14z" fill="#9aa5b1"/><path d="M32 12V5"/><circle cx="32" cy="4" r="3.500" fill="' + ER + '"/><rect x="13" y="12" width="38" height="34" rx="8" fill="#cfd8dc"/><rect x="19" y="23" width="9" height="9" rx="2" fill="' + EY + '"/><rect x="36" y="23" width="9" height="9" rx="2" fill="' + EY + '"/><path d="M22 40h20M27 38v4M32 38v4M37 38v4" stroke-width="2"/>');
  else if (c.sp === 'ninja') o.push('<path d="M6 64c1-14 11-18 26-18s25 4 26 18z" fill="' + EL + '"/><circle cx="32" cy="30" r="19" fill="' + EL + '"/><path d="M16 27h32v10H16z" fill="#f1c27d"/><circle cx="25" cy="32" r="2.300" fill="' + EL + '" stroke="none"/><circle cx="39" cy="32" r="2.300" fill="' + EL + '" stroke="none"/><path d="M13 21h38v6H13z" fill="' + ER + '"/><path d="M51 22l8 5-8 3" fill="' + ER + '"/>');
  else {
    o.push('<path d="M6 64c1-14 11-19 26-19s25 5 26 19z" fill="' + c.sh + '"/>');
    if (c.hs === 'long') o.push('<path d="M13 32c-3-17 5-25 19-25s22 8 19 25l2 24H11z" fill="' + c.h + '"/>');
    if (has('hijab')) o.push('<path d="M10 38c-3-23 5-33 22-33s25 10 22 33c0 8 4 14 6 26H4c2-12 6-18 6-26z" fill="' + c.hc + '"/>');
    if (has('nemes')) o.push('<path d="M12 32C11 14 19 6 32 6s21 8 20 26l3 18H9z" fill="' + EY + '"/><path d="M13 22h8M12 29h8M43 22h8M44 29h8M12 36h8M44 36h8" stroke="' + ET + '"/>');
    o.push('<path d="M26 40h12v9q-6 4-12 0z" fill="' + c.s + '"/>');
    if (!has('hijab')) o.push('<circle cx="17" cy="32" r="3.500" fill="' + c.s + '"/><circle cx="47" cy="32" r="3.500" fill="' + c.s + '"/>');
    o.push('<ellipse cx="32" cy="31" rx="' + (has('hijab') ? 13 : 15) + '" ry="' + (has('hijab') ? 15.500 : 17) + '" fill="' + c.s + '"/>');
    if (has('beard')) o.push('<path d="M17 35c0 14 8 19 15 19s15-5 15-19c-3 6-7 8-15 8s-12-2-15-8z" fill="' + (c.h || EL) + '"/>');
    if (c.hs === 'short' || c.hs === 'bun' || c.hs === 'long') o.push('<path d="M17 29c-2-14 6-20 15-20s17 6 15 20c-3-7-8-10-15-10s-12 3-15 10z" fill="' + c.h + '"/>');
    if (c.hs === 'bun') o.push('<circle cx="32" cy="7" r="6" fill="' + c.h + '"/>');
    if (c.hs === 'curly') o.push('<g fill="' + c.h + '"><circle cx="19" cy="22" r="7"/><circle cx="27" cy="14" r="7.500"/><circle cx="38" cy="14" r="7.500"/><circle cx="46" cy="22" r="7"/><circle cx="32" cy="18" r="6"/></g>');
    o.push('<circle cx="25.500" cy="31" r="2.300" fill="' + EL + '" stroke="none"/><circle cx="38.500" cy="31" r="2.300" fill="' + EL + '" stroke="none"/>');
    if (c.ch) o.push('<circle cx="21" cy="37" r="3" fill="#ff9fb7" stroke="none"/><circle cx="43" cy="37" r="3" fill="#ff9fb7" stroke="none"/>');
    if (has('nose')) o.push('<circle cx="32" cy="36" r="4" fill="' + ER + '"/>');
    o.push(c.m === 'o' ? '<path d="M25 40h14q-1 7-7 7t-7-7z" fill="#fff"/>' : '<path d="M25 40q7 7 14 0" fill="none"/>');
    if (has('must')) o.push('<path d="M23 38c4-3 6 0 9 0s5-3 9 0c-2 4-6 2-9 2s-7 2-9-2z" fill="' + (c.mc || EL) + '"/>');
    if (has('shades')) o.push('<path d="M18 28h28v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4h-4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="' + EL + '"/>');
    if (has('glasses')) o.push('<circle cx="25.500" cy="31" r="6" fill="#ffffff66"/><circle cx="38.500" cy="31" r="6" fill="#ffffff66"/><path d="M31.500 31h1"/>');
    if (has('tarb')) o.push('<path d="M19 19c0-9 5-14 13-14s13 5 13 14z" fill="' + ER + '"/><path d="M32 5c7-3 12 0 13 7" fill="none"/>');
    if (has('nemes')) o.push('<path d="M16 22c2-8 8-11 16-11s14 3 16 11c-5-3-10-4-16-4s-11 1-16 4z" fill="' + ET + '"/>');
    if (has('crown')) o.push('<path d="M19 17l-2-12 9 6 6-9 6 9 9-6-2 12z" fill="' + EY + '"/>');
    if (has('phones')) o.push('<path d="M15 31c-2-19 8-24 17-24s19 5 17 24" fill="none" stroke-width="3.500"/><rect x="10" y="27" width="7" height="13" rx="3" fill="' + EP + '"/><rect x="47" y="27" width="7" height="13" rx="3" fill="' + EP + '"/>');
    if (has('party')) o.push('<path d="M23 15l9-14 9 14z" fill="' + EP + '"/><circle cx="32" cy="2" r="2.500" fill="' + EY + '"/>');
    if (has('cowboy')) o.push('<ellipse cx="32" cy="18" rx="25" ry="5" fill="#8b5a2b"/><path d="M21 18c0-10 3-13 11-13s11 3 11 13z" fill="#a0692f"/>');
  }
  o.push('</svg>'); return _cs[i] = o.join('')
}
function avOf(o) {
  o = o || {}; var k = o.pk && o.ap !== 0 ? o.pk : '', fnd = o.bd && o.bd.indexOf('f') >= 0;
  return '<span class="av' + (fnd ? ' fnd' : '') + '">' + (k ? '<img alt="" src="/api/ph/' + k + '.jpg">' : chSvg((o.av | 0) % 20)) + '</span>'
}
function bdH(bd) {
  if (!bd) return ''; var h = '';
  if (bd.indexOf('v') >= 0) h += '<i class="bdg" title="موثّق"><svg viewBox="0 0 24 24"><path d="M12 1l3 2.500 3.800-.3 1 3.700 3.200 2.100-1.400 3.600 1.400 3.600-3.200 2.100-1 3.700-3.800-.3L12 23l-3-2.500-3.800.3-1-3.700L1 14.900l1.400-3.600L1 7.700l3.200-2.100 1-3.700 3.800.3z" fill="#2f9bff"/><path d="M7 12.500l3.300 3.200L17 9" stroke="#fff" stroke-width="2.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></i>';
  if (bd.indexOf('f') >= 0) h += '<i class="bdg" title="مؤسس اللعبة"><svg viewBox="0 0 24 24"><path d="M12 1l9 3v7c0 6-4 10-9 12C7 21 3 17 3 11V4z" fill="#ffd23f" stroke="#2b2140" stroke-width="1.800" stroke-linejoin="round"/><path d="M6.500 15L5.500 8l4 3L12 6l2.500 5 4-3-1 7z" fill="#ff5d8f" stroke="#2b2140" stroke-width="1.400" stroke-linejoin="round"/></svg></i>';
  return h
}
function PN(p) { var f = p.bd && p.bd.indexOf('f') >= 0; return avOf(p) + ' <span class="' + (f ? 'fnm' : '') + '">' + esc(p.name) + '</span>' + bdH(p.bd) }

/* ===== profile: XP, levels, coins, avatars, stats, achievements (saved on the phone) ===== */
var ACH = [['first', '🎮', 'أول ماتش', 'خلّص أول ماتش', p => p.st.m >= 1], ['w1', '🏅', 'أول فوز', 'اكسب ماتش', p => p.st.w >= 1], ['w10', '🏆', 'عشرة فوز', 'اكسب ١٠ ماتشات', p => p.st.w >= 10], ['m10', '🔟', 'لاعب ثابت', 'العب ١٠ ماتشات', p => p.st.m >= 10], ['str3', '🔥', 'سلسلة ٣', 'اكسب ٣ ورا بعض', p => p.st.bs >= 3], ['sp', '🕵️', 'عميل', 'اكسب كجاسوس أو كاشف جاسوس', p => (p.st.g.spy || [0, 0])[1] >= 1], ['du', '⚔️', 'مبارز', 'اكسب مبارزة', p => (p.st.g.duel || [0, 0])[1] >= 1], ['lv5', '⭐', 'لفل ٥', 'وصّل لفل ٥', p => lvOf(p.xp).l >= 5], ['pt500', '💯', '٥٠٠ نقطة', 'اجمع ٥٠٠ نقطة في المجموع', p => p.st.p >= 500], ['dc1', '📅', 'أول تحدي', 'خلّص تحدي اليوم', p => !!(p.dc && (p.dc.n | 0) >= 1)], ['dc7', '🔥', '٧ أيام', 'سلسلة ٧ أيام في تحدي اليوم', p => !!(p.dc && (p.dc.b | 0) >= 7)]];
function lvOf(x) { var l = 1; while (x >= 30 * (l + 1) * l) l++; var a = 30 * l * (l - 1), b = 30 * (l + 1) * l; return { l: l, a: x - a, n: b - a } }
var PR = null;
function profLoad() { if (PR) return PR; var o = null; try { o = JSON.parse(localStorage.mbProf || 'null') } catch (e) { } o = o || {}; o.xp = o.xp | 0; o.c = o.c | 0; o.av = o.av | 0; o.own = o.own || [0, 1, 2, 3, 4, 5]; o.ac = o.ac || []; o.st = o.st || {}; var s = o.st; s.m = s.m | 0; s.w = s.w | 0; s.bs = s.bs | 0; s.cs = s.cs | 0; s.p = s.p | 0; s.g = s.g || {}; return PR = o }
function profSave() { try { localStorage.mbProf = JSON.stringify(PR) } catch (e) { } }
function profInfo() { var p = profLoad(); return { av: p.av, lv: lvOf(p.xp).l, pid: p.id || '', ap: p.ap ? 1 : 0, pk: p.pk || '' } }
function sendProf() { try { send(Object.assign({ t: 'prof' }, profInfo())) } catch (e) { } }
var PQ = [], PQB = 0;
function pToast(h) { PQ.push(h); if (!PQB) pNext() }
function pNext() { var h = PQ.shift(); if (!h) { PQB = 0; return } PQB = 1; var d = document.createElement('div'); d.className = 'ptoast'; d.innerHTML = h; document.body.appendChild(d); confetti(); setTimeout(function () { d.remove(); pNext() }, 2600) }
function confetti() { var f = document.createElement('div'); f.className = 'confetti'; var c = ['#ffd23f', '#ff5d8f', '#3ec9c0', '#7c5cff', '#4caf50'], h = ''; for (var i = 0; i < 28; i++) h += '<i style="left:' + Math.random() * 100 + '%;background:' + c[i % 5] + ';animation-delay:' + Math.random() * .4 + 's;animation-duration:' + (1.2 + Math.random()) + 's"></i>'; f.innerHTML = h; document.body.appendChild(f); setTimeout(function () { f.remove() }, 2600) }
function addXP(n) { var p = profLoad(), a = lvOf(p.xp).l; p.xp += n; var b = lvOf(p.xp).l; if (b > a) { p.c += 25 * (b - a); pToast('⬆️ لفل ' + b + '!<small>+' + 25 * (b - a) + ' 🪙</small>'); try { SFX.win() } catch (e) { } } }
function checkAch() { var p = profLoad(); ACH.forEach(function (a) { if (p.ac.indexOf(a[0]) < 0 && a[4](p)) { p.ac.push(a[0]); p.c += 20; pToast(a[1] + ' إنجاز: ' + a[2] + '<small>+20 🪙</small>') } }) }
function matchEnd(game, won, pts) { var p = profLoad(), s = p.st; s.m++; var g = s.g[game] = s.g[game] || [0, 0]; g[0]++; if (won) { s.w++; g[1]++; s.cs++; if (s.cs > s.bs) s.bs = s.cs } else s.cs = 0; s.p += pts; p.c += 5 + (won ? 15 : 0); addXP(pts + 20 + (won ? 30 : 0)); checkAch(); profSave(); profSync(1) }
var PPH = '', PSC = {}, PRM = '';
function profState() {
  if (!S || !S.players) return; var p = profLoad(), me = S.players.find(function (x) { return x.id === S.you }); if (!me) return;
  if (PRM !== S.code) { PRM = S.code; PSC = { s: me.score }; PPH = '' }
  if (me.score > PSC.s) { var dl = me.score - PSC.s; addXP(dl); var w = wkN(); if (!p.wk || p.wk.w !== w) p.wk = { w: w, p: 0 }; p.wk.p += dl; profSave(); profSync() } PSC.s = me.score;
  var ph = S.phase, end = ph === 'result' || ph === 'sres' || ph === 'dchamp';
  if (end && PPH && PPH !== ph && !/^(result|sres|dchamp)$/.test(PPH)) {
    var g = 'who', won = false;
    if (ph === 'sres' && S.sp && S.sp.res) { g = 'spy'; var r = S.sp.res, ms = r.spies.indexOf(S.you) >= 0; won = ms ? r.winner === 'spy' : r.winner !== 'spy' }
    else if (ph === 'dchamp') { g = 'duel'; won = !!(S.du && S.du.champ === S.you) }
    else { var sd = (S.seats || []).find(function (x) { return x.id === S.you }); won = !!(sd && sd.rank === 1) }
    matchEnd(g, won, 0); sendProf()
  }
  PPH = ph;
}
var _rd = render; render = function () { profState(); return _rd.apply(this, arguments) };
function profChip() { var e = document.querySelector('.home .panel'); if (!e || document.getElementById('pchip')) return; var p = profLoad(), L = lvOf(p.xp), d = document.createElement('div'); d.id = 'pchip'; d.className = 'pchip'; d.onclick = profOpen; d.innerHTML = '<span class="pav">' + avOf(p) + '</span><div class="pin"><b>' + esc(myname || '') + bdH(p.bd) + ' لفل ' + L.l + '</b><div class="xb"><i style="width:' + Math.min(100, L.a / L.n * 100) + '%"></i></div></div><span class="pco">🪙 ' + p.c + '</span><button class="lbb fbb" onclick="event.stopPropagation();frOpen(\'f\')">👥<b class="fbd" id="fbd" style="display:none"></b></button><button class="lbb" onclick="event.stopPropagation();lbOpen()">🏆</button>'; e.insertBefore(d, e.firstChild) }
var _hm = home; home = function () { _hm.apply(this, arguments); profChip() };
/* ===== تحدي اليوم: ٥ أسئلة كل يوم + سلسلة أيام + جوايز عملات ===== */
var DCD = null, DCI = 0, DCA = [], DCR = null;
function dcKey() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) } catch (e) { return new Date().toISOString().slice(0, 10) } }
function dcSt() { var d = profLoad().dc; return d && typeof d === 'object' ? d : { s: 0, b: 0, d: '', n: 0 } }
function dcDone() { return dcSt().d === dcKey() }
function dcLeftM() {
  try {
    var o = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value });
    var m = ((+o.hour || 0) % 24) * 60 + (+o.minute || 0); return Math.max(1, 1440 - m)
  } catch (e) { return 0 }
}
function dcLeftTxt() { var m = dcLeftM(); return m ? (Math.floor(m / 60) + ' ساعة و' + (m % 60) + ' دقيقة') : 'شوية' }
function dcCard() {
  var e = document.querySelector('.home .panel'); if (!e) return;
  var old = document.getElementById('dcc'); if (old) old.remove();
  var st = dcSt(), done = dcDone(), d = document.createElement('div');
  d.id = 'dcc'; d.className = 'dcc' + (done ? ' done' : ''); d.onclick = dcOpen;
  var sub = done ? ('خلصته النهاردة ✔ • تحدي جديد بعد ' + dcLeftTxt()) : ((st.s | 0) > 0 ? ('سلسلة ' + (st.s | 0) + ' أيام 🔥 • جايزة النهاردة أكبر') : '٥ أسئلة سريعة • جايزة كل يوم أكبر');
  d.innerHTML = '<div class="dcfl">' + (done ? '✅' : '🔥') + '</div><div class="dctx"><b>تحدي اليوم</b><small>' + esc(sub) + '</small></div><div class="dcgo">' + (done ? 'شوف' : 'العب') + '</div>';
  var c = document.getElementById('pchip');
  if (c && c.parentNode === e) e.insertBefore(d, c.nextSibling); else e.insertBefore(d, e.firstChild)
}
var _hm2 = home; home = function () { _hm2.apply(this, arguments); dcCard() };
setInterval(function () { var c = document.getElementById('dcc'); if (c && dcDone() && !document.getElementById('dcm')) { var s = c.querySelector('small'); if (s) s.textContent = 'خلصته النهاردة ✔ • تحدي جديد بعد ' + dcLeftTxt() } }, 60000);
function dcClose() { var m = document.getElementById('dcm'); if (m) m.remove(); if (!S) home() }
function dcOpen() {
  if (document.getElementById('dcm')) return;
  ensureId(myname);
  var d = document.createElement('div'); d.id = 'dcm'; d.className = 'modal'; d.onclick = function (e) { if (e.target === d) dcClose() };
  d.innerHTML = '<div class="dcb" id="dcb"><div class="dcld">بنجهز تحدي النهاردة… 🔥</div></div>';
  document.body.appendChild(d);
  var tries = 0;
  var go = function () {
    var p = profLoad();
    if (!p.id) { if (++tries < 25) return setTimeout(go, 300); return dcErr('محتاج حساب عشان نحفظ تقدمك — اتأكد إن النت شغال وجرّب تاني.') }
    apiP('/api/dc', { id: p.id }).then(function (j) {
      if (!j || !j.qs || !j.qs.length) throw new Error('no');
      DCD = j; DCI = 0; DCA = []; DCR = null; dcRender()
    }).catch(function () { dcErr('محتاج نت عشان نحمّل تحدي النهاردة. جرّب تاني بعد شوية.') })
  };
  go()
}
function dcErr(msg) {
  var b = document.getElementById('dcb'); if (!b) return;
  b.innerHTML = '<div class="dcld">' + esc(msg) + '</div><div class="row"><button class="btn y" onclick="dcRetry()">جرّب تاني</button><button class="btn" onclick="dcClose()">قفل</button></div>'
}
function dcRetry() { dcClose(); dcOpen() }
function dcRender() {
  var b = document.getElementById('dcb'); if (!b || !DCD) return;
  if (DCD.st && DCD.st.done) return dcDoneView();
  if (DCI >= DCD.qs.length) return dcSend();
  var q = DCD.qs[DCI], dots = '', i;
  for (i = 0; i < DCD.qs.length; i++) dots += '<i class="' + (i < DCI ? 'on' : (i === DCI ? 'now' : '')) + '"></i>';
  var o = q.o.map(function (t, k) { return '<button class="dco" id="dco' + k + '" onclick="dcPick(' + k + ')">' + esc(t) + '</button>' }).join('');
  b.innerHTML = '<div class="dchd"><span class="dcfl sm">🔥</span><b>تحدي اليوم</b><small>سؤال ' + (DCI + 1) + ' من ' + DCD.qs.length + '</small></div><div class="dcpd">' + dots + '</div><div class="dcq">' + esc(q.q) + '</div>' + o
}
function dcPick(k) {
  if (!DCD || DCA[DCI] !== undefined) return;
  DCA[DCI] = k;
  var el = document.getElementById('dco' + k); if (el) el.className = 'dco sel';
  var all = document.querySelectorAll('.dco'); for (var i = 0; i < all.length; i++) all[i].disabled = true;
  try { SFX.turn() } catch (e) { }
  setTimeout(function () { DCI++; dcRender() }, 240)
}
function dcSend() {
  var b = document.getElementById('dcb'); if (b) b.innerHTML = '<div class="dcld">بنحسب نتيجتك… 🧮</div>';
  var p = profLoad();
  apiP('/api/dc', { id: p.id || '', sub: 1, d: DCD.d, picks: DCA }).then(function (R) {
    if (!R || R.e) throw new Error('bad');
    DCR = R;
    if (R.already) return dcDoneView();
    var st = dcSt();
    p.dc = { s: R.streak | 0, b: Math.max(R.best | 0, R.streak | 0), d: DCD.d, n: (st.n | 0) + 1 };
    p.c = (p.c | 0) + (R.coins | 0);
    addXP(R.xp | 0); checkAch(); profSave(); profSync(1); sendProf();
    dcWin(R)
  }).catch(function () {
    var b2 = document.getElementById('dcb');
    if (b2) b2.innerHTML = '<div class="dcld">النتيجة مترحفظتش، النت فصل؟ إجاباتك محفوظة، جرّب تاني.</div><div class="row"><button class="btn y" onclick="dcSend()">جرّب تاني</button><button class="btn" onclick="dcClose()">قفل</button></div>'
  })
}
function dcCount(id, to, ms) {
  var e = document.getElementById(id); if (!e) return;
  var t0 = Date.now();
  var f = function () { var k = Math.min(1, (Date.now() - t0) / ms); e.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f) };
  f()
}
function dcWin(R) {
  var lit = Math.max(1, Math.min(7, R.streak | 0)), dots = '', rain = '', cols = ['🪙', '✨', '🪙', '⭐', '🪙', '💫'], i;
  for (i = 0; i < 7; i++) dots += '<i class="' + (i < lit ? 'on' : '') + '"></i>';
  for (i = 0; i < 18; i++) rain += '<span class="dcf" style="left:' + (3 + Math.random() * 92).toFixed(1) + '%;animation-delay:' + (Math.random() * 1.5).toFixed(2) + 's;animation-duration:' + (1.7 + Math.random() * 1.6).toFixed(2) + 's">' + cols[i % cols.length] + '</span>';
  var d = document.createElement('div'); d.id = 'dcwin'; d.className = 'dcwin';
  d.innerHTML = '<div class="dcrain">' + rain + '</div><div class="dcwi"><div class="dcglow"></div>' +
    '<div class="dcflame big">🔥</div>' +
    '<h2>تحدي اليوم خلص!</h2>' +
    '<div class="dcsc">جاوبت صح ' + (R.correct | 0) + ' من ' + (R.n | 0) + '</div>' +
    '<div class="dcstk"><b id="dcsn">0</b><small>يوم ورا بعض</small></div>' +
    '<div class="dcdot">' + dots + '</div>' +
    '<div class="dcrw"><span dir="ltr">+<span id="dccn">0</span></span> 🪙<small dir="ltr">+ ' + (R.xp | 0) + ' XP</small></div>' +
    '<button class="btn y big2" onclick="dcWinClose()">تمام 🎉</button></div>';
  document.body.appendChild(d);
  try { SFX.win() } catch (e) { }
  confetti(); setTimeout(confetti, 450);
  dcCount('dcsn', R.streak | 0, 850); dcCount('dccn', R.coins | 0, 1100)
}
function dcWinClose() { var w = document.getElementById('dcwin'); if (w) w.remove(); dcReview(); dcCard() }
function dcReview() {
  var b = document.getElementById('dcb'); if (!b || !DCD || !DCR) return;
  var ans = DCR.ans || [], rows = '';
  DCD.qs.forEach(function (q, i) {
    var my = DCA[i], k = ans[i], ok = my === k;
    rows += '<div class="dcrv ' + (ok ? 'ok' : 'no') + '"><b>' + esc(q.q) + '</b><small>' + (ok ? '✔ إجابتك: ' : '✖ إجابتك: ') + esc(q.o[my] || '—') + '</small>' + (ok ? '' : '<small class="cr">الصح: ' + esc(q.o[k] || '') + '</small>') + '</div>'
  });
  b.innerHTML = '<div class="dchd"><span class="dcfl sm">🔥</span><b>نتيجة تحدي النهاردة</b></div>' + rows +
    '<div class="dcnt">سلسلتك: ' + (dcSt().s | 0) + ' يوم • تحدي جديد بعد ' + dcLeftTxt() + '</div>' +
    '<div class="row"><button class="btn y" onclick="dcClose()">تمام</button></div>'
}
function dcDoneView() {
  var b = document.getElementById('dcb'); if (!b) return;
  var st = dcSt(), s = (DCD && DCD.st ? DCD.st.s : st.s) | 0, n = 0;
  b.innerHTML = '<div class="dcrs"><div class="dcfl" style="font-size:44px;animation:dfl 1.8s ease-in-out infinite">🔥</div><b>خلصت تحدي النهاردة</b>' +
    '<div class="bign">' + s + '</div><small>يوم ورا بعض</small>' +
    '<div class="dcnt" style="margin-top:10px">تحدي جديد بعد ' + dcLeftTxt() + ' — كمّل السلسلة عشان الجايزة تكبر</div></div>' +
    '<div class="row"><button class="btn" onclick="dcClose()">تمام</button></div>'
}
function profClose() { var m = document.getElementById('profm'); if (m) m.remove(); if (!S) home() }
function profOpen() {
  if (document.getElementById('profm')) return; ensureId(myname); var p = profLoad(), L = lvOf(p.xp), s = p.st, d = document.createElement('div'); d.id = 'profm'; d.className = 'modal'; d.onclick = function (e) { if (e.target === d) profClose() };
  var gl = { who: 'اعرف مين معايا', spy: 'الجاسوس', duel: 'المبارزة' };
  var av = CH.map(function (a, i) { var o = p.own.indexOf(i) >= 0; return '<button class="avb' + (p.av === i && !p.ap ? ' on' : '') + (o ? '' : ' lk') + '" title="' + CHN[i] + '" onclick="avPick(' + i + ')"><span class="av">' + chSvg(i) + '</span>' + (o ? '' : '<small>🪙' + AVP[i] + '</small>') + '</button>' }).join('');
  var ac = ACH.map(function (a) { var o = p.ac.indexOf(a[0]) >= 0; return '<div class="acb' + (o ? ' on' : '') + '" title="' + a[3] + '"><span>' + (o ? a[1] : '🔒') + '</span><small>' + a[2] + '</small></div>' }).join('');
  var gs = Object.keys(gl).map(function (k) { var g = s.g[k] || [0, 0]; return '<div class="stb"><b>' + g[1] + '/' + g[0] + '</b><small>' + gl[k] + '</small></div>' }).join('');
  d.innerHTML = '<div class="box prof"><div class="ph"><span class="pav big">' + avOf(p) + '</span><div class="pin"><h2>' + esc(myname || 'لاعب') + bdH(p.bd) + '</h2>' + (p.bd && p.bd.indexOf('f') >= 0 ? '<span class="fpill">مؤسس اللعبة</span> ' : '') + '<b>لفل ' + L.l + '</b><div class="xb"><i style="width:' + Math.min(100, L.a / L.n * 100) + '%"></i></div><small dir="ltr">' + L.a + ' / ' + L.n + ' XP</small></div><span class="pco">🪙 ' + p.c + '</span></div>'
    + '<div class="sts"><div class="stb"><b>' + s.m + '</b><small>ماتشات</small></div><div class="stb"><b>' + s.w + '</b><small>فوز</small></div><div class="stb"><b>' + s.bs + '</b><small>أطول سلسلة</small></div><div class="stb"><b>' + s.p + '</b><small>نقط</small></div></div><div class="dcpl">🔥 تحدي اليوم: سلسلة ' + (dcSt().s | 0) + ' أيام • أحسن سلسلة ' + (dcSt().b | 0) + '</div><h3>فوز/لعب لكل لعبة</h3><div class="sts">' + gs + '</div><h3>صورتك</h3><div class="row"><button class="btn y" onclick="photoPick()">📷 ارفع صورتك</button>' + (p.pk ? '<button class="btn" onclick="photoToggle()">' + (p.ap ? 'استخدم شخصية' : 'استخدم صورتي') + '</button>' : '') + '</div><h3>الشخصيات</h3><div class="avs">' + av + '</div><h3>الإنجازات</h3><div class="acs">' + ac + '</div><h3>حسابك</h3><div class="idb">' + (p.id ? 'الـID بتاعك: <b dir="ltr" class="idn">' + p.id + '</b> <button class="btn" onclick="copyId()">نسخ</button><br><small>احتفظ بيه، بيرجّعلك تقدمك لو غيرت تليفونك</small>' : 'بيتعمل لك ID...') + '<div class="row"><input id="rid" class="inp" inputmode="numeric" maxlength="6" placeholder="عندك ID قديم؟ اكتبه"><button class="btn t" onclick="recoverId()">استرجاع</button></div></div><div class="cont">📮 للتواصل: <a href="mailto:lamhgame23@gmail.com" dir="ltr">lamhgame23@gmail.com</a></div><div class="row"><button class="btn" onclick="profClose()">تمام</button></div></div>';
  document.body.appendChild(d);
}
function avPick(i) { var p = profLoad(); if (p.own.indexOf(i) < 0) { if (p.c < AVP[i]) return toast('محتاج ' + AVP[i] + ' 🪙 (بتاخدها من الماتشات)'); p.c -= AVP[i]; p.own.push(i); toast('اشتريت شخصية ' + CHN[i]) } p.av = i; p.ap = 0; profSave(); profSync(1); var m = document.getElementById('profm'); if (m) m.remove(); profOpen(); sendProf() }


function photoToggle() { var p = profLoad(); p.ap = p.ap ? 0 : 1; profSave(); profSync(1); sendProf(); profRefresh() }
/* ===== account ID + server sync + leaderboard ===== */
function wkN() { return Math.floor((Date.now() / 864e5 + 3) / 7) }
function apiP(path, body) { return fetch(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { j._s = r.status; return j }) }) }
function profClean() { var p = profLoad(), o = {}; Object.keys(p).forEach(function (k) { if (k !== 'id' && k !== 'bd') o[k] = p[k] }); return o }
var PCR = 0, PST = 0, PSY = 0;
function ensureId(name) {
  var p = profLoad(); if (p.id || PCR) return; PCR = 1;
  apiP('/api/p/new', { name: name || myname || 'لاعب', prof: profClean() }).then(function (j) { PCR = 0; if (j.id) { p.id = j.id; profSave(); profRefresh() } }).catch(function () { PCR = 0 })
}
function profSync(now) {
  var p = profLoad(); if (!p.id) return; var d = Date.now();
  if (!now && d - PSY < 20000) { clearTimeout(PST); PST = setTimeout(function () { profSync(1) }, 20000 - (d - PSY)); return }
  PSY = d; apiP('/api/p/save', { id: p.id, name: myname || 'لاعب', lv: lvOf(p.xp).l, prof: profClean() }).catch(function () { })
}
function profPull() {
  var p = profLoad(); if (!p.id) return;
  apiP('/api/p/get', { id: p.id }).then(function (j) { if (j.prof) { if (j.prof.bd !== p.bd) { p.bd = j.prof.bd || ''; profSave(); profRefresh() } if ((j.prof.xp | 0) > p.xp) { var id = p.id; PR = j.prof; PR.id = id; profNorm(); profSave(); sendProf(); profRefresh() } else profSync(1) } }).catch(function () { })
}
function profNorm() { var o = PR; o.xp = o.xp | 0; o.c = o.c | 0; o.av = o.av | 0; o.own = o.own || [0, 1, 2, 3, 4, 5]; o.ac = o.ac || []; o.st = o.st || {}; var s = o.st; s.m = s.m | 0; s.w = s.w | 0; s.bs = s.bs | 0; s.cs = s.cs | 0; s.p = s.p | 0; s.g = s.g || {} }
function profRefresh() { var c = document.getElementById('pchip'); if (c) { c.remove(); profChip() } if (document.getElementById('profm')) { document.getElementById('profm').remove(); profOpen() } }
function recoverId() {
  var v = (document.getElementById('rid').value || '').trim(); if (!/^\d{6}$/.test(v)) return toast('اكتب الـID (٦ أرقام)');
  apiP('/api/p/get', { id: v }).then(function (j) { if (!j.prof) return toast('الـID ده مش موجود'); var keep = profLoad().id; PR = j.prof; PR.id = v; profNorm(); profSave(); sendProf(); toast('رجّعنا حسابك ✔'); profRefresh() }).catch(function () { toast('مفيش اتصال، جرّب تاني') })
}
function copyId() { var p = profLoad(); try { navigator.clipboard.writeText(p.id) } catch (e) { } toast('اتنسخ الـID: ' + p.id) }
function lbOpen(k) {
  var m = document.getElementById('lbm'); if (!m) { m = document.createElement('div'); m.id = 'lbm'; m.className = 'modal'; m.onclick = function (e) { if (e.target === m) m.remove() }; document.body.appendChild(m) }
  k = k || 'w'; m.innerHTML = '<div class="box prof"><h2>🏆 المتصدرين</h2><div class="row"><button class="btn ' + (k === 'w' ? 'y' : '') + '" onclick="lbOpen(\'w\')">الأسبوع ده</button><button class="btn ' + (k === 'all' ? 'y' : '') + '" onclick="lbOpen(\'all\')">كل الوقت</button></div><div id="lbl" class="lbl">جاري التحميل...</div><div class="row"><button class="btn" onclick="document.getElementById(\'lbm\').remove()">تمام</button></div></div>';
  apiP('/api/lb?k=' + k).then(function (j) { var e = document.getElementById('lbl'); if (!e) return; var me = profLoad(); e.innerHTML = (j.rows || []).length ? j.rows.map(function (r, i) { return '<div class="lbr"><b>' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1) + '</b><span>' + avOf(r) + ' <span class="' + (r.bd && r.bd.indexOf('f') >= 0 ? 'fnm' : '') + '">' + esc(r.n) + '</span>' + bdH(r.bd) + ' <small>لفل ' + r.lv + '</small></span><b>' + r.s + '</b></div>' }).join('') : 'لسه مفيش حد، كون أول واحد!' }).catch(function () { var e = document.getElementById('lbl'); if (e) e.textContent = 'مش قادر أحمّل الترتيب دلوقتي' })
}
var _nm0 = nm; nm = function () { var v = _nm0.apply(this, arguments); ensureId(v); return v };
setTimeout(function () { if (myname) ensureId(myname); profPull() }, 800);

function photoPick() { var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = function () { if (f.files && f.files[0]) photoUp(f.files[0]) }; f.click() }
function photoUp(file) {
  var p = profLoad(); if (!p.id) { ensureId(myname); return toast('استنى ثانية لحد ما حسابك يتجهز وجرّب تاني') }
  var go = function (img, w, h) {
    var c = document.createElement('canvas'); c.width = c.height = 160; var x = c.getContext('2d'), s = Math.min(w, h); x.fillStyle = '#fff'; x.fillRect(0, 0, 160, 160); x.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 160, 160);
    var q = .85, u; do { u = c.toDataURL('image/jpeg', q); q -= .1 } while (u.length > 40000 && q > .25);
    toast('بنرفع صورتك...'); apiP('/api/p/photo', { id: p.id, img: u.split(',')[1] }).then(function (j) { if (j.pk) { p.pk = j.pk; p.ap = 1; profSave(); profSync(1); sendProf(); profRefresh(); toast('اتغيرت صورتك ✔') } else toast('الصورة مترفعتش، جرّب صورة تانية') }).catch(function () { toast('مفيش اتصال، جرّب تاني') })
  };
  var fb = function () { var im = new Image(); im.onload = function () { go(im, im.naturalWidth, im.naturalHeight) }; im.onerror = function () { toast('مش قادر أقرا الصورة دي') }; im.src = URL.createObjectURL(file) };
  if (window.createImageBitmap) createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (b) { go(b, b.width, b.height) }).catch(fb); else fb()
}

home();
let _ses = null; try { _ses = JSON.parse(localStorage.mbSess || 'null') } catch (e) { }
const _inv = ((new URLSearchParams(location.search)).get('r') || '').replace(/\D/g, '').slice(0, 4);
if (_inv.length === 4 && !(_ses && _ses.code === _inv)) { inv = _inv; try { localStorage.removeItem('mbSess') } catch (e) { } if (myname) conn(() => send({ t: 'join', code: _inv, name: myname })); else home() }
else if (_ses) { conn(() => send({ t: 'join', code: _ses.code, token: _ses.token, name: myname })) }

// ---------- scroll-safe rendering: never rebuild the DOM while a finger/momentum scroll is active
var rPh = '', tch = 0, lastSc = 0, rqT = 0, rqSince = 0;
function render() {
  if (!S) return;
  const busy = tch || Date.now() - lastSc < 220;
  if (busy) { if (!rqSince) rqSince = Date.now(); if (Date.now() - rqSince < 4000) { clearTimeout(rqT); rqT = setTimeout(render, 140); return } }
  rqSince = 0; clearTimeout(rqT); renderNow();
}
addEventListener('touchstart', () => { tch = 1 }, { passive: true, capture: true });
['touchend', 'touchcancel'].forEach(ev => addEventListener(ev, () => { tch = 0; lastSc = Date.now() }, { passive: true, capture: true }));
addEventListener('scroll', () => { lastSc = Date.now() }, { passive: true, capture: true });
addEventListener('wheel', () => { lastSc = Date.now() }, { passive: true, capture: true });
// ---------- auto fullscreen + landscape on first gesture, rotate hint where rotation can't be forced
var noAuto = 0;
function isTouch() { return matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window }
function inFS() { return !!(document.fullscreenElement || document.webkitFullscreenElement) }
function autoFS() {
  if (noAuto || inFS() || !isTouch()) return;
  const e = document.documentElement, f = e.requestFullscreen || e.webkitRequestFullscreen;
  if (!f) return;
  try { const r = f.call(e); const lock = () => { try { screen.orientation.lock('landscape').catch(() => { }) } catch (x) { } }; if (r && r.then) r.then(lock).catch(() => { }); else lock() } catch (x) { }
}
['pointerdown', 'click'].forEach(ev => addEventListener(ev, () => autoFS(), { capture: true, once: false }));
document.addEventListener('fullscreenchange', () => { rotChk() });
function rotChk() {
  let el = document.getElementById('rot');
  const portrait = matchMedia('(orientation:portrait)').matches && innerWidth < 760 && isTouch();
  let dis = 0; try { dis = sessionStorage.mbRot } catch (e) { }
  if (portrait && !dis) {
    if (!el) { el = document.createElement('div'); el.id = 'rot'; el.innerHTML = '<div class="rb"><div class="ph">📱</div><h2>لف الموبايل بالعرض</h2><p>اللعبة أحلى وأوسع وهو مقلوب على جنبه. لو الدوران التلقائي مقفول من الإعدادات افتحه.</p><button class="btn y" onclick="rotX()">كمّل بالطول</button></div>'; document.body.appendChild(el) }
  } else if (el) el.remove();
}
function rotX() { try { sessionStorage.mbRot = 1 } catch (e) { } rotChk() }
addEventListener('resize', rotChk); addEventListener('orientationchange', () => setTimeout(rotChk, 200)); setTimeout(rotChk, 300);

// ---------- PWA: service worker + install prompt
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
let dip = null;
const isStd = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function instBar() {
  if (isStd() || document.getElementById('inst')) return; try { if (localStorage.mbInst === '1') return } catch (e) { }
  if (!S && (dip || isIOS)) {
    const d = document.createElement('div'); d.id = 'inst'; d.className = 'inst';
    d.innerHTML = dip ? '<span>📲 ثبّت اللعبة كتطبيق على موبايلك</span><button class="btn y" onclick="instGo()">ثبّت</button><button class="ib" onclick="instX()">✖</button>' : '<span>📲 ثبّتها على الشاشة الرئيسية: دوس <b>مشاركة</b> ⬆️ وبعدين <b>أضف إلى الشاشة الرئيسية</b></span><button class="ib" onclick="instX()">✖</button>';
    document.body.appendChild(d);
  }
}
function instX() { try { localStorage.mbInst = '1' } catch (e) { } const e = document.getElementById('inst'); if (e) e.remove() }
function instGo() { if (!dip) return; dip.prompt(); dip.userChoice.finally(() => { dip = null; instX() }) }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; setTimeout(instBar, 800) });
addEventListener('appinstalled', () => instX());
setInterval(() => { const e = document.getElementById('inst'); if (e && S) e.remove(); else if (!e && !S && (dip || isIOS)) instBar() }, 1500);

/* ===== friends ===== */
function nmH(r) { return '<span class="' + (r.bd && r.bd.indexOf('f') >= 0 ? 'fnm' : '') + '">' + esc(r.n) + '</span>' + bdH(r.bd) }
var FR = { fr: [], rq: [], inv: [] }, FM = { tab: 'f', q: '', res: [], sent: {} }, FQT = 0, FSEEN = {}, FRQN = -1;
function fapi(a, b) { var p = profLoad(); if (!p.id) return Promise.resolve({ e: 'noid' }); return apiP('/api/f/' + a, Object.assign({ id: p.id }, b || {})) }
function fbUpd() { var e = document.getElementById('fbd'); if (e) { e.textContent = FR.rq.length; e.style.display = FR.rq.length ? '' : 'none' } }
function fpoll() {
  if (document.hidden) return; var p = profLoad(); if (!p.id) return;
  fapi('poll', { rm: (S && S.code) || '' }).then(function (j) {
    if (!j || !j.fr) return; FR.fr = j.fr; FR.rq = j.rq;
    if (FRQN >= 0 && j.rq.length > FRQN) toast('طلب صداقة جديد من ' + j.rq[j.rq.length - 1].n);
    FRQN = j.rq.length; fbUpd(); if (document.getElementById('frm') && FM.tab !== 's') frRender();
    (j.inv || []).forEach(function (v) { var k = v.from.h + v.rm; if (FSEEN[k] && Date.now() - FSEEN[k] < 30000) return; FSEEN[k] = Date.now(); invShow(v) })
  }).catch(function () { })
}
function invShow(v) {
  var w = document.getElementById('invw'); if (!w) { w = document.createElement('div'); w.id = 'invw'; document.body.appendChild(w) }
  var d = document.createElement('div'); d.className = 'invc'; d.innerHTML = '<span class="pav">' + avOf(v.from) + '</span><div class="pin"><b>' + nmH(v.from) + '</b><small>دعاك تلعب معاه في غرفة ' + v.rm + '</small></div><button class="btn y" data-a="go">ادخل الغرفة</button><button class="invx" data-a="x" aria-label="إغلاق">✖</button>';
  d.onclick = function (e) { var a = e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'go') joinCode(v.rm); d.remove() };
  w.appendChild(d); try { navigator.vibrate && navigator.vibrate(80) } catch (e) { } setTimeout(function () { d.remove() }, 40000)
}
function joinCode(c) {
  var f = function () { var n = myname || nm(); try { localStorage.removeItem('mbSess') } catch (e) { } var g = function () { send({ t: 'join', code: c, name: n, ...profInfo() }) }; if (ws && ws.readyState === 1) g(); else conn(g) };
  if (S) { if (S.code === c) return toast('إنت في نفس الغرفة'); try { send({ t: 'leave' }) } catch (e) { } try { vstop() } catch (e) { } S = null; home() }
  f(); var m = document.getElementById('frm'); if (m) m.remove()
}
function frClose() { var m = document.getElementById('frm'); if (m) m.remove() }
function frOpen(t) {
  if (!profLoad().id) { ensureId(myname); return toast('استنى ثانية لحد ما حسابك يتجهز وجرّب تاني') }
  FM.tab = t || 'f'; var m = document.getElementById('frm'); if (!m) { m = document.createElement('div'); m.id = 'frm'; m.className = 'modal'; m.onclick = function (e) { if (e.target === m) frClose() }; document.body.appendChild(m) }
  frRender(); fpoll()
}
function frRow(r, acts) { var f = r.bd && r.bd.indexOf('f') >= 0; return '<div class="frr"><span class="pav">' + avOf(r) + '</span><div class="pin"><b>' + nmH(r) + '</b><small>لفل ' + r.lv + (r.st === 'rm' ? ' • <i class="stg">في غرفة</i>' : r.st === 'on' ? ' • <i class="stg">متصل</i>' : r.st === 'off' ? ' • مش متصل' : '') + '</small></div><div class="fac">' + acts + '</div></div>' }
function frRender() {
  var m = document.getElementById('frm'); if (!m) return; var t = FM.tab, inr = !!(S && S.code), h = '';
  h += '<div class="row"><button class="btn ' + (t === 'f' ? 'y' : '') + '" onclick="FM.tab=\'f\';frRender()">أصدقائي (' + FR.fr.length + ')</button><button class="btn ' + (t === 'r' ? 'y' : '') + '" onclick="FM.tab=\'r\';frRender()">الطلبات' + (FR.rq.length ? ' (' + FR.rq.length + ')' : '') + '</button><button class="btn ' + (t === 's' ? 'y' : '') + '" onclick="FM.tab=\'s\';frRender()">دوّر على لاعب</button></div>';
  if (t === 'f') h += '<div class="frl">' + (FR.fr.length ? FR.fr.map(function (r) { var a = ''; if (r.st === 'rm') a += '<button class="btn y sm" onclick="joinCode(\'' + r.rm + '\')">ادخل عليه</button>'; if (inr && r.st !== 'off') a += '<button class="btn t sm" onclick="frInv(\'' + r.h + '\',this)">ادعو للغرفة</button>'; a += '<button class="xsm" title="شيل" onclick="frDel(\'' + r.h + '\')">✖</button>'; return frRow(r, a) }).join('') : '<p class="mut">لسه معندكش أصدقاء. دوّر على صاحبك بالاسم وضيفه.</p>') + '</div>';
  if (t === 'r') h += '<div class="frl">' + (FR.rq.length ? FR.rq.map(function (r) { return frRow(r, '<button class="btn t sm" onclick="frAns(\'' + r.h + '\',1)">قبول</button><button class="btn sm" onclick="frAns(\'' + r.h + '\',0)">رفض</button>') }).join('') : '<p class="mut">مفيش طلبات جديدة.</p>') + '</div>';
  if (t === 's') h += '<input id="frq" class="inp" placeholder="اكتب اسم اللاعب (أو الـID)" value="' + esc(FM.q) + '" oninput="frSearch(this.value)" autocomplete="off"><div class="frl" id="frres">' + frRes() + '</div>';
  m.innerHTML = '<div class="box prof"><h2>👥 الأصدقاء</h2>' + h + '<div class="row"><button class="btn" onclick="frClose()">تمام</button></div></div>';
  if (t === 's') { var q = document.getElementById('frq'); if (q && !FM._nf) { q.focus() } }
}
function frRes() {
  if (FM.q.trim().length < 2) return '<p class="mut">اكتب حرفين على الأقل.</p>'; if (FM.busy) return '<p class="mut">بدوّر...</p>';
  if (!FM.res.length) return '<p class="mut">مفيش نتايج.</p>';
  var fh = {}; FR.fr.forEach(function (x) { fh[x.h] = 1 });
  return FM.res.map(function (r) { var a = fh[r.h] ? '<small class="mut">صديقك</small>' : FM.sent[r.h] ? '<small class="mut">اتبعت الطلب</small>' : '<button class="btn y sm" onclick="frAdd(\'' + r.h + '\')">إضافة صديق</button>'; return frRow(r, a) }).join('')
}
function frSearch(v) {
  FM.q = v; clearTimeout(FQT); var q = v.trim(); if (q.length < 2) { FM.res = []; FM.busy = 0; var e = document.getElementById('frres'); if (e) e.innerHTML = frRes(); return }
  FQT = setTimeout(function () { FM.busy = 1; var e = document.getElementById('frres'); if (e) e.innerHTML = frRes(); fapi('search', { q: q }).then(function (j) { if (FM.q.trim() !== q) return; FM.busy = 0; FM.res = j.rows || []; var e2 = document.getElementById('frres'); if (e2) e2.innerHTML = frRes() }).catch(function () { FM.busy = 0 }) }, 450)
}
function frAdd(h) { fapi('add', { h: h }).then(function (j) { if (j.st === 'friends') { toast('بقيتوا أصحاب'); fpoll() } else if (j.st === 'sent') { FM.sent[h] = 1; toast('اتبعت طلب الصداقة') } else toast('معرفتش أبعت الطلب'); var e = document.getElementById('frres'); if (e) e.innerHTML = frRes() }) }
function frAns(h, ok) { fapi('ans', { h: h, ok: ok ? 1 : 0 }).then(function () { toast(ok ? 'بقيتوا أصحاب' : 'اترفض الطلب'); fpoll() }) }
function frDel(h) { if (!confirm('تشيله من الأصدقاء؟')) return; fapi('del', { h: h }).then(function () { FR.fr = FR.fr.filter(function (x) { return x.h !== h }); frRender() }) }
function frInv(h, b) { fapi('inv', { h: h, rm: S && S.code }).then(function (j) { if (j.st === 'sent') { toast('اتبعتله الدعوة'); if (b) { b.textContent = 'اتبعتت'; b.disabled = true } } else if (j.st === 'off') toast('صاحبك مش متصل دلوقتي'); else toast('معرفتش أبعت الدعوة') }) }
setTimeout(fpoll, 2500); setInterval(fpoll, 10000);
