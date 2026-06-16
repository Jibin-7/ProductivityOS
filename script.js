/**
 * PRODUCTIVITY OS - CORE ENGINE
 * Fully functional LocalStorage Database, Kanban, Pomodoro, and Calendar.
 */

// ==========================================
// 1. DATA STORAGE & STATE
// ==========================================
const Storage = {
    save(key, data) { localStorage.setItem(`nexus_os_${key}`, JSON.stringify(data)); },
    load(key, defaultData) { 
        const data = localStorage.getItem(`nexus_os_${key}`);
        return data ? JSON.parse(data) : defaultData;
    }
};

const AppState = {
    user: Storage.load('user', null), // Null implies first time
    tasks: Storage.load('tasks', []),
    theme: Storage.load('theme', 'dark'),
    currentTaskEditId: null,

    saveAll() {
        Storage.save('user', this.user);
        Storage.save('tasks', this.tasks);
        Storage.save('theme', this.theme);
    }
};

// ==========================================
// 2. VISUAL ENGINE (Particles)
// ==========================================
const VisualEngine = {
    canvas: document.getElementById('particle-canvas'),
    ctx: null,
    particles: [],
    mouse: { x: null, y: null, radius: 150 },

    init() {
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => { this.mouse.x = e.x; this.mouse.y = e.y; });
        window.addEventListener('mouseout', () => { this.mouse.x = null; this.mouse.y = null; });
        this.createParticles();
        this.animate();
        this.bootSequence();
    },
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },
    createParticles() {
        this.particles = [];
        const count = Math.floor((window.innerWidth * window.innerHeight) / 10000);
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
                size: Math.random() * 2 + 0.5, speedX: Math.random() * 0.5 - 0.25, speedY: Math.random() * 0.5 - 0.25
            });
        }
    },
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const colorBase = AppState.theme === 'dark' ? '0, 240, 255' : '79, 70, 229';

        this.particles.forEach(p => {
            p.x += p.speedX; p.y += p.speedY;
            if (p.x < 0 || p.x > this.canvas.width) p.speedX *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.speedY *= -1;

            if (this.mouse.x != null) {
                let dx = this.mouse.x - p.x; let dy = this.mouse.y - p.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < this.mouse.radius) {
                    const force = (this.mouse.radius - distance) / this.mouse.radius;
                    p.x -= (dx / distance) * force * 2; p.y -= (dy / distance) * force * 2;
                    this.ctx.beginPath(); this.ctx.strokeStyle = `rgba(${colorBase}, ${force * 0.2})`;
                    this.ctx.moveTo(p.x, p.y); this.ctx.lineTo(this.mouse.x, this.mouse.y); this.ctx.stroke();
                }
            }
            this.ctx.fillStyle = `rgba(${colorBase}, 0.5)`;
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); this.ctx.fill();
        });
        requestAnimationFrame(() => this.animate());
    },
    bootSequence() {
        setTimeout(() => {
            document.getElementById('intro-screen').classList.remove('active');
            setTimeout(() => {
                // Check User
                if (!AppState.user) {
                    document.getElementById('name-prompt-modal').classList.remove('hidden');
                } else {
                    document.getElementById('app-container').classList.remove('hidden');
                    UIController.initUserContext();
                }
            }, 800);
        }, 2500);
    }
};

