import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,quoteEntries,validateBackup,applyReview,toggleQuote,togglePoem} from '../core.js';
import {createRegistry,setFamiliarity,familiarityOf,migrateFamiliarity,filterFamiliarity,familiarityCounts} from '../familiarity.js';
import {configureFamiliarity,badge,managerView,filterItems} from '../familiarity-ui.js';
import * as views from '../views.js';
import * as explorer from '../explorer.js';
import {lineEntries,selectLines} from '../feihua-core.js';
const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));
const quotes=quoteEntries(poems),registry=createRegistry(poems,quotes),stamp=new Date('2026-09-20T10:00:00Z');
const ref=(type,id)=>registry.byKey.get(registry.resolve(type,id));
const options=()=>({filters:[],sort:'default',batch:false,selected:[]});
test('作品全 App 共用、名句獨立，同文不同入口合併成穩定 ID',()=>{
 const q=quotes.find(q=>q.id==='li-jing:pair:1');let s=setFamiliarity(defaults(),[ref('poem','li-jing')],'familiar',stamp);
 s=setFamiliarity(s,[ref('quote',q.id)],'weak',stamp);assert.equal(familiarityOf(s,'poem:li-jing'),'familiar');assert.equal(familiarityOf(s,registry.resolve('quote',q.id)),'weak');
 for(const x of quotes.filter(x=>x.poem.id===q.poem.id&&x.text===q.text))assert.equal(registry.resolve('quote',x.id),registry.resolve('quote',q.id));
 configureFamiliarity(s,registry,options());for(const html of [views.libraryView(poems,'靜夜思',''),explorer.catalogueView(poems,s,{query:'靜夜思',type:'',theme:'',sort:'default',selected:[]}),views.readerView(q.poem,s),explorer.pairPracticeView(q,s,{mode:'read',revealed:new Set()}),views.libraryView(poems,'','李白')])assert.ok(html.includes('fam-badge fam-familiar'));
 assert.ok(badge('quote',q.id).includes('fam-weak'));
});
test('紅黃複選、五種排序與統計不把灰色納入全部未熟',()=>{
 const sample=poems.slice(0,4);let s=defaults();for(const [i,level] of ['familiar','unlearned','shaky','weak'].entries())s=setFamiliarity(s,[ref('poem',sample[i].id)],level,new Date(stamp.getTime()+i*1000),i===0);
 const ids=o=>filterFamiliarity(sample,'poem',s,registry,o).map(p=>p.id);
 assert.deepEqual(ids({filters:['weak','shaky']}),[sample[2].id,sample[3].id]);
 assert.deepEqual(ids({sort:'weak'}),[sample[3].id,sample[2].id,sample[1].id,sample[0].id]);
 assert.deepEqual(ids({sort:'familiar'}),[sample[0].id,sample[2].id,sample[3].id,sample[1].id]);
 assert.equal(ids({sort:'updated'})[0],sample[3].id);assert.equal(ids({sort:'reviewed'})[0],sample[0].id);
 const stats=familiarityCounts(registry,s,'poem');assert.equal(stats.familiar,1);assert.equal(stats.unlearned,498);
});
test('批次只修改指定層級、收藏與排程不變，清除仍保留複習時間',()=>{
 let s=applyReview(defaults(),'li-jing',3,stamp);s=togglePoem(s,'li-jing');s=toggleQuote(s,'li-jing:pair:1');const original=structuredClone(s);
 const changed=setFamiliarity(s,poems.slice(0,100).map(p=>ref('poem',p.id)),'weak',stamp);
 assert.equal(familiarityCounts(registry,changed,'poem').weak,100);assert.deepEqual(changed.progress,s.progress);assert.deepEqual(changed.quotes,s.quotes);assert.deepEqual(s,original);
 const clear=setFamiliarity(changed,[ref('poem','li-jing')],'unlearned',stamp);assert.equal(clear.familiarity.records['poem:li-jing'].lastReviewedAt,stamp.toISOString());assert.equal(familiarityOf(validateBackup(clear,poems),'poem:li-jing'),'unlearned');
});
test('舊備份無損 migration、重新載入與 JSON 往返保留所有標記',()=>{
 const old=defaults();delete old.familiarity;old.progress['li-jing']={reviewCount:3,isFavorite:true,masteryLevel:2,lastReviewed:stamp.toISOString(),nextReviewDate:stamp.toISOString()};old.lineProgress['li-jing:pair:1']={status:'mastered',reviewCount:2,intervalStep:1,lastReviewed:stamp.toISOString(),lastStudied:stamp.toISOString(),nextReview:stamp.toISOString()};old.quotes=['li-jing:pair:1'];
 const migrated=validateBackup(old,poems);assert.equal(familiarityOf(migrated,'poem:li-jing'),'shaky');assert.equal(familiarityOf(migrated,registry.resolve('quote','li-jing:pair:1')),'familiar');assert.deepEqual(migrated.progress,old.progress);assert.deepEqual(migrated.lineProgress,old.lineProgress);assert.deepEqual(migrated.quotes,old.quotes);
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(migrated)),poems),migrated);
 const retained={...migrated,familiarity:{version:1,records:{...migrated.familiarity.records,'poem:future-work':{contentId:'future-work',contentType:'poem',familiarity:'weak',updatedAt:stamp.toISOString()}}}};assert.ok(validateBackup(retained,poems).familiarity.records['poem:future-work']);
 assert.throws(()=>migrateFamiliarity({...old,familiarity:{version:99,records:{}}},registry));
});
test('飛花令只看不熟為紅黃，管理中心與收藏使用同一名句狀態',()=>{
 const entries=lineEntries(poems),q=entries.find(q=>q.text.includes('舉頭望明月'));let s=setFamiliarity(defaults(),[ref('quote',q.id)],'shaky',stamp);s=toggleQuote(s,q.id);
 const selected=selectLines(entries,[],'月',s,'unmastered',stamp,registry);assert.equal(selected.length,1);assert.equal(selected[0].id,q.id);
 configureFamiliarity(s,registry,{...options(),filters:['shaky','weak']});assert.ok(managerView('quote').includes('符合 1 項'));assert.ok(views.favoritesView(poems,s,'quotes').includes('fam-badge fam-shaky'));
 assert.equal(filterItems(entries,'quote').length,1);configureFamiliarity(defaults(),registry,options());
});

test('可切換已背過在前或未背在前，黃紅綠均屬已背過且同組保持順序',()=>{
 const sample=poems.slice(0,4);let s=defaults();for(const [i,level] of ['familiar','unlearned','shaky','weak'].entries())s=setFamiliarity(s,[ref('poem',sample[i].id)],level,stamp);
 const sorted=sort=>filterFamiliarity(sample,'poem',s,registry,{sort}).map(p=>p.id);
 assert.deepEqual(sorted('learnedFirst'),[sample[0].id,sample[2].id,sample[3].id,sample[1].id]);
 assert.deepEqual(sorted('unlearnedFirst'),[sample[1].id,sample[0].id,sample[2].id,sample[3].id]);
});
