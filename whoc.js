'use strict';
// ====== وضع "مين المجرم؟" : الواجهة ======
let wtab = 'ev', wkey = '', wq = { to: null, k: 'where', place: 0, text: '' }, wbuild = { weapon: 0, method: 0, place: 0, cover: 1 }, wtimer = null;
const REL = ['لا، علاقتي بيه عادية', 'كان بينا خلاف قديم', 'كنت بحترمه جدا'];
const HELPW = [
  ['🎭 فكرة اللعبة', 'الغرفة 3 لاعبين بالظبط: اتنين مباحث ومجرم واحد. الأدوار بتتوزع عشوائي وسري، ومحدش يعرف دور التاني. الظباط لازم يعرفوا مين المجرم، والمجرم لازم يخبي نفسه ويخلي الظباط يشكوا في بعض.'],
  ['🤖 البوتات', 'لو دخلتوا اتنين بس (أو واحد)، صاحب الغرفة يدوس "ضيف بوت" ويكمل العدد. البوت بيلعب دوره بجد: لو مباحث بيسأل ويفتش ويصوت بمنطق، ولو مجرم بيكدب ويزرع أدلة.'],
  ['🧱 قبل المباراة: المجرم يبني الجريمة', 'المجرم بس هو اللي بيشوف شاشة "ابني الجريمة". بيختار سرا السلاح والطريقة ومكان الجريمة، وكمان بيختار المكان اللي هيقول إنه كان فيه (حجته الكدابة). اختياراته هي اللي بتحدد الأدلة اللي هتظهر في المباراة، فكل مباراة مختلفة.'],
  ['🪪 الحجة السرية', 'كل لاعب بياخد مكان كان فيه الساعة ٩:٣٠ مساء وقت الجريمة. الظباط حجتهم حقيقية. المجرم حجته كدابة، لأنه الحقيقة كان في مكان الجريمة. شوف حجتك في تبويب "ملفي".'],
  ['🔁 الجولات (3 جولات)', 'في كل جولة: أولا المجرم بيعمل حركة سرية واحدة. بعدها بيظهر دليل جديد للكل. وبعدين بيبدأ الاستجواب المفتوح، وبتخلصوه بزرار "جاهز" أو لما الوقت يخلص. بعد الجولة التالتة بيبدأ التصويت.'],
  ['🕵️ حركة المجرم السرية', 'كل جولة المجرم يختار واحدة: يخبي دليل من الأدلة اللي لسه مظهرتش، أو يتخلص من الأثر اللي معاه، أو يزرع دليل مزيف (سجل مراقبة يثبت حجته، أو بصمة مزيفة تتهم واحد من الظباط). أو يعدي من غير حركة.'],
  ['💬 الاستجواب', 'من تبويب "الاستجواب" اختار حد واسأله: كنت فين؟ شفت مين في مكان معين؟ علاقتك بالضحية؟ أو اكتب سؤال حر. الأسئلة والإجابات كلها علنية قدام الكل ومتسجلة. كل ظابط معاه 3 أسئلة في الجولة، والمجرم معاه سؤالين. استخدم زرار 🎙️ فوق عشان تتكلموا بالصوت كمان.'],
  ['⚠️ علامة التناقض', 'لما حد يجاوب إجابة بتخالف دليل ظاهر، اللعبة بتحط جنب إجابته علامة ⚠️ قدام الكل. مثلا: قال إنه كان في مكان، والسجل بيقول إن المكان كان فاضي. والمجرم ممكن يدمر العلامة بدليل مزروع.'],
  ['🧪 أدوات الظباط', 'كل ظابط معاه فحص معمل واحد في المباراة كلها: بتختار دليل ظاهر والمعمل يقولك هل هو أصلي ولا مزروع. ومعاه تفتيش واحد: بتفتش لاعب، ولو هو المجرم وماتخلصش من الأثر هتلاقي حاجة معاه.'],
  ['⚖ التصويت', 'في الآخر كل لاعب (الظابطين والمجرم) يصوّت على واحد غيره. اللي ياخد أصوات أكتر من الباقي يتقبض عليه. لو الأصوات اتفرقت ومفيش أغلبية، محدش بيتقبض عليه والمجرم ينجو.'],
  ['🏆 النقط والفوز', 'لو اتمسك المجرم: الظباط ياخدوا نقط الأدلة الأصلية والتناقضات والفحوصات والأصوات الصح، ويزيد عليهم بونص. لو نجا: هو ياخد نقط حركاته السرية الناجحة ونقط الظباط كمان. وأي ظابط صوّت غلط بيخسر 8 نقط. النقط بتتجمع في لوحة نتايج الغرفة وبتكمل بين المباريات، وكل مباراة بأدوار جديدة.'],
  ['💡 نصايح', 'للظابط: انت عارف إنك مباحث، فالمجرم هو التاني اللي معاك. دور على اللي حجته بتخالف الدليل، وافحص الأدلة المشبوهة. للمجرم: خليك ثابت على حجتك، وازرع دليل قبل ما حد يكشفك، ومتبانش متوتر.']
];
const wnm = id => { const s = S.m && S.m.seats.find(x => x.id === id); return s ? s.name : '؟' };
const wme = () => S.m && S.m.me;

