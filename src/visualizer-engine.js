import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

function resolveModuleApi(moduleValue, methodName) {
  let candidate = moduleValue;
  for (let depth = 0; depth < 4 && candidate; depth += 1) {
    if (typeof candidate[methodName] === 'function') return candidate;
    candidate = candidate.default;
  }
  throw new TypeError(`Could not find ${methodName} in the loaded visualizer module.`);
}

const butterchurnApi = resolveModuleApi(butterchurn, 'createVisualizer');
const basePresetPack = resolveModuleApi(butterchurnPresets, 'getPresets');

const MUTABLE_BASE_VALUES = {
  zoom: [0.82, 1.22],
  rot: [-0.18, 0.18],
  warp: [0, 1.8],
  decay: [0.9, 0.9995],
  wave_r: [0, 1],
  wave_g: [0, 1],
  wave_b: [0, 1],
  wave_a: [0.15, 1],
  wave_scale: [0.15, 2.4],
  wave_smoothing: [0, 0.95],
  mv_r: [0, 1],
  mv_g: [0, 1],
  mv_b: [0, 1],
  echo_alpha: [0, 0.65],
  echo_zoom: [0.78, 1.28],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class VisualizerEngine extends EventTarget {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.visualizer = null;
    this.presets = basePresetPack.getPresets();
    this.names = Object.keys(this.presets).sort((a, b) => a.localeCompare(b));
    this.currentName = '';
    this.currentPreset = null;
    this.history = [];
    this.historyIndex = -1;
    this.favorites = new Set(JSON.parse(localStorage.getItem('shadizer:favorites') || '[]'));
    this.quality = Number(localStorage.getItem('shadizer:quality') || 0.72);
    this.transitionSeconds = Number(localStorage.getItem('shadizer:transition') || 3.5);
    this.colorMode = localStorage.getItem('shadizer:color') || 'original';
    this.frameHandle = 0;
    this.running = false;
    this.resizeObserver = null;
    this.resizeRenderer = null;
    this.audioEngine = null;
    this.autoEnabled = false;
    this.autoInterval = Number(localStorage.getItem('shadizer:autoInterval') || 16);
    this.autoLastChangedAt = performance.now();
    this.autoWaitingForBeat = false;
    this.blackout = false;
    this._boundRender = this._render.bind(this);
    this.extendedLibraryLoaded = false;
  }

  async initialize(audioEngine) {
    this.audioEngine = audioEngine;
    const context = await audioEngine.ensureContext();
    this.visualizer = butterchurnApi.createVisualizer(context, this.canvas, {
      width: 640,
      height: 960,
      pixelRatio: 1,
      textureRatio: 1,
    });
    this.visualizer.connectAudio(audioEngine.getAnalysisNode());
    this._observeSize();
    this.applyColorMode(this.colorMode);
    this.start();
    this.loadExtendedLibrary();
    return this;
  }

  async loadExtendedLibrary() {
    if (this.extendedLibraryLoaded) return;
    try {
      const modules = await Promise.all([
        import('butterchurn-presets/lib/butterchurnPresetsExtra.min.js'),
        import('butterchurn-presets/lib/butterchurnPresetsExtra2.min.js'),
        import('butterchurn-presets/lib/butterchurnPresetsMD1.min.js'),
      ]);
      modules.forEach((module) => {
        const pack = resolveModuleApi(module, 'getPresets');
        Object.assign(this.presets, pack.getPresets());
      });
      this.names = Object.keys(this.presets).sort((a, b) => a.localeCompare(b));
      this.extendedLibraryLoaded = true;
      this.dispatchEvent(new CustomEvent('librarychange', { detail: { count: this.names.length } }));
    } catch (error) {
      console.warn('Extended preset library could not be loaded.', error);
    }
  }

  _observeSize() {
    let resizeTimer = 0;
    const resize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!this.visualizer) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = this.quality * dpr;
        const width = clamp(Math.round(rect.width * scale), 320, 1920);
        const height = clamp(Math.round(rect.height * scale), 480, 1920);
        this.visualizer.setRendererSize(width, height);
      }, 80);
    };
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.canvas);
    this.resizeRenderer = resize;
    window.addEventListener('resize', resize);
    resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.frameHandle = requestAnimationFrame(this._boundRender);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  _render() {
    if (!this.running) return;
    if (!document.hidden && !this.blackout) this.visualizer?.render();

    const energy = this.audioEngine?.sample() ?? { beat: false, level: 0, bass: 0, mid: 0, high: 0 };
    this.dispatchEvent(new CustomEvent('energy', { detail: energy }));
    this._tickAuto(energy);
    this.frameHandle = requestAnimationFrame(this._boundRender);
  }

  _tickAuto(energy) {
    if (!this.autoEnabled || !this.currentName) return;
    const elapsed = (performance.now() - this.autoLastChangedAt) / 1000;
    if (elapsed >= this.autoInterval) this.autoWaitingForBeat = true;
    if (this.autoWaitingForBeat && (energy.beat || elapsed >= this.autoInterval + 2.5)) {
      this.random();
      this.autoWaitingForBeat = false;
    }
  }

  load(name, options = {}) {
    const preset = options.preset ?? this.presets[name];
    if (!preset || !this.visualizer) return false;
    const blend = options.blend ?? this.transitionSeconds;
    this.visualizer.loadPreset(preset, blend);
    this.currentPreset = preset;
    this.currentName = name;
    this.autoLastChangedAt = performance.now();

    if (options.pushHistory !== false) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push({ name, preset: options.preset ?? null });
      if (this.history.length > 40) this.history.shift();
      this.historyIndex = this.history.length - 1;
    }

    this.dispatchEvent(new CustomEvent('scenechange', {
      detail: { name, favorite: this.favorites.has(this.baseName(name)), mutated: Boolean(options.preset) },
    }));
    return true;
  }

  random(options = {}) {
    if (!this.names.length) return;
    let next = this.currentName;
    for (let attempts = 0; attempts < 8 && next === this.currentName; attempts += 1) {
      next = this.names[Math.floor(Math.random() * this.names.length)];
    }
    this.load(next, options);
  }

  next() {
    if (!this.currentName) return this.random();
    const index = this.names.indexOf(this.baseName(this.currentName));
    this.load(this.names[(index + 1 + this.names.length) % this.names.length]);
  }

  previous() {
    if (this.historyIndex > 0) {
      this.historyIndex -= 1;
      const item = this.history[this.historyIndex];
      this.load(item.name, { preset: item.preset, pushHistory: false });
      return;
    }
    const index = this.names.indexOf(this.baseName(this.currentName));
    this.load(this.names[(index - 1 + this.names.length) % this.names.length]);
  }

  mutate(strength = 0.34) {
    if (!this.currentPreset) return;
    let clone;
    try {
      clone = structuredClone(this.currentPreset);
    } catch {
      clone = JSON.parse(JSON.stringify(this.currentPreset));
    }
    const baseVals = clone.baseVals ?? clone.base_values;
    if (!baseVals) {
      this.random();
      return;
    }

    const seed = Math.floor(Math.random() * 9999);
    Object.entries(MUTABLE_BASE_VALUES).forEach(([key, [min, max]]) => {
      if (typeof baseVals[key] !== 'number') return;
      const range = max - min;
      const change = (Math.random() * 2 - 1) * range * strength;
      baseVals[key] = clamp(baseVals[key] + change, min, max);
    });

    const name = `${this.baseName(this.currentName)} · MUTATION ${String(seed).padStart(4, '0')}`;
    this.load(name, { preset: clone, blend: Math.max(1.2, this.transitionSeconds) });
  }

  baseName(name = this.currentName) {
    return name.split(' · MUTATION')[0];
  }

  toggleFavorite() {
    if (!this.currentName) return false;
    const name = this.baseName();
    if (this.favorites.has(name)) this.favorites.delete(name);
    else this.favorites.add(name);
    localStorage.setItem('shadizer:favorites', JSON.stringify([...this.favorites]));
    const favorite = this.favorites.has(name);
    this.dispatchEvent(new CustomEvent('favoritechange', { detail: { name, favorite } }));
    return favorite;
  }

  setTransition(value) {
    this.transitionSeconds = Number(value);
    localStorage.setItem('shadizer:transition', String(this.transitionSeconds));
  }

  setQuality(value) {
    this.quality = Number(value);
    localStorage.setItem('shadizer:quality', String(this.quality));
    this.resizeRenderer?.();
  }

  setAuto(enabled) {
    this.autoEnabled = Boolean(enabled);
    this.autoLastChangedAt = performance.now();
    this.autoWaitingForBeat = false;
    this.dispatchEvent(new CustomEvent('autochange', { detail: { enabled: this.autoEnabled } }));
  }

  setAutoInterval(seconds) {
    this.autoInterval = Number(seconds);
    localStorage.setItem('shadizer:autoInterval', String(this.autoInterval));
    this.autoLastChangedAt = performance.now();
  }

  toggleBlackout(force) {
    this.blackout = typeof force === 'boolean' ? force : !this.blackout;
    this.canvas.classList.toggle('is-blackout', this.blackout);
    this.dispatchEvent(new CustomEvent('blackoutchange', { detail: { enabled: this.blackout } }));
    return this.blackout;
  }

  applyColorMode(mode) {
    this.colorMode = mode;
    localStorage.setItem('shadizer:color', mode);
    this.canvas.dataset.color = mode;
  }

  search(query = '', filter = 'all') {
    const normalized = query.trim().toLowerCase();
    let source = this.names;
    if (filter === 'favorites') source = source.filter((name) => this.favorites.has(name));
    if (filter === 'recent') {
      source = [...new Set(this.history.map((entry) => this.baseName(entry.name)).reverse())];
    }
    return source.filter((name) => !normalized || name.toLowerCase().includes(normalized));
  }

  deterministicStarter() {
    if (!this.names.length) return;
    const preferred = this.names.find((name) => hashString(name) % 41 === 0) ?? this.names[0];
    this.load(preferred, { blend: 0 });
  }

  destroy() {
    this.stop();
    this.resizeObserver?.disconnect();
    if (this.resizeRenderer) window.removeEventListener('resize', this.resizeRenderer);
  }
}
