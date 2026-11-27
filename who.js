'use strict';
// وضع "مين المجرم؟" : منطق السيرفر
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuf = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
const clean = (s, n) => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, n || 200);
const BOTN = ['سامي', 'ليلى', 'كريم', 'هدى', 'عادل', 'منى', 'ياسر', 'نادية'];
const TIME = '٩:٣٠ مساء';
const F = +process.env.WSPEED || 1;

const SC = [
  {
    id: 'villa', title: 'جريمة الفيلا', victim: 'الحاج فؤاد، رجل أعمال',
    intro: 'الحاج فؤاد اتلاقى مقتول في فيلته الساعة ١٠ بالليل. الفيلا كانت فيها ٣ ناس بس وقت الجريمة، ومحدش دخل ولا خرج من بره.',
    places: ['غرفة المكتب', 'الجنينة', 'المطبخ', 'المرآب', 'سطح الفيلا'],
    weapons: [
      { n: 'مسدس بكاتم صوت', t: 'ظرف رصاصة فاضي', d: 'ظرف رصاصة عيار صغير اتلاقى جنب الجثة، وفيه آثار كاتم صوت.' },
      { n: 'شمعدان نحاس تقيل', t: 'شمعدان عليه دم', d: 'شمعدان نحاس عليه دم وشعر، واتمسح بسرعة من على المقبض.' },
      { n: 'سكين مطبخ', t: 'سكين ناقصة من الطقم', d: 'طقم سكاكين المطبخ ناقص منه سكينة كبيرة، ومكانها فاضي.' }
    ],
    methods: [
      { n: 'تسلل من الشباك', t: 'زجاج مكسور من بره', d: 'زجاج الشباك مكسور ومتناثر برة، يعني حد دخل بالقوة.', tr: 'شظية زجاج صغيرة لسه في جيب الجاكيت.' },
      { n: 'استخدم مفتاح مسروق', t: 'القفل سليم', d: 'مفيش كسر في الأبواب. اللي دخل كان معاه مفتاح.', tr: 'سلسلة مفاتيح غريبة مش بتاعته.' },
      { n: 'استدرجه بمكالمة', t: 'آخر مكالمة مجهولة', d: 'آخر مكالمة على موبايل الحاج فؤاد كانت من رقم مجهول الساعة ٩:١٥.', tr: 'خط موبايل تاني متخبي في الجيب.' }
    ]
  },
  {
    id: 'hotel', title: 'جريمة الفندق', victim: 'مستر جمال، نزيل الجناح الملكي',
    intro: 'مستر جمال اتلاقى ميت في جناحه بفندق كبير. الأمن قفل الفندق، والمشتبه فيهم هما التلاتة اللي كانوا في الدور الأخير.',
    places: ['الجناح الملكي', 'البار', 'الممر الخلفي', 'حمام السباحة', 'الأسانسير'],
    weapons: [
      { n: 'سم في المشروب', t: 'كوباية فيها رواسب', d: 'كوباية المشروب جنب الجثة وفيها رواسب غريبة، والتحليل بيقول سم.' },
      { n: 'حبل ستارة', t: 'حبل ستارة مقطوع', d: 'حبل ستارة الجناح اتقطع واتلف حوالين رقبة الضحية.' },
      { n: 'تمثال رخام', t: 'تمثال ناقص من الرف', d: 'تمثال رخام صغير ناقص من رف الجناح، واتلقى متنضف بالمناديل.' }
    ],
    methods: [
      { n: 'اتنكر في زي عامل', t: 'بدلة عامل مرمية', d: 'بدلة موظف خدمة الغرف اتلقت مرمية في سلة الغسيل من غير صاحبها.', tr: 'بادج موظف مزور في الجيب.' },
      { n: 'عطل كاميرات الممر', t: 'الكاميرات واقفة', d: 'كاميرات الممر اتعطلت من الساعة ٩:٢٠ لحد ٩:٤٠ بالظبط.', tr: 'جهاز صغير بيشوش على الأجهزة.' },
      { n: 'دخل بكارت مضروب', t: 'كارت الغرفة مكرر', d: 'سجل الباب بيقول إن الغرفة اتفتحت بكارت مكرر مش اللي اتصرف للنزيل.', tr: 'كارت بلاستيك فاضي عليه شريط مغناطيسي.' }
    ]
  },
  {
    id: 'opera', title: 'جريمة دار الأوبرا', victim: 'المايسترو سمير',
    intro: 'المايسترو سمير اتلاقى ميت وراء الكواليس قبل الحفلة بنص ساعة. المبنى مقفول والتلاتة دول بس اللي كانوا موجودين.',
    places: ['وراء الكواليس', 'غرفة الملابس', 'قاعة البروفات', 'السطح', 'المخزن'],
    weapons: [
      { n: 'عصا المايسترو الحديد', t: 'عصا مكسورة', d: 'عصا المايسترو الثقيلة اتكسرت نصين وعليها آثار دم.' },
      { n: 'حقنة', t: 'حقنة فاضية', d: 'حقنة فاضية اتلقت وراء ستارة المسرح، ووجود آثار دواء قوي.' },
      { n: 'كابل صوت', t: 'كابل متقطع', d: 'كابل ميكروفون اتقطع منه جزء طويل، وعليه آثار على رقبة الضحية.' }
    ],
    methods: [
      { n: 'استغل انقطاع النور', t: 'النور قطع ٣ دقايق', d: 'قاطع الكهربا نزل اتنين وتلاتة دقايق الساعة ٩:٣٠ بالظبط.', tr: 'كشاف صغير بطارياته لسه سخنة.' },
      { n: 'استدرجه برسالة', t: 'ورقة بخط مقلد', d: 'ورقة بخط مقلد بتطلب من المايسترو يقابل حد وراء الكواليس.', tr: 'قلم حبر نفس لون الورقة.' },
      { n: 'استخدم باب الطوارئ', t: 'باب الطوارئ مفتوح', d: 'باب الطوارئ كان مفتوح من جوه وعليه آثار قماش.', tr: 'قطعة قماش من ستارة المسرح الحمرا.' }
    ]
  },
  {
    id: 'lab', title: 'جريمة المعمل', victim: 'د. هشام، كبير الباحثين',
    intro: 'د. هشام اتلاقى ميت في معمل الأبحاث بعد ما الشركة اتقفلت. التلاتة اللي معاهم بصمة الدخول هما المشتبه فيهم.',
    places: ['معمل الكيمياء', 'غرفة السيرفرات', 'الكافتيريا', 'موقف السيارات', 'مكتب الإدارة'],
    weapons: [
      { n: 'مادة كيماوية سامة', t: 'قارورة مفتوحة', d: 'قارورة مادة كيماوية خطيرة مفتوحة جنب الجثة وناقص منها كمية.' },
      { n: 'مفتاح ربط تقيل', t: 'مفتاح ربط عليه دم', d: 'مفتاح ربط من صندوق الصيانة عليه دم، وصندوق الأدوات مفتوح.' },
      { n: 'تيار كهربا', t: 'سلك مكشوف', d: 'سلك مكشوف متوصل بمقبض الباب الحديد، وآثار حروق على إيد الضحية.' }
    ],
    methods: [
      { n: 'استخدم كارت موظف مسروق', t: 'دخول بكارت غير مطابق', d: 'سجل الدخول بيقول إن الكارت اتستخدم في وقت الموظف صاحبه كان فيه خارج الشركة.', tr: 'كارت موظف مش بتاعه في المحفظة.' },
      { n: 'مسح تسجيلات الكاميرا', t: 'تسجيل ناقص', d: 'تسجيلات الكاميرا اتمسحت من ٩:٢٥ لحد ٩:٣٥ بالظبط.', tr: 'فلاشة فيها أوامر المسح.' },
      { n: 'استدرجه بتجربة جديدة', t: 'دعوة لتجربة سرية', d: 'رسالة على جهاز الضحية بتدعوه لتجربة سرية في المعمل الساعة ٩.', tr: 'نسخة مطبوعة من الرسالة في الجيب.' }
    ]
  }
];

