/* ExamPreps topic-wise practice. Separate from timed mock and diagnostic engines. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const escapeAttr = esc;
  const sort = items => [...items].sort((a,b) => a.localeCompare(b));
  const shuffle = items => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const state = { exam:'', subject:'', topic:'', difficulty:'All', count:10, draft:null, saving:Promise.resolve(), busy:false, error:'' };
  let generation = 0;
  function configEnabled(app) {
    return app.config?.features?.topicPractice?.enabled !== false;
  }
  function bank(app, examId) {
    const rows = [];
    app.tests.filter(t => t.available === true &&
      t.audience !== 'guest' && t.type !== 'diagnostic' &&
      !/diagnostic/i.test(String(t.category || '') + ' ' + String(t.title || '')) &&
      Array.isArray(t.examIds) && t.examIds.includes(examId)
    ).forEach(t => (t.questions || []).forEach(q => {
      if (!q || !Array.isArray(q.options) || q.options.length < 2 ||
          !Number.isInteger(q.correctOption) || q.correctOption < 0 ||
          q.correctOption >= q.options.length || !String(q.question || '').trim()) return;
      const subject = String(q.subject || t.category || 'General').trim();
      const topic = String(q.topicName || q.topic || 'General').trim();
      const difficulty = String(q.difficulty || t.difficulty || 'Foundation').trim();
      rows.push({ subject, topic, difficulty, sourceId:t.id, question:clone(q) });
    }));
    return rows;
  }
  function filtered(app) {
    return bank(app,state.exam).filter(x =>
      (!state.subject || x.subject === state.subject) &&
      (!state.topic || x.topic === state.topic) &&
      (state.difficulty === 'All' || x.difficulty === state.difficulty));
  }
  function option(values, selected) {
    return values.map(v => '<option value="'+escapeAttr(v)+'"'+(v===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
  }
  function field(id, label, values, chosen) {
    return '<label class="tp-field"><span>'+esc(label)+'</span><select id="'+id+'">'+option(values,chosen)+'</select></label>';
  }
  function message(mount, text) {
    const e = mount.querySelector('#tpMessage');
    if (e) e.textContent = text;
  }
  function selector(app, mount, token) {
    const exams = app.exams.filter(e => e.available);
    if (!exams.some(e => e.id === state.exam)) state.exam = app.preferences.primary && exams.some(e => e.id === app.preferences.primary)
      ? app.preferences.primary : (exams[0]?.id || '');
    const all = bank(app,state.exam);
    const subjects = sort([...new Set(all.map(x => x.subject))]);
    if (!subjects.includes(state.subject)) state.subject = subjects[0] || '';
    const topics = sort([...new Set(all.filter(x => x.subject === state.subject).map(x => x.topic))]);
    if (!topics.includes(state.topic)) state.topic = topics[0] || '';
    const levels = sort([...new Set(all.filter(x=>x.subject===state.subject && x.topic===state.topic).map(x=>x.difficulty))]);
    if (state.difficulty !== 'All' && !levels.includes(state.difficulty)) state.difficulty = 'All';
    const eligible = filtered(app);
    const counts = [5,10,15,20,25,50].filter(n=>n<=Math.max(eligible.length,1));
    if (eligible.length && !counts.includes(state.count)) state.count = counts.reduce((a,b)=>Math.abs(b-state.count)<Math.abs(a-state.count)?b:a,counts[0]||1);
    if (!counts.length) state.count = 1;
    mount.innerHTML =
      '<section class="page tp-page"><div class="page-hero compact"><span class="eyebrow">FOCUSED LEARNING</span><h1>Topic-wise Practice</h1>'+
      '<p>Choose an examination, subject and topic. Each answer gives immediate feedback and an explanation. Existing mock and diagnostic tests are unchanged.</p>'+
      '<a class="ghost-button" href="#/tests">← All tests</a></div>'+
      '<article class="tp-card"><h2>Build your practice session</h2><div class="tp-grid">'+
      '<label class="tp-field"><span>Examination</span><select id="tpExam">'+exams.map(e=>'<option value="'+escapeAttr(e.id)+'"'+(e.id===state.exam?' selected':'')+'>'+esc(e.name)+'</option>').join('')+'</select></label>'+
      field('tpSubject','Subject',subjects,state.subject)+field('tpTopic','Topic',topics,state.topic)+
      field('tpDifficulty','Difficulty',['All',...levels],state.difficulty)+
      '<label class="tp-field"><span>Number of questions</span><select id="tpCount">'+option(counts.map(String),String(state.count))+'</select></label>'+
      '</div><p class="tp-available">'+eligible.length+' eligible published question(s) available for this selection.</p>'+
      '<div class="result-actions"><button class="primary-button" id="tpStart" type="button" '+(!eligible.length?'disabled':'')+'>Start practice →</button>'+
      '<a class="ghost-button" href="#/results">Saved reports</a></div><p class="admin-status" id="tpMessage" role="status">'+esc(state.error)+'</p></article>'+
      '<article class="tp-card"><h3>How practice works</h3><p>Choose an option, then select <b>Check answer</b> to see correctness and the explanation. Your progress is saved to your account after each checked answer. Complete the session to generate a saved report card.</p></article></section>';
    [['tpExam','exam'],['tpSubject','subject'],['tpTopic','topic'],['tpDifficulty','difficulty']].forEach(pair => {
      mount.querySelector('#'+pair[0]).onchange = e => { state[pair[1]]=e.target.value;state.error='';selector(app,mount,token); };
    });
    mount.querySelector('#tpCount').onchange = e=>state.count=Number(e.target.value);
    mount.querySelector('#tpStart').onclick = async () => {
      if (state.busy) return;
      const candidates = filtered(app);
      if (!candidates.length) return;
      state.busy=true;
      const selected=shuffle(candidates).slice(0,Math.min(Number(state.count)||10,candidates.length));
      const questions=selected.map(row=>{
        const q=clone(row.question);
        const choices=shuffle(q.options.map((text,index)=>({text,index})));
        return {
          id:String(row.sourceId)+':'+String(q.id), sourceId:row.sourceId,
          subject:row.subject, topic:row.topic, difficulty:row.difficulty,
          question:q.question, code:q.code || '', options:choices.map(c=>c.text),
          correctOption:choices.findIndex(c=>c.index===q.correctOption),
          explanation:q.explanation || 'Explanation not yet provided by the administrator.',
          marks:Number(q.marks)||1
        };
      });
      const draft={attemptId:'tp-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,13),
        examId:state.exam, subject:state.subject, topic:state.topic, difficulty:state.difficulty,
        index:0, answers:Array(questions.length).fill(null), questions, startedAt:new Date().toISOString()};
      try {
        await Api.auth('topic-practice',{action:'save',draft},token);
        state.draft=draft;state.error='';state.busy=false;questionScreen(app,mount,token);
      } catch(err){state.busy=false;state.error='Could not start a saved session: '+err.message;selector(app,mount,token);}
    };
  }
  function progressSave(token,draft) {
    const snapshot=clone(draft);
    state.saving=state.saving.catch(()=>{}).then(()=>Api.auth('topic-practice',{action:'save',draft:snapshot},token));
    return state.saving;
  }
  function questionScreen(app,mount,token) {
    const draft=state.draft;
    if (!draft || !draft.questions.length) return selector(app,mount,token);
    const index=Math.min(draft.index,draft.questions.length-1);
    const q=draft.questions[index];
    const answered=draft.answers[index] !== null;
    mount.innerHTML='<section class="page narrow tp-page"><div class="page-hero compact">'+
      '<span class="eyebrow">TOPIC-WISE PRACTICE</span><h1>'+esc(draft.subject)+' · '+esc(draft.topic)+'</h1>'+
      '<p>Question '+(index+1)+' of '+draft.questions.length+' · '+esc(draft.difficulty)+' · Immediate feedback</p>'+
      '<div class="tp-progress"><span style="width:'+((index+1)/draft.questions.length*100)+'%"></span></div></div>'+
      '<article class="tp-card"><div class="tp-qhead"><strong>Question '+(index+1)+'</strong><span>'+esc(q.difficulty)+'</span></div>'+
      '<h2>'+esc(q.question)+'</h2>'+(q.code?'<pre><code>'+esc(q.code)+'</code></pre>':'')+
      '<div class="tp-options">'+q.options.map((v,i)=>'<label class="tp-option'+(answered?(i===q.correctOption?' tp-correct':i===draft.answers[index]?' tp-incorrect':''):'')+'">'+
        '<input type="radio" name="tpAnswer" value="'+i+'"'+(draft.answers[index]===i?' checked':'')+(answered?' disabled':'')+'>'+
        '<b>'+String.fromCharCode(65+i)+'</b><span>'+esc(v)+'</span></label>').join('')+'</div>'+
      (answered?'<div class="tp-feedback"><strong>'+(draft.answers[index]===q.correctOption?'✓ Correct answer':'Correct option: '+String.fromCharCode(65+q.correctOption))+'</strong>'+
      '<p>'+esc(q.explanation)+'</p></div>':'')+
      '<div class="result-actions">'+(answered?
        '<button class="primary-button" id="tpNext">'+(index===draft.questions.length-1?'Finish and save report':'Next question →')+'</button>':
        '<button class="primary-button" id="tpCheck" disabled>Check answer</button>')+
      '<button class="ghost-button" id="tpLeave">Return to practice menu</button></div>'+
      '<p class="admin-status" id="tpMessage" role="status">'+esc(state.error)+'</p></article></section>';
    if (!answered) {
      const check=mount.querySelector('#tpCheck');
      mount.querySelectorAll('input[name="tpAnswer"]').forEach(input=>input.onchange=()=>check.disabled=false);
      check.onclick=async () => {
        const picked=mount.querySelector('input[name="tpAnswer"]:checked');
        if (!picked || state.busy) return;
        state.busy=true;check.disabled=true;
        const old=draft.answers[index];
        draft.answers[index]=Number(picked.value);
        try {await progressSave(token,draft);state.error='';state.busy=false;questionScreen(app,mount,token);}
        catch(e){draft.answers[index]=old;state.error='Could not save this answer. Check your connection and retry.';state.busy=false;questionScreen(app,mount,token);}
      };
    } else {
      mount.querySelector('#tpNext').onclick=async e=>{
        if(state.busy)return;state.busy=true;e.currentTarget.disabled=true;
        if(index===draft.questions.length-1) return finish(app,mount,token);
        draft.index=index+1;
        try{await progressSave(token,draft);state.busy=false;state.error='';questionScreen(app,mount,token);}
        catch(err){draft.index=index;state.busy=false;state.error='Could not save the next position. Retry.';questionScreen(app,mount,token);}
      };
    }
    mount.querySelector('#tpLeave').onclick=()=>{location.hash='#/topic-practice';state.draft=null;selector(app,mount,token);};
  }
  async function finish(app,mount,token) {
    const draft=state.draft;
    if(!draft)return;
    const correct=draft.questions.reduce((n,q,i)=>n+Number(draft.answers[i]===q.correctOption),0);
    const topicScores={};
    draft.questions.forEach((q,i)=>{
      topicScores[q.topic] ||= {correct:0,total:0};
      topicScores[q.topic].total++;
      if(draft.answers[i]===q.correctOption) topicScores[q.topic].correct++;
    });
    const total=draft.questions.length;
    const score=draft.questions.reduce((n,q,i)=>n+(draft.answers[i]===q.correctOption?Number(q.marks)||1:0),0);
    const totalMarks=draft.questions.reduce((n,q)=>n+(Number(q.marks)||1),0);
    const result={
      id:'topic-result-'+draft.attemptId, testId:'topic:'+draft.examId+':'+draft.subject+':'+draft.topic,
      baseTestId:'topic:'+draft.examId+':'+draft.subject+':'+draft.topic,
      title:'Topic Practice — '+draft.subject+' / '+draft.topic,
      type:'topic-practice',examId:draft.examId,questions:draft.questions,
      answers:draft.answers,correct,incorrect:total-correct,unanswered:0,score,totalMarks,
      percent:Math.round(score/totalMarks*100),passed:score/totalMarks>=.4,
      marking:{correct:1,incorrect:0,unanswered:0},markingMode:'default',
      topicScores,date:new Date().toISOString(),timeSeconds:Math.max(0,Math.floor((Date.now()-Date.parse(draft.startedAt))/1000)),
      autoSubmitted:false
    };
    mount.innerHTML='<section class="page narrow"><article class="tp-card"><h2>Saving your practice report…</h2><p role="status" id="tpMessage">Checking your saved answers.</p></article></section>';
    try {
      await state.saving.catch(()=>{});
      await Api.auth('results',{result},token);
      try{await Api.auth('topic-practice',{action:'clear',attemptId:draft.attemptId},token);}catch(e){console.warn('Draft cleanup deferred',e);}
      state.draft=null;state.busy=false;state.error='';
      mount.innerHTML='<section class="page narrow"><article class="tp-card"><span class="eyebrow">SESSION COMPLETE</span>'+
        '<h1>'+result.percent+'% score</h1><p>'+correct+' of '+total+' correct. Your report is saved to your account.</p>'+
        '<div class="result-actions"><a class="primary-button" href="#/result/'+encodeURIComponent(result.id)+'">Open report card →</a>'+
        '<a class="ghost-button" href="#/topic-practice">Practice another topic</a></div></article></section>';
    }catch(e) {
      state.busy=false;state.error='Report not yet saved. Keep this page open and retry: '+e.message;
      mount.innerHTML='<section class="page narrow"><article class="tp-card"><h2>Report not saved yet</h2>'+
        '<p role="alert">'+esc(state.error)+'</p><button id="tpRetry" class="primary-button">Retry saving report</button></article></section>';
      mount.querySelector('#tpRetry').onclick=()=>{state.busy=true;finish(app,mount,token);};
    }
  }
  async function mount(app,token) {
    const el=document.getElementById('app');
    const run=++generation;
    if(!configEnabled(app)){el.innerHTML='<section class="page"><article class="tp-card"><h1>Topic practice is currently unavailable</h1><p>The administrator has switched this add-on off.</p><a class="primary-button" href="#/tests">Browse tests</a></article></section>';return;}
    if(!token || !app.user){el.innerHTML='<section class="page"><p>Please sign in to practise topics.</p></section>';return;}
    el.innerHTML='<section class="page"><p>Loading your saved practice progress…</p></section>';
    try {
      const response=await Api.auth('topic-practice',undefined,token);
      if(run!==generation || location.hash!=='#/topic-practice')return;
      state.draft=response.draft && Array.isArray(response.draft.questions) &&
        Array.isArray(response.draft.answers) && response.draft.questions.length===response.draft.answers.length
        ? response.draft : null;
      state.error='';
      if(state.draft && state.draft.index<state.draft.questions.length) {
        el.innerHTML='<section class="page"><article class="tp-card"><h2>Resume saved topic practice?</h2>'+
          '<p>'+esc(state.draft.subject)+' · '+esc(state.draft.topic)+' · '+state.draft.questions.length+' questions</p>'+
          '<div class="result-actions"><button class="primary-button" id="tpResume">Resume session</button>'+
          '<button class="ghost-button" id="tpFresh">Start a new session</button></div></article></section>';
        el.querySelector('#tpResume').onclick=()=>questionScreen(app,el,token);
        el.querySelector('#tpFresh').onclick=async()=>{
          if(!confirm('Replace your saved unfinished topic session?'))return;
          try{await Api.auth('topic-practice',{action:'clear',attemptId:state.draft.attemptId},token);state.draft=null;selector(app,el,token);}
          catch(e){message(el,e.message);}
        };
      } else selector(app,el,token);
    } catch(e) {
      if(run!==generation)return;
      el.innerHTML='<section class="page"><article class="tp-card"><h2>Cannot load saved practice progress</h2>'+
        '<p role="alert">'+esc(e.message)+'</p><button id="tpRetryLoad" class="primary-button">Retry</button></article></section>';
      el.querySelector('#tpRetryLoad').onclick=()=>mount(app,token);
    }
  }
  window.TopicPractice={mount,bank};
}());
