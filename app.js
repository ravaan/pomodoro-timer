/**
 * Pomodoro Timer Application
 * A productivity timer with task tracking using the 25/5/15 technique
 */
(function() {
  'use strict';

  // ==========================================================================
  // Constants & Configuration
  // ==========================================================================
  const DEFAULT_DURATIONS = {
    work: 25,
    shortBreak: 5,
    longBreak: 15
  };

  const SESSION_TYPES = {
    WORK: 'work',
    SHORT_BREAK: 'short-break',
    LONG_BREAK: 'long-break'
  };

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

  const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * 90; // 565.48

  // ==========================================================================
  // State
  // ==========================================================================
  let state = {
    // Timer state
    isRunning: false,
    isPaused: false,
    sessionType: SESSION_TYPES.WORK,
    sessionCount: 1,
    totalDuration: DEFAULT_DURATIONS.work * 60 * 1000,
    remainingTime: DEFAULT_DURATIONS.work * 60 * 1000,
    startTime: null,
    pausedTime: null,
    timerInterval: null,

    // Settings
    durations: { ...DEFAULT_DURATIONS },
    soundEnabled: true,
    notificationsEnabled: false,
    flashEnabled: true,
    theme: 'dark',

    // Tasks
    tasks: [],
    activeTaskId: null,

    // Sessions
    sessions: [],

    // Audio
    audioContext: null,

    // UI
    helpTyped: '',

    // Mobile
    touchStartX: null,
    touchStartY: null,
    isSwiping: false
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const elements = {};

  function cacheElements() {
    // Timer
    elements.timerTime = document.getElementById('timer-time');
    elements.timerLabel = document.getElementById('timer-label');
    elements.timerSession = document.getElementById('timer-session');
    elements.timerContainer = document.querySelector('.timer-container');
    elements.progressRing = document.querySelector('.progress-ring-progress');

    // Session calendar
    elements.sessionDots = document.querySelectorAll('.session-dot');

    // Controls
    elements.startBtn = document.getElementById('start-btn');
    elements.skipBtn = document.getElementById('skip-btn');
    elements.resetBtn = document.getElementById('reset-btn');
    elements.stopBtn = document.getElementById('stop-btn');
    elements.customizeBtn = document.getElementById('customize-btn');

    // Toggles
    elements.themeToggle = document.getElementById('theme-toggle');
    elements.soundToggle = document.getElementById('sound-toggle');
    elements.notificationToggle = document.getElementById('notification-toggle');

    // Tasks
    elements.taskForm = document.getElementById('add-task-form');
    elements.taskInput = document.getElementById('task-input');
    elements.taskList = document.getElementById('task-list');

    // Stats
    elements.statSessionsToday = document.getElementById('stat-sessions-today');
    elements.statFocusToday = document.getElementById('stat-focus-today');
    elements.statSessionsTotal = document.getElementById('stat-sessions-total');
    elements.statFocusTotal = document.getElementById('stat-focus-total');
    elements.statStreak = document.getElementById('stat-streak');
    elements.statTasksCompleted = document.getElementById('stat-tasks-completed');
    elements.statsSection = document.getElementById('stats-section');

    // History
    elements.historySection = document.getElementById('history-section');
    elements.historyToggle = document.getElementById('history-toggle');
    elements.historyContent = document.getElementById('history-content');
    elements.historyList = document.getElementById('history-list');
    elements.historyEmpty = document.getElementById('history-empty');

    // Modals
    elements.customizeModal = document.getElementById('customize-modal');
    elements.customizeClose = document.getElementById('customize-close');
    elements.customizeSave = document.getElementById('customize-save');
    elements.customizeReset = document.getElementById('customize-reset');
    elements.workDuration = document.getElementById('work-duration');
    elements.shortBreakDuration = document.getElementById('short-break-duration');
    elements.longBreakDuration = document.getElementById('long-break-duration');
    elements.settingSound = document.getElementById('setting-sound');
    elements.settingNotifications = document.getElementById('setting-notifications');
    elements.settingFlash = document.getElementById('setting-flash');

    elements.helpModal = document.getElementById('help-modal');
    elements.helpClose = document.getElementById('help-close');

    // Toast
    elements.toastContainer = document.getElementById('toast-container');

    // Mobile
    elements.bottomSheetOverlay = document.getElementById('bottom-sheet-overlay');
    elements.bottomSheet = document.getElementById('bottom-sheet');
    elements.bottomSheetClose = document.getElementById('bottom-sheet-close');
    elements.bottomSheetContent = document.getElementById('bottom-sheet-content');
    elements.mobileTaskBtn = document.getElementById('mobile-task-btn');
  }

  // ==========================================================================
  // LocalStorage Helpers
  // ==========================================================================
  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        showToast('Storage full. Consider clearing old history.', 'error');
      }
      console.error('Failed to save to localStorage:', e);
    }
  }

  function loadFromStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
      return defaultValue;
    }
  }

  function removeFromStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to remove from localStorage:', e);
    }
  }

  // ==========================================================================
  // Theme Management
  // ==========================================================================
  function initTheme() {
    const savedTheme = loadFromStorage(STORAGE_KEYS.THEME);

    if (savedTheme) {
      state.theme = savedTheme;
    } else {
      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        state.theme = 'light';
      } else {
        state.theme = 'dark';
      }
    }

    applyTheme(state.theme);

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!loadFromStorage(STORAGE_KEYS.THEME)) {
          state.theme = e.matches ? 'dark' : 'light';
          applyTheme(state.theme);
        }
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggleIcon();

    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const colors = { dark: '#0f1419', light: '#faf8f5', focus: '#000000' };
      metaThemeColor.setAttribute('content', colors[theme]);
    }
  }

  function updateThemeToggleIcon() {
    const icon = elements.themeToggle.querySelector('.toggle-icon');
    const icons = { dark: '🌙', light: '☀️', focus: '🎯' };
    icon.textContent = icons[state.theme];
  }

  function cycleTheme() {
    const themes = ['dark', 'light', 'focus'];
    const currentIndex = themes.indexOf(state.theme);
    state.theme = themes[(currentIndex + 1) % themes.length];

    applyTheme(state.theme);
    saveToStorage(STORAGE_KEYS.THEME, state.theme);
    playSound('click');
    showToast(`Theme: ${state.theme.charAt(0).toUpperCase() + state.theme.slice(1)}`);
  }

  // ==========================================================================
  // Sound System (Web Audio API)
  // ==========================================================================
  function initAudio() {
    state.soundEnabled = loadFromStorage(STORAGE_KEYS.SOUND, true);
    updateSoundToggle();
  }

  function createAudioContext() {
    if (!state.audioContext) {
      try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error('Web Audio API not supported:', e);
        state.soundEnabled = false;
        showToast('Sound not available in this browser', 'warning');
      }
    }
    return state.audioContext;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;

    const ctx = createAudioContext();
    if (!ctx) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    switch (type) {
      case 'start':
        playChime(ctx, now, [440, 550, 660], 0.15, 0.1);
        break;
      case 'pause':
        playTone(ctx, now, 300, 'triangle', 0.1, 0.08);
        break;
      case 'complete':
        playChime(ctx, now, [523, 659, 784, 1047], 0.2, 0.15);
        break;
      case 'check':
        playTone(ctx, now, 880, 'sine', 0.1, 0.1);
        break;
      case 'uncheck':
        playTone(ctx, now, 440, 'sine', 0.08, 0.08);
        break;
      case 'click':
        playTone(ctx, now, 600, 'square', 0.02, 0.03);
        break;
      case 'skip':
        playSwoosh(ctx, now);
        break;
      case 'tick':
        playTone(ctx, now, 800, 'sine', 0.02, 0.03);
        break;
      case 'delete':
        playTone(ctx, now, 200, 'triangle', 0.1, 0.1);
        break;
    }
  }

  function playTone(ctx, startTime, frequency, waveType, duration, volume) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  function playChime(ctx, startTime, frequencies, noteDuration, volume) {
    frequencies.forEach((freq, i) => {
      playTone(ctx, startTime + i * noteDuration * 0.5, freq, 'sine', noteDuration, volume);
    });
  }

  function playSwoosh(ctx, startTime) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, startTime + 0.1);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.1);
  }

  function updateSoundToggle() {
    const icon = elements.soundToggle.querySelector('.toggle-icon');
    icon.textContent = state.soundEnabled ? '♪' : '🔇';
    elements.soundToggle.classList.toggle('active', state.soundEnabled);
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    saveToStorage(STORAGE_KEYS.SOUND, state.soundEnabled);
    updateSoundToggle();

    if (state.soundEnabled) {
      playSound('click');
    }
    showToast(state.soundEnabled ? 'Sound enabled' : 'Sound muted');
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================
  function initNotifications() {
    state.notificationsEnabled = loadFromStorage(STORAGE_KEYS.NOTIFICATIONS, false);
    state.flashEnabled = loadFromStorage(STORAGE_KEYS.FLASH, true);
    updateNotificationToggle();
  }

  function updateNotificationToggle() {
    const icon = elements.notificationToggle.querySelector('.toggle-icon');
    icon.textContent = state.notificationsEnabled ? '🔔' : '🔕';
    elements.notificationToggle.classList.toggle('active', state.notificationsEnabled);
  }

  async function toggleNotifications() {
    if (!state.notificationsEnabled) {
      // Try to enable
      if (!('Notification' in window)) {
        showToast('Notifications not supported', 'error');
        return;
      }

      if (Notification.permission === 'denied') {
        showToast('Notifications blocked. Enable in browser settings.', 'error');
        return;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast('Notification permission denied', 'warning');
          return;
        }
      }

      state.notificationsEnabled = true;
    } else {
      state.notificationsEnabled = false;
    }

    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, state.notificationsEnabled);
    updateNotificationToggle();
    playSound('click');
    showToast(state.notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled');
  }

  function sendNotification(title, body) {
    if (!state.notificationsEnabled || Notification.permission !== 'granted') {
      return;
    }

    try {
      new Notification(title, {
        body,
        icon: '🍅',
        badge: '🍅',
        tag: 'pomodoro-timer'
      });
    } catch (e) {
      console.error('Failed to send notification:', e);
    }
  }

  function showScreenFlash(type) {
    if (!state.flashEnabled) return;

    const flash = document.createElement('div');
    flash.className = `screen-flash ${type}`;
    document.body.appendChild(flash);

    setTimeout(() => {
      flash.remove();
    }, 500);
  }

  // ==========================================================================
  // Timer System
  // ==========================================================================
  function initTimer() {
    state.durations = loadFromStorage(STORAGE_KEYS.DURATIONS, DEFAULT_DURATIONS);
    resetTimerDisplay();
    updateTimerDisplay();
    updateSessionCalendar();
  }

  function resetTimerDisplay() {
    const duration = getDurationForType(state.sessionType);
    state.totalDuration = duration * 60 * 1000;
    state.remainingTime = state.totalDuration;
  }

  function getDurationForType(type) {
    switch (type) {
      case SESSION_TYPES.WORK:
        return state.durations.work;
      case SESSION_TYPES.SHORT_BREAK:
        return state.durations.shortBreak;
      case SESSION_TYPES.LONG_BREAK:
        return state.durations.longBreak;
      default:
        return state.durations.work;
    }
  }

  function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    elements.timerTime.textContent = formatTime(state.remainingTime);

    const labels = {
      [SESSION_TYPES.WORK]: 'Work',
      [SESSION_TYPES.SHORT_BREAK]: 'Short Break',
      [SESSION_TYPES.LONG_BREAK]: 'Long Break'
    };
    elements.timerLabel.textContent = labels[state.sessionType];
    elements.timerSession.textContent = `Session ${state.sessionCount}/4`;

    // Update progress ring
    const progress = 1 - (state.remainingTime / state.totalDuration);
    const offset = PROGRESS_RING_CIRCUMFERENCE * (1 - progress);
    elements.progressRing.style.strokeDashoffset = offset;

    // Update container data type for color
    elements.timerContainer.setAttribute('data-type', state.sessionType);

    // Pulsing effect for last 10 seconds
    if (state.remainingTime <= 10000 && state.isRunning) {
      elements.timerTime.classList.add('pulsing');
    } else {
      elements.timerTime.classList.remove('pulsing');
    }
  }

  function updateSessionCalendar() {
    elements.sessionDots.forEach((dot, index) => {
      const sessionNum = index + 1;
      dot.classList.remove('completed', 'current', 'break');

      if (state.sessionType === SESSION_TYPES.WORK) {
        if (sessionNum < state.sessionCount) {
          dot.classList.add('completed');
        } else if (sessionNum === state.sessionCount) {
          dot.classList.add('current');
        }
      } else {
        // During break, show previous work sessions as completed
        if (sessionNum <= state.sessionCount - 1) {
          dot.classList.add('completed');
        } else if (sessionNum === state.sessionCount) {
          dot.classList.add('break');
        }
      }
    });
  }

  function startTimer() {
    if (state.isRunning) {
      pauseTimer();
      return;
    }

    // Initialize audio context on first interaction
    createAudioContext();

    state.isRunning = true;
    state.isPaused = false;

    if (state.pausedTime) {
      // Resuming from pause
      state.startTime = performance.now() - (state.totalDuration - state.remainingTime);
    } else {
      // Fresh start
      state.startTime = performance.now();
      playSound('start');
      showToast(`${state.sessionType === SESSION_TYPES.WORK ? 'Work' : 'Break'} session started`);
    }

    state.pausedTime = null;
    elements.startBtn.textContent = 'Pause';

    // Use requestAnimationFrame for smooth updates
    let lastTickTime = 0;

    function tick(currentTime) {
      if (!state.isRunning) return;

      const elapsed = currentTime - state.startTime;
      state.remainingTime = Math.max(0, state.totalDuration - elapsed);

      // Play tick sound in last 10 seconds
      if (state.remainingTime <= 10000 && state.remainingTime > 0) {
        const currentSecond = Math.ceil(state.remainingTime / 1000);
        const lastSecond = Math.ceil((state.remainingTime + 100) / 1000);
        if (currentSecond !== lastSecond && currentSecond <= 10) {
          playSound('tick');
        }
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

    if (state.timerInterval) {
      cancelAnimationFrame(state.timerInterval);
    }

    elements.startBtn.textContent = 'Resume';
    playSound('pause');
    showToast('Timer paused');
  }

  function resetTimer() {
    const wasRunning = state.isRunning;

    state.isRunning = false;
    state.isPaused = false;
    state.pausedTime = null;

    if (state.timerInterval) {
      cancelAnimationFrame(state.timerInterval);
    }

    resetTimerDisplay();
    updateTimerDisplay();
    elements.startBtn.textContent = 'Start';

    playSound('click');
    showToast('Session reset');
  }

  function skipSession() {
    playSound('skip');
    moveToNextSession();
    showToast('Skipped to next session');
  }

  function stopTimer() {
    state.isRunning = false;
    state.isPaused = false;
    state.pausedTime = null;
    state.sessionType = SESSION_TYPES.WORK;
    state.sessionCount = 1;

    if (state.timerInterval) {
      cancelAnimationFrame(state.timerInterval);
    }

    resetTimerDisplay();
    updateTimerDisplay();
    updateSessionCalendar();
    elements.startBtn.textContent = 'Start';

    playSound('click');
    showToast('Timer stopped');
  }

  function completeSession() {
    state.isRunning = false;

    if (state.timerInterval) {
      cancelAnimationFrame(state.timerInterval);
    }

    // Record session
    recordSession();

    // Play completion sound and show notifications
    playSound('complete');
    showScreenFlash(state.sessionType === SESSION_TYPES.WORK ? 'work' : 'break');

    const isWorkSession = state.sessionType === SESSION_TYPES.WORK;
    const message = isWorkSession ? 'Work session complete! Time for a break.' : 'Break is over! Ready to work?';

    sendNotification('Pomodoro Timer', message);
    showToast(message, 'success');

    // Move to next session
    moveToNextSession();

    // Auto-start breaks
    if (!isWorkSession || state.sessionType !== SESSION_TYPES.WORK) {
      // It's now a break, auto-start it
      if (state.sessionType !== SESSION_TYPES.WORK) {
        setTimeout(() => {
          startTimer();
        }, 1000);
      }
    }

    elements.startBtn.textContent = 'Start';
    updateStats();
  }

  function moveToNextSession() {
    state.isRunning = false;
    state.isPaused = false;
    state.pausedTime = null;

    if (state.timerInterval) {
      cancelAnimationFrame(state.timerInterval);
    }

    if (state.sessionType === SESSION_TYPES.WORK) {
      // Work session completed
      if (state.sessionCount >= 4) {
        // Long break after 4 sessions
        state.sessionType = SESSION_TYPES.LONG_BREAK;
      } else {
        // Short break
        state.sessionType = SESSION_TYPES.SHORT_BREAK;
      }
    } else {
      // Break completed, move to next work session
      if (state.sessionType === SESSION_TYPES.LONG_BREAK) {
        // Reset cycle after long break
        state.sessionCount = 1;
      } else {
        state.sessionCount++;
      }
      state.sessionType = SESSION_TYPES.WORK;
    }

    resetTimerDisplay();
    updateTimerDisplay();
    updateSessionCalendar();
    elements.startBtn.textContent = 'Start';
  }

  // Handle visibility change for timer accuracy
  function handleVisibilityChange() {
    if (document.hidden && state.isRunning) {
      // Page is hidden, store the time
      state.hiddenTime = performance.now();
    } else if (!document.hidden && state.isRunning && state.hiddenTime) {
      // Page is visible again, adjust the start time
      const hiddenDuration = performance.now() - state.hiddenTime;
      state.startTime += hiddenDuration;
      state.hiddenTime = null;
    }
  }

  // ==========================================================================
  // Task Management
  // ==========================================================================
  function initTasks() {
    state.tasks = loadFromStorage(STORAGE_KEYS.TASKS, []);
    state.activeTaskId = loadFromStorage(STORAGE_KEYS.ACTIVE_TASK, null);
    renderTasks();
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function addTask(text) {
    const trimmedText = text.trim();
    if (!trimmedText) {
      showToast('Please enter a task name', 'warning');
      return false;
    }

    if (trimmedText.length > 100) {
      showToast('Task name too long (max 100 characters)', 'warning');
      return false;
    }

    const task = {
      id: generateId(),
      text: trimmedText,
      completed: false,
      sessionsSpent: 0,
      createdAt: new Date().toISOString()
    };

    state.tasks.unshift(task);
    saveTasks();
    renderTasks();
    playSound('check');
    showToast('Task added');
    return true;
  }

  function toggleTaskComplete(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    renderTasks();
    updateStats();
    playSound(task.completed ? 'check' : 'uncheck');
  }

  function editTask(taskId, newText) {
    const trimmedText = newText.trim();
    if (!trimmedText) {
      showToast('Task name cannot be empty', 'warning');
      return false;
    }

    if (trimmedText.length > 100) {
      showToast('Task name too long', 'warning');
      return false;
    }

    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      task.text = trimmedText;
      saveTasks();
      renderTasks();
      showToast('Task updated');
    }
    return true;
  }

  function deleteTask(taskId) {
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index > -1) {
      state.tasks.splice(index, 1);
      if (state.activeTaskId === taskId) {
        state.activeTaskId = null;
        saveToStorage(STORAGE_KEYS.ACTIVE_TASK, null);
      }
      saveTasks();
      renderTasks();
      updateStats();
      playSound('delete');
      showToast('Task deleted');
    }
  }

  function selectTask(taskId) {
    if (state.isRunning) {
      showToast('Cannot change task while timer is running', 'warning');
      return;
    }

    state.activeTaskId = state.activeTaskId === taskId ? null : taskId;
    saveToStorage(STORAGE_KEYS.ACTIVE_TASK, state.activeTaskId);
    renderTasks();

    if (state.activeTaskId) {
      const task = state.tasks.find(t => t.id === taskId);
      showToast(`Selected: ${task.text.substring(0, 30)}${task.text.length > 30 ? '...' : ''}`);
    }
  }

  function saveTasks() {
    saveToStorage(STORAGE_KEYS.TASKS, state.tasks);
  }

  function renderTasks() {
    const taskList = elements.taskList;
    taskList.innerHTML = '';

    if (state.tasks.length === 0) {
      taskList.innerHTML = '<li class="task-empty">No tasks yet. Add one above!</li>';
      return;
    }

    state.tasks.forEach((task, index) => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === state.activeTaskId ? 'active' : ''}`;
      li.setAttribute('data-task-id', task.id);
      li.setAttribute('role', 'listitem');

      li.innerHTML = `
        <button class="task-checkbox ${task.completed ? 'checked' : ''}"
                aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}"
                data-action="toggle"></button>
        <span class="task-text" data-action="select">${escapeHtml(task.text)}</span>
        ${task.sessionsSpent > 0 ? `<span class="task-sessions">${task.sessionsSpent} 🍅</span>` : ''}
        <div class="task-actions">
          <button class="task-action-btn" aria-label="Edit task" data-action="edit" title="Edit">✏️</button>
          <button class="task-action-btn delete" aria-label="Delete task" data-action="delete" title="Delete">🗑️</button>
        </div>
      `;

      // Event delegation
      li.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        const taskId = li.dataset.taskId;

        switch (action) {
          case 'toggle':
            toggleTaskComplete(taskId);
            break;
          case 'select':
            selectTask(taskId);
            break;
          case 'edit':
            startEditTask(li, task);
            break;
          case 'delete':
            deleteTask(taskId);
            break;
        }
      });

      // Double-click to edit
      li.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('task-text')) {
          startEditTask(li, task);
        }
      });

      taskList.appendChild(li);
    });

    // Update mobile bottom sheet
    updateMobileTaskList();
  }

  function startEditTask(li, task) {
    const textSpan = li.querySelector('.task-text');
    const originalText = task.text;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = originalText;
    input.maxLength = 100;

    textSpan.replaceWith(input);
    input.focus();
    input.select();

    function saveEdit() {
      const newText = input.value.trim();
      if (newText && newText !== originalText) {
        editTask(task.id, newText);
      } else {
        renderTasks();
      }
    }

    function cancelEdit() {
      renderTasks();
    }

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        input.removeEventListener('blur', saveEdit);
        cancelEdit();
      }
    });
  }

  // ==========================================================================
  // Session History
  // ==========================================================================
  function initSessions() {
    state.sessions = loadFromStorage(STORAGE_KEYS.SESSIONS, []);
    renderHistory();
    updateStats();
  }

  function recordSession() {
    const session = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      startTime: new Date(Date.now() - state.totalDuration).toISOString(),
      endTime: new Date().toISOString(),
      duration: state.totalDuration / 1000 / 60, // minutes
      type: state.sessionType,
      taskId: state.sessionType === SESSION_TYPES.WORK ? state.activeTaskId : null,
      taskName: state.sessionType === SESSION_TYPES.WORK && state.activeTaskId
        ? state.tasks.find(t => t.id === state.activeTaskId)?.text || null
        : null
    };

    state.sessions.unshift(session);
    saveToStorage(STORAGE_KEYS.SESSIONS, state.sessions);

    // Update task session count
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
    const historyList = elements.historyList;
    historyList.innerHTML = '';

    if (state.sessions.length === 0) {
      elements.historyEmpty.style.display = 'block';
      return;
    }

    elements.historyEmpty.style.display = 'none';

    // Group sessions by date
    const groupedSessions = {};
    state.sessions.forEach(session => {
      if (!groupedSessions[session.date]) {
        groupedSessions[session.date] = [];
      }
      groupedSessions[session.date].push(session);
    });

    // Render groups
    Object.keys(groupedSessions).forEach(date => {
      const dateGroup = document.createElement('div');
      dateGroup.className = 'history-date-group';

      const dateLabel = formatDateLabel(date);
      dateGroup.innerHTML = `<div class="history-date">${dateLabel}</div>`;

      groupedSessions[date].forEach(session => {
        const item = document.createElement('li');
        item.className = 'history-item';

        const time = new Date(session.endTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });

        const typeClass = session.type === SESSION_TYPES.WORK ? 'work' : 'break';
        const typeName = session.type === SESSION_TYPES.WORK
          ? 'Work'
          : session.type === SESSION_TYPES.SHORT_BREAK
            ? 'Short Break'
            : 'Long Break';

        item.innerHTML = `
          <div class="history-type ${typeClass}"></div>
          <span class="history-time">${time}</span>
          <span class="history-duration">${Math.round(session.duration)}min ${typeName}</span>
          ${session.taskName ? `<span class="history-task">- ${escapeHtml(session.taskName)}</span>` : ''}
        `;

        dateGroup.appendChild(item);
      });

      historyList.appendChild(dateGroup);
    });
  }

  function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  function toggleHistory() {
    const isExpanded = elements.historyToggle.getAttribute('aria-expanded') === 'true';
    elements.historyToggle.setAttribute('aria-expanded', !isExpanded);
    elements.historyContent.classList.toggle('collapsed', isExpanded);
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================
  function updateStats() {
    const today = new Date().toISOString().split('T')[0];

    // Sessions today
    const sessionsToday = state.sessions.filter(
      s => s.date === today && s.type === SESSION_TYPES.WORK
    ).length;
    elements.statSessionsToday.textContent = sessionsToday;

    // Focus time today (minutes)
    const focusToday = state.sessions
      .filter(s => s.date === today && s.type === SESSION_TYPES.WORK)
      .reduce((sum, s) => sum + s.duration, 0);
    elements.statFocusToday.textContent = `${Math.round(focusToday)}m`;

    // Total sessions
    const totalSessions = state.sessions.filter(s => s.type === SESSION_TYPES.WORK).length;
    elements.statSessionsTotal.textContent = totalSessions;

    // Total focus time
    const totalFocus = state.sessions
      .filter(s => s.type === SESSION_TYPES.WORK)
      .reduce((sum, s) => sum + s.duration, 0);
    const totalHours = totalFocus / 60;
    elements.statFocusTotal.textContent = totalHours >= 1
      ? `${totalHours.toFixed(1)}h`
      : `${Math.round(totalFocus)}m`;

    // Streak
    const streak = calculateStreak();
    elements.statStreak.textContent = streak;

    // Tasks completed
    const tasksCompleted = state.tasks.filter(t => t.completed).length;
    elements.statTasksCompleted.textContent = tasksCompleted;
  }

  function calculateStreak() {
    const workSessions = state.sessions.filter(s => s.type === SESSION_TYPES.WORK);
    if (workSessions.length === 0) return 0;

    // Get unique dates with sessions
    const datesWithSessions = [...new Set(workSessions.map(s => s.date))].sort().reverse();

    if (datesWithSessions.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if streak is still active (session today or yesterday)
    if (datesWithSessions[0] !== today && datesWithSessions[0] !== yesterday) {
      return 0;
    }

    let streak = 1;
    let currentDate = new Date(datesWithSessions[0]);

    for (let i = 1; i < datesWithSessions.length; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);

      if (datesWithSessions[i] === prevDate.toISOString().split('T')[0]) {
        streak++;
        currentDate = prevDate;
      } else {
        break;
      }
    }

    return streak;
  }

  // ==========================================================================
  // Customization Modal
  // ==========================================================================
  function openCustomizeModal() {
    elements.workDuration.value = state.durations.work;
    elements.shortBreakDuration.value = state.durations.shortBreak;
    elements.longBreakDuration.value = state.durations.longBreak;
    elements.settingSound.checked = state.soundEnabled;
    elements.settingNotifications.checked = state.notificationsEnabled;
    elements.settingFlash.checked = state.flashEnabled;

    showModal(elements.customizeModal);
    playSound('click');
  }

  function closeCustomizeModal() {
    hideModal(elements.customizeModal);
  }

  function saveCustomization() {
    const work = parseInt(elements.workDuration.value);
    const shortBreak = parseInt(elements.shortBreakDuration.value);
    const longBreak = parseInt(elements.longBreakDuration.value);

    // Validate
    if (isNaN(work) || work < 1 || work > 60) {
      showToast('Work duration must be 1-60 minutes', 'error');
      return;
    }
    if (isNaN(shortBreak) || shortBreak < 1 || shortBreak > 60) {
      showToast('Short break must be 1-60 minutes', 'error');
      return;
    }
    if (isNaN(longBreak) || longBreak < 1 || longBreak > 60) {
      showToast('Long break must be 1-60 minutes', 'error');
      return;
    }

    state.durations = { work, shortBreak, longBreak };
    saveToStorage(STORAGE_KEYS.DURATIONS, state.durations);

    // Update settings
    state.soundEnabled = elements.settingSound.checked;
    state.notificationsEnabled = elements.settingNotifications.checked;
    state.flashEnabled = elements.settingFlash.checked;

    saveToStorage(STORAGE_KEYS.SOUND, state.soundEnabled);
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, state.notificationsEnabled);
    saveToStorage(STORAGE_KEYS.FLASH, state.flashEnabled);

    updateSoundToggle();
    updateNotificationToggle();

    // Update timer if not running
    if (!state.isRunning) {
      resetTimerDisplay();
      updateTimerDisplay();
    }

    closeCustomizeModal();
    playSound('check');
    showToast('Settings saved');
  }

  function resetCustomization() {
    elements.workDuration.value = DEFAULT_DURATIONS.work;
    elements.shortBreakDuration.value = DEFAULT_DURATIONS.shortBreak;
    elements.longBreakDuration.value = DEFAULT_DURATIONS.longBreak;
    showToast('Reset to defaults');
  }

  // ==========================================================================
  // Help Modal
  // ==========================================================================
  function openHelpModal() {
    showModal(elements.helpModal);
    playSound('click');
  }

  function closeHelpModal() {
    hideModal(elements.helpModal);
  }

  // ==========================================================================
  // Modal Utilities
  // ==========================================================================
  function showModal(modal) {
    modal.hidden = false;
    // Trigger reflow for animation
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
    [elements.customizeModal, elements.helpModal].forEach(modal => {
      if (!modal.hidden) {
        hideModal(modal);
      }
    });
  }

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  function showToast(message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');

    elements.toastContainer.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // ==========================================================================
  // Mobile Support
  // ==========================================================================
  function initMobile() {
    // Bottom sheet
    elements.mobileTaskBtn.addEventListener('click', openBottomSheet);
    elements.bottomSheetOverlay.addEventListener('click', closeBottomSheet);
    elements.bottomSheetClose.addEventListener('click', closeBottomSheet);

    // Swipe gestures on timer
    elements.timerContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    elements.timerContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
    elements.timerContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  function openBottomSheet() {
    updateMobileTaskList();
    elements.bottomSheetOverlay.hidden = false;
    elements.bottomSheet.hidden = false;
    // Trigger reflow
    elements.bottomSheetOverlay.offsetHeight;
    elements.bottomSheetOverlay.classList.add('visible');
    elements.bottomSheet.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeBottomSheet() {
    elements.bottomSheetOverlay.classList.remove('visible');
    elements.bottomSheet.classList.remove('visible');
    setTimeout(() => {
      elements.bottomSheetOverlay.hidden = true;
      elements.bottomSheet.hidden = true;
      document.body.style.overflow = '';
    }, 300);
  }

  function updateMobileTaskList() {
    const content = elements.bottomSheetContent;

    // Clone add form
    content.innerHTML = `
      <form class="add-task-form" id="mobile-add-task-form">
        <input type="text" class="task-input" id="mobile-task-input"
               placeholder="Add a new task..." maxlength="100">
        <button type="submit" class="add-task-btn">+</button>
      </form>
      <ul class="task-list" id="mobile-task-list"></ul>
    `;

    const mobileForm = content.querySelector('#mobile-add-task-form');
    const mobileInput = content.querySelector('#mobile-task-input');
    const mobileList = content.querySelector('#mobile-task-list');

    mobileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (addTask(mobileInput.value)) {
        mobileInput.value = '';
        updateMobileTaskList();
      }
    });

    // Clone task list content
    mobileList.innerHTML = elements.taskList.innerHTML;

    // Re-attach event listeners
    mobileList.querySelectorAll('.task-item').forEach(li => {
      const taskId = li.dataset.taskId;
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      li.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;

        switch (action) {
          case 'toggle':
            toggleTaskComplete(taskId);
            updateMobileTaskList();
            break;
          case 'select':
            selectTask(taskId);
            updateMobileTaskList();
            break;
          case 'edit':
            // Edit in main view
            closeBottomSheet();
            setTimeout(() => {
              const mainLi = elements.taskList.querySelector(`[data-task-id="${taskId}"]`);
              if (mainLi) startEditTask(mainLi, task);
            }, 300);
            break;
          case 'delete':
            deleteTask(taskId);
            updateMobileTaskList();
            break;
        }
      });
    });
  }

  function handleTouchStart(e) {
    state.touchStartX = e.touches[0].clientX;
    state.touchStartY = e.touches[0].clientY;
    state.isSwiping = false;
  }

  function handleTouchMove(e) {
    if (!state.touchStartX || !state.touchStartY) return;

    const deltaX = e.touches[0].clientX - state.touchStartX;
    const deltaY = e.touches[0].clientY - state.touchStartY;

    // Only horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      state.isSwiping = true;
      elements.timerContainer.classList.add('swiping');
    }
  }

  function handleTouchEnd(e) {
    if (!state.isSwiping || !state.touchStartX) {
      state.touchStartX = null;
      state.touchStartY = null;
      return;
    }

    const deltaX = e.changedTouches[0].clientX - state.touchStartX;

    elements.timerContainer.classList.remove('swiping');

    if (Math.abs(deltaX) > 80) {
      if (deltaX < 0) {
        // Swipe left - skip
        skipSession();
      } else {
        // Swipe right - reset
        resetTimer();
      }
    }

    state.touchStartX = null;
    state.touchStartY = null;
    state.isSwiping = false;
  }

  // ==========================================================================
  // Keyboard Shortcuts
  // ==========================================================================
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    // Check for "help" typed sequence
    if (e.key.length === 1) {
      state.helpTyped += e.key.toLowerCase();
      if (state.helpTyped.endsWith('help')) {
        openHelpModal();
        state.helpTyped = '';
        return;
      }
      // Keep only last 4 characters
      if (state.helpTyped.length > 4) {
        state.helpTyped = state.helpTyped.slice(-4);
      }
    }

    // Modal shortcuts
    if (e.key === 'Escape') {
      closeAllModals();
      closeBottomSheet();
      return;
    }

    // Don't process shortcuts when modal is open
    if (!elements.customizeModal.hidden || !elements.helpModal.hidden) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        startTimer();
        break;
      case 'r':
        resetTimer();
        break;
      case 'n':
        skipSession();
        break;
      case 's':
        stopTimer();
        break;
      case 'a':
        e.preventDefault();
        elements.taskInput.focus();
        break;
      case 't':
        cycleTheme();
        break;
      case 'm':
        toggleSound();
        break;
      case 'c':
        openCustomizeModal();
        break;
      case '?':
        openHelpModal();
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        const taskIndex = parseInt(e.key) - 1;
        if (state.tasks[taskIndex]) {
          toggleTaskComplete(state.tasks[taskIndex].id);
        }
        break;
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function initEventListeners() {
    // Timer controls
    elements.startBtn.addEventListener('click', startTimer);
    elements.skipBtn.addEventListener('click', skipSession);
    elements.resetBtn.addEventListener('click', resetTimer);
    elements.stopBtn.addEventListener('click', stopTimer);
    elements.customizeBtn.addEventListener('click', openCustomizeModal);

    // Toggles
    elements.themeToggle.addEventListener('click', cycleTheme);
    elements.soundToggle.addEventListener('click', toggleSound);
    elements.notificationToggle.addEventListener('click', toggleNotifications);

    // Task form
    elements.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (addTask(elements.taskInput.value)) {
        elements.taskInput.value = '';
      }
    });

    // History toggle
    elements.historyToggle.addEventListener('click', toggleHistory);

    // Customize modal
    elements.customizeClose.addEventListener('click', closeCustomizeModal);
    elements.customizeSave.addEventListener('click', saveCustomization);
    elements.customizeReset.addEventListener('click', resetCustomization);
    elements.customizeModal.addEventListener('click', (e) => {
      if (e.target === elements.customizeModal) {
        closeCustomizeModal();
      }
    });

    // Help modal
    elements.helpClose.addEventListener('click', closeHelpModal);
    elements.helpModal.addEventListener('click', (e) => {
      if (e.target === elements.helpModal) {
        closeHelpModal();
      }
    });

    // Visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Prevent zoom on double tap for iOS
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    cacheElements();
    initTheme();
    initAudio();
    initNotifications();
    initTimer();
    initTasks();
    initSessions();
    initEventListeners();
    initKeyboardShortcuts();
    initMobile();

    console.log('🍅 Pomodoro Timer initialized');
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
