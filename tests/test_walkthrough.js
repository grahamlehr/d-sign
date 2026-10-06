/* ==========================================================================
   D-Sign v2.2 · Walkthrough & Onboarding Tour Test Suite
   ========================================================================== */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('D-SIGN v2.2 · WALKTHROUGH & ONBOARDING TOUR VERIFICATION');
console.log('======================================================================\n');

// 1. Verify CSS styles in css/components.css
console.log('--- 1. MODERNIST CSS RULES IN css/components.css ---');
const cssPath = path.join(__dirname, '..', 'css', 'components.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

const requiredSelectors = [
  '.walkthrough-overlay-container',
  '.walkthrough-backdrop',
  '.walkthrough-scrim',
  '#walkthrough-spotlight-cutout',
  '#walkthrough-spotlight-border',
  '.walkthrough-card',
  '.walkthrough-badge',
  '.walkthrough-step-dot',
  '.walkthrough-btn-row',
  '[data-theme="backstage"] .walkthrough-card',
  '[data-theme="backstage"] .walkthrough-badge'
];

for (const sel of requiredSelectors) {
  assert(cssContent.includes(sel), `Missing CSS selector: ${sel}`);
  console.log(`  ✓ [PASS] CSS selector '${sel}' present in css/components.css`);
}

// Check 0px border radius
assert(cssContent.includes('border-radius: 0 !important'), 'CSS must enforce 0px border-radius');
console.log('  ✓ [PASS] Strict 0px border-radius verified in walkthrough styles');

// Check Tabular nums
assert(cssContent.includes('tabular-nums'), 'CSS must include tabular-nums for counter');
console.log('  ✓ [PASS] Tabular numbers verified for badge & counters');

// 2. Headless DOM Mocking & walkthrough.js Execution
console.log('\n--- 2. MODULE EXPORTS & 9 STEPS VERIFICATION ---');

// Mock localStorage
const storageMap = new Map();
const mockLocalStorage = {
  getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear()
};

// Mock DOM elements
class MockElement {
  constructor(tagName, id = '', className = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = className;
    this.classList = {
      _classes: new Set(className ? className.split(/\s+/) : []),
      add: function (...cls) { cls.forEach(c => this._classes.add(c)); },
      remove: function (...cls) { cls.forEach(c => this._classes.delete(c)); },
      toggle: function (cls, force) {
        if (force === undefined) {
          if (this._classes.has(cls)) { this._classes.delete(cls); return false; }
          else { this._classes.add(cls); return true; }
        } else if (force) {
          this._classes.add(cls); return true;
        } else {
          this._classes.delete(cls); return false;
        }
      },
      contains: function (cls) { return this._classes.has(cls); }
    };
    this.attributes = new Map();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this.listeners = new Map();
    this.offsetWidth = 390;
    this.offsetHeight = 220;
    this.isConnected = true;
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    if (!html) return;
    // Extract elements with id or class or tags
    const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>/g;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = match[1];
      if (tagName.startsWith('/')) continue;
      const attrsStr = match[2];
      const idMatch = attrsStr.match(/id=['"]([^'"]+)['"]/);
      const classMatch = attrsStr.match(/class=['"]([^'"]+)['"]/);
      const child = new MockElement(tagName, idMatch ? idMatch[1] : '', classMatch ? classMatch[1] : '');
      this.appendChild(child);
    }
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) || null; }
  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }
  removeEventListener(event, handler) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(h => h !== handler));
  }
  dispatchEvent(evt) {
    const handlers = this.listeners.get(evt.type) || [];
    for (const h of handlers) h(evt);
  }
  click() {
    this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {} });
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
  }
  getBoundingClientRect() {
    return { top: 100, left: 100, bottom: 200, right: 300, width: 200, height: 100 };
  }
  contains(node) {
    if (node === this) return true;
    for (const child of this.children) {
      if (child.contains(node)) return true;
    }
    return false;
  }
  scrollIntoView() {}
  focus() {}
  querySelector(sel) {
    return findInTree(this, sel);
  }
  querySelectorAll(sel) {
    const res = [];
    findAllInTree(this, sel, res);
    return res;
  }
}

function findInTree(node, sel) {
  if (sel.startsWith('#')) {
    const id = sel.slice(1);
    if (node.id === id) return node;
  } else if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    if (node.classList && node.classList.contains(cls)) return node;
  } else if (node.tagName && node.tagName.toLowerCase() === sel.toLowerCase()) {
    return node;
  }
  for (const child of node.children) {
    const found = findInTree(child, sel);
    if (found) return found;
  }
  return null;
}

