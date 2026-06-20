'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const LANE_COLORS = ['#4f46e5','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316','#14b8a6','#64748b'];
const UNCAT_ID = '__uncat__';

// ── Firebase refs ─────────────────────────────────────────────────────────────
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
let myTasks = [];
let publicTasks = [];
let categories = [];
let activeTab = 'my-tasks';
let selectedColor = LANE_COLORS[0];
let unsubMyTasks = null;
let unsubCategories = null;
let unsubPublicFeed = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const signInBtn       = document.getElementById('sign-in-btn');
const signOutBtn      = document.getElementById('sign-out-btn');
const userInfo        = document.getElementById('user-info');
const userPhoto       = document.getElementById('user-photo');
const userNameEl      = document.getElementById('user-name');
const addTaskBtn      = document.getElementById('add-task-btn');
const fabBtn          = document.getElementById('fab-btn');
const tabs            = document.querySelectorAll('.tab');
const myTasksPanel    = document.getElementById('my-tasks-panel');
const publicPanel     = document.getElementById('public-feed-panel');
const board           = document.getElementById('board');
const emptyState      = document.getElementById('empty-state');
const authPrompt      = document.getElementById('auth-prompt');
const feedList        = document.getElementById('feed-list');
const feedEmpty       = document.getElementById('feed-empty');
const modalOverlay    = document.getElementById('modal-overlay');
const modalTitle      = document.getElementById('modal-title');
const taskForm        = document.getElementById('task-form');
const taskIdInput     = document.getElementById('task-id');
const titleInput      = document.getElementById('task-title');
const descInput       = document.getElementById('task-description');
const dueDateInput    = document.getElementById('task-due-date');
const categorySelect  = document.getElementById('task-category');
const visInputs       = document.querySelectorAll('input[name="visibility"]');
const cancelBtn       = document.getElementById('cancel-btn');
const titleError      = document.getElementById('title-error');
const catModalOverlay = document.getElementById('cat-modal-overlay');
const catForm         = document.getElementById('cat-form');
const catNameInput    = document.getElementById('cat-name');
const catCancelBtn    = document.getElementById('cat-cancel-btn');
const colorPickerEl   = document.getElementById('color-picker');
const detailOverlay   = document.getElementById('detail-overlay');
const detailContent   = document.getElementById('detail-content');
const detailClose     = document.getElementById('detail-close');
const toastEl         = document.getElementById('toast');

// ── Auth ──────────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  currentUser = user;
  updateAuthUI();
  if (user) {
    subscribeMyTasks();
    subscribeCategories();
  } else {
    [unsubMyTasks, unsubCategories].forEach(u => u && u());
    unsubMyTasks = unsubCategories = null;
    myTasks = []; categories = [];
    if (activeTab === 'my-tasks') renderBoard();
  }
});

