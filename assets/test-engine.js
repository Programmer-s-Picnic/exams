const TESTS_URL = `${DATA_ROOT}/tests.json`;

const testState = {
  test: null,
  mode: 'total-timed',
  current: 0,
  answers: [],
  review: [],
  totalEndsAt: null,
  questionEndsAt: null,
  timer: null,
  audioEnabled: true
};

function testTone(frequency = 660, duration = 0.12) {
  if (!testState.audioEnabled) return;
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.stop(context.currentTime + duration);
  } catch (error) {
    console.debug('Audio is unavailable', error);
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function testMarkup() {
  return `
    <div class="test-launch">
      <span class="eyebrow">WORKING SAMPLE TEST</span>
      <h2 id="sampleTestTitle">Loading Python test…</h2>
      <p id="sampleTestDescription"></p>
      <fieldset class="mode-picker">
        <legend>Choose timing mode</legend>
        <label><input type="radio" name="testMode" value="total-timed" checked> Total timed <small>3 minutes for the complete test</small></label>
        <label><input type="radio" name="testMode" value="question-timed"> Per-question timed <small>30 seconds for every question</small></label>
        <label><input type="radio" name="testMode" value="untimed"> Untimed <small>Practise without a countdown</small></label>
      </fieldset>
      <div class="test-launch-actions">
        <button class="button" id="beginSampleTest">Start Python test</button>
        <button class="sound-toggle" id="testSound" type="button" aria-pressed="true">Sound: On</button>
      </div>
    </div>
    <div class="live-test" id="liveTest" hidden></div>
    <div class="test-result" id="testResult" hidden></div>`;
}

async function initialiseSampleTest() {
  const mount = document.getElementById('pythonSampleTest');
  if (!mount) return;
  mount.innerHTML = testMarkup();

  try {
    const response = await fetch(TESTS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('tests.json');
    const data = await response.json();
    testState.test = data.tests.find((test) => test.id === 'python-basics-sample-01');
    if (!testState.test) throw new Error('Python sample test not found');

    document.getElementById('sampleTestTitle').textContent = testState.test.title;
    document.getElementById('sampleTestDescription').textContent = testState.test.description;
    document.getElementById('beginSampleTest').addEventListener('click', beginTest);
    document.getElementById('testSound').addEventListener('click', toggleTestSound);
  } catch (error) {
    mount.innerHTML = '<p class="test-error">The sample test could not be loaded. Please try again.</p>';
    console.error(error);
  }
}

function toggleTestSound(event) {
  testState.audioEnabled = !testState.audioEnabled;
  event.currentTarget.textContent = `Sound: ${testState.audioEnabled ? 'On' : 'Off'}`;
  event.currentTarget.setAttribute('aria-pressed', String(testState.audioEnabled));
  if (testState.audioEnabled) testTone();
}

function beginTest() {
  testState.mode = document.querySelector('input[name="testMode"]:checked').value;
  testState.current = 0;
  testState.answers = Array(testState.test.questions.length).fill(null);
  testState.review = Array(testState.test.questions.length).fill(false);
  testState.totalEndsAt = testState.mode === 'total-timed'
    ? Date.now() + testState.test.timing.totalSeconds * 1000
    : null;
  document.querySelector('.test-launch').hidden = true;
  document.getElementById('testResult').hidden = true;
  document.getElementById('liveTest').hidden = false;
  testTone(740);
  openQuestion(0);
}

function openQuestion(index) {
  clearInterval(testState.timer);
  testState.current = index;
  if (testState.mode === 'question-timed') {
    testState.questionEndsAt = Date.now() + testState.test.timing.questionSeconds * 1000;
  }
  renderQuestion();
  if (testState.mode !== 'untimed') {
    updateClock();
    testState.timer = setInterval(updateClock, 250);
  }
}

function renderQuestion() {
  const question = testState.test.questions[testState.current];
  const total = testState.test.questions.length;
  const selected = testState.answers[testState.current];
  const clockLabel = testState.mode === 'total-timed' ? 'Total time' :
    testState.mode === 'question-timed' ? 'Question time' : 'Untimed';

  document.getElementById('liveTest').innerHTML = `
    <div class="test-toolbar">
      <strong>Question ${testState.current + 1} of ${total}</strong>
      <span class="test-clock" id="testClock">${clockLabel}</span>
      <button class="sound-toggle" type="button" id="liveSound">Sound: ${testState.audioEnabled ? 'On' : 'Off'}</button>
    </div>
    <div class="test-progress"><span style="width:${((testState.current + 1) / total) * 100}%"></span></div>
    <div class="question-layout">
      <article class="question-card">
        <span class="status">${question.topic}</span>
        <h3>${question.question}</h3>
        <div class="answer-list">
          ${question.options.map((option, optionIndex) => `
            <label class="answer-option ${selected === optionIndex ? 'chosen' : ''}">
              <input type="radio" name="sampleAnswer" value="${optionIndex}" ${selected === optionIndex ? 'checked' : ''}>
              <span>${String.fromCharCode(65 + optionIndex)}. ${option}</span>
            </label>`).join('')}
        </div>
        <div class="question-actions">
          <button class="button secondary" id="previousQuestion" ${testState.current === 0 ? 'disabled' : ''}>Previous</button>
          <button class="review-button" id="reviewQuestion">${testState.review[testState.current] ? 'Unmark review' : 'Mark for review'}</button>
          <button class="button" id="nextQuestion">${testState.current === total - 1 ? 'Submit test' : 'Next'}</button>
        </div>
      </article>
      <aside class="question-palette" aria-label="Question palette">
        <strong>Questions</strong>
        <div>${testState.test.questions.map((item, i) => `<button class="${testState.answers[i] !== null ? 'answered' : ''} ${testState.review[i] ? 'reviewed' : ''} ${i === testState.current ? 'current' : ''}" data-question="${i}">${i + 1}</button>`).join('')}</div>
      </aside>
    </div>`;

  document.querySelectorAll('input[name="sampleAnswer"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      testState.answers[testState.current] = Number(event.target.value);
      testTone(520, 0.06);
      renderQuestion();
      if (testState.mode !== 'untimed') updateClock();
    });
  });
  document.getElementById('previousQuestion').addEventListener('click', () => openQuestion(testState.current - 1));
  document.getElementById('nextQuestion').addEventListener('click', () => {
    if (testState.current === total - 1) finishTest();
    else openQuestion(testState.current + 1);
  });
  document.getElementById('reviewQuestion').addEventListener('click', () => {
    testState.review[testState.current] = !testState.review[testState.current];
    renderQuestion();
    if (testState.mode !== 'untimed') updateClock();
  });
  document.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => openQuestion(Number(button.dataset.question)));
  });
  document.getElementById('liveSound').addEventListener('click', toggleTestSound);
}