function findAllInTree(node, sel, res) {
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    if (node.classList && node.classList.contains(cls)) res.push(node);
  }
  for (const child of node.children) {
    findAllInTree(child, sel, res);
  }
}

// Setup Global Mock
global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: (event, handler) => {
    if (!window.listeners) window.listeners = new Map();
    if (!window.listeners.has(event)) window.listeners.set(event, []);
    window.listeners.get(event).push(handler);
  },
  removeEventListener: (event, handler) => {
    if (!window.listeners || !window.listeners.has(event)) return;
    window.listeners.set(event, window.listeners.get(event).filter(h => h !== handler));
  },
  dispatchEvent: (evt) => {
    if (!window.listeners || !window.listeners.has(evt.type)) return;
    for (const h of window.listeners.get(evt.type)) h(evt);
  },
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id)
};
global.localStorage = mockLocalStorage;
global.document = {
  readyState: 'complete',
  body: new MockElement('body'),
  createElement: (tagName) => new MockElement(tagName),
  getElementById: (id) => findInTree(document.body, '#' + id),
  querySelector: (sel) => findInTree(document.body, sel),
  addEventListener: (event, handler) => {
    if (!document.listeners) document.listeners = new Map();
    if (!document.listeners.has(event)) document.listeners.set(event, []);
    document.listeners.get(event).push(handler);
  },
  removeEventListener: () => {}
};

// Add simulated target elements to document.body
const navBrand = new MockElement('div', '', 'nav-brand-group');
const saveTemplateBtn = new MockElement('button', 'save-template-btn');
const presetTabs = new MockElement('div', 'preset-tabs');
const bgUploadZone = new MockElement('div', 'bg-upload-zone');
const layersContainer = new MockElement('div', 'layers-list-container');
const textX = new MockElement('input', 'text-x');
const previewFrame = new MockElement('div', 'preview-frame');
previewFrame.getBoundingClientRect = () => ({ top: 120, left: 450, bottom: 980, right: 1800, width: 1350, height: 860 });
const quickToolbar = new MockElement('div', '', 'canvas-quick-toolbar');
const exportBtn = new MockElement('button', 'export-btn');
exportBtn.getBoundingClientRect = () => ({ top: 10, left: 1780, bottom: 46, right: 1900, width: 120, height: 36 });

document.body.appendChild(navBrand);
document.body.appendChild(saveTemplateBtn);
document.body.appendChild(presetTabs);
document.body.appendChild(bgUploadZone);
document.body.appendChild(layersContainer);
document.body.appendChild(textX);
document.body.appendChild(previewFrame);
document.body.appendChild(quickToolbar);
document.body.appendChild(exportBtn);

