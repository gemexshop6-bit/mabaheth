'use strict';
const A = document.getElementById('app');
let ws, cfg, S, myname = '', tab = 'scene', sub = null, chatOpen = false, linkMode = false, linkSel = null, dragging = false;
let tool = 'lens', selPr = null, selCand = null, selSus = 's1', confOpen = false, detail = null, rooms = [];
try { myname = localStorage.mbName || '' } catch (e) { }
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
const ICON = { field: '🔦', coroner: '🔬', prints: '🖐️', chief: '⭐' };
const KIND = { scene: 'مسرح', body: 'جثة', print: 'بصمة', testimony: 'شهادة' };

function conn(first) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { if (first) first(); else { let s = null; try { s = JSON.parse(localStorage.mbSess || 'null') } catch (e) { } if (s) send({ t: 'join', code: s.code, token: s.token, name: myname }) } };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'hello') { cfg = m.cfg; try { localStorage.mbSess = JSON.stringify({ code: m.code, token: m.token }) } catch (e) { } }
    else if (m.t === 'state') { S = m; render() }
    else if (m.t === 'toast') toast(m.text);
    else if (m.t === 'err') { toast(m.e); if (!S) { try { localStorage.removeItem('mbSess') } catch (e) { } home() } }
    else if (m.t === 'rtc' || m.t === 'vjoin' || m.t === 'vleave') vmsg(m);
  };
  ws.onclose = () => { if (S) setTimeout(() => conn(), 1500); else toast('مفيش اتصال بالسيرفر، جرب تاني') };
}
const send = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
function toast(t) { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', 3800) }
function nm() { let v = ($('nm').value || '').trim(); if (!v) v = 'محقق ' + Math.floor(10 + Math.random() * 90); myname = v; try { localStorage.mbName = v } catch (e) { } return v }
function mk() { const n = nm(); try { localStorage.removeItem('mbSess') } catch (e) { }; conn(() => send({ t: 'create', name: n })) }
function jn(c) { const n = nm(); c = c || ($('cd').value || '').trim(); if (!c) return toast('اكتب كود الغرفة'); try { localStorage.removeItem('mbSess') } catch (e) { }; conn(() => send({ t: 'join', code: c, name: n })) }
function fsToggle() {
  const d = document, e = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return }
  const f = e.requestFullscreen || e.webkitRequestFullscreen;
  if (!f) return toast('المتصفح ده مش بيدعم ملء الشاشة. من آيفون: شارك ثم "أضف للشاشة الرئيسية"');
  const r = f.call(e); const lock = () => { try { screen.orientation.lock('landscape').catch(() => { }) } catch (x) { } };
  if (r && r.then) r.then(lock).catch(() => toast('مقدرتش أفتح ملء الشاشة')); else lock();
}

// ================= الشاشات =================
function home() {
  S = null;
  A.innerHTML = `<div class="scr"><div class="wrap"><h1>المباحث</h1><p class="m" style="text-align:center">لعبة تحقيق جماعية. اتحقق مع صحابك واستجوب المشتبه فيهم واقبض على القاتل.</p>
  <div class="card"><input class="t" id="nm" placeholder="اسمك" maxlength="20" value="${esc(myname)}">
  <button class="btn" onclick="mk()">افتح غرفة جديدة</button></div>
  <button class="btn ghost" onclick="helpOpen()">📖 إزاي تلعب؟ (القوانين والشرح)</button>
  <div class="card"><h3>ادخل غرفة</h3><input class="t" id="cd" placeholder="كود الغرفة (٤ أرقام)" inputmode="numeric" maxlength="4" style="text-align:center;letter-spacing:6px">
  <button class="btn" onclick="jn()">ادخل</button><div id="rl"></div></div></div></div>`;
  fetch('/rooms').then(r => r.json()).then(l => { const e = $('rl'); if (e && l.length) e.innerHTML = '<p class="m">غرف مفتوحة:</p>' + l.map(x => `<button class="btn ghost" onclick="jn('${esc(x.code)}')">غرفة ${esc(x.code)} - ${esc(x.host || '')} (${x.n}/4)</button>`).join('') }).catch(() => { });
}
function lobby() {
  const me = S.players.find(p => p.id === S.you), host = S.host === S.you;
  A.innerHTML = `<div class="scr"><div class="wrap"><div class="m" style="text-align:center">كود الغرفة (ابعته لصحابك)</div><div class="code">${esc(S.code)}</div>
  <div style="text-align:center">${S.players.map(p => `<span class="pl ${p.on ? '' : 'off'}">${esc(p.name)}${p.role ? ' · ' + cfg.roles[p.role] : ''}${p.id === S.host ? ' 👑' : ''}</span>`).join('')}</div>
  <div class="card"><b>${esc(cfg.title)}</b><p style="margin:4px 0">${esc(cfg.intro)}</p></div>
  <h3>اختار تخصصك</h3>
  ${Object.keys(cfg.roles).map(k => { const o = S.players.find(p => p.role === k); const mine = o && o.id === S.you; return `<div class="rolec ${mine ? 'mine' : ''} ${o && !mine ? 'taken' : ''}" onclick="pickRole('${k}')"><span class="ic">${ICON[k]}</span><div><b>${cfg.roles[k]}</b><div class="m">${ROLEDESC[k]}</div></div><span style="margin-inline-start:auto">${mine ? '✔ تخصصك' : o ? esc(o.name) : ''}</span></div>` }).join('')}
  <p class="m">لو مفيش لاعب على تخصص، أي حد يقدر يشتغل فيه. لازم لاعب واحد على الأقل.</p>
  <button class="btn ghost" onclick="helpOpen()">📖 إزاي تلعب؟ اقرأ القوانين الأول</button>
  ${host ? '<button class="btn red" onclick="send({t:\'start\'})">ابدأ التحقيق</button>' : '<div class="card" style="text-align:center">مستنيين صاحب الغرفة يبدأ...</div>'}
  </div></div>`;
}
const ROLEDESC = { field: 'يلف مسرح الجريمة ويجمع الأدلة ويرفع البصمات', coroner: 'يفحص الجثة بالأدوات ويحسب وقت الوفاة', prints: 'يطابق البصمات بعينه على أصحابها', chief: 'يفتح الصلاحيات ويقدم الاتهام للنيابة' };
function pickRole(k) { const me = S.players.find(p => p.id === S.you); send({ t: 'role', role: me.role === k ? null : k }) }