function updateAuthUI() {
  const on = !!currentUser;
  signInBtn.classList.toggle('hidden', on);
  userInfo.classList.toggle('hidden', !on);
  addTaskBtn.classList.toggle('hidden', !on);
  fabBtn.classList.toggle('hidden', !on);
  if (on) {
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

// ── Subscriptions ─────────────────────────────────────────────────────────────
function subscribeMyTasks() {
  if (unsubMyTasks) unsubMyTasks();
  unsubMyTasks = db.collection('tasks')
    .where('uid', '==', currentUser.uid)
    .onSnapshot(snap => {
      myTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      myTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (activeTab === 'my-tasks') renderBoard();
    }, err => console.error('tasks:', err));
}

function subscribeCategories() {
  if (unsubCategories) unsubCategories();
  unsubCategories = db.collection('categories')
    .where('uid', '==', currentUser.uid)
    .onSnapshot(snap => {
      categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      categories.sort((a, b) => (a.order || 0) - (b.order || 0));
      if (activeTab === 'my-tasks') renderBoard();
      populateCategorySelect();
    }, err => console.error('categories:', err));
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
function genToken() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dueBadge(task) {
  if (task.completed) return { label: 'Done', cls: 'badge-done' };
  if (!task.dueDate) return null;
  const today = todayISO();
  if (task.dueDate < today)   return { label: 'Overdue',   cls: 'badge-overdue' };
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

function getVisibility() { return [...visInputs].find(r => r.checked)?.value || 'private'; }
function setVisibility(v) { visInputs.forEach(r => { r.checked = r.value === v; }); }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2500);
}

function copyShareLink(token) {
  const url = `${location.origin}${location.pathname}?share=${token}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Link copied!'))
    .catch(() => showToast('Could not copy link'));
}

// ── Board rendering ───────────────────────────────────────────────────────────
function renderBoard() {
  board.innerHTML = '';

  if (!currentUser) {
    authPrompt.classList.remove('hidden');
    emptyState.classList.add('hidden');
    return;
  }
  authPrompt.classList.add('hidden');

  const hasContent = categories.length > 0 || myTasks.length > 0;
  emptyState.classList.toggle('hidden', hasContent);
  if (!hasContent) {
    // Show the "New Category" prompt inside the board
    const prompt = document.createElement('div');
    prompt.className = 'board-empty-prompt';
    prompt.innerHTML = `<button class="add-category-btn"><span>+</span><br>New Category</button>`;
    prompt.querySelector('.add-category-btn').addEventListener('click', openCategoryModal);
    board.appendChild(prompt);
    return;
  }

  // Category lanes
  categories.forEach(cat => {
    board.appendChild(buildLane(cat, myTasks.filter(t => t.categoryId === cat.id)));
  });

  // Uncategorized lane (only if tasks exist without a category)
  const uncatTasks = myTasks.filter(t => !t.categoryId);
  if (uncatTasks.length > 0 || categories.length === 0) {
    board.appendChild(buildLane(
      { id: UNCAT_ID, name: 'Uncategorized', color: '#94a3b8' },
      uncatTasks,
      true
    ));
  }

  // + New Category lane
  const addLane = document.createElement('div');
  addLane.className = 'lane lane-new';
  addLane.innerHTML = `<button class="add-category-btn"><span>+</span><br>New Category</button>`;
  addLane.querySelector('.add-category-btn').addEventListener('click', openCategoryModal);
  board.appendChild(addLane);
}

function buildLane(cat, tasks, isUncat = false) {
  const lane = document.createElement('div');
  lane.className = 'lane';
  lane.dataset.catId = cat.id;

  lane.innerHTML = `
    <div class="lane-header">
      <div class="lane-title">
        <span class="lane-dot" style="background:${cat.color}"></span>
        <h3 class="lane-name">${escapeHTML(cat.name)}</h3>
        <span class="lane-count">${tasks.length}</span>
      </div>
      <div class="lane-btns">
        <button class="lane-btn lane-add-btn" title="Add task">+</button>
        ${!isUncat ? `<button class="lane-btn lane-del-btn" title="Delete category">&#x2715;</button>` : ''}
      </div>
    </div>
    <div class="lane-body" data-cat-id="${cat.id}"></div>
    <button class="lane-footer-btn">+ Add Task</button>
  `;

  const body = lane.querySelector('.lane-body');
  tasks.forEach(t => body.appendChild(buildCard(t)));

  new Sortable(body, {
    group: 'tasks',
    animation: 150,
    ghostClass: 'card-ghost',
    chosenClass: 'card-chosen',
    onEnd: handleDrop,
  });

  const catId = isUncat ? null : cat.id;
  lane.querySelector('.lane-add-btn').addEventListener('click', () => openModal(null, catId));
  lane.querySelector('.lane-footer-btn').addEventListener('click', () => openModal(null, catId));
  if (!isUncat) {
    lane.querySelector('.lane-del-btn').addEventListener('click', () => deleteCategory(cat.id, cat.name));
  }

  return lane;
}

function buildCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;

  const badge = dueBadge(task);
  const badgeHTML = badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : '';
  const visBadge = task.visibility === 'public' ? '<span class="badge badge-public">Public</span>' : '';
  const shareBtn = task.visibility === 'public'
    ? `<button class="btn btn-share share-btn">&#128279;</button>` : '';

  card.innerHTML = `
    <div class="task-card-top">
      <input type="checkbox" class="task-checkbox" aria-label="Mark complete" ${task.completed ? 'checked' : ''} />
      <span class="task-title">${escapeHTML(task.title)}</span>
    </div>
    ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}
    <div class="task-meta">
      ${task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : ''}
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

  return card;
}

async function handleDrop(evt) {
  if (evt.from === evt.to) return; // reorder within same lane — no category change needed
  const taskId = evt.item.dataset.taskId;
  if (!taskId) return;
  const rawCatId = evt.to.dataset.catId;
  const newCategoryId = (!rawCatId || rawCatId === UNCAT_ID) ? null : rawCatId;
  try {
    await db.collection('tasks').doc(taskId).update({ categoryId: newCategoryId });
  } catch (err) {
    showToast('Error moving task');
    renderBoard();
  }
}

// ── Public Feed ───────────────────────────────────────────────────────────────
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

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  myTasksPanel.classList.toggle('hidden', tab !== 'my-tasks');
  publicPanel.classList.toggle('hidden', tab !== 'public-feed');
  if (tab === 'public-feed') {
    subscribePublicFeed();
    renderPublicFeed();
  } else {
    renderBoard();
  }
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function openModal(task, categoryId = null) {
  if (!currentUser) { signIn(); return; }
  taskIdInput.value = task?.id || '';
  titleInput.value = task?.title || '';
  descInput.value = task?.description || '';
  dueDateInput.value = task?.dueDate || '';
  setVisibility(task?.visibility || 'private');
  populateCategorySelect(task?.categoryId ?? categoryId);
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
  const categoryId = categorySelect.value || null;
  const data = {
    uid: currentUser.uid,
    ownerName: currentUser.displayName || '',
    ownerPhoto: currentUser.photoURL || '',
    title,
    description: descInput.value.trim(),
    dueDate: dueDateInput.value,
    categoryId,
    visibility: getVisibility(),
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
    showToast('Error saving: ' + err.message);
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try { await db.collection('tasks').doc(id).delete(); }
  catch (err) { showToast('Error deleting: ' + err.message); }
}

async function toggleComplete(id, current) {
  try { await db.collection('tasks').doc(id).update({ completed: !current }); }
  catch (err) { console.error(err); }
}

function populateCategorySelect(selectedId = null) {
  categorySelect.innerHTML = '<option value="">— Uncategorized —</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    if (cat.id === selectedId) opt.selected = true;
    categorySelect.appendChild(opt);
  });
}

// ── Category Modal ────────────────────────────────────────────────────────────
function openCategoryModal() {
  if (!currentUser) { signIn(); return; }
  selectedColor = LANE_COLORS[0];
  catNameInput.value = '';
  renderColorPicker();
  catModalOverlay.classList.remove('hidden');
  catNameInput.focus();
}

function closeCategoryModal() {
  catModalOverlay.classList.add('hidden');
}

function renderColorPicker() {
  colorPickerEl.innerHTML = '';
  LANE_COLORS.forEach(color => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (color === selectedColor ? ' selected' : '');
    sw.style.background = color;
    sw.addEventListener('click', () => { selectedColor = color; renderColorPicker(); });
    colorPickerEl.appendChild(sw);
  });
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  const name = catNameInput.value.trim();
  if (!name) return;
  try {
    await db.collection('categories').add({
      uid: currentUser.uid,
      name,
      color: selectedColor,
      order: categories.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeCategoryModal();
  } catch (err) {
    showToast('Error creating category: ' + err.message);
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete "${name}"?\n\nTasks will move to Uncategorized.`)) return;
  try {
    const batch = db.batch();
    myTasks.filter(t => t.categoryId === id).forEach(t => {
      batch.update(db.collection('tasks').doc(t.id), { categoryId: null });
    });
    batch.delete(db.collection('categories').doc(id));
    await batch.commit();
  } catch (err) {
    showToast('Error deleting category: ' + err.message);
  }
}

