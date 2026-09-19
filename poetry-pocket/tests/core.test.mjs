import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as core from '../core.js';
import * as views from '../views.js';
const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));
test('20 首來源資料與臺灣注音可解析',()=>{
  assert.equal(core.validatePoems(poems).length,20);
  assert.equal(new Set(poems.map(p=>p.id)).size,20);
  for(const p of poems){assert.ok(p.background.length>=100&&p.background.length<=250);for(const q of p.famousLines)assert.ok(p.lines.join('').includes(q));}
});
test('明確拒絕平假名、片假名、半形假名及拼音',()=>{
  for(const input of ['ㄅㄧㄣˋ','ㄏㄨㄟ','ㄑㄩㄝˋ','ㄓˋ'])assert.equal(core.isZhuyin(input),true);
  for(const input of ['びん','ビン','ﾋﾞﾝ','bin','bìn','ㄅㄧㄣˋあ','ˋ',''])assert.equal(core.isZhuyin(input),false);
  const invalid=structuredClone(poems);invalid[0].difficultCharacters[0].zhuyin='ビン';assert.throws(()=>core.validatePoems(invalid));
});
test('搜尋涵蓋作者、原文、朝代、景點及多詞交集',()=>{
  assert.equal(core.searchPoems(poems,'蘇軾').length,3);assert.equal(core.searchPoems(poems,'蘇軾 明月').length,2);
  assert.equal(core.searchPoems(poems,'','唐詩').length,12);assert.equal(core.searchPoems(poems,'宋').length,8);
  assert.equal(core.searchPoems(poems,'黃鶴樓')[0].id,'li-huang');assert.equal(core.searchPoems(poems,'','寒山寺')[0].id,'zhang-feng');
  assert.equal(core.searchPoems(poems,'  ').length,20);assert.equal(core.searchPoems(poems,'不在詩集').length,0);
});
test('今日推薦在同一本地日期維持一致',()=>{assert.equal(core.dailyPoem(poems,new Date(2026,8,19,1)).id,core.dailyPoem(poems,new Date(2026,8,19,23)).id);});
test('詩詞與名句收藏獨立、不污染原始狀態或新增複習',()=>{
  const initial=core.defaults(),first=core.togglePoem(initial,'li-jing'),second=core.toggleQuote(first,'li-jing:0');
  assert.deepEqual(initial.progress,{});assert.equal(first.progress['li-jing'].reviewCount,0);
  assert.equal(second.progress['li-jing'].isFavorite,true);assert.deepEqual(second.quotes,['li-jing:0']);
  assert.equal(core.togglePoem(second,'li-jing').quotes.length,1);assert.equal(core.toggleQuote(second,'li-jing:0').quotes.length,0);
});
test('四級排程、十分鐘邊界與複習紀錄正確',()=>{
  const now=new Date(2026,8,19,12),expected=[600000,86400000,259200000,604800000];
  for(let i=0;i<4;i++)assert.equal(Date.parse(core.nextReviewDate(i,0,now))-now.getTime(),expected[i]);
  const initial=core.togglePoem(core.defaults(),'li-jing'),reviewed=core.applyReview(initial,'li-jing',0,now);
  assert.equal(reviewed.progress['li-jing'].isFavorite,true);assert.equal(reviewed.events.length,1);assert.equal(reviewed.progress['li-jing'].reviewCount,1);
  assert.equal(core.duePoems(poems,reviewed,new Date(now.getTime()+599999)).length,19);
  assert.equal(core.duePoems(poems,reviewed,new Date(now.getTime()+600000)).length,20);
  const capped=new Date(now);capped.setDate(capped.getDate()+56);
  assert.equal(core.nextReviewDate(3,999,now),capped.toISOString());
  assert.throws(()=>core.nextReviewDate(4,0,now));
});
test('跨日光節約時間仍維持同一本地複習時刻',()=>{
  const now=new Date(2026,2,7,12,15),next=new Date(core.nextReviewDate(1,0,now));
  assert.equal(next.getDate(),8);assert.equal(next.getHours(),12);assert.equal(next.getMinutes(),15);
});
test('逐句與挖字遮罩不把答案放進按鈕的無障礙文字',()=>{
  const p=poems.find(p=>p.id==='xin-po');
  assert.equal(core.maskLine('夢回吹角連營。','words',0),'夢回＿角連＿。');
  const html=views.practiceView(p,core.defaults(),{mode:'lines',revealed:new Set(),submitted:false,rating:false});
  assert.ok(!html.includes('夢回吹角連營。'));assert.ok(html.includes('＿＿＿＿＿＿'));
  const revealed=views.practiceView(p,core.defaults(),{mode:'lines',revealed:new Set([1]),submitted:false,rating:false});assert.ok(revealed.includes('夢回吹角連營。'));
});
test('備份 JSON round-trip 保留收藏、進度與偏好',()=>{
  let state=core.toggleQuote(core.togglePoem(core.defaults(),'li-jing'),'li-jing:0');state=core.applyReview(state,'li-jing',2,new Date());
  state.settings.theme='moon';assert.deepEqual(core.validateBackup(JSON.parse(JSON.stringify(state)),poems),state);
});
test('匯入拒絕不明作品、無效時間、惡意設定與損壞格式',()=>{
  const good=core.applyReview(core.defaults(),'li-jing',2);
  const mutations=[s=>s.schemaVersion=999,s=>s.progress['unknown']=s.progress['li-jing'],s=>s.progress['li-jing'].lastReviewed='not-a-date',s=>s.settings.size='huge',s=>s.settings.theme='constructor',s=>s.quotes.push('fake:0'),s=>s.events[0].rating=99];
  for(const mutation of mutations){const bad=structuredClone(good);mutation(bad);assert.throws(()=>core.validateBackup(bad,poems));}
});
test('文字輸出轉義，搜尋內容不插入可執行 HTML',()=>{
  const html=views.libraryView(poems,'"><img src=x onerror=alert(1)>','');
  assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));assert.equal(core.escapeHTML("<&'\""),'&lt;&amp;&#39;&quot;');
});
test('每個分頁可產生實質內容且含導覽與觸控語意',()=>{
  const state=core.defaults();
  const outputs=[views.todayView(poems,state,'ready'),views.libraryView(poems,'',''),views.quotesView(poems,state,0),views.studyView(poems,state),views.favoritesView(poems,state,'poems'),views.readerView(poems[0],state),views.progressView(poems,state),views.categoriesView(poems,'locations')];
  for(const output of outputs){assert.ok(output.length>100);assert.ok(!output.includes('undefined'));assert.ok(!output.includes('NaN'));}
  assert.equal((views.shell(outputs[0],'today').match(/aria-current="page"/g)||[]).length,1);
});
