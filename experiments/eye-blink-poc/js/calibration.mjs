export function percentile(values,fraction){const a=[...values].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(fraction*(a.length-1)))];}
export class EyeCalibration{
  constructor(){this.reset();}
  reset(){this.stage='OFF';this.openSamples=[];this.peaks=[];this.openStart=null;this.closed=null;this.lastTime=null;this.result=null;this.message='尚未校準';}
  start(t){this.reset();this.stage='OPEN';this.started=t;this.message='距離約一公尺，保持雙眼自然睜開三秒';}
  fail(message){this.stage='FAILED';this.closed=null;this.message='校準失敗：'+message;}
  feed(t,left,right,face){
    if(!['OPEN','BLINKS'].includes(this.stage))return;
    if(!face||!Number.isFinite(left)||!Number.isFinite(right)){this.fail('人臉或雙眼追蹤中斷，請重新開始');return;}
    if(this.lastTime!==null&&t-this.lastTime>250){this.fail('推論間隔太長，請降低負載再試');return;}this.lastTime=t;
    if(t-this.started>40000){this.fail('逾時，未取得五次清楚的雙眼眨眼');return;}
    if(this.stage==='OPEN'){
      if(Math.max(left,right)>.45){this.openSamples=[];this.openStart=null;this.message='先睜開雙眼，再保持三秒';return;}
      this.openStart??=t;this.openSamples.push([left,right]);this.message='保持睜眼：'+Math.max(0,(3000-(t-this.openStart))/1000).toFixed(1)+' 秒';
      if(t-this.openStart>=3000&&this.openSamples.length>=15){this.baseline=Math.max(percentile(this.openSamples.map(x=>x[0]),.95),percentile(this.openSamples.map(x=>x[1]),.95));this.cut=Math.max(.35,this.baseline+.18);this.stage='BLINKS';this.message='請自然眨眼五次：0 / 5';}return;
    }
    const bothClosed=Math.min(left,right)>this.cut,bothOpen=Math.max(left,right)<this.baseline+.12;
    if(bothClosed){this.closed??={at:t,left:0,right:0,frames:0};this.closed.frames++;this.closed.left=Math.max(this.closed.left,left);this.closed.right=Math.max(this.closed.right,right);}
    if(this.closed&&t-this.closed.at>700){this.closed=null;this.message='閉眼太久，這次不計入；請自然眨眼';return;}
    if(this.closed&&bothOpen){const c=this.closed;this.closed=null;if(c.frames>=2&&t-c.at>=40&&t-c.at<=600){this.peaks.push([c.left,c.right]);this.message='請自然眨眼五次：'+this.peaks.length+' / 5';if(this.peaks.length===5)this.finish();}}
  }
  finish(){
    const peak=Math.min(percentile(this.peaks.map(x=>x[0]),.2),percentile(this.peaks.map(x=>x[1]),.2)),gap=peak-this.baseline;
    if(gap<.18){this.fail('睜眼與閉眼分數沒有足夠區別，請調整光線、距離或解析度');return;}
    this.result={openThreshold:Number((this.baseline+gap*.2).toFixed(3)),closedThreshold:Number((this.baseline+gap*.6).toFixed(3)),openBaseline:this.baseline,closedPeak:peak,samples:this.openSamples.length,blinks:5};this.stage='DONE';this.message='校準完成；門檻已套用，仍可手動調整';
  }
}
