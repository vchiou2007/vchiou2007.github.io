'use strict';
document.querySelector('#search').addEventListener('input',e=>{
 const visible='月亮代表我的心 鄧麗君'.includes(e.target.value.trim());
 document.querySelector('#moon').hidden=!visible;
 document.querySelector('#empty').hidden=visible;
 document.querySelector('#count').textContent=visible?'1 首':'0 首';
});
document.querySelector('#install').onclick=()=>document.querySelector('#installDialog').showModal();
document.querySelector('#closeInstall').onclick=()=>document.querySelector('#installDialog').close();