function myRoles() {
  const me = S.players.find(p => p.id === S.you), out = [];
  for (const k of Object.keys(cfg.roles)) if (me.role === k || !S.players.some(p => p.role === k)) out.push(k);
  return out;
}
const isMine = k => myRoles().includes(k);

function render() {
  if (!S) return;
  if (S.phase === 'lobby') { lobby(); return }
  if (S.phase === 'over') { over(); return }
  if (dragging) return;
  playShell();
}
function over() {
  const r = S.result, host = S.host === S.you;
  A.innerHTML = `<div class="scr"><div class="res"><div class="stamp ${r.win ? 'ok' : ''}">${r.win ? 'القضية اتقفلت' : 'القضية فشلت'}</div>
  <div class="card"><p>${esc(r.text)}</p><p>الرتبة: <b style="color:var(--gold);font-size:22px">${esc(r.rank)}</b></p>
  <p class="m">أدلة أساسية: ${r.keys} من ${r.totalKeys} · خيوط صح على اللوحة: ${r.good} من ${r.totalGood} · النقاط: ${r.sc}</p></div>
  ${host ? '<button class="btn" onclick="send({t:\'again\'})">قضية جديدة بنفس الفريق</button>' : '<p class="m">صاحب الغرفة يقدر يبدأ جولة جديدة</p>'}</div></div>`;
}

