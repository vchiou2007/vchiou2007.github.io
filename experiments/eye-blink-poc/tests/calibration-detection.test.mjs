import test from 'node:test';import assert from 'node:assert/strict';
import {EyeCalibration} from '../js/calibration.mjs';import {BlinkController} from '../js/blink-controller.mjs';
test('the five calibration pulses remain detectable after calibration',()=>{
  const cal=new EyeCalibration();let t=0;cal.start(t);
  const feed=(n,v)=>{for(let i=0;i<n;i++){t+=40;cal.feed(t,v,v,true);}};
  feed(80,.05);
  // Two low shoulders and only one peak: old .56 threshold rejected this.
  for(let i=0;i<5;i++){feed(1,.4);feed(1,.9);feed(1,.4);feed(3,.05);}
  assert.equal(cal.stage,'DONE');assert.equal(cal.result.closedThreshold,.35);
  const events=[],c=new BlinkController(cal.resultForController??Object.fromEntries(['openThreshold','closedThreshold','minBlinkMs','maxIntervalMs','gestureTimeoutMs'].map(k=>[k,cal.result[k]])),e=>events.push(e));
  const frames=(n,v)=>{for(let i=0;i<n;i++){t+=40;c.feed(t,v,v,true);}};
  frames(25,.05);for(let i=0;i<3;i++){frames(1,.4);frames(1,.9);frames(1,.4);frames(5,.05);}
  assert.deepEqual(events.map(e=>e.gesture),['NEXT_PAGE']);
});