function whoRender() {
  if (S.phase === 'lobby') return whoLobby();
  if (S.phase === 'result') return whoResult();
  whoPlay();
}
function scoreHtml() {
  if (!S.score || !S.score.length) return '';
  return '<div class="card"><b>🏅 نتايج الغرفة</b>' + S.score.map((r, i) => `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)"><span>${i + 1}.</span><span style="flex:1">${esc(r.name)}${r.bot ? ' 🤖' : ''}</span><span class="m">${r.n} مباراة</span><b style="color:var(--gold)">${r.pts}</b></div>`).join('') + '</div>';
}
function whoLobby() {
  const host = S.host === S.you, n = S.players.length;
  A.innerHTML = `<div class="scr"><div class="wrap"><div class="m" style="text-align:center">كود الغرفة (ابعته لصحابك)</div><div class="code">${esc(S.code)}</div>
  <h3 style="text-align:center;color:var(--gold)">🎭 مين المجرم؟</h3>
  <div style="text-align:center">${S.players.map(p => `<span class="pl ${p.on ? '' : 'off'}">${p.bot ? '🤖 ' : ''}${esc(p.name)}${p.id === S.host ? ' 👑' : ''}${host && p.bot ? ` <a href="#" onclick="send({t:'rmbot',id:'${p.id}'});return false" style="color:#ff8a80">✕</a>` : ''}</span>`).join('')}</div>
  <div class="card"><p style="margin:0">3 لاعبين بالظبط: اتنين مباحث ومجرم. الأدوار عشوائية وسرية. اللاعبين الحاليين: <b>${n}</b> من 3.</p></div>
  ${host && n < 3 ? '<button class="btn ghost" onclick="send({t:\'addbot\'})">🤖 ضيف بوت</button>' : ''}
  <button class="btn ghost" onclick="helpOpen('who')">📖 إزاي تلعب؟ اقرأ القوانين</button>
  <button class="btn ghost" onclick="leaveRoom()">🚪 خروج من الروم</button>
  ${host ? `<button class="btn red" ${n === 3 ? '' : 'disabled'} onclick="send({t:'wstart'})">${S.matches ? 'ابدأ مباراة جديدة' : 'ابدأ المباراة'}</button>` : '<div class="card" style="text-align:center">مستنيين صاحب الغرفة يبدأ...</div>'}
  ${scoreHtml()}</div></div>`;
}
function whoResult() {
  const r = S.result, host = S.host === S.you, m = S.m, c = r.crim;
  const meWin = (wme().role === 'crim') ? !r.caught : r.caught;
  A.innerHTML = `<div class="scr"><div class="res" style="max-width:640px"><div class="stamp ${r.caught ? 'ok' : ''}">${r.caught ? 'اتقبض على المجرم' : 'المجرم نجا'}</div>
  <div class="card"><p style="margin:0">المجرم كان: <b style="color:var(--gold);font-size:20px">${esc(wnm(c))}</b> ${meWin ? '🎉 كسبت المباراة' : '😬 خسرت المباراة'}</p>
  <p class="m" style="margin:4px 0">${r.arrested ? 'اللي اتقبض عليه: ' + esc(wnm(r.arrested)) : 'مفيش أغلبية في التصويت فمحدش اتقبض عليه'}</p></div>
  <div class="card" style="text-align:start"><b>🧱 الجريمة الحقيقية</b><div>السلاح: ${esc(r.crime.weapon)} · الطريقة: ${esc(r.crime.method)} · المكان: ${esc(r.crime.place)}</div><div>الحجة الكدابة: كان "${esc(r.crime.cover)}"</div>
  ${r.fakes.length ? '<div>أدلة مزروعة: ' + r.fakes.map(esc).join('، ') + '</div>' : '<div class="m">مفيش أدلة اتزرعت</div>'}
  ${r.hidden.length ? '<div>أدلة اتخبت: ' + r.hidden.map(esc).join('، ') + '</div>' : ''}</div>
  <div class="card" style="text-align:start"><b>🗳 الأصوات</b>${Object.entries(r.votes).map(([a, b]) => `<div>${esc(wnm(a))} ← ${esc(wnm(b))}</div>`).join('')}</div>
  <div class="card" style="text-align:start"><b>🧮 النقط في المباراة دي</b>${m.seats.map(s => `<div style="display:flex"><span style="flex:1">${esc(s.name)}${s.id === c ? ' 🎭' : ' 🕵️'}</span><b style="color:${r.pts[s.id] >= 0 ? 'var(--gold)' : '#ff8a80'}">${r.pts[s.id] > 0 ? '+' : ''}${r.pts[s.id]}</b></div>`).join('')}
  <p class="m" style="margin:6px 0 0">أدلة أصلية: ${r.parts.real} · مزيف اتكشف: ${r.parts.fakeExp} · علامات ⚠️ على المجرم: ${r.parts.flagsOnCrim} · أصوات صح من الظباط: ${r.parts.good} · حركات المجرم الناجحة: ${r.parts.hides + r.parts.plantsOk}</p></div>
  ${scoreHtml()}
  ${host ? '<button class="btn" onclick="send({t:\'wagain\'})">مباراة جديدة بأدوار جديدة</button>' : '<p class="m">صاحب الغرفة يقدر يبدأ مباراة جديدة</p>'}
  <button class="btn ghost" onclick="helpOpen('who')">📖 إزاي تلعب؟</button><button class="btn ghost" onclick="leaveRoom()">🚪 خروج من الروم</button></div></div>`;
}
function wtimerTick() {
  const e = $('wtm'); if (!e || !S || !S.m) return;
  const l = Math.max(0, S.m.left - Math.round((Date.now() - S._t) / 1000)); e.textContent = '⏱ ' + l;
}
function whoPlay() {
  const m = S.m, me = wme(); if (!me) { A.innerHTML = '<div class="scr"><div class="card">إنت متفرج في المباراة دي</div></div>'; return }
  const key = m.n + ':' + m.round + ':' + m.sub;
  if (key !== wkey) {
    wkey = key;
    if (m.sub === 'build' || m.sub === 'act') wtab = me.role === 'crim' ? 'act' : 'me';
    else if (m.sub === 'qa') wtab = 'qa';
    else if (m.sub === 'vote') wtab = 'vote';
  }
  const tabs = [['ev', '🔎 الأدلة' + (m.shown.length ? `<span class="bg">${m.shown.length}</span>` : '')], ['qa', '💬 الاستجواب'], ['me', '🪪 ملفي وأدواتي']];
  if (me.role === 'crim' && (m.sub === 'build' || m.sub === 'act')) tabs.unshift(['act', '🧱 حركتك السرية']);
  if (m.sub === 'vote') tabs.unshift(['vote', '⚖ صوّت']);
  tabs.push(['chat', '🗨 دردشة']);
  if (!tabs.some(t => t[0] === wtab)) wtab = tabs[0][0];
  const keep = {}; for (const id of ['wt', 'wc']) { const e = $(id); if (e) keep[id] = [e.value, document.activeElement === e] }
  if (!$('wmn')) {
    A.innerHTML = `<div class="hd"><span class="sp" id="wttl"></span><span id="wtm" class="m"></span><span id="vslot"></span><button class="ib rd" onclick="leaveRoom()">🚪 خروج</button><button class="ib" onclick="helpOpen('who')">📖 إزاي تلعب</button><button class="ib" onclick="fsToggle()">⛶ ملء الشاشة</button></div>
    <div class="rot">لف الموبايل عرض عشان تلعب براحتك 📱↔️</div>
    <div class="bd"><div class="mn" id="wmn"><div class="tc" id="wtc"></div><div class="tabs" id="wtabs"></div></div></div>`;
  }
  const phaseTxt = m.sub === 'build' ? 'تجهيز الجريمة' : m.sub === 'act' ? 'جولة ' + m.round + ' · حركة المجرم' : m.sub === 'qa' ? 'جولة ' + m.round + ' من 3 · استجواب' : 'التصويت';
  $('wttl').textContent = (me.role === 'crim' ? '🎭 إنت المجرم' : '🕵️ إنت مباحث') + ' · ' + phaseTxt + ' · كود ' + S.code;
  $('wtabs').innerHTML = tabs.map(t => `<button class="tab ${wtab === t[0] ? 'on' : ''}" onclick="wsetTab('${t[0]}')">${t[1]}</button>`).join('');
  wrenderTab();
  for (const id in keep) { const e = $(id); if (e) { e.value = keep[id][0]; if (keep[id][1]) { e.focus() } } }
  if (typeof vui === 'function') vui();
  clearInterval(wtimer); wtimer = setInterval(wtimerTick, 1000); wtimerTick();
}
function wsetTab(t) { wtab = t; wrenderTab(); $('wtabs').innerHTML = $('wtabs').innerHTML; whoPlay() }
function wrenderTab() {
  const tc = $('wtc'); if (!tc) return; const st = tc.scrollTop;
  tc.innerHTML = '<div class="pn">' + ({ ev: wEv, qa: wQa, me: wMe, act: wAct, vote: wVote, chat: wChat })[wtab]() + '</div>';
  tc.scrollTop = st;
}
function wEv() {
  const m = S.m;
  let h = `<div class="card"><b style="color:var(--gold)">${esc(m.title)}</b><p style="margin:3px 0">${esc(m.intro)}</p><div class="m">الضحية: ${esc(m.victim)} · وقت الجريمة: ${m.time}</div></div>`;
  h += '<h3>🔎 الأدلة اللي ظهرت</h3>';
  if (!m.shown.length) h += '<p class="m">لسه مفيش أدلة. أول دليل بيظهر بعد حركة المجرم في الجولة الأولى.</p>';
  for (const e of m.shown) h += `<div class="fnd" style="${e.lab === 'fake' ? 'border-color:var(--red);opacity:.8' : e.lab === 'real' ? 'border-color:var(--ok)' : ''}"><b>${esc(e.title)} <span class="m" style="font-weight:400">· جولة ${e.r}</span> ${e.lab === 'real' ? '<span style="color:#1b7a46">✔ أصلي (المعمل)</span>' : e.lab === 'fake' ? '<span style="color:#b3261e">✖ مزروع (المعمل)</span>' : ''}</b>${esc(e.desc)}</div>`;
  h += '<h3>📜 سجل الأحداث</h3>' + m.log.slice().reverse().map(l => `<div class="sys" style="color:var(--gold);margin:3px 0">• ${esc(l.text)}</div>`).join('');
  return h;
}
function qtext(e) {
  const k = e.q.k;
  if (k === 'where') return 'كنت فين الساعة ' + S.m.time + '؟';
  if (k === 'saw') return 'شفت مين في "' + S.m.places[e.q.place] + '"؟';
  if (k === 'rel') return 'كان في مشكلة بينك وبين الضحية؟';
  return e.q.text;
}
function atext(e) {
  if (e.a === 'refused') return '🤐 رفض الإجابة';
  if (e.a === null) return '⏳ لسه ما جاوبش...';
  const k = e.q.k;
  if (k === 'where') return 'كنت في ' + S.m.places[e.a.place];
  if (k === 'saw') return e.a.saw ? 'شفت ' + wnm(e.a.saw) + ' هناك' : 'ماشفتش حد هناك';
  if (k === 'rel') return REL[e.a.opt];
  return e.a.text;
}
function wQa() {
  const m = S.m, me = wme(), others = m.seats.filter(s => s.id !== me.id), live = m.sub === 'qa';
  if (!wq.to || !others.some(s => s.id === wq.to)) wq.to = others[0].id;
  let h = '';
  // أسئلة موجهة ليا
  const mine = m.qa.filter(e => e.to === me.id && e.a === null);
  for (const e of mine) {
    h += `<div class="card" style="border-color:var(--gold)"><b>❓ ${esc(wnm(e.from))} بيسألك:</b> ${esc(qtext(e))}<div style="margin-top:6px">`;
    if (e.q.k === 'where') h += m.places.map((p, i) => `<button class="tool ${i === me.place ? 'on' : ''}" onclick="wans(${e.id},{place:${i}})">${esc(p)}${i === me.place ? ' (حجتك)' : ''}</button>`).join('');
    else if (e.q.k === 'saw') h += others.map(s => `<button class="tool" onclick="wans(${e.id},{saw:'${s.id}'})">شفت ${esc(s.name)}</button>`).join('') + `<button class="tool" onclick="wans(${e.id},{saw:null})">ماشفتش حد</button>`;
    else if (e.q.k === 'rel') h += REL.map((r, i) => `<button class="tool" onclick="wans(${e.id},{opt:${i}})">${esc(r)}</button>`).join('');
    else h += `<input class="t" id="wa${e.id}" placeholder="اكتب إجابتك" maxlength="160"><button class="btn sm" onclick="wans(${e.id},{text:$('wa${e.id}').value})">رد</button>`;
    h += '</div></div>';
  }
  h += '<div class="row"><div class="col">';
  if (live) {
    const left = m.qleft[me.id] || 0;
    h += `<div class="card"><b>🎤 اسأل حد</b> <span class="m">(باقي لك ${left} سؤال في الجولة)</span><div>${others.map(s => `<button class="tool ${wq.to === s.id ? 'on' : ''}" onclick="wq.to='${s.id}';wrenderTab()">${esc(s.name)}</button>`).join('')}</div>
    <div>${[['where', 'كنت فين؟'], ['saw', 'شفت مين في...؟'], ['rel', 'علاقتك بالضحية؟'], ['free', 'سؤال حر']].map(q => `<button class="tool ${wq.k === q[0] ? 'on' : ''}" onclick="wq.k='${q[0]}';wrenderTab()">${q[1]}</button>`).join('')}</div>
    ${wq.k === 'saw' ? `<div>${m.places.map((p, i) => `<button class="tool ${wq.place === i ? 'on' : ''}" onclick="wq.place=${i};wrenderTab()">${esc(p)}</button>`).join('')}</div>` : ''}
    ${wq.k === 'free' ? '<input class="t" id="wt" placeholder="اكتب سؤالك" maxlength="140" oninput="wq.text=this.value">' : ''}
    <button class="btn sm" ${left ? '' : 'disabled'} onclick="wask()">اسأل</button></div>
    <button class="btn ${me.ready ? 'ghost' : ''}" ${me.ready ? 'disabled' : ''} onclick="send({t:'ready'})">${me.ready ? '✅ جاهز للجولة الجاية' : 'خلصت أسئلتي، جاهز للجولة الجاية'}</button>
    <p class="m">اللاعبين الجاهزين: ${m.seats.filter(s => s.ready).map(s => esc(s.name)).join('، ') || 'لسه حد'}</p>`;
  } else h += '<div class="card m">الاستجواب بيفتح لما يظهر دليل الجولة. الأسئلة القديمة قدامك في السجل.</div>';
  h += '</div><div class="col"><h3 style="margin-top:0">📋 سجل الأسئلة والإجابات (علني)</h3>';
  if (!m.qa.length) h += '<p class="m">لسه مفيش أسئلة.</p>';
  for (const e of m.qa.slice().reverse()) h += `<div class="log" style="flex:none;margin:6px 0;padding:6px 8px"><div class="q"><b>${esc(wnm(e.from))} ← ${esc(wnm(e.to))} · ج${e.r}</b><div>${esc(qtext(e))}</div></div><div class="a">${esc(atext(e))}${e.flag ? ' <b style="color:#ff6b5e">⚠️ يتناقض مع الأدلة</b>' : ''}</div></div>`;
  return h + '</div></div>';
}
function wask() {
  const q = { k: wq.k };
  if (wq.k === 'saw') q.place = wq.place;
  if (wq.k === 'free') { if (!wq.text.trim()) return toast('اكتب السؤال'); q.text = wq.text }
  send({ t: 'ask', to: wq.to, q }); wq.text = '';
}
function wans(id, a) { send({ t: 'ans', id, a }) }
function wMe() {
  const m = S.m, me = wme(), crim = me.role === 'crim';
  let h = `<div class="card" style="border-color:${crim ? 'var(--red)' : 'var(--gold)'}"><b style="font-size:18px">${crim ? '🎭 إنت المجرم' : '🕵️ إنت مباحث'}</b>`;
  if (!m.hasCfg) h += '<p class="m">لسه المجرم بيجهز الجريمة...</p>';
  else {
    h += `<p style="margin:6px 0">${crim ? 'حجتك الكدابة اللي هتقولها: ' : 'حجتك الحقيقية: '}كنت في <b>${esc(m.places[me.place])}</b> الساعة ${m.time}.</p>`;
    if (crim) h += `<p class="m" style="margin:2px 0">الحقيقة (إنت بس اللي عارفها): الجريمة حصلت في <b>${esc(me.crime.place)}</b>، السلاح: ${esc(me.crime.weapon)}، الطريقة: ${esc(me.crime.method)}.</p><p class="m" style="margin:2px 0">${me.trace ? 'معاك أثر لسه: ' + esc(me.trace) : 'اتخلصت من الأثر اللي كان معاك.'}</p>`;
    else h += '<p class="m" style="margin:2px 0">إنت عارف إنك مباحث، فالمجرم هو واحد من اللاعبين التانيين. حجتك حقيقية، وأي حد يقول إنه كان في مكانك بيكدب.</p>';
  }
  h += '</div>';
  if (!crim) {
    const others = m.seats.filter(s => s.id !== me.id), live = m.sub === 'qa';
    h += `<div class="row"><div class="col"><div class="card"><b>🧪 فحص المعمل</b> <span class="m">(مرة واحدة في المباراة)</span><p class="m" style="margin:2px 0">اختار دليل ظاهر وهتعرف أصلي ولا مزروع.</p>${me.labUsed ? '<p>✅ استخدمته</p>' : !live ? '<p class="m">متاح في وقت الاستجواب</p>' : m.shown.filter(e => !e.lab).map(e => `<button class="tool" onclick="send({t:'lab',id:'${e.id}'})">${esc(e.title)}</button>`).join('') || '<p class="m">مفيش دليل ظاهر</p>'}</div></div>
    <div class="col"><div class="card"><b>🔍 تفتيش لاعب</b> <span class="m">(مرة واحدة في المباراة)</span><p class="m" style="margin:2px 0">النتيجة بتظهر في السجل للكل.</p>${me.srchUsed ? '<p>✅ استخدمته</p>' : !live ? '<p class="m">متاح في وقت الاستجواب</p>' : others.map(s => `<button class="tool" onclick="send({t:'search',to:'${s.id}'})">فتّش ${esc(s.name)}</button>`).join('')}</div></div></div>`;
  } else h += `<div class="card"><b>🧰 حركاتك</b><p class="m" style="margin:2px 0">حركاتك السرية بتتعمل من تبويب "حركتك السرية" قبل كل جولة. اللي عملته لحد دلوقتي: خبيت ${me.hides || 0}، زرعت ${me.plants || 0}.</p></div>`;
  return h;
}
function wAct() {
  const m = S.m, me = wme();
  if (m.sub === 'build' && m.opts) {
    const o = m.opts;
    const grp = (title, key, arr, skip) => `<div class="card"><b>${title}</b><div>${arr.map((x, i) => `<button class="tool ${wbuild[key] === i ? 'on' : ''}" ${skip === i ? 'disabled' : ''} onclick="wbuild.${key}=${i};if(wbuild.place===wbuild.cover)wbuild.cover=(wbuild.place+1)%5;wrenderTab()">${esc(x)}</button>`).join('')}</div></div>`;
    if (wbuild.place === wbuild.cover) wbuild.cover = (wbuild.place + 1) % 5;
    return `<div class="card"><b style="color:var(--red)">🧱 ابني الجريمة (سري، إنت بس اللي شايف)</b><p class="m" style="margin:2px 0">اختياراتك هي اللي هتولّد الأدلة اللي هتظهر. ${esc(m.intro)}</p></div>
    ${grp('🔪 السلاح', 'weapon', o.weapons)}${grp('🧭 الطريقة', 'method', o.methods)}${grp('📍 مكان الجريمة الحقيقي', 'place', o.places)}${grp('🪪 المكان اللي هتقول إنك كنت فيه (حجتك الكدابة)', 'cover', o.places, wbuild.place)}
    <button class="btn red" onclick="send({t:'build',weapon:wbuild.weapon,method:wbuild.method,place:wbuild.place,cover:wbuild.cover})">اعتمد الجريمة وابدأ</button>`;
  }
  if (m.sub === 'build') return '<div class="card m">جاري تجهيز الجريمة...</div>';
  if (m.sub !== 'act') return '<div class="card m">حركتك السرية بتتفتح في أول كل جولة.</div>';
  if (me.acted) return '<div class="card">✅ عملت حركتك. الأدلة بتظهر دلوقتي...</div>';
  const dets = m.seats.filter(s => s.id !== me.id);
  const hide = me.pending.map(e => `<button class="tool" onclick="send({t:'act',kind:'hide',id:'${e.id}'})">${esc(e.title)}</button>`).join('') + (me.trace ? '<button class="tool" onclick="send({t:\'act\',kind:\'hide\',id:\'trace\'})">اتخلص من الأثر اللي معاك</button>' : '');
  return `<div class="card"><b style="color:var(--red)">🕵️ حركتك السرية للجولة ${m.round}</b><p class="m" style="margin:2px 0">اختار حركة واحدة بس. محدش هيعرف إنك عملتها.</p></div>
  <div class="card"><b>🫥 اخفي دليل</b> <span class="m">(بيتشال من اللي لسه هيظهر)</span><div>${hide || '<span class="m">مفيش حاجة تتخبي</span>'}</div></div>
  <div class="card"><b>🧪 ازرع دليل مزيف</b> <span class="m">(الفحص بالمعمل بيكشفه)</span><div><button class="tool" onclick="send({t:'act',kind:'plant',what:'alibi'})">سجل مراقبة يثبت حجتي (${esc(m.places[me.place])})</button>${dets.map(d => `<button class="tool" onclick="send({t:'act',kind:'plant',what:'frame',target:'${d.id}'})">بصمة مزيفة تتهم ${esc(d.name)}</button>`).join('')}</div></div>
  <button class="btn ghost" onclick="send({t:'act',kind:'skip'})">عدّي الجولة من غير حركة</button>`;
}
function wVote() {
  const m = S.m, me = wme(), others = m.seats.filter(s => s.id !== me.id);
  if (me.voted) return `<div class="card">✅ صوّت على <b>${esc(wnm(me.voted))}</b>. مستنيين الباقي (${m.seats.filter(s => s.voted).length} من 3 صوتوا).</div>`;
  return `<div class="card"><b style="color:var(--gold)">⚖ مين المجرم؟</b><p class="m" style="margin:2px 0">${me.role === 'crim' ? 'إنت المجرم: صوّت على واحد من الظباط عشان تفرق الأصوات.' : 'صوّت على اللي شاكك إنه المجرم. صوتك مش هيترجع في.'} التصويت سري لحد ما الكل يخلص.</p></div>
  ${others.map(s => `<button class="btn ${me.role === 'crim' ? 'ghost' : 'red'}" onclick="if(confirm('تأكيد التصويت على ${esc(s.name)}؟'))send({t:'vote',to:'${s.id}'})">صوّت على ${esc(s.name)}</button>`).join('')}`;
}
function wChat() {
  return `<div class="log" style="height:auto;max-height:230px;flex:none">${S.chat.map(c => c.s ? `<div class="sys" style="color:var(--gold)">• ${esc(c.text)}</div>` : `<div><b>${esc(c.n)}:</b> ${esc(c.text)}</div>`).join('') || '<span class="m">اتكلموا مع بعض هنا أو بالصوت 🎙️</span>'}</div>
  <div class="cin"><input id="wc" placeholder="اكتب رسالة" onkeydown="if(event.key==='Enter')wsc()"><button onclick="wsc()">ابعت</button></div>`;
}
function wsc() { const i = $('wc'); if (i && i.value.trim()) { send({ t: 'chat', text: i.value }); i.value = '' } }
