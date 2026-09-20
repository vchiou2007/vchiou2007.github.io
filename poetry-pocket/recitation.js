import {pinyin} from './vendor/pinyin-pro.mjs';
import {han} from './feihua-core.js';
import variants from './vendor/character-variants.js';
const letters=text=>[...text].filter(han).slice(0,240);
export function compareRecitation(expected,spoken){
 const a=letters(expected),b=letters(spoken),pa=pinyin(a.join(''),{type:'array',toneType:'num'}),pb=pinyin(b.join(''),{type:'array',toneType:'num'});
 const equal=(i,j)=>a[i]===b[j]||(variants[a[i]]||a[i])===(variants[b[j]]||b[j])||(/^[a-züv]+[0-5]?$/.test(pa[i])&&pa[i]===pb[j]);
 const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(equal(i-1,j-1)?0:1));
 const marks=Array(a.length).fill('correct'),extra=[];let i=a.length,j=b.length;
 while(i||j){if(i&&j&&d[i][j]===d[i-1][j-1]+(equal(i-1,j-1)?0:1)){marks[i-1]=a[i-1]===b[j-1]?'correct':equal(i-1,j-1)?'sound':'wrong';i--;j--;}else if(i&&d[i][j]===d[i-1][j]+1){marks[--i]='missing';}else{extra.unshift(b[--j]);}}
 return {characters:a,marks,extra,correct:marks.every(x=>x==='correct')&&!extra.length,similar:marks.every(x=>x==='correct'||x==='sound')&&!extra.length,spoken:b.join('')};
}
const initials={b:'ㄅ',p:'ㄆ',m:'ㄇ',f:'ㄈ',d:'ㄉ',t:'ㄊ',n:'ㄋ',l:'ㄌ',g:'ㄍ',k:'ㄎ',h:'ㄏ',j:'ㄐ',q:'ㄑ',x:'ㄒ',zh:'ㄓ',ch:'ㄔ',sh:'ㄕ',r:'ㄖ',z:'ㄗ',c:'ㄘ',s:'ㄙ'};
const finals={a:'ㄚ',o:'ㄛ',e:'ㄜ',ai:'ㄞ',ei:'ㄟ',ao:'ㄠ',ou:'ㄡ',an:'ㄢ',en:'ㄣ',ang:'ㄤ',eng:'ㄥ',er:'ㄦ',i:'ㄧ',ia:'ㄧㄚ',ie:'ㄧㄝ',iao:'ㄧㄠ',iu:'ㄧㄡ',ian:'ㄧㄢ',in:'ㄧㄣ',iang:'ㄧㄤ',ing:'ㄧㄥ',iong:'ㄩㄥ',u:'ㄨ',ua:'ㄨㄚ',uo:'ㄨㄛ',uai:'ㄨㄞ',ui:'ㄨㄟ',uan:'ㄨㄢ',un:'ㄨㄣ',uang:'ㄨㄤ',ong:'ㄨㄥ',ueng:'ㄨㄥ',v:'ㄩ',ve:'ㄩㄝ',van:'ㄩㄢ',vn:'ㄩㄣ'};
export function toZhuyin(syllable){
 let s=syllable.replace('ü','v'),tone=s.match(/[0-5]$/)?.[0]||'0';s=s.replace(/[0-5]$/,'');
 const zero={yi:'i',ya:'ia',ye:'ie',yao:'iao',you:'iu',yan:'ian',yin:'in',yang:'iang',ying:'ing',yong:'iong',yu:'v',yue:'ve',yuan:'van',yun:'vn',wu:'u',wa:'ua',wo:'uo',wai:'uai',wei:'ui',wan:'uan',wen:'un',wang:'uang',weng:'ueng'};s=zero[s]||s;
 const ini=s.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzc s])/u)?.[0]||'';let end=s.slice(ini.length);
 if(['j','q','x'].includes(ini))end=end.replace(/^u/,'v');
 if(end==='i'&&['zh','ch','sh','r','z','c','s'].includes(ini))end='';
 const text=(initials[ini]||'')+(end?finals[end]||'':'');if(!text)return syllable;
 return text+({'1':'','2':'ˊ','3':'ˇ','4':'ˋ','0':'˙','5':'˙'}[tone]);
}
export function readingFor(q,index){
 const chars=[...q.text],character=chars[index];
 const original=q.poem.difficultCharacters.find(d=>d.character===character&&q.indices.some(i=>q.poem.lines[i]===d.lineContext));
 if(original)return {character,...original};
 const sounds=pinyin(q.text,{type:'array',toneType:'num'});
 return {character,zhuyin:toZhuyin(sounds[index]||character),meaning:'依本句提供的字音參考。古典多音字與地名可能有異讀。',explanation:q.explanation};
}
export class RecitationRecognition{
 constructor(onResult,onStatus,onError,Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition){this.Recognition=Recognition;this.onResult=onResult;this.onStatus=onStatus;this.onError=onError;this.session=0;this.active=false;}
 get supported(){return Boolean(this.Recognition);}
 cancel(){this.session++;const r=this.current;this.current=null;this.active=false;if(r)r.abort();this.onStatus(false);}
 start(){this.cancel();if(!this.supported){this.onError('此瀏覽器未提供語音辨識，仍可輸入文字或自行核對。');return;}
  const token=this.session,r=new this.Recognition();this.current=r;r.lang='zh-TW';r.continuous=false;r.interimResults=false;r.maxAlternatives=1;
  r.onresult=e=>{if(token!==this.session)return;const text=Array.from(e.results).filter(x=>x.isFinal).map(x=>x[0].transcript).join('');if(text)this.onResult(text);};
  r.onerror=e=>{if(token!==this.session||e.error==='aborted')return;this.onError(({'not-allowed':'尚未允許麥克風或語音辨識，請查看 Safari 權限與 Siri 設定。','no-speech':'沒有聽到聲音，可以再試一次。','network':'語音辨識連線未完成，請改用文字或自行核對。','audio-capture':'無法使用麥克風，請查看裝置設定。'})[e.error]||'這次無法辨識，請改用文字或自行核對。');};
  r.onend=()=>{if(token!==this.session)return;this.active=false;this.current=null;this.onStatus(false);};
  try{r.start();this.active=true;this.onStatus(true);}catch{this.current=null;this.onError('無法開始語音辨識，請稍後再試。');}
 }
}
