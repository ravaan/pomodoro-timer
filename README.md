# Pomodoro Timer

A beautiful, feature-rich Pomodoro productivity timer with task tracking. Built with pure HTML, CSS, and JavaScript - no frameworks, no build step.

## Features

- **Classic Pomodoro Technique**: 25min work → 5min short break → repeat 4x → 15min long break
- **Task Management**: Add, edit, delete, and track tasks with session counters
- **Session History**: Complete log of all your work and break sessions
- **Statistics Dashboard**: Track daily and all-time focus time, streaks, and more
- **Three Themes**: Dark (default), Light, and Focus (minimal distraction mode)
- **Sound Effects**: Gentle audio cues using Web Audio API (no audio files)
- **Browser Notifications**: Get notified when sessions complete
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Mobile Responsive**: Works great on phones and tablets with swipe gestures
- **Offline Support**: All data stored locally in your browser

## Quick Start

### Local Development

Simply open `index.html` in your browser:

```bash
# Clone the repository
git clone https://github.com/ravaan/pomodoro-timer.git
cd pomodoro-timer

# Open in browser (macOS)
open index.html

# Or on Linux
xdg-open index.html

# Or on Windows
start index.html
```

No npm, no build step, no dependencies. It just works!

### GitHub Pages Deployment

1. Push to your GitHub repository
2. Go to **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. The site will automatically deploy on each push to `main`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start/Pause timer |
| `R` | Reset current session |
| `N` | Skip to next session |
| `S` | Stop timer completely |
| `A` | Add new task |
| `1`-`9` | Toggle task 1-9 checkbox |
| `T` | Toggle theme (Dark → Light → Focus) |
| `M` | Toggle sound (mute) |
| `C` | Open customization panel |
| `?` | Show help modal |
| `Esc` | Close modal |

**Tip**: Type "help" anywhere to open the shortcuts modal!

## Customizing Timer Durations

1. Click the **Customize** button below the timer (or press `C`)
2. Adjust work duration (1-60 minutes)
3. Adjust short break duration (1-60 minutes)
4. Adjust long break duration (1-60 minutes)
5. Click **Save Changes**

Your custom durations are saved and persist across sessions.

## Enabling Notifications

1. Click the bell icon in the top-right corner (or toggle in Customize panel)
2. Allow notifications when your browser prompts
3. You'll receive a notification when each session completes

**Note**: If you denied permission, you'll need to enable notifications in your browser settings.

## Mobile Gestures

On touch devices:
- **Swipe left** on the timer to skip to next session
- **Swipe right** on the timer to reset current session
- Tap the **Tasks** button to open the task list bottom sheet

## Themes

| Theme | Description |
|-------|-------------|
| **Dark** | Deep navy background with warm tomato red accent |
| **Light** | Cream background with forest green accent |
| **Focus** | Pure black background, minimal UI, only timer and tasks visible |

The app respects your system color scheme preference on first load.

## Data Storage

All data is stored locally in your browser's localStorage:
- Timer preferences
- Tasks and their completion status
- Session history
- Statistics
- Theme and sound preferences

**No data is sent to any server.** Your productivity data stays on your device.

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Requires JavaScript enabled and localStorage available.

## File Structure

```
pomodoro-timer/
├── index.html          # Main HTML structure
├── styles.css          # All styles with CSS variables
├── app.js              # Application logic (single IIFE)
├── README.md           # This file
├── LICENSE             # MIT license
├── plan.md             # Implementation plan
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Pages deployment
```

## Technical Details

- **No Build Step**: Pure HTML/CSS/JS, works by opening index.html
- **No Dependencies**: No npm packages, no frameworks
- **Size**: Under 100KB total
- **Timer Precision**: Uses `performance.now()` for accurate timing
- **Tab Switching**: Visibility API ensures timer stays accurate when tab is hidden
- **Sound**: Web Audio API generates sounds dynamically (no audio files)

## License

MIT License - see [LICENSE](LICENSE) file.

---

Built with focus and determination.
