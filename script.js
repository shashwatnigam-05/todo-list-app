document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let allTasks = [];
    let allHistory = [];
    let currentView = 'list';         // 'list' | 'kanban' | 'history'
    let currentFilter = 'all';        // 'all' | 'active' | 'completed' | 'high'
    let currentCategory = 'all';
    let searchQuery = '';
    let historyFilter = 'all';
    let soundEnabled = localStorage.getItem('taskflow_sound') !== 'off';
    let currentTheme = localStorage.getItem('taskflow_theme') || 'dark';
    let draggedTaskId = null;

    // -----------------------------------------------------------------------
    // DOM Elements
    // -----------------------------------------------------------------------
    const htmlEl = document.documentElement;
    const greetingText = document.getElementById('greeting-text');
    const streakCountEl = document.getElementById('streak-count');
    const soundToggleBtn = document.getElementById('sound-toggle');
    const themeToggleBtn = document.getElementById('theme-toggle');

    const statTotal = document.getElementById('stat-total');
    const statActive = document.getElementById('stat-active');
    const statCompleted = document.getElementById('stat-completed');
    const statHigh = document.getElementById('stat-high');
    const taskCountEl = document.getElementById('task-count');
    const progressPercentEl = document.getElementById('progress-percent');
    const progressFillEl = document.getElementById('progress-fill');

    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskPriority = document.getElementById('task-priority');
    const taskCategory = document.getElementById('task-category');
    const taskStatus = document.getElementById('task-status');
    const taskDue = document.getElementById('task-due');

    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const categoryFilter = document.getElementById('category-filter');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    const filterToolbar = document.getElementById('filter-toolbar');

    const viewBtns = document.querySelectorAll('.view-btn');
    const viewList = document.getElementById('view-list');
    const viewKanban = document.getElementById('view-kanban');
    const viewHistory = document.getElementById('view-history');

    const taskList = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');

    const kanbanDropzones = document.querySelectorAll('.kanban-dropzone');
    const countTodo = document.getElementById('count-todo');
    const countProgress = document.getElementById('count-in_progress');
    const countDone = document.getElementById('count-done');

    const historyBadge = document.getElementById('history-badge');
    const historyTimeline = document.getElementById('history-timeline');
    const historyEmpty = document.getElementById('history-empty');
    const historyPills = document.querySelectorAll('.history-pill');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const editIdInput = document.getElementById('edit-id');
    const editTitleInput = document.getElementById('edit-title');
    const editPriorityInput = document.getElementById('edit-priority');
    const editCategoryInput = document.getElementById('edit-category');
    const editStatusInput = document.getElementById('edit-status');
    const editDueInput = document.getElementById('edit-due');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    const toastContainer = document.getElementById('toast-container');
    const confettiCanvas = document.getElementById('confetti-canvas');

    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------
    applyTheme(currentTheme);
    updateSoundUI();
    updateGreeting();
    fetchTasks();
    fetchHistory();

    // Keyboard shortcut: '/' focuses task input
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
            e.preventDefault();
            taskInput.focus();
        }
        if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
            closeEditModal();
        }
    });

    function updateGreeting() {
        const hour = new Date().getHours();
        const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        greetingText.textContent = `${part} — let's crush your goals`;
    }

    // -----------------------------------------------------------------------
    // Web Audio Sound Synthesizer (Zero external assets needed)
    // -----------------------------------------------------------------------
    let audioCtx = null;
    function playSound(type) {
        if (!soundEnabled) return;
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === 'complete') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now);        // C5
                osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.14); // G5
                osc.frequency.setValueAtTime(1046.5, now + 0.21); // C6
                gain.gain.setValueAtTime(0.14, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
                osc.start(now);
                osc.stop(now + 0.42);
            } else if (type === 'add') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc.start(now);
                osc.stop(now + 0.14);
            } else if (type === 'delete') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(170, now + 0.14);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            }
        } catch (_) {}
    }

    // -----------------------------------------------------------------------
    // Celebration Confetti Engine
    // -----------------------------------------------------------------------
    let confettiParticles = [];
    let confettiAnimId = null;

    function launchConfetti() {
        const ctx = confettiCanvas.getContext('2d');
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
        const colors = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

        for (let i = 0; i < 65; i++) {
            confettiParticles.push({
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 260,
                y: window.innerHeight * 0.35,
                vx: (Math.random() - 0.5) * 14,
                vy: -Math.random() * 12 - 4,
                size: Math.random() * 7 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 12,
                alpha: 1,
            });
        }

        if (!confettiAnimId) {
            const step = () => {
                ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
                confettiParticles.forEach((p) => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.38; // gravity
                    p.rotation += p.vRot;
                    p.alpha -= 0.012;

                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.alpha);
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
                    ctx.restore();
                });
                confettiParticles = confettiParticles.filter((p) => p.alpha > 0 && p.y < confettiCanvas.height + 30);
                if (confettiParticles.length > 0) {
                    confettiAnimId = requestAnimationFrame(step);
                } else {
                    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
                    confettiAnimId = null;
                }
            };
            confettiAnimId = requestAnimationFrame(step);
        }
    }

    // -----------------------------------------------------------------------
    // Toast Notification
    // -----------------------------------------------------------------------
    function showToast(message, icon = 'fa-circle-check') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas ${icon}" style="color: var(--accent-primary)"></i><span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            setTimeout(() => toast.remove(), 220);
        }, 2600);
    }

    // -----------------------------------------------------------------------
    // Theme & Sound Controls
    // -----------------------------------------------------------------------
    function applyTheme(theme) {
        currentTheme = theme;
        htmlEl.setAttribute('data-theme', theme);
        localStorage.setItem('taskflow_theme', theme);
        themeToggleBtn.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }

    themeToggleBtn.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    function updateSoundUI() {
        soundToggleBtn.innerHTML = soundEnabled
            ? '<i class="fas fa-volume-high"></i>'
            : '<i class="fas fa-volume-xmark"></i>';
    }

    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('taskflow_sound', soundEnabled ? 'on' : 'off');
        updateSoundUI();
        showToast(soundEnabled ? 'Sound effects enabled' : 'Sound effects muted', 'fa-volume-high');
    });

    // -----------------------------------------------------------------------
    // View Switching (List / Kanban / History)
    // -----------------------------------------------------------------------
    viewBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            viewBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;

            viewList.classList.toggle('hidden', currentView !== 'list');
            viewKanban.classList.toggle('hidden', currentView !== 'kanban');
            viewHistory.classList.toggle('hidden', currentView !== 'history');
            filterToolbar.classList.toggle('hidden', currentView === 'history');

            if (currentView === 'history') {
                fetchHistory();
            } else {
                renderAll();
            }
        });
    });

    // -----------------------------------------------------------------------
    // API Calls — Tasks
    // -----------------------------------------------------------------------
    async function fetchTasks() {
        try {
            const response = await fetch('/api/tasks');
            const data = await response.json();
            allTasks = Array.isArray(data.tasks) ? data.tasks : [];
            renderAll();
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = taskInput.value.trim();
        if (!title) return;

        const payload = {
            title,
            priority: taskPriority.value,
            category: taskCategory.value,
            status: taskStatus.value,
            due_date: taskDue.value || null,
        };

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const data = await response.json();
                allTasks = data.tasks;
                taskInput.value = '';
                taskDue.value = '';
                playSound('add');
                showToast(`Added "${title}"`, 'fa-plus-circle');
                renderAll();
                fetchHistory();
            }
        } catch (error) {
            console.error('Error adding task:', error);
        }
    });

    async function patchTask(taskId, updates, celebrateOnComplete = false) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (response.ok) {
                const data = await response.json();
                allTasks = data.tasks;
                if (celebrateOnComplete) {
                    playSound('complete');
                    launchConfetti();
                    showToast('Task completed! Keep the streak alive 🔥', 'fa-trophy');
                }
                renderAll();
                fetchHistory();
            }
        } catch (error) {
            console.error('Error updating task:', error);
        }
    }

    async function deleteTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                const data = await response.json();
                allTasks = data.tasks;
                playSound('delete');
                showToast('Task moved to history log', 'fa-trash-can');
                renderAll();
                fetchHistory();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    clearCompletedBtn.addEventListener('click', async () => {
        const completedCount = allTasks.filter((t) => t.completed).length;
        if (completedCount === 0) {
            showToast('No completed tasks to clear', 'fa-circle-info');
            return;
        }
        try {
            const response = await fetch('/api/tasks/completed', { method: 'DELETE' });
            if (response.ok) {
                const data = await response.json();
                allTasks = data.tasks;
                playSound('delete');
                showToast(`Cleared ${completedCount} completed task(s)`, 'fa-broom');
                renderAll();
                fetchHistory();
            }
        } catch (error) {
            console.error('Error clearing completed tasks:', error);
        }
    });

    // -----------------------------------------------------------------------
    // API Calls — History
    // -----------------------------------------------------------------------
    async function fetchHistory() {
        try {
            const url = historyFilter && historyFilter !== 'all'
                ? `/api/history?action=${encodeURIComponent(historyFilter)}`
                : '/api/history';
            const response = await fetch(url);
            const data = await response.json();
            allHistory = Array.isArray(data.history) ? data.history : [];
            historyBadge.textContent = allHistory.length;
            renderHistory();
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    }

    async function restoreFromHistory(historyId) {
        try {
            const response = await fetch(`/api/history/${historyId}/restore`, {
                method: 'POST',
            });
            if (response.ok) {
                const data = await response.json();
                allTasks = data.tasks;
                playSound('add');
                showToast(`Restored "${data.task.title}" to your board`, 'fa-rotate-left');
                renderAll();
                fetchHistory();
            }
        } catch (error) {
            console.error('Error restoring task:', error);
        }
    }

    clearHistoryBtn.addEventListener('click', async () => {
        if (allHistory.length === 0) return;
        try {
            const response = await fetch('/api/history', { method: 'DELETE' });
            if (response.ok) {
                allHistory = [];
                historyBadge.textContent = '0';
                renderHistory();
                showToast('Activity history cleared', 'fa-trash-can');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    });

    historyPills.forEach((pill) => {
        pill.addEventListener('click', () => {
            historyPills.forEach((p) => p.classList.remove('active'));
            pill.classList.add('active');
            historyFilter = pill.dataset.hfilter;
            fetchHistory();
        });
    });

    // -----------------------------------------------------------------------
    // Search & Filtering
    // -----------------------------------------------------------------------
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        clearSearchBtn.classList.toggle('hidden', !searchQuery);
        renderAll();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderAll();
    });

    filterTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            filterTabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderAll();
        });
    });

    categoryFilter.addEventListener('change', () => {
        currentCategory = categoryFilter.value;
        renderAll();
    });

    function getFilteredTasks() {
        return allTasks.filter((t) => {
            const title = (t.title || '').toLowerCase();
            const cat = (t.category || 'General');
            if (searchQuery && !title.includes(searchQuery) && !cat.toLowerCase().includes(searchQuery)) {
                return false;
            }
            if (currentCategory !== 'all' && cat !== currentCategory) {
                return false;
            }
            if (currentFilter === 'active' && t.completed) return false;
            if (currentFilter === 'completed' && !t.completed) return false;
            if (currentFilter === 'high' && t.priority !== 'high') return false;
            return true;
        });
    }

    // -----------------------------------------------------------------------
    // Rendering: Stats, List, Kanban, History
    // -----------------------------------------------------------------------
    function renderAll() {
        updateStats();
        const filtered = getFilteredTasks();
        renderTaskList(filtered);
        renderKanban(filtered);
    }

    function updateStats() {
        const total = allTasks.length;
        const completed = allTasks.filter((t) => t.completed).length;
        const active = total - completed;
        const highPending = allTasks.filter((t) => !t.completed && t.priority === 'high').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        statTotal.textContent = total;
        statActive.textContent = active;
        statCompleted.textContent = completed;
        statHigh.textContent = highPending;
        streakCountEl.textContent = completed;

        taskCountEl.textContent = `${active} task${active !== 1 ? 's' : ''} pending`;
        progressPercentEl.textContent = `${pct}% complete`;
        progressFillEl.style.width = `${pct}%`;
    }

    function formatDueBadge(dueDate, isCompleted) {
        if (!dueDate) return '';
        const todayStr = new Date().toISOString().slice(0, 10);
        const isOverdue = !isCompleted && dueDate < todayStr;
        const label = isOverdue ? `Overdue · ${dueDate}` : `Due ${dueDate}`;
        return `<span class="badge badge-due ${isOverdue ? 'overdue' : ''}">
            <i class="regular fa-calendar"></i> ${escapeHtml(label)}
        </span>`;
    }

    function getStageLabel(status) {
        if (status === 'in_progress') return 'In Progress';
        if (status === 'done') return 'Done';
        return 'To Do';
    }

    function renderTaskList(tasks) {
        taskList.innerHTML = '';
        emptyState.classList.toggle('hidden', tasks.length > 0);

        tasks.forEach((task) => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.draggable = true;
            li.dataset.id = task.id;

            const priority = task.priority || 'medium';
            const category = task.category || 'General';
            const status = task.status || (task.completed ? 'done' : 'todo');

            li.innerHTML = `
                <div class="task-left">
                    <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
                    <button class="task-checkbox ${task.completed ? 'checked' : ''}" title="Toggle complete">
                        <i class="fas fa-check"></i>
                    </button>
                    <div class="task-body">
                        <span class="task-content" title="Double-click to edit">${escapeHtml(task.title)}</span>
                        <div class="task-meta">
                            <span class="badge badge-priority-${priority}">
                                <i class="fas fa-flag"></i> ${priority.toUpperCase()}
                            </span>
                            <span class="badge badge-category">
                                <i class="fas fa-tag"></i> ${escapeHtml(category)}
                            </span>
                            <span class="badge badge-stage">
                                ${getStageLabel(status)}
                            </span>
                            ${formatDueBadge(task.due_date, task.completed)}
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="action-btn edit-btn" title="Edit task"><i class="fas fa-pen"></i></button>
                    <button class="action-btn delete-btn" title="Delete task"><i class="fas fa-trash"></i></button>
                </div>
            `;

            const checkbox = li.querySelector('.task-checkbox');
            checkbox.addEventListener('click', () => {
                const nextCompleted = !task.completed;
                patchTask(
                    task.id,
                    { completed: nextCompleted, status: nextCompleted ? 'done' : 'todo' },
                    nextCompleted
                );
            });

            li.querySelector('.task-content').addEventListener('dblclick', () => openEditModal(task));
            li.querySelector('.edit-btn').addEventListener('click', () => openEditModal(task));
            li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

            // List Drag & Drop Reordering
            li.addEventListener('dragstart', () => {
                draggedTaskId = task.id;
                li.classList.add('dragging');
            });
            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
                saveListOrder();
            });

            taskList.appendChild(li);
        });
    }

    taskList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingEl = taskList.querySelector('.dragging');
        if (!draggingEl) return;
        const afterEl = getDragAfterElement(taskList, e.clientY);
        if (afterEl == null) {
            taskList.appendChild(draggingEl);
        } else {
            taskList.insertBefore(draggingEl, afterEl);
        }
    });

    function getDragAfterElement(container, y) {
        const els = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return els.reduce(
            (closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset, element: child };
                }
                return closest;
            },
            { offset: Number.NEGATIVE_INFINITY }
        ).element;
    }

    async function saveListOrder() {
        const items = [...taskList.querySelectorAll('.task-item')].map((el, idx) => ({
            id: Number(el.dataset.id),
            position: idx,
        }));
        if (items.length === 0) return;
        try {
            const response = await fetch('/api/tasks/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
            if (response.ok) {
                const data = await response.json();
                allTasks = data.tasks;
            }
        } catch (err) {
            console.error('Failed to save order:', err);
        }
    }

    // -----------------------------------------------------------------------
    // Kanban Board Rendering & Drag-and-Drop
    // -----------------------------------------------------------------------
    function renderKanban(tasks) {
        const cols = { todo: [], in_progress: [], done: [] };
        tasks.forEach((t) => {
            const st = t.status || (t.completed ? 'done' : 'todo');
            if (!cols[st]) cols.todo.push(t);
            else cols[st].push(t);
        });

        countTodo.textContent = cols.todo.length;
        countProgress.textContent = cols.in_progress.length;
        countDone.textContent = cols.done.length;

        Object.entries(cols).forEach(([statusKey, list]) => {
            const zone = document.getElementById(`kanban-${statusKey}`);
            if (!zone) return;
            zone.innerHTML = '';

            list.forEach((task) => {
                const card = document.createElement('div');
                card.className = `kanban-card ${task.completed ? 'completed' : ''}`;
                card.draggable = true;
                card.dataset.id = task.id;
                const priority = task.priority || 'medium';

                card.innerHTML = `
                    <div class="kanban-card-top">
                        <span class="kanban-card-title">${escapeHtml(task.title)}</span>
                        <div class="task-actions">
                            <button class="action-btn edit-btn" title="Edit"><i class="fas fa-pen"></i></button>
                            <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="task-meta">
                        <span class="badge badge-priority-${priority}">${priority.toUpperCase()}</span>
                        <span class="badge badge-category">${escapeHtml(task.category || 'General')}</span>
                        ${formatDueBadge(task.due_date, task.completed)}
                    </div>
                `;

                card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(task));
                card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

                card.addEventListener('dragstart', () => {
                    draggedTaskId = task.id;
                    card.classList.add('dragging');
                });
                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                });

                zone.appendChild(card);
            });
        });
    }

    kanbanDropzones.forEach((zone) => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const targetStatus = zone.dataset.status;
            if (!draggedTaskId || !targetStatus) return;

            const task = allTasks.find((t) => t.id === draggedTaskId);
            if (!task || task.status === targetStatus) return;

            const celebrate = targetStatus === 'done' && !task.completed;
            patchTask(
                draggedTaskId,
                { status: targetStatus, completed: targetStatus === 'done' },
                celebrate
            );
        });
    });

    // -----------------------------------------------------------------------
    // History Timeline Rendering
    // -----------------------------------------------------------------------
    function renderHistory() {
        historyTimeline.innerHTML = '';
        historyEmpty.classList.toggle('hidden', allHistory.length > 0);

        const iconMap = {
            created: { icon: 'fa-plus', cls: 'h-created', label: 'Created' },
            completed: { icon: 'fa-check-double', cls: 'h-completed', label: 'Completed' },
            reopened: { icon: 'fa-rotate-left', cls: 'h-reopened', label: 'Reopened' },
            moved: { icon: 'fa-arrows-left-right', cls: 'h-moved', label: 'Moved' },
            edited: { icon: 'fa-pen', cls: 'h-edited', label: 'Edited' },
            deleted: { icon: 'fa-trash-can', cls: 'h-deleted', label: 'Deleted' },
            restored: { icon: 'fa-wand-magic-sparkles', cls: 'h-restored', label: 'Restored' },
        };

        allHistory.forEach((entry) => {
            const meta = iconMap[entry.action] || iconMap.edited;
            const item = document.createElement('div');
            item.className = 'history-item';

            const showRestore = entry.action === 'deleted';
            item.innerHTML = `
                <div class="history-left">
                    <div class="history-icon ${meta.cls}">
                        <i class="fas ${meta.icon}"></i>
                    </div>
                    <div class="history-details">
                        <div class="history-title-line">
                            <span class="history-action-tag ${meta.cls}">${meta.label}</span>
                            <span>${escapeHtml(entry.task_title)}</span>
                        </div>
                        <span class="history-sub">${escapeHtml(entry.details || `${entry.category || 'General'} · ${entry.priority || 'medium'} priority`)}</span>
                    </div>
                </div>
                <div class="history-right">
                    <span class="history-time">${formatRelativeTime(entry.timestamp)}</span>
                    ${showRestore ? `<button class="restore-btn" title="Restore task to board"><i class="fas fa-rotate-left"></i> Restore</button>` : ''}
                </div>
            `;

            if (showRestore) {
                item.querySelector('.restore-btn').addEventListener('click', () => {
                    restoreFromHistory(entry.id);
                });
            }

            historyTimeline.appendChild(item);
        });
    }

    function formatRelativeTime(isoStr) {
        if (!isoStr) return 'just now';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
        if (diffSec < 60) return 'Just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // -----------------------------------------------------------------------
    // Edit Task Modal
    // -----------------------------------------------------------------------
    function openEditModal(task) {
        editIdInput.value = task.id;
        editTitleInput.value = task.title;
        editPriorityInput.value = task.priority || 'medium';
        editCategoryInput.value = task.category || 'General';
        editStatusInput.value = task.status || (task.completed ? 'done' : 'todo');
        editDueInput.value = task.due_date || '';
        editModal.classList.remove('hidden');
        editTitleInput.focus();
    }

    function closeEditModal() {
        editModal.classList.add('hidden');
    }

    closeModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = Number(editIdInput.value);
        const title = editTitleInput.value.trim();
        if (!title) return;

        const targetStatus = editStatusInput.value;
        const oldTask = allTasks.find((t) => t.id === id);
        const celebrate = targetStatus === 'done' && oldTask && !oldTask.completed;

        await patchTask(
            id,
            {
                title,
                priority: editPriorityInput.value,
                category: editCategoryInput.value,
                status: targetStatus,
                completed: targetStatus === 'done',
                due_date: editDueInput.value || null,
            },
            celebrate
        );
        closeEditModal();
        showToast('Task updated', 'fa-pen-to-square');
    });

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }
});
