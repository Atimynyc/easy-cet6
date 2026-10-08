"use strict";
/* ================= 题库数据：优先加载外部真题数据文件 papers-data.js ================= */
const HAS_REAL_PAPERS = !!(window.CET6_HAS_REAL_PAPERS);
const PAPERS = (window.PAPERS_DATA && PAPERS_DATA.length)? PAPERS_DATA.slice().sort((a,b)=>{
  const pa=a.id.split('-').map(Number), pb=b.id.split('-').map(Number);
  return (pb[0]-pa[0])||(pb[1]-pa[1])||(pb[2]-pa[2]);
}) : [];
if(!PAPERS.length){ console.error('题库未加载'); }

/* 多套真题归一化：单元 ID 加套次前缀，避免跨套冲突 */
PAPERS.forEach(p=>p.units.forEach(u=>{ if(u.id.indexOf(p.id)!==0) u.id=p.id+'-'+u.id; }));

const WORDS = [];

const ATTEMPTS = [];

const STATS = {
  overall:'--', brushed:0, days:1, hours:'0h0m',
  trend:[],
  byType:[],
  speed:[],
  overTimes:0, overAvg:'--',
  unitDetail:[]
};

/* ================= 状态 ================= */
const S = {
  queue:[], queueIdx:0, queueDone:0, queueDoneSet:{},
  learned:{} , // 'unit:idx' -> true
  collected:{},
  words:WORDS.map(w=>({...w})),
  attempts:ATTEMPTS.map(a=>({...a})),
  answers:[],
  drafts:{}, // 'unit:idx' -> text (writing/translate)
  settings:{slot:20, w1:100, w2:40, w3:20, examTimer:true},
  checkinDates:[],
  dim:'time', year:PAPERS[0].id, bankOpen:null,
  learn:null, exam:null, result:null
};
PAPERS[0].units.forEach(u=>{
  for(let i=0;i<u.total;i++){ if(i<u.learned) S.learned[u.id+':'+i]=true; }
});

function answerCount(unitId, idx){
  const key=unitId+':'+idx;
  let n=0;
  for(let i=0;i<(S.answers||[]).length;i++){
    const a=S.answers[i];
    if(a && a.unitId===unitId && a.idx===idx) n++;
  }
  if(n===0 && S.learned[key]) n=1;
  return n;
}
function itemWeight(unitId, idx){
  const n=answerCount(unitId, idx);
  if(n<=0) return S.settings.w1||100;
  if(n===1) return S.settings.w2||40;
  return S.settings.w3||20;
}
/* 今日队列：按新题/二刷/三刷权重抽样，条数由每日档位决定 */
function buildQueue(){
  const p=PAPERS.find(x=>x.id===S.year)||PAPERS[0];
  const cap={10:4,20:8,30:12}[S.settings.slot]||8;
  const pool=[];
  for(const u of p.units){
    for(let i=0;i<u.total;i++){
      const n=answerCount(u.id,i);
      pool.push({unit:u.id, idx:i, tag:n>0?'复习':'新题', w:itemWeight(u.id,i)});
    }
  }
  const q=[];
  const left=pool.slice();
  while(q.length<cap && left.length){
    let sum=0;
    for(let i=0;i<left.length;i++) sum+=left[i].w;
    if(sum<=0) break;
    let r=Math.random()*sum, pick=0;
    for(let i=0;i<left.length;i++){ r-=left[i].w; if(r<=0){ pick=i; break; } }
    const it=left.splice(pick,1)[0];
    q.push({unit:it.unit, idx:it.idx, tag:it.tag});
  }
  return q;
}
function reshuffleQueue(){
  S.queue=buildQueue();
  S.queueIdx=0;
  S.queueDone=0;
  S.queueDoneSet={};
}
S.queue=buildQueue();

/* ================= 工具 ================= */
const $=id=>document.getElementById(id);
let toastTimer=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1800); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtTime(sec){ const m=Math.floor(sec/60), s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }
function unitById(id){ for(const p of PAPERS){ const u=p.units.find(u=>u.id===id); if(u) return u; } return null; }
function curPaper(){ return PAPERS.find(p=>p.id===S.year)||PAPERS[0]; }
function paperOfUnit(id){ for(const p of PAPERS){ if(p.units.some(u=>u.id===id)) return p; } return PAPERS[0]; }
function itemById(unitId,idx){ const u=unitById(unitId); return u? u.items[idx] : null; }

function itemPassage(unit, it){
  if(it && it.passage) return it.passage;
  if(unit && unit.passage) return unit.passage;
  return '';
}