// ================= هيكل اللعب =================
let lastShell = '';
function playShell() {
  const me = S.players.find(p => p.id === S.you);
  const tabs = [['scene', '🔎 المسرح'], ['role', (ICON[me.role] || '🧰') + ' تخصصي'], ['board', '🗂 اللوحة'], ['sus', '👥 المشتبه فيهم'], ['accuse', '⚖ اتهم']];
  const key = 'x';
  if (!$('mn')) {
    A.innerHTML = `<div class="hd"><span class="sp" id="ttl"></span><span id="vslot"></span><button class="ib" onclick="helpOpen()">📖 إزاي تلعب</button><button class="ib chtog" onclick="togChat()">💬</button><button class="ib" onclick="fsToggle()" title="ملء الشاشة">⛶ ملء الشاشة</button></div>
    <div class="rot">لف الموبايل عرض عشان تلعب براحتك 📱↔️</div>
    <div class="bd"><div class="chp" id="chp"><h4>🎧 غرفة العمليات</h4><div class="pbar" id="pbar"></div><div class="chl" id="chl"></div><div class="cin"><input id="ci" placeholder="اكتب رسالة" maxlength="200" onkeydown="if(event.key==='Enter')sc()"><button onclick="sc()">ابعت</button></div></div>
    <div class="mn" id="mn"><div class="tc" id="tc"></div><div class="tabs" id="tabs"></div></div></div>`;
  }
  $('ttl').textContent = '🕵️ ' + cfg.title + ' · كود ' + S.code + ' · أدلة ' + S.found.length;
  $('tabs').innerHTML = tabs.map(t => `<button class="tab ${tab === t[0] ? 'on' : ''}" onclick="setTab('${t[0]}')">${t[1]}${t[0] === 'board' && S.found.length ? `<span class="bg">${S.found.length}</span>` : ''}</button>`).join('');
  $('chp').classList.toggle('open', chatOpen);
  renderChat();
  renderTab();
  vui();
}
function setTab(t) { tab = t; renderTab(); playShell() }
function togChat() { chatOpen = !chatOpen; $('chp').classList.toggle('open', chatOpen) }
function renderChat() {
  const l = $('chl'), near = l.scrollHeight - l.scrollTop - l.clientHeight < 60;
  l.innerHTML = S.chat.map(c => c.s ? `<div class="sys">• ${esc(c.text)}</div>` : `<div>${c.role ? `<span class="rl">[${esc(cfg.roles[c.role])}]</span> ` : ''}<b>${esc(c.n)}:</b> ${esc(c.text)}</div>`).join('');
  if (near || !l._init) { l.scrollTop = l.scrollHeight; l._init = 1 }
  $('pbar').innerHTML = S.players.map(p => `<span class="pl ${p.on ? '' : 'off'}">${ICON[p.role] || '👤'} ${esc(p.name)}</span>`).join('');
}
function sc() { const i = $('ci'); if (i && i.value.trim()) { send({ t: 'chat', text: i.value }); i.value = '' } }
function renderTab() {
  const tc = $('tc'); if (!tc) return;
  // احفظ مدخلات
  const keep = {}; for (const id of ['qi']) { const e = $(id); if (e) keep[id] = [e.value, document.activeElement === e] }
  ({ scene: tScene, role: tRole, board: tBoard, sus: tSus, accuse: tAccuse })[tab](tc);
  for (const id in keep) { const e = $(id); if (e) { e.value = keep[id][0]; if (keep[id][1]) e.focus() } }
}

// ---------- المسرح ----------
function tScene(tc) {
  tc.innerHTML = `<div class="scw"><div class="sc"><img src="/img/scene.jpg" draggable="false">
  ${cfg.spots.map(s => { const done = S.spots.includes(s.id), lock = s.gate && !S.gates[s.gate]; return `<div class="hs ${done ? 'done' : ''} ${lock ? 'lock' : ''}" style="left:${s.x}%;top:${s.y}%;width:${s.r * 1.5}%" onclick="spot('${s.id}')">${done ? '✔' : lock ? '🔒' : ''}</div>` }).join('')}
  <div class="sch">🔎 اضغط على الدواير الصفراء. تم جمع ${S.spots.length}</div><div class="scf" id="scf"></div></div></div>`;
}
function spot(id) {
  const s = cfg.spots.find(x => x.id === id);
  const f = $('scf'); if (f) { f.style.display = 'block'; f.textContent = s.label; clearTimeout(f._t); f._t = setTimeout(() => f.style.display = 'none', 2500) }
  if (!isMine('field')) return toast('ده شغل المحقق الميداني. هو اللي بيفحص المسرح');
  send({ t: 'collect', h: id });
}

