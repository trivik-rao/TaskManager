'use strict';

// ── Firebase refs ─────────────────────────────────────────────────────────────
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
let myTasks = [];
let publicTasks = [];
let activeTab = 'my-tasks';
let unsubMyTasks = null;
let unsubPublicFeed = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const signInBtn      = document.getElementById('sign-in-btn');
const signOutBtn     = document.getElementById('sign-out-btn');
const userInfo       = document.getElementById('user-info');
const userPhoto      = document.getElementById('user-photo');
const userNameEl     = document.getElementById('user-name');
const addTaskBtn     = document.getElementById('add-task-btn');
const fabBtn         = document.getElementById('fab-btn');
const tabs           = document.querySelectorAll('.tab');
const myTasksPanel   = document.getElementById('my-tasks-panel');
const publicPanel    = document.getElementById('public-feed-panel');
const taskList       = document.getElementById('task-list');
const emptyState     = document.getElementById('empty-state');
const authPrompt     = document.getElementById('auth-prompt');
const feedList       = document.getElementById('feed-list');
const feedEmpty      = document.getElementById('feed-empty');
const modalOverlay   = document.getElementById('modal-overlay');
const modalTitle     = document.getElementById('modal-title');
const taskForm       = document.getElementById('task-form');
const taskIdInput    = document.getElementById('task-id');
const titleInput     = document.getElementById('task-title');
const descInput      = document.getElementById('task-description');
const dueDateInput   = document.getElementById('task-due-date');
const visInputs      = document.querySelectorAll('input[name="visibility"]');
const cancelBtn      = document.getElementById('cancel-btn');
const titleError     = document.getElementById('title-error');
const detailOverlay  = document.getElementById('detail-overlay');
const detailContent  = document.getElementById('detail-content');
const detailClose    = document.getElementById('detail-close');
const toastEl        = document.getElementById('toast');

// ── Auth ──────────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  currentUser = user;
  updateAuthUI();
  if (user) {
    subscribeMyTasks();
  } else {
    if (unsubMyTasks) { unsubMyTasks(); unsubMyTasks = null; }
    myTasks = [];
    if (activeTab === 'my-tasks') renderMyTasks();
  }
});

function updateAuthUI() {
  const signedIn = !!currentUser;
  signInBtn.classList.toggle('hidden', signedIn);
  userInfo.classList.toggle('hidden', !signedIn);
  addTaskBtn.classList.toggle('hidden', !signedIn);
  fabBtn.classList.toggle('hidden', !signedIn);
  if (signedIn) {
    userPhoto.src = currentUser.photoURL || '';
    userNameEl.textContent = currentUser.displayName || currentUser.email;
  }
}

function signIn() {
  auth.signInWithPopup(googleProvider).catch(err => showToast('Sign-in failed: ' + err.message));
}

function doSignOut() {
  if (confirm('Sign out?')) auth.signOut();
}

// ── Firestore subscriptions ───────────────────────────────────────────────────
function subscribeMyTasks() {
  if (unsubMyTasks) unsubMyTasks();
  unsubMyTasks = db.collection('tasks')
    .where('uid', '==', currentUser.uid)
    .onSnapshot(snap => {
      myTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      myTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (activeTab === 'my-tasks') renderMyTasks();
    }, err => console.error('myTasks:', err));
}

