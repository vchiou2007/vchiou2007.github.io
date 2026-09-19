import test from 'node:test';
import assert from 'node:assert/strict';
import {PoetrySpeech} from '../speech.js';
const voices=[{name:'中文',lang:'zh-CN',localService:true},{name:'臺灣中文',lang:'zh-TW',localService:true}];
let queued=[],paused=false,canceled=0;
globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
globalThis.speechSynthesis={getVoices:()=>voices,speak:u=>queued.push(u),cancel:()=>canceled++,pause:()=>paused=true,resume:()=>paused=false};
test('保留臺灣語音，以單次連續朗讀消除逐句啟動停頓並依邊界更新',()=>{
  queued=[];const player=new PoetrySpeech(()=>{},message=>assert.fail(message));
  player.play(['第一句。','第二句！'],3);assert.equal(queued.length,1);assert.equal(queued[0].voice.lang,'zh-TW');
  assert.equal(queued[0].rate,3);assert.equal(queued[0].text,'第一句，第二句，');
  queued[0].onstart();assert.equal(player.active,0);
  queued[0].onboundary({charIndex:4});assert.equal(player.active,1);
  queued[0].onend();assert.equal(player.active,null);assert.equal(player.playing,false);assert.equal(queued.length,1);
});
test('從目前句子套用新速度，舊邊界與中斷不影響新朗讀',()=>{
  queued=[];const player=new PoetrySpeech(()=>{},()=>{});player.play(['甲','乙']);const stale=queued[0];
  player.play(['甲','乙'],2.5,1);stale.onboundary({charIndex:2});stale.onerror();
  assert.equal(player.playing,true);assert.equal(queued[1].text,'乙，');
  queued[1].onstart();assert.equal(player.active,1);queued[1].onerror();assert.equal(player.playing,false);
});
test('暫停繼續，重播後忽略舊回呼',()=>{
  queued=[];const player=new PoetrySpeech(()=>{},()=>{});player.play(['舊句']);const stale=queued[0];
  player.togglePause();assert.equal(paused,true);player.togglePause();assert.equal(paused,false);
  player.play(['新句']);stale.onstart();stale.onend();assert.equal(player.active,null);assert.equal(queued.length,2);assert.ok(canceled>=2);
  queued[1].onstart();assert.equal(player.active,0);player.stop();queued[1].onend();assert.equal(player.playing,false);
});
test('缺少中文聲音與播放錯誤會顯示錯誤，不冒充已播放',()=>{
  const original=speechSynthesis.getVoices;let message='';speechSynthesis.getVoices=()=>[];
  const player=new PoetrySpeech(()=>{},m=>message=m);player.play(['詩']);assert.ok(message.includes('中文'));assert.equal(player.playing,false);
  speechSynthesis.getVoices=original;queued=[];player.play(['詩']);queued[0].onerror({error:'network'});assert.equal(player.playing,false);assert.ok(message.includes('無法播放'));
});
