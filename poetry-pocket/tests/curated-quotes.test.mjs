import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pairEntries,quoteEntries,defaults,validateBackup} from '../core.js';
import {pairPracticeView} from '../explorer.js';
const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));
const legacy=poems.map(({curatedPairs,...p})=>p);
const all=pairEntries(poems),added=all.filter(q=>q.explanation);
test('追加47組且全部舊名句ID和內容不變',()=>{
 assert.equal(added.length,47);assert.equal(all.length,1083);
 const now=new Map(quoteEntries(poems).map(q=>[q.id,q.text]));
 for(const old of quoteEntries(legacy))assert.equal(now.get(old.id),old.text);
 assert.deepEqual(all.slice(0,1036).map(q=>q.id),pairEntries(legacy).map(q=>q.id));
 for(const q of all){assert.ok(all.some(x=>x.id===q.previous));assert.ok(all.some(x=>x.id===q.next));}
});
test('新舊名句收藏備份可還原，舊作品收藏不受影響',()=>{
 const s=defaults();s.quotes=[all[0].id,added[0].id];
 s.progress[poems[0].id]={isFavorite:true,reviewCount:0,masteryLevel:0};
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s)),poems),s);
});
test('兩句未全揭曉時不洩漏解析；全揭曉後顯示來源、白話和賞析',()=>{
 const q=added[0],s=defaults();
 const hidden=pairPracticeView(q,s,{mode:'next',revealed:new Set()});
 assert.ok(!hidden.includes(q.explanation.meaning));assert.ok(!hidden.includes(q.explanation.analysis));
 const shown=pairPracticeView(q,s,{mode:'next',revealed:new Set([1])});
 for(const text of [q.explanation.meaning,q.explanation.analysis,'核讀','字詞與典故','入選依據與查證來源'])assert.ok(shown.includes(text));
 assert.ok(shown.includes('rel="noopener noreferrer"'));
 const old=pairPracticeView(all[0],s,{mode:'read',revealed:new Set()});
 assert.ok(!old.includes('名句解析'));
});
test('解析文字跳脫HTML，拒絕非HTTPS來源連結及重複ID／越界句',()=>{
 const q=structuredClone(added[0]);q.explanation.meaning='<script>alert(1)</script>';
 q.explanation.sources=[{url:'javascript:alert(1)',title:'bad'}];
 const html=pairPracticeView(q,defaults(),{mode:'read',revealed:new Set()});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('href="javascript:'));
 for(const mutate of [p=>p.curatedPairs.push(p.curatedPairs[0]),p=>p.curatedPairs[0].indices=[0,99999]]){
  const bad=structuredClone(poems);mutate(bad.find(p=>p.curatedPairs?.length));
  assert.throws(()=>pairEntries(bad),/新增名句格式錯誤/);
 }
});