// ── Shared task view ──────────────────────────────────────────────────────────
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
        const avatarHTML = task.ownerPhoto
          ? `<img src="${escapeHTML(task.ownerPhoto)}" class="owner-avatar" alt="" />`
          : `<div class="owner-avatar owner-avatar-fallback">${escapeHTML((task.ownerName||'?')[0])}</div>`;
        detailContent.innerHTML = `
          <div class="task-owner" style="margin-bottom:.8rem">
            ${avatarHTML}
            <span class="owner-name">${escapeHTML(task.ownerName || 'Anonymous')}</span>
          </div>
          <h3 style="font-size:1.1rem;margin-bottom:.4rem">${escapeHTML(task.title)}</h3>
          ${task.description ? `<p style="color:var(--text-muted);font-size:.9rem;line-height:1.5;margin-bottom:.6rem">${escapeHTML(task.description)}</p>` : ''}
          <div class="task-meta">
            ${task.dueDate ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>` : ''}
            ${badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : ''}
          </div>
        `;
      }
    }
  } catch {
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
catCancelBtn.addEventListener('click', closeCategoryModal);
taskForm.addEventListener('submit', handleFormSubmit);
catForm.addEventListener('submit', handleCategorySubmit);
detailClose.addEventListener('click', () => detailOverlay.classList.add('hidden'));
tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
catModalOverlay.addEventListener('click', e => { if (e.target === catModalOverlay) closeCategoryModal(); });
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) detailOverlay.classList.add('hidden'); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeCategoryModal(); detailOverlay.classList.add('hidden'); }
});

titleInput.addEventListener('input', () => {
  if (titleInput.value.trim()) { titleInput.classList.remove('invalid'); titleError.classList.add('hidden'); }
});

// ── Init ──────────────────────────────────────────────────────────────────────
const sharedToken = new URLSearchParams(location.search).get('share');
if (sharedToken) {
  const unsub = auth.onAuthStateChanged(() => { unsub(); loadSharedTask(sharedToken); });
}

subscribePublicFeed();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
