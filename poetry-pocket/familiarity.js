// Device-local familiarity is independent of favorites and review scheduling.
export const LEVELS={unlearned:{label:'尚未背誦',short:'未背'},familiar:{label:'已背熟',short:'熟'},shaky:{label:'已背過・不太熟',short:'不太熟'},weak:{label:'已背過・很不熟',short:'很不熟'}};
export const SORTS={default:'預設順序',weak:'最不熟優先',familiar:'最熟優先',updated:'最近標記',reviewed:'最近複習'};
const keyOf=(type,id)=>`${type}:${id}`;
const normalized=text=>text.replace(/[\s，。！？；、：,.!?;:“”「」『』]/gu,'');
export function createRegistry(poems,quotes){
 const byKey=new Map(),aliases=new Map(),texts=new Map();
 for(const p of poems)byKey.set(keyOf('poem',p.id),{key:keyOf('poem',p.id),contentId:p.id,contentType:'poem',poem:p});
 // Existing stable pair IDs take precedence over display-only famous-line IDs.
 const ordered=[...quotes].sort((a,b)=>(a.id.includes(':pair:')?0:a.id.includes(':fh:')?1:2)-(b.id.includes(':pair:')?0:b.id.includes(':fh:')?1:2));
 for(const q of ordered){const signature=q.poem.id+'\0'+normalized(q.text);let key=texts.get(signature);if(!key){key=keyOf('quote',q.id);texts.set(signature,key);byKey.set(key,{key,contentId:q.id,contentType:'quote',poem:q.poem,quote:q});}aliases.set(q.id,key);}
 return {byKey,aliases,resolve:(type,id)=>type==='quote'?(aliases.get(id)||keyOf(type,id)):keyOf(type,id)};
}
export function familiarityOf(state,key){return state.familiarity?.records?.[key]?.familiarity||'unlearned';}
export function setFamiliarity(state,refs,value,now=new Date(),review=false){
 if(!Object.hasOwn(LEVELS,value)||!refs.length)throw Error('請選擇內容與有效的熟悉度');
 const next=structuredClone(state);next.familiarity??={version:1,records:{}};
 for(const ref of refs){const previous=next.familiarity.records[ref.key];next.familiarity.records[ref.key]={contentId:ref.contentId,contentType:ref.contentType,familiarity:value,updatedAt:now.toISOString(),...(previous?.lastReviewedAt?{lastReviewedAt:previous.lastReviewedAt}:{}),...(review?{lastReviewedAt:now.toISOString()}:{} )};}
 return next;
}
export function migrateFamiliarity(input,registry){
 const result={version:1,records:{}},put=(type,id,value,date,reviewed)=>{const key=registry.resolve(type,id),ref=registry.byKey.get(key);if(!ref)return;const stamp=date||'1970-01-01T00:00:00.000Z';const old=result.records[key];if(!old||Date.parse(stamp)>Date.parse(old.updatedAt))result.records[key]={contentId:ref.contentId,contentType:type,familiarity:value,updatedAt:stamp,...(reviewed?{lastReviewedAt:reviewed}:{})};};
 if(input.familiarity===undefined){
  for(const [id,p] of Object.entries(input.progress||{}))if(p.reviewCount)put('poem',id,['weak','weak','shaky','familiar'][p.masteryLevel],p.lastReviewed,p.lastReviewed);
  for(const [id,p] of Object.entries(input.lineProgress||{}))if(p.reviewCount||p.status==='mastered')put('quote',id,p.status==='mastered'?'familiar':'weak',p.lastReviewed||p.lastStudied,p.lastReviewed);
  return result;
 }
 const f=input.familiarity;
 if(!f||f.version!==1||!f.records||typeof f.records!=='object'||Array.isArray(f.records)||Object.keys(f.records).length>20000)throw Error('背誦熟悉度資料格式錯誤');
 for(const [storedKey,p] of Object.entries(f.records)){
  if(!p||!['poem','quote'].includes(p.contentType)||typeof p.contentId!=='string'||!/^[\w:.-]{1,200}$/.test(p.contentId)||storedKey!==keyOf(p.contentType,p.contentId)||!Object.hasOwn(LEVELS,p.familiarity))throw Error('背誦熟悉度記錄格式錯誤');
  for(const field of ['updatedAt','lastReviewedAt'])if((field==='updatedAt'||p[field]!==undefined)&&(typeof p[field]!=='string'||!Number.isFinite(Date.parse(p[field]))))throw Error('背誦熟悉度日期格式錯誤');
  const key=registry.resolve(p.contentType,p.contentId),ref=registry.byKey.get(key);const row={contentId:ref?.contentId||p.contentId,contentType:p.contentType,familiarity:p.familiarity,updatedAt:new Date(p.updatedAt).toISOString(),...(p.lastReviewedAt?{lastReviewedAt:new Date(p.lastReviewedAt).toISOString()}:{})};
  // Retain orphan records if a future catalogue temporarily omits a work.
  const old=result.records[key];if(!old||Date.parse(row.updatedAt)>Date.parse(old.updatedAt))result.records[key]=row;
 }return result;
}
export function filterFamiliarity(items,type,state,registry,options={}){
 const key=item=>registry.resolve(type,item.id),levels=options.filters||[];
 const result=items.filter(item=>!levels.length||levels.includes(familiarityOf(state,key(item))));
 const weak={weak:0,shaky:1,unlearned:2,familiar:3},strong={familiar:0,shaky:1,weak:2,unlearned:3};
 const date=(item,field)=>Date.parse(state.familiarity?.records?.[key(item)]?.[field]||'')||0;
 if(options.sort==='weak'||options.sort==='familiar'){const order=options.sort==='weak'?weak:strong;result.sort((a,b)=>order[familiarityOf(state,key(a))]-order[familiarityOf(state,key(b))]);}
 if(options.sort==='updated'||options.sort==='reviewed'){const field=options.sort==='updated'?'updatedAt':'lastReviewedAt';result.sort((a,b)=>date(b,field)-date(a,field));}
 return result;
}
export function familiarityCounts(registry,state,type){const count={unlearned:0,familiar:0,shaky:0,weak:0};for(const ref of registry.byKey.values())if(ref.contentType===type)count[familiarityOf(state,ref.key)]++;return count;}
