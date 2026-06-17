# Tomato

A simple, opinionated Pomodoro timer for macOS with a clean native feel, menu-bar support, session history, and a dark mode.

## Features

- **Focus & break intervals** — configurable work duration, break duration, and intervals per set.
- **Session name editing** — rename a session before or during a focus block.
- **History** — view completed and stopped sessions; right-click a session to copy, rename, or delete it.
- **macOS menu bar** — a minimal timer in the menu bar with quick start/pause/resume/stop actions.
- **Notifications** — friendly, context-aware alerts when focus/break/set completes.
- **Dark mode** — toggle between light and dark themes.

## Development

This app is built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS**.

```bash
npm install
npm run build      # type-check React app and build Vite bundle
npm start          # run the Electron app locally
```

## Packaging for macOS

Build the production app bundle and macOS installer:

```bash
npm run dist
```

This outputs a `.dmg` and `.zip` in the `release` directory.

### Note on code signing

By default the release is unsigned. On Apple Silicon Macs you may need to right-click the app and choose **Open** the first time you run it, or remove the quarantine attribute:

```bash
xattr -rd com.apple.quarantine /Applications/Tomato.app
```

To distribute without Gatekeeper warnings, codesign and notarize the app with your Apple Developer certificate.

## Download

Grab the latest macOS release from the [Releases](../../releases) page.

## License

MIT