function updateClock() {
  const clock = document.getElementById('testClock');
  if (!clock) return;
  const endsAt = testState.mode === 'total-timed' ? testState.totalEndsAt : testState.questionEndsAt;
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  clock.textContent = `${testState.mode === 'total-timed' ? 'Total' : 'Question'}: ${formatTime(seconds)}`;
  clock.classList.toggle('urgent', seconds <= testState.test.timing.warningSeconds);

  if (seconds === testState.test.timing.warningSeconds) testTone(880, 0.18);
  if (seconds === 0) {
    clearInterval(testState.timer);
    testTone(300, 0.25);
    if (testState.mode === 'total-timed' || testState.current === testState.test.questions.length - 1) {
      finishTest();
    } else {
      openQuestion(testState.current + 1);
    }
  }
}

function finishTest() {
  clearInterval(testState.timer);
  const correct = testState.test.questions.reduce((score, question, index) =>
    score + (testState.answers[index] === question.correctOption ? 1 : 0), 0);
  const total = testState.test.questions.length;
  const percent = Math.round((correct / total) * 100);
  const band = testState.test.resultBands.find((item) => percent >= item.minPercent);
  document.getElementById('liveTest').hidden = true;
  const result = document.getElementById('testResult');
  result.hidden = false;
  result.innerHTML = `
    <span class="eyebrow">TEST COMPLETE</span>
    <h2>${correct}/${total} — ${percent}%</h2>
    <p class="result-band">${band.label}: ${band.message}</p>
    <div class="answer-review">
      ${testState.test.questions.map((question, index) => {
        const isCorrect = testState.answers[index] === question.correctOption;
        return `<article class="${isCorrect ? 'correct' : 'incorrect'}"><strong>${index + 1}. ${isCorrect ? 'Correct' : 'Incorrect'}</strong><p>${question.explanation}</p></article>`;
      }).join('')}
    </div>
    <button class="button" id="retrySampleTest">Try again</button>`;
  document.getElementById('retrySampleTest').addEventListener('click', () => {
    result.hidden = true;
    document.querySelector('.test-launch').hidden = false;
  });
  testTone(correct === total ? 900 : 620, 0.3);
}

initialiseSampleTest();
