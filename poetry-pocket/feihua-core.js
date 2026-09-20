import {familiarityOf} from './familiarity.js';
export const han=c=>/^\p{Script=Han}$/u.test(c);
export const validKeyword=c=>typeof c==='string'&&[...c].length===1&&han(c);
export function lineEntries(poems){return poems.flatMap(poem=>(poem.studyLines||[]).map(s=>{const parts=s.indices.map(i=>poem.lines[i]);return {...s,poem,kind:'feihua',lines:[parts.slice(0,s.split).join(''),parts.slice(s.split).join('')],text:parts.join('')};}));}
export function validateKeywords(keywords,entries){
 const ids=new Map(entries.map(q=>[q.id,q]));
 if(!Array.isArray(keywords)||new Set(keywords.map(k=>k.character)).size!==keywords.length)throw Error('飛花令索引格式錯誤');
 for(const k of keywords)if(!validKeyword(k.character)||!Array.isArray(k.lineIds)||new Set(k.lineIds).size!==k.lineIds.length||k.lineIds.some(id=>!ids.get(id)?.text.includes(k.character)))throw Error('飛花令名句引用錯誤');
 return keywords;
}
export function selectLines(entries,keywords,character,state,filter='all',now=new Date(),registry=null){
 const k=keywords.find(k=>k.character===character),byId=new Map(entries.map(q=>[q.id,q]));
 let found=k?k.lineIds.map(id=>byId.get(id)).filter(Boolean):entries.filter(q=>q.text.includes(character));
 found=found.filter(q=>{const p=state.lineProgress?.[q.id];return filter==='favorite'?state.quotes.includes(q.id):filter==='recent'?Boolean(p?.lastStudied):filter==='unmastered'?['weak','shaky'].includes(familiarityOf(state,registry?.resolve('quote',q.id)||'quote:'+q.id)):filter==='due'?Boolean(p?.nextReview&&Date.parse(p.nextReview)<=now.getTime()):true;});
 if(filter==='recent')found.sort((a,b)=>Date.parse(state.lineProgress[b.id].lastStudied)-Date.parse(state.lineProgress[a.id].lastStudied));
 return found;
}
export function maskExcerpt(lines,stage){
 if(stage===5)return [];
 return lines.map(line=>{let n=0;return [...line].map(c=>{if(!han(c))return c;n++;const hide=stage===4?n>1:stage===3?(n%3===0||n%2===0):stage===2?n%3===0:false;return hide?'＿':c;}).join('');});
}
const addDays=(now,days)=>{const d=new Date(now);d.setDate(d.getDate()+days);return d.toISOString();};
export function learnLine(state,id,action='start',now=new Date()){
 const next=structuredClone(state);next.lineProgress??={};
 const old=next.lineProgress[id]||{status:'unlearned',reviewCount:0,intervalStep:0};
 let p={...old,lastStudied:now.toISOString()};
 if(action==='start'){if(p.status==='unlearned')p.status='learning';p.nextReview??=addDays(now,1);}
 else if(action==='reset'){p={status:'unlearned',reviewCount:0,intervalStep:0,lastStudied:now.toISOString()};}
 else {const forgotten=action==='forgot';const step=forgotten?Math.max(0,old.intervalStep-1):Math.min(old.reviewCount?old.intervalStep+1:0,4);p={...p,status:forgotten?'learning':'mastered',intervalStep:step,reviewCount:old.reviewCount+1,lastReviewed:now.toISOString(),nextReview:forgotten?new Date(now.getTime()+600000).toISOString():addDays(now,[1,3,7,14,30][step])};}
 next.lineProgress[id]=p;return next;
}
export function cleanLineProgress(value,entries){
 if(value===undefined)return {};
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('飛花令進度格式錯誤');
 const ids=new Set(entries.map(q=>q.id)),clean={};
 for(const [id,p] of Object.entries(value)){
  if(!ids.has(id)||!p||!['unlearned','learning','mastered'].includes(p.status)||!Number.isInteger(p.reviewCount)||p.reviewCount<0||p.reviewCount>100000||!Number.isInteger(p.intervalStep)||p.intervalStep<0||p.intervalStep>4)throw Error('飛花令進度格式錯誤');
  const row={status:p.status,reviewCount:p.reviewCount,intervalStep:p.intervalStep};
  for(const key of ['lastStudied','lastReviewed','nextReview'])if(p[key]!==undefined){if(typeof p[key]!=='string'||!Number.isFinite(Date.parse(p[key])))throw Error('飛花令複習日期格式錯誤');row[key]=new Date(p[key]).toISOString();}
  if(p.reviewCount&&(!row.lastReviewed||!row.nextReview))throw Error('飛花令缺少複習日期');clean[id]=row;
 }return clean;
}
export function dueSummary(entries,keywords,state,now=new Date()){
 const due=new Set(entries.filter(q=>state.lineProgress?.[q.id]?.nextReview&&Date.parse(state.lineProgress[q.id].nextReview)<=now.getTime()).map(q=>q.id));
 return {total:due.size,groups:keywords.map(k=>({character:k.character,count:k.lineIds.filter(id=>due.has(id)).length})).filter(k=>k.count)};
}