// ==========================================
// 3. TASK ENGINE (CRUD & Kanban)
// ==========================================
const TaskEngine = {
    init() {
        this.renderKanban();
        this.setupDragAndDrop();
        this.setupForm();
    },

    saveTask(data) {
        if (AppState.currentTaskEditId) {
            const idx = AppState.tasks.findIndex(t => t.id === AppState.currentTaskEditId);
            AppState.tasks[idx] = { ...AppState.tasks[idx], ...data };
            UIController.showToast('Task Updated successfully');
        } else {
            AppState.tasks.push({
                id: `task_${Date.now()}`,
                createdAt: new Date().toISOString(),
                status: 'todo',
                ...data
            });
            UIController.showToast('Task Created successfully');
        }
        AppState.saveAll();
        this.renderKanban();
    },

    deleteTask(id) {
        AppState.tasks = AppState.tasks.filter(t => t.id !== id);
        AppState.saveAll();
        this.renderKanban();
        UIController.showToast('Task Deleted');
    },

    changeStatus(id, newStatus) {
        const task = AppState.tasks.find(t => t.id === id);
        if (task && task.status !== newStatus) {
            task.status = newStatus;
            if (newStatus === 'completed') {
                AppState.user.xp += 50;
                UIController.showToast('Task Completed! +50 XP');
            }
            AppState.saveAll();
            this.renderKanban();
        }
    },

    renderKanban() {
        const lists = {
            todo: document.getElementById('list-todo'),
            inprogress: document.getElementById('list-inprogress'),
            completed: document.getElementById('list-completed')
        };

        // Clear UI
        Object.values(lists).forEach(list => list.innerHTML = '');

        const counts = { todo: 0, inprogress: 0, completed: 0 };
        const catCounts = { All: AppState.tasks.length, Work: 0, Personal: 0, Health: 0 };
        const today = new Date().setHours(0,0,0,0);

        AppState.tasks.forEach(task => {
            counts[task.status]++;
            if(catCounts[task.category] !== undefined) catCounts[task.category]++;
            
            const isOverdue = task.date && task.status !== 'completed' && new Date(task.date).setHours(0,0,0,0) < today;

            const card = document.createElement('div');
            card.className = `task-card ${task.status === 'completed' ? 'completed' : ''}`;
            card.draggable = true;
            card.dataset.id = task.id;
            card.dataset.priority = task.priority;

            card.innerHTML = `
                <div class="task-header">
                    <h4 class="task-title">${task.title}</h4>
                    <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
                </div>
                ${task.desc ? `<p class="task-desc">${task.desc}</p>` : ''}
                <div class="task-meta">
                    <div class="task-badges">
                        <span class="badge cat-${task.category.toLowerCase()}">${task.category}</span>
                    </div>
                    ${task.date ? `<div class="task-date ${isOverdue ? 'overdue' : ''}"><i class="ph ph-calendar"></i> ${new Date(task.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</div>` : ''}
                </div>
            `;

            // Events
            card.querySelector('.task-checkbox').addEventListener('change', e => this.changeStatus(task.id, e.target.checked ? 'completed' : 'todo'));
            card.addEventListener('contextmenu', e => {
                e.preventDefault();
                UIController.showContextMenu(e, task.id);
            });

            lists[task.status].appendChild(card);
        });

        // Handle Empty States
        Object.entries(lists).forEach(([key, element]) => {
            if (counts[key] === 0) {
                element.innerHTML = `
                    <div class="empty-state">
                        <i class="ph ph-wind"></i>
                        <p>No tasks here</p>
                    </div>`;
            }
        });

        // Update Labels
        document.getElementById('count-todo').textContent = counts.todo;
        document.getElementById('count-inprogress').textContent = counts.inprogress;
        document.getElementById('count-completed').textContent = counts.completed;
        
        document.getElementById('count-all-cat').textContent = catCounts.All;
        document.getElementById('count-work-cat').textContent = catCounts.Work;
        document.getElementById('count-personal-cat').textContent = catCounts.Personal;
        document.getElementById('count-health-cat').textContent = catCounts.Health;

        UIController.updateMetrics();
        CalendarEngine.render();
        FocusEngine.updateTaskSelect();
    },

    setupDragAndDrop() {
        let draggedItem = null;
        document.querySelectorAll('.kanban-list').forEach(list => {
            list.addEventListener('dragstart', e => {
                if(e.target.classList.contains('task-card')) {
                    draggedItem = e.target;
                    setTimeout(() => draggedItem.classList.add('dragging'), 0);
                    e.dataTransfer.setData('text/plain', draggedItem.dataset.id);
                }
            });
            list.addEventListener('dragend', () => draggedItem && draggedItem.classList.remove('dragging'));
            list.addEventListener('dragover', e => e.preventDefault());
            list.addEventListener('drop', e => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                const newStatus = list.parentElement.dataset.status;
                if (id && newStatus) this.changeStatus(id, newStatus);
            });
        });
    },

    setupForm() {
        document.getElementById('task-form').addEventListener('submit', e => {
            e.preventDefault();
            this.saveTask({
                title: document.getElementById('task-title').value,
                desc: document.getElementById('task-desc').value,
                date: document.getElementById('task-date').value,
                time: document.getElementById('task-time').value,
                category: document.getElementById('task-category').value,
                priority: document.querySelector('input[name="priority"]:checked').value
            });
            UIController.closeModal();
        });
    }
};

// ==========================================
// 4. CALENDAR ENGINE
// ==========================================
const CalendarEngine = {
    currentDate: new Date(),
    
    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        document.getElementById('calendar-month-year').textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const grid = document.getElementById('calendar-days');
        grid.innerHTML = '';
        
        // Blank days
        for(let i=0; i<firstDay; i++) {
            grid.innerHTML += `<div class="cal-day empty"></div>`;
        }

        // Real days
        const todayStr = new Date().toDateString();
        for(let day=1; day<=daysInMonth; day++) {
            const thisDate = new Date(year, month, day);
            const isToday = thisDate.toDateString() === todayStr;
            
            // Find tasks for this day
            const dayTasks = AppState.tasks.filter(t => t.date && new Date(t.date).toDateString() === thisDate.toDateString());
            
            let dots = '';
            dayTasks.forEach(t => {
                let color = 'var(--text-muted)';
                if(t.status !== 'completed') {
                    if(t.priority === 'critical') color = 'var(--critical)';
                    else if (t.priority === 'high') color = 'var(--high)';
                    else color = 'var(--primary)';
                }
                dots += `<div class="cal-dot" style="background:${color}"></div>`;
            });

            grid.innerHTML += `
                <div class="cal-day ${isToday ? 'today' : ''}">
                    <span>${day}</span>
                    <div class="cal-task-dots">${dots}</div>
                </div>`;
        }
    },
    
    setup() {
        document.getElementById('cal-prev').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.render();
        });
        document.getElementById('cal-next').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.render();
        });
        document.getElementById('cal-today').addEventListener('click', () => {
            this.currentDate = new Date();
            this.render();
        });
    }
};