const REL_OPT = ['لا، علاقتي بيه عادية', 'كان بينا خلاف قديم', 'كنت بحترمه جدا'];
const BOT_FREE_D = ['مفيش عندي حاجة أخبيها، اسأل اللي تحب.', 'كنت في مكاني زي ما قلتلك، وده كل اللي عندي.', 'أنا هنا عشان نوصل للحقيقة زيكم بالظبط.', 'فكروا في الأدلة الأول وبعدين الكلام.'];
const BOT_FREE_C = ['الأسئلة دي بتضيع وقتنا. أنا بريء.', 'بتتهموني من غير دليل واحد؟ غريبة.', 'روحوا دوروا على اللي فعلا عمل كده.', 'قلت كل اللي أعرفه، ومش هكرره.'];

function newRoom(code) { return { code, mode: 'who', phase: 'lobby', players: {}, host: null, bots: [], chat: [], score: {}, matches: 0, last: -1, M: null, result: null, created: Date.now() } }

const seatOf = (M, id) => M.seats.find(s => s.id === id);
const nameOf = (M, id) => (seatOf(M, id) || {}).name || '؟';
const dets = M => M.seats.filter(s => s.role === 'det');
const crimSeat = M => M.seats.find(s => s.role === 'crim');
function sys(room, text) { room.chat.push({ s: 1, text }); if (room.chat.length > 150) room.chat.shift() }
function pub(room, text) { room.M.log.push({ s: 1, text }); }