function subscribePublicFeed() {
  if (unsubPublicFeed) return;
  unsubPublicFeed = db.collection('tasks')
    .where('visibility', '==', 'public')
    .onSnapshot(snap => {
      publicTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publicTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (activeTab === 'public-feed') renderPublicFeed();
    }, err => console.error('publicFeed:', err));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function genToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dueBadge(task) {
  if (task.completed) return { label: 'Done', cls: 'badge-done' };
  if (!task.dueDate) return null;
  const today = todayISO();
  if (task.dueDate < today)  return { label: 'Overdue',   cls: 'badge-overdue' };
  if (task.dueDate === today) return { label: 'Due Today', cls: 'badge-today' };
  return { label: 'Upcoming', cls: 'badge-upcoming' };
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHTML(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getVisibility() {
  return [...visInputs].find(r => r.checked)?.value || 'private';
}

function setVisibility(val) {
  visInputs.forEach(r => { r.checked = r.value === val; });
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2500);
}

function shareURL(token) {
  return `${location.origin}${location.pathname}?share=${token}`;
}

function copyShareLink(token) {
  navigator.clipboard.writeText(shareURL(token))
    .then(() => showToast('Link copied to clipboard!'))
    .catch(() => showToast('Could not copy link'));
}

// ── Render — My Tasks ─────────────────────────────────────────────────────────
function renderMyTasks() {
  taskList.innerHTML = '';

  if (!currentUser) {
    authPrompt.classList.remove('hidden');
    emptyState.classList.add('hidden');
    return;
  }
  authPrompt.classList.add('hidden');
  emptyState.classList.toggle('hidden', myTasks.length > 0);

  myTasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'task-card' + (task.completed ? ' completed' : '');

    const badge = dueBadge(task);
    const badgeHTML = badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : '';
    const dueDateHTML = task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : '';
    const visBadge = task.visibility === 'public'
      ? '<span class="badge badge-public">Public</span>'
      : '<span class="badge badge-private">Private</span>';
    const shareBtn = task.visibility === 'public'
      ? `<button class="btn btn-share share-btn" title="Copy share link">&#128279; Share</button>`
      : '';

    card.innerHTML = `
      <div class="task-card-top">
        <input type="checkbox" class="task-checkbox" aria-label="Mark complete" ${task.completed ? 'checked' : ''} />
        <span class="task-title">${escapeHTML(task.title)}</span>
      </div>
      ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
      <div class="task-meta">
        ${dueDateHTML}
        ${badgeHTML}
        ${visBadge}
      </div>
      <div class="task-actions">
        <button class="btn btn-edit edit-btn">Edit</button>
        ${shareBtn}
        <button class="btn btn-danger delete-btn">Delete</button>
      </div>
    `;

    card.querySelector('.task-checkbox').addEventListener('change', () => toggleComplete(task.id, task.completed));
    card.querySelector('.edit-btn').addEventListener('click', () => openModal(task));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
    if (task.visibility === 'public') {
      card.querySelector('.share-btn').addEventListener('click', () => copyShareLink(task.shareToken));
    }

    taskList.appendChild(card);
  });
}

// ── Render — Public Feed ──────────────────────────────────────────────────────
function renderPublicFeed() {
  feedList.innerHTML = '';
  feedEmpty.classList.toggle('hidden', publicTasks.length > 0);

  publicTasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'task-card feed-card';

    const badge = dueBadge(task);
    const badgeHTML = badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : '';
    const isOwner = currentUser && currentUser.uid === task.uid;
    const avatarHTML = task.ownerPhoto
      ? `<img src="${escapeHTML(task.ownerPhoto)}" class="owner-avatar" alt="" />`
      : `<div class="owner-avatar owner-avatar-fallback">${escapeHTML((task.ownerName || '?')[0])}</div>`;

    card.innerHTML = `
      <div class="task-owner">
        ${avatarHTML}
        <span class="owner-name">${escapeHTML(task.ownerName || 'Anonymous')}</span>
        ${isOwner ? '<span class="badge badge-yours">You</span>' : ''}
      </div>
      <div class="task-card-top" style="margin-top:0.5rem">
        <span class="task-title">${escapeHTML(task.title)}</span>
      </div>
      ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
      <div class="task-meta">
        ${task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : ''}
        ${badgeHTML}
      </div>
      <div class="task-actions">
        <button class="btn btn-share share-btn">&#128279; Share</button>
      </div>
    `;

    card.querySelector('.share-btn').addEventListener('click', () => copyShareLink(task.shareToken));
    feedList.appendChild(card);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
    t.setAttribute('aria-selected', t.dataset.tab === tab);
  });
  myTasksPanel.classList.toggle('hidden', tab !== 'my-tasks');
  publicPanel.classList.toggle('hidden', tab !== 'public-feed');

  if (tab === 'public-feed') {
    subscribePublicFeed();
    renderPublicFeed();
  } else {
    renderMyTasks();
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(task) {
  if (!currentUser) { signIn(); return; }
  taskIdInput.value = task?.id || '';
  titleInput.value = task?.title || '';
  descInput.value = task?.description || '';
  dueDateInput.value = task?.dueDate || '';
  setVisibility(task?.visibility || 'private');
  modalTitle.textContent = task ? 'Edit Task' : 'Add Task';
  titleInput.classList.remove('invalid');
  titleError.classList.add('hidden');
  modalOverlay.classList.remove('hidden');
  titleInput.focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  taskForm.reset();
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.classList.add('invalid');
    titleError.classList.remove('hidden');
    titleInput.focus();
    return;
  }

  const id = taskIdInput.value;
  const visibility = getVisibility();

  const data = {
    uid: currentUser.uid,
    ownerName: currentUser.displayName || '',
    ownerPhoto: currentUser.photoURL || '',
    title,
    description: descInput.value.trim(),
    dueDate: dueDateInput.value,
    visibility,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (id) {
      await db.collection('tasks').doc(id).update(data);
    } else {
      data.completed = false;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.shareToken = genToken();
      await db.collection('tasks').add(data);
    }
    closeModal();
  } catch (err) {
    showToast('Error saving task: ' + err.message);
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await db.collection('tasks').doc(id).delete();
  } catch (err) {
    showToast('Error deleting task: ' + err.message);
  }
}

