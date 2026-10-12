(function () {
  let STORAGE_KEY = 'he_active_attempt_v2_guest';
  let RESULT_KEY = 'he_results_v2_guest';
  let timerId = null;
  let resultHandler = null;
  let currentUserId = null;
  // Full signed-in history is cached in memory when browser storage reaches its quota.
  // The server retains the authoritative record for every saved attempt.
  let resultsCache = null;
  // Guest results exist only in RAM while the report or answer review is open.
  let transientGuestResult = null;
  function temporaryGuestResult(id) {
    return currentUserId === null && transientGuestResult?.id === id ? transientGuestResult : null;
  }
  function clearTemporaryGuestResult() { transientGuestResult = null; }
  function purgeOldGuestData() {
    [
      'he_active_attempt_v2_guest', 'he_results_v2_guest',
      'he_active_attempt_v2', 'he_results_v2',
      'he_guest_diagnostic_once_v1', 'he_guest_diagnostic_claimed_by_v1',
      'he_guest_diagnostic_claims_v2'
    ].forEach(key => localStorage.removeItem(key));
  }

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
    marking: null,
    markingMode: 'default',
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

  function shuffleCopy(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function randomizedDiagnosticQuestions(questions) {
    return shuffleCopy(questions.map(question => {
      const choices = shuffleCopy(question.options.map((value, index) => ({ value, index })));
      return {
        ...question,
        options: choices.map(choice => choice.value),
        correctOption: choices.findIndex(choice => choice.index === question.correctOption)
      };
    }));
  }
  function sameQuestions(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((question, index) => question.id === b[index].id &&
        question.options.every((option, pos) => option === b[index].options[pos]));
  }

  function save() {
    if (!state.test || currentUserId === null) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      testId: state.test.id,
      questions: state.test.type === 'diagnostic' ? state.test.questions : undefined,
      type: state.test.type || 'practice',
      examId: state.test.examId || state.test.examIds?.[0] || null,
      paperVersion: state.test.paperVersion || null,
      current: state.current,
      answers: state.answers,
      checked: state.checked,
      review: state.review,
      startedAt: state.startedAt,
      totalEndsAt: state.totalEndsAt,
      questionEndsAt: state.questionEndsAt,
      elapsedSeconds: state.elapsedSeconds,
      mode: state.mode,
      marking: state.marking,
      markingMode: state.markingMode,
      feedbackMode: state.feedbackMode
    }));
  }

  function activeAttempt() {
    if (currentUserId === null) return null;
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { return null; }
  }

  function start(test, settings = {}, saved = null) {
    clearInterval(timerId);
    const diagnostic = test.type === 'diagnostic';
    if (diagnostic && (currentUserId === null ? test.audience !== 'guest' : test.audience === 'guest')) return false;
    let preparedQuestions = test.questions;
    if (diagnostic && currentUserId !== null) {
      if (saved?.testId === test.id) {
        // Existing attempts must keep the same question and option order, even
        // when saved by an older version without an embedded question snapshot.
        preparedQuestions = Array.isArray(saved.questions) && saved.questions.length
          ? saved.questions
          : test.questions;
      } else {
        const previous = getResults().find(result => result.testId === test.id)?.questions;
        preparedQuestions = randomizedDiagnosticQuestions(test.questions);
        if (sameQuestions(preparedQuestions, previous) && preparedQuestions.length > 1) {
          [preparedQuestions[0], preparedQuestions[1]] = [preparedQuestions[1], preparedQuestions[0]];
        }
        if (sameQuestions(preparedQuestions, previous) && preparedQuestions.length === 1) {
          const entry = preparedQuestions[0];
          const choices = [...entry.options];
          [choices[0], choices[1]] = [choices[1], choices[0]];
          preparedQuestions[0] = { ...entry, options: choices, correctOption: entry.correctOption === 0 ? 1 : entry.correctOption === 1 ? 0 : entry.correctOption };
        }
      }
    }
    state.test = diagnostic && currentUserId !== null ? { ...test, questions: preparedQuestions } : test;
    state.markingMode = diagnostic ? 'default' : saved?.markingMode || settings.markingMode || 'default';
    state.marking = diagnostic ? { ...test.marking } : saved?.marking || settings.marking || test.marking || { correct: null, incorrect: -Number(test.negativeMarking || 0), unanswered: 0 };
    state.mode = diagnostic ? 'total-timed' : settings.mode || test.defaultMode || 'total-timed';
    state.feedbackMode = diagnostic ? 'on-completion' : settings.feedbackMode || test.feedbackMode || 'on-completion';
    state.sound = settings.sound !== false;
    state.current = saved?.current || 0;
    state.answers = saved?.answers || Array(test.questions.length).fill(null);
    state.checked = saved?.checked || Array(test.questions.length).fill(false);
    state.review = saved?.review || Array(test.questions.length).fill(false);
    state.startedAt = saved?.startedAt || Date.now();
    state.elapsedSeconds = saved?.elapsedSeconds || 0;
    state.totalEndsAt = diagnostic
      ? state.startedAt + Number(test.timing.totalSeconds) * 1000
      : saved?.totalEndsAt || (state.mode === 'total-timed'
        ? Date.now() + Number(test.timing.totalSeconds) * 1000
        : null);
    state.questionEndsAt = saved?.questionEndsAt || null;
    open(state.current, Boolean(saved));
    tone(760);
    return true;
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
            <div class="question-meta"><span>${question.topic}</span><b>+${state.markingMode === 'custom' ? state.marking.correct : question.marks ?? state.marking?.correct ?? 1} correct · ${state.marking.incorrect} wrong · ${state.marking.unanswered} unanswered</b></div>
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
    document.getElementById('submitTest').addEventListener('click', () => {
      if (state.test?.type === 'diagnostic') finish(false);
      else showSubmitDialog();
    });
    document.getElementById('exitTest').addEventListener('click', () => {
      save();
      if (confirm(currentUserId === null ? 'Exit this test? Your answers will be discarded.' : 'Your progress is saved. Exit this test?')) location.hash = currentUserId === null ? '#/diagnostic' : '#/home';
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
    if (state.current === state.test.questions.length - 1) {
      if (state.test.type === 'diagnostic') finish(false);
      else showSubmitDialog();
    }
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
      if (isCorrect) { correct += 1; score += Number(state.markingMode === 'custom' ? state.marking.correct : question.marks ?? state.marking?.correct ?? 1); }
      else if (attempted) { incorrect += 1; score += Number(state.marking.incorrect); }
      else score += Number(state.marking.unanswered);
      topicScores[question.topic] ||= { correct: 0, total: 0 };
      topicScores[question.topic].total += 1;
      if (isCorrect) topicScores[question.topic].correct += 1;
    });
    const totalMarks = questions.reduce((sum, question) => sum + Number(state.markingMode === 'custom' ? state.marking.correct : question.marks ?? state.marking?.correct ?? 1), 0);
    const percent = Math.max(0, Math.round((score / totalMarks) * 100));
    const result = {
      id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      testId: state.test.id,
      type: state.test.type || 'practice',
      examId: state.test.examId || state.test.examIds?.[0] || null,
      paperVersion: state.test.paperVersion || null,
      baseTestId: state.test.baseTestId || state.test.id,
      title: state.test.title,
      questions: state.test.questions,
      date: new Date().toISOString(),
      answers: state.answers,
      correct,
      incorrect,
      unanswered: questions.length - correct - incorrect,
      score: Number(score.toFixed(2)),
      totalMarks,
      marking: state.marking,
      markingMode: state.markingMode,
      percent,
      passed: percent >= Number(state.test.passPercent || 40),
      timeSeconds: Math.max(1, Math.floor((Date.now() - state.startedAt) / 1000)),
      topicScores,
      autoSubmitted
    };
    if (currentUserId === null) {
      transientGuestResult = result;
    } else {
      const results = getResults();
      results.unshift(result);
      persistResults(results);
      localStorage.removeItem(STORAGE_KEY);
      if (resultHandler) Promise.resolve(resultHandler(result)).catch(() => {});
    }
    window.App.closeModal();
    tone(result.passed ? 920 : 420, 0.3);
    location.hash = `#/result/${result.id}`;
  }

  function getResults() {
    if (currentUserId === null) return [];
    if (resultsCache !== null) return resultsCache;
    try {
      const value = JSON.parse(localStorage.getItem(RESULT_KEY));
      resultsCache = Array.isArray(value) ? value : [];
    } catch (_) { resultsCache = []; }
    return resultsCache;
  }
  function persistResults(results) {
    resultsCache = results;
    try {
      localStorage.setItem(RESULT_KEY, JSON.stringify(results));
    } catch (error) {
      // Do not destroy previously cached report cards when browser quota is full.
      // Keep the full archive in RAM and synchronize it to the student server.
      console.warn('Browser report-card cache is full; server history remains authoritative.', error);
    }
    return resultsCache;
  }
  function mergeResults(incoming = []) {
    if (currentUserId === null) return [];
    const map = new Map();
    [...getResults(), ...(Array.isArray(incoming) ? incoming : [])].forEach(result => {
      if (!result || !result.id) return;
      const current = map.get(String(result.id));
      if (!current || String(result.date || '') >= String(current.date || '')) map.set(String(result.id), result);
    });
    const merged = [...map.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return persistResults(merged);
  }
  function setResultHandler(handler) { resultHandler = typeof handler === 'function' ? handler : null; }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  }

  function stop() {
    clearInterval(timerId);
    if (currentUserId === null) {
      state.test = null;
      state.answers = [];
      state.checked = [];
      state.review = [];
    }
  }
  function setSound(value) { state.sound = value; }
  function setUser(id) {
    stop(); state.test = null;
    clearTemporaryGuestResult();
    currentUserId = id == null ? null : String(id);
    resultsCache = null;
    const suffix = id == null ? 'guest' : String(id);
    STORAGE_KEY = `he_active_attempt_v2_${suffix}`;
    RESULT_KEY = `he_results_v2_${suffix}`;
    // Clear guest data saved by older releases, without touching logged-in user records.
    purgeOldGuestData();
  }

  window.TestEngine = { start, stop, activeAttempt, getResults, mergeResults, setResultHandler, formatTime, setSound, setUser, temporaryGuestResult, clearTemporaryGuestResult, get storageKey() { return STORAGE_KEY; } };
}());