// ---------- بدء المباراة ----------
function seatsFor(room) {
  const hs = Object.values(room.players).filter(p => p.ws).map(p => ({ id: p.id, name: p.name, bot: false }));
  return hs.concat(room.bots.map(b => ({ id: b.id, name: b.name, bot: true })));
}
function startMatch(room) {
  const seats = seatsFor(room); if (seats.length !== 3) return false;
  const roles = shuf(['det', 'det', 'crim']);
  seats.forEach((s, i) => { s.role = roles[i] });
  let si; do { si = Math.floor(Math.random() * SC.length) } while (SC.length > 1 && si === room.last); room.last = si;
  room.matches++;
  const M = room.M = { n: room.matches, sc: SC[si], seats, crime: null, round: 0, sub: 'build', deadline: Date.now() + 80000, log: [], sched: {}, shown: [], qa: [], qid: 1, qleft: {}, ready: {}, used: {}, votes: {}, hides: [], plants: [], traceGone: false, flagged: new Set(), evn: 1, alibi: {}, acted: false };
  room.phase = 'play'; room.result = null;
  pub(room, 'بدأت المباراة ' + M.n + ': ' + M.sc.title + '. الأدوار اتوزعت بشكل سري.');
  const c = crimSeat(M); if (c.bot) setTimeout(() => { if (room.M === M && M.sub === 'build') botBuild(room) }, 2500 / F);
  return true;
}
function botBuild(room) {
  const M = room.M, sc = M.sc; const place = Math.floor(Math.random() * 5);
  const covers = [0, 1, 2, 3, 4].filter(i => i !== place);
  build(room, { weapon: Math.floor(Math.random() * 3), method: Math.floor(Math.random() * 3), place, cover: pick(covers) }); bc(room);
}
function build(room, ch) {
  const M = room.M; if (M.sub !== 'build') return;
  const sc = M.sc, w = +ch.weapon, me = +ch.method, pl = +ch.place, cv = +ch.cover;
  if (!(w >= 0 && w < 3 && me >= 0 && me < 3 && pl >= 0 && pl < 5 && cv >= 0 && cv < 5 && cv !== pl)) return false;
  M.crime = { w, me, pl, cv };
  const c = crimSeat(M), ds = dets(M);
  const others = shuf([0, 1, 2, 3, 4].filter(i => i !== pl));
  M.alibi[ds[0].id] = others[0]; M.alibi[ds[1].id] = others[1]; M.alibi[c.id] = cv;
  const P = sc.places, ev = [];
  const mk = (title, desc, extra) => Object.assign({ id: 'e' + (M.evn++), title, desc, kind: 'real', lab: null, log: null }, extra || {});
  const tod = mk('تقرير الطبيب الشرعي', 'الوفاة حصلت قرب الساعة ' + TIME + '. وده الوقت اللي كل الأسئلة بتتركز عليه.');
  const scene = mk('مسرح الجريمة: ' + P[pl], 'اتحدد إن الجريمة حصلت في ' + P[pl] + '. آثار عراك واضحة في المكان.', { place: pl });
  const wp = mk(sc.weapons[w].t, sc.weapons[w].d), mt = mk(sc.methods[me].t, sc.methods[me].d);
  const logs = [0, 1, 2, 3, 4].map(i => {
    let present = [], d;
    if (i === pl) { d = 'شخص واحد اتسجل داخل المكان قرب ' + TIME + '، من غير ما حد يتعرف عليه.'; present = []; }
    else {
      const who = ds.filter(s => M.alibi[s.id] === i);
      if (who.length) { present = who.map(s => s.id); d = who.map(s => s.name).join(' و') + ' اتسجل جوه المكان من ٩:٠٠ لحد ١٠:٠٠ ومن غير ما يخرج.'; }
      else d = 'المكان كان فاضي وقت الجريمة، ومفيش حد اتسجل جواه.';
    }
    return mk('سجل مراقبة: ' + P[i], d, { log: { place: i, present, crime: i === pl } });
  });
  const L = shuf(logs);
  M.sched = { 1: [tod, scene, L[0]], 2: [wp, mt, L[1], L[2]], 3: [L[3], L[4]] };
  M.trace = sc.methods[me].tr;
  for (const s of M.seats) M.qleft[s.id] = 0;
  M.round = 1; M.sub = 'act'; M.deadline = Date.now() + 50000; M.acted = false;
  pub(room, 'الجولة 1 من 3. المجرم بيتحرك في السر...');
  if (c.bot) setTimeout(() => { if (room.M === M && M.sub === 'act') botAct(room) }, 2500 / F);
  return true;
}

