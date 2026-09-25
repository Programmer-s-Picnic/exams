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
    syllabus: [],
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
      const [, , config, users, exams, tests, syllabus] = await Promise.all([
        loadFragment('site-header', 'header.html'),
        loadFragment('site-footer', 'footer.html'),
        Api.request('site-main.json'),
        Api.request('users-registered.json'),
        Api.request('exams.json'),
        Api.request('tests.json'),
        Api.request('exam-syllabus.json')
      ]);
      state.config = config;
      state.users = users.users || [];
      state.exams = exams.exams || [];
      state.tests = tests.tests || [];
      try {
        const retake = JSON.parse(sessionStorage.getItem('he_retake'));
        if (retake?.id && Array.isArray(retake.questions)) state.tests.push(retake);
      } catch (_) {}
      state.syllabus = syllabus.syllabi || [];
      const available = state.exams.find(exam => exam.available)?.id;
      state.preferences.selected = (state.preferences.selected || []).filter(id => state.exams.some(exam => exam.id === id && exam.available));
      if (!state.preferences.selected.includes(state.preferences.primary)) state.preferences.primary = available && state.preferences.selected.includes(available) ? available : null;
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
    document.querySelectorAll('[data-footer-note]').forEach(node => { node.textContent = site.footerNote; });
    document.getElementById('publicNav').innerHTML = state.config.navigation.public.map(item => `<a href="${item.route}">${item.label}</a>`).join('');
    document.getElementById('footerNav').innerHTML = state.config.navigation.footer.map(item => `<a href="${item.route}">${item.label}</a>`).join('');
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
    document.body.classList.toggle('logged-in', loggedIn);
    document.getElementById('headerStudent').textContent = state.user?.name?.split(' ')[0] || 'Student';
    document.getElementById('headerAvatar').textContent = state.user?.name?.charAt(0).toUpperCase() || 'S';
    document.getElementById('profileButton').hidden = !loggedIn;
    document.getElementById('soundButton').hidden = !loggedIn;
    document.getElementById('headerSignIn').hidden = loggedIn;
    document.getElementById('headerCta').hidden = loggedIn;
    document.getElementById('publicNav').hidden = loggedIn;
  }

  function currentRoute() {
    const parts = (location.hash.replace(/^#\//, '') || (state.user ? 'home' : 'landing')).split('/');
    return { name: parts[0], id: parts[1] };
  }

  function route() {
    TestEngine.stop();
    closeModal();
    const { name, id } = currentRoute();
    const publicRoutes = ['landing', 'landing-exams', 'landing-how', 'login', 'admin'];
    if (!state.user && !publicRoutes.includes(name)) {
      sessionStorage.setItem('he_after_login', location.hash || '#/home');
      location.hash = '#/login';
      return;
    }
    if (state.user && !state.preferences.primary && !['onboarding', 'profile', 'admin'].includes(name)) {
      location.hash = '#/onboarding';
      return;
    }
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === (name === 'result' ? 'results' : name)));
    document.body.classList.toggle('focus-mode', name === 'attempt');
    const routes = {
      landing: renderLanding,
      'landing-exams': () => renderLanding('landingExams'),
      'landing-how': () => renderLanding('landingHow'),
      login: renderLogin,
      home: renderDashboard,
      constable: renderConstable,
      admin: renderAdmin,
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
    (routes[name] || (state.user ? renderDashboard : renderLanding))();
    window.scrollTo(0, 0);
  }

  function renderLanding(scrollTarget = null) {
    document.body.classList.remove('auth-mode');
    const content = state.config.content.landing;
    const verification = state.config.content.verification;
    const questionCount = state.tests.reduce((total, test) => total + test.questions.length, 0);
    const capabilities = content.capabilities.map(item => {
      const value = item.valueFrom === 'questionCount' ? `${questionCount}${item.suffix || ''}` : item.value;
      return `<div><strong>${value}</strong><span>${item.label}</span></div>`;
    }).join('');
    const featuredTest = state.tests.find(test => test.available) || state.tests[0];
    document.getElementById('app').innerHTML = `
      <div class="public-landing">
        <section class="verification-strip"><span>${verification.label}</span><p>${verification.message}</p><time>Checked ${formatDate(verification.lastChecked)}</time></section>
        <section class="landing-hero">
          <div class="landing-glow one"></div><div class="landing-glow two"></div>
          <div class="landing-hero-inner">
            <span class="landing-badge">◆ ${content.badge}</span>
            <h1>${content.titleBefore}<br><em>${content.titleHighlight}</em></h1>
            <p>${content.description}</p>
            <div class="landing-actions"><a class="mint-button" href="${content.primaryAction.route}">▶ ${content.primaryAction.label}</a><a class="dark-button" href="${content.secondaryAction.route}">${content.secondaryAction.label} →</a></div>
            <div class="capability-grid">${capabilities}</div>
          </div>
        </section>
        <section class="landing-section" id="landingExams">
          <div class="landing-section-head"><div><span class="landing-eyebrow">${content.exams.eyebrow}</span><h2>${content.exams.title}</h2><p>${content.exams.description}</p></div></div>
          <div class="public-exam-grid">${state.exams.map(publicExamCard).join('')}</div>
        </section>
        <section class="landing-section diagnostic-section">
          <article class="diagnostic-panel">
            <div><span class="landing-eyebrow">${content.diagnostic.eyebrow}</span><h2>${content.diagnostic.title}</h2><p>${content.diagnostic.description}</p><div class="diagnostic-facts">${content.diagnostic.facts.map(fact => `<span>✓ ${fact}</span>`).join('')}</div></div>
            <div class="diagnostic-preview"><span class="preview-label">${featuredTest.category}</span><h3>${featuredTest.title}</h3><div><b>${featuredTest.questions.length}</b><small>Questions</small></div><div><b>${Math.round(featuredTest.timing.totalSeconds / 60)}</b><small>Minutes</small></div><a class="mint-button" href="#/login">${content.diagnostic.actionLabel} →</a></div>
          </article>
        </section>
        <section class="landing-section" id="landingHow">
          <div class="landing-section-head centered"><span class="landing-eyebrow">${content.how.eyebrow}</span><h2>${content.how.title}</h2></div>
          <div class="how-grid">${content.how.steps.map(step => `<article><span>${step.number}</span><h3>${step.title}</h3><p>${step.description}</p></article>`).join('')}</div>
        </section>
        <section class="landing-section"><article class="landing-final-cta"><div><h2>${content.finalCta.title}</h2><p>${content.finalCta.description}</p></div><a class="mint-button" href="${content.finalCta.route}">${content.finalCta.label} →</a></article></section>
      </div>`;
    document.querySelectorAll('[data-public-exam]').forEach(button => button.addEventListener('click', () => {
      if (state.user && state.preferences.selected.includes(button.dataset.publicExam)) {
        location.hash = '#/constable';
        return;
      }
      sessionStorage.setItem('he_preselected_exam', button.dataset.publicExam);
      sessionStorage.setItem('he_after_login', '#/onboarding');
      location.hash = '#/login';
    }));
    if (scrollTarget) setTimeout(() => document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth' }), 20);
  }

  function publicExamCard(exam) {
    return `<article class="public-exam-card"><div class="public-exam-top"><span class="exam-icon">${icon(exam.icon)}</span><i>${exam.available ? exam.status : 'Coming soon'}</i></div><h3>${exam.name}</h3><p>${exam.description}</p><dl><div><dt>Authority</dt><dd>${exam.authority}</dd></div><div><dt>Negative marking</dt><dd>${exam.negativeMarking || 'None'}</dd></div><div><dt>Subjects</dt><dd>${exam.subjects.length}</dd></div></dl>${exam.available ? `<button type="button" data-public-exam="${exam.id}">Select this exam →</button>` : '<span class="coming-soon-action">Coming soon</span>'}</article>`;
  }

  function renderLogin() {
    document.body.classList.add('logged-out', 'auth-mode');
    const copy = state.config.content.login;
    document.getElementById('app').innerHTML = `
      <section class="auth-page">
        <div class="auth-glow one"></div><div class="auth-glow two"></div>
        <article class="auth-card">
          <div class="auth-brand"><span class="brand-mark">HE</span><strong>Himanshu Exams</strong></div>
          <span class="eyebrow">${copy.eyebrow}</span>
          <h1>${copy.title}</h1>
          <p>${copy.description}</p>
          <form id="loginForm">
            <label>Mobile number or email<input id="loginId" autocomplete="username" required placeholder="student@example.com"></label>
            <label>Password<span class="password-wrap"><input id="loginPassword" type="password" autocomplete="current-password" required placeholder="Enter your password"><button type="button" id="showPassword" aria-label="Show password">Show</button></span></label>
            <div class="form-row"><label class="checkbox"><input type="checkbox" id="rememberLogin" checked> Remember this session</label><a href="#/help">Need help?</a></div>
            <p class="form-error" id="loginError" role="alert"></p>
            <button class="primary-button full" type="submit">Sign in securely →</button>
          </form>
          <div class="demo-login"><strong>Demo account</strong><span>${copy.demoEmail}</span><span>Password: ${copy.demoPassword}</span></div>
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
      document.body.classList.remove('auth-mode');
      const preselected = sessionStorage.getItem('he_preselected_exam');
      if (preselected && state.exams.some(exam => exam.id === preselected && exam.available)) {
        state.preferences = { selected: [preselected], primary: preselected };
        sessionStorage.removeItem('he_preselected_exam');
      }
      const requested = sessionStorage.getItem('he_after_login');
      sessionStorage.removeItem('he_after_login');
      location.hash = requested || (state.preferences.primary ? '#/home' : '#/onboarding');
    });
  }

  function renderOnboarding() {
    document.body.classList.remove('auth-mode');
    const copy = state.config.content.onboarding;
    const selected = new Set(state.preferences.selected || []);
    const primary = state.preferences.primary;
    document.getElementById('app').innerHTML = `
      <section class="onboarding-page">
        <div class="stepbar"><button class="icon-button" id="onboardingBack">←</button><span><i></i>Step 1 of 2 · Personalise your plan</span><a href="#/help" class="icon-button">?</a></div>
        <div class="onboarding-hero">
          <span class="eyebrow">${copy.eyebrow}</span>
          <h1>${copy.title}</h1>
          <h2 lang="hi">${copy.titleHindi}</h2>
          <p>${copy.description}</p>
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
      if (selected.has(id) && state.preferences.primary === id) { location.hash = '#/constable'; return; }
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
    if (!exam.available) return `<div class="exam-select-card coming-soon-card" aria-disabled="true"><span class="exam-icon">${icon(exam.icon)}</span><span class="exam-card-copy"><strong>${exam.name}</strong><small>${exam.authority}</small><p>${exam.description}</p><span class="tag-row"><i>Coming soon</i></span></span></div>`;
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
    document.body.classList.remove('auth-mode');
    const copy = state.config.content.dashboard;
    const primary = state.exams.find(exam => exam.id === state.preferences.primary);
    const relevantTests = state.tests.filter(test => test.available && test.examIds.includes(state.preferences.primary));
    const results = TestEngine.getResults();
    const active = TestEngine.activeAttempt();
    const attempts = results.length;
    const average = attempts ? Math.round(results.reduce((sum, result) => sum + result.percent, 0) / attempts) : 0;
    const completedIds = new Set(results.map(result => result.testId));
    const nextTest = relevantTests.find(test => !completedIds.has(test.id)) || relevantTests[0];
    document.getElementById('app').innerHTML = `
      <section class="page dashboard">
        <div class="welcome-row"><div><span class="eyebrow">${copy.eyebrow}</span><h1>Good ${dayPart()}, ${escapeHtml(state.user.name.split(' ')[0])}</h1><p>${copy.description}</p></div><a class="ghost-button" href="#/onboarding">Change goal</a></div>
        <article class="focus-card" id="primaryExamCard" role="link" tabindex="0" aria-label="Open UP Police Constable exam">
          <div class="focus-copy"><span class="live-pill">● PRIMARY GOAL</span><h2>${primary?.name || 'Choose an examination'}</h2><p>${primary?.description || ''}</p><div class="focus-meta"><span>Authority <b>${primary?.authority || '—'}</b></span><span>Status <b>${primary?.status || '—'}</b></span></div></div>
          <div class="progress-ring" style="--progress:${average}"><span><strong>${average}%</strong><small>average</small></span></div>
          <a class="primary-button" href="#/constable">Open Constable exam →</a>
        </article>
        ${active ? `<article class="resume-banner"><div><span class="eyebrow">SAVED ATTEMPT</span><h3>${state.tests.find(test => test.id === active.testId)?.title || 'Your test'}</h3><p>Question ${active.current + 1} · Your answers are safely stored.</p></div><a class="primary-button" href="#/attempt/${active.testId}">Resume test</a></article>` : ''}
        <div class="metrics-grid">
          <article><span class="metric-icon blue">${icon('test')}</span><strong>${attempts}</strong><small>Tests attempted</small></article>
          <article><span class="metric-icon green">${icon('chart')}</span><strong>${average}%</strong><small>Average score</small></article>
          <article><span class="metric-icon amber">◎</span><strong>${results.filter(item => item.passed).length}</strong><small>Tests passed</small></article>
          <article><span class="metric-icon violet">↗</span><strong>${bestTopic(results)}</strong><small>Strongest topic</small></article>
        </div>
        <div class="section-heading"><div><span class="eyebrow">RECOMMENDED NEXT</span><h2>${copy.recommendedTitle}</h2></div><a href="#/tests">View all tests →</a></div>
        ${nextTest ? testCard(nextTest, results) : '<div class="empty-state">No matching test is available yet.</div>'}
        <div class="section-heading"><div><span class="eyebrow">QUICK ACCESS</span><h2>${copy.quickTitle}</h2></div></div>
        <div class="quick-grid">
          <a href="#/tests"><span>${icon('test')}</span><strong>Start a test</strong><small>Browse available practice</small></a>
          <a href="#/results"><span>${icon('chart')}</span><strong>Performance</strong><small>Review recent attempts</small></a>
          <a href="#/onboarding"><span>${icon('land')}</span><strong>Exam goals</strong><small>Update your targets</small></a>
          <a href="#/help"><span>${icon('teacher')}</span><strong>Help centre</strong><small>Understand test modes</small></a>
        </div>
      </section>`;
    const focusCard = document.getElementById('primaryExamCard');
    focusCard.addEventListener('click', event => { if (!event.target.closest('a, button')) location.hash = '#/constable'; });
    focusCard.addEventListener('keydown', event => { if (event.target === focusCard && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); location.hash = '#/constable'; } });
  }

  function jsonTree(value, key = null, depth = 0) {
    const label = key === null ? '' : `<span class="json-key">${escapeHtml(key)}</span><span class="json-punctuation">: </span>`;
    if (value === null) return `<div class="json-leaf">${label}<span class="json-null">null</span></div>`;
    if (typeof value === 'string') return `<div class="json-leaf">${label}<span class="json-string">${escapeHtml(JSON.stringify(value))}</span></div>`;
    if (typeof value !== 'object') return `<div class="json-leaf">${label}<span class="json-number">${escapeHtml(String(value))}</span></div>`;
    const pairs = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
    const kind = Array.isArray(value) ? 'Array' : 'Object';
    return `<details class="json-node" ${depth < 2 ? 'open' : ''}><summary>${label}<span class="json-type">${kind} · ${pairs.length} ${pairs.length === 1 ? 'item' : 'items'}</span></summary><div class="json-children">${pairs.map(([childKey, item]) => jsonTree(item, childKey, depth + 1)).join('')}</div></details>`;
  }

  function adminInfoIcon(name) {
    const paths = {
      file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
      purpose: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
      data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      format: '<path d="m9 5-5 7 5 7M15 5l5 7-5 7M13 3l-2 18"/>',
      keys: '<circle cx="8" cy="9" r="4"/><path d="m11 12 8 8m-3-3 2-2m-5-1 2-2"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>'
    };
    return `<svg class="admin-info-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
  }

  function adminFileInfo(file, manifest) {
    const detail = manifest.fileDetails?.[file.path] || {};
    const usedAt = detail.usedAt || [];
    const keyGroups = Object.entries(detail.keys || {});
    const relationships = (manifest.relationships || []).filter(item => item.from === file.path || item.to === file.path);
    const relationshipSvg = '<svg class="detail-relation-arrow" viewBox="0 0 140 28" preserveAspectRatio="none" aria-hidden="true"><path d="M3 14h124"/><path d="m118 6 11 8-11 8"/><circle cx="4" cy="14" r="3"/></svg>';
    return `<section class="admin-file-info">
      <div><span>${adminInfoIcon('purpose')}Purpose</span><p>${escapeHtml(detail.purpose || 'Supporting project file.')}</p></div>
      <div><span>${adminInfoIcon('data')}Stored data</span><p>${escapeHtml(detail.storedData || 'Not applicable or not documented yet.')}</p></div>
      <div><span>${adminInfoIcon('format')}Format</span><p><code>${escapeHtml(detail.format || file.category)}</code></p></div>
      ${keyGroups.length ? `<div class="admin-key-info"><span>${adminInfoIcon('keys')}Keys and integrity</span>${keyGroups.map(([type, keys]) => `<section><b>${escapeHtml(type)}</b><ul>${keys.map(key => `<li><code>${escapeHtml(key)}</code></li>`).join('')}</ul></section>`).join('')}</div>` : ''}
      ${relationships.length ? `<div class="admin-detail-relations"><span>${adminInfoIcon('link')}Relationships involving this file</span><div class="detail-relation-list">${relationships.map(relation => `<article class="detail-relation ${relation.from === file.path && relation.to === file.path ? 'self' : relation.from === file.path ? 'outgoing' : 'incoming'}"><div><small>${relation.from === file.path ? 'THIS FILE' : 'RELATED FILE'}</small><strong>${escapeHtml(relation.from)}</strong><code>${escapeHtml(relation.fromField)}</code></div><section><b>${escapeHtml(relation.cardinality)}</b>${relationshipSvg}<small>${escapeHtml(relation.label)}</small></section><div><small>${relation.to === file.path ? 'THIS FILE' : 'RELATED FILE'}</small><strong>${escapeHtml(relation.to)}</strong><code>${escapeHtml(relation.toField)}</code></div></article>`).join('')}</div></div>` : ''}
      <div class="admin-used-at"><span>${adminInfoIcon('link')}Used at</span>${usedAt.length ? `<ul>${usedAt.map(place => `<li><a href="${escapeHtml(place.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(place.label)}</a>${place.note ? `<small>${escapeHtml(place.note)}</small>` : ''}</li>`).join('')}</ul>` : '<p>Not currently connected to a public page; retained for future content.</p>'}</div>
    </section>`;
  }

  function adminDataMap(manifest) {
    const databaseSvg = '<svg class="data-node-icon" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>';
    const arrowSvg = '<svg class="relation-arrow" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true"><path d="M2 12h108"/><path d="m102 5 10 7-10 7"/></svg>';
    const jsonFiles = manifest.files.filter(file => file.category === 'JSON');
    const nodes = jsonFiles.map(file => {
      const detail = manifest.fileDetails?.[file.path] || {};
      const primary = detail.keys?.primary?.[0] || detail.keys?.configuration?.[0] || 'No relational key';
      const foreignCount = detail.keys?.foreign?.length || 0;
      return `<button type="button" class="data-node" data-model-file="${manifest.files.indexOf(file)}"><i>${databaseSvg}</i><strong>${escapeHtml(file.path)}</strong><span><b>PK</b> ${escapeHtml(primary)}</span><small>${foreignCount} foreign key${foreignCount === 1 ? '' : 's'} · ${(detail.usedAt || []).length} usage link${(detail.usedAt || []).length === 1 ? '' : 's'}</small></button>`;
    }).join('');
    const relations = (manifest.relationships || []).map(relation => `<article class="relationship-edge"><div><strong>${escapeHtml(relation.from)}</strong><code>${escapeHtml(relation.fromField)}</code></div><span><b>${escapeHtml(relation.cardinality)}</b>${arrowSvg}<small>${escapeHtml(relation.label)}</small></span><div><strong>${escapeHtml(relation.to)}</strong><code>${escapeHtml(relation.toField)}</code></div></article>`).join('');
    return `<section class="data-model"><div class="section-heading"><div><span class="eyebrow">JSON DATA MODEL</span><h2><svg class="heading-data-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m9 11 6-4M9 13l6 4"/></svg>Files, keys and relationships</h2><p>Click a file to inspect its schema, stored data and consumer pages.</p></div></div><div class="data-node-grid">${nodes}</div><details class="relationship-list" open><summary>Relationship graph · ${(manifest.relationships || []).length} links</summary>${relations}</details><div class="data-legend"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14a5 5 0 1 1 4-8l8 8-3 3-2-2-2 2-2-2-3 3-2-2 3-3"/></svg><b>PK</b> Primary key</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 8h7m0 8h7"/></svg><b>FK</b> Foreign key</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h16m-6-6 6 6-6 6"/></svg><b>1→N</b> One-to-many</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4"/></svg><b>N↔N</b> Many-to-many</span></div></section>`;
  }

  async function renderAdmin() {
    const mount = document.getElementById('app');
    mount.innerHTML = '<section class="page"><div class="loading-screen"><span class="loader"></span><p>Loading content inventory…</p></div></section>';
    try {
      const manifest = await Api.request('content-manifest.json');
      if (location.hash !== '#/admin') return;
      const groups = ['JSON', 'CSS', 'JavaScript', 'Images', 'HTML'];
      mount.innerHTML = `<section class="page admin-page"><div class="page-hero"><span class="eyebrow">READ-ONLY CONTENT BROWSER</span><h1>Site admin · content inventory</h1><p>Browse published files, understand what they store, and see exactly where they are used. These files are public; this page does not provide secure admin access or editing.</p></div>${adminDataMap(manifest)}<div class="admin-layout"><aside class="admin-sidebar"><label class="admin-search">Find a file<input id="adminSearch" type="search" placeholder="Name, data, purpose or page"></label><div id="adminFileList">${groups.map(group => `<section class="admin-file-group"><h2>${group} <small>${manifest.files.filter(file => file.category === group).length}</small></h2>${manifest.files.filter(file => file.category === group).map(file => { const detail = manifest.fileDetails?.[file.path] || {}; return `<button type="button" data-admin-file="${manifest.files.indexOf(file)}" title="${escapeHtml(file.repository + '/' + file.path)}"><strong>${escapeHtml(file.path)}</strong>${detail.storedData ? `<small>${escapeHtml(detail.storedData)}</small>` : ''}</button>`; }).join('')}</section>`).join('')}</div></aside><article class="admin-preview"><div id="adminViewer"><h2>Select a file</h2><p>${manifest.notes.map(escapeHtml).join(' ')}</p></div></article></div></section>`;
      document.querySelector('.data-model')?.insertAdjacentHTML('beforebegin', window.AdminDiagrams?.render() || '');
      const fileList = document.getElementById('adminFileList');
      document.getElementById('adminSearch').addEventListener('input', event => {
        const query = event.target.value.trim().toLowerCase();
        fileList.querySelectorAll('[data-admin-file]').forEach(button => { const file = manifest.files[Number(button.dataset.adminFile)]; const detail = manifest.fileDetails?.[file.path] || {}; button.hidden = !`${file.repository} ${file.path} ${detail.purpose || ''} ${detail.storedData || ''} ${(detail.usedAt || []).map(item => item.label).join(' ')}`.toLowerCase().includes(query); });
      });
      fileList.addEventListener('click', async event => {
        const button = event.target.closest('[data-admin-file]');
        if (!button) return;
        fileList.querySelectorAll('[data-admin-file]').forEach(item => item.classList.toggle('active', item === button));
        const file = manifest.files[Number(button.dataset.adminFile)];
        const viewer = document.getElementById('adminViewer');
        viewer.innerHTML = '<div class="loading-screen"><span class="loader"></span><p>Loading file…</p></div>';
        try {
          const source = file.repository === 'examsdata' ? file.path : file.url;
          const isJson = file.category === 'JSON';
          const content = file.category === 'Images' ? null : await Api.request(source, isJson ? {} : { responseType: 'text' });
          viewer.innerHTML = `<div class="admin-viewer-head"><div><span class="eyebrow">${escapeHtml(file.category)} · ${escapeHtml(file.repository)}</span><h2>${adminInfoIcon('file')}${escapeHtml(file.path)}</h2></div><a class="ghost-button" href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer">Open file ↗</a></div>${adminFileInfo(file, manifest)}${isJson ? `<div class="admin-toolbar"><button type="button" id="adminTree" class="active">Tree view</button><button type="button" id="adminRaw">Formatted JSON</button><button type="button" id="adminCopy">Copy JSON</button></div><div id="adminJsonTree" class="json-viewer">${jsonTree(content)}</div><pre id="adminJsonRaw" class="admin-code" hidden><code>${escapeHtml(JSON.stringify(content, null, 2))}</code></pre>` : file.category === 'Images' ? `<div class="admin-image"><img src="${escapeHtml(file.url)}" alt="${escapeHtml(file.path)}" loading="lazy"></div>` : `<pre class="admin-code"><code>${escapeHtml(content)}</code></pre>`}`;
          if (isJson) {
            document.getElementById('adminTree').onclick = () => { document.getElementById('adminJsonTree').hidden = false; document.getElementById('adminJsonRaw').hidden = true; };
            document.getElementById('adminRaw').onclick = () => { document.getElementById('adminJsonTree').hidden = true; document.getElementById('adminJsonRaw').hidden = false; };
            document.getElementById('adminCopy').onclick = async () => { await navigator.clipboard.writeText(JSON.stringify(content, null, 2)); toast('JSON copied.'); };
          }
        } catch (error) { viewer.innerHTML = `<div class="error-state"><h2>File could not be loaded</h2><p>${escapeHtml(error.message)}</p><a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer">Open original file ↗</a></div>`; }
      });
      mount.querySelectorAll('[data-model-file]').forEach(node => node.addEventListener('click', () => {
        const button = fileList.querySelector(`[data-admin-file="${node.dataset.modelFile}"]`);
        if (button) { button.hidden = false; button.click(); document.querySelector('.admin-layout').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }));
    } catch (error) { mount.innerHTML = `<section class="page"><div class="error-state"><h1>Content inventory unavailable</h1><p>${escapeHtml(error.message)}</p></div></section>`; }
  }

  function renderConstable() {
    const exam = state.exams.find(item => item.id === 'up-police');
    const syllabus = state.syllabus.find(item => item.examId === exam?.id);
    if (!exam || !syllabus) return notFound('Constable information is unavailable');
    const tests = state.tests.filter(test => test.id.startsWith('up-police-constable-') && !test.baseTestId);
    const results = TestEngine.getResults().filter(result => tests.some(test => test.id === (result.baseTestId || result.testId)));
    const latest = results[0];
    const weak = latest && Object.entries(latest.topicScores || {}).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0]?.[0];
    document.getElementById('app').innerHTML = `
      <section class="page constable-hub">
        <a class="back-link" href="#/home">← Dashboard</a>
        <div class="page-hero"><span class="eyebrow">YOUR EXAM</span><h1>${escapeHtml(exam.name)}</h1><p>${escapeHtml(exam.description)}</p><small>Sources checked ${escapeHtml(exam.verifiedAt)} · Preparation content is independent of the recruitment board.</small></div>
        <nav class="hub-nav" aria-label="Constable sections">${[['overview','Overview'],['syllabus','Syllabus'],['practice','Practice'],['settings','Test modes'],['results','Results'],['stages','Stages']].map(([id,label]) => `<button type="button" data-hub-section="constable-${id}">${label}</button>`).join('')}</nav>
        <section class="hub-section" id="constable-overview"><h2>Exam overview and official documents</h2><p>Read the notification and corrigendum together before relying on recruitment dates, eligibility or scoring rules. Select a document to view it below.</p><div class="hub-grid">${exam.sources.map((source, index) => `<div class="hub-tile"><strong>${escapeHtml(source.label)}</strong><div class="document-actions"><button class="ghost-button" type="button" data-document="${index}">View here</button><a class="ghost-button" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Open original ↗</a></div></div>`).join('')}</div><div id="officialDocument" class="document-frame" hidden><div class="document-heading"><strong id="documentTitle"></strong><a id="documentOriginal" href="#" target="_blank" rel="noopener noreferrer">Open original ↗</a></div><iframe id="documentIframe" title="Official Constable document" loading="lazy" referrerpolicy="no-referrer"></iframe><p>Preview unavailable? Use “Open original” above. Official websites can prevent embedding.</p></div></section>
        <section class="hub-section" id="constable-syllabus"><h2>Subject and topic outline</h2><p>${escapeHtml(syllabus.note)}</p><div class="hub-grid">${syllabus.sections.map(section => `<article class="hub-tile"><h3>${escapeHtml(section.name)}</h3><ul>${section.topics.map(topic => `<li>${escapeHtml(topic)}</li>`).join('')}</ul></article>`).join('')}</div></section>
        <section class="hub-section" id="constable-practice"><h2>Subject practice and sample mock</h2><p>Try short subject exercises or a mixed sample. A full official-pattern mock will appear after its questions and rules have been reviewed.</p><div class="test-list">${tests.map(test => testCard(test, results)).join('') || '<p>No practice tests are available yet.</p>'}</div></section>
        <section class="hub-section" id="constable-settings"><h2>Choose your test mode</h2><p>Each test lets you choose a whole-test timer, a per-question timer or untimed practice. Check answers after each question or only after submission.</p><a class="primary-button" href="#/tests">Browse test settings →</a></section>
        <section class="hub-section" id="constable-results"><h2>Results and retakes</h2><p>${latest ? `${results.length} attempt${results.length === 1 ? '' : 's'} · latest score ${latest.percent}%. ${weak ? `Suggested next focus: ${escapeHtml(weak)}.` : ''}` : 'Complete a practice test to see your score, explanations and topic analysis.'}</p>${latest ? `<a class="primary-button" href="#/result/${latest.id}">Review latest result →</a>` : '<a class="primary-button" href="#/tests">Start practising →</a>'}<p>On the result page, retake unanswered, unanswered and wrong, wrong only, or all questions with fresh shuffles.</p></section>
        <section class="hub-section" id="constable-stages"><h2>Recruitment stages</h2><div class="hub-grid">${exam.stages.map((stage, index) => `<article class="hub-tile"><small>STAGE ${index + 1}</small><h3>${escapeHtml(stage.name)}</h3><p>${escapeHtml(stage.description)}</p></article>`).join('')}</div><p>For current criteria and schedules, use the official links above.</p></section>
      </section>`;
    document.querySelectorAll('[data-hub-section]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.hubSection)?.scrollIntoView({ behavior: 'smooth' })));
    document.querySelectorAll('[data-document]').forEach(button => button.addEventListener('click', () => {
      const source = exam.sources[Number(button.dataset.document)];
      if (!source || !/^https:\/\/uppbpb\.gov\.in\//.test(source.url)) return;
      document.getElementById('documentTitle').textContent = source.label;
      document.getElementById('documentOriginal').href = source.url;
      document.getElementById('documentIframe').src = source.url;
      document.getElementById('officialDocument').hidden = false;
      document.getElementById('officialDocument').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function testCard(test, results = TestEngine.getResults()) {
    const previous = results.find(result => result.testId === test.id);
    return `<article class="test-card">
      <div class="test-card-icon">${icon(test.icon || 'test')}</div>
      <div class="test-card-copy"><span class="tag-row"><i>${test.difficulty}</i><i>${test.category}</i></span><h3>${test.title}</h3><p>${test.description}</p><div class="test-facts"><span><b>${test.questions.length}</b> questions</span><span><b>${Math.round(test.timing.totalSeconds / 60)}</b> minutes</span><span><b>${test.totalMarks}</b> marks</span><span><b>${test.negativeMarking || 0}</b> negative</span></div></div>
      <div class="test-card-action">${test.available ? `${previous ? `<span class="previous-score">${previous.percent}%<small>Latest score</small></span>` : '<span class="new-label">Not attempted</span>'}<a class="primary-button" href="#/instructions/${test.id}">${previous ? 'Try again' : 'View test'} →</a>` : '<span class="coming-soon-action">Coming soon</span>'}</div>
    </article>`;
  }

  function renderTests() {
    document.getElementById('app').innerHTML = `
      <section class="page">
        <div class="page-hero compact"><span class="eyebrow">PRACTICE LIBRARY</span><h1>Choose your next test</h1><p>Use focused practice to find gaps before the real examination does.</p></div>
        <div class="filter-bar">
          <label class="search-box">⌕<input id="testSearch" placeholder="Search tests" value="${escapeHtml(state.filters.query)}"></label>
          <select id="examFilter"><option value="all">All examinations</option>${state.exams.filter(exam => exam.available).map(exam => `<option value="${exam.id}" ${state.filters.exam === exam.id ? 'selected' : ''}>${exam.name}</option>`).join('')}</select>
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
    if (!test || !test.available) return notFound('This test is coming soon');
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
    if (!test || !test.available) return notFound('This test is coming soon');
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
    const test = state.tests.find(item => item.id === result?.testId) || state.tests.find(item => item.id === result?.baseTestId);
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
        <section class="analysis-card"><h2>Retake questions</h2><p>Questions and options are reshuffled for each retake.</p><div class="result-actions retake-actions">${[['unanswered','Unanswered only'],['review','Unanswered + wrong'],['wrong','Wrong only'],['all','All questions']].map(([mode,label]) => `<button class="ghost-button" data-retake="${mode}" ${mode !== 'all' && !retakeQuestions(test, result, mode).length ? 'disabled' : ''}>${label} (${retakeQuestions(test, result, mode).length})</button>`).join('')}</div></section>
      </section>`;
    document.querySelectorAll('[data-retake]').forEach(button => button.addEventListener('click', () => startRetake(test, result, button.dataset.retake)));
  }

  function retakeQuestions(test, result, mode) {
    const questions = result.questions || test.questions;
    return questions.filter((question, index) => {
      const answer = result.answers[index];
      return mode === 'all' || (mode === 'unanswered' && answer === null) || (mode === 'wrong' && answer !== null && answer !== question.correctOption) || (mode === 'review' && answer !== question.correctOption);
    });
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startRetake(test, result, mode) {
    const selected = retakeQuestions(test, result, mode);
    if (!selected.length) return;
    const questions = shuffle(selected.map(question => {
      const options = shuffle(question.options.map((option, index) => ({ option, index })));
      return { ...question, options: options.map(item => item.option), correctOption: options.findIndex(item => item.index === question.correctOption) };
    }));
    const baseTestId = result.baseTestId || test.id;
    const original = state.tests.find(item => item.id === baseTestId) || test;
    const retake = { ...test, id: `${baseTestId}~${Date.now()}`, baseTestId, title: `${original.title} — retake`, questions, totalMarks: questions.reduce((sum, question) => sum + Number(question.marks || 1), 0), timing: { ...test.timing, totalSeconds: Math.max(60, Math.round(original.timing.totalSeconds * questions.length / original.questions.length)) } };
    state.tests.push(retake);
    sessionStorage.setItem('he_retake', JSON.stringify(retake));
    location.hash = `#/instructions/${retake.id}`;
  }

  function renderReview(id) {
    const result = TestEngine.getResults().find(item => item.id === id);
    const test = state.tests.find(item => item.id === result?.testId) || state.tests.find(item => item.id === result?.baseTestId);
    if (!result || !test) return notFound('Review not found');
    document.getElementById('app').innerHTML = `
      <section class="page narrow">
        <a class="back-link" href="#/result/${result.id}">← Back to result</a>
        <div class="page-hero compact"><span class="eyebrow">ANSWER REVIEW</span><h1>${test.title}</h1><p>Compare your choices with the correct answers and explanations.</p></div>
        <div class="review-list">${(result.questions || test.questions).map((question, index) => {
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