// ---------- تخصصي ----------
function tRole(tc) {
  const mine = myRoles(); if (!sub || !mine.includes(sub)) sub = (S.players.find(p => p.id === S.you).role) || mine[0];
  let h = '<div class="pn">';
  if (mine.length > 1) h += '<div>' + mine.map(k => `<button class="btn sm ${sub === k ? '' : 'ghost'}" onclick="sub='${k}';renderTab()">${ICON[k]} ${cfg.roles[k]}</button>`).join('') + '</div>';
  h += ({ field: pField, coroner: pCoroner, prints: pPrints, chief: pChief })[sub]();
  tc.innerHTML = h + '</div>';
  tc.scrollTop = tc._st || 0;
}
function evList(kind) { const l = S.found.filter(e => e.kind === kind); return l.length ? l.map(e => `<div class="fnd"><b>${esc(e.title)}</b>${esc(e.desc)}</div>`).join('') : '<p class="m">لسه مفيش.</p>' }
function pField() {
  return `<h3>🔦 المحقق الميداني</h3><div class="card">لف على صورة المسرح (تبويب المسرح) واضغط على الدواير الصفراء لتجمع الأدلة. في أماكن مقفولة محتاجة إذن من رئيس المباحث. لما تلاقي حاجة عليها بصمة، ارفعها هنا وخبير البصمات يطابقها.</div>
  <h3>بصمات تقدر ترفعها</h3>${S.canLift.length ? S.canLift.map(c => `<button class="btn sm" onclick="send({t:'lift',clue:'${c.clue}'})">🧤 ارفع بصمة: ${esc(c.title)}</button>`).join('') : '<p class="m">مفيش أدلة عليها بصمات لسه مرفوعة.</p>'}
  <h3>أدلة المسرح اللي جمعتوها</h3>${evList('scene')}`;
}
function pChief() {
  return `<h3>⭐ رئيس المباحث</h3><div class="card">إنت اللي بتفتح الصلاحيات وبتقدم الاتهام. كل صلاحية محتاجة عدد أدلة. عندكم دلوقتي <b>${S.found.length}</b> دليل.</div>
  ${Object.entries(cfg.gates).map(([k, g]) => `<div class="card"><b>${esc(g.title)}</b><div class="m">${esc(g.text)} · محتاج ${g.need} أدلة</div>${S.gates[k] ? '<div style="color:var(--ok);font-weight:700">✔ اتفتح</div>' : `<button class="btn sm" ${S.found.length < g.need ? 'disabled' : ''} onclick="send({t:'unlock',g:'${k}'})">أصدر الأمر</button>`}</div>`).join('')}
  <h3>أوامر سريعة للفريق</h3>
  ${[['coroner', 'يا دكتور، افحص الجثة كويس'], ['prints', 'يا خبير، طابق البصمات المرفوعة'], ['field', 'يا محقق، لف تاني على المسرح'], ['', 'استجوبوا كل المشتبه فيهم وواجهوهم بالأدلة']].map(o => `<button class="btn sm ghost" onclick="send({t:'chat',text:'📣 ${o[1]}'})">${o[0] ? ICON[o[0]] + ' ' : '🗣 '}${o[1]}</button>`).join('')}`;
}
// الجثة
const TOOLS = [['lens', '🔍 عدسة'], ['ruler', '📏 مسطرة'], ['thermo', '🌡 ترمومتر كبد'], ['sample', '🧪 عينة']];
function pCoroner() {
  const svg = `<svg viewBox="0 0 200 300" style="width:100%;max-width:220px;background:#101a2b;border-radius:8px">
  <g fill="#cdbb99" stroke="#6d5f44" stroke-width="2"><circle cx="100" cy="42" r="26"/><rect x="82" y="66" width="36" height="14" rx="5"/><rect x="62" y="80" width="76" height="96" rx="16"/><rect x="26" y="84" width="30" height="100" rx="14"/><rect x="144" y="84" width="30" height="100" rx="14"/><rect x="68" y="176" width="28" height="112" rx="12"/><rect x="104" y="176" width="28" height="112" rx="12"/></g>
  <ellipse cx="100" cy="38" rx="26" ry="26" class="reg" onclick="exam('head')"/><rect x="82" y="64" width="36" height="18" class="reg" onclick="exam('neck')"/><rect x="72" y="112" width="56" height="44" class="reg" onclick="exam('abdomen')"/><rect x="26" y="168" width="30" height="24" class="reg" onclick="exam('hands')"/><rect x="144" y="168" width="30" height="24" class="reg" onclick="exam('hands')"/><rect x="108" y="170" width="26" height="22" class="reg" onclick="exam('pockets')"/>
  <text x="100" y="12" fill="#ffd966" font-size="10" text-anchor="middle">راس</text><text x="156" y="76" fill="#ffd966" font-size="9">رقبة</text><text x="100" y="170" fill="#ffd966" font-size="9" text-anchor="middle">بطن</text><text x="40" y="206" fill="#ffd966" font-size="9" text-anchor="middle">إيد</text><text x="146" y="206" fill="#ffd966" font-size="9">جيب</text></svg>`;
  let q = '';
  if (S.tod) q = `<div class="card" style="border-color:var(--gold)"><b>🌡 حساب وقت الوفاة</b><p>${esc(cfg.todText)}</p>${cfg.todOptions.map((o, i) => `<button class="btn sm" onclick="send({t:'tod',choice:${i}})">${esc(o)}</button>`).join('')}</div>`;
  return `<h3>🔬 الطبيب الشرعي</h3><div class="row"><div class="col" style="text-align:center">${svg}</div><div class="col">
  <div class="card">اختار أداة وبعدين اضغط على مكان في الجثة. كل أداة بتنفع مع أماكن معينة.</div>
  <div>${TOOLS.map(t => `<span class="tool ${tool === t[0] ? 'on' : ''}" onclick="tool='${t[0]}';renderTab()">${t[1]}</span>`).join('')}</div>${q}
  <h3>نتائج الفحص</h3>${evList('body')}</div></div>`;
}
function exam(r) { if (!isMine('coroner')) return toast('ده شغل الطبيب الشرعي'); send({ t: 'exam', tool, region: r }) }
// البصمات
function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } }
function printSVG(seed, ink) {
  const R = rnd(seed), type = seed % 3, cx = 50 + (R() - .5) * 10, cy = 52 + (R() - .5) * 10;
  const ph = [R() * 6.28, R() * 6.28, R() * 6.28], am = [.05 + R() * .09, .04 + R() * .08, .03 + R() * .06];
  let d = '';
  for (let i = 1; i <= 12; i++) {
    const rx = 3 + i * 3.4, ry = rx * (type === 0 ? 1.2 : type === 1 ? .95 : 1.45);
    let a0 = 0, a1 = 6.4;
    if (type === 1) { a0 = -.35; a1 = 3.5 + .35 }
    if (type === 2) { a0 = 3.14; a1 = 6.28 }
    let p = '';
    for (let a = a0; a <= a1; a += .12) {
      const w = 1 + am[0] * Math.sin(3 * a + ph[0]) + am[1] * Math.sin(5 * a + ph[1]) + am[2] * Math.sin(2 * a + ph[2]);
      const x = cx + rx * w * Math.cos(a), y = cy + ry * w * Math.sin(a) + (type === 2 ? i * 1.2 : 0);
      p += (p ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    d += `<path d="${p}"/>`;
  }
  let m = '';
  for (let i = 0; i < 6; i++) { const a = R() * 6.28, r = 6 + R() * 34; m += `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a) * 1.1).toFixed(1)}" r="3.4" fill="none" stroke="#e8a000" stroke-width="1.3"/>` }
  return `<svg viewBox="0 0 100 100"><g fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round">${d}</g>${m}</svg>`;
}
function pPrints() {
  const l = S.lifted; if (!selPr || !l.some(x => x.id === selPr)) selPr = l.length ? l[0].id : null;
  const cur = l.find(x => x.id === selPr);
  let h = `<h3>🖐️ خبير البصمات</h3><div class="card">المحقق الميداني بيرفع البصمات من المسرح. قارن النقش (الحلقات والدواير الصفرا الصغيرة) بين البصمة المجهولة وبصمات أصحابها، وبعدين اعتمد التطابق.</div>`;
  if (!l.length) return h + '<p class="m">مفيش بصمات مرفوعة لسه. المحقق لازم يرفعها من تبويب تخصصه.</p>';
  h += l.map(x => `<span class="pr ${x.id === selPr ? 'on' : ''}" onclick="selPr='${x.id}';selCand=null;renderTab()">${x.done ? '✔ ' : ''}${esc(x.name)}</span>`).join('');
  h += `<div class="row" style="align-items:flex-start"><div class="col" style="text-align:center"><div class="pr big" style="cursor:default">${printSVG(cur.seed, '#7a1c14')}المجهولة<br>${esc(cur.name)}</div></div><div class="col"><b>أصحاب البصمات:</b><div>`;
  h += cfg.cands.map(c => `<span class="pr ${selCand === c.id ? 'on' : ''}" onclick="selCand='${c.id}';renderTab()">${printSVG(c.seed, '#2a2418')}${esc(c.name)}</span>`).join('');
  h += `</div>${cur.done ? '<div style="color:var(--ok);font-weight:700">✔ اتطابقت</div>' : `<button class="btn sm" ${selCand ? '' : 'disabled'} onclick="pm()">اعتمد التطابق مع ${selCand ? esc(cfg.cands.find(c => c.id === selCand).name) : ''}</button>`}</div></div>
  <h3>نتائج البصمات</h3>${evList('print')}`;
  return h;
}
function pm() { if (!isMine('prints')) return toast('ده شغل خبير البصمات'); send({ t: 'pmatch', pid: selPr, cand: selCand }) }

// ---------- اللوحة ----------
function evTitle(id) { if (cfg.sus[id]) return cfg.sus[id].name; const e = S.found.find(x => x.id === id); return e ? e.title : id }
function tBoard(tc) {
  const pinned = new Set(S.board.items.map(i => i.id));
  const trayItems = [...Object.keys(cfg.sus).map(s => ({ id: s, title: cfg.sus[s].name, kind: 'sus' })), ...S.found.map(e => ({ id: e.id, title: e.title, kind: e.kind }))];
  const posOf = id => { const i = S.board.items.find(x => x.id === id); return i ? [i.x + 7.5, i.y + (cfg.sus[id] ? 11 : 6)] : null };
  const lines = S.board.links.map(l => { const a = posOf(l[0]), b = posOf(l[1]); return a && b ? `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#d62d20" stroke-width=".55" stroke-linecap="round"/><circle cx="${a[0]}" cy="${a[1]}" r=".9" fill="#d62d20"/><circle cx="${b[0]}" cy="${b[1]}" r=".9" fill="#d62d20"/>` : '' }).join('');
  const sel = detail && S.found.find(e => e.id === detail);
  tc.innerHTML = `<div class="bdw"><div class="tray"><button class="btn sm ${linkMode ? 'red' : 'ghost'}" style="width:100%;margin:2px 0" onclick="linkMode=!linkMode;linkSel=null;renderTab()">🧵 ${linkMode ? 'وضع التوصيل شغال. اضغط كارتين' : 'وصّل بخيط أحمر'}</button>
  ${sel ? `<div class="fnd"><b>${esc(sel.title)}</b>${esc(sel.desc)}</div>` : ''}
  ${trayItems.map(t => `<div class="it ${t.kind}"><span>${esc(t.title)}</span>${pinned.has(t.id) ? '<small>معلّق</small>' : `<button onclick="send({t:'pin',id:'${t.id}'})">📌</button>`}</div>`).join('')}</div>
  <div class="cork" id="cork" style="background-image:url(/img/board.jpg)">
  ${S.board.items.map(i => cfg.sus[i.id] ? `<div class="pin sus ${linkSel === i.id ? 'sel' : ''}" data-id="${i.id}" style="left:${i.x}%;top:${i.y}%"><span class="x" data-x="1">✕</span><img src="/img/${cfg.sus[i.id].img}.jpg"><div>${esc(cfg.sus[i.id].name)}</div></div>` : `<div class="pin ${linkSel === i.id ? 'sel' : ''}" data-id="${i.id}" style="left:${i.x}%;top:${i.y}%"><span class="x" data-x="1">✕</span>${esc(evTitle(i.id))}</div>`).join('')}
  <svg class="th" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${S.board.items.length ? '' : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;text-shadow:0 0 6px #000;text-align:center;padding:20px">علّق الأدلة والمشتبه فيهم من القايمة اللي على اليمين، وبعدين وصّلهم بخيوط حمرا</div>'}</div></div>`;
  bindBoard();
}
function bindBoard() {
  const cork = $('cork'); if (!cork) return;
  cork.querySelectorAll('.pin').forEach(el => {
    el.addEventListener('pointerdown', ev => {
      const id = el.dataset.id;
      if (ev.target.dataset.x) { send({ t: 'unpin', id }); return }
      if (linkMode) { if (!linkSel) { linkSel = id; renderTab() } else { if (linkSel !== id) send({ t: 'link', a: linkSel, b: id }); linkSel = null; renderTab() } return }
      detail = id; const rc = cork.getBoundingClientRect(), r0 = el.getBoundingClientRect();
      const ox = ev.clientX - r0.left, oy = ev.clientY - r0.top; let moved = false; dragging = true; el.setPointerCapture(ev.pointerId);
      const mv = e => { moved = true; const x = Math.max(0, Math.min(100 - r0.width / rc.width * 100, (e.clientX - ox - rc.left) / rc.width * 100)), y = Math.max(0, Math.min(100 - r0.height / rc.height * 100, (e.clientY - oy - rc.top) / rc.height * 100)); el.style.left = x + '%'; el.style.top = y + '%'; el._p = [x, y] };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); dragging = false; if (moved && el._p) send({ t: 'move', id, x: el._p[0], y: el._p[1] }); else renderTab() };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  });
}

// ---------- المشتبه فيهم ----------
function tSus(tc) {
  const ids = Object.keys(cfg.sus), st = S.sus[selSus], info = cfg.sus[selSus];
  const lg = st.log.map(e => e.s ? `<div class="a ${e.crack ? 'crack' : ''}"><b style="color:var(--gold)">${esc(info.name)}:</b> ${esc(e.text)}</div>` : `<div class="q"><b>${e.role ? '[' + esc(cfg.roles[e.role]) + '] ' : ''}${esc(e.who)}:</b> ${esc(e.q)}</div>`).join('');
  tc.innerHTML = `<div class="sg">${ids.map(s => { const x = S.sus[s]; return `<div class="sc2 ${s === selSus ? 'on' : ''} ${x.gone ? 'gone' : ''}" onclick="selSus='${s}';renderTab()"><img src="/img/${cfg.sus[s].img}.jpg"><div style="min-width:0"><b style="font-size:13px">${esc(cfg.sus[s].name)}</b><div class="m" style="font-size:11px">${x.gone ? 'هرب' : x.mood}</div><div class="mood"><i style="width:${x.stress}%"></i></div></div></div>` }).join('')}</div>
  <div class="iv"><div class="ivp"><img src="/img/${info.img}.jpg"><div><b>${esc(info.name)}</b><div class="m">${esc(info.title)} · ${info.age} سنة</div><div class="m" style="font-size:12px">${esc(info.intro)}</div></div></div>
  <div class="ivl"><div class="log" id="lg">${lg || '<p class="m">ابدأ الاستجواب. اكتب أي سؤال بأي طريقة، وجرب تواجهه بالأدلة اللي لقيتوها.</p>'}</div>
  ${st.gone ? '<p class="m">المتهم ده خرج من القسم.</p>' : `<div class="cin" style="padding:6px 0 0;border:0"><input id="qi" placeholder="اسأل ${esc(info.name)} أي حاجة..." maxlength="160" onkeydown="if(event.key==='Enter')askQ()"><button onclick="askQ()">اسأل</button><button style="background:#c0392b;color:#fff" onclick="confOpen=true;renderTab()">📎 واجهه بدليل</button></div>`}</div></div>
  ${confOpen ? `<div class="modal" onclick="if(event.target===this){confOpen=false;renderTab()}"><div class="box"><b>واجه ${esc(info.name)} بدليل:</b>${S.found.length ? S.found.map(e => `<div class="fnd" style="cursor:pointer" onclick="conf('${e.id}')"><b>${esc(e.title)}</b>${esc(e.desc)}</div>`).join('') : '<p class="m">لسه مفيش أدلة.</p>'}<button class="btn ghost" onclick="confOpen=false;renderTab()">إلغاء</button></div></div>` : ''}`;
  const lgE = $('lg'); if (lgE) lgE.scrollTop = lgE.scrollHeight;
}
function askQ() { const e = $('qi'); if (!e || !e.value.trim()) return; send({ t: 'ask', s: selSus, text: e.value }); e.value = '' }
function conf(ev) { confOpen = false; send({ t: 'confront', s: selSus, ev }); renderTab() }

// ---------- اتهم ----------
function tAccuse(tc) {
  const ids = Object.keys(cfg.sus), g = cfg.gates.accuse, n = S.players.length;
  const count = s => Object.values(S.votes).filter(x => x === s).length, mine = S.votes[S.you];
  let h = `<div class="pn"><h3>⚖ الاتهام</h3><div class="card">غلطات: <b>${S.strikes}</b> من 2. لو اتهمتوا غلط، المتهم بيهرب والقضية بتصعب، ولو غلطتوا مرتين القضية بتفشل.</div>`;
  if (!S.gates.accuse) h += `<div class="card">باب الاتهام لسه مقفول. رئيس المباحث يفتحه لما يبقى عندكم ${g.need} أدلة (عندكم ${S.found.length}).</div>`;
  else h += `<div class="row">${ids.map(s => `<div class="col card" style="text-align:center;${S.sus[s].gone ? 'opacity:.4' : ''}"><img src="/img/${cfg.sus[s].img}.jpg" style="width:90px;height:120px;object-fit:cover;object-position:top;border-radius:6px"><div><b>${esc(cfg.sus[s].name)}</b></div><div class="m">${esc(cfg.sus[s].title)}</div><div>أصوات: ${count(s)} / ${n}</div>
  ${S.sus[s].gone ? '<b>هرب</b>' : `<button class="btn sm ${mine === s ? '' : 'ghost'}" onclick="send({t:'${mine === s ? 'unvote' : 'vote'}',s:'${s}'})">${mine === s ? '✔ صوتك ليه' : 'صوّت'}</button>${isMine('chief') ? `<button class="btn sm red" onclick="if(confirm('تقدم الاتهام ضد ${esc(cfg.sus[s].name)}؟'))send({t:'accuse',s:'${s}'})">قدّم الاتهام</button>` : ''}`}</div>`).join('')}</div><p class="m">لازم أغلبية الفريق تصوّت على نفس الشخص، ورئيس المباحث هو اللي يقدم الاتهام.</p>`;
  tc.innerHTML = h + '</div>';
}

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

// ================= إزاي تلعب =================
const HELP=[
['🎯 فكرة اللعبة','إنت وصحابك فريق مباحث (لحد 4 لاعبين). في جريمة قتل و3 مشتبه فيهم، وواحد بس هو القاتل. تجمعوا أدلة من المسرح والجثة والبصمات، تستجوبوا المشتبه فيهم، وفي الآخر تتهموا القاتل الصح. الشغل كله جماعي، ومحدش بيعرف يحل لوحده.'],
['🚀 إزاي تبدأ','واحد يفتح غرفة جديدة ويبعت الكود (٤ أرقام) لصحابه، وهما يكتبوه في "ادخل غرفة". كل واحد يختار تخصصه في اللوبي، وصاحب الغرفة يدوس "ابدأ التحقيق". اتكلموا مع بعض بالشات الكتابي أو زرار 🎙️ شات صوتي فوق.'],
['🔦 المحقق الميداني','هو اللي بيفحص المسرح. من تبويب "المسرح" اضغط على الدواير الصفراء في الصورة لتجمع الأدلة (الدايرة الخضرا يعني اتجمعت، والمقفولة 🔒 محتاجة إذن الرئيس). في أماكن مفيهاش حاجة، وده طبيعي. لما تلاقي دليل عليه بصمة، ارفعها من تبويب "تخصصي".'],
['🔬 الطبيب الشرعي','بيفحص الجثة. اختار أداة (عدسة، مسطرة، ترمومتر كبد، عينة) وبعدين اضغط على مكان في الجثة. كل أداة بتنفع مع أماكن معينة، فجرب. وبالترمومتر هتحسب وقت الوفاة: الجسم بيبرد درجة تقريبا كل ساعة من ٣٧، وده بيفرق في أقوال المشتبه فيهم.'],
['🖐️ خبير البصمات','المحقق بيرفع بصمات من المسرح. إنت تقارن النقش بتاع البصمة المجهولة (شكل الحلقات والدواير الصغيرة) ببصمات أصحابها وتعتمد التطابق. التخمين الغلط بيخسّر الفريق نقط.'],
['⭐ رئيس المباحث','بيدير الفريق. بيصدر الأوامر اللي بتفتح حاجات جديدة: الدولاب المقفول (٣ أدلة)، السلم الخلفي (٥ أدلة)، وباب الاتهام (٨ أدلة). وهو الوحيد اللي بيقدم الاتهام الرسمي في الآخر. لو مفيش لاعب على تخصص، أي حد في الفريق يقدر يشتغل فيه.'],
['🗣 الاستجواب','من تبويب "المشتبه فيهم" اختار شخص واكتب له أي سؤال بالعربي زي ما تحب: كنت فين؟ تعرف المجني عليه منين؟ كل واحد يرد بشخصيته. لاحظ شريط التوتر تحت صورته. لو كررت نفس السؤال أو ضغطت عليه هيتوتر أكتر.'],
['📎 واجهه بدليل','دي أهم حاجة في الاستجواب. دوس "واجهه بدليل" واختار دليل لقيتوه. المشتبه فيه بيتهرب أو يكدب أو يتوتر، ولو واجهته بأدلة صح كفاية بينهار ويقول حقيقة جديدة، وساعات بتظهر شهادة جديدة تضاف للأدلة. المواجهة بدليل غلط مش بتضر، بس مش هتفيد.'],
['🗂 لوحة التحقيق','لوحة فلين مشتركة، كل اللي في الغرفة بيشوف نفس اللوحة. دوس 📌 جنب أي دليل أو مشتبه فيه علشان تعلقه، وحركه بصباعك. دوس "وصّل بخيط أحمر" واضغط على كارتين علشان تربط بينهم (اضغط عليهم تاني يشيل الخيط). فكر في السلسلة: سلاح الجريمة، البصمة، الدافع، الشهادة. الخيوط الصح بتزود رتبتكم.'],
['⚖ الاتهام والتصويت','لما رئيس المباحث يفتح باب الاتهام، كل لاعب يصوّت على اللي شاكك فيه. لازم أغلبية الفريق على نفس الشخص، وبعدين الرئيس يضغط "قدّم الاتهام".'],
['🏆 الكسب والخسارة','لو المتهم هو القاتل: كسبتوا وبتاخدوا رتبة من نقيب لحد لواء حسب الأدلة الأساسية اللي لقيتوها والخيوط الصح على اللوحة وعدد الغلطات. لو غلط: المتهم البريء بيخرج من القسم والباقي بيبقوا أحرص. غلطتين والقضية بتفشل. فاتأكدوا قبل ما تتهموا.'],
['💡 نصايح','اتكلموا مع بعض وقولوا كل دليل جديد. استجوبوا الكل أكتر من مرة بعد كل دليل جديد. مش كل مشتبه فيه بيكدب في كل حاجة، ومش كل دليل مهم. ولف الموبايل عرض، وادوس ⛶ ملء الشاشة.']
];
function helpOpen(){ if($('helpm'))return; const d=document.createElement('div'); d.id='helpm'; d.className='modal'; d.onclick=e=>{if(e.target===d)helpClose()};
 d.innerHTML='<div class="box" style="max-width:640px;max-height:92%"><div style="display:flex;align-items:center"><h3 style="margin:0;flex:1;color:var(--gold)">📖 إزاي تلعب</h3><button class="ib" onclick="helpClose()">✕ إغلاق</button></div><div class="m" style="margin:4px 0 8px">قوانين اللعبة وشرح خطوة بخطوة</div>'+HELP.map(h=>'<div class="card"><b style="color:var(--gold)">'+h[0]+'</b><div style="margin-top:3px">'+h[1]+'</div></div>').join('')+'<button class="btn" onclick="helpClose()">فهمت، يلا نلعب</button></div>'; document.body.appendChild(d); }
function helpClose(){const d=$('helpm'); if(d)d.remove()}
home();
let _ses = null; try { _ses = JSON.parse(localStorage.mbSess || 'null') } catch (e) { }
if (_ses) { conn(() => send({ t: 'join', code: _ses.code, token: _ses.token, name: myname })) }
