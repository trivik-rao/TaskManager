'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const taskList      = document.getElementById('task-list');
const emptyState    = document.getElementById('empty-state');
const addTaskBtn    = document.getElementById('add-task-btn');
const fabBtn        = document.getElementById('fab-btn');
const modalOverlay  = document.getElementById('modal-overlay');
const modalTitle    = document.getElementById('modal-title');
const taskForm      = document.getElementById('task-form');
const taskIdInput   = document.getElementById('task-id');
const titleInput    = document.getElementById('task-title');
const descInput     = document.getElementById('task-description');
const dueDateInput  = document.getElementById('task-due-date');
const cancelBtn     = document.getElementById('cancel-btn');
const titleError    = document.getElementById('title-error');

// ── Storage ───────────────────────────────────────────────────────────────────
function loadTasks() {
  try { return JSON.parse(localStorage.getItem('tasks')) ?? []; }
  catch { return []; }
}

function saveTasks(tasks) {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// ── State ─────────────────────────────────────────────────────────────────────
let tasks = loadTasks();

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dueBadge(task) {
  if (task.completed) return { label: 'Done', cls: 'badge-done' };
  if (!task.dueDate)  return null;
  const today = todayISO();
  if (task.dueDate < today)  return { label: 'Overdue',  cls: 'badge-overdue' };
  if (task.dueDate === today) return { label: 'Due Today', cls: 'badge-today' };
  return { label: 'Upcoming', cls: 'badge-upcoming' };
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderTasks() {
  taskList.innerHTML = '';
  emptyState.classList.toggle('hidden', tasks.length > 0);

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'task-card' + (task.completed ? ' completed' : '');
    card.dataset.id = task.id;

    const badge = dueBadge(task);
    const badgeHTML = badge
      ? `<span class="badge ${badge.cls}">${badge.label}</span>`
      : '';

    const dueDateHTML = task.dueDate
      ? `<span class="due-date">Due: ${formatDate(task.dueDate)}</span>`
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
      </div>
      <div class="task-actions">
        <button class="btn btn-edit edit-btn">Edit</button>
        <button class="btn btn-danger delete-btn">Delete</button>
      </div>
    `;

    card.querySelector('.task-checkbox').addEventListener('change', () => toggleComplete(task.id));
    card.querySelector('.edit-btn').addEventListener('click', () => openModal(task));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    taskList.appendChild(card);
  });
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(task) {
  taskIdInput.value      = task ? task.id          : '';
  titleInput.value       = task ? task.title        : '';
  descInput.value        = task ? task.description  : '';
  dueDateInput.value     = task ? task.dueDate      : '';
  modalTitle.textContent = task ? 'Edit Task'       : 'Add Task';
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
function handleFormSubmit(e) {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.classList.add('invalid');
    titleError.classList.remove('hidden');
    titleInput.focus();
    return;
  }

  const id = taskIdInput.value;
  if (id) {
    tasks = tasks.map(t => t.id === id
      ? { ...t, title, description: descInput.value.trim(), dueDate: dueDateInput.value }
      : t
    );
  } else {
    tasks.push({
      id: uid(),
      title,
      description: descInput.value.trim(),
      dueDate: dueDateInput.value,
      createdAt: new Date().toISOString(),
      completed: false,
    });
  }

  saveTasks(tasks);
  renderTasks();
  closeModal();
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  renderTasks();
}

function toggleComplete(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  saveTasks(tasks);
  renderTasks();
}

// ── Event listeners ───────────────────────────────────────────────────────────
addTaskBtn.addEventListener('click', () => openModal(null));
fabBtn.addEventListener('click', () => openModal(null));
cancelBtn.addEventListener('click', closeModal);
taskForm.addEventListener('submit', handleFormSubmit);

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) closeModal();
});

titleInput.addEventListener('input', () => {
  if (titleInput.value.trim()) {
    titleInput.classList.remove('invalid');
    titleError.classList.add('hidden');
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
renderTasks();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
