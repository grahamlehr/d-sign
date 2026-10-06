/* ==========================================================================
   CueSmith Modernist Walkthrough & Onboarding Tour Engine
   D-Sign v2.2 Modular Architecture · Archivo · Strict 0px Radius
   ========================================================================== */

/**
 * 9-step curated walkthrough for D-Sign v2.2
 */
export const WALKTHROUGH_STEPS = [
  {
    stepId: 'welcome',
    target: '.nav-brand-group, #save-template-btn',
    title: 'Welcome to D-Sign v2.2',
    description: 'Digital signage authoring with portable .dsign template packaging. Bundle high-res imagery, typography, transparent graphics, and layout manifests into self-contained archives.'
  },
  {
    stepId: 'formats',
    target: '#preset-tabs',
    title: 'Screen Formats & Resolution',
    description: 'Quickly toggle standard 1080p Full HD, 4K Ultra HD in landscape or portrait, or enter custom pixel resolutions for any physical display panel.'
  },
  {
    stepId: 'background',
    target: '#bg-upload-zone',
    title: 'Background Graphics & Ingestion',
    description: 'Drag & drop photography or graphics directly into this zone or anywhere onto the canvas. Supports high-resolution JPG, PNG, and WebP assets with zero distortion.'
  },
  {
    stepId: 'master-designs',
    target: '#master-designs-bar, .master-designs-bar, #master-designs',
    title: 'Master Designs & Artboards',
    description: 'Orchestrate multi-screen sign campaigns. Switch between artboards, duplicate master layouts, and coordinate synchronized batch production exports.'
  },
  {
    stepId: 'layers',
    target: '#layers-list-container',
    title: 'Polymorphic Layers',
    description: 'Manage typographic text blocks and 32-bit transparent PNG cutouts in a unified z-index layer stack. Drag handles to reorder, toggle visibility, and duplicate with Cmd+D.'
  },
  {
    stepId: 'precision-inputs',
    target: '#text-x',
    title: 'Precision Numeric Inputs',
    description: 'Directly type or slide exact coordinates, scale factors, and font sizes. Keyboard arrow keys nudge active layers with 0.1% to 5.0% accuracy for pixel-level precision.'
  },
  {
    stepId: 'canvas-manipulation',
    target: '#preview-frame',
    title: 'Direct Canvas Manipulation',
    description: 'Interact directly with your composition: click & drag layers, scale with 4 corner resize handles, rotate with magnetic snapping, and double-click to edit text live.'
  },
  {
    stepId: 'guides-alignment',
    target: '.canvas-quick-toolbar',
    title: 'Canvas Guides & Alignment',
    description: 'Toggle magnetic center-snap guidelines (S key), pan background images (Space+Drag), center layers instantly, and zoom to fit your display screen.'
  },
  {
    stepId: 'export',
    target: '#export-btn',
    title: 'Production PNG & Batch Export',
    description: 'Render broadcast-ready, production-grade PNG raster files at native display resolution with sharp typography, transparency, and photographic filters.'
  }
];

let currentStepIndex = 0;
let isActive = false;
let overlayContainer = null;
let keydownHandler = null;
let resizeHandler = null;
let resizeRaf = null;

/**
 * Resolves a comma-separated selector string to the first matching DOM element.
 * @param {string} selector
 * @returns {HTMLElement|null}
 */
function resolveTarget(selector) {
  if (!selector || typeof document === 'undefined') return null;
  const parts = selector.split(',').map((s) => s.trim());
  for (const part of parts) {
    try {
      const el = document.querySelector(part);
      if (el) return el;
    } catch (_) {
      // Ignore selector syntax issues on fallbacks
    }
  }
  return null;
}

/**
 * Creates and injects the overlay container with dynamic SVG spotlight mask and Modernist card.
 * @returns {HTMLElement}
 */
