import test from 'node:test';
import assert from 'node:assert/strict';
import {syncReadingLines} from '../speech.js';
function element(id){const classes=new Set(),attrs={};return {id,classes,attrs,scrolls:[],classList:{contains:k=>classes.has(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)},setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],scrollIntoView(options){this.scrolls.push(options);}};}
test('朗讀焦點依真實句子移動，暫停不重新捲動，停止恢復原樣',()=>{
 const group=element(''),lines=[element('line-0'),element('line-1')];const root={querySelectorAll:s=>s==='.poem-lines'?[group]:lines};
 const player={playing:true,paused:false,active:0};syncReadingLines(root,player,true);
 assert.equal(lines[0].attrs['aria-current'],'true');assert.ok(group.classes.has('is-reading'));assert.equal(lines[0].scrolls.length,1);
 player.paused=true;syncReadingLines(root,player,true);assert.equal(lines[0].scrolls.length,1);assert.ok(group.classes.has('is-paused'));
 player.paused=false;player.active=1;syncReadingLines(root,player,true,true);assert.ok(!lines[0].classes.has('active'));assert.equal(lines[1].scrolls[0].behavior,'auto');
 player.playing=false;syncReadingLines(root,player,true);assert.ok(!group.classes.has('is-reading'));assert.ok(lines.every(l=>!l.classes.has('active')&&!l.attrs['aria-current']));
});
test('試聽或尚未開始發聲時不錯誤強調第一句',()=>{
 const group=element(''),line=element('line-0');const root={querySelectorAll:s=>s==='.poem-lines'?[group]:[line]};
 syncReadingLines(root,{playing:true,active:0},false);assert.equal(line.scrolls.length,0);
 syncReadingLines(root,{playing:true,active:null},true);assert.equal(line.scrolls.length,0);
});
