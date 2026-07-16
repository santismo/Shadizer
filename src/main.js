import './styles.css';
import { AudioEngine } from './audio-engine.js';
import { VisualizerEngine } from './visualizer-engine.js';
import { icon } from './icons.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app-shell" data-ui="visible">
    <canvas id="visualizer" aria-label="Audio-reactive visualizer"></canvas>
    <div class="grain" aria-hidden="true"></div>
    <div class="blackout-layer" aria-hidden="true"></div>

    <header class="topbar performance-ui">
      <button class="brand-button" id="open-track" type="button" aria-label="Load a different track">
        <span class="brand-mark">S</span>
        <span class="brand-copy"><strong>SHADIZER</strong><small>VISUAL INSTRUMENT</small></span>
      </button>
      <div class="energy-meter" aria-hidden="true">
        <i data-band="bass"></i><i data-band="mid"></i><i data-band="high"></i>
      </div>
      <button class="round-button" id="clean-mode" type="button" aria-label="Hide controls for clean output">${icon('clean')}</button>
      <button class="round-button" id="settings-button" type="button" aria-label="Open performance settings">${icon('sliders')}</button>
    </header>

    <section class="scene-label performance-ui" aria-live="polite">
      <span class="eyebrow">NOW MELTING</span>
      <button id="scene-name" type="button">WAITING FOR SIGNAL</button>
    </section>

    <section class="transport performance-ui" aria-label="Track controls">
      <div class="track-line">
        <button class="transport-play" id="play-button" type="button" aria-label="Play or pause">${icon('play')}</button>
        <div class="track-copy">
          <strong id="track-name">NO TRACK LOADED</strong>
          <span><time id="elapsed">0:00</time><b>—</b><time id="duration">0:00</time></span>
        </div>
        <button class="mini-button" id="blackout-button" type="button" aria-label="Blackout">${icon('blackout')}</button>
      </div>
      <input id="seek" class="seek" type="range" min="0" max="1000" value="0" aria-label="Track position" />
    </section>

    <nav class="vj-deck performance-ui" aria-label="VJ controls">
      <button class="deck-button" id="previous-button" type="button">${icon('previous')}<span>BACK</span></button>
      <button class="deck-button" id="favorite-button" type="button">${icon('heart')}<span>SAVE</span></button>
      <button class="deck-button deck-button--hero" id="random-button" type="button">${icon('dice')}<span>ROLL</span></button>
      <button class="deck-button" id="mutate-button" type="button">${icon('spark')}<span>MUTATE</span></button>
      <button class="deck-button" id="next-button" type="button">${icon('next')}<span>NEXT</span></button>
      <button class="auto-button" id="auto-button" type="button" aria-pressed="false">${icon('auto')}<span>AUTO VJ</span><i></i></button>
    </nav>

    <button class="restore-ui" id="restore-ui" type="button">SHOW CONTROLS</button>

    <section class="start-screen" id="start-screen">
      <div class="start-orb" aria-hidden="true"><span></span><i></i></div>
      <div class="start-title">
        <span class="eyebrow">AUDIO-REACTIVE VISUAL INSTRUMENT</span>
        <h1>SHADIZER</h1>
        <p>LOAD A TRACK. ROLL A SCENE.<br />MELT THE SIGNAL.</p>
      </div>
      <button class="load-button" id="load-button" type="button">${icon('upload')}<span>LOAD AUDIO</span></button>
      <button class="ghost-button" id="explore-button" type="button">EXPLORE WITHOUT AUDIO</button>
      <p class="privacy-note">YOUR AUDIO NEVER LEAVES THIS DEVICE</p>
    </section>

    <section class="sheet" id="settings-sheet" aria-hidden="true">
      <button class="sheet-backdrop" data-close-sheet type="button" aria-label="Close settings"></button>
      <div class="sheet-panel">
        <header><div><span class="eyebrow">PERFORMANCE</span><h2>CONTROL DECK</h2></div><button class="round-button" data-close-sheet type="button">${icon('close')}</button></header>
        <div class="setting-row">
          <label for="transition">MORPH TIME <output id="transition-output">3.5s</output></label>
          <input id="transition" type="range" min="0" max="10" step="0.1" value="3.5" />
        </div>
        <div class="setting-row">
          <label for="reactivity">REACTIVITY <output id="reactivity-output">1.00×</output></label>
          <input id="reactivity" type="range" min="0.35" max="2.5" step="0.05" value="1" />
        </div>
        <div class="setting-row">
          <label for="quality">RENDER QUALITY <output id="quality-output">72%</output></label>
          <input id="quality" type="range" min="0.4" max="1" step="0.04" value="0.72" />
        </div>
        <div class="setting-group">
          <span class="setting-label">AUTO VJ INTERVAL</span>
          <div class="segmented" id="auto-intervals"><button data-value="8">8s</button><button data-value="16">16s</button><button data-value="32">32s</button><button data-value="64">64s</button></div>
        </div>
        <div class="setting-group">
          <span class="setting-label">COLOR TREATMENT</span>
          <div class="segmented segmented--color" id="color-modes"><button data-value="original">RAW</button><button data-value="acid">ACID</button><button data-value="ice">ICE</button><button data-value="ember">EMBER</button><button data-value="mono">MONO</button></div>
        </div>
        <div class="utility-grid">
          <button id="fullscreen-button" type="button">${icon('fullscreen')}<span>FULLSCREEN</span></button>
          <button id="settings-load" type="button">${icon('upload')}<span>NEW TRACK</span></button>
          <button id="settings-scenes" type="button">${icon('list')}<span>SCENES</span></button>
          <button id="settings-clean" type="button">${icon('clean')}<span>CLEAN OUTPUT</span></button>
        </div>
        <p class="sheet-tip">SWIPE LEFT OR RIGHT ON THE VISUAL TO MOVE THROUGH SCENES.</p>
      </div>
    </section>

    <section class="sheet" id="scene-sheet" aria-hidden="true">
      <button class="sheet-backdrop" data-close-scenes type="button" aria-label="Close scenes"></button>
      <div class="sheet-panel scene-panel">
        <header><div><span class="eyebrow" id="scene-count">MILKDROP LIBRARY · 100 SCENES</span><h2>SCENES</h2></div><button class="round-button" data-close-scenes type="button">${icon('close')}</button></header>
        <label class="search-box">${icon('search')}<input id="scene-search" type="search" autocomplete="off" placeholder="SEARCH PRESETS" /></label>
        <div class="segmented scene-filters" id="scene-filters"><button data-value="all">ALL</button><button data-value="favorites">SAVED</button><button data-value="recent">RECENT</button></div>
        <div class="scene-list" id="scene-list"></div>
      </div>
    </section>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <input id="file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg" hidden />
    <audio id="audio" preload="metadata" playsinline></audio>
  </main>