// ---------- حركة المجرم ----------
function pendingItems(M) { const r = []; for (let k = M.round; k <= 3; k++) for (const e of (M.sched[k] || [])) if (e.title !== 'تقرير الطبيب الشرعي') r.push(e); return r }
function act(room, m) {
  const M = room.M; if (M.sub !== 'act' || M.acted) return;
  const c = crimSeat(M), P = M.sc.places;
  if (m.kind === 'hide') {
    if (m.id === 'trace') { if (M.traceGone) return; M.traceGone = true; M.hides.push('trace') }
    else {
      const it = pendingItems(M).find(e => e.id === m.id); if (!it) return;
      for (const k in M.sched) M.sched[k] = M.sched[k].filter(e => e !== it);
      M.hides.push(it);
    }
  } else if (m.kind === 'plant') {
    let it;
    if (m.what === 'alibi') it = { id: 'e' + (M.evn++), title: 'سجل مراقبة: ' + P[M.crime.cv], desc: c.name + ' اتسجل جوه المكان من ٩:٠٠ لحد ١٠:٠٠ ومن غير ما يخرج.', kind: 'fake', lab: null, log: { place: M.crime.cv, present: [c.id], crime: false } };
    else if (m.what === 'frame') { const d = seatOf(M, m.target); if (!d || d.role !== 'det') return; it = { id: 'e' + (M.evn++), title: 'بصمة ' + d.name, desc: 'بصمة ' + d.name + ' اتلقت على ' + M.sc.weapons[M.crime.w].n + '.', kind: 'fake', lab: null, log: null, frame: d.id } }
    else return;
    (M.sched[M.round] = M.sched[M.round] || []).push(it); M.plants.push(it);
  } else if (m.kind !== 'skip') return;
  M.acted = true; reveal(room);
}
function botAct(room) {
  const M = room.M, c = crimSeat(M), r = Math.random();
  const pend = pendingItems(M);
  const coverLog = pend.find(e => e.log && e.log.place === M.crime.cv);
  if (M.round === 1 && r < 0.5) act(room, { kind: 'plant', what: 'alibi' });
  else if (coverLog && r < 0.8) act(room, { kind: 'hide', id: coverLog.id });
  else if (r < 0.6) act(room, { kind: 'plant', what: 'frame', target: pick(dets(M)).id });
  else if (!M.traceGone && r < 0.8) act(room, { kind: 'hide', id: 'trace' });
  else act(room, { kind: 'skip' });
  bc(room);
}

