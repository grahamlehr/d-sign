/* ==========================================================================
   D-Sign Application Entry Point & Event Wiring
   ========================================================================== */

import { APP_VERSION, SCHEMA_VERSION, PRESETS } from './constants.js';
import {
  state,
  pushHistorySnapshot,
  undoLastAction,
  normalizeLayer,
  imageElementCache,
  alignSelectedLayers,
  addNewDesign,
  duplicateActiveDesign,
  deleteActiveDesign,
  switchActiveDesign
} from './state.js';
import { el, initDOM, showToast } from './dom.js';
import { hexToRgba, syncColorControls } from './utils.js';
import {
  getActiveLayer,
  updateActiveLayerProp,
  renderLayersList,
  swapLayers,
  deleteLayer,
  deleteTextLayer,
  addTextLayer,
  addImageLayer,
  duplicateActiveLayer
} from './layers.js';
import {
  syncActiveLayerControls,
  syncAllUIControls,
  updateCanvasDimensions,
  fitPreviewToScreen
} from './ui.js';
import { updatePreview } from './canvas.js';
import {
  initCanvasInteractions,
  handleImageFile,
  handleImageLayerUpload,
  handleReplaceImageFile,
  handleFontFile,
  initGlobalFileDragAndDrop
} from './interactions.js';
import {
  saveProjectData,
  loadProjectData,
  exportTemplateZip,
  loadTemplateZip,
  exportPNG,
  exportBatchDesignsPng
} from './storage.js';
import {
  initWalkthrough,
  startWalkthrough,
  stopWalkthrough
} from './walkthrough.js';

// Expose on window for backward compatibility, console debugging, and scripting
if (typeof window !== 'undefined') {
  window.APP_VERSION = APP_VERSION;
  window.SCHEMA_VERSION = SCHEMA_VERSION;
  window.state = state;
  window.imageElementCache = imageElementCache;
  window.normalizeLayer = normalizeLayer;
  window.migrateLayer = normalizeLayer;
  window.getActiveLayer = getActiveLayer;
  window.updateActiveLayerProp = updateActiveLayerProp;
  window.swapLayers = swapLayers;
  window.deleteLayer = deleteLayer;
  window.deleteTextLayer = deleteTextLayer;
  window.addTextLayer = addTextLayer;
  window.addImageLayer = addImageLayer;
  window.duplicateActiveLayer = duplicateActiveLayer;
  window.handleImageLayerUpload = handleImageLayerUpload;
  window.handleReplaceImageFile = handleReplaceImageFile;
  window.saveProjectData = saveProjectData;
  window.loadProjectData = loadProjectData;
  window.exportTemplateZip = exportTemplateZip;
  window.loadTemplateZip = loadTemplateZip;
  window.exportPNG = exportPNG;
  window.exportBatchDesignsPng = exportBatchDesignsPng;
  window.alignSelectedLayers = alignSelectedLayers;
  window.addNewDesign = addNewDesign;
  window.duplicateActiveDesign = duplicateActiveDesign;
  window.deleteActiveDesign = deleteActiveDesign;
  window.switchActiveDesign = switchActiveDesign;
  window.initWalkthrough = typeof initWalkthrough !== 'undefined' ? initWalkthrough : undefined;
  window.startWalkthrough = typeof startWalkthrough !== 'undefined' ? startWalkthrough : undefined;
  window.stopWalkthrough = typeof stopWalkthrough !== 'undefined' ? stopWalkthrough : undefined;
}

