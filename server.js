const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const D=require('./data.js');
const PORT=process.env.PORT||3000;
const html=()=>fs.readFileSync(path.join(__dirname,'index.html'));
const srv=http.createServer((q,r)=>{
  if(q.url==='/health'){r.end('ok');return}
  if(q.url==='/rooms'){const l=Object.values(rooms).filter(x=>x.phase==='lobby'&&Object.keys(x.players).length<4&&Object.values(x.players).some(p=>p.ws)).map(x=>({code:x.code,host:(x.players[x.host]||{}).name,n:Object.keys(x.players).length,title:(CASES.find(c=>c.id===x.caseId)||CASES[0]).title}));r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify(l));return}
  r.writeHead(200,{'content-type':'text/html; charset=utf-8'});r.end(html());
});
const wss=new WebSocketServer({server:srv,maxPayload:8192});
const rooms={};
const rid=()=>Math.random().toString(36).slice(2,10);
const mkcode=()=>{let c;do{c=String(Math.floor(1000+Math.random()*9000))}while(rooms[c]);return c};
const clean=s=>String(s||'').replace(/[<>&"]/g,'').trim().slice(0,200);
const CASES=require('./cases.js');
const cfg={R:Object.fromEntries(Object.entries(D.R).map(([k,r])=>[k,{n:r.n,bot:r.bot,d:r.d,o:r.o}])),cases:CASES.map(c=>({id:c.id,title:c.title,place:c.place,level:c.level,blurb:c.blurb}))};
const caseOf=room=>CASES.find(c=>c.id===room.caseId)||CASES[0];
function send(ws,m){if(ws&&ws.readyState===1)ws.send(JSON.stringify(m))}
function state(room,p){
  const c=caseOf(room);
  const st={t:'state',code:room.code,phase:room.phase,you:p.id,host:room.host,caseId:c.id,
    players:Object.values(room.players).map(x=>({id:x.id,name:x.name,role:x.role,on:!!x.ws,done:x.done.length,vote:room.phase==='play'?(x.vote!=null):false})),
    notes:room.notes.map(n=>n.t),chat:room.chat.slice(-60),mydone:p.done,strikes:room.strikes||0,cleared:room.cleared||[],
    botRoles:Object.keys(D.R).filter(k=>!Object.values(room.players).some(x=>x.role===k)),
    result:room.result||null};
  if(room.phase!=='lobby'){
    st.cs={title:c.title,place:c.place,intro:c.intro,suspects:c.suspects.map(s=>({n:s.n,t:s.t,o:s.o}))};
    if(p.role&&c.tasks[p.role])st.myTasks=c.tasks[p.role].map(t=>t[0]);
    st.unlockAt=8;
  }
  return st;
}
function bcast(room){for(const p of Object.values(room.players))send(p.ws,state(room,p))}
function sys(room,text){room.chat.push({s:1,text});}
function note(room,t,k){if(!room.notes.some(n=>n.t===t))room.notes.push({t,k})}
function unclaimed(room){return Object.keys(D.R).filter(k=>!Object.values(room.players).some(x=>x.role===k))}
function finish(room){
  const c=caseOf(room);
  const ps=Object.values(room.players);
  const i=ps[0].vote;
  const keys=room.notes.filter(n=>n.k);
  const ok=i===c.killer,enough=keys.length>=c.need;
  ps.forEach(x=>x.vote=null);
  if(ok&&enough){
    room.phase='over';
    const sc=Math.max(0,100-room.strikes*25+keys.length*8);
    room.result={win:true,accused:i,sc,rank:sc>=160?'رائد':sc>=130?'نقيب':'ملازم أول',keys:keys.map(n=>n.t),sol:c.solution,need:c.need,strikes:room.strikes};
    return;
  }
  room.strikes++;
  if(ok){sys(room,'اتهامكم صح بس النيابة رفضت القضية: الأدلة الحاسمة ناقصة ('+keys.length+' من '+c.need+' مطلوبين). كملوا المهام الأول. ضربة على الفريق ('+room.strikes+'/2)')}
  else{room.cleared.push(i);sys(room,c.suspects[i].n+' طلع بريء واتبرّأ. اتهام غلط، ضربة على الفريق ('+room.strikes+'/2)')}
  if(room.strikes>=2){
    room.phase='over';
    room.result={win:false,accused:i,ok,sc:0,keys:keys.map(n=>n.t),sol:c.solution,need:c.need,strikes:room.strikes,total:keys.length};
  }
}
function msg(ws,m){
  if(m.t==='create'||m.t==='join'){
    let room,p;
    const name=clean(m.name).slice(0,20)||'لاعب';
    if(m.t==='create'){room={code:mkcode(),phase:'lobby',players:{},notes:[],chat:[],botLevel:0,bulletin:0,strikes:0,cleared:[],caseId:CASES[0].id,created:Date.now()};rooms[room.code]=room}
    else{room=rooms[clean(m.code)];if(!room)return send(ws,{t:'err',e:'الكود ده مش موجود'});
      if(m.token&&room.players[m.token]){p=room.players[m.token]}
      else{if(room.phase!=='lobby')return send(ws,{t:'err',e:'اللعبة بدأت بالفعل'});
        if(Object.keys(room.players).length>=4)return send(ws,{t:'err',e:'الغرفة كاملة'});}}
    if(!p){const id=rid();p=room.players[id]={id,name,role:null,done:[],vote:null};if(!room.host)room.host=id;sys(room,name+' دخل الغرفة')}
    p.ws=ws;ws.room=room;ws.pid=p.id;
    send(ws,{t:'hello',cfg,token:p.id,code:room.code});bcast(room);return;
  }
  const room=ws.room,p=room&&room.players[ws.pid];if(!p)return;
  if(m.t==='role'&&room.phase==='lobby'){
    if(m.role===null){p.role=null}
    else if(D.R[m.role]&&!Object.values(room.players).some(x=>x.role===m.role&&x!==p))p.role=m.role;
    bcast(room);
  }else if(m.t==='start'&&room.phase==='lobby'&&p.id===room.host){
    if(Object.values(room.players).some(x=>!x.role))return send(ws,{t:'err',e:'كل لاعب لازم يختار دور'});
    room.phase='play';
    for(const x of Object.values(room.players))x.done=[];
    sys(room,'بدأ التحقيق!');bcast(room);
  }else if(m.t==='case'&&room.phase==='lobby'&&p.id===room.host){
    if(CASES.some(c=>c.id===m.id)){room.caseId=m.id;bcast(room)}
  }else if(m.t==='task'&&room.phase==='play'){
    const c=caseOf(room),i=m.i|0,list=c.tasks[p.role];if(!list||!list[i]||p.done.includes(i))return;
    if(i===4&&room.notes.length<8)return send(ws,{t:'err',e:'المهمة دي مقفولة لحد ما الفريق يجمع ٨ ملاحظات على الأقل في الدفتر'});
    p.done.push(i);const t=list[i];
    note(room,D.R[p.role].n+' ('+p.name+') - '+t[0]+': '+t[1],t[2]);
    sys(room,p.name+' خلص مهمة: '+t[0]);
    const maxd=Math.max(...Object.values(room.players).map(x=>x.done.length));
    while(room.botLevel<maxd&&room.botLevel<5){
      const L=room.botLevel;
      for(const k of unclaimed(room)){const cc=c.tasks[k][L];note(room,D.R[k].bot+' (بوت) - '+cc[0]+': '+cc[1],cc[2]);sys(room,D.R[k].bot+' بلّغ عن '+cc[0])}
      room.botLevel++;
    }
    while(c.bulletins[room.bulletin]&&room.notes.length>=c.bulletins[room.bulletin][0]){
      const bl=c.bulletins[room.bulletin];note(room,'بلاغ جديد: '+bl[1],bl[2]);sys(room,'وصل بلاغ جديد من القسم');room.bulletin++;
    }
    send(ws,{t:'flash',text:D.R[p.role].n+' - '+t[0]+': '+t[1]});bcast(room);
  }else if(m.t==='vote'&&room.phase==='play'){
    const i=m.i|0;if(!caseOf(room).suspects[i]||(room.cleared||[]).includes(i))return;p.vote=i;
    const ps=Object.values(room.players);
    sys(room,p.name+' صوّت');
    if(ps.every(x=>x.vote!=null)){
      const vs=new Set(ps.map(x=>x.vote));
      if(vs.size===1)finish(room);
      else{sys(room,'الأصوات مختلفة، ناقشوا وصوتوا تاني');ps.forEach(x=>x.vote=null)}
    }
    bcast(room);
  }else if(m.t==='unvote'&&room.phase==='play'){p.vote=null;bcast(room)}
  else if(m.t==='rtc'){const q=room.players[m.to];if(q&&q.ws&&m.d&&typeof m.d==='object')send(q.ws,{t:'rtc',from:p.id,d:m.d})}
  else if(m.t==='vjoin'||m.t==='vleave'){for(const q of Object.values(room.players))if(q.id!==p.id)send(q.ws,{t:m.t,from:p.id})}
  else if(m.t==='chat'){const text=clean(m.text);if(!text)return;room.chat.push({n:p.name,text});if(room.chat.length>200)room.chat.shift();bcast(room)}
  else if(m.t==='again'&&room.phase==='over'&&p.id===room.host){
    room.phase='lobby';room.notes=[];room.botLevel=0;room.bulletin=0;room.strikes=0;room.cleared=[];room.result=null;
    for(const x of Object.values(room.players)){x.done=[];x.vote=null;x.role=null}
    sys(room,'جولة جديدة');bcast(room);
  }
}
wss.on('connection',ws=>{
  ws.on('message',d=>{try{msg(ws,JSON.parse(d))}catch(e){}});
  ws.on('close',()=>{const r=ws.room;if(!r)return;const p=r.players[ws.pid];if(p&&p.ws===ws){p.ws=null;bcast(r)}});
});
setInterval(()=>{const now=Date.now();for(const c in rooms){const r=rooms[c];if(!Object.values(r.players).some(p=>p.ws)&&now-r.created>6*3600e3)delete rooms[c]}},600000);
srv.listen(PORT,()=>console.log('up',PORT));