function createOverlay() {
  if (typeof document === 'undefined') return null;
  if (overlayContainer && document.body.contains(overlayContainer)) {
    return overlayContainer;
  }

  overlayContainer = document.createElement('div');
  overlayContainer.id = 'walkthrough-overlay-container';
  overlayContainer.className = 'walkthrough-overlay-container';
  overlayContainer.setAttribute('role', 'dialog');
  overlayContainer.setAttribute('aria-modal', 'true');
  overlayContainer.setAttribute('aria-label', 'D-Sign Onboarding Walkthrough');

  overlayContainer.innerHTML = `
    <svg class="walkthrough-backdrop" id="walkthrough-backdrop" width="100%" height="100%" aria-hidden="true">
      <defs>
        <mask id="walkthrough-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect id="walkthrough-spotlight-cutout" x="0" y="0" width="0" height="0" fill="black" />
        </mask>
      </defs>
      <rect class="walkthrough-scrim" width="100%" height="100%" mask="url(#walkthrough-spotlight-mask)" />
      <rect id="walkthrough-spotlight-border" x="0" y="0" width="0" height="0" fill="none" />
    </svg>

    <div class="walkthrough-card" id="walkthrough-card" role="region" aria-label="Walkthrough Step Card" tabindex="-1">
      <div class="walkthrough-card-header">
        <div class="walkthrough-badge tn">
          <span class="walkthrough-badge-dot"></span>
          <span id="walkthrough-step-counter">01 / 09</span>
        </div>
        <div class="walkthrough-step-dots" id="walkthrough-step-dots" aria-hidden="true"></div>
        <button class="walkthrough-close-btn" id="walkthrough-close-btn" aria-label="Close walkthrough" title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="walkthrough-card-body">
        <h3 class="walkthrough-title" id="walkthrough-title"></h3>
        <p class="walkthrough-desc" id="walkthrough-desc"></p>
      </div>

      <div class="walkthrough-card-footer">
        <div class="walkthrough-kbd-hints">
          <span class="kbd">←</span> <span class="kbd">→</span>
          <span class="kbd">Esc</span>
        </div>
        <div class="walkthrough-btn-row">
          <button class="btn btn-ghost" id="walkthrough-skip-btn">Skip</button>
          <button class="btn btn-secondary" id="walkthrough-back-btn">Back</button>
          <button class="btn btn-primary" id="walkthrough-next-btn">Next</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlayContainer);

  // Wire buttons
  const skipBtn = overlayContainer.querySelector('#walkthrough-skip-btn');
  const backBtn = overlayContainer.querySelector('#walkthrough-back-btn');
  const nextBtn = overlayContainer.querySelector('#walkthrough-next-btn');
  const closeBtn = overlayContainer.querySelector('#walkthrough-close-btn');

  if (skipBtn) skipBtn.addEventListener('click', () => stopWalkthrough(true));
  if (closeBtn) closeBtn.addEventListener('click', () => stopWalkthrough(true));
  if (backBtn) backBtn.addEventListener('click', () => prevStep());
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStepIndex >= WALKTHROUGH_STEPS.length - 1) {
        stopWalkthrough(true);
        try {
          import('./dom.js').then((m) => {
            if (m && typeof m.showToast === 'function') {
              m.showToast('Walkthrough complete · Welcome to D-Sign v2.2!');
            }
          }).catch(() => {});
        } catch (_) {}
      } else {
        nextStep();
      }
    });
  }

  // Prevent clicks inside card from propagating
  const card = overlayContainer.querySelector('#walkthrough-card');
  if (card) {
    card.addEventListener('click', (e) => e.stopPropagation());
  }

  return overlayContainer;
}

/**
 * Updates the SVG spotlight mask cutout and positions the card relative to target element.
 * @param {HTMLElement|null} targetEl
 */
function updateSpotlightAndCard(targetEl) {
  if (typeof window === 'undefined') return;

  const cutout = document.getElementById('walkthrough-spotlight-cutout');
  const border = document.getElementById('walkthrough-spotlight-border');
  const card = document.getElementById('walkthrough-card');
  if (!card) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let hasSpotlight = false;
  let spotRect = null;

  if (targetEl && targetEl.isConnected) {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      hasSpotlight = true;
      const pad = 6;
      const x = Math.max(0, Math.round(rect.left - pad));
      const y = Math.max(0, Math.round(rect.top - pad));
      const w = Math.min(vw - x, Math.round(rect.width + pad * 2));
      const h = Math.min(vh - y, Math.round(rect.height + pad * 2));
      spotRect = { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h };

      if (cutout) {
        cutout.setAttribute('x', x);
        cutout.setAttribute('y', y);
        cutout.setAttribute('width', w);
        cutout.setAttribute('height', h);
      }
      if (border) {
        border.setAttribute('x', x);
        border.setAttribute('y', y);
        border.setAttribute('width', w);
        border.setAttribute('height', h);
        border.style.display = 'block';
      }
    }
  }

  if (!hasSpotlight) {
    if (cutout) {
      cutout.setAttribute('width', '0');
      cutout.setAttribute('height', '0');
    }
    if (border) {
      border.style.display = 'none';
    }
  }

  // Positioning the card
  const cardWidth = card.offsetWidth || 390;
  const cardHeight = card.offsetHeight || 220;
  const margin = 16;
  const offset = 14;

  if (!hasSpotlight || !spotRect) {
    // Graceful fallback: center card in viewport
    card.style.top = '50%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    return;
  }

  card.style.transform = 'none';

  let top = margin;
  let left = margin;

  // 1. If target is in top navigation bar
  if (spotRect.bottom < 90) {
    top = spotRect.bottom + offset;
    left = Math.min(vw - cardWidth - margin, Math.max(margin, spotRect.left));
  }
  // 2. If target is preview canvas (large centered element)
  else if (spotRect.width > vw * 0.55 && spotRect.height > vh * 0.55) {
    top = Math.max(margin, vh - cardHeight - 32);
    left = Math.max(margin, vw - cardWidth - 32);
  }
  // 3. If target is in the sidebar (left 45% of viewport)
  else if (spotRect.right < vw * 0.45 && (vw - spotRect.right) >= (cardWidth + offset + margin)) {
    left = spotRect.right + offset;
    top = Math.min(vh - cardHeight - margin, Math.max(margin, spotRect.top));
  }
  // 4. If space below target fits card
  else if (vh - spotRect.bottom >= (cardHeight + offset + margin)) {
    top = spotRect.bottom + offset;
    left = Math.min(vw - cardWidth - margin, Math.max(margin, spotRect.left));
  }
  // 5. If space above target fits card
  else if (spotRect.top >= (cardHeight + offset + margin)) {
    top = spotRect.top - cardHeight - offset;
    left = Math.min(vw - cardWidth - margin, Math.max(margin, spotRect.left));
  }
  // 6. If space to the left fits card
  else if (spotRect.left >= (cardWidth + offset + margin)) {
    left = spotRect.left - cardWidth - offset;
    top = Math.min(vh - cardHeight - margin, Math.max(margin, spotRect.top));
  }
  // 7. Fallback clamp
  else {
    top = Math.min(vh - cardHeight - margin, Math.max(margin, spotRect.bottom + offset));
    left = Math.min(vw - cardWidth - margin, Math.max(margin, spotRect.left));
  }

  // Safety bounds
  top = Math.max(margin, Math.min(vh - cardHeight - margin, top));
  left = Math.max(margin, Math.min(vw - cardWidth - margin, left));

  card.style.top = `${Math.round(top)}px`;
  card.style.left = `${Math.round(left)}px`;
}

/**
 * Renders the current step content, indicators, and updates positioning.
 */
function renderCurrentStep() {
  if (!isActive || typeof document === 'undefined') return;
  const step = WALKTHROUGH_STEPS[currentStepIndex];
  if (!step) return;

  const targetEl = resolveTarget(step.target);

  // Scroll target smoothly into view if present
  if (targetEl) {
    try {
      targetEl.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
    } catch (_) {}
  }

  // Counter
  const counterEl = document.getElementById('walkthrough-step-counter');
  if (counterEl) {
    const cur = String(currentStepIndex + 1).padStart(2, '0');
    const tot = String(WALKTHROUGH_STEPS.length).padStart(2, '0');
    counterEl.textContent = `${cur} / ${tot}`;
  }

  // Dots
  const dotsContainer = document.getElementById('walkthrough-step-dots');
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    WALKTHROUGH_STEPS.forEach((_, idx) => {
      const dot = document.createElement('span');
      dot.className = 'walkthrough-step-dot';
      if (idx === currentStepIndex) {
        dot.classList.add('active');
      } else if (idx < currentStepIndex) {
        dot.classList.add('completed');
      }
      dot.setAttribute('title', `Step ${idx + 1}`);
      dot.addEventListener('click', () => goToStep(idx));
      dotsContainer.appendChild(dot);
    });
  }

  // Title & description
  const titleEl = document.getElementById('walkthrough-title');
  const descEl = document.getElementById('walkthrough-desc');
  if (titleEl) titleEl.textContent = step.title;
  if (descEl) descEl.textContent = step.description;

  // Buttons
  const backBtn = document.getElementById('walkthrough-back-btn');
  const nextBtn = document.getElementById('walkthrough-next-btn');
  if (backBtn) {
    backBtn.disabled = currentStepIndex === 0;
    backBtn.style.opacity = currentStepIndex === 0 ? '0.35' : '1';
    backBtn.style.cursor = currentStepIndex === 0 ? 'not-allowed' : 'pointer';
  }
  if (nextBtn) {
    if (currentStepIndex === WALKTHROUGH_STEPS.length - 1) {
      nextBtn.textContent = 'Finish';
    } else {
      nextBtn.textContent = 'Next';
    }
  }

  updateSpotlightAndCard(targetEl);
}

/**
 * Keydown handler for walkthrough keyboard navigation.
 * ArrowRight/Enter: next, ArrowLeft: prev, Escape: close.
 * @param {KeyboardEvent} e
 */
function onKeyDown(e) {
  if (!isActive) return;

  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (currentStepIndex >= WALKTHROUGH_STEPS.length - 1) {
      stopWalkthrough(true);
    } else {
      nextStep();
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    e.stopPropagation();
    prevStep();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    stopWalkthrough(true);
  }
}

/**
 * Resize and scroll handler for continuous spotlight tracking.
 */
function onResizeOrScroll() {
  if (!isActive) return;
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const step = WALKTHROUGH_STEPS[currentStepIndex];
    if (step) {
      const targetEl = resolveTarget(step.target);
      updateSpotlightAndCard(targetEl);
    }
  });
}

/**
 * Navigate directly to a step index.
 * @param {number} index
 */
export function goToStep(index) {
  if (index < 0 || index >= WALKTHROUGH_STEPS.length) return;
  currentStepIndex = index;
  renderCurrentStep();
}

/**
 * Navigate to next step.
 */
export function nextStep() {
  if (currentStepIndex < WALKTHROUGH_STEPS.length - 1) {
    goToStep(currentStepIndex + 1);
  }
}

/**
 * Navigate to previous step.
 */
export function prevStep() {
  if (currentStepIndex > 0) {
    goToStep(currentStepIndex - 1);
  }
}

/**
 * Start or restart the walkthrough.
 * @param {number} [startIndex=0]
 */
export function startWalkthrough(startIndex = 0) {
  if (typeof document === 'undefined') return;

  createOverlay();
  if (overlayContainer) {
    overlayContainer.style.display = 'block';
  }

  isActive = true;
  currentStepIndex = Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, startIndex));

  if (!keydownHandler) {
    keydownHandler = onKeyDown;
    window.addEventListener('keydown', keydownHandler, true);
  }
  if (!resizeHandler) {
    resizeHandler = onResizeOrScroll;
    window.addEventListener('resize', resizeHandler);
    window.addEventListener('scroll', resizeHandler, true);
  }

  renderCurrentStep();

  const card = document.getElementById('walkthrough-card');
  if (card) {
    try { card.focus(); } catch (_) {}
  }
}

/**
 * Stop and dismiss the walkthrough.
 * @param {boolean} [markSeen=true]
 */
export function stopWalkthrough(markSeen = true) {
  isActive = false;

  if (markSeen && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('dsign_walkthrough_seen', 'true');
    } catch (_) {}
  }

  if (keydownHandler && typeof window !== 'undefined') {
    window.removeEventListener('keydown', keydownHandler, true);
    keydownHandler = null;
  }
  if (resizeHandler && typeof window !== 'undefined') {
    window.removeEventListener('resize', resizeHandler);
    window.removeEventListener('scroll', resizeHandler, true);
    resizeHandler = null;
  }
  if (resizeRaf && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = null;
  }

  if (overlayContainer && overlayContainer.parentNode) {
    overlayContainer.style.display = 'none';
  }
}

/**
 * Initialize walkthrough persistence and global triggers.
 */
export function initWalkthrough() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Listen for clicks on tour triggers anywhere in the document
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest && e.target.closest('[data-action="start-walkthrough"], #tour-btn, #walkthrough-btn');
    if (trigger) {
      e.preventDefault();
      startWalkthrough(0);
    }
  });

  // Check persistence
  try {
    const seen = localStorage.getItem('dsign_walkthrough_seen');
    if (!seen) {
      const launch = () => {
        setTimeout(() => {
          startWalkthrough(0);
        }, 500);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', launch, { once: true });
      } else {
        launch();
      }
    }
  } catch (err) {
    console.warn('Could not read walkthrough persistence from localStorage', err);
  }
}

// Expose on global window object for console access, hotkeys, and backwards compatibility
if (typeof window !== 'undefined') {
  window.initWalkthrough = initWalkthrough;
  window.startWalkthrough = startWalkthrough;
  window.stopWalkthrough = stopWalkthrough;
  window.WALKTHROUGH_STEPS = WALKTHROUGH_STEPS;
}

export default {
  initWalkthrough,
  startWalkthrough,
  stopWalkthrough,
  WALKTHROUGH_STEPS,
  goToStep,
  nextStep,
  prevStep
};