function isTextType(t){ return t==='writing'||t==='translate'; }
function draftKey(unitId, idx){ return unitId+':'+idx; }
function getDraft(unitId, idx){ return (S.drafts && S.drafts[draftKey(unitId,idx)]) || ''; }
function setDraft(unitId, idx, text){
  if(!S.drafts) S.drafts={};
  const k=draftKey(unitId, idx);
  const v=String(text==null?'':text);
  if(v.trim()) S.drafts[k]=v; else delete S.drafts[k];
  persist();
}
function audioSrcOf(it){
  if(!it) return '';
  if(typeof it.audio==='string' && it.audio.trim()) return it.audio.trim();
  if(typeof it.audioSrc==='string' && it.audioSrc.trim()) return it.audioSrc.trim();
  return '';
}
function blankNoOf(it, idx){
  const q=String((it&&it.q)||'');
  let m=q.match(/第\s*(\d+)\s*空/);
  if(m) return +m[1];
  m=q.match(/_{2,}(\d+)_{2,}/);
  if(m) return +m[1];
  return (idx==null?1:idx+1);
}
function answerFilled(v, type){
  if(v===undefined || v===null) return false;
  if(isTextType(type)) return String(v).trim().length>0;
  return true;
}
function renderAudioHtml(it){
  const src=audioSrcOf(it);
  if(src){
    return '<div class="audio-bar real"><button type="button" class="play" data-audio-play aria-label="播放"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg></button>'
      +'<audio id="q-audio" src="'+esc(src)+'" preload="metadata"></audio>'
      +'<span class="atime" id="audio-time">0:00 / --:--</span></div>';
  }
  return '<div class="audio-notice">本题暂无音频，请直接作答</div>';
}
function bindAudioPlayer(){
  const btn=document.querySelector('[data-audio-play]');
  const au=$('q-audio');
  if(!btn||!au) return;
  const timeEl=$('audio-time');
  const fmt=sec=>{
    if(!isFinite(sec)||sec<0) return '--:--';
    const s=Math.floor(sec);
    return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  };
  const sync=()=>{ if(timeEl) timeEl.textContent=fmt(au.currentTime)+' / '+fmt(au.duration); };
  au.addEventListener('loadedmetadata', sync);
  au.addEventListener('timeupdate', sync);
  au.addEventListener('ended', ()=>{ btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>'; });
  btn.onclick=()=>{
    if(au.paused){
      au.play().catch(()=>toast('音频无法播放，请检查文件路径'));
      btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
    } else {
      au.pause();
      btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>';
    }
  };
}
function passageHtml(pass, it, idx, type){
  if(!pass) return '';
  let s=wrapWords(esc(pass), it&&it.hl);
  if(type==='cloze'){
    const n=blankNoOf(it, idx);
    const re=new RegExp('_{2,}'+n+'_{2,}','g');
    s=s.replace(re, '<span class="blank-cur">___'+n+'___</span>');
  }
  return '<div class="q-passage">'+s.replace(/\n/g,'<br>')+'</div>';
}
function typeHintHtml(type, it, idx){
  if(type==='cloze') return '<div class="type-hint">选词填空 · 第 '+blankNoOf(it,idx)+' 空 · 对照篇章空格，从下方词库选词</div>';
  if(type==='longmatch') return '<div class="type-hint">长篇阅读 · 将题干句子匹配到篇章中的对应段落</div>';
  if(type==='writing') return '<div class="type-hint">写作 · 在文本框作答，提交后对照参考范文（不自动评分）</div>';
  if(type==='translate') return '<div class="type-hint">翻译 · 在文本框作答，提交后对照参考译文（不自动评分）</div>';
  return '';
}
function renderOptsHtml(opts, selected, answered, chosenExam){
  const bank=opts.length>=8;
  let h=bank?'<div class="word-bank">':'';
  opts.forEach((o,i)=>{
    const key=String.fromCharCode(65+i);
    let cls='opt'+(bank?' bank':'');
    if(answered!==undefined && answered!==null){
      if(o.r) cls+=' correct';
      else if(selected===i) cls+=' wrong';
    } else if(chosenExam!==undefined && chosenExam===i){
      cls+=' selected';
    } else if(selected===i){
      cls+=' selected';
    }
    const dis=(answered!==undefined && answered!==null)?'disabled':'';
    h+='<button type="button" class="'+cls+'" data-opt="'+i+'" '+dis+'>'
      +(bank?'':'<span class="opt-key">'+key+'</span>')
      +'<span>'+wrapWords(esc(o.t))+'</span></button>';
  });
  if(bank) h+='</div>';
  return h;
}
function draftAreaHtml(text, readonly, placeholder){
  return '<textarea class="draft-area" id="draft-area" '+(readonly?'readonly':'')
    +' placeholder="'+esc(placeholder||'在此作答…')+'">'
    +esc(text||'')+'</textarea>';
}

/* ================= 本地存储 easy-cet6-v1 ================= */
const STORE_KEY='easy-cet6-v1';
const SCHEMA_VERSION=1;
let persistTimer=null;
let persistWarned=false;
function todayStr(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function isPlainObj(v){ return !!v && typeof v==='object' && !Array.isArray(v); }
function recomputeUnitLearned(){
  PAPERS.forEach(p=>p.units.forEach(u=>{
    let n=0;
    for(let i=0;i<u.total;i++){ if(S.learned[u.id+':'+i]) n++; }
    u.learned=n;
  }));
}
function snapshot(){
  return {
    schemaVersion:SCHEMA_VERSION,
    learned:S.learned,
    collected:S.collected,
    words:S.words,
    attempts:S.attempts,
    answers:S.answers,
    drafts:S.drafts,
    settings:S.settings,
    queue:S.queue,
    queueIdx:S.queueIdx,
    queueDone:S.queueDone,
    queueDoneSet:S.queueDoneSet,
    year:S.year,
    checkinDates:S.checkinDates
  };
}
function persist(immediate){
  const write=()=>{
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(snapshot())); }
    catch(e){
      if(!persistWarned){ persistWarned=true; toast('本地存储写入失败，进度可能无法保存'); }
    }
  };
  if(immediate){ clearTimeout(persistTimer); persistTimer=null; write(); return; }
  clearTimeout(persistTimer);
  persistTimer=setTimeout(write,300);
}
function applySnapshot(data){
  S.learned=isPlainObj(data.learned)? data.learned : {};
  S.collected=isPlainObj(data.collected)? data.collected : {};
  S.words=Array.isArray(data.words)? data.words : [];
  S.attempts=Array.isArray(data.attempts)? data.attempts : [];
  S.answers=Array.isArray(data.answers)? data.answers : [];
  S.drafts=isPlainObj(data.drafts)? data.drafts : {};
  if(isPlainObj(data.settings)){
    S.settings={slot:20, w1:100, w2:40, w3:20, examTimer:true, ...data.settings};
    if(S.settings.slot!==10 && S.settings.slot!==20 && S.settings.slot!==30) S.settings.slot=20;
    S.settings.examTimer=!!S.settings.examTimer;
  }
  S.year=(data.year && PAPERS.some(p=>p.id===data.year))? data.year : PAPERS[0].id;
  S.checkinDates=Array.isArray(data.checkinDates)? data.checkinDates.filter(x=>typeof x==='string') : [];
  S.queueDoneSet=isPlainObj(data.queueDoneSet)? data.queueDoneSet : {};
  S.queueIdx=Number.isFinite(+data.queueIdx)? Math.max(0,+data.queueIdx) : 0;
  S.queueDone=Number.isFinite(+data.queueDone)? Math.max(0,+data.queueDone) : 0;
  const q=Array.isArray(data.queue)? data.queue.filter(it=>it && unitById(it.unit) && itemById(it.unit, it.idx)) : [];
  if(q.length){
    S.queue=q;
    if(S.queueDone>S.queue.length) S.queueDone=S.queue.length;
    if(S.queueIdx>S.queue.length) S.queueIdx=S.queue.length;
  } else {
    S.queue=buildQueue();
    S.queueIdx=0; S.queueDone=0; S.queueDoneSet={};
  }
  recomputeUnitLearned();
  rebuildStats();
}
function loadStore(){
  let raw;
  try{ raw=localStorage.getItem(STORE_KEY); }catch(e){ return false; }
  if(!raw) return false;
  let data;
  try{ data=JSON.parse(raw); }catch(e){
    try{ localStorage.removeItem(STORE_KEY); }catch(_){}
    toast('本地数据损坏，已重置');
    return false;
  }
  if(!data || data.schemaVersion!==SCHEMA_VERSION){
    try{ localStorage.removeItem(STORE_KEY); }catch(_){}
    toast('学习数据版本不兼容，已重置');
    return false;
  }
  applySnapshot(data);
  return true;
}
function markCheckin(){
  const t=todayStr();
  if(S.checkinDates.indexOf(t)<0) S.checkinDates.push(t);
}
function streakDays(){
  if(!S.checkinDates || !S.checkinDates.length) return 0;
  const set={};
  S.checkinDates.forEach(d=>{ if(d) set[d]=true; });
  let cur=todayStr(), n=0;
  while(set[cur]){
    n++;
    const p=cur.split('-').map(Number);
    const dt=new Date(p[0], p[1]-1, p[2]);
    dt.setDate(dt.getDate()-1);
    cur=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  }
  return n;
}
function parseRefSec(t){
  const m=String(t||'0:00').split(':');
  return (+m[0]||0)*60+(+m[1]||0);
}
function fmtHours(sec){
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60);
  if(h>0) return h+'h'+m+'m';
  return m+'m';
}
function recordAnswer(rec){
  if(!rec) return;
  S.answers.push({
    unitId:rec.unitId,
    idx:rec.idx,
    type:rec.type||'',
    correct:!!rec.correct,
    costSec:Math.max(0, +rec.costSec||0),
    ts:rec.ts||Date.now(),
    source:rec.source||'learn'
  });
  rebuildStats();
}
function rebuildStats(){
  const ans=S.answers||[];
  const brushed=ans.length;
  if(!brushed){
    STATS.overall='--'; STATS.brushed=0; STATS.days=Math.max(1, streakDays()||1);
    STATS.hours='0h0m'; STATS.trend=[]; STATS.byType=[]; STATS.speed=[];
    STATS.overTimes=0; STATS.overAvg='--'; STATS.unitDetail=[];
    if(S.checkinDates && S.checkinDates.length) STATS.days=Math.max(1, streakDays());
    return;
  }
  let ok=0, cost=0;
  const byDay={};
  const byType={};
  const byItem={};
  ans.forEach(a=>{
    if(a.correct) ok++;
    cost+=(+a.costSec||0);
    const day=new Date(a.ts||Date.now());
    const ds=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
    if(!byDay[ds]) byDay[ds]={ok:0,n:0};
    byDay[ds].n++; if(a.correct) byDay[ds].ok++;
    const tp=a.type||'other';
    if(!byType[tp]) byType[tp]={ok:0,n:0,cost:0};
    byType[tp].n++; byType[tp].cost+=(+a.costSec||0); if(a.correct) byType[tp].ok++;
    const key=a.unitId+':'+a.idx;
    if(!byItem[key]) byItem[key]={unitId:a.unitId, idx:a.idx, type:a.type, seq:[]};
    byItem[key].seq.push(a.correct?1:0);
  });
  STATS.overall=Math.round(ok/brushed*100);
  STATS.brushed=brushed;
  STATS.days=Math.max(1, streakDays()||1);
  STATS.hours=fmtHours(cost);
  const days=Object.keys(byDay).sort();
  let cOk=0, cN=0;
  STATS.trend=days.map(d=>{
    cOk+=byDay[d].ok; cN+=byDay[d].n;
    const label=d.slice(5);
    return {d:label, v:Math.round(cOk/cN*100)};
  });
  const typeOrder=['close','listen','cloze','longmatch','translate','writing'];
  STATS.byType=typeOrder.filter(t=>byType[t]).map(t=>({
    t:typeName(t), v:Math.round(byType[t].ok/byType[t].n*100)
  }));
  STATS.speed=typeOrder.filter(t=>byType[t]).map(t=>{
    const avg=Math.round(byType[t].cost/byType[t].n);
    const ref=parseRefSec(refTime(t));
    return {t:typeName(t), mine:fmtTime(avg), ref:refTime(t), ok:avg<=ref};
  });
  const overs=(S.attempts||[]).filter(a=>a && a.over);
  STATS.overTimes=overs.length;
  if(overs.length){
    let sum=0, cnt=0;
    overs.forEach(a=>{
      const m=String(a.overTime||'').match(/\+?(\d+):(\d+)/);
      if(m){ sum+=(+m[1])*60+(+m[2]); cnt++; }
    });
    STATS.overAvg=cnt? ('+'+fmtTime(Math.round(sum/cnt))) : '--';
  } else STATS.overAvg='--';
  STATS.unitDetail=Object.keys(byItem).slice(-12).reverse().map(k=>{
    const it=byItem[k];
    const u=unitById(it.unitId);
    const name=(u?u.name:'题目')+' · 第'+(it.idx+1)+'题';
    return {name, seq:it.seq.slice(-8)};
  });
}
function resetProgress(){
  S.learned={};
  S.collected={};
  S.words=[];
  S.attempts=[];
  S.answers=[];
  S.drafts={};
  S.queueDoneSet={};
  S.queueIdx=0;
  S.queueDone=0;
  S.checkinDates=[];
  S.learn=null; S.exam=null; S.result=null;
  recomputeUnitLearned();
  S.queue=buildQueue();
  rebuildStats();
  persist(true);
}
function exportProgress(){
  persist(true);
  const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='easy-cet6-backup-'+todayStr()+'.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  toast('已导出学习数据');
}
function importProgress(file){
  const reader=new FileReader();
  reader.onload=()=>{
    let data;
    try{ data=JSON.parse(String(reader.result)); }
    catch(e){ toast('文件无法解析'); return; }
    if(!data || data.schemaVersion!==SCHEMA_VERSION){
      toast('文件版本不兼容，无法导入');
      return;
    }
    if(!confirm('导入将覆盖当前学习进度，确定继续？')) return;
    applySnapshot(data);
    persist(true);
    toast('已导入学习数据');
    closeOverlays();
    const h=location.hash.replace('#/','');
    if(TABS.includes(h)) showView(h); else showView('today');
  };
  reader.readAsText(file);
}
function pickImportFile(){
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='application/json,.json';
  inp.onchange=()=>{ if(inp.files && inp.files[0]) importProgress(inp.files[0]); };
  inp.click();
}