`;

const elements = Object.fromEntries([
  'visualizer', 'start-screen', 'load-button', 'explore-button', 'file-input', 'audio', 'play-button', 'seek',
  'elapsed', 'duration', 'track-name', 'scene-name', 'previous-button', 'next-button', 'random-button',
  'mutate-button', 'favorite-button', 'auto-button', 'blackout-button', 'clean-mode', 'restore-ui',
  'settings-button', 'settings-sheet', 'scene-sheet', 'scene-list', 'scene-search', 'transition',
  'transition-output', 'reactivity', 'reactivity-output', 'quality', 'quality-output', 'auto-intervals',
  'color-modes', 'scene-filters', 'toast', 'open-track', 'fullscreen-button', 'settings-load',
  'settings-scenes', 'settings-clean',
  'scene-count',
].map((id) => [id, document.getElementById(id)]));

const shell = document.querySelector('.app-shell');
const audioEngine = new AudioEngine(elements.audio);
const visualizer = new VisualizerEngine(elements.visualizer);
let initialized = false;
let currentSceneFilter = 'all';
let toastTimer = 0;
let wakeLock = null;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function shortSceneName(name) {
  const cleaned = name.replace(/\s+/g, ' ').trim();
  const separator = cleaned.lastIndexOf(' - ');
  return separator > 0 ? cleaned.slice(separator + 3) : cleaned;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 1800);
}

async function ensureVisualizer() {
  if (initialized) {
    await audioEngine.ensureContext();
    return;
  }
  await visualizer.initialize(audioEngine);
  visualizer.deterministicStarter();
  initialized = true;
}

async function chooseFile() {
  elements['file-input'].click();
}

async function handleFile(file) {
  if (!file) return;
  try {
    await ensureVisualizer();
    await audioEngine.loadFile(file);
    elements['start-screen'].classList.add('is-hidden');
    elements['track-name'].textContent = file.name.replace(/\.[^.]+$/, '').toUpperCase();
    showToast('SIGNAL CONNECTED');
    requestWakeLock();
  } catch (error) {
    console.error(error);
    showToast('COULD NOT OPEN THAT AUDIO FILE');
  }
}

async function explore() {
  try {
    await ensureVisualizer();
    elements['start-screen'].classList.add('is-hidden');
    elements['track-name'].textContent = 'VISUAL-ONLY MODE';
    showToast('SWIPE OR ROLL TO CHANGE SCENES');
  } catch (error) {
    console.error(error);
    showToast('WEBGL 2 IS REQUIRED');
  }
}

async function togglePlayback() {
  if (!elements.audio.src) {
    chooseFile();
    return;
  }
  try {
    await audioEngine.toggle();
  } catch (error) {
    console.error(error);
    showToast('TAP PLAY AGAIN TO START AUDIO');
  }
}

function updateTransport() {
  const duration = elements.audio.duration;
  const current = elements.audio.currentTime;
  elements.elapsed.textContent = formatTime(current);
  elements.duration.textContent = formatTime(duration);
  if (Number.isFinite(duration) && !elements.seek.matches(':active')) {
    elements.seek.value = String(Math.round((current / duration) * 1000) || 0);
  }
}

function updatePlayButton() {
  elements['play-button'].innerHTML = icon(elements.audio.paused ? 'play' : 'pause');
  elements['play-button'].setAttribute('aria-label', elements.audio.paused ? 'Play' : 'Pause');
  shell.classList.toggle('is-playing', !elements.audio.paused);
  if (!elements.audio.paused) requestWakeLock();
}

function setSheet(sheet, open) {
  sheet.classList.toggle('is-open', open);
  sheet.setAttribute('aria-hidden', String(!open));
  shell.classList.toggle('has-sheet', open || document.querySelector('.sheet.is-open'));
}

function closeAllSheets() {
  document.querySelectorAll('.sheet').forEach((sheet) => setSheet(sheet, false));
}

function renderSceneList() {
  const results = visualizer.search(elements['scene-search'].value, currentSceneFilter);
  elements['scene-list'].innerHTML = results.slice(0, 300).map((name) => `
    <button type="button" data-scene="${encodeURIComponent(name)}" class="${visualizer.baseName() === name ? 'is-current' : ''}">
      <span>${shortSceneName(name)}</span>
      <small>${name}</small>
      <i>${visualizer.favorites.has(name) ? icon('heart') : icon('chevron')}</i>
    </button>
  `).join('') || '<p class="empty-state">NO SCENES FOUND</p>';
}

function toggleCleanMode(force) {
  const clean = typeof force === 'boolean' ? force : shell.dataset.ui !== 'hidden';
  shell.dataset.ui = clean ? 'hidden' : 'visible';
  showToast(clean ? 'CLEAN OUTPUT — TAP THE CORNER TO RESTORE' : 'CONTROLS RESTORED');
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.hidden || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    // Wake Lock is an enhancement; iOS may decline it in low power mode.
  }
}

function updateSegmented(container, value) {
  container.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.value === String(value)));
}

elements['load-button'].addEventListener('click', chooseFile);
elements['open-track'].addEventListener('click', chooseFile);
elements['settings-load'].addEventListener('click', chooseFile);
elements['explore-button'].addEventListener('click', explore);
elements['file-input'].addEventListener('change', (event) => {
  handleFile(event.target.files?.[0]);
  event.target.value = '';
});
elements['play-button'].addEventListener('click', togglePlayback);
elements.seek.addEventListener('input', () => audioEngine.seek(Number(elements.seek.value) / 1000));

elements['previous-button'].addEventListener('click', () => visualizer.previous());
elements['next-button'].addEventListener('click', () => visualizer.next());
elements['random-button'].addEventListener('click', () => visualizer.random());
elements['mutate-button'].addEventListener('click', () => {
  visualizer.mutate();
  showToast('SCENE MUTATED');
});
elements['favorite-button'].addEventListener('click', () => {
  const favorite = visualizer.toggleFavorite();
  showToast(favorite ? 'SCENE SAVED' : 'SCENE REMOVED');
});
elements['auto-button'].addEventListener('click', () => visualizer.setAuto(!visualizer.autoEnabled));
elements['blackout-button'].addEventListener('click', () => visualizer.toggleBlackout());
elements['clean-mode'].addEventListener('click', () => toggleCleanMode(true));
elements['settings-clean'].addEventListener('click', () => {
  closeAllSheets();
  toggleCleanMode(true);
});
elements['restore-ui'].addEventListener('click', (event) => {
  event.stopPropagation();
  toggleCleanMode(false);
});

elements['settings-button'].addEventListener('click', () => setSheet(elements['settings-sheet'], true));
elements['scene-name'].addEventListener('click', () => {
  renderSceneList();
  setSheet(elements['scene-sheet'], true);
});
elements['settings-scenes'].addEventListener('click', () => {
  setSheet(elements['settings-sheet'], false);
  renderSceneList();
  setSheet(elements['scene-sheet'], true);
});
document.querySelectorAll('[data-close-sheet]').forEach((button) => button.addEventListener('click', () => setSheet(elements['settings-sheet'], false)));
document.querySelectorAll('[data-close-scenes]').forEach((button) => button.addEventListener('click', () => setSheet(elements['scene-sheet'], false)));

elements.transition.value = visualizer.transitionSeconds;
elements['transition-output'].value = `${visualizer.transitionSeconds.toFixed(1)}s`;
elements.transition.addEventListener('input', () => {
  visualizer.setTransition(elements.transition.value);
  elements['transition-output'].value = `${Number(elements.transition.value).toFixed(1)}s`;
});
elements.reactivity.value = audioEngine.reactivity;
elements.reactivity.addEventListener('input', () => {
  audioEngine.setReactivity(elements.reactivity.value);
  elements['reactivity-output'].value = `${Number(elements.reactivity.value).toFixed(2)}×`;
});
elements.quality.value = visualizer.quality;
elements['quality-output'].value = `${Math.round(visualizer.quality * 100)}%`;
elements.quality.addEventListener('input', () => {
  visualizer.setQuality(elements.quality.value);
  elements['quality-output'].value = `${Math.round(Number(elements.quality.value) * 100)}%`;
});

updateSegmented(elements['auto-intervals'], visualizer.autoInterval);
elements['auto-intervals'].addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (!button) return;
  visualizer.setAutoInterval(button.dataset.value);
  updateSegmented(elements['auto-intervals'], button.dataset.value);
});
updateSegmented(elements['color-modes'], visualizer.colorMode);
elements['color-modes'].addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (!button) return;
  visualizer.applyColorMode(button.dataset.value);
  updateSegmented(elements['color-modes'], button.dataset.value);
});

elements['scene-search'].addEventListener('input', renderSceneList);
elements['scene-filters'].addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (!button) return;
  currentSceneFilter = button.dataset.value;
  updateSegmented(elements['scene-filters'], currentSceneFilter);
  renderSceneList();
});
updateSegmented(elements['scene-filters'], currentSceneFilter);
elements['scene-list'].addEventListener('click', (event) => {
  const button = event.target.closest('[data-scene]');
  if (!button) return;
  visualizer.load(decodeURIComponent(button.dataset.scene));
  setSheet(elements['scene-sheet'], false);
});

elements['fullscreen-button'].addEventListener('click', async () => {
  try {
    if (!document.documentElement.requestFullscreen) {
      showToast('ADD TO HOME SCREEN FOR FULL DISPLAY');
      return;
    }
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    showToast('ADD TO HOME SCREEN FOR FULL DISPLAY');
  }
});

audioEngine.addEventListener('timeupdate', updateTransport);
audioEngine.addEventListener('durationchange', updateTransport);
audioEngine.addEventListener('play', updatePlayButton);
audioEngine.addEventListener('pause', updatePlayButton);
audioEngine.addEventListener('ended', updatePlayButton);

visualizer.addEventListener('scenechange', (event) => {
  const { name, favorite } = event.detail;
  elements['scene-name'].textContent = shortSceneName(name).toUpperCase();
  elements['favorite-button'].classList.toggle('is-active', favorite);
  elements['favorite-button'].setAttribute('aria-pressed', String(favorite));
});
visualizer.addEventListener('favoritechange', (event) => {
  elements['favorite-button'].classList.toggle('is-active', event.detail.favorite);
  renderSceneList();
});
visualizer.addEventListener('autochange', (event) => {
  elements['auto-button'].classList.toggle('is-active', event.detail.enabled);
  elements['auto-button'].setAttribute('aria-pressed', String(event.detail.enabled));
  showToast(event.detail.enabled ? `AUTO VJ — ${visualizer.autoInterval}s` : 'AUTO VJ OFF');
});
visualizer.addEventListener('blackoutchange', (event) => {
  shell.classList.toggle('is-blackout', event.detail.enabled);
  elements['blackout-button'].classList.toggle('is-active', event.detail.enabled);
});
visualizer.addEventListener('energy', (event) => {
  const energy = event.detail;
  document.querySelectorAll('.energy-meter i').forEach((bar) => {
    const value = energy[bar.dataset.band] ?? 0;
    bar.style.setProperty('--energy', String(Math.max(0.08, value)));
  });
  shell.style.setProperty('--pulse', String(energy.level));
});
visualizer.addEventListener('librarychange', (event) => {
  elements['scene-count'].textContent = `MILKDROP LIBRARY · ${event.detail.count} SCENES`;
  if (elements['scene-sheet'].classList.contains('is-open')) renderSceneList();
});

let touchStart = null;
elements.visualizer.addEventListener('pointerdown', (event) => {
  touchStart = { x: event.clientX, y: event.clientY, at: performance.now() };
});
elements.visualizer.addEventListener('pointerup', (event) => {
  if (!touchStart || shell.dataset.ui === 'hidden') return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  if (Math.abs(dx) > 62 && Math.abs(dx) > Math.abs(dy) * 1.3) {
    if (dx < 0) visualizer.next();
    else visualizer.previous();
  }
  touchStart = null;
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !elements.audio.paused) requestWakeLock();
});
window.addEventListener('keydown', (event) => {
  if (event.target.matches('input')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
  if (event.key === 'ArrowLeft') visualizer.previous();
  if (event.key === 'ArrowRight') visualizer.next();
  if (event.key.toLowerCase() === 'r') visualizer.random();
  if (event.key.toLowerCase() === 'm') visualizer.mutate();
  if (event.key.toLowerCase() === 'b') visualizer.toggleBlackout();
  if (event.key === 'Escape') closeAllSheets();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

updatePlayButton();
