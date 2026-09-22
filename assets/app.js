(function () {
  const KEYS = {
    user: 'he_user_v2',
    preferences: 'he_preferences_v2',
    sound: 'he_sound_v2'
  };

  const state = {
    config: null,
    users: [],
    exams: [],
    tests: [],
    user: read(KEYS.user),
    preferences: read(KEYS.preferences) || { selected: [], primary: null },
    sound: read(KEYS.sound) !== false,
    filters: { query: '', exam: 'all', status: 'all' }
  };

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }
  async function hashPassword(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function icon(name) {
    const icons = {
      police: '<path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
      teacher: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M8 7h8M8 11h6"/>',
      land: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/>',
      pet: '<path d="M4 19V5h16v14H4Z"/><path d="M8 9h8M8 13h5"/>',
      village: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
      code: '<path d="m8 9-4 3 4 3m8-6 4 3-4 3m-3-9-2 12"/>',
      chart: '<path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/>',
      test: '<path d="M6 3h12v18H6z"/><path d="M9 8h6m-6 4h6m-6 4h3"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.test}</svg>`;
  }

  async function loadFragment(id, url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${url}`);
    document.getElementById(id).innerHTML = await response.text();
  }

  async function initialise() {
    try {
      const [, , config, users, exams, tests] = await Promise.all([
        loadFragment('site-header', 'header.html'),
        loadFragment('site-footer', 'footer.html'),
        Api.request('site-main.json'),
        Api.request('users-registered.json'),
        Api.request('exams.json'),
        Api.request('tests.json')
      ]);
      state.config = config;
      state.users = users.users || [];
      state.exams = exams.exams || [];
      state.tests = tests.tests || [];
      applyBranding();
      bindShell();
      route();
      window.addEventListener('hashchange', route);
    } catch (error) {
      console.error(error);
      document.getElementById('app').innerHTML = `<section class="error-state"><div class="empty-icon">!</div><h1>We could not load the application</h1><p>${escapeHtml(error.message)}</p><button class="primary-button" onclick="location.reload()">Try again</button></section>`;
    }
  }

  function applyBranding() {
    const site = state.config.site;
    document.title = `${site.name} | ${site.tagline}`;
    document.getElementById('siteDescription').content = site.description;
    document.querySelectorAll('[data-site-name]').forEach(node => { node.textContent = site.name; });
    document.querySelectorAll('[data-site-short]').forEach(node => { node.textContent = site.shortName; });
    document.querySelectorAll('[data-site-tagline]').forEach(node => { node.textContent = site.tagline; });
    document.querySelectorAll('[data-site-year]').forEach(node => { node.textContent = new Date().getFullYear(); });
    updateUserShell();
  }

  function bindShell() {
    document.getElementById('profileButton').addEventListener('click', () => { location.hash = '#/profile'; });
    document.getElementById('soundButton').addEventListener('click', () => {
      state.sound = !state.sound;
      write(KEYS.sound, state.sound);
      TestEngine.setSound(state.sound);
      updateSoundButton();
      toast(`Sounds ${state.sound ? 'enabled' : 'muted'}.`);
    });
    updateSoundButton();
  }

  function updateSoundButton() {
    const button = document.getElementById('soundButton');
    if (button) {
      button.textContent = state.sound ? '🔊' : '🔇';
      button.setAttribute('aria-pressed', String(state.sound));
    }
  }

  function updateUserShell() {
    const loggedIn = Boolean(state.user);
    document.body.classList.toggle('logged-out', !loggedIn);
    document.getElementById('headerStudent').textContent = state.user?.name?.split(' ')[0] || 'Student';
    document.getElementById('headerAvatar').textContent = state.user?.name?.charAt(0).toUpperCase() || 'S';
  }

  function currentRoute() {
    const parts = (location.hash.replace(/^#\//, '') || 'home').split('/');
    return { name: parts[0], id: parts[1] };
  }

  function route() {
    TestEngine.stop();
    closeModal();
    if (!state.user) return renderLogin();
    const { name, id } = currentRoute();
    if (!state.preferences.primary && name !== 'onboarding' && name !== 'profile') {
      location.hash = '#/onboarding';
      return;
    }
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === (name === 'result' ? 'results' : name)));
    document.body.classList.toggle('focus-mode', name === 'attempt');
    const routes = {
      home: renderDashboard,
      onboarding: renderOnboarding,
      tests: renderTests,
      instructions: () => renderInstructions(id),
      attempt: () => beginAttempt(id),
      results: renderResults,
      result: () => renderResult(id),
      review: () => renderReview(id),
      profile: renderProfile,
      help: renderHelp
    };
    (routes[name] || renderDashboard)();
    window.scrollTo(0, 0);
  }

  function renderLogin() {
    document.body.classList.add('logged-out');
    document.getElementById('app').innerHTML = `
      <section class="auth-page">
        <div class="auth-glow one"></div><div class="auth-glow two"></div>
        <article class="auth-card">
          <div class="auth-brand"><span class="brand-mark">HE</span><strong>Himanshu Exams</strong></div>
          <span class="eyebrow">STUDENT PORTAL</span>
          <h1>Welcome back</h1>
          <p>Continue your preparation with tests, feedback and a clear plan.</p>
          <form id="loginForm">
            <label>Mobile number or email<input id="loginId" autocomplete="username" required placeholder="student@example.com"></label>
            <label>Password<span class="password-wrap"><input id="loginPassword" type="password" autocomplete="current-password" required placeholder="Enter your password"><button type="button" id="showPassword" aria-label="Show password">Show</button></span></label>
            <div class="form-row"><label class="checkbox"><input type="checkbox" id="rememberLogin" checked> Remember this session</label><a href="#/help">Need help?</a></div>
            <p class="form-error" id="loginError" role="alert"></p>
            <button class="primary-button full" type="submit">Sign in securely →</button>
          </form>
          <div class="demo-login"><strong>Demo account</strong><span>student@example.com</span><span>Password: demo123</span></div>
          <div class="trust-row"><span>✓ Student-first design</span><span>✓ Progress saved</span></div>
        </article>
      </section>`;
    document.getElementById('showPassword').addEventListener('click', event => {
      const input = document.getElementById('loginPassword');
      input.type = input.type === 'password' ? 'text' : 'password';
      event.currentTarget.textContent = input.type === 'password' ? 'Show' : 'Hide';
    });
    document.getElementById('loginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const login = document.getElementById('loginId').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value;
      const passwordHash = await hashPassword(password);
      const user = state.users.find(item => [item.email, item.mobile, item.studentId].map(String).map(value => value.toLowerCase()).includes(login) && item.passwordHash === passwordHash);
      if (!user) {
        document.getElementById('loginError').textContent = 'The login details do not match our demo records.';
        return;
      }
      state.user = { id: user.id, name: user.name, email: user.email, mobile: user.mobile };
      write(KEYS.user, state.user);
      updateUserShell();
      location.hash = state.preferences.primary ? '#/home' : '#/onboarding';
    });
  }

  function renderOnboarding() {
    const selected = new Set(state.preferences.selected || []);
    const primary = state.preferences.primary;
    document.getElementById('app').innerHTML = `
      <section class="onboarding-page">
        <div class="stepbar"><button class="icon-button" id="onboardingBack">←</button><span><i></i>Step 1 of 2 · Personalise your plan</span><a href="#/help" class="icon-button">?</a></div>
        <div class="onboarding-hero">
          <span class="eyebrow">YOUR PREPARATION, PERSONALISED</span>
          <h1>Which exams are you preparing for?</h1>
          <h2 lang="hi">आप किन परीक्षाओं की तैयारी कर रहे हैं?</h2>
          <p>Choose one or more exams. We will combine common subjects and recommend the most useful tests.</p>
        </div>
        <div class="exam-stack" id="examStack">
          ${state.exams.map(exam => examCard(exam, selected.has(exam.id), primary === exam.id)).join('')}
        </div>
        <article class="mentor-card">
          <div class="mentor-title"><span class="mentor-icon">✦</span><div><span class="eyebrow">SMART GUIDANCE</span><h3>Your syllabus overlap</h3></div></div>
          <div id="mentorAdvice">${mentorAdvice([...selected])}</div>
          <label>Primary exam focus <select id="primaryExam">${primaryOptions([...selected], primary)}</select></label>
        </article>
        <div class="student-promise">✓ Your choices can be changed later from your profile.</div>
        <div class="sticky-action">
          <span><strong id="selectedCount">${selected.size}</strong> exams selected</span>
          <span id="primaryLabel">${primary ? `Primary: ${examName(primary)}` : 'Choose a primary goal'}</span>
          <button class="primary-button" id="saveGoals">Build my dashboard →</button>
        </div>
      </section>`;

    document.querySelectorAll('[data-exam-select]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.examSelect;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      if (!selected.has(state.preferences.primary)) state.preferences.primary = selected.values().next().value || null;
      state.preferences.selected = [...selected];
      renderOnboarding();
    }));
    document.getElementById('primaryExam').addEventListener('change', event => {
      state.preferences.selected = [...selected];
      state.preferences.primary = event.target.value || null;
      renderOnboarding();
    });
    document.getElementById('saveGoals').addEventListener('click', () => {
      if (!selected.size) return toast('Select at least one exam.');
      const select = document.getElementById('primaryExam');
      state.preferences = { selected: [...selected], primary: select.value || [...selected][0] };
      write(KEYS.preferences, state.preferences);
      toast('Your preparation dashboard is ready.');
      location.hash = '#/home';
    });
    document.getElementById('onboardingBack').addEventListener('click', () => history.length > 1 ? history.back() : location.hash = '#/home');
  }

  function examCard(exam, selected, primary) {
    return `<button class="exam-select-card ${selected ? 'selected' : ''}" data-exam-select="${exam.id}" type="button">
      <span class="exam-icon">${icon(exam.icon)}</span>
      <span class="exam-card-copy"><strong>${exam.name}</strong><small>${exam.authority}</small><p>${exam.description}</p><span class="tag-row"><i>${exam.status}</i><i>${exam.negativeMarking ? `−${exam.negativeMarking} negative` : 'No negative marking'}</i></span></span>
      <span class="select-check">${selected ? '✓' : '+'}</span>
      ${primary ? '<b class="primary-badge">Primary</b>' : ''}
    </button>`;
  }

  function primaryOptions(ids, selected) {
    if (!ids.length) return '<option value="">Select exams first</option>';
    return ids.map(id => `<option value="${id}" ${selected === id ? 'selected' : ''}>${examName(id)}</option>`).join('');
  }
  function examName(id) { return state.exams.find(exam => exam.id === id)?.name || id; }
  function mentorAdvice(ids) {
    if (!ids.length) return '<p>Select examinations to see a preparation recommendation.</p>';
    if (ids.length === 1) return `<p>We will focus your dashboard on <strong>${examName(ids[0])}</strong> and recommend subject-wise practice tests.</p>`;
    return `<p><strong>Efficient combination:</strong> Your ${ids.length} selected examinations overlap in Hindi, general knowledge and reasoning. Practising common subjects first will reduce duplicated effort.</p>`;
  }

  function renderDashboard() {
    const primary = state.exams.find(exam => exam.id === state.preferences.primary);
    const relevantTests = state.tests.filter(test => test.examIds.includes(state.preferences.primary));
    const results = TestEngine.getResults();
    const active = TestEngine.activeAttempt();
    const attempts = results.length;
    const average = attempts ? Math.round(results.reduce((sum, result) => sum + result.percent, 0) / attempts) : 0;
    const completedIds = new Set(results.map(result => result.testId));
    const nextTest = relevantTests.find(test => !completedIds.has(test.id)) || relevantTests[0] || state.tests[0];
    document.getElementById('app').innerHTML = `
      <section class="page dashboard">
        <div class="welcome-row"><div><span class="eyebrow">YOUR PREPARATION HUB</span><h1>Good ${dayPart()}, ${escapeHtml(state.user.name.split(' ')[0])}</h1><p>One clear next step is better than ten unfinished plans.</p></div><a class="ghost-button" href="#/onboarding">Change goal</a></div>
        <article class="focus-card">
          <div class="focus-copy"><span class="live-pill">● PRIMARY GOAL</span><h2>${primary?.name || 'Choose an examination'}</h2><p>${primary?.description || ''}</p><div class="focus-meta"><span>Authority <b>${primary?.authority || '—'}</b></span><span>Status <b>${primary?.status || '—'}</b></span></div></div>
          <div class="progress-ring" style="--progress:${average}"><span><strong>${average}%</strong><small>average</small></span></div>
          <a class="primary-button" href="#/tests">Continue preparation →</a>
        </article>
        ${active ? `<article class="resume-banner"><div><span class="eyebrow">SAVED ATTEMPT</span><h3>${state.tests.find(test => test.id === active.testId)?.title || 'Your test'}</h3><p>Question ${active.current + 1} · Your answers are safely stored.</p></div><a class="primary-button" href="#/attempt/${active.testId}">Resume test</a></article>` : ''}
        <div class="metrics-grid">
          <article><span class="metric-icon blue">${icon('test')}</span><strong>${attempts}</strong><small>Tests attempted</small></article>
          <article><span class="metric-icon green">${icon('chart')}</span><strong>${average}%</strong><small>Average score</small></article>
          <article><span class="metric-icon amber">◎</span><strong>${results.filter(item => item.passed).length}</strong><small>Tests passed</small></article>
          <article><span class="metric-icon violet">↗</span><strong>${bestTopic(results)}</strong><small>Strongest topic</small></article>
        </div>
        <div class="section-heading"><div><span class="eyebrow">RECOMMENDED NEXT</span><h2>Keep your momentum</h2></div><a href="#/tests">View all tests →</a></div>
        ${nextTest ? testCard(nextTest, results) : '<div class="empty-state">No matching test is available yet.</div>'}
        <div class="section-heading"><div><span class="eyebrow">QUICK ACCESS</span><h2>Everything in one place</h2></div></div>
        <div class="quick-grid">
          <a href="#/tests"><span>${icon('test')}</span><strong>Start a test</strong><small>Browse available practice</small></a>
          <a href="#/results"><span>${icon('chart')}</span><strong>Performance</strong><small>Review recent attempts</small></a>
          <a href="#/onboarding"><span>${icon('land')}</span><strong>Exam goals</strong><small>Update your targets</small></a>
          <a href="#/help"><span>${icon('teacher')}</span><strong>Help centre</strong><small>Understand test modes</small></a>
        </div>
      </section>`;
  }

  function testCard(test, results = TestEngine.getResults()) {
    const previous = results.find(result => result.testId === test.id);
    return `<article class="test-card">
      <div class="test-card-icon">${icon(test.icon || 'test')}</div>
      <div class="test-card-copy"><span class="tag-row"><i>${test.difficulty}</i><i>${test.category}</i></span><h3>${test.title}</h3><p>${test.description}</p><div class="test-facts"><span><b>${test.questions.length}</b> questions</span><span><b>${Math.round(test.timing.totalSeconds / 60)}</b> minutes</span><span><b>${test.totalMarks}</b> marks</span><span><b>${test.negativeMarking || 0}</b> negative</span></div></div>
      <div class="test-card-action">${previous ? `<span class="previous-score">${previous.percent}%<small>Latest score</small></span>` : '<span class="new-label">Not attempted</span>'}<a class="primary-button" href="#/instructions/${test.id}">${previous ? 'Try again' : 'View test'} →</a></div>
    </article>`;
  }

  function renderTests() {
    document.getElementById('app').innerHTML = `
      <section class="page">
        <div class="page-hero compact"><span class="eyebrow">PRACTICE LIBRARY</span><h1>Choose your next test</h1><p>Use focused practice to find gaps before the real examination does.</p></div>
        <div class="filter-bar">
          <label class="search-box">⌕<input id="testSearch" placeholder="Search tests" value="${escapeHtml(state.filters.query)}"></label>
          <select id="examFilter"><option value="all">All examinations</option>${state.exams.map(exam => `<option value="${exam.id}" ${state.filters.exam === exam.id ? 'selected' : ''}>${exam.name}</option>`).join('')}</select>
          <select id="statusFilter"><option value="all">All attempts</option><option value="new" ${state.filters.status === 'new' ? 'selected' : ''}>Not attempted</option><option value="completed" ${state.filters.status === 'completed' ? 'selected' : ''}>Completed</option></select>
        </div>
        <div class="test-list" id="testList">${filteredTests().map(test => testCard(test)).join('') || '<div class="empty-state"><h3>No tests found</h3><p>Try changing the filters.</p></div>'}</div>
      </section>`;
    document.getElementById('testSearch').addEventListener('input', event => { state.filters.query = event.target.value; refreshTestList(); });
    document.getElementById('examFilter').addEventListener('change', event => { state.filters.exam = event.target.value; refreshTestList(); });
    document.getElementById('statusFilter').addEventListener('change', event => { state.filters.status = event.target.value; refreshTestList(); });
  }

  function filteredTests() {
    const completed = new Set(TestEngine.getResults().map(result => result.testId));
    const query = state.filters.query.toLowerCase();
    return state.tests.filter(test => {
      const matchesText = !query || `${test.title} ${test.description} ${test.category}`.toLowerCase().includes(query);
      const matchesExam = state.filters.exam === 'all' || test.examIds.includes(state.filters.exam);
      const matchesStatus = state.filters.status === 'all' || (state.filters.status === 'completed' ? completed.has(test.id) : !completed.has(test.id));
      return matchesText && matchesExam && matchesStatus;
    });
  }
  function refreshTestList() { document.getElementById('testList').innerHTML = filteredTests().map(test => testCard(test)).join('') || '<div class="empty-state"><h3>No tests found</h3><p>Try changing the filters.</p></div>'; }

  function renderInstructions(id) {
    const test = state.tests.find(item => item.id === id);
    if (!test) return notFound('Test not found');
    document.getElementById('app').innerHTML = `
      <section class="page narrow">
        <a class="back-link" href="#/tests">← Back to tests</a>
        <article class="instruction-card">
          <span class="eyebrow">BEFORE YOU BEGIN</span><h1>${test.title}</h1><p>${test.description}</p>
          <div class="instruction-stats"><div><strong>${test.questions.length}</strong><span>Questions</span></div><div><strong>${test.totalMarks}</strong><span>Marks</span></div><div><strong>${Math.round(test.timing.totalSeconds / 60)} min</strong><span>Default time</span></div><div><strong>${test.negativeMarking || 0}</strong><span>Negative mark</span></div></div>
          <div class="settings-section"><h2>Choose timing mode</h2><div class="choice-grid three">
            ${choice('timingMode', 'total-timed', 'Total-test timer', `${Math.round(test.timing.totalSeconds / 60)} minutes for the complete test`, true)}
            ${choice('timingMode', 'question-timed', 'Per-question timer', `${test.timing.questionSeconds} seconds for each question`)}
            ${choice('timingMode', 'untimed', 'Untimed practice', 'No countdown; elapsed time is recorded')}
          </div></div>
          <div class="settings-section"><h2>Answer checking</h2><div class="choice-grid">
            ${choice('feedbackMode', 'on-completion', 'After full submission', 'Results stay hidden during the test', true)}
            ${choice('feedbackMode', 'per-question', 'After every question', 'Immediate correctness and explanation')}
          </div></div>
          <div class="rules-box"><h3>Test rules</h3><ul><li>Your progress is saved automatically in this browser.</li><li>A total-timed test submits automatically when time ends.</li><li>Per-question mode moves ahead when each question timer ends.</li><li>You can mark questions for review before final submission.</li></ul></div>
          <label class="consent"><input type="checkbox" id="rulesAccepted"> I have read the instructions and am ready to begin.</label>
          <button class="primary-button full large" id="startTest" disabled>Start test →</button>
        </article>
      </section>`;
    const consent = document.getElementById('rulesAccepted');
    const start = document.getElementById('startTest');
    consent.addEventListener('change', () => { start.disabled = !consent.checked; });
    start.addEventListener('click', () => {
      sessionStorage.setItem('he_test_settings', JSON.stringify({
        mode: document.querySelector('input[name="timingMode"]:checked').value,
        feedbackMode: document.querySelector('input[name="feedbackMode"]:checked').value,
        sound: state.sound
      }));
      localStorage.removeItem(TestEngine.storageKey);
      location.hash = `#/attempt/${test.id}`;
    });
  }

  function choice(name, value, title, description, checked = false) {
    return `<label class="choice-card"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span><strong>${title}</strong><small>${description}</small></span><i>✓</i></label>`;
  }

  function beginAttempt(id) {
    const test = state.tests.find(item => item.id === id);
    if (!test) return notFound('Test not found');
    const saved = TestEngine.activeAttempt();
    const settings = readSession('he_test_settings') || {};
    TestEngine.start(test, { ...settings, sound: state.sound }, saved?.testId === id ? saved : null);
  }

  function renderResults() {
    const results = TestEngine.getResults();
    document.getElementById('app').innerHTML = `
      <section class="page">
        <div class="page-hero compact"><span class="eyebrow">PERFORMANCE HISTORY</span><h1>Your test results</h1><p>Use every result to decide what to practise next.</p></div>
        ${results.length ? `<div class="result-list">${results.map(result => `
          <a href="#/result/${result.id}" class="result-row"><span class="score-orb ${result.passed ? 'pass' : 'fail'}">${result.percent}%</span><span><strong>${result.title}</strong><small>${formatDate(result.date)} · ${result.correct} correct · ${TestEngine.formatTime(result.timeSeconds)}</small></span><b>${result.passed ? 'Passed' : 'Needs work'} →</b></a>`).join('')}</div>`
        : '<div class="empty-state"><div class="empty-icon">◎</div><h2>No results yet</h2><p>Complete your first practice test to see performance insights.</p><a class="primary-button" href="#/tests">Browse tests</a></div>'}
      </section>`;
  }

  function renderResult(id) {
    const result = TestEngine.getResults().find(item => item.id === id);
    const test = state.tests.find(item => item.id === result?.testId);
    if (!result || !test) return notFound('Result not found');
    const circumference = 339.3;
    document.getElementById('app').innerHTML = `
      <section class="page narrow">
        <article class="result-hero ${result.passed ? 'passed' : 'failed'}">
          <span class="eyebrow">${result.autoSubmitted ? 'TIME ENDED · AUTOMATICALLY SUBMITTED' : 'TEST COMPLETE'}</span>
          <h1>${result.passed ? 'Well done!' : 'Keep practising'}</h1><p>${test.title}</p>
          <div class="result-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle class="value" cx="60" cy="60" r="54" style="stroke-dashoffset:${circumference - (circumference * result.percent / 100)}"/></svg><span><strong>${result.percent}%</strong><small>${result.score}/${result.totalMarks}</small></span></div>
          <div class="result-status">${result.passed ? '✓ Passed' : 'Preparation needed'}</div>
        </article>
        <div class="result-metrics"><article><strong>${result.correct}</strong><span>Correct</span></article><article><strong>${result.incorrect}</strong><span>Incorrect</span></article><article><strong>${result.unanswered}</strong><span>Unanswered</span></article><article><strong>${TestEngine.formatTime(result.timeSeconds)}</strong><span>Time taken</span></article></div>
        <article class="analysis-card"><h2>Subject performance</h2>${Object.entries(result.topicScores).map(([topic, scores]) => {
          const percent = Math.round(scores.correct / scores.total * 100);
          return `<div class="topic-row"><span><strong>${topic}</strong><small>${scores.correct}/${scores.total} correct</small></span><div><i style="width:${percent}%"></i></div><b>${percent}%</b></div>`;
        }).join('')}</article>
        <div class="result-actions"><a class="ghost-button" href="#/tests">More tests</a><a class="primary-button" href="#/review/${result.id}">Review answers →</a></div>
      </section>`;
  }

  function renderReview(id) {
    const result = TestEngine.getResults().find(item => item.id === id);
    const test = state.tests.find(item => item.id === result?.testId);
    if (!result || !test) return notFound('Review not found');
    document.getElementById('app').innerHTML = `
      <section class="page narrow">
        <a class="back-link" href="#/result/${result.id}">← Back to result</a>
        <div class="page-hero compact"><span class="eyebrow">ANSWER REVIEW</span><h1>${test.title}</h1><p>Compare your choices with the correct answers and explanations.</p></div>
        <div class="review-list">${test.questions.map((question, index) => {
          const selected = result.answers[index];
          const correct = selected === question.correctOption;
          return `<article class="review-card ${correct ? 'correct' : 'incorrect'}"><div class="review-number">${index + 1}</div><div><span class="tag-row"><i>${question.topic}</i><i>${correct ? 'Correct' : selected === null ? 'Not answered' : 'Incorrect'}</i></span><h3>${question.question}</h3><p><b>Your answer:</b> ${selected === null ? 'Not answered' : question.options[selected]}</p><p class="correct-text"><b>Correct answer:</b> ${question.options[question.correctOption]}</p><div class="explanation"><strong>Explanation</strong><p>${question.explanation}</p></div></div></article>`;
        }).join('')}</div>
      </section>`;
  }

  function renderProfile() {
    document.getElementById('app').innerHTML = `
      <section class="page narrow">
        <div class="page-hero compact"><span class="eyebrow">YOUR ACCOUNT</span><h1>Profile and preferences</h1></div>
        <article class="profile-card">
          <span class="profile-avatar">${state.user.name.charAt(0)}</span><div><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(state.user.email)}</p><p>${escapeHtml(state.user.mobile)}</p></div>
        </article>
        <article class="settings-card"><h2>Preparation preferences</h2><p><b>Primary goal:</b> ${examName(state.preferences.primary)}</p><p><b>Selected exams:</b> ${state.preferences.selected.map(examName).join(', ')}</p><a class="primary-button" href="#/onboarding">Update exam goals</a></article>
        <article class="settings-card"><h2>Application settings</h2><label class="setting-toggle"><span><strong>Test sounds</strong><small>Timer warnings and answer feedback</small></span><input id="profileSound" type="checkbox" ${state.sound ? 'checked' : ''}></label></article>
        <button class="danger-button" id="logoutButton">Sign out</button>
      </section>`;
    document.getElementById('profileSound').addEventListener('change', event => {
      state.sound = event.target.checked; write(KEYS.sound, state.sound); updateSoundButton();
    });
    document.getElementById('logoutButton').addEventListener('click', () => {
      localStorage.removeItem(KEYS.user); state.user = null; updateUserShell(); renderLogin();
    });
  }

  function renderHelp() {
    document.getElementById('app').innerHTML = `
      <section class="page narrow">
        <div class="page-hero compact"><span class="eyebrow">HELP CENTRE</span><h1>How Himanshu Exams works</h1><p>Simple answers for a focused testing experience.</p></div>
        <div class="faq-list">
          <details open><summary>Are my answers saved?</summary><p>Yes. Active attempts are saved automatically in this browser and can be resumed from the dashboard.</p></details>
          <details><summary>What is a total-test timer?</summary><p>One countdown covers the entire test. The test submits automatically when it reaches zero.</p></details>
          <details><summary>What is a per-question timer?</summary><p>Every question receives its own countdown. When time ends, the test automatically moves to the next question.</p></details>
          <details><summary>When are answers checked?</summary><p>You may choose immediate checking after every question or keep answers hidden until final submission.</p></details>
          <details><summary>Is this login production-ready?</summary><p>No. The current JSON login is for demonstration. Production authentication must use a secure server.</p></details>
        </div>
      </section>`;
  }

  function bestTopic(results) {
    const totals = {};
    results.forEach(result => Object.entries(result.topicScores || {}).forEach(([topic, score]) => {
      totals[topic] ||= { correct: 0, total: 0 };
      totals[topic].correct += score.correct; totals[topic].total += score.total;
    }));
    const best = Object.entries(totals).sort((a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total)[0];
    return best ? best[0] : '—';
  }
  function dayPart() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'; }
  function formatDate(value) { return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
  function readSession(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return null; } }
  function notFound(title) { document.getElementById('app').innerHTML = `<section class="error-state"><div class="empty-icon">?</div><h1>${title}</h1><a class="primary-button" href="#/home">Return home</a></section>`; }
  function toast(message) {
    const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message;
    document.getElementById('toastRegion').append(toast); setTimeout(() => toast.remove(), 3200);
  }
  function modal(content) {
    closeModal();
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'appModal';
    overlay.innerHTML = `<div class="modal-card"><button class="modal-close" data-close-modal aria-label="Close">×</button>${content}</div>`;
    document.body.append(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-close-modal]')) closeModal(); });
  }
  function closeModal() { document.getElementById('appModal')?.remove(); }

  window.App = { toast, modal, closeModal, state };
  initialise();
}());