// ==========================================
// 5. FOCUS (POMODORO) ENGINE
// ==========================================
const FocusEngine = {
    timeLeft: 25 * 60,
    timerId: null,
    
    init() {
        document.getElementById('timer-start').addEventListener('click', () => this.start());
        document.getElementById('timer-pause').addEventListener('click', () => {
            clearInterval(this.timerId);
            document.getElementById('timer-start').classList.remove('hidden');
            document.getElementById('timer-pause').classList.add('hidden');
        });
        document.getElementById('timer-reset').addEventListener('click', () => {
            clearInterval(this.timerId);
            this.timeLeft = 25 * 60;
            this.updateUI();
            document.getElementById('timer-start').classList.remove('hidden');
            document.getElementById('timer-pause').classList.add('hidden');
        });
    },
    
    start() {
        document.getElementById('timer-start').classList.add('hidden');
        document.getElementById('timer-pause').classList.remove('hidden');
        this.timerId = setInterval(() => {
            this.timeLeft--;
            this.updateUI();
            if(this.timeLeft <= 0) {
                clearInterval(this.timerId);
                UIController.showToast("Focus session complete!");
                AppState.user.xp += 30;
                AppState.saveAll();
                UIController.updateMetrics();
            }
        }, 1000);
    },
    
    updateUI() {
        const m = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
        const s = (this.timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('time-left').textContent = `${m}:${s}`;
        
        const prog = this.timeLeft / (25 * 60);
        document.getElementById('timer-progress').style.strokeDashoffset = 879.6 - (prog * 879.6);
    },

    updateTaskSelect() {
        const select = document.getElementById('focus-task-select');
        select.innerHTML = '<option value="">Select a task to focus on...</option>';
        AppState.tasks.filter(t => t.status !== 'completed').forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.title}</option>`;
        });
    }
};

// ==========================================
// 6. UI/UX CONTROLLERS
// ==========================================
const UIController = {
    init() {
        this.applyTheme(AppState.theme);
        this.setupNavigation();
        this.setupModals();
        this.setupContextMenu();

        // Theme
        document.getElementById('theme-toggle').addEventListener('click', () => {
            AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
            this.applyTheme(AppState.theme);
            AppState.saveAll();
        });

        // Name Form
        document.getElementById('name-form').addEventListener('submit', (e) => {
            e.preventDefault();
            AppState.user = { 
                name: document.getElementById('user-name-input').value || 'Guest',
                xp: 0, level: 1, streak: 1, lastLogin: new Date().toDateString()
            };
            AppState.saveAll();
            document.getElementById('name-prompt-modal').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            this.initUserContext();
        });

        // Clear Data
        document.getElementById('clear-all-btn').addEventListener('click', () => {
            if(confirm("Are you sure? This will delete all tasks permanently.")) {
                AppState.tasks = [];
                AppState.saveAll();
                TaskEngine.renderKanban();
            }
        });
    },

    initUserContext() {
        document.getElementById('display-name').textContent = AppState.user.name;
        document.getElementById('avatar-img').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${AppState.user.name}&backgroundColor=transparent`;
        
        // Time based greeting
        const hour = new Date().getHours();
        let greeting = "Good evening";
        if(hour < 12) greeting = "Good morning";
        else if(hour < 18) greeting = "Good afternoon";
        document.getElementById('greeting-text').textContent = `${greeting}, ${AppState.user.name.split(' ')[0]}.`;

        // Date
        document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});

        // Streak check
        const todayStr = new Date().toDateString();
        if (AppState.user.lastLogin !== todayStr) {
            AppState.user.streak++;
            AppState.user.lastLogin = todayStr;
            AppState.saveAll();
        }
        document.getElementById('streak-count').textContent = AppState.user.streak;

        this.updateMetrics();
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelector('#theme-toggle i').className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.main-nav .nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
                item.classList.add('active');
                document.getElementById(item.dataset.target).classList.add('active');
            });
        });
        document.getElementById('exit-focus-btn').addEventListener('click', () => document.querySelector('[data-target="dashboard-view"]').click());
    },

    setupModals() {
        const modal = document.getElementById('task-modal');
        const openModal = (id = null) => {
            AppState.currentTaskEditId = id;
            document.getElementById('modal-title').textContent = id ? 'Edit Task' : 'Create New Task';
            if (id) {
                const t = AppState.tasks.find(x => x.id === id);
                document.getElementById('task-title').value = t.title;
                document.getElementById('task-desc').value = t.desc || '';
                document.getElementById('task-date').value = t.date || '';
                document.getElementById('task-time').value = t.time || '';
                document.getElementById('task-category').value = t.category;
                document.querySelector(`input[name="priority"][value="${t.priority}"]`).checked = true;
            } else {
                document.getElementById('task-form').reset();
            }
            modal.classList.remove('hidden');
        };

        this.closeModal = () => modal.classList.add('hidden');
        this.openModalForEdit = openModal;

        document.getElementById('main-add-task-btn').addEventListener('click', () => openModal());
        document.getElementById('close-modal-btn').addEventListener('click', this.closeModal);
        document.getElementById('cancel-task-btn').addEventListener('click', this.closeModal);
    },

    setupContextMenu() {
        const ctxMenu = document.getElementById('custom-context-menu');
        let currentId = null;

        this.showContextMenu = (e, id) => {
            currentId = id;
            ctxMenu.style.left = `${e.pageX}px`;
            ctxMenu.style.top = `${e.pageY}px`;
            ctxMenu.classList.remove('hidden');
        };

        document.addEventListener('click', () => ctxMenu.classList.add('hidden'));

        document.getElementById('ctx-edit').addEventListener('click', () => currentId && this.openModalForEdit(currentId));
        document.getElementById('ctx-delete').addEventListener('click', () => currentId && TaskEngine.deleteTask(currentId));
        document.getElementById('ctx-focus').addEventListener('click', () => {
            if (currentId) {
                document.querySelector('[data-target="focus-view"]').click();
                document.getElementById('focus-task-select').value = currentId;
            }
        });
    },

    updateMetrics() {
        const total = AppState.tasks.length;
        const comp = AppState.tasks.filter(t => t.status === 'completed').length;
        const pending = total - comp;
        
        const today = new Date().setHours(0,0,0,0);
        const overdue = AppState.tasks.filter(t => t.date && t.status !== 'completed' && new Date(t.date).setHours(0,0,0,0) < today).length;
        const score = total === 0 ? 0 : Math.round((comp / total) * 100);

        document.getElementById('stat-total').textContent = total;
        document.getElementById('metric-pending').textContent = pending;
        document.getElementById('metric-completed').textContent = comp;
        document.getElementById('metric-overdue').textContent = overdue;
        document.getElementById('metric-score').textContent = `${score}%`;

        // Update Gamification
        if(AppState.user) {
            const xpNeeded = AppState.user.level * 500;
            document.getElementById('user-level').textContent = AppState.user.level;
            document.getElementById('xp-progress').style.width = `${(AppState.user.xp / xpNeeded) * 100}%`;
            document.getElementById('xp-needed').textContent = xpNeeded - AppState.user.xp;
        }

        // Dynamic Insight
        const insightText = document.getElementById('ai-insight-text');
        if (overdue > 0) insightText.innerHTML = `Action Required: You have <strong>${overdue} overdue</strong> tasks to clear.`;
        else if (pending > 0) insightText.innerHTML = `You have <strong>${pending} active tasks</strong>. Stay focused!`;
        else insightText.innerHTML = `Your queue is empty. Enjoy your day!`;
    },

    showToast(message) {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `<i class="ph-fill ph-check-circle" style="color: var(--primary); margin-right:8px;"></i> ${message}`;
        container.appendChild(t);
        setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(), 300); }, 3000);
    }
};

// BOOTSTRAP
document.addEventListener('DOMContentLoaded', () => {
    VisualEngine.init();
    UIController.init();
    TaskEngine.init();
    CalendarEngine.setup();
    FocusEngine.init();
});