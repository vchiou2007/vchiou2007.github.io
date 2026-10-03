'use strict';
document.querySelector('#search').addEventListener('input',e=>{
 const query=e.target.value.trim().toLocaleLowerCase();let count=0;
 for(const song of document.querySelectorAll('.song')){const visible=song.textContent.toLocaleLowerCase().includes(query);song.hidden=!visible;if(visible)count++;}
 document.querySelector('#empty').hidden=count>0;document.querySelector('#count').textContent=count+' 首';
});
document.querySelector('#install').onclick=()=>document.querySelector('#installDialog').showModal();
document.querySelector('#closeInstall').onclick=()=>document.querySelector('#installDialog').close();
