const DATA_ROOT = 'https://raw.githubusercontent.com/Programmer-s-Picnic/examsdata/main';

async function fetchData(url, options = {}) {
  const { responseType = 'json', ...fetchOptions } = options;
  const response = await fetch(url, {
    cache: 'no-store',
    ...fetchOptions
  });

  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  }

  if (responseType === 'text') return response.text();
  if (responseType === 'response') return response;
  return response.json();
}

async function loadText(id, file) {
  document.getElementById(id).innerHTML = await fetchData(file, {
    responseType: 'text'
  });
}

function applySite(site) {
  document.title = `${site.name} | ${site.pageTitle || 'Primary Teacher Preparation'}`;
  document.getElementById('siteDescription').content = site.description;
  document.querySelectorAll('[data-site-name]').forEach((element) => {
    element.textContent = site.name;
  });
  document.querySelectorAll('[data-site-short]').forEach((element) => {
    element.textContent = site.shortName;
  });
  document.querySelectorAll('[data-site-tagline]').forEach((element) => {
    element.textContent = site.tagline;
  });
  document.querySelectorAll('[data-site-description]').forEach((element) => {
    element.textContent = site.description;
  });
  document.querySelectorAll('[data-site-year]').forEach((element) => {
    element.textContent = site.copyrightYear || new Date().getFullYear();
  });
}

function renderNavigation(navigation) {
  const nav = document.getElementById('mainNav');
  nav.innerHTML = navigation.map((item) => {
    if (item.children?.length) {
      const children = item.children.map((child) =>
        `<a href="${child.url}"><strong>${child.label}</strong>${child.description ? `<small>${child.description}</small>` : ''}</a>`
      ).join('');
      return `<div class="nav-dropdown"><a class="nav-parent" href="${item.url || '#'}">${item.label}<span class="caret">▾</span></a><div class="dropdown-menu">${children}</div></div>`;
    }
    return `<a class="${item.style === 'button' ? 'button small' : ''}" href="${item.url}">${item.label}</a>`;
  }).join('');

  document.querySelectorAll('.nav-parent').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (matchMedia('(max-width:820px)').matches) {
        event.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });
}

async function start() {
  try {
    const [config] = await Promise.all([
      fetchData(`${DATA_ROOT}/site-main.json`),
      loadText('site-header', 'header.html'),
      loadText('site-footer', 'footer.html')
    ]);
    applySite(config.site);
    renderNavigation(config.navigation || []);

    const button = document.getElementById('menuButton');
    const nav = document.getElementById('mainNav');
    if (button && nav) {
      button.addEventListener('click', () => nav.classList.toggle('open'));
    }
  } catch (error) {
    console.error('Site configuration could not be loaded', error);
  }
}

start();
