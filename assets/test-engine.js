(function () {
  const STORAGE_KEY = 'he_active_attempt_v2';
  const RESULT_KEY = 'he_results_v2';
  let timerId = null;

  const state = {
    test: null,
    current: 0,
    answers: [],
    checked: [],
    review: [],
    startedAt: null,
    totalEndsAt: null,
    questionEndsAt: null,
    elapsedSeconds: 0,
    mode: 'total-timed',
    feedbackMode: 'on-completion',
    sound: true
  };

  function tone(frequency = 650, duration = 0.08) {
    if (!state.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.035;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.stop(context.currentTime + duration);
    } catch (_) {}
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function save() {
    if (!state.test) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      testId: state.test.id,
      current: state.current,
      answers: state.answers,
      checked: state.checked,
      review: state.review,
      startedAt: state.startedAt,
      totalEndsAt: state.totalEndsAt,
      questionEndsAt: state.questionEndsAt,
      elapsedSeconds: state.elapsedSeconds,
      mode: state.mode,
      feedbackMode: state.feedbackMode
    }));
  }

  function activeAttempt() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { return null; }
  }

  function start(test, settings = {}, saved = null) {
    clearInterval(timerId);
    state.test = test;
    state.mode = settings.mode || test.defaultMode || 'total-timed';
    state.feedbackMode = settings.feedbackMode || test.feedbackMode || 'on-completion';
    state.sound = settings.sound !== false;
    state.current = saved?.current || 0;
    state.answers = saved?.answers || Array(test.questions.length).fill(null);
    state.checked = saved?.checked || Array(test.questions.length).fill(false);
    state.review = saved?.review || Array(test.questions.length).fill(false);
    state.startedAt = saved?.startedAt || Date.now();
    state.elapsedSeconds = saved?.elapsedSeconds || 0;
    state.totalEndsAt = saved?.totalEndsAt || (state.mode === 'total-timed'
      ? Date.now() + Number(test.timing.totalSeconds) * 1000
      : null);
    state.questionEndsAt = saved?.questionEndsAt || null;
    open(state.current, Boolean(saved));
    tone(760);
  }

  function open(index, preserveQuestionTimer = false) {
    state.current = Math.max(0, Math.min(index, state.test.questions.length - 1));
    if (state.mode === 'question-timed' && !preserveQuestionTimer) {
      state.questionEndsAt = Date.now() + Number(state.test.timing.questionSeconds) * 1000;
    }
    save();
    render();
    startClock();
  }

  function startClock() {
    clearInterval(timerId);
    updateClock();
    timerId = setInterval(() => {
      state.elapsedSeconds += 1;
      updateClock();
      if (state.elapsedSeconds % 5 === 0) save();
    }, 1000);
  }

  function updateClock() {
    const clock = document.getElementById('testClock');
    if (!clock || !state.test) return;
    if (state.mode === 'untimed') {
      clock.textContent = `Elapsed ${formatTime(state.elapsedSeconds)}`;
      return;
    }
    const endsAt = state.mode === 'total-timed' ? state.totalEndsAt : state.questionEndsAt;
    const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    clock.textContent = `${state.mode === 'total-timed' ? 'Total' : 'Question'} ${formatTime(seconds)}`;
    clock.classList.toggle('urgent', seconds <= Number(state.test.timing.warningSeconds || 10));
    if (seconds === Number(state.test.timing.warningSeconds || 10)) tone(850, 0.16);
    if (seconds > 0) return;
    clearInterval(timerId);
    tone(260, 0.22);
    if (state.mode === 'total-timed' || state.current === state.test.questions.length - 1) {
      finish(true);
    } else {
      if (state.feedbackMode === 'per-question') state.checked[state.current] = true;
      open(state.current + 1);
    }
  }

  function paletteClass(index) {
    return [
      state.answers[index] !== null ? 'answered' : '',
      state.review[index] ? 'reviewed' : '',
      state.checked[index] ? 'checked' : '',
      state.current === index ? 'current' : ''
    ].filter(Boolean).join(' ');
  }

  function render() {
    const mount = document.getElementById('app');
    const question = state.test.questions[state.current];
    const selected = state.answers[state.current];
    const isChecked = state.checked[state.current];
    const locked = state.feedbackMode === 'per-question' && isChecked;
    const total = state.test.questions.length;
    const optionClass = (index) => {
      if (!isChecked) return selected === index ? 'selected' : '';
      if (index === question.correctOption) return 'correct';
      if (selected === index) return 'incorrect';
      return '';
    };
    mount.innerHTML = `
      <section class="test-shell">
        <header class="test-head">
          <button class="icon-button" id="exitTest" type="button" aria-label="Exit test">←</button>
          <div><strong>${state.test.title}</strong><small>Question ${state.current + 1} of ${total}</small></div>
          <span class="test-clock" id="testClock"></span>
        </header>
        <div class="test-progress"><span style="width:${((state.current + 1) / total) * 100}%"></span></div>
        <div class="test-layout">
          <article class="question-card">
            <div class="question-meta"><span>${question.topic}</span><b>${question.marks || 1} mark</b></div>
            <h1>${question.question}</h1>
            ${question.code ? `<pre><code>${escapeHtml(question.code)}</code></pre>` : ''}
            <div class="answer-list">
              ${question.options.map((option, index) => `
                <label class="answer-option ${optionClass(index)}">
                  <input type="radio" name="answer" value="${index}" ${selected === index ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                  <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                  <span>${option}</span>
                </label>`).join('')}
            </div>
            ${isChecked ? `<div class="feedback ${selected === question.correctOption ? 'success' : 'danger'}"><strong>${selected === question.correctOption ? 'Correct answer' : 'Incorrect answer'}</strong><p>${question.explanation}</p></div>` : ''}
            <div class="test-actions">
              <button class="ghost-button" id="clearAnswer" type="button" ${locked ? 'disabled' : ''}>Clear</button>
              <button class="ghost-button ${state.review[state.current] ? 'active' : ''}" id="markReview" type="button">${state.review[state.current] ? 'Marked' : 'Mark for review'}</button>
              <button class="primary-button" id="nextQuestion" type="button">${state.feedbackMode === 'per-question' && !isChecked ? 'Check answer' : state.current === total - 1 ? 'Review & submit' : 'Save & next'} →</button>
            </div>
          </article>
          <aside class="test-sidebar">
            <div class="palette-head"><strong>Question navigator</strong><button id="closePalette" type="button">×</button></div>
            <div class="question-palette">
              ${state.test.questions.map((_, index) => `<button class="${paletteClass(index)}" data-question="${index}" type="button">${index + 1}</button>`).join('')}
            </div>
            <div class="palette-legend"><span><i class="answered"></i>Answered</span><span><i class="reviewed"></i>Review</span><span><i></i>Not answered</span></div>
            <button class="danger-button full" id="submitTest" type="button">Submit test</button>
          </aside>
        </div>
        <button class="palette-fab" id="openPalette" type="button">Questions</button>
      </section>`;

    document.querySelectorAll('input[name="answer"]').forEach(input => input.addEventListener('change', event => {
      state.answers[state.current] = Number(event.target.value);
      tone(540);
      save();
      render();
    }));
    document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => open(Number(button.dataset.question))));
    document.getElementById('clearAnswer').addEventListener('click', () => { state.answers[state.current] = null; save(); render(); });
    document.getElementById('markReview').addEventListener('click', () => { state.review[state.current] = !state.review[state.current]; save(); render(); });
    document.getElementById('nextQuestion').addEventListener('click', next);
    document.getElementById('submitTest').addEventListener('click', showSubmitDialog);
    document.getElementById('exitTest').addEventListener('click', () => {
      save();
      if (confirm('Your progress is saved. Exit this test?')) location.hash = '#/home';
    });
    document.getElementById('openPalette').addEventListener('click', () => document.querySelector('.test-sidebar').classList.add('open'));
    document.getElementById('closePalette').addEventListener('click', () => document.querySelector('.test-sidebar').classList.remove('open'));
  }

  function next() {
    const selected = state.answers[state.current];
    if (state.feedbackMode === 'per-question' && !state.checked[state.current]) {
      if (selected === null) return window.App.toast('Choose an answer before checking it.');
      state.checked[state.current] = true;
      const correct = selected === state.test.questions[state.current].correctOption;
      tone(correct ? 900 : 300, 0.18);
      save();
      render();
      return;
    }
    if (state.current === state.test.questions.length - 1) showSubmitDialog();
    else open(state.current + 1);
  }

  function showSubmitDialog() {
    const answered = state.answers.filter(value => value !== null).length;
    const review = state.review.filter(Boolean).length;
    window.App.modal(`
      <span class="eyebrow">FINAL CHECK</span>
      <h2>Submit this test?</h2>
      <div class="submit-summary">
        <div><strong>${answered}</strong><span>Answered</span></div>
        <div><strong>${state.test.questions.length - answered}</strong><span>Unanswered</span></div>
        <div><strong>${review}</strong><span>For review</span></div>
      </div>
      <p>You cannot change answers after submission.</p>
      <div class="modal-actions"><button class="ghost-button" data-close-modal>Continue test</button><button class="primary-button" id="confirmSubmit">Submit test</button></div>
    `);
    document.getElementById('confirmSubmit').addEventListener('click', () => finish(false));
  }

  function finish(autoSubmitted = false) {
    clearInterval(timerId);
    if (!state.test) return;
    const questions = state.test.questions;
    let correct = 0;
    let incorrect = 0;
    let score = 0;
    const topicScores = {};
    questions.forEach((question, index) => {
      const answer = state.answers[index];
      const isCorrect = answer === question.correctOption;
      const attempted = answer !== null;
      if (isCorrect) { correct += 1; score += Number(question.marks || 1); }
      else if (attempted) { incorrect += 1; score -= Number(state.test.negativeMarking || 0); }
      topicScores[question.topic] ||= { correct: 0, total: 0 };
      topicScores[question.topic].total += 1;
      if (isCorrect) topicScores[question.topic].correct += 1;
    });
    const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 1), 0);
    const percent = Math.max(0, Math.round((score / totalMarks) * 100));
    const result = {
      id: `result-${Date.now()}`,
      testId: state.test.id,
      baseTestId: state.test.baseTestId || state.test.id,
      title: state.test.title,
      questions: state.test.questions,
      date: new Date().toISOString(),
      answers: state.answers,
      correct,
      incorrect,
      unanswered: questions.length - correct - incorrect,
      score: Math.max(0, Number(score.toFixed(2))),
      totalMarks,
      percent,
      passed: percent >= Number(state.test.passPercent || 40),
      timeSeconds: Math.max(1, Math.floor((Date.now() - state.startedAt) / 1000)),
      topicScores,
      autoSubmitted
    };
    const results = getResults();
    results.unshift(result);
    localStorage.setItem(RESULT_KEY, JSON.stringify(results.slice(0, 50)));
    localStorage.removeItem(STORAGE_KEY);
    window.App.closeModal();
    tone(result.passed ? 920 : 420, 0.3);
    location.hash = `#/result/${result.id}`;
  }

  function getResults() {
    try { return JSON.parse(localStorage.getItem(RESULT_KEY)) || []; } catch (_) { return []; }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  }

  function stop() { clearInterval(timerId); }
  function setSound(value) { state.sound = value; }

  window.TestEngine = { start, stop, activeAttempt, getResults, formatTime, setSound, storageKey: STORAGE_KEY };
}());
