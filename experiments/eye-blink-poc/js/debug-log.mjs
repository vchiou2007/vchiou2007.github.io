export class DebugLog{
  constructor(limit=2000){this.limit=limit;this.entries=[];this.lastSample=-Infinity;}
  add(entry){this.entries.push({timestamp:new Date().toISOString(),...entry});if(this.entries.length>this.limit)this.entries.splice(0,this.entries.length-this.limit);}
  sample(t,entry){if(t-this.lastSample<200)return;this.lastSample=t;this.add(entry);}
  export(settings){return {schemaVersion:1,experiment:'eye-blink-poc',settings,entries:this.entries,privacy:'只有分數、狀態及效能，沒有圖片、影片或人臉座標'};}
}
