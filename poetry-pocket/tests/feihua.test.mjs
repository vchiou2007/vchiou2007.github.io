import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lineEntries,validateKeywords,selectLines,maskExcerpt,learnLine,dueSummary,validKeyword} from '../feihua-core.js';
import {defaults,validateBackup,quoteEntries,pairEntries} from '../core.js';
import {compareRecitation,toZhuyin,readingFor,RecitationRecognition} from '../recitation.js';
import {cardView,indexView} from '../feihua-views.js';
const poems=JSON.parse(readFileSync(new URL('../data/poems.json',import.meta.url),'utf8'));
const keywords=JSON.parse(readFileSync(new URL('../data/feihua-keywords.json',import.meta.url),'utf8'));
const entries=lineEntries(poems),state=defaults(),now=new Date('2026-09-19T12:00:00Z');
test('262 組來源引用完整且不複製原文；20 個關鍵字各有 20–50 組',()=>{
 assert.equal(entries.length,262);assert.equal(new Set(entries.map(q=>q.id)).size,262);validateKeywords(keywords,entries);assert.equal(keywords.length,20);
 for(const q of entries){assert.equal(q.lines.length,2);assert.ok(q.lines.every(Boolean));assert.ok(q.poem.lines.join('').includes(q.text));assert.ok(q.explanation.length>=12);const raw=q.poem.studyLines.find(s=>s.id===q.id);assert.ok(!('text' in raw));assert.ok(!('lines' in raw));}
 for(const k of keywords)assert.ok(k.lineIds.length>=20&&k.lineIds.length<=50);
 const moon=selectLines(entries,keywords,'月',state).map(q=>q.text).join('');for(const text of ['舉頭望明月','海上生明月','明月幾時有','春風又綠江南岸','秦時明月'])assert.ok(moon.includes(text));
 assert.ok(selectLines(entries,keywords,'秋',state).length);assert.ok(validKeyword('秋'));assert.ok(!validKeyword('秋月'));assert.ok(!validKeyword('<'));
});
test('舊收藏編號復用，跨字收藏與進度只有一份，備份兼容舊版',()=>{
 const q=entries.find(q=>q.text.includes('春風又綠'));assert.ok(q);
 let s=learnLine(state,q.id,'start',now);s.quotes.push(q.id);
 assert.ok(selectLines(entries,keywords,'月',s,'favorite').some(x=>x.id===q.id));assert.ok(selectLines(entries,keywords,'江',s,'recent').some(x=>x.id===q.id));
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s)),poems),s);
 const legacy=defaults();delete legacy.lineProgress;assert.deepEqual(validateBackup(legacy,poems).lineProgress,{});
 assert.equal(quoteEntries(poems).filter(x=>x.id===q.id).length,1);
 for(const p of pairEntries(poems)){const match=entries.find(q=>q.poem.id===p.poem.id&&q.text===p.text);if(match)assert.equal(match.id,p.id);}
 assert.throws(()=>validateBackup({...s,lineProgress:{bad:s.lineProgress[q.id]}},poems));
 assert.throws(()=>validateBackup({...s,lineProgress:{[q.id]:{...s.lineProgress[q.id],nextReview:'bad'}}},poems));
});
test('五階段遮蔽漸進，完全隱藏時 HTML 與無障礙文字都不洩漏答案',()=>{
 const q=entries.find(q=>q.text.includes('春風又綠'));
 for(let i=1;i<4;i++)assert.ok(maskExcerpt(q.lines,i+1).join('').split('＿').length>=maskExcerpt(q.lines,i).join('').split('＿').length);
 assert.deepEqual(maskExcerpt(q.lines,5),[]);
 const html=cardView(q,'月',state,{practice:true,stage:5,revealed:false},0,20,'all',{supported:false});assert.ok(!html.includes('春風又'));assert.ok(!html.includes(q.explanation));assert.ok(!html.includes('data-act="fh-speak"'));assert.ok(html.includes('自行核對'));
 const shown=cardView(q,'月',state,{practice:true,stage:5,revealed:true},0,20,'all',{supported:false});assert.ok(shown.includes(q.explanation));assert.ok(shown.includes('<mark>月</mark>'));
 assert.ok(!indexView(entries,keywords,state).includes('undefined'));
});
test('排程 1、3、7、14、30 天，遺忘縮短、重設清除，今日總數去重',()=>{
 const q=entries.find(q=>q.text.includes('春風又綠'));let s=learnLine(state,q.id,'start',now);
 assert.equal(s.lineProgress[q.id].status,'learning');
 for(const days of [1,3,7,14,30,30]){s=learnLine(s,q.id,'familiar',now);assert.equal(Date.parse(s.lineProgress[q.id].nextReview)-now.getTime(),days*86400000);}
 s=learnLine(s,q.id,'forgot',now);assert.equal(Date.parse(s.lineProgress[q.id].nextReview)-now.getTime(),600000);assert.equal(s.lineProgress[q.id].status,'learning');
 const due=dueSummary(entries,keywords,s,new Date(now.getTime()+600001));assert.equal(due.total,1);assert.ok(due.groups.length>1);
 s=learnLine(s,q.id,'reset',now);assert.equal(s.lineProgress[q.id].nextReview,undefined);assert.equal(Object.keys(state.lineProgress).length,0);
});
test('語音以對齊偵測漏字，同音字與繁簡字標為待確認而非誤判失敗',()=>{
 assert.ok(compareRecitation('明月何時照我還。','明月何時照我還').correct);
 const missing=compareRecitation('春風又綠江南岸','春風又江南岸');assert.deepEqual(missing.marks,['correct','correct','correct','missing','correct','correct','correct']);
 const similar=compareRecitation('明月何時照我還','明月何时照我还');assert.ok(similar.similar);assert.ok(!similar.correct);
 assert.ok(!compareRecitation('明月','明月光').similar);assert.ok(!compareRecitation('明月','').correct);
 assert.equal(toZhuyin('huan2'),'ㄏㄨㄢˊ');assert.equal(toZhuyin('yue4'),'ㄩㄝˋ');assert.equal(toZhuyin('shi1'),'ㄕ');assert.equal(toZhuyin('lv4'),'ㄌㄩˋ');
 const q=entries.find(q=>q.text.includes('春風又綠'));assert.equal(readingFor(q,[...q.text].indexOf('還')).zhuyin,'ㄏㄨㄢˊ');
});
test('辨識只在 start 後啟動，取消後的舊回呼無效，無支援時可降級',()=>{
 const instances=[],results=[],errors=[];class Fake{constructor(){instances.push(this);}start(){this.started=true;}abort(){this.aborted=true;}}
 const r=new RecitationRecognition(t=>results.push(t),()=>{},e=>errors.push(e),Fake);assert.equal(instances.length,0);r.start();const old=instances[0];assert.equal(old.lang,'zh-TW');r.cancel();old.onresult({results:[Object.assign([{transcript:'舊句'}],{isFinal:true})]});assert.equal(results.length,0);
 r.start();instances[1].onresult({results:[Object.assign([{transcript:'明月'}],{isFinal:true})]});assert.deepEqual(results,['明月']);
 const unsupported=new RecitationRecognition(()=>{},()=>{},e=>errors.push(e),null);unsupported.start();assert.equal(unsupported.supported,false);assert.equal(errors.length,1);
});
