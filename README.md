# Shadizer

Shadizer turns an iPhone, iPad, or desktop browser into a full-screen audio-reactive visual instrument. Load a track from your device, perform with hundreds of MilkDrop scenes, blend between them, mutate the current look, or let Auto VJ choose changes on musical transients.

The app is designed for GitHub Pages and can be installed from Safari with **Add to Home Screen**. Audio files remain on the device and are never uploaded.

## Features

- Butterchurn WebGL implementation of MilkDrop with the open Butterchurn preset pack
- Local MP3, WAV, M4A, AAC, and browser-supported audio playback
- Previous, random, next, favorite, mutate, blackout, and Auto VJ performance controls
- Adjustable transitions, reactivity, Auto VJ timing, color treatments, and render quality
- Scene search, favorites, and recent history
- iPhone safe-area layout, adaptive rendering, wake lock, and clean screen-recording mode
- Installable offline PWA shell
- GitHub Actions deployment to GitHub Pages

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the app whenever `main` is updated. In the repository settings, choose **GitHub Actions** as the Pages source if GitHub has not selected it automatically.

## Credits

Shadizer uses [Butterchurn](https://github.com/jberg/butterchurn) and [Butterchurn Presets](https://github.com/jberg/butterchurn-presets), both released under the MIT License. MilkDrop was created by Ryan Geiss.

## License

Shadizer is released under the MIT License. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
