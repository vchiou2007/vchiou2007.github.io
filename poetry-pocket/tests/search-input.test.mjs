import test from 'node:test';
import assert from 'node:assert/strict';
import {patchSearchView} from '../views.js';

// A tree fixture records any detach of the native editing context. In Safari,
// restoring focus after such a detach cannot restore an ongoing dictation.
class Node {
 constructor(tagName,id='',text=''){this.tagName=tagName;this.id=id;this.text=text;this.childNodes=[];this.parentNode=null;}
 contains(node){return this===node||this.childNodes.some(child=>child.contains(node));}
 appendChild(node){node.parentNode=this;this.childNodes.push(node);return node;}
 insertBefore(node,anchor){node.parentNode=this;this.childNodes.splice(this.childNodes.indexOf(anchor),0,node);}
 remove(){assert.ok(!this.protected,'The focused input or its ancestor was detached');const p=this.parentNode;p.childNodes.splice(p.childNodes.indexOf(this),1);this.parentNode=null;}
 cloneNode(){const n=new Node(this.tagName,this.id,this.text);for(const child of this.childNodes)n.appendChild(child.cloneNode(true));return n;}
 querySelector(selector){if(this.id===selector.slice(1))return this;for(const child of this.childNodes){const found=child.querySelector(selector);if(found)return found;}return null;}
}
function fixture(id,text){
 const root=new Node('DIV'),main=root.appendChild(new Node('MAIN'));
 main.appendChild(new Node('HEADER','','heading'));
 const form=main.appendChild(new Node('FORM')),label=form.appendChild(new Node('LABEL'));
 label.appendChild(new Node('SPAN','','search'));
 const input=label.appendChild(new Node('INPUT',id));
 main.appendChild(new Node('SECTION','results',text));
 return {root,input};
}
for(const id of ['search-input','recitation-search','catalogue-search','pair-search']){
 test(`${id}: continuous dictation preserves input, ancestors, value and selection while results update`,()=>{
  const {root,input}=fixture(id,'all');
  for(let n=input;n&&n!==root;n=n.parentNode)n.protected=true;
  root.ownerDocument={createElement(){const next=fixture(id,'updated results').root;return next;}};
  for(const text of ['床','床前','床前明月光','李白 靜夜思','']){
   input.value=text;input.selectionStart=text.length;input.selectionEnd=text.length;
   const parent=input.parentNode;
   assert.equal(patchSearchView(root,'new HTML',input),true);
   assert.equal(root.querySelector('#'+id),input);
   assert.equal(input.parentNode,parent);assert.equal(root.contains(input),true);
   assert.equal(input.value,text);assert.equal(input.selectionStart,text.length);
   assert.equal(root.querySelector('#results').text,'updated results');
  }
 });
}
test('A route without the same search input declines the patch without changing the old DOM',()=>{
 const {root,input}=fixture('search-input','old results');root.ownerDocument={createElement:()=>fixture('different-input','new').root};
 assert.equal(patchSearchView(root,'new HTML',input),false);
 assert.equal(root.querySelector('#results').text,'old results');
});
