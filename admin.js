/**
 * CSE Department Admin Portal Logic
 * Route: /csedeptnewadd
 * Connected to Express & MongoDB Backend
 */

'use strict';

const STORAGE_KEY = 'vignan_digital_projects_v2';
const AUTH_KEY = 'cse_dept_admin_auth';
const PWD_STORAGE_KEY = 'cse_admin_password';
const DEFAULT_PASSWORDS = ['csedept@2026', 'csedept2026', 'vignan@cse2026'];

// ─── AUTHENTICATION ───────────────────────────────────────────────────────────
function isAuthorized() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

async function verifyPasscodeWithServer(input) {
  try {
    const res = await fetch('/cse-api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: input })
    });
    if (res.ok) {
      const data = await res.json();
      return data.success;
    }
  } catch (err) {
    console.warn('Auth server error, checking local:', err);
  }
  // Fallback to local keys
  const customPwd = localStorage.getItem(PWD_STORAGE_KEY);
  if (customPwd) {
    return input === customPwd || DEFAULT_PASSWORDS.includes(input);
  }
  return DEFAULT_PASSWORDS.includes(input);
}

function unlockDashboard() {
  document.getElementById('lockScreen').style.display = 'none';
  document.getElementById('dashWrapper').style.display = 'flex';
  loadProjects();
}

function lockDashboard() {
  sessionStorage.removeItem(AUTH_KEY);
  document.getElementById('dashWrapper').style.display = 'none';
  document.getElementById('lockScreen').style.display = 'flex';
  document.getElementById('passcodeInput').value = '';
  document.getElementById('lockAlert').style.display = 'none';
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let adminProjects = [];
let editingProjectId = null;
let currentBannerBase64 = '';
let selectedImageFile = null;

async function loadProjects() {
  try {
    const res = await fetch('/cse-api/projects');
    if (res.ok) {
      const data = await res.json();
      adminProjects = data.projects || [];
      renderAdminTable();
      updateStats();
      saveProjectsLocally();
      return;
    }
  } catch (err) {
    console.warn('Cannot fetch from API, loading local cache:', err);
  }

  // Fallback to local cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const staticIds = new Set(['proj-1', 'proj-2', 'proj-3', 'proj-4', 'proj-5', 'proj-6']);
      adminProjects = (data.projects || []).filter(p => !staticIds.has(p.id));
    } else {
      adminProjects = [];
    }
  } catch (e) {
    adminProjects = [];
  }
  renderAdminTable();
  updateStats();
}

function saveProjectsLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: adminProjects }));
  } catch (e) {
    console.warn('Local cache save error:', e);
  }
}

function updateStats() {
  const total = adminProjects.length;
  const live = adminProjects.filter(p => p.status === 'Live').length;
  const others = total - live;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statLive').textContent = live;
  document.getElementById('statOthers').textContent = others;
  document.getElementById('tabCount').textContent = total;
}

