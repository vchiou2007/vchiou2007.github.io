export class CameraService{
  constructor(video,onFrame,onStatus){this.video=video;this.onFrame=onFrame;this.onStatus=onStatus;this.generation=0;this.stream=null;this.model=null;this.handle=null;this.running=false;this.frameTimes=[];this.inferences=[];this.modelLoadMs=null;this.lastVideoTime=-1;}
  async start({width=320,targetFps=24,delegate='CPU'}={}){
    this.stop();const generation=this.generation;this.options={width,targetFps,delegate};
    if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia){this.onStatus('MODEL ERROR','攝影機需要 HTTPS 或 localhost，以及支援 getUserMedia 的瀏覽器');return;}
    try{
      this.onStatus('MODEL LOADING','等待攝影機授權與本機模型載入');
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:width},height:{ideal:width===320?240:480},frameRate:{ideal:30,max:30}}});
      if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();if(generation!==this.generation)return;
      const began=performance.now();const {FaceLandmarker,FilesetResolver}=await import('../vendor/tasks-vision/vision_bundle.mjs');
      const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      if(generation!==this.generation)return;const model=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('../vendor/models/face_landmarker.task',import.meta.url).href,delegate},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:false,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5});
      if(generation!==this.generation){model.close();return;}
      this.model=model;this.modelLoadMs=performance.now()-began;this.frameTimes=[];this.inferences=[];this.lastVideoTime=-1;this.lastInference=-Infinity;this.running=true;
      stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(generation===this.generation)this.stop('攝影機已中止，請重新啟動')}));
      this.onStatus('CAMERA READY','攝影機已啟動，請先校準雙眼');this.schedule(generation);
    }catch(e){if(generation!==this.generation)return;this.stop();this.onStatus(e.name==='NotAllowedError'?'PERMISSION DENIED':'MODEL ERROR',e.name==='NotAllowedError'?'攝影機權限遭拒絕；請在 Safari 網站設定允許攝影機後重試':e.name==='NotFoundError'?'找不到攝影機':e.message);}
  }
  schedule(generation){
    const callback=()=>{if(!this.running||generation!==this.generation)return;this.handle=null;this.frame();if(this.running&&generation===this.generation)this.schedule(generation);};
    this.usesVideoCallback=typeof this.video.requestVideoFrameCallback==='function';this.handle=this.usesVideoCallback?this.video.requestVideoFrameCallback(callback):requestAnimationFrame(callback);
  }
  frame(){
    if(!this.model||this.video.readyState<2||this.video.currentTime===this.lastVideoTime)return;
    this.lastVideoTime=this.video.currentTime;const t=performance.now();this.frameTimes.push(t);this.frameTimes=this.frameTimes.filter(x=>t-x<=2000);
    if(t-this.lastInference<1000/this.options.targetFps)return;this.lastInference=t;
    try{
      const began=performance.now();const result=this.model.detectForVideo(this.video,t),ms=performance.now()-began;const cats=result.faceBlendshapes?.[0]?.categories||[];const left=cats.find(x=>x.categoryName==='eyeBlinkLeft')?.score,right=cats.find(x=>x.categoryName==='eyeBlinkRight')?.score,face=Number.isFinite(left)&&Number.isFinite(right);
      this.inferences.push({t,ms,face});this.inferences=this.inferences.filter(x=>t-x.t<=2000);this.onFrame({t,left,right,face,inferenceMs:ms});
    }catch(e){this.stop();this.onStatus('MODEL ERROR','推論失敗：'+e.message);}
  }
  stats(){const t=performance.now(),frames=this.frameTimes.filter(x=>t-x<=2000),runs=this.inferences.filter(x=>t-x.t<=2000);const fps=a=>a.length<2?0:(a.length-1)*1000/(a.at(-1)-a[0]);return {cameraFps:fps(frames),inferenceFps:fps(runs.map(x=>x.t)),averageMs:runs.length?runs.reduce((a,x)=>a+x.ms,0)/runs.length:0,stability:runs.length?runs.filter(x=>x.face).length/runs.length:0,modelLoadMs:this.modelLoadMs,cameraSettings:this.stream?.getVideoTracks()[0]?.getSettings(),cameraFpsMethod:this.usesVideoCallback?'requestVideoFrameCallback':'主執行緒觀測（可能漏影格）'};}
  stop(message='攝影機已停止'){
    this.generation++;this.running=false;
    if(this.handle!==null){if(this.usesVideoCallback)this.video.cancelVideoFrameCallback?.(this.handle);else cancelAnimationFrame(this.handle);this.handle=null;}
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause();this.video.srcObject=null;this.model?.close();this.model=null;this.onStatus?.('CAMERA OFF',message);
  }
}
