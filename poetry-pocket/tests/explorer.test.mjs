import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,pairEntries,validateBackup,toggleQuote} from '../core.js';
import {catalogueRows,catalogueView,quickPicker,filterPairs,pairPracticeView,wordCount} from '../explorer.js';
const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));
test('40 組語意選摘，每組兩行且連續出自原文，編號唯一、前後導覽成環',()=>{
 const all=pairEntries(poems);assert.equal(all.length,40);assert.equal(new Set(all.map(q=>q.id)).size,40);
 for(const q of all){assert.equal(q.lines.length,2);assert.ok(q.lines.every(Boolean));assert.ok(q.poem.lines.join('').includes(q.text));assert.equal(all.find(n=>n.id===q.next).previous,q.id);}
});
test('總覽篩選、短篇排序與跨類型比較保留真實篇幅',()=>{
 const state=defaults();const tang=catalogueRows(poems,state,{type:'唐詩',sort:'short'});
 assert.equal(tang.length,12);assert.ok(tang.every((p,i)=>!i||wordCount(p)>=wordCount(tang[i-1])));
 assert.equal(catalogueRows(poems,state,{query:'蘇軾',type:'宋詞'}).length,3);
 const html=catalogueView(poems,state,{query:'',type:'',theme:'',sort:'default',selected:['li-jing','su-shui']});
 assert.ok(html.includes('並排比較'));assert.ok(html.includes('已選 2 / 4'));assert.ok(html.includes('20 字'));assert.ok(quickPicker(poems).includes('40 組'));
});
test('新兩句收藏與舊名句收藏均可匯出匯入',()=>{
 const state=toggleQuote(toggleQuote(defaults(),'li-jing:0'),'li-jing:pair:1');
 const restored=validateBackup(JSON.parse(JSON.stringify(state)),poems);
 assert.deepEqual(restored.quotes,state.quotes);
 assert.equal(filterPairs(poems,restored,{query:'',type:'',theme:'',saved:true}).length,1);
 assert.equal(filterPairs(poems,state,{query:'舉頭',type:'宋詞',theme:'',saved:false}).length,0);
});
test('接句練習隱藏答案而非只用 CSS 遮住，揭曉後才可朗讀',()=>{
 const q=pairEntries(poems).find(q=>q.id==='li-jing:pair:1');
 const hidden=pairPracticeView(q,defaults(),{mode:'next',revealed:new Set()});
 assert.ok(hidden.includes(q.lines[0]));assert.ok(!hidden.includes(q.lines[1]));assert.ok(hidden.includes('disabled'));
 const visible=pairPracticeView(q,defaults(),{mode:'next',revealed:new Set([1])});assert.ok(visible.includes(q.lines[1]));assert.ok(!visible.includes('disabled'));
 const reverse=pairPracticeView(q,defaults(),{mode:'previous',revealed:new Set()});assert.ok(!reverse.includes(q.lines[0]));assert.ok(reverse.includes(q.lines[1]));
});
