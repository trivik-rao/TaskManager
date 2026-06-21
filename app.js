'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const LANE_COLORS = ['#4f46e5','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316','#14b8a6','#64748b'];
const UNCAT_ID   = '__uncat__';
const PREFS_KEY  = 'tm-prefs';

const ACCENT_COLORS = [
  { color:'#1c69d4', hover:'#1558b0', name:'BMW Blue' },
  { color:'#4f46e5', hover:'#4338ca', name:'Indigo'   },
  { color:'#2563eb', hover:'#1d4ed8', name:'Blue'     },
  { color:'#059669', hover:'#047857', name:'Emerald'  },
  { color:'#7c3aed', hover:'#6d28d9', name:'Purple'   },
  { color:'#e11d48', hover:'#be123c', name:'Rose'     },
  { color:'#ea580c', hover:'#c2410c', name:'Orange'   },
  { color:'#0891b2', hover:'#0e7490', name:'Cyan'     },
];

const BG_OPTIONS = [
  { id:'default', label:'Default', light:'#f4f6f9', dark:'#0f172a' },
  { id:'white',   label:'White',   light:'#ffffff',  dark:'#111827' },
  { id:'warm',    label:'Warm',    light:'#fdf8f0',  dark:'#1c1917' },
  { id:'cool',    label:'Cool',    light:'#eff6ff',  dark:'#0c1445' },
  { id:'mint',    label:'Mint',    light:'#f0fdf4',  dark:'#052e16' },
  { id:'rose',    label:'Rose',    light:'#fff1f2',  dark:'#1c0812' },
];

// ── Firebase ──────────────────────────────────────────────────────────────────
const auth = firebase.auth();
const db   = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser   = null;
let isAdmin       = false;
let myTasks       = [];
let assignedTasks = [];
let allTasks      = [];
let publicTasks   = [];
let categories    = [];
let allUsers      = [];
let activeTab     = 'my-tasks';
let activeView    = 'board';
let selectedColor = LANE_COLORS[0];
let unsubMyTasks  = null;
let unsubAssigned = null;
let unsubAllTasks = null;
let unsubCats     = null;
let unsubFeed     = null;
let unsubUsers    = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const signInBtn      = document.getElementById('sign-in-btn');
const signOutBtn     = document.getElementById('sign-out-btn');
const userInfo       = document.getElementById('user-info');
const userPhoto      = document.getElementById('user-photo');
const userNameEl     = document.getElementById('user-name');
const adminBadge     = document.getElementById('admin-badge');
const welcomeScreen  = document.getElementById('welcome-screen');
const welcomeSignIn  = document.getElementById('welcome-sign-in');
const addTaskBtn     = document.getElementById('add-task-btn');
const fabBtn         = document.getElementById('fab-btn');
const tabs           = document.querySelectorAll('.tab');
const myTasksPanel   = document.getElementById('my-tasks-panel');
const publicPanel    = document.getElementById('public-feed-panel');
const viewSwitcher   = document.getElementById('view-switcher');
const board          = document.getElementById('board');
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
const categorySelect = document.getElementById('task-category');
const assigneeSelect = document.getElementById('task-assignee');
const visInputs      = document.querySelectorAll('input[name="visibility"]');
const cancelBtn      = document.getElementById('cancel-btn');
const titleError     = document.getElementById('title-error');
const catModalOv     = document.getElementById('cat-modal-overlay');
const catForm        = document.getElementById('cat-form');
const catNameInput   = document.getElementById('cat-name');
const catCancelBtn   = document.getElementById('cat-cancel-btn');
const colorPickerEl  = document.getElementById('color-picker');
const settingsBtn    = document.getElementById('settings-btn');
const settingsOv     = document.getElementById('settings-overlay');
const settingsClose  = document.getElementById('settings-close');
const settingsDone   = document.getElementById('settings-done');
const accentPickerEl = document.getElementById('accent-picker');
const bgPickerEl     = document.getElementById('bg-picker');
const detailOverlay  = document.getElementById('detail-overlay');
const detailContent  = document.getElementById('detail-content');
const detailClose    = document.getElementById('detail-close');
const toastEl        = document.getElementById('toast');

// ── Theme ─────────────────────────────────────────────────────────────────────
const mql = window.matchMedia('(prefers-color-scheme: dark)');

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
function savePrefs(updates) {
  const p = { ...loadPrefs(), ...updates };
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  return p;
}

