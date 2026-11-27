'use strict';
const A = document.getElementById('app');
let ws, S, cfg, myname = '', rooms = [], chatTab = 'chat', side = true, lastLog = 0, lastTurn = null, lastPhase = '', guessTxt = '';
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
    else if (m.t === 'state') { S = m; S._t = Date.now(); fx(); render() }
    else if (m.t === 'toast') toast(m.text);
    else if (m.t === 'emo') floatEmo(m);
    else if (m.t === 'err') { toast(m.e); if (!S) { try { localStorage.removeItem('mbSess') } catch (e) { } home() } }
    else if (m.t === 'rtc' || m.t === 'vjoin' || m.t === 'vleave') vmsg(m);
  };
  ws.onclose = () => { if (S) setTimeout(() => conn(), 1500); else toast('مفيش اتصال بالسيرفر، جرب تاني') };
}
function fx() {
  if (S.phase === 'lobby') lastLog = S.ln;
  const nw = Math.min(S.ln - lastLog, S.log.length); lastLog = S.ln;
  for (const l of S.log.slice(S.log.length - nw)) { if (l.k === 'win') SFX.win(); else if (l.k === 'bad' || l.k === 'miss') SFX.bad(); else if (l.k === 'q') { if (l.text.includes('✅')) SFX.yes(); else if (l.text.includes('❌')) SFX.no() } }
  if (S.turn === S.you && lastTurn !== S.you) SFX.turn(); lastTurn = S.turn;
  if (S.phase === 'break' && lastPhase !== 'break') SFX.bad();
  lastPhase = S.phase;
}
function floatEmo(m) { const d = document.createElement('div'); d.className = 'emo'; d.style.left = (10 + Math.random() * 70) + '%'; d.innerHTML = `<div>${esc(m.e)}</div><small>${esc(m.name)}</small>`; document.body.appendChild(d); SFX.pop(); setTimeout(() => d.remove(), 2600) }
function nm() { let v = ($('nm').value || '').trim(); if (!v) v = 'لاعب ' + Math.floor(10 + Math.random() * 90); myname = v; try { localStorage.mbName = v } catch (e) { } return v }
function fsToggle() {
  const d = document, e = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return }
  const f = e.requestFullscreen || e.webkitRequestFullscreen;
  if (!f) return toast('المتصفح ده مش بيدعم ملء الشاشة. من آيفون: شارك ثم "أضف للشاشة الرئيسية"');
  const r = f.call(e); const lock = () => { try { screen.orientation.lock('landscape').catch(() => { }) } catch (x) { } };
  if (r && r.then) r.then(lock).catch(() => toast('مقدرتش أفتح ملء الشاشة')); else lock();
}
function fmt(s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
const pl = id => S.players.find(p => p.id === id) || { name: '؟', score: 0 };
// ---------- home
function home() {
  S = null;
  A.innerHTML = `<div class="home"><div class="logo"><div class="big">🎭</div><h1>اعرف مين المعايا؟</h1><p>لعبة الحفلات اللي هتموّتك ضحك مع صحابك</p></div>
  <div class="panel"><input id="nm" class="inp" maxlength="20" placeholder="اسمك" value="${esc(myname)}">
  <div class="row"><button class="btn y" onclick="mk()">🎉 افتح غرفة جديدة</button></div>
  <div class="row"><input id="cd" class="inp" inputmode="numeric" maxlength="4" placeholder="كود الغرفة"><button class="btn t" onclick="jn()">ادخل</button></div>
  <div id="rl" class="rl"></div>
  <div class="row"><button class="btn p" onclick="helpOpen()">📖 إزاي تلعب</button><button class="btn" onclick="fsToggle()">⛶ ملء الشاشة</button></div></div></div>`;
  fetch('/rooms').then(r => r.json()).then(l => { const e = $('rl'); if (!e || S) return; e.innerHTML = l.length ? '<b>غرف مفتوحة:</b> ' + l.map(r => `<button class="chip" onclick="$('cd').value='${r.code}';jn()">${r.code} • ${esc(r.host)} (${r.n})</button>`).join('') : '' }).catch(() => { });
}
function mk() { const n = nm(); const f = () => send({ t: 'create', name: n }); if (ws && ws.readyState === 1) f(); else conn(f) }
function jn() { const n = nm(), c = ($('cd').value || '').trim(); if (c.length < 4) return toast('اكتب كود الغرفة (٤ أرقام)'); const f = () => send({ t: 'join', code: c, name: n }); if (ws && ws.readyState === 1) f(); else conn(f) }
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
function body() {
  const host = S.host === S.you, cat = (cfg.cats.find(c => c.id === S.cat) || {});
  if (S.phase === 'lobby') {
    const mins = [1, 3, 5, 10, 15];
    return `<div class="lob"><div class="card"><h3>👥 اللاعبين (${S.players.length}/6) • كود الغرفة <span class="code">${S.code}</span></h3>${board()}
    ${host ? `<div class="row"><button class="chip" onclick="send({t:'addbot'})">🤖 ضيف بوت</button><button class="chip" onclick="send({t:'rmbot'})">➖ شيل بوت</button></div>` : ''}</div>
    <div class="card"><h3>🎯 الفئة ${host ? '' : '(الهوست بيختار)'}</h3><div class="cats">${cfg.cats.map(c => `<button class="cat ${c.id === S.cat ? 'sel' : ''}" ${host ? `onclick="send({t:'set',cat:'${c.id}'})"` : 'disabled'}><span>${c.emoji}</span>${c.name}<small>${c.n}</small></button>`).join('')}</div>
    <h3>⏱ وقت الجولة</h3><div class="row">${mins.map(m => `<button class="chip ${S.dur === m * 60 ? 'sel' : ''}" ${host ? `onclick="send({t:'set',dur:${m * 60}})"` : 'disabled'}>${m} دقيقة</button>`).join('')}</div>
    ${host ? `<button class="btn y big2" onclick="send({t:'start'})">🚀 ابدأ اللعب</button>` : '<p class="mut">مستنيين الهوست يبدأ اللعبة... اتكلموا في الشات في الأثناء 💬</p>'}</div></div>`;
  }
  if (S.phase === 'result') {
    const sorted = [...S.seats].sort((a, b) => (a.rank || 99) - (b.rank || 99));
    return `<div class="res"><h2>🏁 النتيجة</h2><div class="cards">${sorted.map(s => card(s)).join('')}</div>${board()}
    ${host ? `<button class="btn y" onclick="send({t:'again'})">🔁 جولة جديدة</button>` : '<p class="mut">مستنيين الهوست يبدأ جولة جديدة</p>'}</div>`;
  }
  const mine = S.seats.find(s => s.id === S.you), last = S.log[S.log.length - 1];
  let act = '';
  if (S.phase === 'break') {
    const und = S.seats.filter(s => !s.done);
    act = `<div class="brk"><h2>⏰ الوقت خلص!</h2><p>اختاروا مين الكسبان وبعدين كلكم دوسوا "استكمال"</p><div class="row wrap">${und.map(s => `<button class="chip ${S.bp[S.you] === s.id ? 'sel' : ''}" onclick="send({t:'bpick',id:'${s.id}'})">${esc(pl(s.id).name)} ${Object.values(S.bp).filter(v => v === s.id).length ? '👍' + Object.values(S.bp).filter(v => v === s.id).length : ''}</button>`).join('')}</div>
    <button class="btn y" onclick="send({t:'bready'})">${S.br[S.you] ? '✅ مستنيين الباقي' : '▶ استكمال'}</button> <small>(${Object.keys(S.br).length}/${S.players.filter(p => !p.bot && p.on).length} جاهزين)</small></div>`;
  } else if (mine && mine.done) act = `<div class="act"><p class="mut">🎉 إنت خلصت! كارتك طلع <b>${esc(mine.card.n)}</b>. اتفرج على الباقي وشجّعهم بالإيموجي</p></div>`;
  else if (S.pend) {
    act = S.pend.mine ? `<div class="act"><p>⏳ مستني الباقي يجاوبوا على: <b>${esc(S.pend.text)}</b></p></div>` : S.pend.voted ? `<div class="act"><p class="mut">صوتك اتسجل</p></div>` : `<div class="act"><p>❓ ${esc(pl(S.pend.by).name)} بيسأل: <b>${esc(S.pend.text)}</b> (بالنسبة لكارته)</p><div class="row"><button class="btn t" onclick="send({t:'vote',y:1})">✅ أيوه</button><button class="btn r" onclick="send({t:'vote',y:0})">❌ لأ</button></div></div>`;
  } else if (S.turn === S.you) {
    act = `<div class="act mine"><div class="row wrap"><b>🎤 دورك (${S.tLeft}ث):</b>${S.q.map(q => `<button class="chip q" onclick="send({t:'ask',qi:${q.i}})">${esc(q.t)}</button>`).join('')}</div>
    <div class="row"><input id="fq" class="inp" maxlength="80" placeholder="اسأل سؤال بإجابة أيوه/لأ (الناس هتصوّت)"><button class="btn t sm" onclick="askf()">اسأل</button></div>
    <div class="row"><input id="gs" class="inp" maxlength="40" placeholder="عارف إنت مين؟ اكتب الاسم (غلط = تفوّت دور)"><button class="btn y sm" onclick="gsend()">خمّن!</button><button class="btn p sm" onclick="send({t:'hint'})">💡 تلميح (-10)</button></div>
    ${mine && mine.hints.length ? `<div class="hints">${mine.hints.map(h => '💡 ' + esc(h)).join(' • ')}</div>` : ''}</div>`;
  } else act = `<div class="act"><p class="mut">⏳ دور <b>${esc(pl(S.turn).name)}</b> (${S.tLeft}ث) — اسمع أسئلته وجاوب 😉</p>${mine && mine.hints.length ? `<div class="hints">${mine.hints.map(h => '💡 ' + esc(h)).join(' • ')}</div>` : ''}</div>`;
  return `<div class="play"><div class="cards">${S.seats.map(s => card(s)).join('')}</div><div class="tick">${last ? esc(last.text) : ''}</div>${act}</div>`;
}
function askf() { const v = $('fq').value.trim(); if (v) send({ t: 'askf', text: v }) }
function gsend() { const v = $('gs').value.trim(); if (v) send({ t: 'guess', text: v }) }
function sidebar() {
  const msgs = chatTab === 'chat' ? S.chat.map(m => m.s ? `<div class="m s">${esc(m.text)}</div>` : `<div class="m ${m.id === S.you ? 'me' : ''}"><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('') : S.log.map(l => `<div class="m s ${l.k}">${esc(l.text)}</div>`).join('');
  return `<div class="side"><div class="tabs"><button class="${chatTab === 'chat' ? 'sel' : ''}" onclick="chatTab='chat';render()">💬 شات</button>${S.phase !== 'lobby' ? `<button class="${chatTab === 'log' ? 'sel' : ''}" onclick="chatTab='log';render()">📜 السجل</button>` : ''}</div>
  <div class="msgs" id="msgs">${msgs}</div>
  <div class="emos">${['😂', '👏', '😮', '🔥', '🤡', '💀', '❤️'].map(e => `<button onclick="send({t:'emo',e:'${e}'})">${e}</button>`).join('')}</div>
  <div class="row"><input id="ci" class="inp" maxlength="200" placeholder="اكتب رسالة..." onkeydown="if(event.key==='Enter')csend()"><button class="btn t sm" onclick="csend()">إرسال</button></div></div>`;
}
function csend() { const v = $('ci').value.trim(); if (v) { send({ t: 'chat', text: v }); $('ci').value = '' } }
function render() {
  if (!S) return;
  const keep = {}; ['fq', 'gs', 'ci'].forEach(id => { const e = $(id); if (e) keep[id] = [e.value, document.activeElement === e] });
  const sc = $('msgs') ? $('msgs').scrollTop : 0, bot = $('msgs') ? ($('msgs').scrollHeight - $('msgs').scrollTop - $('msgs').clientHeight < 40) : true;
  const timer = S.phase === 'play' ? `<span class="tm" id="tm">⏱ ${fmt(S.left)}</span>` : '';
  A.innerHTML = `<div class="hd"><b class="ttl">🎭 ${esc((cfg.cats.find(c => c.id === S.cat) || {}).emoji || '')} غرفة ${S.code}</b>${timer}<span class="sp"></span><span id="vslot"></span><button class="ib" onclick="side=!side;render()">💬</button><button class="ib" onclick="helpOpen()">📖</button><button class="ib" onclick="fsToggle()">⛶</button><button class="ib rd" onclick="leaveRoom()">🚪 خروج</button></div>
  <div class="main ${side ? '' : 'noside'}"><div class="mid">${body()}</div>${side ? sidebar() : ''}</div>`;
  for (const id in keep) { const e = $(id); if (e) { e.value = keep[id][0]; if (keep[id][1]) e.focus() } }
  const mg = $('msgs'); if (mg) mg.scrollTop = bot ? mg.scrollHeight : sc;
  vui();
}
setInterval(() => { if (S && S.phase === 'play') { const d = (Date.now() - S._t) / 1000, e = $('tm'); if (e) { const l = Math.max(0, S.left - d); e.textContent = '⏱ ' + fmt(l); e.className = 'tm' + (l < 30 ? ' low' : ''); if (l < 10 && l > 0 && Math.floor(l) !== S._lt) { S._lt = Math.floor(l); SFX.tick() } } } }, 500);
// ---------- rules
function helpOpen() {
  if ($('helpm')) return; const d = document.createElement('div'); d.id = 'helpm'; d.className = 'modal'; d.onclick = e => { if (e.target === d) helpClose() };
  const H = [['🎯 الفكرة', 'كل واحد فينا بيتحط على دماغه كارت (مغني، ممثل، أكلة، مكان...). إنت مش شايف كارتك، بس شايف كروت كل اللي معاك! لازم تعرف إنت مين.'],
  ['🎤 دورك', 'لما يجيلك الدور تقدر: تسأل سؤال جاهز من الأزرار (زي "أنا راجل؟") والإجابة بتيجي لوحدها، أو تكتب سؤال أيوه/لأ بنفسك واللاعبين يصوّتوا. بعد كده الدور بيعدّي للي بعدك.'],
  ['🤔 التخمين', 'عارف إنت مين؟ اكتب الاسم واضغط "خمّن". لو صح تاخد نقط كبيرة (أول واحد ١٠٠، التاني ٧٠، وهكذا). لو غلط بتفوّت دورك الجاي!'],
  ['💡 التلميح', 'زرار التلميح بيدّيك معلومة عن اسمك بس بيخصم ١٠ نقط.'],
  ['⏱ الوقت', 'اللي بيحدد وقت الجولة هو الهوست. لو الوقت خلص ومحدش كسب، بتظهر شاشة استراحة: اختاروا مين الكسبان وكلكم دوسوا "استكمال" وكملوا.'],
  ['🏆 النقط', 'الجولة بتكمل لحد ما يفضل واحد بس. بعدها بتشوفوا كل الكروت، والنقط بتفضل متسجلة في ترتيب الغرفة جولة بعد جولة.'],
  ['🎙 الصوت والشات', 'الشات الكتابي والمايك شغالين من أول ما تدخل الغرفة، حتى قبل اللعب. وفي إيموجي تبعتها وتطلع قدام الكل.'],
  ['🤖 البوتات', 'لو الغرفة فاضية، الهوست يضيف بوتات بتلعب وتسأل وتخمّن زي أي لاعب.']];
  d.innerHTML = `<div class="box"><div class="row"><h2 style="flex:1;margin:0">📖 إزاي تلعب</h2><button class="ib rd" onclick="helpClose()">✖</button></div>${H.map(h => `<div class="rule"><b>${h[0]}</b><p>${h[1]}</p></div>`).join('')}</div>`;
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
function vmute() { vMuted = !vMuted; if (vStream) vStream.getAudioTracks().forEach(t => t.enabled = !vMuted); vui() }
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
if (_ses) { conn(() => send({ t: 'join', code: _ses.code, token: _ses.token, name: myname })) }