// ---------- كشف الأدلة وجولة الأسئلة ----------
function reveal(room) {
  const M = room.M;
  for (const e of (M.sched[M.round] || [])) { e.r = M.round; M.shown.push(e) }
  pub(room, 'الجولة ' + M.round + ': ظهر ' + (M.sched[M.round] || []).length + ' دليل جديد. وبدأ الاستجواب المفتوح.');
  M.sub = 'qa'; M.deadline = Date.now() + 150000; M.ready = {};
  for (const s of M.seats) M.qleft[s.id] = s.role === 'det' ? 3 : 2;
  const rd = M.round;
  for (const s of M.seats) if (s.bot) { M.ready[s.id] = false; botQA(room, s, rd) }
}
function randomQ(M, s) {
  const k = pick(['where', 'where', 'saw', 'rel', 'saw']);
  if (k === 'where') return { k };
  if (k === 'rel') return { k };
  return { k: 'saw', place: Math.floor(Math.random() * 5) };
}
function botQA(room, s, rd) {
  const M = room.M; const n = s.role === 'det' ? 3 : 2;
  const others = M.seats.filter(x => x.id !== s.id);
  for (let i = 0; i < n; i++) setTimeout(() => {
    if (room.M !== M || M.round !== rd || M.sub !== 'qa') return;
    let q = randomQ(M, s), to = pick(others).id;
    if (s.role === 'det' && i === 0) { q = { k: 'where' }; to = others[(rd) % 2].id }
    ask(room, s.id, to, q); bc(room);
  }, (4000 + i * 5000 + Math.random() * 4000) / F);
  setTimeout(() => {
    if (room.M !== M || M.round !== rd || M.sub !== 'qa') return;
    if (s.role === 'det') {
      if (!M.used['lab' + s.id] && rd >= 2 && M.shown.length) botLab(room, s);
      if (!M.used['srch' + s.id] && rd >= 2) { const t = M.seats.filter(x => x.id !== s.id); search(room, s.id, pick(t).id) }
    }
    M.ready[s.id] = true; maybeEnd(room); bc(room);
  }, (4000 + n * 5000 + 6000) / F);
}
function botLab(room, s) {
  const M = room.M; const cand = M.shown.filter(e => !e.lab);
  if (!cand.length) return;
  const fr = cand.find(e => e.frame) || pick(cand); lab(room, s.id, fr.id);
}
function ask(room, from, to, q) {
  const M = room.M; if (!M || M.sub !== 'qa') return false;
  if (from === to || !seatOf(M, to) || !M.qleft[from] || M.qleft[from] < 1) return false;
  const e = { id: M.qid++, from, to, r: M.round, q: { k: q.k, place: q.k === 'saw' ? Math.max(0, Math.min(4, +q.place || 0)) : undefined, text: q.k === 'free' ? clean(q.text, 140) : undefined }, a: null };
  if (!['where', 'saw', 'rel', 'free'].includes(e.q.k)) return false;
  if (e.q.k === 'free' && !e.q.text) return false;
  M.qleft[from]--; M.qa.push(e);
  const t = seatOf(M, to);
  if (t.bot) setTimeout(() => { if (room.M === M && e.a === null) { botAnswer(room, t, e); bc(room) } }, (1800 + Math.random() * 1800) / F);
  return true;
}
function truth(M, s) { // الحقيقة الفعلية لمكان كل لاعب
  return s.role === 'crim' ? M.crime.pl : M.alibi[s.id];
}
function botAnswer(room, s, e) {
  const M = room.M, crim = s.role === 'crim', k = e.q.k;
  if (k === 'where') e.a = { place: crim ? M.crime.cv : M.alibi[s.id] };
  else if (k === 'rel') e.a = { opt: crim ? 0 : Math.floor(Math.random() * 3) };
  else if (k === 'free') e.a = { text: pick(crim ? BOT_FREE_C : BOT_FREE_D) };
  else if (k === 'saw') {
    const P = e.q.place;
    if (crim) {
      if (P === M.crime.cv) e.a = { saw: null };
      else { const o = M.seats.filter(x => x.id !== s.id); e.a = { saw: Math.random() < .5 ? null : pick(o).id } }
    } else {
      const who = dets(M).filter(x => x.id !== s.id && M.alibi[x.id] === P)[0];
      e.a = { saw: who ? who.id : null };
    }
  }
}
function answer(room, seatId, qid, a) {
  const M = room.M; const e = M.qa.find(x => x.id === qid); if (!e || e.to !== seatId || e.a !== null) return false;
  const k = e.q.k;
  if (k === 'where') { const p = +a.place; if (!(p >= 0 && p < 5)) return false; e.a = { place: p } }
  else if (k === 'rel') { const o = +a.opt; if (!(o >= 0 && o < 3)) return false; e.a = { opt: o } }
  else if (k === 'free') { const t = clean(a.text, 160); if (!t) return false; e.a = { text: t } }
  else if (k === 'saw') { const v = a.saw; if (v !== null && !seatOf(M, v)) return false; e.a = { saw: v === seatId ? null : v } }
  return true;
}
// ⚠️ تناقض مع الأدلة المعروضة
function flagOf(M, e) {
  if (!e.a || e.a === 'refused') return false;
  const k = e.q.k;
  if (k === 'where') return claimFlag(M, e.to, e.a.place);
  if (k === 'saw') {
    const P = e.q.place, v = e.a.saw; if (v === null || v === undefined) return false;
    const lg = M.shown.filter(x => x.log && x.log.place === P && x.kind === 'real' && !x.log.crime && x.lab !== 'fake')[0]; if (!lg) return false;
    return !lg.log.present.includes(v);
  }
  return false;
}
function claimFlag(M, who, place) {
  const real = M.shown.find(x => x.kind === 'real' && x.log && x.log.place === place && !x.log.crime);
  if (!real) return false;
  if (real.log.present.includes(who)) return false;
  const sup = M.shown.find(x => x.log && x.log.place === place && x.log.present.includes(who) && x.lab !== 'fake' && x.kind !== 'real');
  if (sup) return false;
  return true;
}
function lab(room, seatId, evId) {
  const M = room.M; const s = seatOf(M, seatId); if (!s || s.role !== 'det' || M.sub !== 'qa' || M.used['lab' + seatId]) return false;
  const e = M.shown.find(x => x.id === evId); if (!e || e.lab) return false;
  M.used['lab' + seatId] = true; e.lab = e.kind;
  pub(room, '🧪 ' + s.name + ' فحص "' + e.title + '" في المعمل: ' + (e.kind === 'fake' ? 'الدليل ده مزروع ومضروب!' : 'الدليل أصلي.'));
  return true;
}
function search(room, seatId, tid) {
  const M = room.M; const s = seatOf(M, seatId), t = seatOf(M, tid); if (!s || !t || s.role !== 'det' || tid === seatId || M.sub !== 'qa' || M.used['srch' + seatId]) return false;
  M.used['srch' + seatId] = true;
  if (t.role === 'crim' && !M.traceGone) {
    const e = { id: 'e' + (M.evn++), title: 'عُثر مع ' + t.name, desc: M.trace, kind: 'real', lab: null, log: null, r: M.round, traceOn: t.id };
    M.shown.push(e); pub(room, '🔍 ' + s.name + ' فتّش ' + t.name + ' ولقى حاجة مشبوهة: ' + M.trace);
  } else pub(room, '🔍 ' + s.name + ' فتّش ' + t.name + ' ولقى حاجات عادية بس.');
  return true;
}
function maybeEnd(room) {
  const M = room.M; if (!M || M.sub !== 'qa') return;
  const humans = M.seats.filter(s => !s.bot);
  if (M.qa.some(e => e.a === null && (seatOf(M, e.to).bot || (room.players[e.to] || {}).ws))) return;
  if (M.seats.every(s => M.ready[s.id] || (!s.bot && !(room.players[s.id] || {}).ws)) && humans.length) endRound(room);
}
function endRound(room) {
  const M = room.M; if (M.sub !== 'qa') return;
  for (const e of M.qa) if (e.a === null) e.a = 'refused';
  if (M.round < 3) {
    M.round++; M.sub = 'act'; M.acted = false; M.deadline = Date.now() + 50000;
    pub(room, 'الجولة ' + M.round + ' من 3. المجرم بيتحرك في السر...');
    const c = crimSeat(M); if (c.bot) { const m0 = M, r0 = M.round; setTimeout(() => { if (room.M === m0 && m0.sub === 'act' && m0.round === r0) botAct(room) }, 2500 / F) }
  } else {
    M.sub = 'vote'; M.deadline = Date.now() + 80000; M.votes = {};
    pub(room, 'انتهت الجولات. وقت التصويت: مين المجرم؟');
    for (const s of M.seats) if (s.bot) { const m0 = M; setTimeout(() => { if (room.M === m0 && m0.sub === 'vote') { botVote(room, s); bc(room) } }, (3000 + Math.random() * 5000) / F) }
  }
}
function suspicion(M, viewer, tid) {
  let sc = 0;
  for (const e of M.qa) if (e.to === tid && flagOf(M, e)) sc += 4;
  for (const e of M.shown) {
    if (e.traceOn === tid) sc += 10;
    if (e.frame === tid && e.lab === 'fake') sc -= 8;
    if (e.frame === tid && e.lab !== 'fake') sc += 3;
  }
  const mine = M.alibi[viewer];
  for (const e of M.qa) if (e.a && e.a.place === mine && e.to === tid && e.q.k === 'where') sc += 8;
  return sc + Math.random() * 2;
}
function botVote(room, s) {
  const M = room.M; if (M.votes[s.id]) return;
  const o = M.seats.filter(x => x.id !== s.id);
  let t;
  if (s.role === 'det') { const a = suspicion(M, s.id, o[0].id), b = suspicion(M, s.id, o[1].id); t = a >= b ? o[0] : o[1] }
  else { t = pick(o.filter(x => x.role === 'det')) }
  vote(room, s.id, t.id);
}
function vote(room, sid, tid) {
  const M = room.M; if (!M || M.sub !== 'vote' || sid === tid || !seatOf(M, tid) || M.votes[sid]) return false;
  M.votes[sid] = tid;
  if (M.seats.every(s => M.votes[s.id])) finish(room);
  return true;
}
function finish(room) {
  const M = room.M; if (M.sub === 'done') return;
  for (const s of M.seats) if (!M.votes[s.id]) { const o = M.seats.filter(x => x.id !== s.id); M.votes[s.id] = pick(o).id }
  const cnt = {}; for (const t of Object.values(M.votes)) cnt[t] = (cnt[t] || 0) + 1;
  const arr = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const arrested = arr.length && (arr.length === 1 || arr[0][1] > arr[1][1]) ? arr[0][0] : null;
  const c = crimSeat(M), ds = dets(M);
  const caught = arrested === c.id;
  const real = M.shown.filter(e => e.kind === 'real').length;
  const fakeExp = M.shown.filter(e => e.kind === 'fake' && e.lab === 'fake').length;
  const flagsOnCrim = M.qa.filter(e => e.to === c.id && flagOf(M, e)).length;
  const good = ds.filter(d => M.votes[d.id] === c.id).length, bad = ds.length - good;
  const hides = M.hides.length, plantsOk = M.plants.filter(p => p.lab !== 'fake').length;
  const Td = real * 5 + fakeExp * 8 + flagsOnCrim * 5 + good * 15, Tc = hides * 8 + plantsOk * 10 + bad * 12;
  const pts = {}; for (const s of M.seats) pts[s.id] = 0;
  if (caught) { for (const d of ds) pts[d.id] += Math.round(Td / 2) + 20 }
  else { pts[c.id] += Tc + Math.round(Td / 2) + 30 }
  for (const d of ds) if (M.votes[d.id] !== c.id) pts[d.id] -= 8;
  for (const s of M.seats) {
    const key = s.bot ? 'bot:' + s.name : s.id; const r = room.score[key] = room.score[key] || { name: s.name, pts: 0, wins: 0, n: 0, bot: s.bot };
    r.name = s.name; r.pts += pts[s.id]; r.n++; if (pts[s.id] > 0) r.wins++;
  }
  M.sub = 'done'; room.phase = 'result';
  room.result = {
    caught, arrested, crim: c.id, Td, Tc, parts: { real, fakeExp, flagsOnCrim, good, bad, hides, plantsOk }, pts,
    crime: { weapon: M.sc.weapons[M.crime.w].n, method: M.sc.methods[M.crime.me].n, place: M.sc.places[M.crime.pl], cover: M.sc.places[M.crime.cv] },
    alibis: Object.fromEntries(M.seats.map(s => [s.id, M.sc.places[truth(M, s)]])),
    claimed: M.sc.places[M.crime.cv],
    fakes: M.shown.filter(e => e.kind === 'fake').map(e => e.title),
    hidden: M.hides.map(h => h === 'trace' ? 'الأثر اللي كان معاه' : h.title),
    votes: M.votes
  };
  sys(room, caught ? '⚖ اتقبض على ' + c.name + ' وكان هو المجرم!' : '⚖ المجرم ' + c.name + ' نجا من العدالة!');
}

