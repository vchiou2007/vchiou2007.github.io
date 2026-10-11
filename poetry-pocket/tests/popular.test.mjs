import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePoems,searchPoems,pairEntries,defaults,applyReview} from '../core.js';
import {libraryView} from '../views.js';
import {catalogueView,pairsView,filterPairs} from '../explorer.js';

const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));

test('熱門標籤與作品統計：剛好 35 篇（18 篇既有 + 17 篇新增）',()=>{
 const popularList=poems.filter(p=>(p.tags||[]).includes('熱門'));
 assert.equal(popularList.length,35,'剛好 35 篇標記為熱門');
 assert.equal(new Set(popularList.map(p=>p.id)).size,35,'熱門作品 ID 完全不重複');
 
 // 檢查經典既有作品是否包含在熱門中
 assert.ok(popularList.some(p=>p.title==='早發白帝城'),'早發白帝城在熱門中');
 assert.ok(popularList.some(p=>p.title==='黃鶴樓送孟浩然之廣陵'),'黃鶴樓送孟浩然之廣陵在熱門中');
 assert.ok(popularList.some(p=>p.id==='yue-man'),'岳飛滿江紅在熱門中');
 assert.ok(popularList.some(p=>p.id==='xin-po'),'辛棄疾破陣子在熱門中');
 
 // 檢查新增作品是否包含在熱門中
 assert.ok(popularList.some(p=>p.title==='清明'&&p.author==='杜牧'),'杜牧清明在熱門中');
 assert.ok(popularList.some(p=>p.title==='岳陽樓記'&&p.author==='范仲淹'),'岳陽樓記在熱門中');
 assert.ok(popularList.some(p=>p.title==='滕王閣序'&&p.author==='王勃'),'滕王閣序在熱門中');
 assert.ok(popularList.some(p=>p.title==='江城子·密州出獵'&&p.author==='蘇軾'),'江城子在熱門中');
});

test('熱門篩選功能：選擇「熱門」時只顯示熱門作品，選擇「全部」顯示 518 篇',()=>{
 const allFound=searchPoems(poems,'','');
 assert.equal(allFound.length,518,'未篩選時顯示全部 518 篇');
 
 const popFound=searchPoems(poems,'','熱門');
 assert.equal(popFound.length,35,'篩選「熱門」時只返回 35 篇熱門作品');
 assert.ok(popFound.every(p=>(p.tags||[]).includes('熱門')),'返回之作品皆含熱門標籤');

 const popEmojiFound=searchPoems(poems,'','🔥 熱門');
 assert.equal(popEmojiFound.length,35,'支援帶有 🔥 之熱門字串篩選');
 
 const tangFound=searchPoems(poems,'','唐詩');
 assert.equal(tangFound.length,307,'原有唐詩篩選依然正常運作');
});

test('隨身詩集 libraryView 畫面提供「🔥 熱門」篩選晶片按鈕',()=>{
 const html=libraryView(poems,'','');
 assert.ok(html.includes('🔥 熱門'),'介面中呈現 🔥 熱門 按鈕');
 assert.ok(html.includes('data-value="熱門"'),'按鈕正確設定 data-value="熱門"');
 
 const popHtml=libraryView(poems,'','熱門');
 assert.ok(popHtml.includes('35 首作品'),'切換熱門後正確計算 35 首作品');
});

test('兩句名句選 pairsView 與 filterPairs 支援「🔥 熱門」篩選',()=>{
 const state=defaults();
 const popPairs=filterPairs(poems,state,{type:'熱門',theme:'',query:'',saved:false});
 assert.ok(popPairs.length>0,'成功篩選出熱門名句');
 assert.ok(popPairs.every(q=>(q.poem.tags||[]).includes('熱門')),'熱門名句全部出自熱門作品');
 
 const pairsHtml=pairsView(poems,state,{type:'熱門',theme:'',query:'',saved:false});
 assert.ok(pairsHtml.includes('🔥 熱門名句'),'名句選中含有 🔥 熱門名句 選項');
});

test('熱門作品詩詞卡與學習進度無損相容性',()=>{
 const state=defaults();
 const liZaoId='li-zao';
 const updatedState=applyReview(state,liZaoId,3);
 assert.equal(updatedState.progress[liZaoId].masteryLevel,3,'學習進度正確寫入');
 assert.equal(updatedState.progress[liZaoId].reviewCount,1,'複習次數遞增');
});