// Import walkthrough.js dynamically
import('../js/walkthrough.js').then((walkthrough) => {
  const { initWalkthrough, startWalkthrough, stopWalkthrough, WALKTHROUGH_STEPS, goToStep, nextStep, prevStep } = walkthrough;

  assert(typeof initWalkthrough === 'function', 'initWalkthrough must be exported as a function');
  assert(typeof startWalkthrough === 'function', 'startWalkthrough must be exported as a function');
  assert(typeof stopWalkthrough === 'function', 'stopWalkthrough must be exported as a function');
  console.log('  ✓ [PASS] initWalkthrough, startWalkthrough, stopWalkthrough successfully exported');

  // Verify 9 Steps
  assert.strictEqual(WALKTHROUGH_STEPS.length, 9, 'Must define exactly 9 steps');
  console.log(`  ✓ [PASS] Exactly 9 steps defined in WALKTHROUGH_STEPS`);

  const expectedSteps = [
    { num: 1, targetMatch: '.nav-brand-group', titleMatch: 'Welcome' },
    { num: 2, targetMatch: '#preset-tabs', titleMatch: 'Screen Format' },
    { num: 3, targetMatch: '#bg-upload-zone', titleMatch: 'Background' },
    { num: 4, targetMatch: '#master-designs-bar', titleMatch: 'Master Designs' },
    { num: 5, targetMatch: '#layers-list-container', titleMatch: 'Layers' },
    { num: 6, targetMatch: '#text-x', titleMatch: 'Precision Numeric' },
    { num: 7, targetMatch: '#preview-frame', titleMatch: 'Direct Canvas Manipulation' },
    { num: 8, targetMatch: '.canvas-quick-toolbar', titleMatch: 'Guides' },
    { num: 9, targetMatch: '#export-btn', titleMatch: 'Export' }
  ];

  expectedSteps.forEach((exp, idx) => {
    const step = WALKTHROUGH_STEPS[idx];
    assert(step.target.includes(exp.targetMatch), `Step ${exp.num} target must contain '${exp.targetMatch}'`);
    assert(step.title.includes(exp.titleMatch) || step.title.toLowerCase().includes(exp.titleMatch.toLowerCase()), `Step ${exp.num} title must contain '${exp.titleMatch}'`);
    assert(step.description && step.description.length > 20, `Step ${exp.num} description must be detailed`);
    console.log(`  ✓ [PASS] Step ${idx + 1}: ${step.title} (Target: ${step.target})`);
  });

  // 3. Tour Execution & DOM Manipulation
  console.log('\n--- 3. TOUR EXECUTION & SPOTLIGHT / CARD DOM ---');
  mockLocalStorage.clear();

  startWalkthrough(0);
  const container = document.getElementById('walkthrough-overlay-container');
  assert(container, 'Overlay container should be injected into DOM');
  assert.strictEqual(container.style.display, 'block');

  const cutout = document.getElementById('walkthrough-spotlight-cutout');
  const border = document.getElementById('walkthrough-spotlight-border');
  const card = document.getElementById('walkthrough-card');
  const counter = document.getElementById('walkthrough-step-counter');

  assert(cutout, 'Spotlight cutout rect should exist');
  assert(border, 'Spotlight border rect should exist');
  assert(card, 'Walkthrough card element should exist');
  assert.strictEqual(counter.textContent, '01 / 09', 'Step counter should show 01 / 09');
  console.log('  ✓ [PASS] Overlay container, SVG cutout, border, and card rendered with step counter 01 / 09');

  // Test Step 4 missing target graceful fallback (e.g. #master-designs-bar)
  console.log('\n--- 4. SMOOTH FALLBACK FOR UNRENDERED TARGETS ---');
  goToStep(3); // Step 4 (index 3)
  assert.strictEqual(counter.textContent, '04 / 09');
  assert.strictEqual(cutout.getAttribute('width'), '0', 'Cutout width should be 0 when target is missing');
  assert.strictEqual(border.style.display, 'none', 'Spotlight border should be hidden when target is missing');
  assert(card.style.top === '50%' && card.style.left === '50%', 'Card should be centered in viewport when target is missing');
  console.log('  ✓ [PASS] Step 4 gracefully centered card without spotlight crash for unrendered #master-designs-bar');

  // Test Step 9 Finish Button
  console.log('\n--- 5. FINISH STEP & PERSISTENCE ---');
  goToStep(8); // Step 9 (index 8)
  assert.strictEqual(counter.textContent, '09 / 09');
  const nextBtn = document.getElementById('walkthrough-next-btn');
  assert.strictEqual(nextBtn.textContent, 'Finish', 'Last step button should say Finish');
  
  // Click Finish
  nextBtn.click();
  assert.strictEqual(container.style.display, 'none', 'Walkthrough should be hidden after finishing');
  assert.strictEqual(mockLocalStorage.getItem('dsign_walkthrough_seen'), 'true', 'Persistence flag should be stored in localStorage');
  console.log('  ✓ [PASS] Finish button closes tour and sets dsign_walkthrough_seen in localStorage');

  // 6. Keyboard Listeners
  console.log('\n--- 6. KEYBOARD NAVIGATION ---');
  startWalkthrough(0);
  assert.strictEqual(counter.textContent, '01 / 09');

  // ArrowRight -> Step 2
  window.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: () => {}, stopPropagation: () => {} });
  assert.strictEqual(counter.textContent, '02 / 09');
  console.log('  ✓ [PASS] ArrowRight navigated to step 02 / 09');

  // ArrowLeft -> Step 1
  window.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', preventDefault: () => {}, stopPropagation: () => {} });
  assert.strictEqual(counter.textContent, '01 / 09');
  console.log('  ✓ [PASS] ArrowLeft navigated back to step 01 / 09');

  // Escape -> Close
  window.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} });
  assert.strictEqual(container.style.display, 'none');
  console.log('  ✓ [PASS] Escape closed walkthrough overlay');

  // 7. Re-triggering
  console.log('\n--- 7. RE-TRIGGERING CAPABILITY ---');
  startWalkthrough(4); // Start at step 5
  assert.strictEqual(container.style.display, 'block');
  assert.strictEqual(counter.textContent, '05 / 09');
  stopWalkthrough(true);
  assert.strictEqual(container.style.display, 'none');
  console.log('  ✓ [PASS] startWalkthrough(4) successfully re-triggered tour at step 5');

  console.log('\n======================================================================');
  console.log('ALL WALKTHROUGH TESTS PASSED (100%)');
  console.log('======================================================================\n');
}).catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
