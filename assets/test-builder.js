/* NaukriPreps guided administrator test-and-question builder.
   Uses existing authenticated load/save API, server revision checks and backups.
   No new student-facing endpoint or account permissions. */
(function () {
  'use strict';
  const copy = obj => JSON.parse(JSON.stringify(obj));
  const esc = val => String(val == null ? '' : val).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
  const letters = ['A','B','C','D'];
  const n = (value, fallback) => Number.isFinite(Number(value)) && String(value).trim() !== '' ? Number(value) : fallback;
  const positive = (value, fallback) => Math.max(0, n(value, fallback));
  function unique(base, taken) {
    let suffix = 2, value = base;
    while (taken.has(value)) value = base + '-' + suffix++;
    return value;
  }
  function emptyTest() {
    const id = 'new-test-' + Date.now().toString(36);
    return {
      id, title:'', description:'', category:'Practice',
      difficulty:'Foundation', icon:'book', examIds:[], examId:null,
      audience:'student', type:'practice', paperVersion:id+'-v1',
      totalMarks:0, negativeMarking:0, passPercent:40,
      defaultMode:'total-timed', feedbackMode:'on-completion',
      timing:{totalSeconds:900,questionSeconds:60,warningSeconds:10},
      marking:{correct:1,incorrect:0,unanswered:0},
      questions:[], available:false
    };
  }
  function makeQuestion(test) {
    const ids = new Set((test.questions || []).map(q => q.id));
    return {
      id:unique(test.id+'-q-'+String(test.questions.length+1).padStart(2,'0'),ids),
      topic:'', marks:positive(test.marking && test.marking.correct,1) || 1,
      question:'', options:['','','',''], correctOption:-1, explanation:''
    };
  }
  function validate(test) {
    const problems=[];
    if (!test.title || !test.title.trim()) problems.push('Give the test a title.');
    if (!Array.isArray(test.examIds) || !test.examIds.length) problems.push('Select at least one examination.');
    if (test.type==='diagnostic' && test.examIds.length !== 1)
      problems.push('For a logged-in diagnostic, select exactly one examination so results are linked to the right exam.');
    if (!Number.isFinite(test.timing && test.timing.totalSeconds) || test.timing.totalSeconds < 60)
      problems.push('Set the total duration to at least 1 minute.');
    if (!Number.isFinite(test.passPercent) || test.passPercent < 0 || test.passPercent > 100)
      problems.push('Pass percentage must be between 0 and 100.');
    if (!Number.isFinite(test.negativeMarking) || test.negativeMarking < 0)
      problems.push('Wrong-answer deduction cannot be negative. Enter the number of marks to deduct.');
    if (!Array.isArray(test.questions) || !test.questions.length)
      problems.push('Add at least one question.');
    const seen = new Set();
    (test.questions || []).forEach((q,i) => {
      const label='Question '+(i+1)+': ';
      if (!q.id || seen.has(q.id)) problems.push(label+'needs a unique internal ID.');
      seen.add(q.id);
      if (!String(q.question||'').trim()) problems.push(label+'enter the question text.');
      if (!String(q.topic||'').trim()) problems.push(label+'enter a topic.');
      if (!Array.isArray(q.options) || q.options.length!==4 || q.options.some(o=>!String(o||'').trim()))
        problems.push(label+'fill in all four answer choices (A, B, C and D).');
      if (!Number.isInteger(q.correctOption) || q.correctOption<0 || q.correctOption>3)
        problems.push(label+'choose the correct answer using the A/B/C/D selector.');
      if (!Number.isFinite(q.marks) || q.marks<=0)
        problems.push(label+'correct-answer marks must be greater than zero.');
    });
    return problems;
  }
  const options = (entries, value) => entries.map(entry => {
    const v=Array.isArray(entry) ? entry[0] : entry;
    const label=Array.isArray(entry) ? entry[1] : entry;
    return '<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(label)+'</option>';
  }).join('');
  const field = (title,key,value,placeholder,more) =>
    '<label class="tb-field"><span>'+esc(title)+'</span><input data-tfield="'+esc(key)+'" value="'+esc(value)+'" placeholder="'+esc(placeholder||'')+'" '+(more||'')+'></label>';
  const area = (title,key,value,hint) =>
    '<label class="tb-field tb-span"><span>'+esc(title)+'</span><textarea data-tfield="'+esc(key)+'" rows="3">'+esc(value)+'</textarea>'+(hint?'<small>'+esc(hint)+'</small>':'')+'</label>';
  function mount(workspace, cfg) {
    const { Api, token, onDirtyChange } = cfg;
    let exams=cfg.exams || [];
    let file=null, revision=null, test=null, selected='new', questionIndex=-1;
    let dirty=false, busy=false, notice='';
    const markDirty=() => {
      if (!dirty) { dirty=true; onDirtyChange(true); }
      const msg=workspace.querySelector('#tbNotice');
      if (msg) msg.textContent='Unsaved changes. Use Check test and Save to server when finished.';
      checkList();
      refreshPreview();
    };
    const recalc=() => {
      if (!test) return;
      test.totalMarks=test.questions.reduce((sum,q)=>sum+positive(q.marks,0),0);
      test.negativeMarking=positive(test.negativeMarking,0);
      test.marking=test.marking || {correct:1,incorrect:0,unanswered:0};
      test.marking.incorrect=-test.negativeMarking;
      test.marking.unanswered=0;
      test.timing=test.timing || {totalSeconds:900,questionSeconds:60,warningSeconds:10};
      test.examId=test.examIds && test.examIds.length ? test.examIds[0] : null;
    };
    const allowed = t => t && !(t.audience==='guest');
    const allTests=()=>file.tests.filter(allowed);
    const question=()=>test && test.questions[questionIndex];
    function refreshPreview() {
      const q=question(), box=workspace.querySelector('.tb-preview');
      if (!q || !box) return;
      const prompt=box.querySelector('p');
      if (prompt) prompt.textContent=q.question || 'Start by entering the question above.';
      box.querySelectorAll('ol li').forEach((li,i)=>{
        li.textContent=q.options[i] || 'Choice '+letters[i];
        li.classList.toggle('tb-preview-correct',i===q.correctOption);
      });
    }
    const checkList=()=>{
      const problems=validate(test);
      const box=workspace.querySelector('#tbChecklist');
      if (!box) return problems;
      box.innerHTML=problems.length
        ? '<strong>Needs attention before saving</strong><ul>'+problems.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'
        : '<strong class="tb-pass">Ready to save.</strong><p>All questions have four options, an answer and valid marks. Review the answers before making the test available.</p>';
      const count=workspace.querySelector('#tbQuestionCount');
      if (count) count.textContent=test.questions.length+' questions · '+test.totalMarks+' marks';
      return problems;
    };
    function render() {
      if (!file || !test) return;
      recalc();
      const q=question();
      const eligible=allTests();
      const selector='<option value="new"'+(selected==='new'?' selected':'')+'>+ Create a new test</option>'+
        eligible.map(t=>'<option value="'+esc(t.id)+'"'+(selected===t.id?' selected':'')+'>'+esc(t.title || t.id)+' ('+t.questions.length+' questions)</option>').join('');
      const items=test.questions.map((entry,i)=>'<button type="button" class="tb-question-item'+(i===questionIndex?' active':'')+'" data-action="open-question" data-index="'+i+'"><b>Q'+(i+1)+'</b><span>'+esc((entry.question||'New question').slice(0,80))+'</span></button>').join('');
      const multi=exams.map(e=>'<label class="tb-exam-option"><input type="checkbox" data-exam="'+esc(e.id)+'" '+(test.examIds.includes(e.id)?'checked':'')+'><span>'+esc(e.name||e.id)+'</span></label>').join('');
      const qArea=q ? '<div class="tb-question-edit">'+
        '<div class="tb-question-heading"><h3>Question '+(questionIndex+1)+'</h3><div class="tb-inline-tools">'+
          '<button type="button" data-action="duplicate-question" class="ghost-button">Duplicate</button>'+
          '<button type="button" data-action="move-up" class="ghost-button" '+(questionIndex===0?'disabled':'')+'>Move up</button>'+
          '<button type="button" data-action="move-down" class="ghost-button" '+(questionIndex===test.questions.length-1?'disabled':'')+'>Move down</button>'+
          '<button type="button" data-action="delete-question" class="ghost-button">Delete</button>'+
        '</div></div>'+
        '<label class="tb-field"><span>Question text <em>Required</em></span><textarea data-qfield="question" rows="3" placeholder="Type the question exactly as students should see it">'+esc(q.question||'')+'</textarea></label>'+
        '<div class="tb-two">'+
         '<label class="tb-field"><span>Topic</span><input data-qfield="topic" placeholder="For example: Number series" value="'+esc(q.topic||'')+'"></label>'+
         '<label class="tb-field"><span>Marks for correct answer</span><input data-qfield="marks" type="number" min="0.1" step="0.25" value="'+esc(q.marks)+'"></label>'+
        '</div>'+
        '<div class="tb-choice-heading"><h4>Answer choices</h4><p>Enter all four choices, then select the circle beside the <b>correct</b> one. You do not need to enter answer numbers.</p></div>'+
        '<div class="tb-options">'+letters.map((letter,i)=>'<div class="tb-option'+(q.correctOption===i?' correct':'')+'"><input type="radio" name="tbCorrectAnswer" data-correct="'+i+'" '+(q.correctOption===i?'checked':'')+' aria-label="Mark answer '+letter+' correct"><strong>'+letter+'</strong><input type="text" data-option="'+i+'" value="'+esc(q.options[i]||'')+'" aria-label="Answer choice '+letter+'" placeholder="Choice '+letter+'"></div>').join('')+'</div>'+
        '<label class="tb-field"><span>Explanation (shown in answer review)</span><textarea data-qfield="explanation" rows="2" placeholder="Why is the selected option correct?">'+esc(q.explanation||'')+'</textarea></label>'+
        '<details class="tb-extra"><summary>Optional: Code snippet for a programming question</summary><label class="tb-field"><span>Code shown with the question</span><textarea data-qfield="code" rows="3" placeholder="Optional program text">'+esc(q.code||'')+'</textarea></label></details>'+
        '<div class="tb-preview"><strong>Student preview</strong><p>'+esc(q.question||'Start by entering the question above.')+'</p><ol type="A">'+q.options.map((o,i)=>'<li'+(i===q.correctOption?' class="tb-preview-correct"':'')+'>'+esc(o||'Choice '+letters[i])+'</li>').join('')+'</ol><small>Correct choice is highlighted here only for administrators.</small></div>'+
       '</div>' :
       '<div class="tb-empty"><h3>No question selected</h3><p>Add the first question, then enter its text, four choices, and correct answer.</p><button type="button" class="primary-button" data-action="add-question">+ Add first question</button></div>';
      workspace.innerHTML=
       '<div class="tb-shell"><div class="tb-head"><div><span class="eyebrow">GUIDED TEST BUILDER</span><h2>Create tests and enter questions</h2><p>No JSON required. Follow the four steps and check everything before saving.</p></div><button type="button" class="ghost-button" data-action="download">Download backup</button></div>'+
       '<ol class="tb-steps"><li><b>1</b><span>Choose or create</span></li><li><b>2</b><span>Set test details</span></li><li><b>3</b><span>Add questions</span></li><li><b>4</b><span>Check and save</span></li></ol>'+
       '<section class="tb-section"><h3>1. Choose a test</h3><p>Create a new test or open an existing one for editing. Guest diagnostic questions are managed separately and cannot be changed here.</p>'+
       '<div class="tb-picker"><label class="tb-field"><span>Test to work on</span><select id="tbTestPicker">'+selector+'</select></label><button type="button" class="ghost-button" data-action="new-test">+ New test</button></div></section>'+
       '<section class="tb-section"><h3>2. Test details</h3><p>Students will see the title and description. Choose where the test belongs and how it is marked.</p>'+
       '<div class="tb-two">'+field('Test name','title',test.title,'For example: UP Police Reasoning Practice Set 2')+
       field('Subject / category','category',test.category,'For example: Reasoning')+'</div>'+
       area('Short description','description',test.description,'Describe what students will practise.')+
       '<div class="tb-two"><label class="tb-field"><span>Test type</span><select data-tfield="type">'+options([['practice','Practice / Mock Test'],['diagnostic','Logged-in Diagnostic']],test.type)+'</select></label>'+
       '<label class="tb-field"><span>Difficulty</span><select data-tfield="difficulty">'+options(['Foundation','Medium','Advanced'],test.difficulty)+'</select></label></div>'+
       '<fieldset class="tb-exams"><legend>Which examinations should show this test? <span>Choose at least one.</span></legend><div class="tb-exam-grid">'+multi+'</div></fieldset>'+
       '<div class="tb-two">'+
       field('Time limit (minutes)','duration',Math.round(positive(test.timing.totalSeconds,900)/60),'15','type="number" min="1" step="1"')+
       field('Marks deducted for a wrong answer','penalty',test.negativeMarking,'0 for no negative marking','type="number" min="0" step="0.25"')+
       field('Pass percentage','passPercent',test.passPercent,'40','type="number" min="0" max="100" step="1"')+
       '<label class="tb-field"><span>Visibility</span><label class="tb-toggle"><input type="checkbox" data-tfield="available" '+(test.available===true?'checked':'')+'><span>Make this test available to students after saving</span></label><small>Leave off while entering or checking questions. Saving an available test updates the live student site.</small></label>'+
       '</div></section>'+
       '<section class="tb-section"><div class="tb-question-heading"><div><h3>3. Questions</h3><p>Enter each question, four answers, and select the correct answer. All answer keys stay editable.</p></div><button type="button" class="primary-button" data-action="add-question">+ Add question</button></div>'+
       '<div class="tb-question-layout"><div class="tb-question-list" aria-label="Questions in this test">'+(items||'<p>No questions yet</p>')+'</div>'+qArea+'</div></section>'+
       '<section class="tb-section tb-save-section"><h3>4. Check and save</h3><p>Use <b>Check test</b> to find missing questions or answers. <b>Save to server</b> saves this entire test to the existing tests.json file (the previous version is backed up). If Visibility is on, students may see the changes after reloading the site.</p>'+
       '<div id="tbChecklist" class="tb-checklist"></div><div class="tb-save-actions"><strong id="tbQuestionCount"></strong><button type="button" data-action="check" class="ghost-button">Check test</button><button type="button" data-action="save" class="primary-button" '+(busy?'disabled':'')+'>Save to server</button></div><p id="tbNotice" class="admin-status" role="status" aria-live="polite">'+esc(notice|| (dirty?'Unsaved changes.':'Nothing has been saved from this editor yet.'))+'</p></section></div>';
      checkList();
    }
    function choose(id) {
      if (dirty && !confirm('Discard unsaved changes to this test?')) { render(); return; }
      selected=id;
      test=id==='new' ? emptyTest() : copy(file.tests.find(t=>t.id===id));
      questionIndex=test.questions.length ? 0 : -1;
      dirty=false;onDirtyChange(false);notice='';
      render();
    }
    function setValue(el) {
      if (!test) return;
      if (el.dataset.exam!==undefined) {
        const id=el.dataset.exam;
        test.examIds=el.checked ? [...new Set([...test.examIds,id])] : test.examIds.filter(x=>x!==id);
        recalc(); markDirty();return;
      }
      if (el.dataset.correct!==undefined) {
        const q=question(); if (!q) return;
        q.correctOption=Number(el.dataset.correct);
        workspace.querySelectorAll('.tb-option').forEach((row,i)=>row.classList.toggle('correct',i===q.correctOption));
        markDirty(); return;
      }
      if (el.dataset.option!==undefined) {
        const q=question();if (!q) return;q.options[Number(el.dataset.option)]=el.value;markDirty();return;
      }
      if (el.dataset.qfield!==undefined) {
        const q=question();if (!q) return;
        const key=el.dataset.qfield;
        if (key==='marks') q.marks=n(el.value,0);
        else if (key==='code') { if(el.value.trim()) q.code=el.value; else delete q.code; }
        else q[key]=el.value;
        recalc();markDirty();return;
      }
      if (el.dataset.tfield!==undefined) {
        const key=el.dataset.tfield;
        if (key==='duration') test.timing.totalSeconds=n(el.value,0)*60;
        else if (key==='penalty') {test.negativeMarking=n(el.value,0);test.marking.incorrect=-test.negativeMarking;}
        else if (key==='passPercent') test.passPercent=n(el.value,-1);
        else if (key==='available') test.available=el.checked;
        else if (key==='type') {test.type=el.value;test.audience='student';}
        else test[key]=el.value;
        recalc();markDirty();
      }
    }
    async function save() {
      if (busy) return;
      recalc();
      const issues=checkList();
      if (issues.length) {
        notice='Please fix the '+issues.length+' items listed above before saving.';
        const msg=workspace.querySelector('#tbNotice');if(msg)msg.textContent=notice;
        workspace.querySelector('#tbChecklist')?.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      const next=copy(file);
      const pos=next.tests.findIndex(t=>t.id===test.id);
      if (pos>=0) next.tests[pos]=copy(test);else next.tests.push(copy(test));
      const message=test.available===true
        ? 'Save and make this test available on the student website? This immediately updates live content after server validation.'
        : 'Save this test as unavailable? It will not be listed as a live test until you enable Visibility and save again.';
      if (!confirm(message)) return;
      busy=true;notice='Saving test to server...';const button=workspace.querySelector('[data-action="save"]');
      if(button)button.disabled=true;
      try {
        const result=await Api.auth('admin',{action:'save',file:'tests.json',content:next,revision},token);
        revision=result.revision;file=next;selected=test.id;
        dirty=false;onDirtyChange(false);
        notice=test.available
          ? 'Saved. Test is available to students. Reload the student site to verify its questions and scoring.'
          : 'Saved successfully with visibility off. The test is unavailable until you enable it and save again.';
        render();
      } catch(error) {
        notice=error.message || 'Could not save. Your unsaved changes are still in this form.';
        const msg=workspace.querySelector('#tbNotice'); if(msg)msg.textContent=notice;
      } finally {
        busy=false;if(button && button.isConnected)button.disabled=false;
      }
    }
    function download() {
      if(!file)return;
      const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='naukripreps-tests-backup.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),500);
    }
    workspace.addEventListener('input', event => {
      if (event.target.matches('[data-tfield],[data-qfield],[data-option]')) setValue(event.target);
    });
    workspace.addEventListener('change', event => {
      if(event.target.id==='tbTestPicker'){choose(event.target.value);return;}
      if (event.target.matches('[data-exam],[data-correct]') ||
        (event.target.matches('[data-tfield]') && ['type','difficulty','available'].includes(event.target.dataset.tfield)))
        setValue(event.target);
    });
    workspace.addEventListener('click', event => {
      const button=event.target.closest('button[data-action]'); if(!button)return;
      const action=button.dataset.action;
      if (action==='save') { save();return; }
      if (action==='check') {const issues=checkList();notice=issues.length?issues.length+' items need attention.':'Checklist passed. Review your answers and save.';workspace.querySelector('#tbNotice').textContent=notice;return;}
      if (action==='download') {download();return;}
      if (action==='new-test') {choose('new');return;}
      if (action==='open-question') {questionIndex=Number(button.dataset.index);render();return;}
      if (action==='add-question') {
        test.questions.push(makeQuestion(test));questionIndex=test.questions.length-1;markDirty();render();return;
      }
      if (action==='duplicate-question' && question()) {
        const q=copy(question());
        q.id=unique(test.id+'-q-'+String(test.questions.length+1).padStart(2,'0'),new Set(test.questions.map(v=>v.id)));
        test.questions.splice(questionIndex+1,0,q);questionIndex++;markDirty();render();return;
      }
      if (action==='delete-question' && question()) {
        if(!confirm('Delete question '+(questionIndex+1)+' from this unsaved test?'))return;
        test.questions.splice(questionIndex,1);questionIndex=test.questions.length?Math.min(questionIndex,test.questions.length-1):-1;
        markDirty();render();return;
      }
      if ((action==='move-up'||action==='move-down')&&question()) {
        const next=questionIndex+(action==='move-up'?-1:1);
        if(next<0||next>=test.questions.length)return;
        [test.questions[next],test.questions[questionIndex]]=[test.questions[questionIndex],test.questions[next]];
        questionIndex=next;markDirty();render();
      }
    });
    workspace.innerHTML='<p class="admin-status">Loading tests and examinations…</p>';
    return Promise.all([
      Api.auth('admin',{action:'load',file:'tests.json'},token),
      Api.auth('admin',{action:'load',file:'exams.json'},token)
    ]).then(([loaded,examsData])=>{
      if (!workspace.isConnected) return;
      if (!loaded.content||!Array.isArray(loaded.content.tests))throw Error('Tests file has an unexpected structure.');
      file=loaded.content;revision=loaded.revision;
      exams=Array.isArray(examsData.content?.exams)?examsData.content.exams:exams||[];
      selected='new';test=emptyTest();questionIndex=-1;render();
    }).catch(error=>{
      workspace.innerHTML='<h2>Test builder unavailable</h2><p class="admin-status">'+esc(error.message)+'</p><p>Check administrator access and use Exam content to access tests.json.</p>';
    });
  }
  window.ExamTestBuilder={mount,validate,emptyTest,makeQuestion};
}());