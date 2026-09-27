(function () {
  const REMOTE_ROOT = 'https://cserver.learnwithchampak.live/exams/json';
  const LEGACY_ROOT = 'https://raw.githubusercontent.com/Programmer-s-Picnic/examsdata/main';
  const LOCAL_ROOT = '../examsdata';

  async function request(path, options = {}) {
    const { responseType = 'json', retries = 1, ...fetchOptions } = options;
    const candidates = /^https?:\/\//.test(path)
      ? [path]
      : [`${REMOTE_ROOT}/${path.replace(/^\//, '')}`, `${LEGACY_ROOT}/${path.replace(/^\//, '')}`, `${LOCAL_ROOT}/${path.replace(/^\//, '')}`];
    let lastError;
    for (const url of candidates) {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetch(url, { cache: 'no-store', ...fetchOptions });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (responseType === 'text') return await response.text();
          if (responseType === 'response') return response;
          return await response.json();
        } catch (error) {
          lastError = new Error(`Could not load ${url}: ${error.message}`);
        }
      }
    }
    throw lastError;
  }
  const AUTH_ROOT = 'https://cserver.learnwithchampak.live/exams/api';
  async function auth(path, data, token) {
    const response = await fetch(`${AUTH_ROOT}/${path}.php`, {
      method: data === undefined ? 'GET' : 'POST', retries: 0,
      headers: { 'Accept': 'application/json', ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Server error (${response.status})`);
    return result;
  }
  window.Api = { request, auth, root: REMOTE_ROOT };
}());
