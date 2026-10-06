/* ==========================================================================
   UI Controls Synchronization & Canvas Geometry (Fit & Resize)
   ========================================================================== */

import { state, switchActiveDesign } from './state.js';
import { PRESETS } from './constants.js';
import { el } from './dom.js';
import { getActiveLayer, renderLayersList } from './layers.js';
import { updatePreview } from './canvas.js';

export function syncActiveLayerControls() {
  const layer = getActiveLayer();
  if (!layer) return;

  // Common layer position coordinates (Pos X, Pos Y)
  const posX = parseFloat(layer.x !== undefined ? layer.x : (layer.textX !== undefined ? layer.textX : 50.0)) || 50.0;
  const posY = parseFloat(layer.y !== undefined ? layer.y : (layer.textY !== undefined ? layer.textY : 50.0)) || 50.0;
  if (el.textX) {
    el.textX.value = posX;
    el.textXVal.textContent = posX.toFixed(1) + '%';
  }
  if (el.textXInput) {
    el.textXInput.value = posX.toFixed(1);
  }
  if (el.textY) {
    el.textY.value = posY;
    el.textYVal.textContent = posY.toFixed(1) + '%';
  }
  if (el.textYInput) {
    el.textYInput.value = posY.toFixed(1);
  }

  if (layer.type === 'image') {
    if (el.textLayerControls) el.textLayerControls.classList.add('hidden');
    if (el.imageLayerControls) el.imageLayerControls.classList.remove('hidden');
    if (el.activeLayerTag) {
      el.activeLayerTag.textContent = 'PNG IMAGE';
      el.activeLayerTag.className = 'tag tag-accent tn';
    }

    // Image Meta & Preview
    if (el.imgPreviewThumbEl) {
      el.imgPreviewThumbEl.src = layer.dataUrl || (layer.image ? layer.image.src : '');
    }
    if (el.imgFilename) {
      el.imgFilename.textContent = layer.name || 'image.png';
      el.imgFilename.title = layer.name || 'image.png';
    }
    if (el.imgNativeRes) {
      const natW = layer.origWidth || (layer.image ? layer.image.naturalWidth : (layer.width || 0));
      const natH = layer.origHeight || (layer.image ? layer.image.naturalHeight : (layer.height || 0));
      el.imgNativeRes.textContent = `${natW} × ${natH} PX`;
    }

    // Display Width & Height
    const curW = Math.round(layer.width !== undefined ? layer.width : (layer.origWidth || 400));
    const curH = Math.round(layer.height !== undefined ? layer.height : (layer.origHeight || 400));
    if (el.imgWidth) el.imgWidth.value = curW;
    if (el.imgHeight) el.imgHeight.value = curH;

    // Scale
    const curScale = layer.scale !== undefined ? layer.scale : 1.0;
    const scalePct = Math.round(curScale * 100);
    if (el.imgScale) el.imgScale.value = scalePct;
    if (el.imgScaleVal) el.imgScaleVal.textContent = `${scalePct}%`;
    if (el.imgScaleInput) el.imgScaleInput.value = scalePct;

    // Aspect Ratio Lock
    const isLocked = layer.lockAspectRatio !== false;
    if (el.imgLockRatioBtn) {
      el.imgLockRatioBtn.classList.toggle('active', isLocked);
    }

    // Rotation
    const curRot = layer.rotation !== undefined ? layer.rotation : 0;
    if (el.imgRotation) el.imgRotation.value = curRot;
    if (el.imgRotationVal) el.imgRotationVal.textContent = `${curRot.toFixed(1)}°`;
    if (el.imgRotationInput) el.imgRotationInput.value = Math.round(curRot);

    // Opacity
    const curOpacity = layer.opacity !== undefined ? layer.opacity : 100;
    if (el.imgOpacity) el.imgOpacity.value = curOpacity;
    if (el.imgOpacityVal) el.imgOpacityVal.textContent = `${curOpacity}%`;

    // Grayscale
    if (el.imgGrayscale) el.imgGrayscale.checked = !!layer.grayscale;

    // Cutout Drop Shadow
    const hasShadow = !!layer.enableShadow;
    if (el.imgEnableShadow) el.imgEnableShadow.checked = hasShadow;
    if (el.imgShadowControls) el.imgShadowControls.classList.toggle('hidden', !hasShadow);
    if (el.imgShadowColor) el.imgShadowColor.value = layer.shadowColor || '#000000';
    if (el.imgShadowColorHex) el.imgShadowColorHex.value = layer.shadowColor || '#000000';
    const shadowBlur = layer.shadowBlur !== undefined ? layer.shadowBlur : 15;
    if (el.imgShadowBlur) el.imgShadowBlur.value = shadowBlur;
    if (el.imgShadowBlurVal) el.imgShadowBlurVal.textContent = `${shadowBlur}px`;
    if (el.imgShadowX) el.imgShadowX.value = layer.shadowX !== undefined ? layer.shadowX : 3;
    if (el.imgShadowY) el.imgShadowY.value = layer.shadowY !== undefined ? layer.shadowY : 3;

    return;
  }

  // Text Layer
  if (el.imageLayerControls) el.imageLayerControls.classList.add('hidden');
  if (el.textLayerControls) el.textLayerControls.classList.remove('hidden');
  if (el.activeLayerTag) {
    el.activeLayerTag.textContent = 'TEXT LAYER';
    el.activeLayerTag.className = 'tag tag-live tn';
  }

  if (el.textContent) el.textContent.value = layer.textContent || '';
  if (el.textFont) el.textFont.value = layer.textFontFamily || 'Archivo';
  if (el.textWeight) el.textWeight.value = layer.textWeight || '800';

  if (el.alignToggles) {
    el.alignToggles.querySelectorAll('.seg-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.align === layer.textAlign);
    });
  }

  if (el.textFontSize) el.textFontSize.value = layer.textFontSize || 56;
  if (el.textFontSizeVal) el.textFontSizeVal.textContent = (layer.textFontSize || 56) + 'px';
  if (el.textFontSizeInput) el.textFontSizeInput.value = layer.textFontSize || 56;
  if (el.textLineHeight) el.textLineHeight.value = layer.textLineHeight || 1.2;
  if (el.textLineHeightVal) el.textLineHeightVal.textContent = layer.textLineHeight || 1.2;
  if (el.textLetterSpacing) el.textLetterSpacing.value = layer.textLetterSpacing || 0;
  if (el.textLetterSpacingVal) el.textLetterSpacingVal.textContent = (layer.textLetterSpacing || 0) + 'px';

  if (el.textColor) el.textColor.value = layer.textColor || '#ffffff';
  if (el.textColorHex) el.textColorHex.value = layer.textColor || '#ffffff';

  if (el.enableShadow) el.enableShadow.checked = !!layer.enableShadow;
  if (el.shadowControlsWrapper) el.shadowControlsWrapper.classList.toggle('hidden', !layer.enableShadow);
  if (el.shadowColor) el.shadowColor.value = layer.shadowColor || '#000000';
  if (el.shadowColorHex) el.shadowColorHex.value = layer.shadowColor || '#000000';
  if (el.shadowBlur) el.shadowBlur.value = layer.shadowBlur !== undefined ? layer.shadowBlur : 10;
  if (el.shadowBlurVal) el.shadowBlurVal.textContent = (layer.shadowBlur !== undefined ? layer.shadowBlur : 10) + 'px';
  if (el.shadowX) el.shadowX.value = layer.shadowX !== undefined ? layer.shadowX : 2;
  if (el.shadowY) el.shadowY.value = layer.shadowY !== undefined ? layer.shadowY : 2;

  if (el.enableBgBlock) el.enableBgBlock.checked = !!layer.enableBgBlock;
  if (el.bgBlockControlsWrapper) el.bgBlockControlsWrapper.classList.toggle('hidden', !layer.enableBgBlock);
  if (el.bgBlockColor) el.bgBlockColor.value = layer.bgBlockColor || '#000000';
  if (el.bgBlockColorHex) el.bgBlockColorHex.value = layer.bgBlockColor || '#000000';
  if (el.bgBlockOpacity) el.bgBlockOpacity.value = layer.bgBlockOpacity !== undefined ? layer.bgBlockOpacity : 60;
  if (el.bgBlockOpacityVal) el.bgBlockOpacityVal.textContent = (layer.bgBlockOpacity !== undefined ? layer.bgBlockOpacity : 60) + '%';
  if (el.bgBlockPadding) el.bgBlockPadding.value = layer.bgBlockPadding !== undefined ? layer.bgBlockPadding : 16;
  if (el.bgBlockPaddingVal) el.bgBlockPaddingVal.textContent = (layer.bgBlockPadding !== undefined ? layer.bgBlockPadding : 16) + 'px';
}