function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'system' && mql.matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  applyBg(loadPrefs().bg || 'default', isDark);
}

function applyAccent(color) {
  const a = ACCENT_COLORS.find(x => x.color === color) || ACCENT_COLORS[0];
  document.documentElement.style.setProperty('--primary', a.color);
  document.documentElement.style.setProperty('--primary-hover', a.hover);
  document.documentElement.style.setProperty('--primary-rgb', hexToRgb(a.color));
  document.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('selected', s.dataset.color === a.color));
}

function applyBg(bgId, isDark) {
  if (isDark === undefined) isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = BG_OPTIONS.find(b => b.id === bgId) || BG_OPTIONS[0];
  document.documentElement.style.setProperty('--page-bg', isDark ? bg.dark : bg.light);
  document.querySelectorAll('.bg-tile').forEach(t => t.classList.toggle('selected', t.dataset.bg === bgId));
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function initTheme() {
  const p = loadPrefs();
  applyTheme(p.theme || 'system');
  applyAccent(p.accent || '#1c69d4');
  applyBg(p.bg || 'default');
}

mql.addEventListener('change', () => {
  const p = loadPrefs();
  if (!p.theme || p.theme === 'system') applyTheme('system');
});

// ── Settings UI ───────────────────────────────────────────────────────────────
function openSettings() {
  const p = loadPrefs();
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === (p.theme || 'system')));
  accentPickerEl.innerHTML = '';
  ACCENT_COLORS.forEach(a => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'accent-swatch' + (a.color === (p.accent || '#4f46e5') ? ' selected' : '');
    sw.dataset.color = a.color;
    sw.style.background = a.color;
    sw.title = a.name;
    sw.addEventListener('click', () => { savePrefs({ accent: a.color }); applyAccent(a.color); });
    accentPickerEl.appendChild(sw);
  });
  bgPickerEl.innerHTML = '';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  BG_OPTIONS.forEach(bg => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'bg-tile' + (bg.id === (p.bg || 'default') ? ' selected' : '');
    tile.dataset.bg = bg.id;
    tile.style.background = isDark ? bg.dark : bg.light;
    tile.title = bg.label;
    tile.innerHTML = `<span>${bg.label}</span>`;
    tile.addEventListener('click', () => { savePrefs({ bg: bg.id }); applyBg(bg.id); });
    bgPickerEl.appendChild(tile);
  });
  settingsOv.classList.remove('hidden');
}

function closeSettings() { settingsOv.classList.add('hidden'); }

// ── Auth ──────────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    // Save/update user profile so others can see them in assign-to dropdown
    db.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      photo: user.photoURL || '',
    }, { merge: true }).catch(() => {});

    // Check admin status
    try {
      const adminDoc = await db.collection('admins').doc(user.uid).get();
      isAdmin = adminDoc.exists;
    } catch { isAdmin = false; }

    updateAuthUI();
    subscribeMyTasks();
    subscribeAssigned();
    subscribeCats();
    subscribeUsers();
    if (isAdmin) subscribeAllTasks();
  } else {
    isAdmin = false;
    [unsubMyTasks, unsubAssigned, unsubAllTasks, unsubCats, unsubUsers].forEach(u => u && u());
    unsubMyTasks = unsubAssigned = unsubAllTasks = unsubCats = unsubUsers = null;
    myTasks = []; assignedTasks = []; allTasks = []; categories = []; allUsers = [];
    updateAuthUI();
    if (activeTab === 'my-tasks') refreshMyTasks();
  }
});

function updateAuthUI() {
  const on = !!currentUser;
  welcomeScreen.classList.toggle('hidden', on);
  signInBtn.classList.toggle('hidden', on);
  userInfo.classList.toggle('hidden', !on);
  addTaskBtn.classList.toggle('hidden', !on);
  fabBtn.classList.toggle('hidden', !on);
  viewSwitcher.classList.toggle('hidden', !on);
  if (on) {
    userPhoto.src = currentUser.photoURL || '';
    userNameEl.textContent = currentUser.displayName || currentUser.email;
    adminBadge.classList.toggle('hidden', !isAdmin);
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  }
}

function signIn()    { auth.signInWithPopup(googleProvider).catch(e => showToast('Sign-in failed: ' + e.message)); }
function doSignOut() { if (confirm('Sign out?')) auth.signOut(); }