// ─── RENDERING ADMIN TABLE ───────────────────────────────────────────────────
function renderAdminTable(searchQuery = '') {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  const q = searchQuery.toLowerCase().trim();
  const list = adminProjects.filter(p => {
    if (!q) return true;
    return (p.name || '').toLowerCase().includes(q) ||
           (p.desc || '').toLowerCase().includes(q) ||
           (p.techStack || []).some(t => t.toLowerCase().includes(q));
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:48px 20px; color:var(--text-muted);">
          <div style="font-size:32px; margin-bottom:8px;">🔍</div>
          <div style="font-weight:700; font-size:15px; margin-bottom:4px;">No projects found</div>
          <p style="font-size:13px;">${adminProjects.length === 0 ? 'No projects registered in MongoDB yet. Click "Add Project" to deploy one!' : 'Try a different search query.'}</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const thumbHtml = p.banner
      ? `<img src="${p.banner}" class="table-thumb" alt="${escapeHtml(p.name)}">`
      : `<div class="table-thumb" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#5b54e7,#8b5cf6);color:#fff;">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
         </div>`;

    let statusCls = 'dev';
    if (p.status === 'Live') statusCls = 'live';
    else if (p.status === 'Coming Soon') statusCls = 'soon';

    const techPills = (p.techStack || [])
      .map(t => `<span class="tech-pill">${escapeHtml(t)}</span>`)
      .join('');

    return `
      <tr>
        <td>
          <div class="project-cell">
            ${thumbHtml}
            <div class="project-details">
              <span class="p-name">${escapeHtml(p.name)}</span>
              <span class="p-desc">${escapeHtml(p.desc || '')}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="status-badge ${statusCls}">
            <span>${p.status === 'Live' ? '●' : '○'}</span>
            ${escapeHtml(p.status)}
          </span>
        </td>
        <td>
          <div class="tech-pills">${techPills || '<span style="color:var(--text-light);font-size:12px;">—</span>'}</div>
        </td>
        <td>
          <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="link-out">
            Visit ↗
          </a>
        </td>
        <td>
          <div class="action-btns">
            <button class="action-btn" onclick="startEditProject('${p.id}')" title="Edit Project">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn delete" onclick="deleteProject('${p.id}')" title="Delete Project">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
  if (tabId === 'list') {
    renderAdminTable();
  }
}

// ─── BANNER UPLOAD ────────────────────────────────────────────────────────────
function setupUploadHandlers() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('bannerFileInput');
  const btnSelect = document.getElementById('btnSelectBanner');
  const previewWrap = document.getElementById('previewWrap');
  const previewImg = document.getElementById('bannerPreviewImg');
  const btnChange = document.getElementById('btnChangeImg');
  const btnRemove = document.getElementById('btnRemoveImg');

  btnSelect.addEventListener('click', () => fileInput.click());
  btnChange.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('click', (e) => {
    if (e.target !== btnSelect) fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
    e.target.value = '';
  });

  btnRemove.addEventListener('click', () => {
    clearBannerPreview();
  });
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (PNG, JPG, WEBP).', 'error');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('Image size exceeds 10MB limit.', 'error');
    return;
  }

  selectedImageFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    setBannerPreview(e.target.result);
  };
  reader.onerror = () => {
    showToast('Error reading image file.', 'error');
  };
  reader.readAsDataURL(file);
}

function setBannerPreview(dataUrl) {
  currentBannerBase64 = dataUrl;
  document.getElementById('bannerPreviewImg').src = dataUrl;
  document.getElementById('uploadDropzone').style.display = 'none';
  document.getElementById('previewWrap').style.display = 'block';
}

function clearBannerPreview() {
  selectedImageFile = null;
  currentBannerBase64 = '';
  document.getElementById('bannerPreviewImg').src = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('uploadDropzone').style.display = 'block';
}

function setSubmitButtonState(loading, isEdit) {
  const submitBtn = document.getElementById('btnSubmitProject');
  if (!submitBtn) return;
  if (loading) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      <span id="submitBtnText">Saving...</span>
    `;
  } else {
    submitBtn.disabled = false;
    const label = isEdit ? 'Update Project' : 'Deploy Project';
    submitBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span id="submitBtnText">${label}</span>
    `;
  }
}

// ─── FORM HANDLING ────────────────────────────────────────────────────────────
function resetProjectForm() {
  const form = document.getElementById('projectForm');
  if (form) form.reset();
  editingProjectId = null;
  selectedImageFile = null;
  const formTitle = document.getElementById('formTitle');
  if (formTitle) formTitle.textContent = 'Add New Department Project';
  const formDesc = document.getElementById('formDesc');
  if (formDesc) formDesc.textContent = 'Fill in the information below and upload a banner image for the hub.';
  setSubmitButtonState(false, false);
  clearBannerPreview();
}

window.startEditProject = function(id) {
  const p = adminProjects.find(x => x.id === id);
  if (!p) return;

  editingProjectId = id;
  selectedImageFile = null;
  document.getElementById('pTitle').value = p.name || '';
  document.getElementById('pStatus').value = p.status || 'Live';
  document.getElementById('pDesc').value = p.desc || '';
  document.getElementById('pUrl').value = p.url || '';
  document.getElementById('pTech').value = (p.techStack || []).join(', ');

  const formTitle = document.getElementById('formTitle');
  if (formTitle) formTitle.textContent = `Edit Project: ${p.name}`;
  const formDesc = document.getElementById('formDesc');
  if (formDesc) formDesc.textContent = 'Modify project details and save changes.';
  setSubmitButtonState(false, true);

  if (p.banner) {
    setBannerPreview(p.banner);
  } else {
    clearBannerPreview();
  }

  switchTab('form');
};

window.deleteProject = async function(id) {
  const p = adminProjects.find(x => x.id === id);
  const name = p ? p.name : 'this project';
  if (!confirm(`Are you sure you want to delete "${name}" from the digital hub?`)) return;

  try {
    const res = await fetch(`/cse-api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      adminProjects = adminProjects.filter(x => x.id !== id);
      renderAdminTable();
      updateStats();
      saveProjectsLocally();
      showToast(`"${name}" removed successfully.`);
      return;
    }
  } catch (err) {
    console.error('Delete API error:', err);
  }

  // Local fallback
  adminProjects = adminProjects.filter(x => x.id !== id);
  renderAdminTable();
  updateStats();
  saveProjectsLocally();
  showToast(`"${name}" removed.`);
};

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span><span>${message}</span>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ─── INITIALIZATION & LISTENERS ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check auth state
  if (isAuthorized()) {
    unlockDashboard();
  } else {
    document.getElementById('lockScreen').style.display = 'flex';
    document.getElementById('dashWrapper').style.display = 'none';
  }

  // Passcode toggle visibility
  const eyeBtn = document.getElementById('eyeToggleBtn');
  const passInput = document.getElementById('passcodeInput');
  if (eyeBtn && passInput) {
    eyeBtn.addEventListener('click', () => {
      const isPassword = passInput.type === 'password';
      passInput.type = isPassword ? 'text' : 'password';
      eyeBtn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  }

  // Passcode form submit
  document.getElementById('passcodeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = passInput.value.trim();
    const alertBox = document.getElementById('lockAlert');
    const submitBtn = document.getElementById('btnUnlock');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    const isValid = await verifyPasscodeWithServer(val);
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Unlock Admin Dashboard`;

    if (isValid) {
      alertBox.style.display = 'none';
      sessionStorage.setItem(AUTH_KEY, 'true');
      unlockDashboard();
      showToast('Admin access granted! Welcome back.');
    } else {
      alertBox.textContent = 'Incorrect passcode. Please check your credentials.';
      alertBox.style.display = 'block';
      alertBox.classList.remove('shake');
      void alertBox.offsetWidth; // trigger reflow
      alertBox.classList.add('shake');
      passInput.focus();
    }
  });

  // Logout button
  document.getElementById('btnLogout').addEventListener('click', () => {
    lockDashboard();
    showToast('Logged out of admin session.');
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId === 'form' && !editingProjectId) {
        resetProjectForm();
      }
      switchTab(tabId);
    });
  });

  // Search input in admin table
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderAdminTable(e.target.value);
    });
  }

  // Setup image upload
  setupUploadHandlers();

  // Cancel Form
  document.getElementById('btnCancelProject').addEventListener('click', () => {
    resetProjectForm();
    switchTab('list');
  });

  // Project Form Submit (Create or Update with Multer)
  document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('pTitle').value.trim();
    const status = document.getElementById('pStatus').value;
    const desc = document.getElementById('pDesc').value.trim();
    const url = document.getElementById('pUrl').value.trim();
    const techRaw = document.getElementById('pTech').value.trim();
    const submitBtn = document.getElementById('btnSubmitProject');

    if (!name || !desc || !url) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    const techStack = techRaw ? techRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    setSubmitButtonState(true, !!editingProjectId);

    // Prepare FormData
    const formData = new FormData();
    formData.append('name', name);
    formData.append('status', status);
    formData.append('desc', desc);
    formData.append('url', url);
    formData.append('techStack', JSON.stringify(techStack));

    if (selectedImageFile) {
      formData.append('bannerImage', selectedImageFile);
    } else if (currentBannerBase64) {
      formData.append('banner', currentBannerBase64);
    }

    try {
      let endpoint = '/cse-api/projects';
      let method = 'POST';

      if (editingProjectId) {
        endpoint = `/cse-api/projects/${editingProjectId}`;
        method = 'PUT';
      }

      const res = await fetch(endpoint, {
        method,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Project "${name}" saved!`);
        await loadProjects();
        resetProjectForm();
        switchTab('list');
        return;
      } else {
        let errMsg = 'Error saving project';
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch (_) {
          errMsg = `Server returned HTTP ${res.status}`;
        }
        showToast(errMsg, 'error');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('Error saving project.', 'error');
    } finally {
      setSubmitButtonState(false, !!editingProjectId);
    }
  });

  // Change Password Modal
  const pwdModal = document.getElementById('pwdModal');
  document.getElementById('btnOpenPwdModal').addEventListener('click', () => {
    pwdModal.classList.add('open');
    document.getElementById('newPwdInput').value = '';
    document.getElementById('newPwdInput').focus();
  });

  document.getElementById('btnClosePwdModal').addEventListener('click', () => {
    pwdModal.classList.remove('open');
  });

  document.getElementById('pwdChangeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPwd = document.getElementById('newPwdInput').value.trim();
    if (newPwd.length < 4) {
      showToast('Passcode must be at least 4 characters.', 'error');
      return;
    }

    try {
      const res = await fetch('/cse-api/auth/change-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPasscode: newPwd })
      });
      if (res.ok) {
        localStorage.setItem(PWD_STORAGE_KEY, newPwd);
        pwdModal.classList.remove('open');
        showToast('Admin passcode updated in MongoDB!');
        return;
      }
    } catch (err) {
      console.error('Error updating passcode:', err);
    }

    localStorage.setItem(PWD_STORAGE_KEY, newPwd);
    pwdModal.classList.remove('open');
    showToast('Admin passcode saved!');
  });
});
