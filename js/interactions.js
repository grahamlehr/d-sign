/* ==========================================================================
   Canvas Interaction Suite & File Drag-and-Drop Ingestion
   ========================================================================== */

import { state, pushHistorySnapshot, imageElementCache, selectLayer, deselectLayers } from './state.js';
import { el, showToast } from './dom.js';
import { getActiveLayer, renderLayersList, addImageLayer, updateActiveLayerProp } from './layers.js';
import { syncActiveLayerControls } from './ui.js';
import { updatePreview } from './canvas.js';
import { loadProjectData, loadTemplateZip } from './storage.js';

let isDraggingText = false;
let pendingTextDrag = false;
let pendingDragBox = null;
let pendingDragPointerId = null;
let lastTextClickTime = 0;
let lastTextClickId = null;
let isRotatingLayer = false;
let isResizingLayer = false;
let isPanningCanvas = false;
let isDraggingGuide = false;
let activeGuideEl = null;
let guideType = 'h';
let guideIndex = 0;

let dragStartX = 0;
let dragStartY = 0;
let initialLayerX = 0;
let initialLayerY = 0;
let initialBgOffsetX = 0;
let initialBgOffsetY = 0;
let initialViewportPanX = 0;
let initialViewportPanY = 0;
const initialLayerPositions = new Map();

// Rotation state
let rotatingBox = null;
let rotatingHandle = null;
let rotationCenterX = 0;
let rotationCenterY = 0;

// Corner resize state
let resizingBox = null;
let resizingHandle = null;
let currentResizeHandleType = '';
let initialLayerWidth = 0;
let initialLayerHeight = 0;
let initialAspectRatio = 1.0;
let canvasPxPerUnit = 1;