// ---------- الحالة ----------
function state(room, p) {
  const st = { t: 'state', mode: 'who', code: room.code, phase: room.phase, you: p.id, host: room.host, chat: room.chat.slice(-60), matches: room.matches };
  st.players = Object.values(room.players).map(x => ({ id: x.id, name: x.name, on: !!x.ws })).concat(room.bots.map(b => ({ id: b.id, name: b.name, on: true, bot: true })));
  st.score = Object.values(room.score).sort((a, b) => b.pts - a.pts);
  const M = room.M; if (!M || room.phase === 'lobby') return st;
  const me = seatOf(M, p.id), P = M.sc.places;
  const left = Math.max(0, Math.round((M.deadline - Date.now()) / 1000));
  st.m = {
    n: M.n, title: M.sc.title, intro: M.sc.intro, victim: M.sc.victim, places: P, time: TIME, round: M.round, sub: M.sub, left,
    seats: M.seats.map(s => ({ id: s.id, name: s.name, bot: s.bot, ready: !!M.ready[s.id], voted: !!M.votes[s.id] })),
    shown: M.shown.map(e => ({ id: e.id, title: e.title, desc: e.desc, r: e.r, lab: e.lab })),
    qa: M.qa.map(e => ({ id: e.id, from: e.from, to: e.to, r: e.r, q: e.q, a: e.a, flag: flagOf(M, e) })),
    log: M.log.slice(-50), qleft: M.qleft, hasCfg: !!M.crime
  };
  if (me) {
    const crim = me.role === 'crim';
    st.m.me = { id: me.id, role: me.role, labUsed: !!M.used['lab' + me.id], srchUsed: !!M.used['srch' + me.id], ready: !!M.ready[me.id], voted: M.votes[me.id] || null };
    if (M.crime) {
      st.m.me.place = crim ? M.crime.cv : M.alibi[me.id];
      if (crim) {
        st.m.me.crime = { weapon: M.sc.weapons[M.crime.w].n, method: M.sc.methods[M.crime.me].n, place: P[M.crime.pl], cover: P[M.crime.cv] };
        st.m.me.trace = M.traceGone ? null : M.trace; st.m.me.acted = M.acted;
        st.m.me.pending = pendingItems(M).map(e => ({ id: e.id, title: e.title, log: !!e.log, place: e.log ? e.log.place : null }));
        st.m.me.plants = M.plants.length; st.m.me.hides = M.hides.length;
      }
    }
    if (crim && M.sub === 'build') st.m.opts = { weapons: M.sc.weapons.map(w => w.n), methods: M.sc.methods.map(w => w.n), places: P };
  }
  if (room.phase === 'result') st.result = room.result;
  return st;
}
function bc(room) { room.bcast && room.bcast(room) }