function unitIco(type){ const p={book:'M4 19.5A2.5 2.5 0 016.5 17H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5z M4 19.5A2.5 2.5 0 006.5 22H20v-5',mic:'M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z M19 10v1a7 7 0 01-14 0v-1 M12 18v4 M8 22h8',grid:'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',pen:'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.6 7.6',edit:'M12 20h9 M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z'}; return p[type]||p.book; }
const IC = {
  back:'<path d="M15 18l-6-6 6-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flame:'<path d="M12 22c4.4 0 7-2.8 7-6.6 0-3.4-2.4-5.5-3.4-8.4-1.6 3.4-1.2 4.9-2.7 6.9.2-3.4-1-6.6-3.4-8.9C9 7.5 8 10.5 8 13c0 .7.1 1.3.3 1.9C7 13.6 6 11.9 6 9.9 4.6 11.5 4 13.5 4 15.4 4 19.2 7.3 22 12 22z"/>',
  play:'<path d="M8 5v14l11-7z"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  right:'<path d="M9 18l6-6-6-6"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  star:'<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z"/>',
  starFill:'<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z" fill="currentColor" stroke="none"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  trash:'<path d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6"/>',
  download:'<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5-5 5 5 M12 5v12"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'
};
function ic(name, size){ return '<svg viewBox="0 0 24 24" width="'+(size||18)+'" height="'+(size||18)+'" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(IC[name]||'')+'</svg>'; }
function chip(text, cls){ return '<span class="chip '+cls+'">'+esc(text)+'</span>'; }

/* ================= 路由与视图 ================= */
const TABS=['today','bank','exam','stats','mine'];
function showView(name){
  TABS.forEach(t=>{
    const v=$('view-'+t);
    if(v) v.classList.toggle('active', t===name);
  });
  document.querySelectorAll('#tabbar .tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  if(name==='today') renderToday();
  if(name==='bank') renderBank();
  if(name==='exam') renderExamList();
  if(name==='stats') renderStats();
  if(name==='mine') renderMine();
}
function switchTab(name){ location.hash='#/'+name; }
function handleRoute(){
  const h=location.hash.replace('#/','');
  if(h==='learn'){
    if(S.queueDone>=S.queue.length){ showView('today'); }
    else startQueueLearn();
    return;
  }
  if(TABS.includes(h)) showView(h);
}
window.addEventListener('hashchange',handleRoute);
document.querySelectorAll('#tabbar .tab').forEach(b=>{
  b.addEventListener('click',()=>switchTab(b.dataset.tab));
});
function closeOverlays(){
  ['overlay-learn','overlay-exam','overlay-result'].forEach(id=>$(id).classList.remove('active'));
  stopLearnTimer(); stopExamTimer();
}
function openOverlay(id){ closeOverlays(); $(id).classList.add('active'); }

/* ================= 今日页（极简：打开即学） ================= */
function ringSvg(pct, size){
  const r=32, c=2*Math.PI*r;
  const off=c*(1-pct/100);
  const s=size||74;
  return '<svg viewBox="0 0 74 74" width="'+s+'" height="'+s+'" style="display:block;"><circle cx="37" cy="37" r="'+r+'" fill="none" stroke="#E4EAF2" stroke-width="7"/><circle cx="37" cy="37" r="'+r+'" fill="none" stroke="#1D4E89" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" style="transition:stroke-dashoffset .4s"/></svg>';
}
function renderToday(){
  const total=S.queue.length, done=S.queueDone;
  const pct=total? Math.round(done/total*100):100;
  const hour=new Date().getHours();
  const greet=hour<12?'早上好':hour<18?'下午好':'晚上好';
  const finished=done>=total;
  let h='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%;padding:28px 24px;text-align:center;">';
  h+='<div class="progress-ring" style="width:118px;height:118px;flex:none;">'+ringSvg(pct,118)+'<div class="ring-num"><b style="font-size:26px;">'+done+'/'+total+'</b><span>今日进度</span></div></div>';
  h+='<h1 style="font-size:22px;font-weight:800;margin-top:20px;">'+greet+'</h1>';
  h+='<p style="color:var(--ink2);font-size:13.5px;margin-top:6px;line-height:1.7;">'+(finished?'今天的切片已全部刷完，去考试巩固一下吧':'今天还有 '+(total-done)+' 条切片，约 '+(total-done)*2.5+' 分钟')+'</p>';
  h+='<span class="streak" style="margin-top:12px;">'+ic('flame',13)+'连续打卡 '+Math.max(1, streakDays()||STATS.days||1)+' 天</span>';
  h+='<div style="width:100%;margin-top:30px;">';
  if(!finished){
    h+='<button class="btn btn-primary btn-lg btn-block" id="today-start">开始今日刷题</button>';
    h+='<p class="faint" style="font-size:11.5px;margin-top:12px;">打开即学 · 一屏一题 · 做完即走</p>';
  } else {
    h+='<button class="btn btn-primary btn-lg btn-block" id="today-exam">去考一篇已解锁真题</button>';
    h+='<button class="btn btn-ghost btn-block" id="today-bank" style="margin-top:10px;">去题库看看</button>';
  }
  h+='</div></div>';
  $('view-today').innerHTML=h;
  const sb=$('today-start');
  if(sb) sb.addEventListener('click',()=>startQueueLearn());
  const ex=$('today-exam'); if(ex) ex.addEventListener('click',()=>switchTab('exam'));
  const bk=$('today-bank'); if(bk) bk.addEventListener('click',()=>switchTab('bank'));
}
function typeName(t){ return {close:'仔细阅读',listen:'听力',cloze:'选词填空',longmatch:'长篇阅读',translate:'翻译',writing:'写作'}[t]||t; }
function refTime(t){ return {close:'2:30',listen:'1:00',cloze:'0:45',longmatch:'2:00',translate:'15:00',writing:'30:00'}[t]||'1:00'; }
function examEntries(){
  const res=[];
  const p=curPaper();
  const units=p.units;
  units.forEach(u=>{
    const locked=u.learned<u.total;
    res.push({unit:u.id, name:u.name+' · '+(u.total)+'题', locked, meta:locked?('已学 '+u.learned+'/'+u.total+'，还差 '+(u.total-u.learned)+' 条解锁'):('已解锁 · 原卷形态完整作答')});
  });
  const lockedCount=units.filter(u=>u.learned<u.total).length;
  res.push({unit:'full', name:'整卷连考 · '+p.label, locked:lockedCount>0, meta:lockedCount>0?('还需解锁 '+lockedCount+' 个单元'):('57 题 · 130 分钟 · 按原卷顺序')});
  return res;
}
function lockedUnits(){ return curPaper().units.filter(u=>u.learned<u.total).length; }

/* ================= 题库页 ================= */
function renderBank(){
  let h='<div class="topbar"><div class="title">题库</div><span class="chip '+(HAS_REAL_PAPERS?'blue':'gray')+'">'+(HAS_REAL_PAPERS?('真题库 · '+PAPERS.length+' 套'):('示例 · '+PAPERS.length+' 套'))+'</span></div>';
  h+='<div class="year-chips">'+PAPERS.map(p=>'<button class="year-chip'+(S.year===p.id?' active':'')+'" data-year="'+p.id+'">'+p.label+'</button>').join('')+'</div>';
  curPaper().units.forEach(u=>{
    const open=S.bankOpen===u.id;
    const pct=u.total? Math.round(u.learned/u.total*100):0;
    const unlocked=u.learned>=u.total;
    h+='<div class="section-card">';
    h+='<button class="section-head" data-open="'+u.id+'">';
    h+='<div class="s-ico" style="background:'+(u.type==='close'?'#E7EFFA;color:#1D4E89':u.type==='listen'?'#E6F4EC;color:#1E8E5A':u.type==='cloze'?'#FDF3E3;color:#D97706':u.type==='longmatch'?'#FBEBEA;color:#C8433B':'#EEF1F6;color:#5B6B83')+'">'+ic(unitIco(u.type),19)+'</div>';
    h+='<div class="s-main"><div class="s-name">'+esc(u.name)+'</div><div class="s-meta">'+typeName(u.type)+' · 已学 '+u.learned+'/'+u.total+(unlocked?' · 已解锁':'')+'</div></div>';
    h+='<div class="mini-bar"><i style="width:'+pct+'%"></i></div>';
    h+='<span class="s-arrow'+(open?' open':'')+'">'+ic('down',16)+'</span>';
    h+='</button>';
    if(open){
      h+='<div class="unit-row" data-learn-unit="'+u.id+'">';
      h+='<div class="u-name">'+esc(u.name)+'</div>';
      if(unlocked){ h+='<span class="u-go">去考试 '+ic('right',13)+'</span>'; }
      else { h+='<div class="u-prog">还差 '+(u.total-u.learned)+' 条</div>'; h+='<span class="u-lock">'+ic('lock',15)+'</span>'; }
      h+='</div>';
    }
    h+='</div>';
  });
  h+='<div class="about" style="padding:8px 16px 20px;">题库按"年份 → 题型 → 单元 → 条目"组织，一条切片即一道最小可学题目。共收录 '+PAPERS.length+' 辑真题（'+(HAS_REAL_PAPERS?'历年真题数据':'公开示例数据')+'）。</div>';
  $('view-bank').innerHTML=h;
  document.querySelectorAll('#view-bank .year-chip').forEach(b=>b.addEventListener('click',()=>{
    S.year=b.dataset.year; reshuffleQueue(); persist(); renderBank(); toast('已切换套次并重排今日队列');
  }));
  document.querySelectorAll('#view-bank .section-head').forEach(b=>b.addEventListener('click',()=>{
    S.bankOpen=(S.bankOpen===b.dataset.open)? null : b.dataset.open; renderBank();
  }));
  document.querySelectorAll('#view-bank [data-learn-unit]').forEach(el=>el.addEventListener('click',()=>{
    const u=unitById(el.dataset.learnUnit);
    if(u.learned>=u.total){ startExam(u.id); return; }
    let idx=0; while(idx<u.total && S.learned[u.id+':'+idx]) idx++;
    openLearn(u.id, idx, 'bank');
  }));
}

/* ================= 考试页（列表 + 记录） ================= */
function renderExamList(){
  let h='<div class="topbar"><div class="title">考试</div><span class="chip gray">全部切片学完即解锁</span></div>';
  h+='<div class="sec-title">可考单元</div>';
  const entries=examEntries().filter(e=>!e.locked);
  if(entries.length){
    entries.forEach(e=>{
      h+='<div class="exam-entry" data-exam="'+e.unit+'">';
      h+='<div class="e-ico">'+ic('check',19)+'</div>';
      h+='<div class="e-main"><div class="e-title">'+esc(e.name)+'</div><div class="e-meta">'+esc(e.meta)+'</div></div>';
      h+='<span style="font-size:12px;font-weight:700;color:#fff;">去考试</span>';
      h+='</div>';
    });
  } else {
    h+='<div class="card" style="margin:0 16px;padding:18px;text-align:center;"><div class="bold">还没有解锁的考试</div><div class="faint" style="font-size:12px;margin-top:4px;">继续刷切片，某个单元的全部切片学完即可整题考试</div></div>';
  }
  h+='<div class="sec-title">答题记录<span class="more" id="exam-clear">清空</span></div>';
  if(S.attempts.length){
    S.attempts.slice().reverse().forEach(a=>{
      h+='<div class="queue-item" style="cursor:default;">';
      h+='<div class="q-ico" style="background:'+(a.score>=70?'#E6F4EC;color:#1E8E5A':'#FBEBEA;color:#C8433B')+'">'+ic('check',18)+'</div>';
      h+='<div class="q-main"><div class="q-title">'+esc(a.name)+'</div><div class="q-meta">'+a.date+' · '+a.type+' · 耗时 '+a.time+(a.over?' · <span style="color:#C8433B;font-weight:700;">超时 '+a.overTime+'</span>':'')+'</div></div>';
      h+='<div class="q-tag">'+chip(a.score+'%', a.score>=70?'green':(a.score>=60?'amber':'red'))+'</div>';
      h+='</div>';
    });
  } else {
    h+='<div class="card" style="margin:0 16px;padding:18px;text-align:center;"><div class="faint" style="font-size:13px;">暂无答题记录</div></div>';
  }
  $('view-exam').innerHTML=h;
  document.querySelectorAll('#view-exam [data-exam]').forEach(el=>el.addEventListener('click',()=>{
    const u=el.dataset.exam; if(u==='full'){ startExam('full'); return; } startExam(u);
  }));
  const cl=$('exam-clear');
  if(cl) cl.addEventListener('click',()=>{ S.attempts=[]; persist(); renderExamList(); toast('已清空答题记录'); });
}

/* ================= 统计页 ================= */
function lineChart(data, w, h, color){
  const pad=6, min=Math.min(...data.map(d=>d.v)), max=Math.max(...data.map(d=>d.v));
  const range=Math.max(max-min, 10);
  const xs=i=>pad+(w-pad*2)*i/(data.length-1);
  const ys=v=>h-pad-(v-(min-2))*(h-pad*2)/(range+4);
  let pts=data.map((d,i)=>xs(i).toFixed(1)+','+ys(d.v).toFixed(1)).join(' ');
  let area='M'+xs(0)+','+(h-2)+' L'+pts.split(' ').join(' L')+' L'+xs(data.length-1)+','+(h-2)+' Z';
  let labels='';
  const step=Math.ceil(data.length/6);
  data.forEach((d,i)=>{ if(i%step===0) labels+='<text x="'+xs(i)+'" y="'+(h+11)+'" font-size="9" fill="#94A2B6" text-anchor="middle">'+d.d+'</text>'; });
  return '<svg viewBox="0 0 '+w+' '+(h+16)+'" style="display:block;width:100%;height:auto;">'
    +'<path d="'+area+'" fill="'+color+'22" stroke="none"/>'
    +'<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    +data.map((d,i)=>'<circle cx="'+xs(i)+'" cy="'+ys(d.v)+'" r="2.4" fill="'+color+'"/>').join('')
    +labels+'</svg>';
}
function renderStats(){
  let h='<div class="topbar"><div class="title">统计报表</div></div>';
  h+='<div class="stats-hero">';
  h+='<div class="stat-card"><b>'+STATS.overall+(STATS.overall!=='--'?'<small>%</small>':'')+'</b><span>总正确率</span></div>';
  h+='<div class="stat-card"><b>'+STATS.brushed+'<small> 题</small></b><span>累计刷题</span></div>';
  h+='<div class="stat-card"><b>'+STATS.days+'<small> 天</small></b><span>连续打卡</span></div>';
  h+='<div class="stat-card"><b style="font-size:16px;">'+STATS.hours+'</b><span>累计用时</span></div>';
  h+='</div>';
  h+='<div class="dim-tabs">';
  [['time','按时间'],['type','按题型'],['unit','单题'],['speed','速度']].forEach(d=>{
    h+='<button class="dim-tab'+(S.dim===d[0]?' active':'')+'" data-dim="'+d[0]+'">'+d[1]+'</button>';
  });
  h+='</div>';
  const empty='<div class="chart-card" style="text-align:center;padding:28px 16px;"><div class="bold" style="font-size:14px;">暂无数据</div><div class="faint" style="font-size:12px;margin-top:4px;line-height:1.7;">完成几道切片、考一场之后，<br>这里会开始累积你的正确率与速度数据</div></div>';
  if(S.dim==='time'){
    if(STATS.trend.length){
      h+='<div class="chart-card"><div class="c-title">正确率走势</div><div class="c-sub">按日期 · 累计正确率</div>'+lineChart(STATS.trend,320,130,'#1D4E89')+'</div>';
    } else { h+=empty; }
  }
  if(S.dim==='type'){
    if(STATS.byType.length){
      h+='<div class="chart-card"><div class="c-title">各题型正确率</div><div class="c-sub">六大题型 · 累计正确率 %</div>';
      const max=Math.max(...STATS.byType.map(b=>b.v));
      STATS.byType.forEach(b=>{
        h+='<div class="bar-row"><span class="b-label">'+b.t+'</span><div class="b-track"><div class="b-fill" style="width:'+Math.max(10,b.v/max*100)+'%; background:'+(b.v>=70?'#1E8E5A':b.v>=60?'#D97706':'#C8433B')+'">'+b.v+'</div></div></div>';
      });
      h+='</div>';
    } else { h+=empty; }
  }
  if(S.dim==='unit'){
    if(STATS.unitDetail.length){
      h+='<div class="chart-card"><div class="c-title">每道题正确率变化</div><div class="c-sub">第 1 次 → 第 N 次作答（●=对 ○=错）</div><div class="unit-stats">';
      STATS.unitDetail.forEach(u=>{
        h+='<div class="u-row"><span style="flex:1;">'+esc(u.name)+'</span>';
        h+='<span class="mini-spark">'+u.seq.map(v=>'<svg viewBox="0 0 12 12" width="12" height="12" style="margin-right:2px;"><circle cx="6" cy="6" r="4" fill="'+(v?'#1E8E5A':'#C8433B')+'"/></svg>').join('')+'</span></div>';
      });
      h+='</div></div>';
    } else { h+=empty; }
  }
  if(S.dim==='speed'){
    if(STATS.speed.length){
      h+='<div class="chart-card"><div class="c-title">各题型单题平均耗时 vs 建议用时</div><div class="c-sub">越接近或快于建议用时越好</div>';
      STATS.speed.forEach(s=>{
        h+='<div class="speed-row"><span class="s-name">'+s.t+'</span><span class="s-val '+(s.ok?'ok':'slow')+'">'+s.mine+' <span class="faint" style="font-weight:500;">/ '+s.ref+'</span></span></div>';
      });
      h+='</div>';
    } else { h+=empty; }
    h+='<div class="chart-card"><div class="c-title">超时统计</div><div class="c-sub">考试模式下默认计时，超时仅提醒不打断</div>';
    h+='<div class="speed-row"><span class="s-name">累计超时次数</span><span class="s-val '+(STATS.overTimes?'slow':'')+'">'+STATS.overTimes+' 次</span></div>';
    h+='<div class="speed-row"><span class="s-name">平均超时时长</span><span class="s-val slow">'+STATS.overAvg+'</span></div>';
    h+='<div class="speed-row"><span class="s-name">整体速度趋势</span><span class="s-val '+(STATS.speed.length?'ok':'')+'">'+(STATS.speed.length?'变快 ↗':'待积累')+'</span></div>';
    h+='</div>';
  }
  $('view-stats').innerHTML=h;
  document.querySelectorAll('#view-stats .dim-tab').forEach(b=>b.addEventListener('click',()=>{ S.dim=b.dataset.dim; renderStats(); }));
}

/* ================= 我的页 ================= */
function renderMine(){
  let h='';
  h+='<div class="profile"><div class="avatar">六</div><div><div class="p-name">六级碎片刷题</div><div class="p-sub">备考时间紧 · 每天 10–30 分钟</div></div></div>';
  h+='<div class="sec-title">生词本<span class="faint" style="font-size:11px;font-weight:500;"> · 真题出现频次排序</span></div>';
  if(S.words.length){
    S.words.forEach(w=>{
      h+='<div class="word-item">';
      h+='<div class="w-main"><div class="w-word">'+esc(w.w)+'</div><div class="w-meaning">'+esc(w.d)+'</div><div class="w-meta">'+esc(w.from)+' · 出现 '+w.n+' 次 · '+((w.state==='review')?'复习中':'新收藏')+'</div></div>';
      h+='<div class="w-act">'+ (w.state==='review'? chip('已复习','green') : '<button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" data-review="'+esc(w.w)+'">标为复习</button>') +'</div>';
      h+='</div>';
    });
  } else {
    h+='<div class="card" style="margin:0 16px;padding:16px;text-align:center;"><div class="faint" style="font-size:13px;">还没有收藏的单词</div></div>';
  }
  h+='<div class="sec-title">设置</div>';
  h+='<div class="setting-row"><span class="s-t">每日档位<span class="s-d">决定今日队列条数</span></span><div class="seg">'+[[10,'10分'],[20,'20分'],[30,'30分']].map(o=>'<button class="'+(S.settings.slot===o[0]?'on':'')+'" data-slot="'+o[0]+'">'+o[1]+'</button>').join('')+'</div></div>';
  h+='<div class="setting-row"><span class="s-t">考试计时<span class="s-d">默认开启，超时仅提醒并记录</span></span><button class="switch'+(S.settings.examTimer?' on':'')+'" id="set-timer"></button></div>';
  h+='<div class="setting-row"><span class="s-t">重复题权重<span class="s-d">新题 '+S.settings.w1+'% / 二刷 '+S.settings.w2+'% / 三刷 '+S.settings.w3+'% · 已用于今日队列</span></span><span class="chip green">生效中</span></div>';
  h+='<div class="menu-group">';
  h+='<div class="menu-item" id="act-export"><div class="m-ico" style="background:#E7EFFA;color:#1D4E89;">'+ic('download',17)+'</div><div class="m-t">导出学习数据</div><div class="m-d">JSON 备份</div><span class="m-arrow">'+ic('right',15)+'</span></div>';
  h+='<div class="menu-item" id="act-import"><div class="m-ico" style="background:#E6F4EC;color:#1E8E5A;">'+ic('upload',17)+'</div><div class="m-t">导入学习数据</div><div class="m-d">覆盖当前进度</div><span class="m-arrow">'+ic('right',15)+'</span></div>';
  h+='<div class="menu-item" id="act-reset"><div class="m-ico" style="background:#FBEBEA;color:#C8433B;">'+ic('trash',17)+'</div><div class="m-t">清空学习进度</div><div class="m-d">删除本地全部数据</div><span class="m-arrow">'+ic('right',15)+'</span></div>';
  h+='</div>';
  h+='<div class="about">六级碎片化刷题 · v0.6<br>'+(HAS_REAL_PAPERS?('题库：'+PAPERS.length+' 套历年真题（本地 data/papers.js）'):'题库：公开示例（放入 data/papers.js 可加载真题）')+'<br>词库 '+Object.keys(window.CET6_DICT||{}).length+' 词 · 进度保存在本机（easy-cet6-v1）</div>';
  $('view-mine').innerHTML=h;
  document.querySelectorAll('#view-mine [data-slot]').forEach(b=>b.addEventListener('click',()=>{
    const slot=+b.dataset.slot;
    if(slot===S.settings.slot) return;
    S.settings.slot=slot;
    reshuffleQueue();
    persist(true);
    renderMine();
    toast('每日档位已切换为 '+S.settings.slot+' 分钟，今日队列已重排');
  }));
  document.querySelectorAll('#view-mine [data-review]').forEach(b=>b.addEventListener('click',()=>{
    const w=S.words.find(x=>x.w===b.dataset.review); if(w) w.state='review'; persist(); renderMine(); toast('已标记为复习');
  }));
  const st=$('set-timer'); if(st) st.addEventListener('click',()=>{ S.settings.examTimer=!S.settings.examTimer; persist(); renderMine(); toast(S.settings.examTimer?'考试计时已开启':'考试计时已关闭'); });
  const ex=$('act-export'); if(ex) ex.addEventListener('click',()=>exportProgress());
  const im=$('act-import'); if(im) im.addEventListener('click',()=>pickImportFile());
  const rs=$('act-reset'); if(rs) rs.addEventListener('click',()=>{
    if(!confirm('将删除本地全部学习进度（已学题目、生词、考试记录），且不可恢复。确定清空？')) return;
    resetProgress();
    closeOverlays();
    renderMine();
    toast('已清空学习进度');
  });
}

/* ================= 学习流程 ================= */
let learnTimerInt=null;
function stopLearnTimer(){ if(learnTimerInt){ clearInterval(learnTimerInt); learnTimerInt=null; } }
function startQueueLearn(){
  let i=S.queueIdx;
  while(i<S.queue.length && S.queueDoneSet[i]) i++;
  if(i>=S.queue.length){ showView('today'); return; }
  const q=S.queue[i]; openLearn(q.unit, q.idx, 'queue');
}
function openLearn(unitId, idx, from){
  const u=unitById(unitId); if(!u) return;
  S.learn={unit:unitId, idx, from, answered:false, selected:null, cost:0, startTs:Date.now()};
  openOverlay('overlay-learn');
  $('learn-back').onclick=()=>{ closeOverlays(); if(from==='queue') showView('today'); else showView('bank'); };
  renderLearnItem();
}
function renderLearnItem(){
  const L=S.learn, u=unitById(L.unit), it=u.items[L.idx];
  const body=$('learn-body');
  const _pass=itemPassage(u,it);
  const scrollTop=_pass? body.scrollTop : 0;
  const total=L.from==='queue'? S.queue.length : u.total;
  const pos=L.from==='queue'? (S.queueIdx+1) : (L.idx+1);
  $('learn-title').textContent=u.name;
  $('learn-pos').textContent=pos+'/'+total;
  $('learn-progbar').style.width=Math.round((L.from==='queue'? S.queueDone : L.idx)/total*100)+'%';
  const collected=!!S.collected[L.unit+':'+L.idx];
  $('collect-txt').textContent=collected?'已收藏':'收藏';
  $('learn-collect').innerHTML=ic(collected?'starFill':'star',16)+'<span id="collect-txt">'+(collected?'已收藏':'收藏')+'</span>';
  $('learn-submit').disabled=L.answered;
  $('learn-next').disabled=!L.answered;
  $('learn-submit').textContent=L.answered?'已提交':(isTextType(u.type)?'提交并查看参考':'提交');
  const itemKey=L.unit+':'+L.idx;
  if(L.answered){
    stopLearnTimer();
    $('learn-timer-txt').textContent=fmtTime(L.cost||0);
  } else if(L._tickKey!==itemKey || !learnTimerInt){
    stopLearnTimer();
    L.startTs=Date.now();
    L._tickKey=itemKey;
    $('learn-timer-txt').textContent='00:00';
    learnTimerInt=setInterval(()=>{ if(!S.learn) return; const s=Math.floor((Date.now()-S.learn.startTs)/1000); $('learn-timer-txt').textContent=fmtTime(s); },1000);
  }

  let h='';
  const qTag=(L.from==='queue' && S.queue[S.queueIdx] && S.queue[S.queueIdx].tag)? S.queue[S.queueIdx].tag : '';
  const listenLabel=u.type==='listen'?(audioSrcOf(it)?'含音频':'暂无音频'):'';
  h+='<div class="q-source"><span>'+esc(paperOfUnit(L.unit).label)+'</span><span class="dot"></span><span>'+typeName(u.type)+'</span><span class="dot"></span><span>第 '+(L.idx+1)+' 题 / 共 '+u.total+' 题</span>'+ (qTag?'<span class="dot"></span><span>'+esc(qTag)+'</span>':'') + (listenLabel?'<span class="dot"></span><span>'+listenLabel+'</span>':'') +'</div>';
  if(u.type==='listen'){ h+=renderAudioHtml(it); }
  h+=passageHtml(_pass, it, L.idx, u.type);
  h+=typeHintHtml(u.type, it, L.idx);
  h+='<div class="q-stem">'+wrapWords(esc(it.q)).replace(/\n/g,'<br>')+'</div>';
  if(isTextType(u.type)){
    const draft=L.answered?(getDraft(L.unit,L.idx)||''):getDraft(L.unit,L.idx);
    h+=draftAreaHtml(draft, !!L.answered, u.type==='writing'?'在此写英文作文…':'在此写英文译文…');
  } else {
    h+=renderOptsHtml(it.opts, L.selected, L.answered?true:null, undefined);
  }
  if(L.answered){
    if(isTextType(u.type)){
      h+='<div class="explain"><div class="x-head">'+ic('check',16)+'<span class="ans">已完成对照</span><span class="faint" style="font-weight:500;"> · 本题耗时 '+fmtTime(L.cost)+'</span></div><p>'+wrapWords(esc(it.explain))+'</p>';
    } else {
      const correct=it.opts[L.selected]&&it.opts[L.selected].r;
      h+='<div class="explain"><div class="x-head">'+ic(correct?'check':'',16)+'<span class="'+(correct?'ans':'ans wrong')+'">'+(correct?'回答正确':'回答错误')+'</span><span class="faint" style="font-weight:500;"> · 本题耗时 '+fmtTime(L.cost)+'</span></div><p>'+wrapWords(esc(it.explain))+'</p>';
    }
    if(it.words&&it.words.length){
      h+='<div class="word-row">'+it.words.map(w=>'<span class="w" data-w="'+esc(w[0])+'">'+esc(w[0])+'</span><span class="d">'+esc(w[1])+'</span>').join('<span style="color:#DCE3EC;">|</span>')+'</div>';
    }
    h+='</div>';
  }
  body.innerHTML=h;
  if(_pass) body.scrollTop=scrollTop;
  if(u.type==='listen' && audioSrcOf(it)) bindAudioPlayer();
  document.querySelectorAll('#learn-body [data-opt]').forEach(b=>b.addEventListener('click',(ev)=>{
    if(S.learn.answered) return;
    if(ev.target.closest('w,[data-w]')) return;
    S.learn.selected=+b.dataset.opt; renderLearnItem();
  }));
  const ta=$('draft-area');
  if(ta && !L.answered){
    ta.addEventListener('input',()=>{ setDraft(L.unit, L.idx, ta.value); });
  }
  const sub=$('learn-submit');
  sub.onclick=()=>{
    if(L.answered) return;
    L.cost=Math.max(1,Math.floor((Date.now()-L.startTs)/1000));
    stopLearnTimer();
    const key=L.unit+':'+L.idx;
    const firstTime=!S.learned[key];
    if(isTextType(u.type)){
      const text=(ta?ta.value:getDraft(L.unit,L.idx)).trim();
      if(!text){ toast('请先写下你的答案'); return; }
      setDraft(L.unit, L.idx, text);
      L.answered=true; L.selected=-1;
      if(firstTime){ S.learned[key]=true; unitById(L.unit).learned++; }
      if(L.from==='queue' && !S.queueDoneSet[S.queueIdx]){ S.queueDoneSet[S.queueIdx]=true; S.queueDone++; }
      recordAnswer({unitId:L.unit, idx:L.idx, type:u.type, correct:true, costSec:L.cost, ts:Date.now(), source:'learn'});
      markCheckin();
      persist(true);
      renderLearnItem();
      if(firstTime) toast('已记录完成 · 可对照参考');
      return;
    }
    if(L.selected===null){ toast('请先选择一个选项'); return; }
    L.answered=true;
    if(firstTime){ S.learned[key]=true; unitById(L.unit).learned++; }
    if(L.from==='queue' && !S.queueDoneSet[S.queueIdx]){ S.queueDoneSet[S.queueIdx]=true; S.queueDone++; }
    const correct=!!(it.opts[L.selected]&&it.opts[L.selected].r);
    recordAnswer({unitId:L.unit, idx:L.idx, type:u.type, correct, costSec:L.cost, ts:Date.now(), source:'learn'});
    markCheckin();
    persist(true);
    renderLearnItem();
    if(firstTime) toast('已记录 · 生词可点收藏');
  };
  const nx=$('learn-next');
  nx.onclick=()=>{
    if(L.from==='queue'){
      let i=S.queueIdx+1; while(i<S.queue.length && S.queueDoneSet[i]) i++;
      if(i<S.queue.length){ S.queueIdx=i; persist(); openLearn(S.queue[i].unit, S.queue[i].idx, 'queue'); }
      else { S.queueIdx=S.queue.length; persist(); showLearnDone(); }
    } else {
      let j=L.idx+1; while(j<unitById(L.unit).total && S.learned[L.unit+':'+j]) j++;
      if(j<unitById(L.unit).total){ persist(); openLearn(L.unit, j, 'bank'); }
      else { persist(); stopLearnTimer(); showView('bank'); toast(unitById(L.unit).learned>=unitById(L.unit).total?'该单元已全部学完，已解锁考试！':'本单元已看完'); }
    }
  };
  $('learn-collect').onclick=()=>{
    const key=L.unit+':'+L.idx;
    if(S.collected[key]){ S.collected[key]=false; toast('已取消收藏本题'); }
    else {
      S.collected[key]=true;
      const it2=itemById(L.unit,L.idx);
      if(it2&&it2.words){ it2.words.forEach(w=>{ if(!S.words.find(x=>x.w===w[0])){ S.words.push({w:w[0],d:w[1],from:u.name+' · 第'+(L.idx+1)+'题',n:1,state:'new'}); } else { S.words.find(x=>x.w===w[0]).n++; } }); }
      toast('已收藏本题，生词已加入生词本');
    }
    persist(true);
    renderLearnItem();
  };
}

function showLearnDone(){
  stopLearnTimer();
  const total=S.queue.length;
  let h='<div class="done-hero"><svg class="dh-ring" viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="42" fill="none" stroke="#E4EAF2" stroke-width="8"/><circle cx="48" cy="48" r="42" fill="none" stroke="#1E8E5A" stroke-width="8" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="0"/><path d="M30 49l12 12 24-24" fill="none" stroke="#1E8E5A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg><h2>今日队列完成！</h2><p>已刷 '+total+' 条，用时约 '+Math.round(total*2.5)+' 分钟<br>已刷过的题目会按较低权重继续出现，保持手感</p><div style="margin-top:18px; width:100%;"><button class="btn btn-primary btn-lg btn-block" id="done-exam">去考一篇已解锁的完整真题</button><button class="btn btn-ghost btn-block" id="done-back" style="margin-top:10px;">返回首页</button></div></div>';
  $('learn-body').innerHTML=h;
  $('learn-title').textContent='完成';
  $('learn-progbar').style.width='100%';
  $('learn-pos').textContent=total+'/'+total;
  document.querySelectorAll('.learn-foot').forEach(f=>f.style.display='none');
  const de=$('done-exam'); if(de) de.addEventListener('click',()=>{ document.querySelectorAll('.learn-foot').forEach(f=>f.style.display=''); closeOverlays(); switchTab('exam'); });
  const db=$('done-back'); if(db) db.addEventListener('click',()=>{ document.querySelectorAll('.learn-foot').forEach(f=>f.style.display=''); closeOverlays(); switchTab('today'); });
}
function bindWave(){ /* I3: 假波形已移除，保留空函数避免旧调用 */ }

/* ================= 考试流程 ================= */
let examTimerInt=null;
function stopExamTimer(){ if(examTimerInt){ clearInterval(examTimerInt); examTimerInt=null; } }
function startExam(unitId){
  const full = unitId==='full';
  const units = full? curPaper().units : [unitById(unitId)];
  if(!full && !units[0]) return;
  if(full && lockedUnits()>0){ toast('还有 '+lockedUnits()+' 个单元未解锁'); return; }
  const items=[];
  let title;
  if(full){ title='整卷连考 · '+curPaper().label; units.forEach(u=>u.items.forEach((it,i)=>items.push({unit:u.id, idx:i, q:it.q, opts:it.opts, audio:it.audio, passage:it.passage, hl:it.hl, explain:it.explain, words:it.words, type:u.type}))); }
  else { const u=units[0]; title=u.name; u.items.forEach((it,i)=>items.push({unit:u.id, idx:i, q:it.q, opts:it.opts, audio:it.audio, passage:it.passage, hl:it.hl, explain:it.explain, words:it.words, type:u.type})); }
  S.exam={unitId, full, items, idx:0, answers:{}, marked:{}, startTs:Date.now(),
    duration: full? 7800 : items.length*180, remaining: full? 7800 : items.length*180, over:false, elapsed:0};
  openOverlay('overlay-exam');
  $('exam-title').textContent=title;
  $('exam-back').onclick=confirmExitExam;
  renderExamItem(); startExamTimer();
}
function startExamTimer(){
  stopExamTimer();
  const tick=()=>{
    if(!S.exam) return;
    S.exam.elapsed=Math.floor((Date.now()-S.exam.startTs)/1000);
    S.exam.remaining=Math.max(0, S.exam.duration - S.exam.elapsed);
    if(S.exam.remaining===0) S.exam.over=true;
    const t=$('exam-timer');
    if(!t) return;
    if(S.exam.over){
      const overSec=S.exam.elapsed-S.exam.duration;
      t.innerHTML=ic('clock',15)+'<span>00:00</span><span class="over-badge">超时 +'+fmtTime(overSec)+'</span>';
      t.classList.add('over');
    } else {
      t.innerHTML=ic('clock',15)+'<span>'+fmtTime(S.exam.remaining)+'</span>';
      t.classList.toggle('warn', S.exam.remaining<=60);
      t.classList.remove('over');
    }
  };
  tick(); examTimerInt=setInterval(tick,1000);
}
function renderExamItem(){
  const E=S.exam, it=E.items[E.idx];
  const body=$('exam-body');
  const _eu=unitById(it.unit); const _epass=itemPassage(_eu,it);
  const scrollTop=_epass? body.scrollTop : 0;
  $('exam-title').textContent=E.full?('整卷连考 · '+curPaper().label):unitById(E.unitId).name;
  $('as-title').textContent='答题卡（'+(E.full?'整卷':'本单元')+'）';
  const done=E.items.reduce((n,x,i)=>n+(answerFilled(E.answers[i], x.type)?1:0),0);
  $('as-count').textContent=done+' / '+E.items.length;
  const chosen=E.answers[E.idx];
  let h='';
  h+='<div class="q-source"><span>'+esc(E.full?curPaper().label+' 整卷':'原题单元')+'</span><span class="dot"></span><span>第 '+(E.idx+1)+' / '+E.items.length+' 题</span><span class="dot"></span><span>'+typeName(it.type)+'</span></div>';
  if(it.type==='listen' || it.audio){ h+=renderAudioHtml(it); }
  h+=passageHtml(_epass, it, it.idx, it.type);
  h+=typeHintHtml(it.type, it, it.idx);
  h+='<div class="q-stem">'+wrapWords(esc(it.q)).replace(/\n/g,'<br>')+'</div>';
  if(isTextType(it.type)){
    let draft='';
    if(typeof chosen==='string') draft=chosen;
    else draft=getDraft(it.unit, it.idx);
    h+=draftAreaHtml(draft, false, it.type==='writing'?'在此写英文作文…':'在此写英文译文…');
  } else {
    const sel=(typeof chosen==='number')?chosen:undefined;
    h+=renderOptsHtml(it.opts, undefined, null, sel);
  }
  body.innerHTML=h;
  if(_epass) body.scrollTop=scrollTop;
  if((it.type==='listen'||it.audio) && audioSrcOf(it)) bindAudioPlayer();
  document.querySelectorAll('#exam-body [data-opt]').forEach(b=>b.addEventListener('click',(ev)=>{
    if(ev.target.closest('w,[data-w]')) return;
    S.exam.answers[E.idx]=+b.dataset.opt; renderExamItem();
  }));
  const ta=$('draft-area');
  if(ta){
    ta.addEventListener('input',()=>{
      S.exam.answers[E.idx]=ta.value;
      setDraft(it.unit, it.idx, ta.value);
      const d=E.items.reduce((n,x,i)=>n+(answerFilled(E.answers[i], x.type)?1:0),0);
      $('as-count').textContent=d+' / '+E.items.length;
      renderAnswerSheet();
    });
  }
  $('exam-prev').disabled=E.idx===0;
  $('exam-prev').onclick=()=>{ E.idx=Math.max(0,E.idx-1); renderExamItem(); };
  $('exam-next').disabled=E.idx===E.items.length-1;
  $('exam-next').onclick=()=>{ E.idx=Math.min(E.items.length-1,E.idx+1); renderExamItem(); };
  $('exam-sheetbtn').onclick=()=>$('answer-sheet').classList.add('open');
  $('as-close').onclick=()=>$('answer-sheet').classList.remove('open');
  renderAnswerSheet();
  $('exam-submit').onclick=submitExam;
  $('as-submit').onclick=submitExam;
}

function renderAnswerSheet(){
  const E=S.exam;
  let grid='';
  for(let i=0;i<E.items.length;i++){
    const it=E.items[i];
    const ans=E.answers[i];
    const done=answerFilled(ans, it.type);
    let mark='';
    if(done){
      if(isTextType(it.type)) mark='文';
      else if(typeof ans==='number') mark=String.fromCharCode(65+ans);
      else mark='✓';
    }
    grid+='<div class="as-cell'+(done?' done':'')+(i===E.idx?' current':'')+'" data-goto="'+i+'"><b>'+(i+1)+'</b>'+mark+'</div>';
  }
  $('as-grid').innerHTML=grid;
  document.querySelectorAll('#as-grid .as-cell').forEach(c=>c.addEventListener('click',()=>{
    E.idx=+c.dataset.goto; $('answer-sheet').classList.remove('open'); renderExamItem();
  }));
}

function submitExam(){
  const E=S.exam;
  const done=E.items.reduce((n,it,i)=>n+(answerFilled(E.answers[i], it.type)?1:0),0);
  if(done<E.items.length && !confirm('还有 '+(E.items.length-done)+' 题未作答，确定交卷？')) return;
  let correct=0;
  E.items.forEach((it,i)=>{
    const ans=E.answers[i];
    if(isTextType(it.type)){
      if(answerFilled(ans, it.type)) correct++;
    } else if(ans!==undefined && it.opts[ans] && it.opts[ans].r) correct++;
  });
  const score=Math.round(correct/E.items.length*100);
  const elapsed=Math.floor((Date.now()-E.startTs)/1000);
  const over=E.over;
  const overTime= over? '+'+fmtTime(elapsed-E.duration) : '';
  const record={
    id:'a'+Date.now(), date:(new Date().getMonth()+1)+'-'+String(new Date().getDate()).padStart(2,'0'),
    unit:E.full?'full':E.unitId, name:E.full?('整卷连考 · '+curPaper().label):unitById(E.unitId).name,
    type:E.full?'整卷':'单元', score, total:correct+'/'+E.items.length, time:fmtTime(elapsed), over, overTime
  };
  S.attempts.push(record);
  const perCost=Math.max(1, Math.round(elapsed/Math.max(1, E.items.length)));
  E.items.forEach((it,i)=>{
    if(!answerFilled(E.answers[i], it.type)) return;
    let ok;
    if(isTextType(it.type)) ok=true;
    else ok=!!(it.opts[E.answers[i]]&&it.opts[E.answers[i]].r);
    recordAnswer({unitId:it.unit, idx:it.idx, type:it.type, correct:ok, costSec:perCost, ts:Date.now(), source:'exam'});
  });
  markCheckin();
  persist(true);
  const errs=[];
  E.items.forEach((it,i)=>{
    const ans=E.answers[i];
    if(isTextType(it.type)){
      if(!answerFilled(ans, it.type)) errs.push({i:i+1, unit:it.unit, idx:it.idx, t:it.q});
    } else if(ans===undefined || !(it.opts[ans]&&it.opts[ans].r)){
      errs.push({i:i+1, unit:it.unit, idx:it.idx, t:it.q});
    }
  });
  S.result={record, errs};
  stopExamTimer();
  closeOverlays();
  openOverlay('overlay-result');
  $('result-back').onclick=()=>{ closeOverlays(); switchTab('exam'); };
  renderResult();
}

function renderResult(){
  const R=S.result, a=R.record;
  let h='<div class="result-hero"><div class="score">'+a.score+'<small>%</small></div><div class="tagline">'+esc(a.name)+' · '+a.date+'</div></div>';
  h+='<div class="kpi-row"><div class="kpi"><b>'+a.total+'</b><span>答对</span></div><div class="kpi"><b>'+a.time+'</b><span>总耗时</span></div><div class="kpi"><b>'+(a.over? a.overTime:'未超时')+'</b><span>超时</span></div></div>';
  h+='<div class="sec-title">本次答题记录已保存</div>';
  h+='<div class="card" style="margin:0 16px;padding:12px 14px;font-size:12.5px;color:var(--ink2);line-height:1.8;">每次作答都会记录：各题答案、单题耗时、是否超时与超时多久，用于统计报表的趋势分析。错题可点下方列表回到对应切片重新学习。</div>';
  h+='<div class="sec-title">错题</div>';
  if(R.errs.length){
    R.errs.forEach(e=>{
      h+='<div class="err-item" data-learn="'+e.unit+':'+e.idx+'"><div class="e-no">'+e.i+'</div><div class="e-t">'+wrapWords(esc(e.t))+'</div>'+ic('right',15)+'</div>';
    });
  } else {
    h+='<div class="card" style="margin:0 16px;padding:16px;text-align:center;"><span class="chip green">全对</span> <span class="faint" style="font-size:12.5px;margin-left:6px;">这一篇已完全掌握，保持住</span></div>';
  }
  h+='<div style="padding:16px; display:flex; gap:10px;"><button class="btn btn-ghost" style="flex:1;" id="result-again">再考一次</button><button class="btn btn-primary" style="flex:1;" id="result-done">完成</button></div>';
  $('result-body').innerHTML=h;
  document.querySelectorAll('#result-body [data-learn]').forEach(el=>el.addEventListener('click',(ev)=>{
    if(ev.target.closest('w,[data-w]')) return;
    const [u,i]=el.dataset.learn.split(':');
    closeOverlays(); openLearn(u, +i, 'bank');
  }));
  const ag=$('result-again'); if(ag) ag.addEventListener('click',()=>{ const u=S.result.record.unit==='full'?'full':S.result.record.unit; closeOverlays(); startExam(u); });
  const dn=$('result-done'); if(dn) dn.addEventListener('click',()=>{ closeOverlays(); switchTab('exam'); });
}
function confirmExitExam(){
  if(confirm('确定退出考试？本次作答不会保存。')){ closeOverlays(); showView('exam'); }
}

/* ================= 全词查词 ================= */
function wrapWords(t, hl){
  const hset=(hl||'').toLowerCase().split(/[^a-z'\-]+/).filter(Boolean);
  return String(t).replace(/([A-Za-z][A-Za-z'\-]*)/g, function(m){
    const low=m.toLowerCase();
    if(!lookupWord(low)) return m;
    return '<w data-w="'+m+'"'+(hset.indexOf(low)>=0?' class="hlw"':'')+'>'+m+'</w>';
  });
}
function lemmatize(w){
  const irr={went:'go',gone:'go',children:'child',men:'man',women:'woman',feet:'foot',teeth:'tooth',mice:'mouse',better:'good',worse:'bad',best:'good',worst:'bad',bought:'buy',brought:'bring',thought:'think',caught:'catch',taught:'teach',fought:'fight',sought:'seek',found:'find',heard:'hear',held:'hold',kept:'keep',left:'leave',lost:'lose',made:'make',meant:'mean',met:'meet',paid:'pay',ran:'run',said:'say',saw:'see',seen:'see',sent:'send',showed:'show',shown:'show',sat:'sit',slept:'sleep',spent:'spend',stood:'stand',took:'take',taken:'take',told:'tell',understood:'understand',wore:'wear',worn:'wear',won:'win',wrote:'write',written:'write',was:'be',were:'be',been:'be',is:'be',are:'be',am:'be',had:'have',has:'have',did:'do',does:'do',done:'do',got:'get',gotten:'get',built:'build',came:'come',come:'come',ate:'eat',eaten:'eat',fell:'fall',fallen:'fall',gave:'give',given:'give',grew:'grow',grown:'grow',knew:'know',known:'know',lay:'lie',laid:'lay',led:'lead',rode:'ride',ridden:'ride',rose:'rise',risen:'rise',sang:'sing',sung:'sing',spoke:'speak',spoken:'speak',swam:'swim',swum:'swim',threw:'throw',thrown:'throw',woke:'wake',woken:'wake',flew:'fly',flown:'fly',chose:'choose',chosen:'choose',drew:'draw',drawn:'draw',drove:'drive',driven:'drive',forgot:'forget',forgotten:'forget',froze:'freeze',frozen:'freeze',broke:'break',broken:'break',wore:'wear',worn:'wear'};
  if(irr[w]) return irr[w];
  if(w.length>4){
    if(w.endsWith('ies')) return w.slice(0,-3)+'y';
    if(/(ches|shes|xes|sses|oes)$/.test(w)) return w.slice(0,-2);
    if(w.endsWith('s')) return w.slice(0,-1);
    if(w.endsWith('ing')){
      const b=w.slice(0,-3);
      if(b.length>=3 && b[b.length-1]===b[b.length-2]) return b.slice(0,-1);
      if(b.endsWith('ie')) return b.slice(0,-2)+'y';
      return b;
    }
    if(w.endsWith('ed') && w.length>5) return w.slice(0,-2);
    if(w.endsWith('er') && w.length>5) return w.slice(0,-2);
    if(w.endsWith('est') && w.length>6) return w.slice(0,-3);
  }
  return w;
}
function lookupWord(word){
  const low=String(word).toLowerCase();
  const D=window.CET6_DICT;
  if(D && D[low]) return D[low];
  const stem=low.replace(/['\-]/g,'');
  if(D && D[stem]) return D[stem];
  const lem=lemmatize(low);
  const cands=[lem, lem.replace(/['\-]/g,'')];
  if(/(ies|es|s|ed|ing|tion|sion|ment|ness|ity|er|or)$/.test(low)){
    if(low.endsWith('ies')) cands.push(low.slice(0,-3)+'y');
    else if(/(ches|shes|xes|sses|oes)$/.test(low)) cands.push(low.slice(0,-2));
    else if(low.endsWith('es')) cands.push(low.slice(0,-1));
    else if(low.endsWith('s')) cands.push(low.slice(0,-1));
    if(low.endsWith('ied')) cands.push(low.slice(0,-3)+'y');
    if(low.endsWith('ing')) cands.push(low.slice(0,-3), low.slice(0,-3)+'e');
    if(low.endsWith('ed')) cands.push(low.slice(0,-2));
    if(low.endsWith('tion')){ cands.push(low.slice(0,-3)+'e', low.slice(0,-4)); }
    if(low.endsWith('sion')){ cands.push(low.slice(0,-2), low.slice(0,-4)+'de'); }
    if(low.endsWith('ment')) cands.push(low.slice(0,-4));
    if(low.endsWith('ness')) cands.push(low.slice(0,-4));
    if(low.endsWith('ity')) cands.push(low.slice(0,-3)+'y');
    if(low.endsWith('er')) cands.push(low.slice(0,-2));
    if(low.endsWith('or')) cands.push(low.slice(0,-2));
  }
  for(const c of cands){ if(c && D && D[c]) return D[c]; }
  const note=GLOBAL_NOTE[low]||GLOBAL_NOTE[lem];
  if(note) return ['','',note];
  return null;
}
function lookupBase(word){
  const low=String(word).toLowerCase();
  const D=window.CET6_DICT;
  if(D && D[low]) return low;
  const stem=low.replace(/['\-]/g,'');
  if(D && D[stem]) return stem;
  const c=lemmatize(low).replace(/['\-]/g,'');
  if(D && D[c]) return c;
  if(GLOBAL_NOTE[low]||GLOBAL_NOTE[lemmatize(low)]) return low;
  return low;
}
let GLOBAL_NOTE={};
function buildNotes(){
  GLOBAL_NOTE={};
  PAPERS.forEach(p=>p.units.forEach(u=>u.items.forEach(it=>{
    (it.words||[]).forEach(w=>{ const k=String(w[0]).toLowerCase(); GLOBAL_NOTE[k]=w[1]; });
  })));
}
let WORD_CTX='';
function showWordSheet(word, ctx){
  WORD_CTX=ctx||'';
  const entry=lookupWord(word);
  const base=lookupBase(word);
  const isForm=base!==word.toLowerCase();
  const sheet=$('word-sheet');
  const saved=S.words.find(x=>x.w===word.toLowerCase());
  const soundIc='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>';
  let h='<div class="wd-word">'+esc(word)+(entry&&entry[1]?'<span class="ph">/'+esc(entry[1])+'/</span>':'')+'</div>';
  if(isForm&&base!==word.toLowerCase()) h+='<div class="wd-def"><span class="pt" style="border:none;padding:0;">原形</span><span class="dm">'+esc(base)+'</span></div>';
  if(entry&&(entry[0]||entry[1])){
    h+='<div class="wd-sound">'
      +(entry[1]?'<button data-say="'+esc(base)+'" data-lang="en-GB">'+soundIc+' 英 '+(entry[1]||'')+'</button>':'')
      +(entry[0]?'<button data-say="'+esc(base)+'" data-lang="en-US">'+soundIc+' 美 '+(entry[0]||'')+'</button>':'')
      +'</div>';
  }
  h+='<div class="wd-defs">';
  const defs=entry? entry[2].split('；').filter(Boolean) : [];
  if(defs.length){
    defs.forEach((df,i)=>{ h+='<div class="wd-def"><span class="pt">'+(i===0?'释义':'')+'</span><span class="dm">'+esc(df)+'</span></div>'; });
  } else {
    h+='<div class="wd-def"><span class="pt">释义</span><span class="dm">词库暂未收录这个词，可先试发音</span></div>';
  }
  h+='</div>';
  h+='<div class="wd-foot">'
    +'<button class="wd-collect'+(saved?' done':'')+'" data-collect="'+esc(word)+'">'+(saved?'已收藏':'收藏到生词本')+'</button>'
    +'<button class="wd-close">完成</button></div>';
  if(!entry) h+='<div class="wd-miss">词库：'+Object.keys(window.CET6_DICT||{}).length+' 词（开源数据 KyleBing/english-vocabulary）</div>';
  sheet.innerHTML=h;
  $('word-mask').classList.add('open');
  sheet.querySelectorAll('[data-say]').forEach(b=>b.addEventListener('click',()=>speakWord(b.dataset.say,b.dataset.lang)));
  sheet.querySelectorAll('[data-collect]').forEach(b=>b.addEventListener('click',()=>collectWordSheet(b.dataset.collect)));
  sheet.querySelector('.wd-close').addEventListener('click',()=>$('word-mask').classList.remove('open'));
}
function speakWord(word, lang){
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(word);
    u.lang=lang||'en-US'; u.rate=.9;
    speechSynthesis.speak(u);
  }catch(e){ toast('当前环境不支持语音朗读'); }
}
function collectWordSheet(word){
  const low=word.toLowerCase();
  const entry=lookupWord(low);
  const d=(entry && entry[2])? entry[2] : '（词库未收录）';
  const exist=S.words.find(x=>x.w===low);
  if(exist){ exist.n++; toast('已在生词本，频次 +1'); }
  else { S.words.push({w:low, d:d, from:WORD_CTX||'查词收藏', n:1, state:'new'}); toast('已加入生词本'); }
  persist(true);
  const bt=document.querySelector('#word-sheet [data-collect]');
  if(bt){ bt.textContent='已收藏'; bt.classList.add('done'); }
}
document.addEventListener('click', function(e){
  const t=e.target.closest('w, [data-w]');
  if(t){
    const word=t.getAttribute('data-w')||t.textContent.trim();
    let ctx='';
    if(S.learn) ctx=unitById(S.learn.unit).name+' · 第'+(S.learn.idx+1)+'题';
    else if(S.exam) ctx=S.exam.full?('整卷连考 · '+curPaper().label):unitById(S.exam.unitId).name;
    showWordSheet(word, ctx);
  }
});
$('word-mask').addEventListener('click', function(e){ if(e.target===this) this.classList.remove('open'); });

/* ================= 初始化 ================= */
buildNotes();
loadStore();
rebuildStats();
window.addEventListener('beforeunload', function(){ persist(true); });
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='hidden') persist(true); });
if(!location.hash){ location.hash='#/today'; }
handleRoute();