// ── Subscriptions ─────────────────────────────────────────────────────────────
function subscribeMyTasks() {
  if (unsubMyTasks) unsubMyTasks();
  unsubMyTasks = db.collection('tasks').where('uid', '==', currentUser.uid)
    .onSnapshot(snap => {
      myTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      myTasks.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      if (activeTab === 'my-tasks') refreshMyTasks();
    }, e => console.error('tasks:', e));
}

function subscribeAssigned() {
  if (unsubAssigned) unsubAssigned();
  unsubAssigned = db.collection('tasks').where('assigneeId', '==', currentUser.uid)
    .onSnapshot(snap => {
      assignedTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      assignedTasks.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      if (activeTab === 'my-tasks' && activeView === 'assigned') refreshMyTasks();
    }, e => console.error('assigned:', e));
}

function subscribeAllTasks() {
  if (unsubAllTasks) unsubAllTasks();
  unsubAllTasks = db.collection('tasks')
    .onSnapshot(snap => {
      allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allTasks.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      if (activeTab === 'my-tasks' && activeView === 'admin') refreshMyTasks();
    }, e => console.error('allTasks:', e));
}

function subscribeCats() {
  if (unsubCats) unsubCats();
  unsubCats = db.collection('categories').where('uid', '==', currentUser.uid)
    .onSnapshot(snap => {
      categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      categories.sort((a,b) => (a.order||0) - (b.order||0));
      if (activeTab === 'my-tasks') refreshMyTasks();
      populateCategorySelect();
    }, e => console.error('cats:', e));
}

function subscribeUsers() {
  if (unsubUsers) unsubUsers();
  unsubUsers = db.collection('users').onSnapshot(snap => {
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allUsers.sort((a,b) => (a.name||'').localeCompare(b.name||''));
  }, e => console.error('users:', e));
}

