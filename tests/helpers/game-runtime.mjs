import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

class ClassList {
  values = new Set();
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force = !this.contains(value)) {
    force ? this.add(value) : this.remove(value);
    return force;
  }
}

function canvasContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    measureText: text => ({ width: String(text).length * 7 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  }, { get: (target, key) => key in target ? target[key] : () => {} });
}

class Element {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.dataset = {};
    this.classList = new ClassList();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.children = [];
    this.events = new Map();
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.width = 300;
    this.height = 150;
    this._textContent = '';
    for (const [name, value] of Object.entries(attributes)) this.setAttribute(name, value);
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.classList.add(...String(value).split(/\s+/));
    else if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    else if (['hidden', 'disabled', 'open'].includes(name)) this[name] = true;
    else this[name] = ['width', 'height', 'tabindex'].includes(name) ? Number(value) : value;
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  get firstElementChild() { return this.children[0] ?? null; }
  set textContent(value) { this._textContent = String(value); this.children = []; }
  get textContent() { return this._textContent + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { this.children = []; this._textContent = ''; parseHTML(String(value), this); }
  get innerHTML() { return this._textContent; }
  addEventListener(type, callback) {
    if (!this.events.has(type)) this.events.set(type, []);
    this.events.get(type).push(callback);
  }
  removeEventListener(type, callback) {
    this.events.set(type, (this.events.get(type) ?? []).filter(fn => fn !== callback));
  }
  dispatch(type, properties = {}) {
    const event = { target: this, currentTarget: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...properties };
    const results = (this.events.get(type) ?? []).map(callback => callback(event));
    return Promise.all(results);
  }
  querySelectorAll(selector) {
    const descendants = [];
    const walk = element => { for (const child of element.children) { descendants.push(child); walk(child); } };
    walk(this);
    return descendants.filter(element => selector.split(',').some(part => matchesSelector(element, part.trim())));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  getContext(type) { assert.equal(type, '2d'); return this.context ??= canvasContext(); }
  getBoundingClientRect() { return { left: 20, top: 30, width: this.width, height: this.height, right: this.width + 20, bottom: this.height + 30 }; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { globalThis.document.activeElement = this; }
  setPointerCapture() {}
  requestPointerLock() {
    globalThis.document.pointerLockElement = this;
    return globalThis.document.dispatch('pointerlockchange');
  }
}

function matchesSelector(element, selector) {
  const parts = selector.split(/\s+/);
  const simple = parts.pop();
  let matches;
  if (simple.startsWith('#')) matches = element.id === simple.slice(1);
  else if (simple.startsWith('.')) matches = element.classList.contains(simple.slice(1));
  else if (simple.startsWith('[')) {
    const [, name, value] = simple.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/) ?? [];
    matches = name in element.attributes && (value === undefined || element.attributes[name] === value);
  } else matches = element.tagName === simple.toUpperCase();
  if (!matches || !parts.length) return matches;
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (matchesSelector(ancestor, parts.join(' '))) return true;
  }
  return false;
}

function parseHTML(html, root) {
  const stack = [root];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?([\w-]+)\b([^>]*?)>|([^<]+)/g)) {
    if (match[3]) { stack.at(-1)._textContent += match[3]; continue; }
    if (!match[1]) continue;
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex(element => element.tagName === tag.toUpperCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const attributes = {};
    for (const attribute of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attributes[attribute[1]] = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
    }
    const element = stack.at(-1).appendChild(new Element(tag, attributes));
    if (!voidTags.has(tag) && !match[0].endsWith('/>')) stack.push(element);
  }
  return root;
}

// Keep real Three geometry, materials, lights, world generation and gameplay.
// Only browser facilities and GPU submission are replaced for this integration run.
export async function createGameRuntime(options = {}) {
  const dist = new URL('../../dist/', import.meta.url);
  const html = await fs.readFile(new URL('index.html', dist), 'utf8');
  const document = parseHTML(html, new Element('document'));
  document.documentElement = document.querySelector('html');
  document.body = document.querySelector('body');
  document.getElementById = id => document.querySelector(`#${id}`);
  document.createElement = tag => new Element(tag);
  document.exitPointerLock = () => { document.pointerLockElement = null; return document.dispatch('pointerlockchange'); };
  document.exitFullscreen = async () => { document.fullscreenElement = null; };
  document.documentElement.requestFullscreen = async () => { document.fullscreenElement = document.documentElement; };
  const windowEvents = new Element('window');
  const storage = new Map(options.initialStorage ?? []);
  let now = 0, frame;
  const rendererInstances = [];
  class MockRenderer {
    shadowMap = {};
    info = { render: { calls: 0 } };
    constructor() { rendererInstances.push(this); }
    setPixelRatio() {}
    setSize() {}
    render(scene, camera) {
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      this.info.render.calls++;
    }
  }
  const previous = new Map();
  const globals = { document, window: {}, location: { search: '?qa' }, innerWidth: 1440,
    innerHeight: 900, devicePixelRatio: 1, matchMedia: query => ({ matches: options.coarse === true && query.includes('pointer:coarse') }),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    requestAnimationFrame: callback => { frame = callback; return 1; },
    performance: { now: () => now }, MockRenderer };
  for (const [name, value] of Object.entries(globals)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const actualSetTimeout = globalThis.setTimeout;
  const timers = new Set();
  globalThis.setTimeout = (...args) => { const timer = actualSetTimeout(...args); timer.unref(); timers.add(timer); return timer; };
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'backrooms-game-test-'));
  const entry = path.join(temporaryDirectory, 'game-under-test.mjs');
  let source = await fs.readFile(new URL('game.js', dist), 'utf8');
  const threeImport = "import * as THREE from './vendor/three.module.js';";
  assert.ok(source.includes(threeImport), 'The renderer seam must match the game entry import.');
  source = source.replace(threeImport, "import * as REAL_THREE from './vendor/three.module.js';\nconst THREE={...REAL_THREE,WebGLRenderer:globalThis.MockRenderer};");
  source = source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (_, quote, relative) => `from ${quote}${new URL(relative, dist).href}${quote}`);
  try {
    await fs.writeFile(entry, source);
    await import(pathToFileURL(entry).href);
  } catch (error) { throw new Error(`Game initialization failed: ${error.stack}`, { cause: error }); }
  const element = id => {
    const found = document.getElementById(id);
    assert.ok(found, `Missing expected interface element #${id}`);
    return found;
  };
  return {
    qa: window.__backrooms, document, element, storage, rendererInstances,
    async key(code, properties = {}) {
      await windowEvents.dispatch('keydown', { code, ...properties });
      // Escape's native dialog default action follows keydown in a browser.
      if (code === 'Escape') {
        const modal = document.querySelectorAll('dialog').find(dialog => dialog.open);
        if (modal) await modal.dispatch('cancel');
      }
    },
    release: code => windowEvents.dispatch('keyup', { code }),
    event: (type, properties) => windowEvents.dispatch(type, properties),
    frames(count, milliseconds = 50) {
      for (let i = 0; i < count; i++) {
        now += milliseconds;
        const next = frame; frame = undefined;
        assert.equal(typeof next, 'function', 'The game animation loop must keep scheduling.');
        next(now);
      }
    },
    async dispose() {
      timers.forEach(timer => clearTimeout(timer));
      globalThis.setTimeout = actualSetTimeout;
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    },
  };
}
