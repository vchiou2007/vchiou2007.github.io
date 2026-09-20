import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePoems,pairEntries,defaults,validateBackup,searchPoems} from '../core.js';
import {catalogueView,pairsView} from '../explorer.js';
const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));
const audit=JSON.parse(readFileSync(new URL('../CONTENT_EXPANSION.json',import.meta.url),'utf8'));
test('500 首具有唯一編號：300 首唐詩與 200 首宋詞，來源逐筆可追溯',()=>{
 assert.equal(validatePoems(poems).length,500);assert.equal(poems.filter(p=>p.type==='唐詩').length,300);assert.equal(poems.filter(p=>p.type==='宋詞').length,200);
 assert.equal(new Set(poems.map(p=>p.id)).size,500);assert.equal(audit.added.length,480);
 for(const p of poems.slice(20)){assert.ok(audit.added.some(a=>a.id===p.id&&a.source===p.source));assert.ok(p.translation.includes('尚未'));assert.ok(p.lines.length>=4);assert.ok(!/[�□]/.test(p.lines.join('')));}
 assert.ok(searchPoems(poems,'登鸛雀樓').some(p=>p.author==='王之渙'));assert.ok(searchPoems(poems,'雨霖').some(p=>p.author==='柳永'));
});
test('1,000 組兩句選摘都有完整原文，沒有空白或越界',()=>{
 const pairs=pairEntries(poems);assert.equal(pairs.length,1000);assert.equal(new Set(pairs.map(q=>q.id)).size,1000);
 for(const q of pairs){assert.ok(q.lines.every(l=>typeof l==='string'&&l.length>0));assert.ok(q.poem.lines.join('').includes(q.text));}
});
test('擴充後保留舊備份與新作品收藏，所有作品可出現在總覽',()=>{
 const state=defaults();state.quotes=['li-jing:0','li-jing:pair:1',poems[20].id+':pair:0'];
 state.progress['li-jing']={reviewCount:0,masteryLevel:0,isFavorite:true};
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state)),poems),state);
 const html=catalogueView(poems,state,{query:'',type:'',theme:'',sort:'default',selected:[]});assert.ok(html.includes('500 首'));assert.ok(!html.includes('undefined'));
 const pairs=pairsView(poems,state,{query:'',type:'',theme:'',saved:false});assert.ok(pairs.includes('1000 組'));assert.ok(!pairs.includes('undefined'));
});