function subscribeFeed() {
  if (unsubFeed) return;
  unsubFeed = db.collection('tasks').where('visibility', '==', 'public')
    .onSnapshot(snap => {
      publicTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publicTasks.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      if (activeTab === 'public-feed') renderPublicFeed();
    }, e => console.error('feed:', e));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function genToken() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function offsetISO(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dueBadge(task) {
  if (task.completed)    return { label:'Done',     cls:'badge-done' };
  if (!task.dueDate)     return null;
  const t = todayISO();
  if (task.dueDate < t)  return { label:'Overdue',   cls:'badge-overdue' };
  if (task.dueDate === t) return { label:'Due Today', cls:'badge-today' };
  return { label:'Upcoming', cls:'badge-upcoming' };
}

function formatDate(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return new Date(y, m-1, d).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

function escapeHTML(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getVis()  { return [...visInputs].find(r => r.checked)?.value || 'private'; }
function setVis(v) { visInputs.forEach(r => { r.checked = r.value === v; }); }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2500);
}

function copyShareLink(token) {
  const url = `${location.origin}${location.pathname}?share=${token}`;
  navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => showToast('Could not copy'));
}

function catFor(id) { return categories.find(c => c.id === id); }

// ── My Tasks dispatcher ───────────────────────────────────────────────────────
function refreshMyTasks() {
  if (activeView === 'board')    renderBoard();
  else if (activeView === 'assigned') renderAssignedView();
  else if (activeView === 'admin')    renderAdminView();
  else renderSmartView(activeView);
}

// ── Board view ────────────────────────────────────────────────────────────────
function renderBoard() {
  board.innerHTML = '';
  if (!currentUser) { authPrompt.classList.remove('hidden'); emptyState.classList.add('hidden'); return; }
  authPrompt.classList.add('hidden');

  const hasContent = categories.length > 0 || myTasks.length > 0;
  emptyState.classList.toggle('hidden', hasContent);
  if (!hasContent) {
    const p = document.createElement('div');
    p.className = 'board-empty-prompt';
    p.innerHTML = `<button class="add-category-btn"><span>+</span><br>New Category</button>`;
    p.querySelector('.add-category-btn').addEventListener('click', openCatModal);
    board.appendChild(p);
    return;
  }

  categories.forEach(cat => board.appendChild(buildLane(cat, myTasks.filter(t => t.categoryId === cat.id))));

  const uncatTasks = myTasks.filter(t => !t.categoryId);
  if (uncatTasks.length > 0 || categories.length === 0) {
    board.appendChild(buildLane({ id:UNCAT_ID, name:'Uncategorized', color:'#94a3b8' }, uncatTasks, true));
  }

  const addLane = document.createElement('div');
  addLane.className = 'lane lane-new';
  addLane.innerHTML = `<button class="add-category-btn"><span>+</span><br>New Category</button>`;
  addLane.querySelector('.add-category-btn').addEventListener('click', openCatModal);
  board.appendChild(addLane);
}

function buildLane(cat, tasks, isUncat = false) {
  const lane = document.createElement('div');
  lane.className = 'lane';
  lane.dataset.catId = cat.id;
  lane.style.setProperty('--lane-color', cat.color);

  lane.innerHTML = `
    <div class="lane-header">
      <div class="lane-title">
        <span class="lane-dot" style="background:${cat.color}"></span>
        <h3 class="lane-name">${escapeHTML(cat.name)}</h3>
        <span class="lane-count">${tasks.length}</span>
      </div>
      <div class="lane-btns">
        <button class="lane-btn lane-add-btn" title="Add task">+</button>
        ${!isUncat ? `<button class="lane-btn lane-del-btn" title="Delete">&#x2715;</button>` : ''}
      </div>
    </div>
    <div class="lane-body" data-cat-id="${cat.id}"></div>
    <button class="lane-footer-btn">+ Add Task</button>
  `;

  const body = lane.querySelector('.lane-body');
  tasks.forEach(t => body.appendChild(buildCard(t)));

  new Sortable(body, { group:'tasks', animation:150, ghostClass:'card-ghost', chosenClass:'card-chosen', onEnd:handleDrop });

  const catId = isUncat ? null : cat.id;
  lane.querySelector('.lane-add-btn').addEventListener('click', () => openModal(null, catId));
  lane.querySelector('.lane-footer-btn').addEventListener('click', () => openModal(null, catId));
  if (!isUncat) lane.querySelector('.lane-del-btn').addEventListener('click', () => deleteCat(cat.id, cat.name));

  return lane;
}

function buildCard(task, showCat = false, adminMode = false) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;

  const badge  = dueBadge(task);
  const cat    = catFor(task.categoryId);
  const catChip = showCat && cat
    ? `<span class="cat-chip" style="--chip-color:${cat.color}">${escapeHTML(cat.name)}</span>`
    : showCat && !cat
    ? `<span class="cat-chip" style="--chip-color:#94a3b8">Uncategorized</span>`
    : '';
  const visBadge = task.visibility === 'public' ? '<span class="badge badge-public">Public</span>' : '';
  const shareBtn = task.visibility === 'public' ? `<button class="btn btn-share share-btn">&#128279;</button>` : '';
  const assigneeChip = task.assigneeId
    ? `<span class="assignee-chip">&#128100; ${escapeHTML(task.assigneeName || 'Assigned')}</span>`
    : '';
  const ownerChip = adminMode && task.ownerName
    ? `<span class="owner-chip">by ${escapeHTML(task.ownerName)}</span>`
    : '';

  const canEdit = isAdmin || (currentUser && task.uid === currentUser.uid);

  card.innerHTML = `
    ${catChip || ownerChip ? `<div class="card-cat-row">${catChip}${ownerChip}</div>` : ''}
    <div class="task-card-top">
      <input type="checkbox" class="task-checkbox" aria-label="Mark complete" ${task.completed ? 'checked' : ''} />
      <span class="task-title">${escapeHTML(task.title)}</span>
    </div>
    ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
    ${assigneeChip ? `<div class="card-assignee-row">${assigneeChip}</div>` : ''}
    <div class="task-meta">
      ${task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : ''}
      ${badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : ''}
      ${visBadge}
    </div>
    <div class="task-actions">
      ${canEdit ? `<button class="btn btn-edit edit-btn">Edit</button>` : ''}
      ${shareBtn}
      ${canEdit ? `<button class="btn btn-danger delete-btn">Delete</button>` : ''}
    </div>
  `;

  card.querySelector('.task-checkbox').addEventListener('change', () => toggleComplete(task.id, task.completed));
  if (canEdit) {
    card.querySelector('.edit-btn').addEventListener('click', () => openModal(task));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
  }
  if (task.visibility === 'public') {
    card.querySelector('.share-btn').addEventListener('click', () => copyShareLink(task.shareToken));
  }

  return card;
}

async function handleDrop(evt) {
  if (evt.from === evt.to) return;
  const taskId = evt.item.dataset.taskId;
  if (!taskId) return;
  const rawId = evt.to.dataset.catId;
  const newCatId = (!rawId || rawId === UNCAT_ID) ? null : rawId;
  try { await db.collection('tasks').doc(taskId).update({ categoryId: newCatId }); }
  catch { showToast('Error moving task'); renderBoard(); }
}

// ── Smart views ───────────────────────────────────────────────────────────────
const SMART_LABELS = {
  today:   { title:'Due Today',     empty:'No tasks due today. Enjoy your day!' },
  week:    { title:'Due This Week', empty:'No tasks due this week.' },
  overdue: { title:'Overdue',       empty:'No overdue tasks — you\'re all caught up!' },
};

function renderSmartView(view) {
  board.innerHTML = '';
  if (!currentUser) { authPrompt.classList.remove('hidden'); return; }
  authPrompt.classList.add('hidden');
  emptyState.classList.add('hidden');

  const today   = todayISO();
  const weekEnd = offsetISO(7);
  let filtered;

  if (view === 'today')   filtered = myTasks.filter(t => !t.completed && t.dueDate === today);
  if (view === 'week')    filtered = myTasks.filter(t => !t.completed && t.dueDate >= today && t.dueDate <= weekEnd);
  if (view === 'overdue') filtered = myTasks.filter(t => !t.completed && t.dueDate && t.dueDate < today);

  const meta = SMART_LABELS[view];
  const header = document.createElement('div');
  header.className = 'smart-header';
  header.innerHTML = `<h2 class="smart-title">${meta.title}</h2><span class="smart-count">${filtered.length} task${filtered.length !== 1 ? 's' : ''}</span>`;
  board.appendChild(header);

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'empty-state';
    msg.innerHTML = `<p>${meta.empty}</p>`;
    board.appendChild(msg);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'smart-grid';
  filtered.forEach(t => grid.appendChild(buildCard(t, true)));
  board.appendChild(grid);
}

// ── Assigned to Me view ───────────────────────────────────────────────────────
function renderAssignedView() {
  board.innerHTML = '';
  if (!currentUser) { authPrompt.classList.remove('hidden'); return; }
  authPrompt.classList.add('hidden');
  emptyState.classList.add('hidden');

  const header = document.createElement('div');
  header.className = 'smart-header';
  header.innerHTML = `<h2 class="smart-title">Assigned to Me</h2><span class="smart-count">${assignedTasks.length} task${assignedTasks.length !== 1 ? 's' : ''}</span>`;
  board.appendChild(header);

  if (assignedTasks.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'empty-state';
    msg.innerHTML = '<p>No tasks assigned to you yet.</p>';
    board.appendChild(msg);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'smart-grid';
  assignedTasks.forEach(t => grid.appendChild(buildCard(t, true)));
  board.appendChild(grid);
}

// ── Admin: All Tasks view ─────────────────────────────────────────────────────
function renderAdminView() {
  board.innerHTML = '';
  if (!currentUser || !isAdmin) return;
  authPrompt.classList.add('hidden');
  emptyState.classList.add('hidden');

  const header = document.createElement('div');
  header.className = 'smart-header';
  header.innerHTML = `<h2 class="smart-title">&#128737; All Tasks</h2><span class="smart-count">${allTasks.length} total</span>`;
  board.appendChild(header);

  if (allTasks.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'empty-state';
    msg.innerHTML = '<p>No tasks found.</p>';
    board.appendChild(msg);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'smart-grid';
  allTasks.forEach(t => grid.appendChild(buildCard(t, true, true)));
  board.appendChild(grid);
}

// ── Public feed ───────────────────────────────────────────────────────────────
function renderPublicFeed() {
  feedList.innerHTML = '';
  feedEmpty.classList.toggle('hidden', publicTasks.length > 0);

  publicTasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'task-card feed-card';
    const badge = dueBadge(task);
    const isOwner = currentUser && currentUser.uid === task.uid;
    const avatarHTML = task.ownerPhoto
      ? `<img src="${escapeHTML(task.ownerPhoto)}" class="owner-avatar" alt="" />`
      : `<div class="owner-avatar owner-avatar-fallback">${escapeHTML((task.ownerName||'?')[0])}</div>`;

    card.innerHTML = `
      <div class="task-owner">
        ${avatarHTML}
        <span class="owner-name">${escapeHTML(task.ownerName||'Anonymous')}</span>
        ${isOwner ? '<span class="badge badge-yours">You</span>' : ''}
      </div>
      <div class="task-card-top" style="margin-top:.5rem">
        <span class="task-title">${escapeHTML(task.title)}</span>
      </div>
      ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
      <div class="task-meta">
        ${task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : ''}
        ${badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : ''}
      </div>
      <div class="task-actions">
        <button class="btn btn-share share-btn">&#128279; Share</button>
      </div>
    `;
    card.querySelector('.share-btn').addEventListener('click', () => copyShareLink(task.shareToken));
    feedList.appendChild(card);
  });
}

// ── Tabs & views ──────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  myTasksPanel.classList.toggle('hidden', tab !== 'my-tasks');
  publicPanel.classList.toggle('hidden', tab !== 'public-feed');
  if (tab === 'public-feed') { subscribeFeed(); renderPublicFeed(); }
  else refreshMyTasks();
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  refreshMyTasks();
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function openModal(task, catId = null) {
  if (!currentUser) { signIn(); return; }
  taskIdInput.value     = task?.id || '';
  titleInput.value      = task?.title || '';
  descInput.value       = task?.description || '';
  dueDateInput.value    = task?.dueDate || '';
  setVis(task?.visibility || 'private');
  populateCategorySelect(task?.categoryId ?? catId);
  populateAssigneeSelect(task?.assigneeId || '');
  modalTitle.textContent = task ? 'Edit Task' : 'Add Task';
  titleInput.classList.remove('invalid');
  titleError.classList.add('hidden');
  modalOverlay.classList.remove('hidden');
  titleInput.focus();
}

function closeModal() { modalOverlay.classList.add('hidden'); taskForm.reset(); }

async function handleFormSubmit(e) {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.classList.add('invalid'); titleError.classList.remove('hidden'); titleInput.focus(); return; }

  const id = taskIdInput.value;
  const assigneeId   = assigneeSelect.value || null;
  const assigneeUser = assigneeId ? allUsers.find(u => u.id === assigneeId) : null;
  const assigneeName = assigneeUser ? (assigneeUser.name || assigneeUser.email || '') : '';

  try {
    if (id) {
      // Update: only touch editable fields — preserve uid/ownerName/ownerPhoto of original owner
      await db.collection('tasks').doc(id).update({
        title,
        description: descInput.value.trim(),
        dueDate: dueDateInput.value,
        categoryId: categorySelect.value || null,
        visibility: getVis(),
        assigneeId,
        assigneeName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Create: set full ownership from current user
      await db.collection('tasks').add({
        uid: currentUser.uid,
        ownerName: currentUser.displayName || '',
        ownerPhoto: currentUser.photoURL || '',
        title,
        description: descInput.value.trim(),
        dueDate: dueDateInput.value,
        categoryId: categorySelect.value || null,
        visibility: getVis(),
        assigneeId,
        assigneeName,
        completed: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        shareToken: genToken(),
      });
    }
    closeModal();
    if (assigneeId && assigneeId !== currentUser.uid) {
      showToast(`Assigned to ${assigneeName || 'user'}`);
    }
  } catch (err) { showToast('Error saving: ' + err.message); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try { await db.collection('tasks').doc(id).delete(); }
  catch (err) { showToast('Error: ' + err.message); }
}

async function toggleComplete(id, current) {
  try { await db.collection('tasks').doc(id).update({ completed: !current }); }
  catch (e) { console.error(e); }
}

function populateCategorySelect(selectedId = null) {
  const curr = selectedId ?? categorySelect.value;
  categorySelect.innerHTML = '<option value="">— Uncategorized —</option>';
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    if (c.id === curr) o.selected = true;
    categorySelect.appendChild(o);
  });
}

function populateAssigneeSelect(selectedId = '') {
  assigneeSelect.innerHTML = '<option value="">— Unassigned —</option>';
  allUsers.forEach(u => {
    const o = document.createElement('option');
    o.value = u.id;
    o.textContent = u.name || u.email || u.id;
    if (u.id === selectedId) o.selected = true;
    assigneeSelect.appendChild(o);
  });
}

// ── Category Modal ────────────────────────────────────────────────────────────
function openCatModal() {
  if (!currentUser) { signIn(); return; }
  selectedColor = LANE_COLORS[0];
  catNameInput.value = '';
  renderColorPicker();
  catModalOv.classList.remove('hidden');
  catNameInput.focus();
}
function closeCatModal() { catModalOv.classList.add('hidden'); }

function renderColorPicker() {
  colorPickerEl.innerHTML = '';
  LANE_COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (c === selectedColor ? ' selected' : '');
    sw.style.background = c;
    sw.addEventListener('click', () => { selectedColor = c; renderColorPicker(); });
    colorPickerEl.appendChild(sw);
  });
}