async function toggleComplete(id, current) {
  try {
    await db.collection('tasks').doc(id).update({ completed: !current });
  } catch (err) {
    console.error(err);
  }
}

// ── Shared task view (via ?share= URL param) ──────────────────────────────────
async function loadSharedTask(token) {
  try {
    const snap = await db.collection('tasks').where('shareToken', '==', token).limit(1).get();
    if (snap.empty) {
      detailContent.innerHTML = '<p style="color:var(--text-muted)">Task not found.</p>';
    } else {
      const task = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (task.visibility !== 'public') {
        detailContent.innerHTML = '<p style="color:var(--text-muted)">This task is private.</p>';
      } else {
        const badge = dueBadge(task);
        const badgeHTML = badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : '';
        const avatarHTML = task.ownerPhoto
          ? `<img src="${escapeHTML(task.ownerPhoto)}" class="owner-avatar" alt="" />`
          : `<div class="owner-avatar owner-avatar-fallback">${escapeHTML((task.ownerName || '?')[0])}</div>`;
        detailContent.innerHTML = `
          <div class="task-owner" style="margin-bottom:0.8rem">
            ${avatarHTML}
            <span class="owner-name">${escapeHTML(task.ownerName || 'Anonymous')}</span>
          </div>
          <h3 style="font-size:1.1rem;margin-bottom:0.4rem">${escapeHTML(task.title)}</h3>
          ${task.description ? `<p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:0.6rem;line-height:1.5">${escapeHTML(task.description)}</p>` : ''}
          <div class="task-meta">
            ${task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : ''}
            ${badgeHTML}
          </div>
        `;
      }
    }
  } catch (err) {
    detailContent.innerHTML = '<p style="color:var(--text-muted)">Unable to load task.</p>';
  }
  detailOverlay.classList.remove('hidden');
}

// ── Event listeners ───────────────────────────────────────────────────────────
signInBtn.addEventListener('click', signIn);
signOutBtn.addEventListener('click', doSignOut);
addTaskBtn.addEventListener('click', () => openModal(null));
fabBtn.addEventListener('click', () => openModal(null));
cancelBtn.addEventListener('click', closeModal);
taskForm.addEventListener('submit', handleFormSubmit);
detailClose.addEventListener('click', () => detailOverlay.classList.add('hidden'));

tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) detailOverlay.classList.add('hidden'); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    detailOverlay.classList.add('hidden');
  }
});

titleInput.addEventListener('input', () => {
  if (titleInput.value.trim()) {
    titleInput.classList.remove('invalid');
    titleError.classList.add('hidden');
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
// Check for shared task in URL
const sharedToken = new URLSearchParams(location.search).get('share');
if (sharedToken) {
  const unsub = auth.onAuthStateChanged(() => {
    unsub();
    loadSharedTask(sharedToken);
  });
}

// Start listening to public feed immediately (works without login)
subscribePublicFeed();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