export function initCanvasInteractions() {
  if (!el || !el.previewFrame) return;
  const frame = el.previewFrame;

  // Pointer Down on Canvas, Handles, or Layer
  frame.addEventListener('pointerdown', (e) => {
    // Ignore clicks inside an active inline text editor
    if (e.target.closest('.inline-text-editor')) {
      return;
    }

    // 0. Interactive Guideline Dragging
    const guideEl = e.target.closest('.canvas-guide');
    if (guideEl) {
      e.preventDefault();
      e.stopPropagation();
      isDraggingGuide = true;
      activeGuideEl = guideEl;
      guideType = guideEl.dataset.type;
      guideIndex = parseInt(guideEl.dataset.index, 10);
      try { guideEl.setPointerCapture(e.pointerId); } catch (_) {}
      guideEl.classList.add('dragging');
      return;
    }

    // 1. Pan Mode (Spacebar held or Pan tool active)
    if (state.isSpacePressed || state.isPanMode) {
      isPanningCanvas = true;
      try { frame.setPointerCapture(e.pointerId); } catch (_) {}
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialBgOffsetX = state.bgOffsetX;
      initialBgOffsetY = state.bgOffsetY;
      initialViewportPanX = state.viewportPanX || 0;
      initialViewportPanY = state.viewportPanY || 0;
      frame.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // 2. Interactive Rotation Handle
    const rotHandle = e.target.closest('.rotation-handle');
    if (rotHandle) {
      e.preventDefault();
      e.stopPropagation();
      const box = rotHandle.closest('.preview-text-box');
      if (!box) return;
      const layerId = box.dataset.id;
      state.activeLayerId = layerId;
      const activeLayer = getActiveLayer();
      if (!activeLayer) return;

      isRotatingLayer = true;
      rotatingBox = box;
      rotatingHandle = rotHandle;
      rotHandle.classList.add('rotating');

      try {
        rotHandle.setPointerCapture(e.pointerId);
      } catch (_) {}

      const rect = box.getBoundingClientRect();
      rotationCenterX = rect.left + rect.width / 2;
      rotationCenterY = rect.top + rect.height / 2;

      renderLayersList();
      syncActiveLayerControls();
      return;
    }

    // 3. Interactive Corner Resize Handle
    const resizeHandle = e.target.closest('.resize-handle');
    if (resizeHandle) {
      e.preventDefault();
      e.stopPropagation();
      const box = resizeHandle.closest('.preview-text-box');
      if (!box) return;
      const layerId = box.dataset.id;
      state.activeLayerId = layerId;
      const activeLayer = getActiveLayer();
      if (!activeLayer) return;

      isResizingLayer = true;
      resizingBox = box;
      resizingHandle = resizeHandle;
      currentResizeHandleType = resizeHandle.dataset.handle; // 'nw', 'ne', 'se', 'sw'

      try {
        resizeHandle.setPointerCapture(e.pointerId);
      } catch (_) {}

      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLayerWidth = activeLayer.width !== undefined ? activeLayer.width : (activeLayer.origWidth || 400);
      initialLayerHeight = activeLayer.height !== undefined ? activeLayer.height : (activeLayer.origHeight || 400);
      if (!initialLayerWidth || initialLayerWidth <= 0) initialLayerWidth = 400;
      if (!initialLayerHeight || initialLayerHeight <= 0) initialLayerHeight = 400;
      initialAspectRatio = activeLayer.aspectRatio || (initialLayerWidth / initialLayerHeight) || 1.0;

      const frameRect = el.previewFrame.getBoundingClientRect();
      canvasPxPerUnit = (frameRect.width && state.width) ? (frameRect.width / state.width) : 1;

      renderLayersList();
      syncActiveLayerControls();
      return;
    }

    // 4. Direct Layer Dragging (Translating Text or Image)
    const textBox = e.target.closest('.preview-text-box');
    if (textBox) {
      const layerId = textBox.dataset.id;
      const layer = state.layers.find(l => l.id === layerId);
      const now = Date.now();

      // Double-click detection for inline text editing
      if (layer && layer.type === 'text') {
        if (now - lastTextClickTime < 350 && lastTextClickId === layerId) {
          lastTextClickTime = 0;
          lastTextClickId = null;
          pendingTextDrag = false;
          openInlineTextEditor(layerId, textBox);
          return;
        }
      }
      lastTextClickTime = now;
      lastTextClickId = layerId;

      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      if (isMulti) {
        selectLayer(layerId, true);
      } else if (!state.selectedLayerIds || !state.selectedLayerIds.includes(layerId)) {
        selectLayer(layerId, false);
      } else {
        state.activeLayerId = layerId;
      }

      dragStartX = e.clientX;
      dragStartY = e.clientY;
      pendingTextDrag = true;
      pendingDragBox = textBox;
      pendingDragPointerId = e.pointerId;

      initialLayerPositions.clear();
      (state.selectedLayerIds || [layerId]).forEach(id => {
        const l = state.layers.find(x => x.id === id);
        if (l) {
          initialLayerPositions.set(id, {
            x: parseFloat(l.x !== undefined ? l.x : l.textX) || 50,
            y: parseFloat(l.y !== undefined ? l.y : l.textY) || 50
          });
        }
      });

      document.querySelectorAll('.preview-text-box').forEach(b => {
        const bid = b.dataset.id;
        b.classList.toggle('active-layer', bid === state.activeLayerId);
        b.classList.toggle('multi-selected', state.selectedLayerIds && state.selectedLayerIds.includes(bid) && state.selectedLayerIds.length > 1);
      });
      renderLayersList();
      syncActiveLayerControls();
      return;
    }

    // 5. Click on Empty Canvas Background -> Deselect
    deselectLayers();
    renderLayersList();
    syncActiveLayerControls();
    updatePreview();
  });

  // Pointer Move
  window.addEventListener('pointermove', (e) => {
    if (!el.previewFrame) return;
    const frameRect = el.previewFrame.getBoundingClientRect();
    if (!frameRect.width || !frameRect.height) return;

    // Dragging Canvas Guideline
    if (isDraggingGuide && activeGuideEl) {
      const isH = guideType === 'h';
      const pct = isH
        ? ((e.clientY - frameRect.top) / frameRect.height) * 100
        : ((e.clientX - frameRect.left) / frameRect.width) * 100;
      const rounded = Math.round(pct * 10) / 10;
      if (isH) {
        activeGuideEl.style.top = `${rounded}%`;
      } else {
        activeGuideEl.style.left = `${rounded}%`;
      }
      const label = activeGuideEl.querySelector('.guide-label');
      if (label) {
        if (pct < -2 || pct > 102) {
          label.textContent = 'Drop to delete';
          label.style.background = '#dc2626';
        } else {
          label.textContent = `${rounded.toFixed(1)}%`;
          label.style.background = 'var(--color-accent)';
        }
      }
      return;
    }

    // Panning Background or Workspace
    if (isPanningCanvas) {
      const deltaPxX = e.clientX - dragStartX;
      const deltaPxY = e.clientY - dragStartY;

      const currentZoom = parseInt(el.previewZoom ? el.previewZoom.value : '100', 10) || 100;
      if (state.isSpacePressed && currentZoom > 100) {
        state.viewportPanX = initialViewportPanX + deltaPxX;
        state.viewportPanY = initialViewportPanY + deltaPxY;
        el.previewFrame.style.transform = `translate(${state.viewportPanX}px, ${state.viewportPanY}px) scale(${currentZoom / 100})`;
        return;
      }

      const pctDeltaX = (deltaPxX / frameRect.width) * 100;
      const pctDeltaY = (deltaPxY / frameRect.height) * 100;

      state.bgOffsetX = Math.max(-100, Math.min(100, Math.round(initialBgOffsetX + pctDeltaX)));
      state.bgOffsetY = Math.max(-100, Math.min(100, Math.round(initialBgOffsetY + pctDeltaY)));

      if (el.bgOffsetX) {
        el.bgOffsetX.value = state.bgOffsetX;
        el.bgOffsetXVal.textContent = state.bgOffsetX + '%';
      }
      if (el.bgOffsetY) {
        el.bgOffsetY.value = state.bgOffsetY;
        el.bgOffsetYVal.textContent = state.bgOffsetY + '%';
      }

      updatePreview();
      return;
    }

    // Rotating Layer
    if (isRotatingLayer) {
      const activeLayer = getActiveLayer();
      if (!activeLayer || !rotatingBox) return;

      const dx = e.clientX - rotationCenterX;
      const dy = e.clientY - rotationCenterY;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;

      // Magnetic Angle Snapping: Shift key or within +/- 3 deg of standard candidates
      const snapAngles = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
      if (e.shiftKey) {
        let closest = snapAngles[0];
        let minDist = Math.abs(angle - closest);
        for (let i = 1; i < snapAngles.length; i++) {
          const dist = Math.abs(angle - snapAngles[i]);
          if (dist < minDist) {
            minDist = dist;
            closest = snapAngles[i];
          }
        }
        angle = closest;
      } else {
        for (const sa of snapAngles) {
          if (Math.abs(angle - sa) <= 3) {
            angle = sa;
            break;
          }
        }
      }

      angle = Math.round(angle * 10) / 10;
      activeLayer.rotation = angle;

      rotatingBox.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

      const hud = rotatingBox.querySelector('.coords-hud');
      if (hud) {
        const curX = parseFloat(activeLayer.x !== undefined ? activeLayer.x : activeLayer.textX) || 0;
        const curY = parseFloat(activeLayer.y !== undefined ? activeLayer.y : activeLayer.textY) || 0;
        const curW = Math.round(activeLayer.width !== undefined ? activeLayer.width : ((activeLayer.origWidth || 400) * (activeLayer.scale !== undefined ? activeLayer.scale : 1.0)));
        hud.textContent = `X: ${curX.toFixed(1)}%  Y: ${curY.toFixed(1)}% · W: ${curW}px · ∠ ${angle.toFixed(1)}°`;
      }

      if (el.imgRotation) el.imgRotation.value = angle;
      if (el.imgRotationVal) el.imgRotationVal.textContent = `${angle.toFixed(1)}°`;
      return;
    }

    // Resizing Layer
    if (isResizingLayer) {
      const activeLayer = getActiveLayer();
      if (!activeLayer || !resizingBox) return;

      const pxPerUnit = (frameRect.width && state.width) ? (frameRect.width / state.width) : (canvasPxPerUnit || 1);
      const deltaCanvasX = (e.clientX - dragStartX) / pxPerUnit;
      const deltaCanvasY = (e.clientY - dragStartY) / pxPerUnit;

      // Un-rotate screen delta vector by activeLayer.rotation
      const rad = (-(activeLayer.rotation || 0) * Math.PI) / 180;
      const localDx = deltaCanvasX * Math.cos(rad) - deltaCanvasY * Math.sin(rad);
      const localDy = deltaCanvasX * Math.sin(rad) + deltaCanvasY * Math.cos(rad);

      let newW = initialLayerWidth;
      let newH = initialLayerHeight;

      switch (currentResizeHandleType) {
        case 'se':
          newW = initialLayerWidth + 2 * localDx;
          newH = initialLayerHeight + 2 * localDy;
          break;
        case 'ne':
          newW = initialLayerWidth + 2 * localDx;
          newH = initialLayerHeight - 2 * localDy;
          break;
        case 'sw':
          newW = initialLayerWidth - 2 * localDx;
          newH = initialLayerHeight + 2 * localDy;
          break;
        case 'nw':
          newW = initialLayerWidth - 2 * localDx;
          newH = initialLayerHeight - 2 * localDy;
          break;
        default:
          return;
      }

      const isLocked = activeLayer.lockAspectRatio !== false || e.shiftKey;
      if (isLocked && initialAspectRatio > 0) {
        const scaleChangeW = Math.abs(newW - initialLayerWidth) / (initialLayerWidth || 1);
        const scaleChangeH = Math.abs(newH - initialLayerHeight) / (initialLayerHeight || 1);
        if (scaleChangeW >= scaleChangeH) {
          newH = newW / initialAspectRatio;
        } else {
          newW = newH * initialAspectRatio;
        }
      }

      const minDim = 20;
      const maxDim = state.width * 3;
      newW = Math.max(minDim, Math.min(maxDim, Math.round(newW)));
      newH = Math.max(minDim, Math.min(maxDim, Math.round(newH)));
      if (isLocked && initialAspectRatio > 0) {
        if (newW / initialAspectRatio < minDim) {
          newH = minDim;
          newW = Math.round(minDim * initialAspectRatio);
        } else {
          newH = Math.round(newW / initialAspectRatio);
        }
      }

      activeLayer.width = newW;
      activeLayer.height = newH;
      const origW = activeLayer.origWidth || newW;
      activeLayer.scale = origW ? (newW / origW) : 1.0;

      // Direct DOM update on resizingBox for 60fps interaction
      const scaleFactor = parseFloat(el.previewFrame.style.getPropertyValue('--scale-factor')) || 1;
      const imgEl = resizingBox.querySelector('img');
      if (imgEl) {
        imgEl.style.width = `${newW * scaleFactor}px`;
        imgEl.style.height = `${newH * scaleFactor}px`;
      }

      const hud = resizingBox.querySelector('.coords-hud');
      if (hud) {
        const curX = parseFloat(activeLayer.x !== undefined ? activeLayer.x : activeLayer.textX) || 0;
        const curY = parseFloat(activeLayer.y !== undefined ? activeLayer.y : activeLayer.textY) || 0;
        const curRot = (parseFloat(activeLayer.rotation || 0)).toFixed(1);
        hud.textContent = `X: ${curX.toFixed(1)}%  Y: ${curY.toFixed(1)}% · W: ${Math.round(newW)}px · ∠ ${curRot}°`;
      }

      if (el.imgWidth) el.imgWidth.value = Math.round(newW);
      if (el.imgHeight) el.imgHeight.value = Math.round(newH);
      const scalePct = Math.round(activeLayer.scale * 100);
      if (el.imgScale) el.imgScale.value = scalePct;
      if (el.imgScaleVal) el.imgScaleVal.textContent = `${scalePct}%`;
      return;
    }

    // Convert pending drag to active drag once movement exceeds threshold
    if (pendingTextDrag && !isDraggingText) {
      if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 4) {
        isDraggingText = true;
        if (pendingDragBox) {
          pendingDragBox.classList.add('dragging');
          try { pendingDragBox.setPointerCapture(pendingDragPointerId); } catch (_) {}
        }
      }
    }

    // Dragging Layer (Text or Image)
    if (isDraggingText) {
      const activeLayer = getActiveLayer();
      if (!activeLayer) return;

      const deltaPxX = e.clientX - dragStartX;
      const deltaPxY = e.clientY - dragStartY;

      const pctDeltaX = (deltaPxX / frameRect.width) * 100;
      const pctDeltaY = (deltaPxY / frameRect.height) * 100;

      const initActive = initialLayerPositions.get(activeLayer.id) || {
        x: parseFloat(activeLayer.x !== undefined ? activeLayer.x : activeLayer.textX) || 50,
        y: parseFloat(activeLayer.y !== undefined ? activeLayer.y : activeLayer.textY) || 50
      };

      let rawX = initActive.x + pctDeltaX;
      let rawY = initActive.y + pctDeltaY;

      // Magnetic Snapping (threshold ~1.4%)
      let snappedCenterX = false;
      let snappedCenterY = false;

      if (state.enableSnapping) {
        if (Math.abs(rawX - 50.0) < 1.4) {
          rawX = 50.0;
          snappedCenterX = true;
        } else if (state.guides && state.guides.vertical) {
          for (const gv of state.guides.vertical) {
            if (Math.abs(rawX - gv) < 1.4) {
              rawX = gv;
              break;
            }
          }
        }

        if (Math.abs(rawY - 50.0) < 1.4) {
          rawY = 50.0;
          snappedCenterY = true;
        } else if (state.guides && state.guides.horizontal) {
          for (const gh of state.guides.horizontal) {
            if (Math.abs(rawY - gh) < 1.4) {
              rawY = gh;
              break;
            }
          }
        }
      }

      // Show / Hide Center Snap Guidelines
      if (el.snapGuideX) el.snapGuideX.style.display = (snappedCenterX && rawX === 50.0) ? 'block' : 'none';
      if (el.snapGuideY) el.snapGuideY.style.display = (snappedCenterY && rawY === 50.0) ? 'block' : 'none';

      // Clamp active layer within safe viewport bounds (0% to 100%)
      rawX = Math.max(0, Math.min(100, Math.round(rawX * 10) / 10));
      rawY = Math.max(0, Math.min(100, Math.round(rawY * 10) / 10));

      const effectiveDeltaX = rawX - initActive.x;
      const effectiveDeltaY = rawY - initActive.y;

      // Group translate all selected layers
      (state.selectedLayerIds || [activeLayer.id]).forEach(id => {
        const l = state.layers.find(x => x.id === id);
        const init = initialLayerPositions.get(id);
        if (l && init) {
          const newX = Math.max(0, Math.min(100, Math.round((init.x + effectiveDeltaX) * 10) / 10));
          const newY = Math.max(0, Math.min(100, Math.round((init.y + effectiveDeltaY) * 10) / 10));
          l.x = newX;
          l.textX = newX;
          l.y = newY;
          l.textY = newY;

          if (id === activeLayer.id) {
            if (el.textX) {
              el.textX.value = newX;
              el.textXVal.textContent = newX.toFixed(1) + '%';
            }
            if (el.textXInput) el.textXInput.value = newX.toFixed(1);
            if (el.textY) {
              el.textY.value = newY;
              el.textYVal.textContent = newY.toFixed(1) + '%';
            }
            if (el.textYInput) el.textYInput.value = newY.toFixed(1);
          }

          if (el.previewTextContainer) {
            const box = el.previewTextContainer.querySelector(`.preview-text-box[data-id="${id}"]`);
            if (box) {
              box.style.left = `${newX}%`;
              box.style.top = `${newY}%`;

              const hud = box.querySelector('.coords-hud');
              if (hud) {
                if (l.type === 'image') {
                  const curW = Math.round(l.width !== undefined ? l.width : ((l.origWidth || 400) * (l.scale !== undefined ? l.scale : 1.0)));
                  const curRot = (parseFloat(l.rotation || 0)).toFixed(1);
                  hud.textContent = `X: ${newX.toFixed(1)}%  Y: ${newY.toFixed(1)}% · W: ${curW}px · ∠ ${curRot}°`;
                } else {
                  hud.textContent = `X: ${newX.toFixed(1)}%  Y: ${newY.toFixed(1)}%`;
                }
              }
            }
          }
        }
      });
    }
  });

  // Pointer Up / Cancel
  const endDrag = (e) => {
    let needUpdate = false;

    if (isDraggingGuide && activeGuideEl) {
      pushHistorySnapshot();
      isDraggingGuide = false;
      const frameRect = el.previewFrame ? el.previewFrame.getBoundingClientRect() : null;
      if (frameRect && e) {
        const isH = guideType === 'h';
        const pct = isH
          ? ((e.clientY - frameRect.top) / frameRect.height) * 100
          : ((e.clientX - frameRect.left) / frameRect.width) * 100;
        if (pct < -2 || pct > 102) {
          if (isH && state.guides.horizontal) {
            state.guides.horizontal.splice(guideIndex, 1);
          } else if (!isH && state.guides.vertical) {
            state.guides.vertical.splice(guideIndex, 1);
          }
          showToast('Guide removed');
        } else {
          const rounded = Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
          if (isH && state.guides.horizontal) {
            state.guides.horizontal[guideIndex] = rounded;
          } else if (!isH && state.guides.vertical) {
            state.guides.vertical[guideIndex] = rounded;
          }
        }
      }
      if (e && e.pointerId) {
        try { activeGuideEl.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      activeGuideEl = null;
      needUpdate = true;
    }

    if (isRotatingLayer) {
      pushHistorySnapshot();
      isRotatingLayer = false;
      if (rotatingHandle) {
        rotatingHandle.classList.remove('rotating');
        if (e && e.pointerId) {
          try { rotatingHandle.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        rotatingHandle = null;
      }
      rotatingBox = null;
      needUpdate = true;
    }

    if (isResizingLayer) {
      pushHistorySnapshot();
      isResizingLayer = false;
      if (resizingHandle) {
        if (e && e.pointerId) {
          try { resizingHandle.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        resizingHandle = null;
      }
      resizingBox = null;
      needUpdate = true;
    }

    pendingTextDrag = false;
    pendingDragBox = null;
    pendingDragPointerId = null;

    if (isDraggingText) {
      pushHistorySnapshot();
      isDraggingText = false;
      if (el.snapGuideX) el.snapGuideX.style.display = 'none';
      if (el.snapGuideY) el.snapGuideY.style.display = 'none';
      document.querySelectorAll('.preview-text-box.dragging').forEach(b => {
        b.classList.remove('dragging');
        if (e && e.pointerId) {
          try { b.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      });
      needUpdate = true;
    }

    if (isPanningCanvas) {
      pushHistorySnapshot();
      isPanningCanvas = false;
      if (e && e.pointerId && el.previewFrame) {
        try { el.previewFrame.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      if (el.previewFrame) {
        el.previewFrame.style.cursor = state.isPanMode || state.isSpacePressed ? 'grab' : 'default';
      }
    }

    if (needUpdate) {
      updatePreview();
      syncActiveLayerControls();
    }
  };

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Double-Click Inline Text Box Editing
  frame.addEventListener('dblclick', (e) => {
    const textBox = e.target.closest('.preview-text-box');
    if (!textBox) return;
    const layerId = textBox.dataset.id;
    openInlineTextEditor(layerId, textBox);
  });

  // Canvas Zoom on Wheel with Ctrl / Alt / Meta (up to 500%)
  if (el.previewPane) {
    el.previewPane.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const currentZoom = parseInt(el.previewZoom.value, 10);
        const delta = e.deltaY < 0 ? 5 : -5;
        const newZoom = Math.max(10, Math.min(500, currentZoom + delta));
        state.zoomMode = 'manual';
        el.previewZoom.value = newZoom;
        if (el.previewZoomVal) el.previewZoomVal.textContent = newZoom + '%';
        if (el.previewZoomInput) el.previewZoomInput.value = newZoom;
        el.previewFrame.style.transform = `translate(${state.viewportPanX || 0}px, ${state.viewportPanY || 0}px) scale(${newZoom / 100})`;
      }
    }, { passive: false });

    el.previewPane.addEventListener('pointerdown', (e) => {
      if (e.target === el.previewPane || e.target.id === 'preview-container') {
        deselectLayers();
        renderLayersList();
        syncActiveLayerControls();
        updatePreview();
      }
    });
  }
}

export function handleImageFile(file) {
  if (!file) return;
  if (!file.type.match('image/.*')) {
    showToast('Please upload a valid image (PNG, JPG, WebP)');
    return;
  }
  pushHistorySnapshot();
  state.bgImageName = file.name;
  state.bgImageBlob = file;
  if (el.bgImageName) el.bgImageName.textContent = file.name;
  if (el.bgStatusTag) {
    el.bgStatusTag.textContent = 'LOADED';
    el.bgStatusTag.className = 'tag tag-accent';
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.bgImageDataUrl = e.target.result;
    const img = new Image();
    img.onload = () => {
      state.bgImage = img;
      if (el.previewBgImage) {
        el.previewBgImage.src = e.target.result;
        el.previewBgImage.classList.add('loaded');
      }
      if (el.bgAdjustmentsPanel) {
        el.bgAdjustmentsPanel.classList.remove('hidden');
      }
      updatePreview();
      showToast(`Background image loaded: ${file.name}`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function handleImageLayerUpload(file) {
  if (!file) return;
  if (!file.type.match('image/.*')) {
    showToast('Please upload a valid image (PNG, WebP, SVG, JPEG)');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || 400;
      const origH = img.naturalHeight || 400;
      const aspRatio = origW / origH;
      let scale = 1.0;

      // If the image is larger than 60% of canvas, scale it down proportionally to fit nicely
      if (origW > state.width * 0.6 || origH > state.height * 0.6) {
        scale = Math.min((state.width * 0.6) / origW, (state.height * 0.6) / origH);
        scale = Math.max(0.1, Math.round(scale * 100) / 100);
      }

      const w = Math.round(origW * scale);
      const h = Math.round(origH * scale);

      addImageLayer({
        name: file.name,
        dataUrl: dataUrl,
        blob: file,
        image: img,
        origWidth: origW,
        origHeight: origH,
        aspectRatio: aspRatio,
        width: w,
        height: h,
        scale: scale,
        x: 50.0,
        y: 50.0
      });
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

export function handleReplaceImageFile(file) {
  if (!file) return;
  if (!file.type.match('image/.*')) {
    showToast('Please select a valid image file');
    return;
  }
  const activeLayer = getActiveLayer();
  if (!activeLayer || activeLayer.type !== 'image') {
    showToast('Please select an image layer first');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onload = () => {
      pushHistorySnapshot();
      activeLayer.name = file.name;
      activeLayer.dataUrl = dataUrl;
      activeLayer.blob = file;
      activeLayer.image = img;
      activeLayer.origWidth = img.naturalWidth || 400;
      activeLayer.origHeight = img.naturalHeight || 400;
      activeLayer.aspectRatio = activeLayer.origWidth / activeLayer.origHeight;
      imageElementCache.set(dataUrl, img);

      const curScale = activeLayer.scale !== undefined ? activeLayer.scale : 1.0;
      activeLayer.width = Math.round(activeLayer.origWidth * curScale);
      activeLayer.height = Math.round(activeLayer.origHeight * curScale);

      renderLayersList();
      syncActiveLayerControls();
      updatePreview();
      showToast(`Image replaced: ${file.name}`);
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

export function handleFontFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const arrayBuffer = e.target.result;
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = (typeof window !== 'undefined' ? window.btoa(binary) : btoa(binary));

    const cleanName = 'Custom_' + file.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
    const fontFace = new FontFace(cleanName, arrayBuffer);

    fontFace.load().then((loadedFace) => {
      document.fonts.add(loadedFace);

      if (el.textFont) {
        const option = document.createElement('option');
        option.value = cleanName;
        option.textContent = `Custom: ${file.name.replace(/\.[^/.]+$/, "")}`;
        el.textFont.appendChild(option);
        el.textFont.value = cleanName;
      }

      state.customFonts.push({
        name: cleanName,
        fileName: file.name,
        base64: base64,
        buffer: arrayBuffer
      });

      updateActiveLayerProp('textFontFamily', cleanName);
      showToast(`Font registered: ${file.name}`);
    }).catch(err => {
      showToast(`Font load failed: ${err.message}`);
    });
  };
  reader.readAsArrayBuffer(file);
}

export function initGlobalFileDragAndDrop() {
  let dragCounter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      if (el.globalDragOverlay) el.globalDragOverlay.classList.add('active');
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (el.globalDragOverlay) el.globalDragOverlay.classList.remove('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (el.globalDragOverlay) el.globalDragOverlay.classList.remove('active');

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          loadProjectData(data);
          showToast('Project JSON successfully loaded');
        } catch (err) {
          showToast('Invalid JSON project: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else if (lowerName.endsWith('.dsign') || lowerName.endsWith('.zip')) {
      loadTemplateZip(file);
    } else if (lowerName.endsWith('.ttf') || lowerName.endsWith('.otf') || lowerName.endsWith('.woff2')) {
      handleFontFile(file);
    } else if (file.type.startsWith('image/')) {
      handleImageFile(file);
    } else {
      showToast('Unsupported file type. Use .dsign, .zip, JPG, PNG, JSON, or TTF/OTF.');
    }
  });
}

/**
 * Open inline textarea editor directly over active text layer on canvas
 */
export function openInlineTextEditor(layerId, textBox) {
  if (!textBox) {
    textBox = document.querySelector(`.preview-text-box[data-id="${layerId}"]`);
  }
  if (!textBox) return;
  const layer = state.layers.find(l => l.id === layerId);
  if (!layer || layer.type !== 'text') return;

  if (textBox.querySelector('.inline-text-editor')) return;

  const textSpan = textBox.querySelector('.layer-text-render');
  if (textSpan) textSpan.style.visibility = 'hidden';

  const textarea = document.createElement('textarea');
  textarea.className = 'inline-text-editor';
  textarea.value = layer.textContent || '';
  textarea.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-width: 140px;
    min-height: 44px;
    background: rgba(22, 21, 20, 0.94);
    color: #ffffff;
    border: 2px solid var(--color-accent);
    font: inherit;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
    letter-spacing: inherit;
    text-align: inherit;
    padding: 4px;
    resize: none;
    outline: none;
    z-index: 100;
    border-radius: 0;
    box-sizing: border-box;
  `;

  const stop = (evt) => evt.stopPropagation();
  textarea.addEventListener('pointerdown', stop);
  textarea.addEventListener('mousedown', stop);
  textarea.addEventListener('click', stop);
  textarea.addEventListener('dblclick', stop);

  textarea.addEventListener('input', () => {
    layer.textContent = textarea.value;
    if (el.textContent && state.activeLayerId === layerId) {
      el.textContent.value = textarea.value;
    }
  });

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const newVal = textarea.value;
    textarea.remove();
    if (textSpan) textSpan.style.visibility = '';
    pushHistorySnapshot();
    layer.textContent = newVal;
    if (el.textContent && state.activeLayerId === layerId) {
      el.textContent.value = newVal;
    }
    renderLayersList();
    updatePreview();
  };

  textarea.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' && (evt.metaKey || evt.ctrlKey)) {
      evt.preventDefault();
      commit();
    } else if (evt.key === 'Escape') {
      evt.preventDefault();
      committed = true;
      textarea.remove();
      if (textSpan) textSpan.style.visibility = '';
      updatePreview();
    }
    evt.stopPropagation();
  });

  textarea.addEventListener('blur', commit);

  textBox.appendChild(textarea);
  setTimeout(() => {
    textarea.focus();
    textarea.select();
  }, 10);
}
