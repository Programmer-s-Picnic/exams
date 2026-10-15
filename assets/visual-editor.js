/* Non-technical structured content editor. Works with existing admin load/save APIs.
   All edits happen in memory; server validation and revision checking remain authoritative. */
(function(){
"use strict";
const labels={examIds:"Examinations",examId:"Examination",topicId:"Topic",answerIndex:"Correct answer (zero-based)",questionCount:"Number of questions",title:"Title",subject:"Subject",difficulty:"Difficulty",en:"English",hi:"Hindi",options:"Answer choices",question:"Question",explanation:"Explanation",questions:"Questions",id:"Record ID",status:"Status",sourceUrl:"Official source URL",durationMinutes:"Duration (minutes)",marks:"Marks"};
const pretty=k=>labels[k]||k.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/_/g," ").replace(/^./,c=>c.toUpperCase());
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
const clone=x=>JSON.parse(JSON.stringify(x));
const kind=x=>Array.isArray(x)?"array":x===null?"null":typeof x;
function mount(host,initial,onChange) {
 let model=clone(initial), selected="", filter="";
 host.innerHTML="";
 const shell=node("div","ev-shell"), toolbar=node("div","ev-toolbar"), search=node("input","ev-search");
 search.placeholder="Search fields or records…";search.setAttribute("aria-label","Search content");
 toolbar.append(search);
 const totals=node("span","ev-muted");
 toolbar.append(totals);
 const editor=node("div","ev-body");
 shell.append(toolbar,editor);host.append(shell);
 function changed(){onChange(clone(model));render()}
 function replace(path,value){if(!path.length){model=value}else{let p=model;for(let i=0;i<path.length-1;i++)p=p[path[i]];p[path.at(-1)]=value;}changed()}
 function inputFor(value,path,key){
  const type=kind(value), wrap=node("div","ev-input-wrap");
  if(type==="boolean"){const c=document.createElement("input");c.type="checkbox";c.checked=value;c.onchange=()=>replace(path,c.checked);wrap.append(c);return wrap;}
  if(type==="object"||type==="array")return null;
  const multiline=String(value??"").length>110||/question|explanation|description|instructions|content/i.test(key);
  const el=document.createElement(multiline?"textarea":"input");
  if(!multiline)el.type=type==="number"?"number":"text";
  if(type==="number")el.step="any";
  el.value=value??"";
  if(key==="id") {el.readOnly=true;el.title="Existing record ID is protected";}
  el.onchange=()=>{const raw=el.value;replace(path,type==="number"?(raw===""?0:Number(raw)):type==="null"?(raw===""?null:raw):raw)};
  wrap.append(el);
  if(key==="answerIndex"&&type==="number"){const h=node("small","ev-muted","0 = first option, 1 = second option, etc.");wrap.append(h);}
  return wrap;
 }
 function recordCard(item,path,i){
  const card=node("details","ev-record");
  const summary=node("summary",null,""+(i+1)+". "+(item?.title||item?.paper||item?.id||item?.question?.en||item?.question?.hi||"Record"));
  card.append(summary);
  const actions=node("div","ev-actions");
  const copy=node("button","ghost-button","Duplicate"),remove=node("button","ghost-button","Remove");
  copy.type=remove.type="button";
  copy.onclick=()=>{const x=clone(item);if(x&&typeof x==="object"&&"id"in x)x.id=String(x.id)+"-copy-"+Date.now().toString(36);let arr=get(path.slice(0,-1));arr.splice(i+1,0,x);changed()};
  remove.onclick=()=>{if(!confirm("Remove this record from the draft?"))return;get(path.slice(0,-1)).splice(i,1);changed()};
  actions.append(copy,remove);card.append(actions);
  draw(item,path,card,1);return card;
 }
 function get(path){return path.reduce((v,k)=>v[k],model)}
 function draw(value,path,parent,depth=0,key=""){
  const type=kind(value);
  if(type==="object"){
   const container=node("div",depth?"ev-fields":"ev-root");
   for(const [k,v] of Object.entries(value)){
    if(filter&&depth===0&&!JSON.stringify(v).toLowerCase().includes(filter)&&!k.toLowerCase().includes(filter))continue;
    const field=node("div","ev-field"), label=node("label","ev-label",pretty(k));
    field.append(label);
    if(kind(v)==="object"||kind(v)==="array"){
      const section=node("details","ev-section");section.open=depth<2;
      section.append(node("summary",null,pretty(k)+" — "+(Array.isArray(v)?v.length+" items":"details")));
      draw(v,path.concat(k),section,depth+1,k);field.append(section);
    }else field.append(inputFor(v,path.concat(k),k));
    container.append(field);
   }
   parent.append(container);return;
  }
  if(type==="array"){
   const container=node("div","ev-list");
   if(value.length>7){const q=node("input","ev-search");q.placeholder="Find a record in this section…";q.value=selected;q.oninput=()=>{selected=q.value.toLowerCase();render()};container.append(q)}
   value.forEach((item,i)=>{
     if(selected&&value.length>7&&!JSON.stringify(item).toLowerCase().includes(selected))return;
     if(kind(item)==="object")container.append(recordCard(item,path.concat(i),i));
     else {
       const row=node("div","ev-array-row"), field=inputFor(item,path.concat(i),key);
       row.append(field);
       const remove=node("button","ghost-button","Remove");remove.type="button";remove.onclick=()=>{get(path).splice(i,1);changed()};row.append(remove);container.append(row);
     }
   });
   const add=node("button","ghost-button","+ Add "+(key==="questions"?"question":"item"));add.type="button";
   add.onclick=()=>{
     const template=value.length?clone(value.at(-1)):null;
     if(template===null){alert("This list has no example record. Use Advanced JSON to define its first item.");return;}
     if(kind(template)==="object"){
       Object.keys(template).forEach(k=>{if(k==="id")template[k]="new-"+Date.now().toString(36);else if(typeof template[k]==="string")template[k]="";});
     }else if(typeof template==="string")value.push("");else if(typeof template==="number")value.push(0);else value.push(template);
     if(kind(template)==="object")value.push(template);
     selected="";changed();
   };
   container.append(add);parent.append(container);return;
  }
  parent.append(inputFor(value,path,key));
 }
 function render(){editor.innerHTML="";search.value=filter;totals.textContent=Array.isArray(model)?"Records: "+model.length:"Structured visual editor";draw(model,[],editor);}
 search.oninput=()=>{filter=search.value.toLowerCase();render();search.focus();search.setSelectionRange(search.value.length,search.value.length)};
 render();
 return {getValue:()=>clone(model),setValue:v=>{model=clone(v);render()}};
}
window.ExamVisualEditor={mount};
})();