export function setupEventHandlers() {
  // Theme Toggle (Daylight / Backstage Dark)
  if (el.themeToggleBtn) {
    el.themeToggleBtn.addEventListener('click', () => {
      if (state.theme === 'daylight') {
        state.theme = 'backstage';
        document.documentElement.setAttribute('data-theme', 'backstage');
        if (el.themeBtnLabel) el.themeBtnLabel.textContent = 'Daylight';
        showToast('Theme switched to Backstage (Dark)');
      } else {
        state.theme = 'daylight';
        document.documentElement.setAttribute('data-theme', 'daylight');
        if (el.themeBtnLabel) el.themeBtnLabel.textContent = 'Backstage';
        showToast('Theme switched to Daylight (Light)');
      }
    });
  }

  // Dialog triggers
  if (el.shortcutsBtn && el.shortcutsDialog) {
    el.shortcutsBtn.addEventListener('click', () => el.shortcutsDialog.classList.add('open'));
  }
  if (el.closeDialogBtn && el.shortcutsDialog) {
    el.closeDialogBtn.addEventListener('click', () => el.shortcutsDialog.classList.remove('open'));
  }
  if (el.confirmDialogBtn && el.shortcutsDialog) {
    el.confirmDialogBtn.addEventListener('click', () => el.shortcutsDialog.classList.remove('open'));
  }
  if (el.shortcutsDialog) {
    el.shortcutsDialog.addEventListener('click', (e) => {
      if (e.target === el.shortcutsDialog) el.shortcutsDialog.classList.remove('open');
    });
  }

  // Screen Format Tabs
  if (el.presetTabs) {
    el.presetTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-opt');
      if (!btn) return;
      pushHistorySnapshot();

      el.presetTabs.querySelectorAll('.seg-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.preset = btn.dataset.preset;
      if (state.preset === 'custom') {
        if (el.customSizeControls) el.customSizeControls.classList.remove('hidden');
        state.width = parseInt(el.customW ? el.customW.value : '1920') || 1920;
        state.height = parseInt(el.customH ? el.customH.value : '1080') || 1080;
      } else {
        if (el.customSizeControls) el.customSizeControls.classList.add('hidden');
        state.width = PRESETS[state.preset].width;
        state.height = PRESETS[state.preset].height;
      }

      state.zoomMode = 'fit';
      updateCanvasDimensions();
      fitPreviewToScreen();
      updatePreview();
    });
  }

  const onCustomSize = () => {
    if (state.preset === 'custom') {
      state.width = Math.max(100, Math.min(8000, parseInt(el.customW.value) || 1920));
      state.height = Math.max(100, Math.min(8000, parseInt(el.customH.value) || 1080));
      state.zoomMode = 'fit';
      updateCanvasDimensions();
      fitPreviewToScreen();
      updatePreview();
    }
  };
  if (el.customW) el.customW.addEventListener('input', onCustomSize);
  if (el.customH) el.customH.addEventListener('input', onCustomSize);

  // Background Upload & Adjustments
  if (el.bgImageInput) {
    el.bgImageInput.addEventListener('change', (e) => handleImageFile(e.target.files[0]));
  }

  if (el.removeImageBtn) {
    el.removeImageBtn.addEventListener('click', () => {
      pushHistorySnapshot();
      state.bgImage = null;
      state.bgImageName = '';
      state.bgImageBlob = null;
      state.bgImageDataUrl = '';
      if (el.previewBgImage) {
        el.previewBgImage.src = '';
        el.previewBgImage.classList.remove('loaded');
      }
      if (el.bgAdjustmentsPanel) {
        el.bgAdjustmentsPanel.classList.add('hidden');
      }
      if (el.bgImageInput) el.bgImageInput.value = '';
      if (el.bgStatusTag) {
        el.bgStatusTag.textContent = 'EMPTY';
        el.bgStatusTag.className = 'tag tag-neutral';
      }
      updatePreview();
      showToast('Background removed');
    });
  }

  if (el.modeCover) {
    el.modeCover.addEventListener('click', () => {
      state.bgSizeMode = 'cover';
      el.modeCover.classList.add('active');
      if (el.modeContain) el.modeContain.classList.remove('active');
      updatePreview();
    });
  }

  if (el.modeContain) {
    el.modeContain.addEventListener('click', () => {
      state.bgSizeMode = 'contain';
      el.modeContain.classList.add('active');
      if (el.modeCover) el.modeCover.classList.remove('active');
      updatePreview();
    });
  }

  if (el.bgGrayscaleToggle) {
    el.bgGrayscaleToggle.addEventListener('change', (e) => {
      state.bgGrayscale = e.target.checked;
      updatePreview();
    });
  }

  const bindSlider = (sliderEl, labelEl, key, isLayerProp = false, suffix = '') => {
    if (!sliderEl) return;
    sliderEl.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (isLayerProp) {
        updateActiveLayerProp(key, val);
        if (labelEl) labelEl.textContent = val + suffix;
        if (sliderEl === el.textX && el.textXInput) el.textXInput.value = val.toFixed(1);
        if (sliderEl === el.textY && el.textYInput) el.textYInput.value = val.toFixed(1);
        if (sliderEl === el.textFontSize && el.textFontSizeInput) el.textFontSizeInput.value = val;
      } else {
        state[key] = val;
        if (labelEl) labelEl.textContent = val + suffix;
        updatePreview();
      }
    });
  };

  bindSlider(el.bgZoom, el.bgZoomVal, 'bgZoom', false, '×');
  bindSlider(el.bgOffsetX, el.bgOffsetXVal, 'bgOffsetX', false, '%');
  bindSlider(el.bgOffsetY, el.bgOffsetYVal, 'bgOffsetY', false, '%');

  if (el.resetBgBtn) {
    el.resetBgBtn.addEventListener('click', () => {
      pushHistorySnapshot();
      state.bgZoom = 1.0;
      state.bgOffsetX = 0;
      state.bgOffsetY = 0;
      if (el.bgZoom) el.bgZoom.value = 1.0;
      if (el.bgZoomVal) el.bgZoomVal.textContent = '1.00×';
      if (el.bgOffsetX) el.bgOffsetX.value = 0;
      if (el.bgOffsetXVal) el.bgOffsetXVal.textContent = '0%';
      if (el.bgOffsetY) el.bgOffsetY.value = 0;
      if (el.bgOffsetYVal) el.bgOffsetYVal.textContent = '0%';
      updatePreview();
      showToast('Background layout reset');
    });
  }

  if (el.panBgToolBtn) {
    el.panBgToolBtn.addEventListener('click', () => {
      state.isPanMode = !state.isPanMode;
      if (el.toolPanBtn) el.toolPanBtn.classList.toggle('active', state.isPanMode);
      el.panBgToolBtn.classList.toggle('btn-primary', state.isPanMode);
      el.panBgToolBtn.classList.toggle('btn-secondary', !state.isPanMode);
      if (el.previewFrame) {
        el.previewFrame.style.cursor = state.isPanMode ? 'grab' : 'default';
      }
      showToast(state.isPanMode ? 'Pan background mode enabled (drag canvas)' : 'Pan mode disabled');
    });
  }

  // Layers Manager Buttons & Drop Ingestion
  if (el.addLayerBtn) el.addLayerBtn.addEventListener('click', addTextLayer);
  if (el.addImageLayerBtn && el.imageLayerFileInput) {
    el.addImageLayerBtn.addEventListener('click', () => el.imageLayerFileInput.click());
    el.imageLayerFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        Array.from(e.target.files).forEach(file => handleImageLayerUpload(file));
      }
      el.imageLayerFileInput.value = '';
    });
  }
  if (el.duplicateLayerBtn) el.duplicateLayerBtn.addEventListener('click', duplicateActiveLayer);

  // Layers list drop zone for PNG/image files
  if (el.layersListContainer) {
    el.layersListContainer.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        el.layersListContainer.classList.add('drag-over');
      }
    });
    el.layersListContainer.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && el.layersListContainer.contains(e.relatedTarget)) return;
      el.layersListContainer.classList.remove('drag-over');
    });
    el.layersListContainer.addEventListener('drop', (e) => {
      el.layersListContainer.classList.remove('drag-over');
      if (el.globalDragOverlay) el.globalDragOverlay.classList.remove('active');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          files.forEach(f => handleImageLayerUpload(f));
        }
      }
    });
  }

  // Selected Layer Inputs
  if (el.textContent) {
    el.textContent.addEventListener('input', (e) => {
      updateActiveLayerProp('textContent', e.target.value);
    });
  }

  if (el.textFont) {
    el.textFont.addEventListener('change', (e) => {
      updateActiveLayerProp('textFontFamily', e.target.value);
    });
  }

  if (el.fontFileInput) {
    el.fontFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFontFile(e.target.files[0]);
      }
    });
  }

  if (el.alignToggles) {
    el.alignToggles.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-opt');
      if (!btn) return;
      el.alignToggles.querySelectorAll('.seg-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateActiveLayerProp('textAlign', btn.dataset.align);
    });
  }

  bindSlider(el.textX, el.textXVal, 'textX', true, '%');
  bindSlider(el.textY, el.textYVal, 'textY', true, '%');

  if (el.textXInput) {
    el.textXInput.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
      updateActiveLayerProp('textX', val);
      updateActiveLayerProp('x', val);
      if (el.textX) el.textX.value = val;
      if (el.textXVal) el.textXVal.textContent = val.toFixed(1) + '%';
      updatePreview();
    });
    el.textXInput.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.textYInput) {
    el.textYInput.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
      updateActiveLayerProp('textY', val);
      updateActiveLayerProp('y', val);
      if (el.textY) el.textY.value = val;
      if (el.textYVal) el.textYVal.textContent = val.toFixed(1) + '%';
      updatePreview();
    });
    el.textYInput.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.centerXBtn) {
    el.centerXBtn.addEventListener('click', () => {
      pushHistorySnapshot();
      updateActiveLayerProp('textX', 50.0);
      updateActiveLayerProp('x', 50.0);
      if (el.textX) el.textX.value = 50.0;
      if (el.textXVal) el.textXVal.textContent = '50.0%';
      if (el.textXInput) el.textXInput.value = '50.0';
    });
  }

  if (el.centerYBtn) {
    el.centerYBtn.addEventListener('click', () => {
      pushHistorySnapshot();
      updateActiveLayerProp('textY', 50.0);
      updateActiveLayerProp('y', 50.0);
      if (el.textY) el.textY.value = 50.0;
      if (el.textYVal) el.textYVal.textContent = '50.0%';
      if (el.textYInput) el.textYInput.value = '50.0';
    });
  }

  bindSlider(el.textFontSize, el.textFontSizeVal, 'textFontSize', true, 'px');
  if (el.textFontSizeInput) {
    el.textFontSizeInput.addEventListener('input', (e) => {
      const val = Math.max(10, Math.min(400, parseInt(e.target.value) || 56));
      updateActiveLayerProp('textFontSize', val);
      if (el.textFontSize) el.textFontSize.value = val;
      if (el.textFontSizeVal) el.textFontSizeVal.textContent = val + 'px';
      updatePreview();
    });
    el.textFontSizeInput.addEventListener('change', () => pushHistorySnapshot());
  }
  if (el.textWeight) {
    el.textWeight.addEventListener('change', (e) => updateActiveLayerProp('textWeight', e.target.value));
  }
  bindSlider(el.textLineHeight, el.textLineHeightVal, 'textLineHeight', true);
  bindSlider(el.textLetterSpacing, el.textLetterSpacingVal, 'textLetterSpacing', true, 'px');

  syncColorControls(el.textColor, el.textColorHex, val => updateActiveLayerProp('textColor', val));

  // Collapsible Effects Toggle
  if (el.collapsibleTriggerEffects && el.collapsibleBodyEffects) {
    el.collapsibleTriggerEffects.addEventListener('click', () => {
      el.collapsibleBodyEffects.classList.toggle('hidden');
      if (el.chevronEffects) {
        el.chevronEffects.style.transform = el.collapsibleBodyEffects.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
      }
    });
  }

  // Shadow
  if (el.enableShadow) {
    el.enableShadow.addEventListener('change', (e) => {
      updateActiveLayerProp('enableShadow', e.target.checked);
      if (el.shadowControlsWrapper) el.shadowControlsWrapper.classList.toggle('hidden', !e.target.checked);
    });
  }
  syncColorControls(el.shadowColor, el.shadowColorHex, val => updateActiveLayerProp('shadowColor', val));
  bindSlider(el.shadowBlur, el.shadowBlurVal, 'shadowBlur', true, 'px');
  if (el.shadowX) {
    el.shadowX.addEventListener('input', (e) => updateActiveLayerProp('shadowX', parseInt(e.target.value) || 0));
  }
  if (el.shadowY) {
    el.shadowY.addEventListener('input', (e) => updateActiveLayerProp('shadowY', parseInt(e.target.value) || 0));
  }

  // Backplate Box
  if (el.enableBgBlock) {
    el.enableBgBlock.addEventListener('change', (e) => {
      updateActiveLayerProp('enableBgBlock', e.target.checked);
      if (el.bgBlockControlsWrapper) el.bgBlockControlsWrapper.classList.toggle('hidden', !e.target.checked);
    });
  }
  syncColorControls(el.bgBlockColor, el.bgBlockColorHex, val => updateActiveLayerProp('bgBlockColor', val));
  bindSlider(el.bgBlockOpacity, el.bgBlockOpacityVal, 'bgBlockOpacity', true, '%');
  bindSlider(el.bgBlockPadding, el.bgBlockPaddingVal, 'bgBlockPadding', true, 'px');

  // Image Layer Controls Listeners
  if (el.replaceImageBtn && el.replaceImageInput) {
    el.replaceImageBtn.addEventListener('click', () => el.replaceImageInput.click());
    el.replaceImageInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleReplaceImageFile(e.target.files[0]);
      }
      el.replaceImageInput.value = '';
    });
  }

  // Sizing Suite
  if (el.imgScale) {
    el.imgScale.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const scalePct = parseFloat(e.target.value) || 100;
      const scale = scalePct / 100;
      active.scale = scale;
      const origW = active.origWidth || 400;
      const origH = active.origHeight || 400;
      active.width = Math.round(origW * scale);
      active.height = Math.round(origH * scale);
      if (el.imgScaleVal) el.imgScaleVal.textContent = `${Math.round(scalePct)}%`;
      if (el.imgScaleInput) el.imgScaleInput.value = Math.round(scalePct);
      if (el.imgWidth) el.imgWidth.value = active.width;
      if (el.imgHeight) el.imgHeight.value = active.height;
      updatePreview();
    });
    el.imgScale.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.imgScaleInput) {
    el.imgScaleInput.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const scalePct = Math.max(10, Math.min(500, parseFloat(e.target.value) || 100));
      const scale = scalePct / 100;
      active.scale = scale;
      const origW = active.origWidth || 400;
      const origH = active.origHeight || 400;
      active.width = Math.round(origW * scale);
      active.height = Math.round(origH * scale);
      if (el.imgScale) el.imgScale.value = Math.round(scalePct);
      if (el.imgScaleVal) el.imgScaleVal.textContent = `${Math.round(scalePct)}%`;
      if (el.imgWidth) el.imgWidth.value = active.width;
      if (el.imgHeight) el.imgHeight.value = active.height;
      updatePreview();
    });
    el.imgScaleInput.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.imgWidth) {
    el.imgWidth.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const newW = Math.max(1, parseFloat(e.target.value) || 1);
      active.width = newW;
      const origW = active.origWidth || 400;
      const asp = active.aspectRatio || ((active.origWidth && active.origHeight) ? (active.origWidth / active.origHeight) : 1);
      if (active.lockAspectRatio !== false) {
        active.height = Math.round(newW / asp);
        if (el.imgHeight) el.imgHeight.value = active.height;
      }
      active.scale = origW ? (newW / origW) : 1.0;
      const scalePct = Math.min(500, Math.max(10, Math.round(active.scale * 100)));
      if (el.imgScale) el.imgScale.value = scalePct;
      if (el.imgScaleVal) el.imgScaleVal.textContent = `${scalePct}%`;
      updatePreview();
    });
    el.imgWidth.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.imgHeight) {
    el.imgHeight.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const newH = Math.max(1, parseFloat(e.target.value) || 1);
      active.height = newH;
      const origH = active.origHeight || 400;
      const asp = active.aspectRatio || ((active.origWidth && active.origHeight) ? (active.origWidth / active.origHeight) : 1);
      if (active.lockAspectRatio !== false) {
        active.width = Math.round(newH * asp);
        if (el.imgWidth) el.imgWidth.value = active.width;
      }
      active.scale = origH ? (newH / origH) : 1.0;
      const scalePct = Math.min(500, Math.max(10, Math.round(active.scale * 100)));
      if (el.imgScale) el.imgScale.value = scalePct;
      if (el.imgScaleVal) el.imgScaleVal.textContent = `${scalePct}%`;
      updatePreview();
    });
    el.imgHeight.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.imgLockRatioBtn) {
    el.imgLockRatioBtn.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      active.lockAspectRatio = active.lockAspectRatio === false ? true : false;
      el.imgLockRatioBtn.classList.toggle('active', active.lockAspectRatio);
      showToast(active.lockAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked');
    });
  }

  // Sizing Presets
  if (el.imgPreset100) {
    el.imgPreset100.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      active.scale = 1.0;
      active.width = active.origWidth || 400;
      active.height = active.origHeight || 400;
      syncActiveLayerControls();
      updatePreview();
      showToast('Image scale reset to 100%');
    });
  }

  if (el.imgPresetFitW) {
    el.imgPresetFitW.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      const targetW = state.width * 0.8;
      const asp = active.aspectRatio || ((active.origWidth && active.origHeight) ? (active.origWidth / active.origHeight) : 1);
      active.width = Math.round(targetW);
      active.height = Math.round(targetW / asp);
      active.scale = active.origWidth ? (active.width / active.origWidth) : 1.0;
      syncActiveLayerControls();
      updatePreview();
      showToast('Fitted to 80% canvas width');
    });
  }

  if (el.imgPresetFitH) {
    el.imgPresetFitH.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      const targetH = state.height * 0.8;
      const asp = active.aspectRatio || ((active.origWidth && active.origHeight) ? (active.origWidth / active.origHeight) : 1);
      active.height = Math.round(targetH);
      active.width = Math.round(targetH * asp);
      active.scale = active.origHeight ? (active.height / active.origHeight) : 1.0;
      syncActiveLayerControls();
      updatePreview();
      showToast('Fitted to 80% canvas height');
    });
  }

  if (el.imgPresetHalf) {
    el.imgPresetHalf.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      active.scale = 0.5;
      active.width = Math.round((active.origWidth || 400) * 0.5);
      active.height = Math.round((active.origHeight || 400) * 0.5);
      syncActiveLayerControls();
      updatePreview();
      showToast('Scaled to 50%');
    });
  }

  // Rotation Suite
  if (el.imgRotation) {
    el.imgRotation.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const rot = parseFloat(e.target.value) || 0;
      active.rotation = rot;
      if (el.imgRotationVal) el.imgRotationVal.textContent = `${rot.toFixed(1)}°`;
      if (el.imgRotationInput) el.imgRotationInput.value = Math.round(rot);
      updatePreview();
    });
    el.imgRotation.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.imgRotationInput) {
    el.imgRotationInput.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const rot = Math.max(-180, Math.min(180, parseFloat(e.target.value) || 0));
      active.rotation = rot;
      if (el.imgRotation) el.imgRotation.value = rot;
      if (el.imgRotationVal) el.imgRotationVal.textContent = `${rot.toFixed(1)}°`;
      updatePreview();
    });
    el.imgRotationInput.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.rotPreset0) {
    el.rotPreset0.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      active.rotation = 0;
      if (el.imgRotation) el.imgRotation.value = 0;
      if (el.imgRotationVal) el.imgRotationVal.textContent = '0.0°';
      if (el.imgRotationInput) el.imgRotationInput.value = 0;
      updatePreview();
      showToast('Rotation reset to 0°');
    });
  }

  if (el.rotPresetCcw) {
    el.rotPresetCcw.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      let rot = (active.rotation || 0) - 90;
      while (rot < -180) rot += 360;
      while (rot > 180) rot -= 360;
      active.rotation = rot;
      if (el.imgRotation) el.imgRotation.value = rot;
      if (el.imgRotationVal) el.imgRotationVal.textContent = `${rot.toFixed(1)}°`;
      if (el.imgRotationInput) el.imgRotationInput.value = Math.round(rot);
      updatePreview();
    });
  }

  if (el.rotPresetCw) {
    el.rotPresetCw.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      let rot = (active.rotation || 0) + 90;
      while (rot > 180) rot -= 360;
      while (rot < -180) rot += 360;
      active.rotation = rot;
      if (el.imgRotation) el.imgRotation.value = rot;
      if (el.imgRotationVal) el.imgRotationVal.textContent = `${rot.toFixed(1)}°`;
      if (el.imgRotationInput) el.imgRotationInput.value = Math.round(rot);
      updatePreview();
    });
  }

  if (el.rotPreset180) {
    el.rotPreset180.addEventListener('click', () => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      let rot = (active.rotation || 0) + 180;
      while (rot > 180) rot -= 360;
      while (rot < -180) rot += 360;
      active.rotation = rot;
      if (el.imgRotation) el.imgRotation.value = rot;
      if (el.imgRotationVal) el.imgRotationVal.textContent = `${rot.toFixed(1)}°`;
      if (el.imgRotationInput) el.imgRotationInput.value = Math.round(rot);
      updatePreview();
    });
  }

  // Opacity Suite
  if (el.imgOpacity) {
    el.imgOpacity.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const op = parseInt(e.target.value, 10);
      active.opacity = op;
      if (el.imgOpacityVal) el.imgOpacityVal.textContent = `${op}%`;
      updatePreview();
    });
    el.imgOpacity.addEventListener('change', () => pushHistorySnapshot());
  }

  // Photographic Treatment: Grayscale Toggle
  if (el.imgGrayscale) {
    el.imgGrayscale.addEventListener('change', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      active.grayscale = e.target.checked;
      updatePreview();
    });
  }

  // Cutout Drop Shadow Controls
  if (el.imgEnableShadow) {
    el.imgEnableShadow.addEventListener('change', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      pushHistorySnapshot();
      active.enableShadow = e.target.checked;
      if (el.imgShadowControls) el.imgShadowControls.classList.toggle('hidden', !active.enableShadow);
      updatePreview();
    });
  }

  if (el.imgShadowColor && el.imgShadowColorHex) {
    syncColorControls(el.imgShadowColor, el.imgShadowColorHex, (val) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      active.shadowColor = val;
      updatePreview();
    });
  }

  if (el.imgShadowBlur) {
    el.imgShadowBlur.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      const blur = parseInt(e.target.value) || 0;
      active.shadowBlur = blur;
      if (el.imgShadowBlurVal) el.imgShadowBlurVal.textContent = `${blur}px`;
      updatePreview();
    });
    el.imgShadowBlur.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.imgShadowX) {
    el.imgShadowX.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      active.shadowX = parseInt(e.target.value) || 0;
      updatePreview();
    });
    el.imgShadowX.addEventListener('change', () => pushHistorySnapshot());
  }

  if (el.imgShadowY) {
    el.imgShadowY.addEventListener('input', (e) => {
      const active = getActiveLayer();
      if (!active || active.type !== 'image') return;
      active.shadowY = parseInt(e.target.value) || 0;
      updatePreview();
    });
    el.imgShadowY.addEventListener('change', () => pushHistorySnapshot());
  }

  // Global Canvas Settings
  if (el.enableTint) {
    el.enableTint.addEventListener('change', (e) => {
      state.enableTint = e.target.checked;
      if (el.tintControlsWrapper) el.tintControlsWrapper.classList.toggle('hidden', !state.enableTint);
      updatePreview();
    });
  }
  syncColorControls(el.tintColor, el.tintColorHex, val => { state.tintColor = val; updatePreview(); });
  bindSlider(el.tintOpacity, el.tintOpacityVal, 'tintOpacity', false, '%');
  syncColorControls(el.canvasBgColor, el.canvasBgColorHex, val => { state.canvasBgColor = val; updatePreview(); });

  // Canvas Transparency Toggle
  if (el.canvasTransparentToggle) {
    el.canvasTransparentToggle.addEventListener('change', (e) => {
      pushHistorySnapshot();
      state.canvasTransparent = e.target.checked;
      updatePreview();
      showToast(state.canvasTransparent ? 'Transparent Canvas ON' : 'Transparent Canvas OFF');
    });
  }

  // Walkthrough Onboarding Button
  if (el.walkthroughBtn) {
    el.walkthroughBtn.addEventListener('click', () => {
      startWalkthrough();
    });
  }

  // Quick Floating Toolbar
  if (el.toolSelectBtn) {
    el.toolSelectBtn.addEventListener('click', () => {
      state.isPanMode = false;
      el.toolSelectBtn.classList.add('active');
      if (el.toolPanBtn) el.toolPanBtn.classList.remove('active');
      if (el.panBgToolBtn) {
        el.panBgToolBtn.classList.remove('btn-primary');
        el.panBgToolBtn.classList.add('btn-secondary');
      }
      if (el.previewFrame) el.previewFrame.style.cursor = 'default';
    });
  }

  if (el.toolPanBtn) {
    el.toolPanBtn.addEventListener('click', () => {
      state.isPanMode = !state.isPanMode;
      el.toolPanBtn.classList.toggle('active', state.isPanMode);
      if (el.toolSelectBtn) el.toolSelectBtn.classList.toggle('active', !state.isPanMode);
      if (el.panBgToolBtn) {
        el.panBgToolBtn.classList.toggle('btn-primary', state.isPanMode);
        el.panBgToolBtn.classList.toggle('btn-secondary', !state.isPanMode);
      }
      if (el.previewFrame) {
        el.previewFrame.style.cursor = state.isPanMode ? 'grab' : 'default';
      }
      showToast(state.isPanMode ? 'Pan background mode enabled' : 'Select mode enabled');
    });
  }

  if (el.toolSnapBtn) {
    el.toolSnapBtn.addEventListener('click', () => {
      state.enableSnapping = !state.enableSnapping;
      el.toolSnapBtn.classList.toggle('active', state.enableSnapping);
      showToast(state.enableSnapping ? 'Magnetic snapping guidelines ON' : 'Magnetic snapping OFF');
    });
  }

  // Canvas Guides Actions
  if (el.addHGuideBtn) {
    el.addHGuideBtn.addEventListener('click', () => {
      if (!state.guides) state.guides = { horizontal: [], vertical: [] };
      if (!state.guides.horizontal) state.guides.horizontal = [];
      state.guides.horizontal.push(50.0);
      updatePreview();
      showToast('Added Horizontal Guide (50%)');
    });
  }
  if (el.addVGuideBtn) {
    el.addVGuideBtn.addEventListener('click', () => {
      if (!state.guides) state.guides = { horizontal: [], vertical: [] };
      if (!state.guides.vertical) state.guides.vertical = [];
      state.guides.vertical.push(50.0);
      updatePreview();
      showToast('Added Vertical Guide (50%)');
    });
  }
  if (el.clearGuidesBtn) {
    el.clearGuidesBtn.addEventListener('click', () => {
      state.guides = { horizontal: [], vertical: [] };
      updatePreview();
      showToast('Canvas guides cleared');
    });
  }

  // Alignment Tools (Align Selected Layers)
  const alignButtons = [
    { btn: el.alignLeftBtn, type: 'left' },
    { btn: el.alignCenterXBtn, type: 'centerX' },
    { btn: el.alignRightBtn, type: 'right' },
    { btn: el.alignTopBtn, type: 'top' },
    { btn: el.alignMiddleYBtn, type: 'middleY' },
    { btn: el.alignBottomBtn, type: 'bottom' }
  ];
  alignButtons.forEach(({ btn, type }) => {
    if (btn) {
      btn.addEventListener('click', () => {
        alignSelectedLayers(type);
      });
    }
  });

  if (el.quickCenterX) {
    el.quickCenterX.addEventListener('click', () => {
      if (el.centerXBtn) el.centerXBtn.click();
    });
  }
  if (el.quickCenterY) {
    el.quickCenterY.addEventListener('click', () => {
      if (el.centerYBtn) el.centerYBtn.click();
    });
  }
  if (el.quickDeleteLayer) {
    el.quickDeleteLayer.addEventListener('click', () => {
      const active = getActiveLayer();
      if (active) deleteLayer(active.id);
    });
  }

  // Master Designs Management
  if (el.addDesignBtn) {
    el.addDesignBtn.addEventListener('click', () => {
      addNewDesign();
    });
  }
  if (el.duplicateDesignBtn) {
    el.duplicateDesignBtn.addEventListener('click', () => {
      duplicateActiveDesign();
    });
  }
  if (el.deleteDesignBtn) {
    el.deleteDesignBtn.addEventListener('click', () => {
      deleteActiveDesign();
    });
  }
  if (el.exportBatchBtn) {
    el.exportBatchBtn.addEventListener('click', () => {
      exportBatchDesignsPng();
    });
  }

  // Viewport Status Bar
  if (el.toggleGrid && el.previewFrame) {
    el.toggleGrid.addEventListener('change', (e) => {
      el.previewFrame.classList.toggle('checkerboard', e.target.checked);
    });
  }

  if (el.zoomFitBtn) {
    el.zoomFitBtn.addEventListener('click', () => {
      state.zoomMode = 'fit';
      fitPreviewToScreen();
    });
  }

  if (el.previewZoom && el.previewFrame) {
    el.previewZoom.addEventListener('input', (e) => {
      state.zoomMode = 'manual';
      const val = parseInt(e.target.value, 10);
      if (el.previewZoomVal) el.previewZoomVal.textContent = val + '%';
      if (el.previewZoomInput) el.previewZoomInput.value = val;
      el.previewFrame.style.transform = `translate(${state.viewportPanX || 0}px, ${state.viewportPanY || 0}px) scale(${val / 100})`;
    });
  }

  if (el.previewZoomInput && el.previewFrame) {
    el.previewZoomInput.addEventListener('input', (e) => {
      state.zoomMode = 'manual';
      const val = Math.max(10, Math.min(500, parseInt(e.target.value, 10) || 100));
      if (el.previewZoom) el.previewZoom.value = val;
      if (el.previewZoomVal) el.previewZoomVal.textContent = val + '%';
      el.previewFrame.style.transform = `translate(${state.viewportPanX || 0}px, ${state.viewportPanY || 0}px) scale(${val / 100})`;
    });
  }

  // Save, Load, Export
  if (el.saveBtn) el.saveBtn.addEventListener('click', saveProjectData);
  if (el.loadBtn && el.loadProjectInput) {
    el.loadBtn.addEventListener('click', () => el.loadProjectInput.click());
    el.loadProjectInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          loadProjectData(data);
          showToast('Project loaded');
        } catch (err) {
          showToast('Invalid JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
      el.loadProjectInput.value = '';
    });
  }

  // Template Archive (.zip) Save & Load
  if (el.saveTemplateBtn) {
    el.saveTemplateBtn.addEventListener('click', exportTemplateZip);
  }
  if (el.loadTemplateBtn && el.loadTemplateInput) {
    el.loadTemplateBtn.addEventListener('click', () => el.loadTemplateInput.click());
    el.loadTemplateInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadTemplateZip(e.target.files[0]);
      }
      el.loadTemplateInput.value = '';
    });
  }

  if (el.exportBtn) el.exportBtn.addEventListener('click', exportPNG);

  // Keyboard Ergonomics
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

    // Help Modal (?)
    if (e.key === '?' && !isTyping && el.shortcutsDialog) {
      e.preventDefault();
      el.shortcutsDialog.classList.toggle('open');
      return;
    }

    // Escape closes modal / deselects
    if (e.key === 'Escape' && el.shortcutsDialog) {
      el.shortcutsDialog.classList.remove('open');
      return;
    }

    // Spacebar Panning toggle
    if (e.code === 'Space' && !isTyping && !state.isSpacePressed) {
      state.isSpacePressed = true;
      if (el.previewFrame) el.previewFrame.style.cursor = 'grab';
      e.preventDefault();
    }

    // Undo (Cmd+Z or Ctrl+Z)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (!isTyping) {
        e.preventDefault();
        undoLastAction();
      }
    }

    // Save Template ZIP (Cmd+S or Ctrl+S)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
      e.preventDefault();
      exportTemplateZip();
    }

    // Load Template ZIP (Cmd+O or Ctrl+O)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (el.loadTemplateInput) el.loadTemplateInput.click();
    }

    // Duplicate (Cmd+D or Ctrl+D)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicateActiveLayer();
    }

    // Toggle Snap (S key)
    if (e.key.toLowerCase() === 's' && !isTyping && !e.metaKey && !e.ctrlKey) {
      if (el.toolSnapBtn) el.toolSnapBtn.click();
    }

    // Delete Layer (Delete or Backspace when not typing)
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
      e.preventDefault();
      const active = getActiveLayer();
      if (active) deleteLayer(active.id);
    }

    // Arrow Key Nudging for Active Layer
    if (!isTyping && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const active = getActiveLayer();
      if (!active) return;
      e.preventDefault();

      const step = e.shiftKey ? 5.0 : (e.altKey ? 0.1 : 0.5);

      const curX = active.x !== undefined ? active.x : (active.textX !== undefined ? active.textX : 50);
      const curY = active.y !== undefined ? active.y : (active.textY !== undefined ? active.textY : 50);

      let newX = curX;
      let newY = curY;

      if (e.key === 'ArrowUp') newY = Math.max(0, curY - step);
      if (e.key === 'ArrowDown') newY = Math.min(100, curY + step);
      if (e.key === 'ArrowLeft') newX = Math.max(0, curX - step);
      if (e.key === 'ArrowRight') newX = Math.min(100, curX + step);

      newX = Math.round(newX * 10) / 10;
      newY = Math.round(newY * 10) / 10;

      active.x = newX;
      active.textX = newX;
      active.y = newY;
      active.textY = newY;

      if (el.textX) {
        el.textX.value = active.x;
        if (el.textXVal) el.textXVal.textContent = active.x.toFixed(1) + '%';
      }
      if (el.textY) {
        el.textY.value = active.y;
        if (el.textYVal) el.textYVal.textContent = active.y.toFixed(1) + '%';
      }

      updatePreview();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      state.isSpacePressed = false;
      if (el.previewFrame) {
        el.previewFrame.style.cursor = state.isPanMode ? 'grab' : 'default';
      }
    }
  });

  // Window Resizing Observer
  if (el.previewPane && typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasDimensions();
      if (state.zoomMode === 'fit') {
        fitPreviewToScreen();
      }
    });
    resizeObserver.observe(el.previewPane);
  }
}

/* ==========================================================================
   Application Initialization
   ========================================================================== */
function initApp() {
  initDOM();
  setupEventHandlers();
  initCanvasInteractions();
  initGlobalFileDragAndDrop();

  renderLayersList();
  syncActiveLayerControls();
  updateCanvasDimensions();
  fitPreviewToScreen();
  updatePreview();

  showToast('D-Sign Digital Sign Maker · Press ? for Shortcuts', 3500);

  if (typeof initWalkthrough === 'function') {
    initWalkthrough();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