async function handleCatSubmit(e) {
  e.preventDefault();
  const name = catNameInput.value.trim();
  if (!name) return;
  try {
    await db.collection('categories').add({
      uid: currentUser.uid, name, color: selectedColor,
      order: categories.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeCatModal();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function deleteCat(id, name) {
  if (!confirm(`Delete "${name}"?\n\nTasks will move to Uncategorized.`)) return;
  try {
    const batch = db.batch();
    myTasks.filter(t => t.categoryId === id).forEach(t => batch.update(db.collection('tasks').doc(t.id), { categoryId: null }));
    batch.delete(db.collection('categories').doc(id));
    await batch.commit();
  } catch (err) { showToast('Error: ' + err.message); }
}

// ── Shared task view ──────────────────────────────────────────────────────────
async function loadSharedTask(token) {
  try {
    const snap = await db.collection('tasks').where('shareToken','==',token).limit(1).get();
    if (snap.empty) { detailContent.innerHTML = '<p style="color:var(--text-muted)">Task not found.</p>'; }
    else {
      const task = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (task.visibility !== 'public') { detailContent.innerHTML = '<p style="color:var(--text-muted)">This task is private.</p>'; }
      else {
        const badge = dueBadge(task);
        const av = task.ownerPhoto
          ? `<img src="${escapeHTML(task.ownerPhoto)}" class="owner-avatar" alt="" />`
          : `<div class="owner-avatar owner-avatar-fallback">${escapeHTML((task.ownerName||'?')[0])}</div>`;
        detailContent.innerHTML = `
          <div class="task-owner" style="margin-bottom:.8rem">${av}<span class="owner-name">${escapeHTML(task.ownerName||'Anonymous')}</span></div>
          <h3 style="font-size:1.1rem;margin-bottom:.4rem">${escapeHTML(task.title)}</h3>
          ${task.description ? `<p style="color:var(--text-muted);font-size:.9rem;line-height:1.5;margin-bottom:.6rem">${escapeHTML(task.description)}</p>` : ''}
          <div class="task-meta">
            ${task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : ''}
            ${badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : ''}
          </div>`;
      }
    }
  } catch { detailContent.innerHTML = '<p style="color:var(--text-muted)">Unable to load task.</p>'; }
  detailOverlay.classList.remove('hidden');
}

// ── Event listeners ───────────────────────────────────────────────────────────
welcomeSignIn.addEventListener('click', signIn);
signInBtn.addEventListener('click', signIn);
signOutBtn.addEventListener('click', doSignOut);
addTaskBtn.addEventListener('click', () => openModal(null));
fabBtn.addEventListener('click', () => openModal(null));
cancelBtn.addEventListener('click', closeModal);
catCancelBtn.addEventListener('click', closeCatModal);
taskForm.addEventListener('submit', handleFormSubmit);
catForm.addEventListener('submit', handleCatSubmit);
detailClose.addEventListener('click', () => detailOverlay.classList.add('hidden'));
settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsDone.addEventListener('click', closeSettings);

document.querySelectorAll('.theme-btn').forEach(b => b.addEventListener('click', () => {
  savePrefs({ theme: b.dataset.theme }); applyTheme(b.dataset.theme);
}));

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));

modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
catModalOv.addEventListener('click', e => { if (e.target === catModalOv) closeCatModal(); });
settingsOv.addEventListener('click', e => { if (e.target === settingsOv) closeSettings(); });
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) detailOverlay.classList.add('hidden'); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeCatModal(); closeSettings(); detailOverlay.classList.add('hidden'); }
});

titleInput.addEventListener('input', () => {
  if (titleInput.value.trim()) { titleInput.classList.remove('invalid'); titleError.classList.add('hidden'); }
});

// ── Init ──────────────────────────────────────────────────────────────────────
initTheme();

const sharedToken = new URLSearchParams(location.search).get('share');
if (sharedToken) {
  const unsub = auth.onAuthStateChanged(() => { unsub(); loadSharedTask(sharedToken); });
}

subscribeFeed();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
