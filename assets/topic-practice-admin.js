/* Guided topic-practice administration using existing revision-checked admin API. */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cp=v=>JSON.parse(JSON.stringify(v));
const opt=(value,label,current)=>'<option value="'+esc(value)+'"'+(String(value)===String(current)?' selected':'')+'>'+esc(label)+'</option>';
async function mount(host, token, onDirtyChange){
  let loaded, revision, config, configRevision, selected='', selectedIndex=0, dirty=false;
  const setDirty=v=>{dirty=v;onDirtyChange(v);};
  host.innerHTML='<p class="admin-status">Loading topic-practice settings and approved question sets…</p>';
  try{
    const [tests,site]=await Promise.all([
      Api.auth('admin',{action:'load',file:'tests.json'},token),
      Api.auth('admin',{action:'load',file:'site-main.json'},token)]);
    if(!host.isConnected)return;
    loaded=tests.content;revision=tests.revision;config=site.content;configRevision=site.revision;
  }catch(e){host.innerHTML='<p role="alert">'+esc(e.message)+'</p>';return;}
  const eligible=()=>loaded.tests.filter(t=>t.audience!=='guest'&&t.type!=='diagnostic'&&
    !/diagnostic/i.test(String(t.title||'')+' '+String(t.category||'')) &&
    Array.isArray(t.examIds)&&t.examIds.length);
  const current=()=>eligible().find(t=>t.id===selected);
  const question=()=>current()?.questions?.[selectedIndex];
  const status=msg=>{const el=host.querySelector('#tpaStatus');if(el)el.textContent=msg;};
  function draw(){
    const tests=eligible();
    if(!tests.some(t=>t.id===selected))selected=tests[0]?.id||'';
    const t=current();if(t)selectedIndex=Math.max(0,Math.min(selectedIndex,(t.questions||[]).length-1));
    const q=question();const enabled=config.features?.topicPractice?.enabled!==false;
    host.innerHTML='<section class="tpa-page"><h2>Topic-wise Practice · Admin</h2>'+
      '<p>Use these forms to control availability and edit questions, subjects, topics, difficulty and explanations. Existing diagnostics are excluded. Changes to a published test also affect that test, so review carefully.</p>'+
      '<article class="tpa-box"><h3>Feature access</h3>'+
      '<label class="tpa-toggle"><input type="checkbox" id="tpaEnabled"'+(enabled?' checked':'')+'> Enable topic-wise practice for signed-in students</label>'+
      '<p class="admin-status">The new module is an optional add-on. Payment plans can use this feature flag when subscriptions are implemented.</p>'+
      '<button class="primary-button" id="tpaSaveFlag">Save feature access</button></article>'+
      '<article class="tpa-box"><h3>Practice question editor</h3><p>Choose a published practice set to manage the questions that feed topic-wise practice. Draft sets remain unavailable to students.</p>'+
      '<div class="tpa-grid"><label>Practice set<select id="tpaTest">'+tests.map(x=>opt(x.id,x.title+(x.available?' · Published':' · Unpublished'),selected)).join('')+'</select></label>'+
      (t?'<label>Question<select id="tpaQuestion">'+(t.questions||[]).map((x,i)=>opt(i,(i+1)+'. '+String(x.question||'Untitled').slice(0,65),selectedIndex)).join('')+'</select></label>':'')+
      '</div>'+
      (t?'<div class="tpa-grid"><label>Subject / category<input id="tpaCategory" value="'+esc(t.category||'')+'"></label>'+
      '<label class="tpa-toggle"><input id="tpaPublished" type="checkbox"'+(t.available?' checked':'')+'> Make this entire practice set available</label></div>'+
      '<p class="admin-status">'+(t.questions||[]).length+' question(s) · '+esc((t.examIds||[]).join(', '))+'</p>':'<p>No practice sets are available. Create a practice set through Test builder first.</p>')+
      (q?'<div class="tpa-grid"><label>Topic<input id="tpaTopic" value="'+esc(q.topic||'')+'"></label>'+
      '<label>Question difficulty<select id="tpaDifficulty">'+['Foundation','Beginner','Easy','Medium','Advanced','Hard'].map(x=>opt(x,x,q.difficulty||t.difficulty||'Foundation')).join('')+'</select></label></div>'+
      '<label>Question<textarea id="tpaText" rows="3">'+esc(q.question||'')+'</textarea></label>'+
      '<div class="tpa-grid">'+(q.options||[]).map((value,i)=>'<label>Option '+String.fromCharCode(65+i)+'<input data-tpa-option="'+i+'" value="'+esc(value)+'"></label>').join('')+'</div>'+
      '<label>Correct answer<select id="tpaCorrect">'+(q.options||[]).map((v,i)=>opt(i,String.fromCharCode(65+i),q.correctOption)).join('')+'</select></label>'+
      '<label>Explanation<textarea id="tpaExplanation" rows="4">'+esc(q.explanation||'')+'</textarea></label>'+
      '<div class="result-actions"><button class="ghost-button" id="tpaAdd">+ Add question</button>'+
      '<button class="ghost-button" id="tpaDuplicate">Duplicate question</button><button class="ghost-button" id="tpaDelete">Delete question</button></div>':'')+
      '<div class="result-actions"><button class="ghost-button" id="tpaCheck">Check questions</button>'+
      '<button class="primary-button" id="tpaSave"'+(!t?' disabled':'')+'>Save questions to server</button></div>'+
      '<p id="tpaStatus" class="admin-status" role="status">'+(dirty?'Unsaved changes.':'Ready to edit.')+'</p></article></section>';
    host.querySelector('#tpaTest').onchange=e=>{if(dirty){status('Save this question set before switching to another.');draw();return;}selected=e.target.value;selectedIndex=0;draw();};
    if(t){
      host.querySelector('#tpaQuestion').onchange=e=>{selectedIndex=Number(e.target.value);draw();};
      host.querySelector('#tpaCategory').oninput=e=>{t.category=e.target.value;setDirty(true);};
      host.querySelector('#tpaPublished').onchange=e=>{t.available=e.target.checked;setDirty(true);};
    }
    if(q){
      const bind=(id,key,transform=x=>x)=>host.querySelector('#'+id).oninput=e=>{q[key]=transform(e.target.value);setDirty(true);};
      bind('tpaTopic','topic');bind('tpaDifficulty','difficulty');bind('tpaText','question');
      bind('tpaCorrect','correctOption',Number);bind('tpaExplanation','explanation');
      host.querySelectorAll('[data-tpa-option]').forEach(e=>e.oninput=event=>{q.options[Number(event.target.dataset.tpaOption)]=event.target.value;setDirty(true);});
      host.querySelector('#tpaAdd').onclick=()=>{
        const ids=new Set(t.questions.map(x=>x.id));let id='topic-q-'+Date.now().toString(36);while(ids.has(id))id+='x';
        t.questions.push({id,topic:'',difficulty:'Foundation',question:'',options:['','','',''],correctOption:0,explanation:'',marks:1});
        selectedIndex=t.questions.length-1;setDirty(true);draw();
      };
      host.querySelector('#tpaDuplicate').onclick=()=>{
        const z=cp(q);let id=z.id+'-copy';const ids=new Set(t.questions.map(x=>x.id));while(ids.has(id))id+='x';
        z.id=id;t.questions.splice(selectedIndex+1,0,z);selectedIndex++;setDirty(true);draw();
      };
      host.querySelector('#tpaDelete').onclick=()=>{
        if(!confirm('Remove this question from the selected practice set?'))return;
        t.questions.splice(selectedIndex,1);selectedIndex=Math.max(0,selectedIndex-1);setDirty(true);draw();
      };
    }
    host.querySelector('#tpaSaveFlag').onclick=async()=>{
      const enabled=host.querySelector('#tpaEnabled').checked;
      const next=cp(config);next.features ||= {};next.features.topicPractice={...(next.features.topicPractice||{}),enabled};
      status('Saving feature access…');
      try{
        const result=await Api.auth('admin',{action:'save',file:'site-main.json',content:next,revision:configRevision},token);
        config=next;configRevision=result.revision;status('Feature access saved. Refresh student website to apply.');
      }catch(e){status('Could not save access: '+e.message);}
    };
    host.querySelector('#tpaCheck').onclick=()=>status(check().join(' ')||'All questions in the selected published set pass basic checks.');
    host.querySelector('#tpaSave').onclick=async()=>{
      const errors=check();
      if(errors.length){status(errors.join(' '));return;}
      if(!confirm('Publish updated practice questions and settings? This also updates the selected source test.'))return;
      const button=host.querySelector('#tpaSave');button.disabled=true;status('Saving…');
      try{
        const result=await Api.auth('admin',{action:'save',file:'tests.json',content:loaded,revision},token);
        revision=result.revision;setDirty(false);status('Saved to server. Existing report cards are preserved.');
      }catch(e){status('Save failed: '+e.message);}finally{button.disabled=false;}
    };
  }
  function check(){
    const t=current();if(!t)return ['Choose a practice set.'];
    const errors=[];
    if(t.available&&(!t.category||!t.category.trim()))errors.push('Enter a subject / category.');
    if(t.available&&!(t.questions||[]).length)errors.push('Published practice must contain questions.');
    (t.questions||[]).forEach((q,i)=>{
      const p='Question '+(i+1)+': ';
      if(!q.topic?.trim())errors.push(p+'topic is required.');
      if(!q.question?.trim())errors.push(p+'question text is required.');
      if(!Array.isArray(q.options)||q.options.length<2||q.options.some(v=>!String(v).trim()))errors.push(p+'every answer choice is required.');
      if(!Number.isInteger(q.correctOption)||q.correctOption<0||q.correctOption>=q.options.length)errors.push(p+'choose a correct answer.');
      if(!q.explanation?.trim())errors.push(p+'add an explanation for instant feedback.');
    });
    return errors.slice(0,8);
  }
  draw();
}
window.TopicPracticeAdmin={mount};
}());