// ---------- الرسائل ----------
function msg(room, p, m) {
  const M = room.M;
  if (m.t === 'chat') { const text = clean(m.text); if (!text) return; room.chat.push({ n: p.name, text }); if (room.chat.length > 150) room.chat.shift(); return bc(room) }
  if (room.phase === 'lobby' || room.phase === 'result') {
    if (m.t === 'addbot' && p.id === room.host) {
      const humans = Object.values(room.players).filter(x => x.ws).length; if (humans + room.bots.length >= 3) return;
      const used = room.bots.map(b => b.name); const nm = pick(BOTN.filter(x => !used.includes(x)));
      room.bots.push({ id: 'bot' + Math.random().toString(36).slice(2, 7), name: nm }); return bc(room)
    }
    if (m.t === 'rmbot' && p.id === room.host) { room.bots = room.bots.filter(b => b.id !== m.id); return bc(room) }
    if ((m.t === 'wstart' || m.t === 'wagain') && p.id === room.host) {
      if (!startMatch(room)) return send(p, 'لازم 3 لاعبين بالظبط (ضيف بوتات لو ناقص)');
      return bc(room)
    }
    return;
  }
  if (!M || !seatOf(M, p.id)) return;
  const s = seatOf(M, p.id);
  if (m.t === 'build' && s.role === 'crim') { if (!build(room, m)) return send(p, 'اختيارك مش مظبوط'); return bc(room) }
  if (m.t === 'act' && s.role === 'crim') { act(room, m); return bc(room) }
  if (m.t === 'ask') { if (!ask(room, p.id, m.to, m.q || {})) return send(p, 'مش متاح دلوقتي'); return bc(room) }
  if (m.t === 'ans') { if (!answer(room, p.id, +m.id, m.a || {})) return; return bc(room) }
  if (m.t === 'lab') { if (!lab(room, p.id, m.id)) return send(p, 'مش متاح: فحص المعمل مرة واحدة بس'); return bc(room) }
  if (m.t === 'search') { if (!search(room, p.id, m.to)) return send(p, 'مش متاح: التفتيش مرة واحدة بس'); return bc(room) }
  if (m.t === 'ready' && M.sub === 'qa') { M.ready[p.id] = true; maybeEnd(room); return bc(room) }
  if (m.t === 'vote') { if (!vote(room, p.id, m.to)) return; return bc(room) }
}
function send(p, text) { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'toast', text })) }

// ---------- المؤقت ----------
function tick(rooms) {
  const now = Date.now();
  for (const c in rooms) {
    const room = rooms[c]; if (room.mode !== 'who' || room.phase !== 'play' || !room.M) continue;
    const M = room.M; if (now < M.deadline) continue;
    if (M.sub === 'build') { botBuild(room); bc(room) }
    else if (M.sub === 'act') { act(room, { kind: 'skip' }); bc(room) }
    else if (M.sub === 'qa') { endRound(room); bc(room) }
    else if (M.sub === 'vote') { finish(room); bc(room) }
  }
}
function cfg() { return { mode: 'who', title: 'مين المجرم؟' } }
module.exports = { newRoom, state, msg, tick, cfg, SC };
