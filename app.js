/**
 * Pomodoro Timer Application
 * Clean, minimal productivity timer with task tracking
 */
(function() {
  'use strict';

  // ==========================================================================
  // Constants
  // ==========================================================================
  const DEFAULT_DURATIONS = { work: 25, shortBreak: 5, longBreak: 15 };
  const SESSION_TYPES = { WORK: 'work', SHORT_BREAK: 'short-break', LONG_BREAK: 'long-break' };
  const STORAGE_KEYS = {
    THEME: 'pomodoro-theme',
    SOUND: 'pomodoro-sound',
    NOTIFICATIONS: 'pomodoro-notifications',
    FLASH: 'pomodoro-flash',
    DURATIONS: 'pomodoro-durations',
    TASKS: 'pomodoro-tasks',
    SESSIONS: 'pomodoro-sessions',
    ACTIVE_TASK: 'pomodoro-active-task'
  };
  const PROGRESS_CIRCUMFERENCE = 565.48;

  // ==========================================================================
  // State
  // ==========================================================================
  let state = {
    isRunning: false,
    isPaused: false,
    sessionType: SESSION_TYPES.WORK,
    sessionCount: 1,
    totalDuration: DEFAULT_DURATIONS.work * 60 * 1000,
    remainingTime: DEFAULT_DURATIONS.work * 60 * 1000,
    startTime: null,
    pausedTime: null,
    timerInterval: null,
    durations: { ...DEFAULT_DURATIONS },
    soundEnabled: true,
    notificationsEnabled: false,
    flashEnabled: true,
    theme: 'dark',
    focusMode: false,
    tasks: [],
    activeTaskId: null,
    sessions: [],
    audioContext: null,
    helpTyped: '',
    touchStartX: null,
    touchStartY: null
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let el = {};

  function cacheElements() {
    el = {
      timerTime: $('#timer-time'),
      timerLabel: $('#timer-label'),
      timerSession: $('#timer-session'),
      timerContainer: $('#timer-container'),
      progressRing: $('.progress-ring-progress'),
      sessionDots: $$('.session-dot'),
      startBtn: $('#start-btn'),
      skipBtn: $('#skip-btn'),
      resetBtn: $('#reset-btn'),
      stopBtn: $('#stop-btn'),
      customizeBtn: $('#customize-btn'),
      themeToggle: $('#theme-toggle'),
      soundToggle: $('#sound-toggle'),
      taskForm: $('#add-task-form'),
      taskInput: $('#task-input'),
      taskList: $('#task-list'),
      taskCount: $('#task-count'),
      statSessionsToday: $('#stat-sessions-today'),
      statFocusToday: $('#stat-focus-today'),
      statStreak: $('#stat-streak'),
      statSessionsTotal: $('#stat-sessions-total'),
      statsSection: $('#stats-section'),
      historySection: $('#history-section'),
      historyToggle: $('#history-toggle'),
      historyContent: $('#history-content'),
      historyList: $('#history-list'),
      historyEmpty: $('#history-empty'),
      customizeModal: $('#customize-modal'),
      customizeClose: $('#customize-close'),
      customizeSave: $('#customize-save'),
      customizeReset: $('#customize-reset'),
      workDuration: $('#work-duration'),
      shortBreakDuration: $('#short-break-duration'),
      longBreakDuration: $('#long-break-duration'),
      settingSound: $('#setting-sound'),
      settingNotifications: $('#setting-notifications'),
      settingFlash: $('#setting-flash'),
      clearHistoryBtn: $('#clear-history-btn'),
      helpModal: $('#help-modal'),
      helpClose: $('#help-close'),
      toastContainer: $('#toast-container'),
      bottomSheetOverlay: $('#bottom-sheet-overlay'),
      bottomSheet: $('#bottom-sheet'),
      bottomSheetClose: $('#bottom-sheet-close'),
      bottomSheetContent: $('#bottom-sheet-content'),
      mobileTaskBtn: $('#mobile-task-btn'),
      focusToggle: $('#focus-toggle'),
      focusTasks: $('#focus-tasks'),
      focusTaskList: $('#focus-task-list'),
      iconPlay: $('.icon-play'),
      iconPause: $('.icon-pause')
    };
  }

  // ==========================================================================
  // Storage
  // ==========================================================================
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        showToast('Storage full');
      }
    }
  }

  function load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  // ==========================================================================
  // Theme
  // ==========================================================================
  function initTheme() {
    const saved = load(STORAGE_KEYS.THEME);
    if (saved) {
      state.theme = saved;
    } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      state.theme = 'light';
    }
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const moonIcon = el.themeToggle.querySelector('.icon-moon');
    const sunIcon = el.themeToggle.querySelector('.icon-sun');

    moonIcon.style.display = state.theme === 'dark' ? 'block' : 'none';
    sunIcon.style.display = state.theme === 'light' ? 'block' : 'none';
  }

  function cycleTheme() {
    const themes = ['dark', 'light'];
    const idx = themes.indexOf(state.theme);
    state.theme = themes[(idx + 1) % themes.length];
    applyTheme();
    save(STORAGE_KEYS.THEME, state.theme);
    playSound('click');
    showToast(`${state.theme} theme`);
  }

  // ==========================================================================
  // Focus Mode
  // ==========================================================================
  function toggleFocusMode() {
    state.focusMode = !state.focusMode;
    document.body.classList.toggle('focus-mode', state.focusMode);
    if (state.focusMode) {
      renderFocusTasks();
    }
    playSound('click');
    showToast(state.focusMode ? 'Focus mode' : 'Normal mode');
  }

  function renderFocusTasks() {
    if (!el.focusTaskList) return;
    el.focusTaskList.innerHTML = '';

    const incompleteTasks = state.tasks.filter(t => !t.completed);

    if (incompleteTasks.length === 0) {
      el.focusTaskList.innerHTML = '<li class="empty-state" style="padding: var(--space-3); text-align: center; color: var(--text-muted); font-size: var(--text-sm);">No tasks</li>';
      return;
    }

    incompleteTasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `focus-task-item${task.completed ? ' completed' : ''}`;
      li.innerHTML = `
        <button class="task-checkbox${task.completed ? ' checked' : ''}" aria-label="Toggle complete"></button>
        <span class="task-text">${escapeHtml(task.text)}</span>
      `;

      li.addEventListener('click', () => {
        toggleTaskComplete(task.id);
        renderFocusTasks();
      });

      el.focusTaskList.appendChild(li);
    });
  }

  function updatePlayPauseIcon() {
    if (!el.iconPlay || !el.iconPause) return;
    el.iconPlay.style.display = state.isRunning ? 'none' : 'block';
    el.iconPause.style.display = state.isRunning ? 'block' : 'none';
  }

  // ==========================================================================
  // Sound
  // ==========================================================================
  function initAudio() {
    state.soundEnabled = load(STORAGE_KEYS.SOUND, true);
    updateSoundIcon();
  }

  function getAudioContext() {
    if (!state.audioContext) {
      try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        state.soundEnabled = false;
      }
    }
    return state.audioContext;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const sounds = {
      start: () => playChime(ctx, now, [440, 550, 660], 0.12),
      pause: () => playTone(ctx, now, 300, 'triangle', 0.08),
      complete: () => playChime(ctx, now, [523, 659, 784, 1047], 0.15),
      check: () => playTone(ctx, now, 880, 'sine', 0.08),
      uncheck: () => playTone(ctx, now, 440, 'sine', 0.06),
      click: () => playTone(ctx, now, 600, 'square', 0.02),
      skip: () => playSwoosh(ctx, now),
      tick: () => playTone(ctx, now, 800, 'sine', 0.02),
      delete: () => playTone(ctx, now, 200, 'triangle', 0.08)
    };
    sounds[type]?.();
  }

  function playTone(ctx, start, freq, wave, dur, vol = 0.1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur);
  }

  function playChime(ctx, start, freqs, dur) {
    freqs.forEach((f, i) => playTone(ctx, start + i * dur * 0.4, f, 'sine', dur, 0.08));
  }

  function playSwoosh(ctx, start) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, start);
    osc.frequency.exponentialRampToValueAtTime(800, start + 0.08);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.08);
  }

  function updateSoundIcon() {
    const onIcon = el.soundToggle.querySelector('.icon-sound-on');
    const offIcon = el.soundToggle.querySelector('.icon-sound-off');
    onIcon.style.display = state.soundEnabled ? 'block' : 'none';
    offIcon.style.display = state.soundEnabled ? 'none' : 'block';
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    save(STORAGE_KEYS.SOUND, state.soundEnabled);
    updateSoundIcon();
    if (state.soundEnabled) playSound('click');
    showToast(state.soundEnabled ? 'Sound on' : 'Sound off');
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================
  function initNotifications() {
    state.notificationsEnabled = load(STORAGE_KEYS.NOTIFICATIONS, false);
    state.flashEnabled = load(STORAGE_KEYS.FLASH, true);
  }

  async function toggleNotifications() {
    if (!state.notificationsEnabled) {
      if (!('Notification' in window)) {
        showToast('Not supported');
        return;
      }
      if (Notification.permission === 'denied') {
        showToast('Blocked in browser');
        return;
      }
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          showToast('Permission denied');
          return;
        }
      }
      state.notificationsEnabled = true;
    } else {
      state.notificationsEnabled = false;
    }
    save(STORAGE_KEYS.NOTIFICATIONS, state.notificationsEnabled);
    showToast(state.notificationsEnabled ? 'Notifications on' : 'Notifications off');
  }

  function sendNotification(title, body) {
    if (state.notificationsEnabled && Notification.permission === 'granted') {
      try { new Notification(title, { body, tag: 'pomodoro' }); } catch {}
    }
  }

  function showFlash(type) {
    if (!state.flashEnabled) return;
    const flash = document.createElement('div');
    flash.className = `screen-flash ${type}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
  }

  // ==========================================================================
  // Timer
  // ==========================================================================
  function initTimer() {
    state.durations = load(STORAGE_KEYS.DURATIONS, DEFAULT_DURATIONS);
    resetTimerDisplay();
    updateTimerDisplay();
    updateSessionCalendar();
  }

  function getDuration(type) {
    const map = {
      [SESSION_TYPES.WORK]: state.durations.work,
      [SESSION_TYPES.SHORT_BREAK]: state.durations.shortBreak,
      [SESSION_TYPES.LONG_BREAK]: state.durations.longBreak
    };
    return map[type] || state.durations.work;
  }

  function resetTimerDisplay() {
    const dur = getDuration(state.sessionType);
    state.totalDuration = dur * 60 * 1000;
    state.remainingTime = state.totalDuration;
  }

  function formatTime(ms) {
    const secs = Math.ceil(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    el.timerTime.textContent = formatTime(state.remainingTime);

    const labels = {
      [SESSION_TYPES.WORK]: 'Work',
      [SESSION_TYPES.SHORT_BREAK]: 'Short Break',
      [SESSION_TYPES.LONG_BREAK]: 'Long Break'
    };
    el.timerLabel.textContent = labels[state.sessionType];
    el.timerSession.textContent = `Session ${state.sessionCount} of 4`;

    const progress = 1 - (state.remainingTime / state.totalDuration);
    el.progressRing.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE * (1 - progress);
    el.timerContainer.setAttribute('data-type', state.sessionType);

    el.timerTime.classList.toggle('pulsing', state.remainingTime <= 10000 && state.isRunning);
  }

  function updateSessionCalendar() {
    el.sessionDots.forEach((dot, i) => {
      const num = i + 1;
      dot.classList.remove('completed', 'current', 'break');

      if (state.sessionType === SESSION_TYPES.WORK) {
        if (num < state.sessionCount) dot.classList.add('completed');
        else if (num === state.sessionCount) dot.classList.add('current');
      } else {
        if (num <= state.sessionCount - 1) dot.classList.add('completed');
        else if (num === state.sessionCount) dot.classList.add('break');
      }
    });
  }

  function startTimer() {
    if (state.isRunning) {
      pauseTimer();
      return;
    }

    getAudioContext();
    state.isRunning = true;
    state.isPaused = false;

    if (state.pausedTime) {
      state.startTime = performance.now() - (state.totalDuration - state.remainingTime);
    } else {
      state.startTime = performance.now();
      playSound('start');
      showToast(`${state.sessionType === SESSION_TYPES.WORK ? 'Work' : 'Break'} started`);
    }

    state.pausedTime = null;
    updatePlayPauseIcon();

    function tick(now) {
      if (!state.isRunning) return;

      const elapsed = now - state.startTime;
      state.remainingTime = Math.max(0, state.totalDuration - elapsed);

      if (state.remainingTime <= 10000 && state.remainingTime > 0) {
        const curr = Math.ceil(state.remainingTime / 1000);
        const last = Math.ceil((state.remainingTime + 100) / 1000);
        if (curr !== last && curr <= 10) playSound('tick');
      }

      updateTimerDisplay();

      if (state.remainingTime <= 0) {
        completeSession();
        return;
      }

      state.timerInterval = requestAnimationFrame(tick);
    }

    state.timerInterval = requestAnimationFrame(tick);
  }

  function pauseTimer() {
    if (!state.isRunning) return;
    state.isRunning = false;
    state.isPaused = true;
    state.pausedTime = performance.now();
    cancelAnimationFrame(state.timerInterval);
    updatePlayPauseIcon();
    playSound('pause');
    showToast('Paused');
  }

  function resetTimer() {
    state.isRunning = false;
    state.isPaused = false;
    state.pausedTime = null;
    cancelAnimationFrame(state.timerInterval);
    resetTimerDisplay();
    updateTimerDisplay();
    updatePlayPauseIcon();
    playSound('click');
    showToast('Reset');
  }

  function skipSession() {
    playSound('skip');
    moveToNextSession();
    showToast('Skipped');
  }

  function stopTimer() {
    state.isRunning = false;
    state.isPaused = false;
    state.pausedTime = null;
    state.sessionType = SESSION_TYPES.WORK;
    state.sessionCount = 1;
    cancelAnimationFrame(state.timerInterval);
    resetTimerDisplay();
    updateTimerDisplay();
    updateSessionCalendar();
    updatePlayPauseIcon();
    playSound('click');
    showToast('Stopped');
  }

  function completeSession() {
    state.isRunning = false;
    cancelAnimationFrame(state.timerInterval);
    recordSession();
    playSound('complete');
    showFlash(state.sessionType === SESSION_TYPES.WORK ? 'work' : 'break');

    const isWork = state.sessionType === SESSION_TYPES.WORK;
    const msg = isWork ? 'Work done! Break time.' : 'Break over!';
    sendNotification('Pomodoro', msg);
    showToast(msg);

    moveToNextSession();

    if (state.sessionType !== SESSION_TYPES.WORK) {
      setTimeout(startTimer, 1000);
    }

    updatePlayPauseIcon();
    updateStats();
  }

  function moveToNextSession() {
    state.isRunning = false;
    state.isPaused = false;
    state.pausedTime = null;
    cancelAnimationFrame(state.timerInterval);

    if (state.sessionType === SESSION_TYPES.WORK) {
      state.sessionType = state.sessionCount >= 4 ? SESSION_TYPES.LONG_BREAK : SESSION_TYPES.SHORT_BREAK;
    } else {
      if (state.sessionType === SESSION_TYPES.LONG_BREAK) {
        state.sessionCount = 1;
      } else {
        state.sessionCount++;
      }
      state.sessionType = SESSION_TYPES.WORK;
    }

    resetTimerDisplay();
    updateTimerDisplay();
    updateSessionCalendar();
    updatePlayPauseIcon();
  }

  function handleVisibilityChange() {
    if (document.hidden && state.isRunning) {
      state.hiddenTime = performance.now();
    } else if (!document.hidden && state.isRunning && state.hiddenTime) {
      state.startTime += performance.now() - state.hiddenTime;
      state.hiddenTime = null;
    }
  }

  // ==========================================================================
  // Tasks
  // ==========================================================================
  function initTasks() {
    state.tasks = load(STORAGE_KEYS.TASKS, []);
    state.activeTaskId = load(STORAGE_KEYS.ACTIVE_TASK, null);
    renderTasks();
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 100) {
      showToast(trimmed ? 'Too long' : 'Enter a task');
      return false;
    }

    state.tasks.unshift({
      id: generateId(),
      text: trimmed,
      completed: false,
      sessionsSpent: 0,
      createdAt: new Date().toISOString()
    });

    saveTasks();
    renderTasks();
    playSound('check');
    showToast('Task added');
    return true;
  }

  function toggleTaskComplete(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
    updateStats();
    playSound(task.completed ? 'check' : 'uncheck');
  }

  function editTask(id, newText) {
    const trimmed = newText.trim();
    if (!trimmed || trimmed.length > 100) {
      showToast(trimmed ? 'Too long' : 'Cannot be empty');
      return false;
    }
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      task.text = trimmed;
      saveTasks();
      renderTasks();
      showToast('Updated');
    }
    return true;
  }

  function deleteTask(id) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx > -1) {
      state.tasks.splice(idx, 1);
      if (state.activeTaskId === id) {
        state.activeTaskId = null;
        save(STORAGE_KEYS.ACTIVE_TASK, null);
      }
      saveTasks();
      renderTasks();
      updateStats();
      playSound('delete');
      showToast('Deleted');
    }
  }

  function selectTask(id) {
    if (state.isRunning) {
      showToast('Stop timer first');
      return;
    }
    state.activeTaskId = state.activeTaskId === id ? null : id;
    save(STORAGE_KEYS.ACTIVE_TASK, state.activeTaskId);
    renderTasks();
  }

  function saveTasks() {
    save(STORAGE_KEYS.TASKS, state.tasks);
  }

  function renderTasks() {
    el.taskList.innerHTML = '';
    el.taskCount.textContent = state.tasks.length;

    if (state.tasks.length === 0) {
      el.taskList.innerHTML = '<li class="empty-state">No tasks yet</li>';
      updateMobileTaskList();
      return;
    }

    state.tasks.forEach((task, idx) => {
      const li = document.createElement('li');
      li.className = `task-item${task.completed ? ' completed' : ''}${task.id === state.activeTaskId ? ' active' : ''}`;
      li.dataset.taskId = task.id;

      li.innerHTML = `
        <button class="task-checkbox${task.completed ? ' checked' : ''}" data-action="toggle" aria-label="Toggle complete"></button>
        <span class="task-text" data-action="select">${escapeHtml(task.text)}</span>
        ${task.sessionsSpent > 0 ? `<span class="task-sessions">${task.sessionsSpent}</span>` : ''}
        <div class="task-actions">
          <button class="task-action-btn" data-action="edit" aria-label="Edit">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="task-action-btn delete" data-action="delete" aria-label="Delete">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      `;

      li.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'toggle') toggleTaskComplete(task.id);
        else if (action === 'select') selectTask(task.id);
        else if (action === 'edit') startEditTask(li, task);
        else if (action === 'delete') deleteTask(task.id);
      });

      li.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('task-text')) startEditTask(li, task);
      });

      el.taskList.appendChild(li);
    });

    updateMobileTaskList();
    if (state.focusMode) renderFocusTasks();
  }

  function startEditTask(li, task) {
    const textSpan = li.querySelector('.task-text');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = task.text;
    input.maxLength = 100;
    textSpan.replaceWith(input);
    input.focus();
    input.select();

    const save = () => {
      if (input.value.trim() && input.value !== task.text) {
        editTask(task.id, input.value);
      } else {
        renderTasks();
      }
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      else if (e.key === 'Escape') {
        input.removeEventListener('blur', save);
        renderTasks();
      }
    });
  }

  // ==========================================================================
  // Sessions
  // ==========================================================================
  function initSessions() {
    state.sessions = load(STORAGE_KEYS.SESSIONS, []);
    renderHistory();
    updateStats();
  }

  function recordSession() {
    const session = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      startTime: new Date(Date.now() - state.totalDuration).toISOString(),
      endTime: new Date().toISOString(),
      duration: state.totalDuration / 60000,
      type: state.sessionType,
      taskId: state.sessionType === SESSION_TYPES.WORK ? state.activeTaskId : null,
      taskName: state.sessionType === SESSION_TYPES.WORK && state.activeTaskId
        ? state.tasks.find(t => t.id === state.activeTaskId)?.text || null
        : null
    };

    state.sessions.unshift(session);
    save(STORAGE_KEYS.SESSIONS, state.sessions);

    if (session.taskId && session.type === SESSION_TYPES.WORK) {
      const task = state.tasks.find(t => t.id === session.taskId);
      if (task) {
        task.sessionsSpent++;
        saveTasks();
        renderTasks();
      }
    }

    renderHistory();
  }

  function renderHistory() {
    el.historyList.innerHTML = '';

    if (state.sessions.length === 0) {
      el.historyEmpty.style.display = 'block';
      return;
    }

    el.historyEmpty.style.display = 'none';

    const grouped = {};
    state.sessions.forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });

    Object.keys(grouped).forEach(date => {
      const group = document.createElement('div');
      group.className = 'history-date-group';
      group.innerHTML = `<div class="history-date">${formatDateLabel(date)}</div>`;

      grouped[date].forEach(s => {
        const item = document.createElement('li');
        item.className = 'history-item';
        const time = new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const typeClass = s.type === SESSION_TYPES.WORK ? 'work' : 'break';
        const typeName = s.type === SESSION_TYPES.WORK ? 'Work' : 'Break';

        item.innerHTML = `
          <div class="history-type ${typeClass}"></div>
          <span class="history-time">${time}</span>
          <span class="history-duration">${Math.round(s.duration)}m ${typeName}</span>
          ${s.taskName ? `<span class="history-task">${escapeHtml(s.taskName)}</span>` : ''}
        `;
        group.appendChild(item);
      });

      el.historyList.appendChild(group);
    });
  }

  function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function toggleHistory() {
    const expanded = el.historyToggle.getAttribute('aria-expanded') === 'true';
    el.historyToggle.setAttribute('aria-expanded', !expanded);
    el.historyContent.classList.toggle('collapsed', expanded);
  }

  function clearHistory() {
    if (confirm('Clear all session history?')) {
      state.sessions = [];
      save(STORAGE_KEYS.SESSIONS, []);
      renderHistory();
      updateStats();
      showToast('History cleared');
    }
  }

  // ==========================================================================
  // Stats
  // ==========================================================================
  function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const workSessions = state.sessions.filter(s => s.type === SESSION_TYPES.WORK);

    const todaySessions = workSessions.filter(s => s.date === today);
    el.statSessionsToday.textContent = todaySessions.length;

    const focusToday = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    el.statFocusToday.textContent = `${Math.round(focusToday)}m`;

    el.statSessionsTotal.textContent = workSessions.length;
    el.statStreak.textContent = calculateStreak();
  }

  function calculateStreak() {
    const workSessions = state.sessions.filter(s => s.type === SESSION_TYPES.WORK);
    if (workSessions.length === 0) return 0;

    const dates = [...new Set(workSessions.map(s => s.date))].sort().reverse();
    if (dates.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 1;
    let current = new Date(dates[0]);

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(current);
      prev.setDate(prev.getDate() - 1);
      if (dates[i] === prev.toISOString().split('T')[0]) {
        streak++;
        current = prev;
      } else break;
    }

    return streak;
  }

  // ==========================================================================
  // Settings Modal
  // ==========================================================================
  function openSettings() {
    el.workDuration.value = state.durations.work;
    el.shortBreakDuration.value = state.durations.shortBreak;
    el.longBreakDuration.value = state.durations.longBreak;

    el.settingSound.setAttribute('aria-checked', state.soundEnabled);
    el.settingNotifications.setAttribute('aria-checked', state.notificationsEnabled);
    el.settingFlash.setAttribute('aria-checked', state.flashEnabled);

    showModal(el.customizeModal);
    playSound('click');
  }

  function closeSettings() {
    hideModal(el.customizeModal);
  }

  function saveSettings() {
    const work = parseInt(el.workDuration.value);
    const shortBreak = parseInt(el.shortBreakDuration.value);
    const longBreak = parseInt(el.longBreakDuration.value);

    if ([work, shortBreak, longBreak].some(v => isNaN(v) || v < 1 || v > 60)) {
      showToast('Invalid duration (1-60)');
      return;
    }

    state.durations = { work, shortBreak, longBreak };
    save(STORAGE_KEYS.DURATIONS, state.durations);

    state.soundEnabled = el.settingSound.getAttribute('aria-checked') === 'true';
    state.notificationsEnabled = el.settingNotifications.getAttribute('aria-checked') === 'true';
    state.flashEnabled = el.settingFlash.getAttribute('aria-checked') === 'true';

    save(STORAGE_KEYS.SOUND, state.soundEnabled);
    save(STORAGE_KEYS.NOTIFICATIONS, state.notificationsEnabled);
    save(STORAGE_KEYS.FLASH, state.flashEnabled);

    updateSoundIcon();

    if (!state.isRunning) {
      resetTimerDisplay();
      updateTimerDisplay();
    }

    closeSettings();
    playSound('check');
    showToast('Saved');
  }

  function resetSettings() {
    el.workDuration.value = DEFAULT_DURATIONS.work;
    el.shortBreakDuration.value = DEFAULT_DURATIONS.shortBreak;
    el.longBreakDuration.value = DEFAULT_DURATIONS.longBreak;
    showToast('Reset to defaults');
  }

  function toggleSettingSwitch(btn) {
    const current = btn.getAttribute('aria-checked') === 'true';
    btn.setAttribute('aria-checked', !current);
  }

  // ==========================================================================
  // Help Modal
  // ==========================================================================
  function openHelp() {
    showModal(el.helpModal);
    playSound('click');
  }

  function closeHelp() {
    hideModal(el.helpModal);
  }

  // ==========================================================================
  // Modal Utils
  // ==========================================================================
  function showModal(modal) {
    modal.hidden = false;
    modal.offsetHeight;
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function hideModal(modal) {
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.hidden = true;
      document.body.style.overflow = '';
    }, 300);
  }

  function closeAllModals() {
    [el.customizeModal, el.helpModal].forEach(m => {
      if (!m.hidden) hideModal(m);
    });
  }

  // ==========================================================================
  // Toast
  // ==========================================================================
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  // ==========================================================================
  // Mobile
  // ==========================================================================
  function initMobile() {
    el.mobileTaskBtn?.addEventListener('click', openBottomSheet);
    el.bottomSheetOverlay?.addEventListener('click', closeBottomSheet);
    el.bottomSheetClose?.addEventListener('click', closeBottomSheet);

    el.timerContainer?.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.timerContainer?.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.timerContainer?.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  function openBottomSheet() {
    updateMobileTaskList();
    el.bottomSheetOverlay.hidden = false;
    el.bottomSheet.hidden = false;
    el.bottomSheetOverlay.offsetHeight;
    el.bottomSheetOverlay.classList.add('visible');
    el.bottomSheet.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeBottomSheet() {
    el.bottomSheetOverlay.classList.remove('visible');
    el.bottomSheet.classList.remove('visible');
    setTimeout(() => {
      el.bottomSheetOverlay.hidden = true;
      el.bottomSheet.hidden = true;
      document.body.style.overflow = '';
    }, 300);
  }

  function updateMobileTaskList() {
    if (!el.bottomSheetContent) return;

    el.bottomSheetContent.innerHTML = `
      <form class="add-task-form" id="mobile-add-task-form">
        <input type="text" class="task-input" id="mobile-task-input" placeholder="Add a task..." maxlength="100">
        <button type="submit" class="add-task-btn">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </form>
      <ul class="task-list" id="mobile-task-list"></ul>
    `;

    const form = el.bottomSheetContent.querySelector('#mobile-add-task-form');
    const input = el.bottomSheetContent.querySelector('#mobile-task-input');
    const list = el.bottomSheetContent.querySelector('#mobile-task-list');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (addTask(input.value)) {
        input.value = '';
        updateMobileTaskList();
      }
    });

    list.innerHTML = el.taskList.innerHTML;

    list.querySelectorAll('.task-item').forEach(li => {
      const id = li.dataset.taskId;
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;

      li.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'toggle') { toggleTaskComplete(id); updateMobileTaskList(); }
        else if (action === 'select') { selectTask(id); updateMobileTaskList(); }
        else if (action === 'delete') { deleteTask(id); updateMobileTaskList(); }
        else if (action === 'edit') {
          closeBottomSheet();
          setTimeout(() => {
            const mainLi = el.taskList.querySelector(`[data-task-id="${id}"]`);
            if (mainLi) startEditTask(mainLi, task);
          }, 300);
        }
      });
    });
  }

  function handleTouchStart(e) {
    state.touchStartX = e.touches[0].clientX;
    state.touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove() {}

  function handleTouchEnd(e) {
    if (!state.touchStartX) return;
    const dx = e.changedTouches[0].clientX - state.touchStartX;
    const dy = e.changedTouches[0].clientY - state.touchStartY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 80) {
      if (dx < 0) skipSession();
      else resetTimer();
    }

    state.touchStartX = null;
    state.touchStartY = null;
  }

  // ==========================================================================
  // Keyboard
  // ==========================================================================
  function initKeyboard() {
    document.addEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }

    if (e.key.length === 1) {
      state.helpTyped += e.key.toLowerCase();
      if (state.helpTyped.endsWith('help')) {
        openHelp();
        state.helpTyped = '';
        return;
      }
      if (state.helpTyped.length > 4) state.helpTyped = state.helpTyped.slice(-4);
    }

    if (e.key === 'Escape') {
      closeAllModals();
      closeBottomSheet();
      return;
    }

    if (!el.customizeModal.hidden || !el.helpModal.hidden) return;

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        startTimer();
        break;
      case 'r': resetTimer(); break;
      case 'n': skipSession(); break;
      case 's': stopTimer(); break;
      case 'a':
        e.preventDefault();
        el.taskInput.focus();
        break;
      case 't': cycleTheme(); break;
      case 'm': toggleSound(); break;
      case 'f': toggleFocusMode(); break;
      case 'c': openSettings(); break;
      case '?': openHelp(); break;
      default:
        if (/^[1-9]$/.test(e.key)) {
          const task = state.tasks[parseInt(e.key) - 1];
          if (task) toggleTaskComplete(task.id);
        }
    }
  }

  // ==========================================================================
  // Utils
  // ==========================================================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================================================
  // Events
  // ==========================================================================
  function initEvents() {
    el.startBtn.addEventListener('click', startTimer);
    el.skipBtn.addEventListener('click', skipSession);
    el.resetBtn.addEventListener('click', resetTimer);
    el.stopBtn.addEventListener('click', stopTimer);
    el.customizeBtn.addEventListener('click', openSettings);

    el.themeToggle.addEventListener('click', cycleTheme);
    el.soundToggle.addEventListener('click', toggleSound);
    el.focusToggle.addEventListener('click', toggleFocusMode);

    el.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (addTask(el.taskInput.value)) el.taskInput.value = '';
    });

    el.historyToggle.addEventListener('click', toggleHistory);

    el.customizeClose.addEventListener('click', closeSettings);
    el.customizeSave.addEventListener('click', saveSettings);
    el.customizeReset.addEventListener('click', resetSettings);
    el.customizeModal.addEventListener('click', (e) => {
      if (e.target === el.customizeModal) closeSettings();
    });

    el.settingSound.addEventListener('click', () => toggleSettingSwitch(el.settingSound));
    el.settingNotifications.addEventListener('click', () => toggleSettingSwitch(el.settingNotifications));
    el.settingFlash.addEventListener('click', () => toggleSettingSwitch(el.settingFlash));
    el.clearHistoryBtn?.addEventListener('click', clearHistory);

    el.helpClose.addEventListener('click', closeHelp);
    el.helpModal.addEventListener('click', (e) => {
      if (e.target === el.helpModal) closeHelp();
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // ==========================================================================
  // Init
  // ==========================================================================
  function init() {
    cacheElements();
    initTheme();
    initAudio();
    initNotifications();
    initTimer();
    initTasks();
    initSessions();
    initEvents();
    initKeyboard();
    initMobile();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
