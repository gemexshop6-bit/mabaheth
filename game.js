'use strict';
const A = document.getElementById('app');
let ws, S, cfg, inv = '', myname = '', rooms = [], chatTab = 'chat', side = true, lastLog = 0, lastTurn = null, lastPhase = '', guessTxt = '';
try { myname = localStorage.mbName || '' } catch (e) { }
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
const send = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
function toast(t) { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', 3200) }
// ---- sounds
let AC; function tone(f, d, ty, v, at) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime + (at || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = ty || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || .15, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d) } catch (e) { } }
const SFX = { turn: () => { tone(660, .12); tone(880, .15, 'sine', .15, .1) }, win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'triangle', .18, i * .1)), bad: () => { tone(200, .25, 'sawtooth', .12); tone(150, .3, 'sawtooth', .12, .15) }, yes: () => tone(880, .12, 'square', .08), no: () => tone(240, .15, 'square', .08), pop: () => tone(1200, .06, 'sine', .1), tick: () => tone(1000, .05, 'square', .06) };
function conn(first) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { if (first) first(); else { let s = null; try { s = JSON.parse(localStorage.mbSess || 'null') } catch (e) { } if (s) send({ t: 'join', code: s.code, token: s.token, name: myname }) } };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'hello') { cfg = m; try { localStorage.mbSess = JSON.stringify({ code: m.code, token: m.token }) } catch (e) { } }
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
  A.innerHTML = `<div class="home"><div class="logo"><div class="big">🎭</div><h1>اعرف مين المعايا؟</h1><p>اعمل غرفة وكمّلوا ماتش تلات ألعاب: اعرف مين معايا والجاسوس والمبارزة</p><div class="promo" aria-hidden="true"><div class="sl s1"><div class="tx"><b>استمتع إنت وأصحابك</b><small>افتح غرفة وادعي شلتك والعبوا مع بعض</small></div><div class="faces"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#2b2140" stroke-width="3"/><circle cx="14" cy="17" r="2.6" fill="#2b2140"/><circle cx="26" cy="17" r="2.6" fill="#2b2140"/><path d="M11 25Q20 34 29 25" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#FF6B9D" stroke="#2b2140" stroke-width="3"/><path d="M10 17l7-2M30 17l-7-2" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/><path d="M10 25Q20 38 30 25z" fill="#fff" stroke="#2b2140" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#2EC4B6" stroke="#2b2140" stroke-width="3"/><circle cx="14" cy="17" r="2.6" fill="#2b2140"/><circle cx="26" cy="17" r="2.6" fill="#2b2140"/><path d="M11 25Q20 34 29 25" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#2b2140" stroke-width="3"/><path d="M7 15h26v6H7z" fill="#2b2140"/><path d="M11 25Q20 34 29 25" fill="none" stroke="#2b2140" stroke-width="3" stroke-linecap="round"/></svg></div></div><div class="sl s2"><div class="tx"><span class="soon">جديد 🔥</span><b>المبارزة: تحدي الأسئلة</b><small>واحد يسأل وواحد يجاوب بصوته، والفايز يكمل لحد البطل</small></div><div class="sw">⚔️</div></div><div class="sl s3"><div class="tx"><b>تلات ألعاب في غرفة واحدة</b><small>اعرف مين معايا • الجاسوس • المبارزة</small></div><div class="tri"><span>🎭</span><span>🕵️</span><span>⚔️</span></div></div></div></div>
  <div class="panel">${iv ? `<div class="inv">📩 اتدعيت لغرفة <b>${esc(iv)}</b>، اكتب اسمك وادخل</div>` : ''}<input id="nm" class="inp" maxlength="20" placeholder="اسمك" value="${esc(myname)}">
  ${iv ? '' : `<div class="row"><button class="btn y" onclick="mk()">🎉 اعمل غرفة</button></div>`}
  <div class="row"><input id="cd" class="inp" inputmode="numeric" maxlength="4" placeholder="كود الغرفة" value="${esc(iv)}"><button class="btn t" onclick="jn()">ادخل غرفة</button></div>
  <div id="rl" class="rl"></div>
  <div class="row"><button class="btn p" onclick="helpOpen()">📖 إزاي تلعب</button><button class="btn" onclick="fsToggle()">⛶ ملء الشاشة</button><button class="btn" onclick="theme()">${document.documentElement.dataset.theme==='dark'?'☀️ فاتح':'🌙 غامق'}</button></div></div><div class="dev">تطوير: elnaholy</div></div>`;
  fetch('/rooms').then(r => r.json()).then(l => { const e = $('rl'); if (!e || S) return; e.innerHTML = l.length ? '<b>غرف مفتوحة:</b> ' + l.map(r => `<button class="chip" onclick="$('cd').value='${r.code}';jn()">${r.code} • ${esc(r.host)} (${r.n})</button>`).join('') : '' }).catch(() => { });
}
function mk() { const n = nm(); const f = () => send({ t: 'create', name: n }); if (ws && ws.readyState === 1) f(); else conn(f) }
function jn() { const n = nm(), c = ($('cd').value || '').trim(); if (c.length < 4) return toast('اكتب كود الغرفة (٤ أرقام)'); try { localStorage.removeItem('mbSess') } catch (e) { } const f = () => send({ t: 'join', code: c, name: n }); if (ws && ws.readyState === 1) f(); else conn(f) }
function shareLink() {
  const url = location.origin + '/?r=' + S.code, text = 'تعالى العب معايا في غرفة ' + S.code + ' 🎭';
  if (navigator.share) { navigator.share({ title: 'اعرف مين المعايا؟', text, url }).catch(() => { }); return }
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
  <div class="who">${p.bot ? '🤖' : '🙂'} ${esc(p.name)}${sd.id === S.you ? ' (إنت)' : ''} <b>${p.score}</b>${sd.gain && S.phase === 'result' ? ` <i>+${sd.gain}</i>` : ''}</div></div>`;
}
function board() { return `<div class="sb">${[...S.players].sort((a, b) => b.score - a.score).map((p, i) => `<span class="chip ${p.id === S.you ? 'me' : ''}">${i === 0 && p.score > 0 ? '👑' : ''}${p.bot ? '🤖' : ''}${esc(p.name)} <b>${p.score}</b></span>`).join('')}</div>` }
function plist() {
  const host = S.host === S.you, ph = S.phase === 'lobby' || S.phase === 'sres' || S.phase === 'dchamp';
  return `<div class="pls">${S.players.map(p => `<div class="pr ${p.on ? '' : 'off'}"><span class="pn">${S.host === p.id ? '👑' : ''}${p.bot ? '🤖' : '🙂'} ${esc(p.name)}${p.id === S.you ? ' <small>(إنت)</small>' : ''}</span><b class="sc" title="النقط">${p.score}</b><span class="st" title="${p.on ? 'موجود' : 'غايب'}">${p.on ? '🟢' : '⚪'}</span><span class="mc ${p.mic ? '' : 'moff'}" title="${p.mic === 1 ? 'المايك شغال' : p.mic === 2 ? 'المايك مكتوم' : 'المايك مقفول'}">${p.mic === 2 ? '🔇' : '🎙️'}</span>${ph && !p.bot ? `<span class="rd">${p.ready ? '✅' : '⏳'}</span>` : ''}${host && p.id !== S.you ? `<button class="ib" title="خليه هوست" ${p.bot || !p.on ? 'disabled' : ''} onclick="send({t:'host',id:'${p.id}'})">👑</button><button class="ib rd" title="اطرده" onclick="kick('${p.id}')">🚫</button>` : ''}</div>`).join('')}</div>`;
}
function rhist() {
  if (!S.rh.length) return '<p class="mut">لسه مفيش جولات اتلعبت</p>';
  return `<div class="rhs">${[...S.rh].reverse().map(r => { const c = cfg.cats.find(x => x.id === r.cat) || {}; return `<div class="rh"><b>#${r.n}</b> ${r.g === 'spy' ? '🕵️' : r.g === 'duel' ? '⚔️' : '🎭'} ${r.g === 'duel' ? '' : c.emoji || ''} <span>${r.w.length ? '🏆 ' + r.w.map(esc).join('، ') : esc(r.note || '—')}</span>${r.w.length && r.note ? ` <small>${esc(r.note)}</small>` : ''}</div>` }).join('')}</div>`;
}
const GAMES = [['who', '🎭', 'اعرف مين معايا'], ['spy', '🕵️', 'الجاسوس'], ['duel', '⚔️', 'المبارزة']];
function lobby() {
  const host = S.host === S.you, me = pl(S.you), spy = S.game === 'spy', duel = S.game === 'duel', n = S.players.length, hum = S.players.filter(p => !p.bot && p.on), rd = hum.filter(p => p.ready).length;
  const opt = (arr, cur, key, fmtf) => `<div class="row wrap">${arr.map(v => `<button class="chip ${cur === v ? 'sel' : ''}" ${host ? `onclick="send({t:'set',${key}:${v}})"` : 'disabled'}>${fmtf(v)}</button>`).join('')}</div>`;
  return `<div class="lob"><div class="card"><h3>👥 اللاعبين (${n}/8) • كود الغرفة <span class="code">${S.code}</span></h3>${plist()}
    <div class="row wrap"><button class="chip" onclick="shareLink()">🔗 لينك الدعوة</button>${host ? `<button class="chip" onclick="send({t:'addbot'})">🤖 ضيف بوت</button><button class="chip" onclick="send({t:'rmbot'})">➖ شيل بوت</button>` : ''}</div>
    <h3>🏆 نتايج الجولات</h3>${rhist()}</div>
    <div class="card"><h3>🎮 اللعبة ${host ? '' : '(الهوست بيختار)'}</h3><div class="cats">${GAMES.map(g => `<button class="cat ${S.game === g[0] ? 'sel' : ''}" ${host ? `onclick="send({t:'set',game:'${g[0]}'})"` : 'disabled'}><span>${g[1]}</span>${g[2]}</button>`).join('')}</div>
    ${duel ? `<h3>🎯 مجال الأسئلة</h3><div class="cats">${cfg.dcats.map(c => `<button class="cat ${c.id === S.dcat ? 'sel' : ''}" ${host ? `onclick="send({t:'set',dcat:'${c.id}'})"` : 'disabled'}><span>${c.emoji}</span>${c.name}<small>${c.n}</small></button>`).join('')}</div><h3>⏱ وقت كل نص (النص الأول والتاني)</h3>${opt([60, 120, 180, 300], S.dT, 'dT', v => v / 60 + ' دقيقة')}` : `<h3>🎯 المجال</h3><div class="cats">${cfg.cats.map(c => `<button class="cat ${c.id === S.cat ? 'sel' : ''}" ${host ? `onclick="send({t:'set',cat:'${c.id}'})"` : 'disabled'}><span>${c.emoji}</span>${c.name}<small>${c.n}</small></button>`).join('')}</div>`}
    ${duel ? '' : spy ? `<h3>🕵️ عدد الجواسيس</h3>${opt([1, 2], S.spies, 'spies', v => v === 1 ? 'جاسوس واحد' : 'اتنين (من ٦ لاعبين)')}<h3>🗣 وقت كل كلمة</h3>${opt([20, 30, 45, 60], S.clueT, 'clueT', v => v + ' ث')}<h3>🗳 وقت النقاش والتصويت</h3>${opt([45, 60, 90, 120], S.voteT, 'voteT', v => v + ' ث')}` : `<h3>⏱ وقت الجولة</h3>${opt([60, 180, 300, 600, 900], S.dur, 'dur', v => v / 60 + ' دقيقة')}`}
    <button class="btn ${me.ready ? 't' : 'y'} big2" onclick="send({t:'ready'})">${me.ready ? '✅ إنت جاهز (دوس تلغي)' : '🙋 جاهز'}</button>
    <p class="mut">اللعبة بتبدأ لما كل اللاعبين يدوسوا "جاهز" (${rd}/${hum.length}). ${spy ? 'الجاسوس من ٣ لـ٨ لاعبين، ولو أقل بيتضاف بوتات.' : ''}</p>
    ${host ? `<button class="btn big2" onclick="send({t:'start'})">🚀 ابدأ دلوقتي</button>` : ''}</div></div>`;
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
    <div class="vts">${sp.order.map(id => `<div class="vt"><div class="vn">${pl(id).bot ? '🤖' : '🙂'} ${nameOf(id)} ${voted.includes(id) ? '<i>✔ صوّت</i>' : ''}</div><div class="vc">"${clueOf(id) || '—'}"</div>${id !== S.you && sp.order.includes(S.you) ? `<button class="chip ${sp.mine === id ? 'sel' : ''}" onclick="send({t:'svote',id:'${id}'})">${sp.mine === id ? '✅ ' : ''}هو الجاسوس</button>` : '<span class="mut">&nbsp;</span>'}</div>`).join('')}</div>
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
  A.innerHTML = `<div class="hd"><b class="ttl">${S.game === 'spy' ? '🕵️' : S.game === 'duel' ? '⚔️' : '🎭'} ${S.game === 'duel' ? '' : esc((cfg.cats.find(c => c.id === S.cat) || {}).emoji || '')} ${S.code}</b><span class="chip me myp" title="نقطك في الغرفة">⭐ ${pl(S.you).score}</span>${timer}<span class="sp"></span><span id="vslot"></span><button class="ib" title="لينك دعوة" onclick="shareLink()">🔗</button><button class="ib" onclick="side=!side;render()">💬</button><button class="ib" onclick="helpOpen()">📖</button><button class="ib" onclick="theme()">${document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'}</button><button class="ib" onclick="fsToggle()">⛶</button><button class="ib rd" onclick="leaveRoom()">🚪</button></div>
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
  d.innerHTML = `<div class="box"><div class="row"><h2 style="flex:1;margin:0">📖 إزاي تلعب</h2><button class="ib rd" onclick="helpClose()">✖</button></div>${H.map(h => `<div class="rule"><b>${h[0]}</b><p>${h[1]}</p></div>`).join('')}<div class="dev">تطوير: elnaholy</div></div>`;
  document.body.appendChild(d);
}
function helpClose() { const d = $('helpm'); if (d) d.remove() }
// ================= الشات الصوتي =================
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }] };
let vStream = null, vOn = false, vMuted = false; const vPc = {};
function vui() {
  const b = $('vslot'); if (!b) return;
  b.innerHTML = vOn ? `<button class="ib ${vMuted ? '' : 'on'}" onclick="vmute()">${vMuted ? '🔇 مكتوم' : '🎙️ شغال'}</button> <button class="ib rd" onclick="vstop()">اخرج</button>` : `<button class="ib" style="background:#1565c0" onclick="vstart()">🎙️ شات صوتي</button>`;
}
async function vstart() {
  try { vStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }) } catch (e) { return toast('مش قادر أفتح المايك. اسمح للمتصفح بالمايك وجرب تاني') }
  vOn = true; vMuted = false; vui(); send({ t: 'vjoin' });
}
function vmute() { vMuted = !vMuted; if (vStream) vStream.getAudioTracks().forEach(t => t.enabled = !vMuted); send({ t: 'vmute', m: vMuted ? 1 : 0 }); vui() }
function vstop() { send({ t: 'vleave' }); for (const k in vPc) vclose(k); if (vStream) vStream.getTracks().forEach(t => t.stop()); vStream = null; vOn = false; vui() }
function vclose(id) { const o = vPc[id]; if (!o) return; try { o.pc.close() } catch (e) { }; if (o.el) o.el.remove(); delete vPc[id] }
function vmk(id) {
  if (vPc[id]) return vPc[id];
  const pc = new RTCPeerConnection(ICE), o = { pc, el: null, q: [] }; vPc[id] = o;
  vStream.getTracks().forEach(t => pc.addTrack(t, vStream));
  pc.onicecandidate = e => { if (e.candidate) send({ t: 'rtc', to: id, d: { c: e.candidate } }) };
  pc.ontrack = e => { if (!o.el) { o.el = document.createElement('audio'); o.el.autoplay = true; o.el.playsInline = true; document.body.appendChild(o.el) } o.el.srcObject = e.streams[0]; o.el.play().catch(() => { }) };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') vclose(id) };
  return o;
}
async function voff(id) { vclose(id); const o = vmk(id); const off = await o.pc.createOffer(); await o.pc.setLocalDescription(off); send({ t: 'rtc', to: id, d: { s: o.pc.localDescription } }) }
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
      if (d.s.type === 'offer') { const a = await o.pc.createAnswer(); await o.pc.setLocalDescription(a); send({ t: 'rtc', to: m.from, d: { s: o.pc.localDescription } }) }
    } else if (d.c) { if (o.pc.remoteDescription) await o.pc.addIceCandidate(d.c).catch(() => { }); else o.q.push(d.c) }
  } catch (e) { }
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
