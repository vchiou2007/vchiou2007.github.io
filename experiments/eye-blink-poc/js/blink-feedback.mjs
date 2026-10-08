export class BlinkFeedback {
  constructor(){this.reset();}
  reset(){this.number=0;this.label='等待眨眼訊號';this.until=0;this.phase='waiting';}
  receive(number,label,t){this.number=number;this.label=label;this.until=t+1600;this.phase='received';}
  snapshot(t){return {number:t<=this.until?this.number:0,label:t<=this.until?this.label:'等待下一組眨眼',phase:t<=this.until?this.phase:'waiting'};}
}
