(function () {
  const REMOTE_ROOT = 'https://cserver.learnwithchampak.live/exams/json';
  const LEGACY_ROOT = 'https://raw.githubusercontent.com/Programmer-s-Picnic/examsdata/main';
  const LOCAL_ROOT = '../examsdata';

  async function request(path, options = {}) {
    const { responseType = 'json', retries = 1, direct = false, acceptErrors = false, ...fetchOptions } = options;
    const candidates = direct ? [path] : /^https?:\/\//.test(path)
      ? [path]
      : [`${REMOTE_ROOT}/${path.replace(/^\//, '')}`, `${LEGACY_ROOT}/${path.replace(/^\//, '')}`, `${LOCAL_ROOT}/${path.replace(/^\//, '')}`];
    for (const url of candidates) {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetch(url, { cache: 'no-store', ...fetchOptions });
          if (!response.ok && !acceptErrors) throw new Error(`HTTP ${response.status}`);
          if (responseType === 'text') return await response.text();
          if (responseType === 'response') return response;
          return await response.json();
        } catch (_) {
          // Try the next data source.
        }
      }
    }
    throw new Error('Content is temporarily unavailable. Please try again.');
  }
  const AUTH_ROOT = 'https://cserver.learnwithchampak.live/exams/api';
  async function auth(path, data, token) {
    const response = await request(`${AUTH_ROOT}/${path}.php`, {
      method: data === undefined ? 'GET' : 'POST', retries: 0, responseType: 'response', acceptErrors: true,
      headers: { 'Accept': 'application/json', ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const expected = [400, 401, 403, 409, 422].includes(response.status);
      throw new Error(expected && typeof result.error === 'string' ? result.error : 'The service is temporarily unavailable. Please try again.');
    }
    return result;
  }
  window.Api = { request, auth, root: REMOTE_ROOT };
}());
