'use strict';
// Safari's visible viewport changes as its address bar and keyboard move.
function fitViewport(){
 const height=window.visualViewport?.height||window.innerHeight;
 document.documentElement.style.setProperty('--reader-height',height+'px');
 requestAnimationFrame(()=>{measureScroll();positionScroll();});
}
window.visualViewport?.addEventListener('resize',fitViewport);
window.addEventListener('resize',fitViewport);
fitViewport();
