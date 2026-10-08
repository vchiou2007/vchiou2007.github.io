export const DEFAULTS = Object.freeze({closedThreshold:.65,openThreshold:.35,minBlinkMs:60,maxBlinkMs:500,maxIntervalMs:500,gestureTimeoutMs:500,cooldownMs:1000,stableOpenMs:120,consecutiveFrames:2,maxFrameGapMs:250});
export function validateSettings(input){
  const s={...DEFAULTS,...input};
  for(const [key,value] of Object.entries(s))if(!Number.isFinite(value))throw Error(key+' 必須是數字');
  if(s.openThreshold<0||s.closedThreshold>1||s.openThreshold>=s.closedThreshold)throw Error('睜眼門檻必須小於閉眼門檻，範圍為 0～1');
  if(s.minBlinkMs<20||s.maxBlinkMs<=s.minBlinkMs||s.maxBlinkMs>1000)throw Error('眨眼時間範圍不正確');
  for(const k of ['maxIntervalMs','gestureTimeoutMs'])if(s[k]<100||s[k]>1500)throw Error('眨眼間隔及等待時間須為100～1500ms');
  if(s.cooldownMs<500||s.cooldownMs>5000)throw Error('冷卻須為500～5000ms');
  return s;
}
export class BlinkController {
  constructor(settings={},dispatch=()=>{}){this.settings=validateSettings(settings);this.dispatch=dispatch;this.reset();}
  reset(){this.phase='FACE_LOST';this.count=0;this.lastBlink=null;this.closedAt=null;this.closeCandidate=null;this.openCandidate=null;this.lastInput=null;this.lastTick=-Infinity;this.cooldownUntil=0;this.lastEvent=null;this.lastScores=null;}
  configure(s){this.settings=validateSettings(s);this.reset();}
  armFromCalibration(t,left,right){if(left<=this.settings.openThreshold&&right<=this.settings.openThreshold){this.phase='IDLE';this.lastInput=t;this.lastTick=t;this.lastScores={left,right};}}
  loseFace(){this.phase='FACE_LOST';this.count=0;this.lastBlink=null;this.closedAt=null;this.closeCandidate=null;this.openCandidate=null;this.lastScores=null;}
  get state(){if(this.phase==='IDLE')return this.count===2?'WAIT_FOR_THIRD_BLINK':this.count===1?'BLINK_COUNT_1':'IDLE';return this.phase;}
  get deadline(){return this.lastBlink===null?Infinity:this.lastBlink+(this.count===2?Math.min(this.settings.maxIntervalMs,this.settings.gestureTimeoutMs):this.settings.maxIntervalMs);}
  snapshot(){return {state:this.state,eyeState:this.phase,blinkCount:this.count,lastGesture:this.lastEvent,deadline:this.deadline};}
  tick(t){
    if(t<this.lastTick)return;this.lastTick=t;
    if(this.lastInput!==null&&t-this.lastInput>this.settings.maxFrameGapMs){this.loseFace();return;}
    if(this.phase==='IDLE'&&this.count&&t>this.deadline)this.expire(t);
  }
  expire(t){if(this.count===2)this.confirm('PREVIOUS_PAGE',t);else{this.count=0;this.lastBlink=null;}}
  confirm(gesture,t){
    const event={gesture,timestamp:t,blinkCount:this.count,latencyMs:t-this.lastBlink};
    this.lastEvent=event;this.count=0;this.lastBlink=null;this.phase='COOLDOWN';this.cooldownUntil=t+this.settings.cooldownMs;this.openCandidate=null;this.closeCandidate=null;this.closedAt=null;
    // The sole gesture dispatcher; consumers must not act on eye-state changes.
    this.dispatch(event);
  }
  feed(t,left,right,face=true){
    if(this.lastInput!==null&&t<=this.lastInput)return this.snapshot();
    if(this.lastInput!==null&&t-this.lastInput>this.settings.maxFrameGapMs)this.loseFace();
    this.lastInput=t;this.lastTick=t;
    if(!face||![left,right].every(v=>Number.isFinite(v)&&v>=0&&v<=1)){this.loseFace();return this.snapshot();}
    this.lastScores={left,right};const s=this.settings,open=left<=s.openThreshold&&right<=s.openThreshold,closed=left>=s.closedThreshold&&right>=s.closedThreshold;
    if(t<this.cooldownUntil){this.phase='COOLDOWN';return this.snapshot();}
    if(this.phase==='LONG_EYE_CLOSURE'&&!open)return this.snapshot();
    if(this.phase==='COOLDOWN'||this.phase==='FACE_LOST'||this.phase==='LONG_EYE_CLOSURE'){
      this.phase='WAIT_FOR_REOPEN';this.openCandidate=null;
    }
    if(this.phase==='WAIT_FOR_REOPEN'){
      if(!open)this.openCandidate=null;
      else{this.openCandidate??={at:t,frames:0};this.openCandidate.frames++;if(t-this.openCandidate.at>=s.stableOpenMs&&this.openCandidate.frames>=s.consecutiveFrames){this.phase='IDLE';this.openCandidate=null;}}
      return this.snapshot();
    }
    if(this.phase==='EYES_CLOSED'){
      if((this.openCandidate?.at??t)-this.closedAt>s.maxBlinkMs){this.phase='LONG_EYE_CLOSURE';this.count=0;this.lastBlink=null;this.openCandidate=null;this.closeCandidate=null;return this.snapshot();}
      if(!open)this.openCandidate=null;
      else{
        this.openCandidate??={at:t,frames:0};this.openCandidate.frames++;
        if(this.openCandidate.frames>=1){
          const duration=this.openCandidate.at-this.closedAt;this.phase='IDLE';this.openCandidate=null;this.closedAt=null;
          if(duration>=s.minBlinkMs&&duration<=s.maxBlinkMs){
            // A late third blink cannot first emit PREVIOUS and then NEXT.
            if(this.count&&t>this.deadline){this.expire(t);return this.snapshot();}
            this.count++;this.lastBlink=t;if(this.count===3)this.confirm('NEXT_PAGE',t);
          }
        }
      }
      return this.snapshot();
    }
    if(this.count&&t>this.deadline){this.expire(t);if(this.phase==='COOLDOWN')return this.snapshot();}
    if(closed){this.closeCandidate??={at:t,frames:0};this.closeCandidate.frames++;if(this.closeCandidate.frames>=s.consecutiveFrames){this.closedAt=this.closeCandidate.at;this.phase='EYES_CLOSED';this.closeCandidate=null;}}
    else if(open)this.closeCandidate=null;
    return this.snapshot();
  }
}
