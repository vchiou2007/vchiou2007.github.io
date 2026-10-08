import test from 'node:test';import assert from 'node:assert/strict';import {NodController,headAngles} from '../js/nod-controller.mjs';
function rig(sign=1){let t=0;const events=[],n=new NodController(e=>events.push(e));n.startCalibration(t);const frames=(count,pitch=0)=>{for(let i=0;i<count;i++){t+=40;n.feed(t,{pitch,yaw:0,roll:0});}};frames(80);frames(4,sign*16);frames(2);assert.equal(n.phase,'READY');return {n,events,frames,nod(){frames(4,sign*16);frames(2);}};}
test('pitch extraction from column-major x rotation',()=>{const a=.3,c=Math.cos(a),s=Math.sin(a);const result=headAngles({data:[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]});assert.ok(Math.abs(result.pitch-a*180/Math.PI)<1e-5);assert.equal(result.roll,0);});
test('three full nods next page, fourth does not turn again',()=>{const r=rig();r.nod();r.nod();r.nod();r.nod();assert.deepEqual(r.events.map(e=>e.gesture),['NEXT_PAGE']);});
test('two full nods delay previous page',()=>{const r=rig();r.nod();r.nod();assert.equal(r.events.length,0);r.frames(51);assert.deepEqual(r.events.map(e=>e.gesture),['PREVIOUS_PAGE']);});
test('learn downward direction with either angle sign',()=>{const r=rig(-1);r.nod();r.nod();r.nod();assert.equal(r.events.length,1);});
test('held-down posture does not count repeatedly',()=>{const r=rig();r.frames(45,16);r.frames(5);assert.equal(r.events.length,0);assert.equal(r.n.count,0);});
test('lost face cancels pending nod pair',()=>{const r=rig();r.nod();r.nod();r.n.loseFace();r.frames(60);assert.equal(r.events.length,0);});
