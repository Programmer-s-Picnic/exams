(async()=>{
  const card=document.getElementById('testCard');
  const id=new URLSearchParams(location.search).get('id')||'ctet-paper-1-sample-01';
  let qs=[],answers=[],pos=0,test,timer,timingMode='total',remaining=0,startedAt=0;
  try{
    const [td,qd]=await Promise.all([DataService.getTests(),DataService.getQuestions()]);
    test=td.tests.find(x=>x.id===id);
    qs=test.questionIds.map(qid=>qd.questions.find(q=>q.id===qid)).filter(Boolean);
    answers=Array(qs.length).fill(null);
    showInstructions();
  }catch(e){card.innerHTML='<div class="empty">The test could not be loaded. Please try again shortly.</div>'}

  function showInstructions(){
    card.innerHTML=`<span class="status confirmed">Free diagnostic</span><h1>${test.title}</h1><p>${test.description}</p>
      <div class="timing-choices">
        <label><input type="radio" name="timing" value="total" checked><span><strong>Total-test timer</strong><small>${test.durationMinutes} minutes for the complete test</small></span></label>
        <label><input type="radio" name="timing" value="per-question"><span><strong>Per-question timer</strong><small>${test.secondsPerQuestion} seconds per question; moves ahead automatically</small></span></label>
        <label><input type="radio" name="timing" value="untimed"><span><strong>Untimed practice</strong><small>No countdown; work at your own pace</small></span></label>
      </div><label class="honesty"><input type="checkbox" id="honest"> I will answer without external help.</label><button class="button full" id="begin">Begin test</button>`;
    begin.onclick=()=>{if(!honest.checked)return alert('Please confirm before starting.');timingMode=card.querySelector('input[name="timing"]:checked').value;start()};
  }
  function start(){startedAt=Date.now();resetCountdown();if(timingMode!=='untimed')timer=setInterval(tick,1000);render()}
  function resetCountdown(){remaining=timingMode==='total'?test.durationMinutes*60:test.secondsPerQuestion}
  function tick(){remaining--;renderTime();if(remaining>0)return;if(timingMode==='total')finish();else if(pos<qs.length-1){pos++;resetCountdown();render()}else finish()}
  function formatTime(value){return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`}
  function renderTime(){const el=document.getElementById('clock');if(!el)return;if(timingMode==='untimed'){el.textContent=`Elapsed ${formatTime(Math.floor((Date.now()-startedAt)/1000))}`}else{el.textContent=`${timingMode==='per-question'?'Question ':''}${formatTime(remaining)}`;el.classList.toggle('urgent',remaining<=10)}}
  function render(){
    const q=qs[pos];
    card.innerHTML=`<div class="test-meta"><strong>Question ${pos+1} of ${qs.length}</strong><strong id="clock"></strong></div><div class="progress"><span style="width:${(pos+1)/qs.length*100}%"></span></div><span class="status">${q.subject}</span><h2>${q.question.en}</h2><div class="options">${q.options.en.map((o,i)=>`<button class="option ${answers[pos]===i?'selected':''}" data-i="${i}">${String.fromCharCode(65+i)}. ${o}</button>`).join('')}</div><div class="test-nav"><button class="button secondary" id="prev" ${pos===0?'disabled':''}>Previous</button><button class="button" id="next">${pos===qs.length-1?'Submit':'Next'}</button></div>`;
    renderTime();
    card.querySelectorAll('.option').forEach(x=>x.onclick=()=>{answers[pos]=+x.dataset.i;render()});
    prev.onclick=()=>{pos--;if(timingMode==='per-question')resetCountdown();render()};
    next.onclick=()=>{if(pos<qs.length-1){pos++;if(timingMode==='per-question')resetCountdown();render()}else if(confirm('Submit the test?'))finish()};
  }
  function finish(){
    clearInterval(timer);
    const correct=qs.reduce((n,q,i)=>n+(answers[i]===q.answerIndex),0),pct=Math.round(correct/qs.length*100),level=pct<45?1:pct<75?2:3;
    const elapsedSeconds=Math.floor((Date.now()-startedAt)/1000);
    localStorage.setItem('he_latest_result',JSON.stringify({testId:id,correct,total:qs.length,percentage:pct,level,timingMode,elapsedSeconds,createdAt:new Date().toISOString()}));
    location.href=`../result/?score=${correct}&total=${qs.length}&level=${level}&mode=${encodeURIComponent(timingMode)}&time=${elapsedSeconds}`;
  }
})();
