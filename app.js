/**
 * Vignan Digital — Deployed Projects Portal
 * App Logic: State, CRUD, Rendering, Admin, Search, File Upload
 */

'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'vignan_digital_projects_v2';
const STATIC_SEED_IDS = new Set(['proj-1', 'proj-2', 'proj-3', 'proj-4', 'proj-5', 'proj-6']);

let state = {
  projects: [],
  liveOnly: false,
  searchQuery: '',
  editingId: null
};

async function loadState() {
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      state.projects = data.projects || [];
      saveState();
      renderProjects();
      return;
    }
  } catch (err) {
    console.warn('API unavailable, falling back to local cache:', err);
  }

  // Fallback to local cache if server is offline
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state.projects = (saved.projects || []).filter(p => !STATIC_SEED_IDS.has(p.id));
    } else {
      state.projects = [];
    }
  } catch (e) {
    state.projects = [];
  }
  renderProjects();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: state.projects }));
  } catch (e) {
    console.error('Save failed:', e);
  }
}

// ─── RENDERING HELPERS ────────────────────────────────────────────────────────

function getBannerContent(project) {
  if (project.banner) {
    return `<img src="${project.banner}" alt="${escapeHtml(project.name)}" loading="lazy">`;
  }
  // Fallback: gradient with project name
  return `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1e1b4b,#4f46e5);display:flex;align-items:center;justify-content:center;padding:16px;">
    <div style="text-align:center;">
      <div style="font-size:18px;font-weight:900;color:#fff;letter-spacing:1px;">${escapeHtml(project.name)}</div>
    </div>
  </div>`;
}

function getStatusBadgeClass(status) {
  if (status === 'Live') return 'status-live';
  if (status === 'Coming Soon') return 'status-soon';
  return 'status-dev';
}

function getStatusPillClass(status) {
  if (status === 'Live') return 'live';
  if (status === 'Coming Soon') return 'soon';
  return 'dev';
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── RENDER PROJECTS ──────────────────────────────────────────────────────────
function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  const emptyState = document.getElementById('emptyState');
  const q = state.searchQuery.toLowerCase().trim();

  const filtered = state.projects.filter(p => {
    const matchLive = !state.liveOnly || p.status === 'Live';
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      (p.techStack || []).some(t => t.toLowerCase().includes(q));
    return matchLive && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    const h3 = emptyState.querySelector('h3');
    const p = emptyState.querySelector('p');
    const btn = emptyState.querySelector('button');
    if (state.projects.length === 0) {
      if (h3) h3.textContent = 'No Deployed Projects Yet';
      if (p) p.textContent = 'Platforms published from the admin hub will appear here.';
      if (btn) btn.style.display = 'none';
    } else {
      if (h3) h3.textContent = 'No projects found';
      if (p) p.textContent = 'Try a different search term or clear the filter.';
      if (btn) btn.style.display = 'inline-block';
    }
    return;
  }
  emptyState.style.display = 'none';

  grid.innerHTML = filtered.map(project => {
    return `
      <article class="project-card" data-id="${project.id}">
        <div class="card-banner">
          ${getBannerContent(project)}
          <span class="card-status-badge ${getStatusBadgeClass(project.status)}">${escapeHtml(project.status)}</span>
          <a href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer" class="card-ext-btn" title="Open ${escapeHtml(project.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
        <div class="card-body">
          <h2 class="card-name">${escapeHtml(project.name)}</h2>
          <p class="card-desc">${escapeHtml(project.desc)}</p>
          <a href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer" class="card-visit-btn">
            Visit Project <span class="arrow">→</span>
          </a>
        </div>
      </article>
    `;
  }).join('');
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    if (searchClearBtn) searchClearBtn.classList.toggle('visible', !!state.searchQuery);
    renderProjects();
  });
}

if (searchClearBtn) {
  searchClearBtn.addEventListener('click', () => {
    clearSearch();
  });
}

window.clearSearch = function() {
  if (searchInput) searchInput.value = '';
  state.searchQuery = '';
  if (searchClearBtn) searchClearBtn.classList.remove('visible');
  renderProjects();
};

// ─── LIVE FILTER ──────────────────────────────────────────────────────────────
const liveFilterCheck = document.getElementById('liveFilterCheck');
if (liveFilterCheck) {
  liveFilterCheck.addEventListener('change', (e) => {
    state.liveOnly = e.target.checked;
    renderProjects();
  });
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon"></span><span>${message}</span>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadState();
renderProjects();