export function syncAllUIControls() {
  if (!el || !el.currentResBadge) return;
  renderLayersList();
  syncActiveLayerControls();

  // Screen Preset tabs
  if (el.presetTabs) {
    el.presetTabs.querySelectorAll('.seg-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.preset === state.preset);
    });
  }
  if (el.customSizeControls) {
    el.customSizeControls.classList.toggle('hidden', state.preset !== 'custom');
  }
  el.currentResBadge.textContent = `${state.width} × ${state.height}`;
  if (el.viewportDimensionsInfo) {
    el.viewportDimensionsInfo.textContent = `${state.width} × ${state.height} PX`;
  }

  // Background controls
  if (el.bgGrayscaleToggle) el.bgGrayscaleToggle.checked = state.bgGrayscale;
  if (el.bgZoom) {
    el.bgZoom.value = state.bgZoom;
    el.bgZoomVal.textContent = state.bgZoom.toFixed(2) + '×';
  }
  if (el.bgOffsetX) {
    el.bgOffsetX.value = state.bgOffsetX;
    el.bgOffsetXVal.textContent = state.bgOffsetX + '%';
  }
  if (el.bgOffsetY) {
    el.bgOffsetY.value = state.bgOffsetY;
    el.bgOffsetYVal.textContent = state.bgOffsetY + '%';
  }

  if (el.modeCover) el.modeCover.classList.toggle('active', state.bgSizeMode === 'cover');
  if (el.modeContain) el.modeContain.classList.toggle('active', state.bgSizeMode === 'contain');

  // Tint and Canvas Solid
  if (el.enableTint) {
    el.enableTint.checked = state.enableTint;
    if (el.tintControlsWrapper) el.tintControlsWrapper.classList.toggle('hidden', !state.enableTint);
  }
  if (el.tintColor) {
    el.tintColor.value = state.tintColor;
    if (el.tintColorHex) el.tintColorHex.value = state.tintColor;
  }
  if (el.tintOpacity) {
    el.tintOpacity.value = state.tintOpacity;
    if (el.tintOpacityVal) el.tintOpacityVal.textContent = state.tintOpacity + '%';
  }

  if (el.canvasBgColor) {
    el.canvasBgColor.value = state.canvasBgColor;
    if (el.canvasBgColorHex) el.canvasBgColorHex.value = state.canvasBgColor;
  }

  // Transparency
  if (el.canvasTransparentToggle) {
    el.canvasTransparentToggle.checked = !!state.canvasTransparent;
  }

  // Zoom input
  if (el.previewZoomInput && el.previewZoom) {
    el.previewZoomInput.value = el.previewZoom.value;
  }

  // Master Designs Bar
  renderMasterDesignsBar();
}

