const slides=[
 ['poetic-moonlight.webp','月・月色讀詩','古裝女子在月色山水間靜讀詩卷'],
 ['poetic-spring.webp','花・桃花春水','古裝女子在桃花春水旁讀詩'],
 ['poetic-lotus.webp','水・荷塘清夏','古裝女子在荷塘亭畔讀詩'],
 ['poetic-autumn.webp','山・金秋書香','古裝女子在秋日山水間讀詩'],
 ['poetic-wind.webp','風・清風入卷','古裝女子衣袖隨風輕揚，在湖畔讀詩'],
 ['poetic-rain.webp','雨・煙雨江南','古裝女子撐油紙傘，望向細雨中的江南'],
 ['poetic-cloud.webp','雲・雲海寄意','古裝女子手持詩卷，遠望群山雲海'],
 ['poetic-snow.webp','雪・雪映梅香','古裝女子披冬衣，在梅花與雪景中抱卷'],
 ['poetic-night.webp','夜・燈下清讀','古裝女子在夜色湖畔伴燈讀詩'],
 ['poetic-sun.webp','日・晨光照卷','古裝女子在金色晨光中讀詩'],
 ['poetic-river.webp','江・一葉詩舟','古裝女子坐在江上輕舟中手捧詩集'],
 ['poetic-willow.webp','柳・柳岸書聲','古裝女子抱著詩集漫步垂柳長堤']
];
let current=0,playing=null,cleanup=()=>{};
export const wrapSlide=index=>(index%slides.length+slides.length)%slides.length;
export function welcomeBanner(){
 if(playing===null)playing=!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 return `<section class="poetic-welcome" data-carousel role="region" aria-roledescription="輪播" aria-label="詩意畫廊">${slides.map(([file,title,alt],i)=>`<img class="poetic-slide ${i===current?'is-active':''}" data-slide="${i}" src="./art/${file}" alt="${alt}" aria-hidden="${i!==current}" width="1536" height="1024" ${i===current?'fetchpriority="high"':'decoding="async"'}>`).join('')}<div class="poetic-welcome-copy"><span class="poetic-seal" aria-hidden="true">詩意</span><p class="poetic-kicker">一卷詩詞 · 一日清歡</p><h2>在詩裡，<br>遇見好時光。</h2><p class="poetic-subtitle">讀一句，記一句，<br>讓千年的心意，住進日常。</p></div><div class="poetic-carousel-controls"><button type="button" data-carousel-action="prev" aria-label="上一張">‹</button><div class="poetic-carousel-dots" aria-label="選擇畫面">${slides.map(([,title],i)=>`<button type="button" data-carousel-index="${i}" aria-label="第 ${i+1} 張：${title}" aria-pressed="${i===current}"><span></span></button>`).join('')}</div><button type="button" data-carousel-action="next" aria-label="下一張">›</button><button type="button" class="poetic-carousel-toggle" data-carousel-action="toggle" aria-label="${playing?'暫停':'開始'}自動輪播">${playing?'暫停':'播放'}</button><span class="poetic-carousel-caption" aria-live="off">${current+1} / ${slides.length} · ${slides[current][1]}</span></div></section>`;
}
export function mountWelcomeCarousel(root){
 cleanup();const el=root.querySelector?.('[data-carousel]');if(!el)return;
 let timer,point=null;
 const restart=()=>{clearInterval(timer);if(playing)timer=setInterval(()=>{if(!document.hidden&&!el.contains(document.activeElement))show(current+1,false);},7000);};
 const paint=()=>{el.querySelectorAll('[data-slide]').forEach((img,i)=>{img.classList.toggle('is-active',i===current);img.setAttribute('aria-hidden',String(i!==current));});el.querySelectorAll('[data-carousel-index]').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===current)));const toggle=el.querySelector('[data-carousel-action="toggle"]');toggle.textContent=playing?'暫停':'播放';toggle.setAttribute('aria-label',(playing?'暫停':'開始')+'自動輪播');el.querySelector('.poetic-carousel-caption').textContent=(current+1)+' / '+slides.length+' · '+slides[current][1];};
 const show=(index,manual=true)=>{current=wrapSlide(index);paint();if(manual)restart();};
 const click=event=>{const b=event.target.closest('button');if(!b||!el.contains(b))return;const action=b.dataset.carouselAction;if(action==='toggle'){playing=!playing;paint();restart();b.blur();}else if(action==='prev'||action==='next')show(current+(action==='next'?1:-1));else if(b.dataset.carouselIndex!==undefined)show(Number(b.dataset.carouselIndex));};
 const down=event=>{if(event.target.closest('button'))return;point={x:event.clientX,y:event.clientY};};
 const up=event=>{if(!point)return;const dx=event.clientX-point.x,dy=event.clientY-point.y;point=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)show(current+(dx<0?1:-1));};
 const cancel=()=>{point=null;};
 el.addEventListener('click',click);el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',cancel);restart();
 cleanup=()=>{clearInterval(timer);el.removeEventListener('click',click);el.removeEventListener('pointerdown',down);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel);};
}