export function updateCanvasDimensions() {
  if (!el || !el.previewFrame) return;
  const pane = el.previewFrame.parentElement;
  const paneW = pane ? pane.clientWidth : (window.innerWidth - 420);
  const paneH = pane ? pane.clientHeight : (window.innerHeight - 56);

  const maxW = Math.min(840, Math.max(120, paneW - 120));
  const maxH = Math.max(120, paneH - 120);

  const aspect = state.width / state.height;

  let layoutW = maxW;
  let layoutH = maxW / aspect;

  if (layoutH > maxH) {
    layoutH = maxH;
    layoutW = maxH * aspect;
  }

  el.previewFrame.style.width = `${layoutW}px`;
  el.previewFrame.style.height = `${layoutH}px`;

  const scaleFactor = layoutW / state.width;
  el.previewFrame.style.setProperty('--scale-factor', scaleFactor.toString());
  if (el.currentResBadge) {
    el.currentResBadge.textContent = `${state.width} × ${state.height}`;
  }
  if (el.viewportDimensionsInfo) {
    el.viewportDimensionsInfo.textContent = `${state.width} × ${state.height} PX`;
  }
}

export function fitPreviewToScreen() {
  if (state.zoomMode !== 'fit') return;
  const pane = el.previewFrame ? el.previewFrame.parentElement : null;
  if (!pane) return;
  const paneW = pane.clientWidth;
  const paneH = pane.clientHeight;

  const maxW = Math.max(100, paneW - 120);
  const maxH = Math.max(100, paneH - 120);

  const frameW = el.previewFrame.offsetWidth;
  const frameH = el.previewFrame.offsetHeight;
  if (!frameW || !frameH) return;

  const fitScale = Math.min(maxW / frameW, maxH / frameH);
  const zoomPercent = Math.max(10, Math.min(100, Math.floor(fitScale * 100)));

  state.viewportPanX = 0;
  state.viewportPanY = 0;

  if (el.previewZoom) {
    el.previewZoom.value = zoomPercent;
    if (el.previewZoomVal) el.previewZoomVal.textContent = zoomPercent + '%';
  }
  if (el.previewZoomInput) {
    el.previewZoomInput.value = zoomPercent;
  }
  el.previewFrame.style.transform = `scale(${zoomPercent / 100})`;
}

export function renderMasterDesignsBar() {
  if (!el.masterDesignsTabs) return;
  el.masterDesignsTabs.innerHTML = '';
  if (!state.designs || state.designs.length === 0) return;
  state.designs.forEach((design, idx) => {
    const tab = document.createElement('button');
    tab.className = `design-tab ${design.id === state.activeDesignId ? 'active' : ''}`;
    tab.dataset.id = design.id;
    tab.title = design.name;
    const label = document.createElement('span');
    label.textContent = `${idx + 1}. ${design.name}`;
    tab.appendChild(label);
    tab.addEventListener('click', () => {
      switchActiveDesign(design.id);
    });
    el.masterDesignsTabs.appendChild(tab);
  });
}
