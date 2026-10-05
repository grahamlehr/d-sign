/* ==========================================================================
   DOM Elements Cache & UI Toast Helpers
   ========================================================================== */

export const el = {
  // Header
  themeToggleBtn: null,
  themeBtnLabel: null,
  shortcutsBtn: null,
  shortcutsDialog: null,
  closeDialogBtn: null,
  confirmDialogBtn: null,
  loadBtn: null,
  loadProjectInput: null,
  saveBtn: null,
  loadTemplateBtn: null,
  loadTemplateInput: null,
  saveTemplateBtn: null,
  exportBtn: null,

  // Screen Format
  presetTabs: null,
  currentResBadge: null,
  customSizeControls: null,
  customW: null,
  customH: null,

  // Background
  bgStatusTag: null,
  bgUploadZone: null,
  bgImageInput: null,
  bgAdjustmentsPanel: null,
  bgImageName: null,
  removeImageBtn: null,
  modeCover: null,
  modeContain: null,
  bgGrayscaleToggle: null,
  bgZoom: null,
  bgZoomVal: null,
  bgOffsetX: null,
  bgOffsetXVal: null,
  bgOffsetY: null,
  bgOffsetYVal: null,
  panBgToolBtn: null,
  resetBgBtn: null,

  // Layers Manager
  layersCountBadge: null,
  addLayerBtn: null,
  addImageLayerBtn: null,
  imageLayerFileInput: null,
  duplicateLayerBtn: null,
  layersListContainer: null,
  layersDropHint: null,

  // Layer Containers & Status
  activeLayerTag: null,
  textLayerControls: null,
  imageLayerControls: null,

  // Common Layer Position Controls
  textX: null,
  textXVal: null,
  textY: null,
  textYVal: null,
  centerXBtn: null,
  centerYBtn: null,

  // Typography / Text Layer Controls
  textContent: null,
  textFont: null,
  fontFileInput: null,
  alignToggles: null,
  textFontSize: null,
  textFontSizeVal: null,
  textWeight: null,
  textLineHeight: null,
  textLineHeightVal: null,
  textLetterSpacing: null,
  textLetterSpacingVal: null,
  textColor: null,
  textColorHex: null,

  // Collapsible Effects (Text Layer)
  collapsibleTriggerEffects: null,
  collapsibleBodyEffects: null,
  chevronEffects: null,
  enableShadow: null,
  shadowControlsWrapper: null,
  shadowColor: null,
  shadowColorHex: null,
  shadowBlur: null,
  shadowBlurVal: null,
  shadowX: null,
  shadowY: null,
  enableBgBlock: null,
  bgBlockControlsWrapper: null,
  bgBlockColor: null,
  bgBlockColorHex: null,
  bgBlockOpacity: null,
  bgBlockOpacityVal: null,
  bgBlockPadding: null,
  bgBlockPaddingVal: null,

  // Image Layer Controls
  imgPreviewThumb: null,
  imgPreviewThumbEl: null,
  imgFilename: null,
  imgNativeRes: null,
  replaceImageBtn: null,
  replaceImageInput: null,
  imgWidth: null,
  imgHeight: null,
  imgLockRatioBtn: null,
  imgScale: null,
  imgScaleVal: null,
  imgPreset100: null,
  imgPresetFitW: null,
  imgPresetFitH: null,
  imgPresetHalf: null,
  imgRotation: null,
  imgRotationVal: null,
  rotPreset0: null,
  rotPresetCcw: null,
  rotPresetCw: null,
  rotPreset180: null,
  imgOpacity: null,
  imgOpacityVal: null,
  imgGrayscale: null,
  imgEnableShadow: null,
  imgShadowControls: null,
  imgShadowColor: null,
  imgShadowColorHex: null,
  imgShadowBlur: null,
  imgShadowBlurVal: null,
  imgShadowX: null,
  imgShadowY: null,

  // Canvas Settings
  enableTint: null,
  tintControlsWrapper: null,
  tintColor: null,
  tintColorHex: null,
  tintOpacity: null,
  tintOpacityVal: null,
  canvasBgColor: null,
  canvasBgColorHex: null,

  // Viewport & Canvas
  previewPane: null,
  previewFrame: null,
  previewCanvasWrapper: null,
  previewBgImage: null,
  previewTint: null,
  snapGuideX: null,
  snapGuideY: null,
  previewTextContainer: null,

  // Quick Toolbar
  toolSelectBtn: null,
  toolPanBtn: null,
  toolSnapBtn: null,
  quickCenterX: null,
  quickCenterY: null,
  quickDeleteLayer: null,

  // Viewport Status Bar
  toggleGrid: null,
  zoomFitBtn: null,
  previewZoom: null,
  previewZoomVal: null,
  viewportDimensionsInfo: null,

  // Overlays
  globalDragOverlay: null,
  dragOverlayTitle: null,
  dragOverlaySubtitle: null,
  toastContainer: null,

  // Walkthrough
  walkthroughBtn: null,

  // Transparency
  canvasTransparentToggle: null,

  // Alignment Tools
  alignLeftBtn: null,
  alignCenterXBtn: null,
  alignRightBtn: null,
  alignTopBtn: null,
  alignMiddleYBtn: null,
  alignBottomBtn: null,

  // Guides Tools
  addHGuideBtn: null,
  addVGuideBtn: null,
  clearGuidesBtn: null,

  // Exact Numeric Inputs
  textXInput: null,
  textYInput: null,
  textFontSizeInput: null,
  imgScaleInput: null,
  imgRotationInput: null,
  previewZoomInput: null,

  // Master Designs
  masterDesignsBar: null,
  masterDesignsTabs: null,
  addDesignBtn: null,
  duplicateDesignBtn: null,
  deleteDesignBtn: null,
  exportBatchBtn: null
};

if (typeof window !== 'undefined') {
  window.el = el;
}

export function initDOM() {
  if (typeof document === 'undefined') return;

  // Header
  el.themeToggleBtn = document.getElementById('theme-toggle-btn');
  el.themeBtnLabel = document.getElementById('theme-btn-label');
  el.shortcutsBtn = document.getElementById('shortcuts-btn');
  el.shortcutsDialog = document.getElementById('shortcuts-dialog');
  el.closeDialogBtn = document.getElementById('close-dialog-btn');
  el.confirmDialogBtn = document.getElementById('confirm-dialog-btn');
  el.loadBtn = document.getElementById('load-btn');
  el.loadProjectInput = document.getElementById('load-project-input');
  el.saveBtn = document.getElementById('save-btn');
  el.loadTemplateBtn = document.getElementById('load-template-btn');
  el.loadTemplateInput = document.getElementById('load-template-input');
  el.saveTemplateBtn = document.getElementById('save-template-btn');
  el.exportBtn = document.getElementById('export-btn');

  // Screen Format
  el.presetTabs = document.getElementById('preset-tabs');
  el.currentResBadge = document.getElementById('current-res-badge');
  el.customSizeControls = document.getElementById('custom-size-controls');
  el.customW = document.getElementById('custom-w');
  el.customH = document.getElementById('custom-h');

  // Background
  el.bgStatusTag = document.getElementById('bg-status-tag');
  el.bgUploadZone = document.getElementById('bg-upload-zone');
  el.bgImageInput = document.getElementById('bg-image-input');
  el.bgAdjustmentsPanel = document.getElementById('bg-adjustments-panel');
  el.bgImageName = document.getElementById('bg-image-name');
  el.removeImageBtn = document.getElementById('remove-image-btn');
  el.modeCover = document.getElementById('mode-cover');
  el.modeContain = document.getElementById('mode-contain');
  el.bgGrayscaleToggle = document.getElementById('bg-grayscale-toggle');
  el.bgZoom = document.getElementById('bg-zoom');
  el.bgZoomVal = document.getElementById('bg-zoom-val');
  el.bgOffsetX = document.getElementById('bg-offset-x');
  el.bgOffsetXVal = document.getElementById('bg-offset-x-val');
  el.bgOffsetY = document.getElementById('bg-offset-y');
  el.bgOffsetYVal = document.getElementById('bg-offset-y-val');
  el.panBgToolBtn = document.getElementById('pan-bg-tool-btn');
  el.resetBgBtn = document.getElementById('reset-bg-btn');

  // Layers Manager
  el.layersCountBadge = document.getElementById('layers-count-badge');
  el.addLayerBtn = document.getElementById('add-layer-btn');
  el.addImageLayerBtn = document.getElementById('add-image-layer-btn');
  el.imageLayerFileInput = document.getElementById('image-layer-file-input');
  el.duplicateLayerBtn = document.getElementById('duplicate-layer-btn');
  el.layersListContainer = document.getElementById('layers-list-container');
  el.layersDropHint = document.getElementById('layers-drop-hint');

  // Layer Containers & Status
  el.activeLayerTag = document.getElementById('active-layer-tag');
  el.textLayerControls = document.getElementById('text-layer-controls');
  el.imageLayerControls = document.getElementById('image-layer-controls');

  // Common Layer Position Controls
  el.textX = document.getElementById('text-x');
  el.textXVal = document.getElementById('text-x-val');
  el.textY = document.getElementById('text-y');
  el.textYVal = document.getElementById('text-y-val');
  el.centerXBtn = document.getElementById('center-x-btn');
  el.centerYBtn = document.getElementById('center-y-btn');

  // Typography / Text Layer Controls
  el.textContent = document.getElementById('text-content');
  el.textFont = document.getElementById('text-font');
  el.fontFileInput = document.getElementById('font-file-input');
  el.alignToggles = document.getElementById('align-toggles');
  el.textFontSize = document.getElementById('text-font-size');
  el.textFontSizeVal = document.getElementById('text-font-size-val');
  el.textWeight = document.getElementById('text-weight');
  el.textLineHeight = document.getElementById('text-line-height');
  el.textLineHeightVal = document.getElementById('text-line-height-val');
  el.textLetterSpacing = document.getElementById('text-letter-spacing');
  el.textLetterSpacingVal = document.getElementById('text-letter-spacing-val');
  el.textColor = document.getElementById('text-color');
  el.textColorHex = document.getElementById('text-color-hex');

  // Collapsible Effects (Text Layer)
  el.collapsibleTriggerEffects = document.getElementById('collapsible-trigger-effects');
  el.collapsibleBodyEffects = document.getElementById('collapsible-body-effects');
  el.chevronEffects = document.getElementById('chevron-effects');
  el.enableShadow = document.getElementById('enable-shadow');
  el.shadowControlsWrapper = document.getElementById('shadow-controls-wrapper');
  el.shadowColor = document.getElementById('shadow-color');
  el.shadowColorHex = document.getElementById('shadow-color-hex');
  el.shadowBlur = document.getElementById('shadow-blur');
  el.shadowBlurVal = document.getElementById('shadow-blur-val');
  el.shadowX = document.getElementById('shadow-x');
  el.shadowY = document.getElementById('shadow-y');
  el.enableBgBlock = document.getElementById('enable-bg-block');
  el.bgBlockControlsWrapper = document.getElementById('bg-block-controls-wrapper');
  el.bgBlockColor = document.getElementById('bg-block-color');
  el.bgBlockColorHex = document.getElementById('bg-block-color-hex');
  el.bgBlockOpacity = document.getElementById('bg-block-opacity');
  el.bgBlockOpacityVal = document.getElementById('bg-block-opacity-val');
  el.bgBlockPadding = document.getElementById('bg-block-padding');
  el.bgBlockPaddingVal = document.getElementById('bg-block-padding-val');

  // Image Layer Controls
  el.imgPreviewThumb = document.getElementById('img-preview-thumb');
  el.imgPreviewThumbEl = document.getElementById('img-preview-thumb-el');
  el.imgFilename = document.getElementById('img-filename');
  el.imgNativeRes = document.getElementById('img-native-res');
  el.replaceImageBtn = document.getElementById('replace-image-btn');
  el.replaceImageInput = document.getElementById('replace-image-input');
  el.imgWidth = document.getElementById('img-width');
  el.imgHeight = document.getElementById('img-height');
  el.imgLockRatioBtn = document.getElementById('img-lock-ratio-btn');
  el.imgScale = document.getElementById('img-scale');
  el.imgScaleVal = document.getElementById('img-scale-val');
  el.imgPreset100 = document.getElementById('img-preset-100');
  el.imgPresetFitW = document.getElementById('img-preset-fit-w');
  el.imgPresetFitH = document.getElementById('img-preset-fit-h');
  el.imgPresetHalf = document.getElementById('img-preset-half');
  el.imgRotation = document.getElementById('img-rotation');
  el.imgRotationVal = document.getElementById('img-rotation-val');
  el.rotPreset0 = document.getElementById('rot-preset-0');
  el.rotPresetCcw = document.getElementById('rot-preset-ccw');
  el.rotPresetCw = document.getElementById('rot-preset-cw');
  el.rotPreset180 = document.getElementById('rot-preset-180');
  el.imgOpacity = document.getElementById('img-opacity');
  el.imgOpacityVal = document.getElementById('img-opacity-val');
  el.imgGrayscale = document.getElementById('img-grayscale');
  el.imgEnableShadow = document.getElementById('img-enable-shadow');
  el.imgShadowControls = document.getElementById('img-shadow-controls');
  el.imgShadowColor = document.getElementById('img-shadow-color');
  el.imgShadowColorHex = document.getElementById('img-shadow-color-hex');
  el.imgShadowBlur = document.getElementById('img-shadow-blur');
  el.imgShadowBlurVal = document.getElementById('img-shadow-blur-val');
  el.imgShadowX = document.getElementById('img-shadow-x');
  el.imgShadowY = document.getElementById('img-shadow-y');

  // Canvas Settings
  el.enableTint = document.getElementById('enable-tint');
  el.tintControlsWrapper = document.getElementById('tint-controls-wrapper');
  el.tintColor = document.getElementById('tint-color');
  el.tintColorHex = document.getElementById('tint-color-hex');
  el.tintOpacity = document.getElementById('tint-opacity');
  el.tintOpacityVal = document.getElementById('tint-opacity-val');
  el.canvasBgColor = document.getElementById('canvas-bg-color');
  el.canvasBgColorHex = document.getElementById('canvas-bg-color-hex');

  // Viewport & Canvas
  el.previewPane = document.getElementById('preview-pane');
  el.previewFrame = document.getElementById('preview-frame');
  el.previewCanvasWrapper = document.getElementById('preview-canvas-wrapper');
  el.previewBgImage = document.getElementById('preview-bg-image');
  el.previewTint = document.getElementById('preview-tint');
  el.snapGuideX = document.getElementById('snap-guide-x');
  el.snapGuideY = document.getElementById('snap-guide-y');
  el.previewTextContainer = document.getElementById('preview-text-container');

  // Quick Toolbar
  el.toolSelectBtn = document.getElementById('tool-select-btn');
  el.toolPanBtn = document.getElementById('tool-pan-btn');
  el.toolSnapBtn = document.getElementById('tool-snap-btn');
  el.quickCenterX = document.getElementById('quick-center-x');
  el.quickCenterY = document.getElementById('quick-center-y');
  el.quickDeleteLayer = document.getElementById('quick-delete-layer');

  // Viewport Status Bar
  el.toggleGrid = document.getElementById('toggle-grid');
  el.zoomFitBtn = document.getElementById('zoom-fit-btn');
  el.previewZoom = document.getElementById('preview-zoom');
  el.previewZoomVal = document.getElementById('preview-zoom-val');
  el.viewportDimensionsInfo = document.getElementById('viewport-dimensions-info');

  // Overlays
  el.globalDragOverlay = document.getElementById('global-drag-overlay');
  el.dragOverlayTitle = document.getElementById('drag-overlay-title');
  el.dragOverlaySubtitle = document.getElementById('drag-overlay-subtitle');
  el.toastContainer = document.getElementById('toast-container');

  // Walkthrough
  el.walkthroughBtn = document.getElementById('walkthrough-btn');

  // Transparency
  el.canvasTransparentToggle = document.getElementById('canvas-transparent-toggle');

  // Alignment Tools
  el.alignLeftBtn = document.getElementById('align-left-btn');
  el.alignCenterXBtn = document.getElementById('align-center-x-btn');
  el.alignRightBtn = document.getElementById('align-right-btn');
  el.alignTopBtn = document.getElementById('align-top-btn');
  el.alignMiddleYBtn = document.getElementById('align-middle-y-btn');
  el.alignBottomBtn = document.getElementById('align-bottom-btn');

  // Guides Tools
  el.addHGuideBtn = document.getElementById('add-h-guide-btn');
  el.addVGuideBtn = document.getElementById('add-v-guide-btn');
  el.clearGuidesBtn = document.getElementById('clear-guides-btn');

  // Exact Numeric Inputs
  el.textXInput = document.getElementById('text-x-input');
  el.textYInput = document.getElementById('text-y-input');
  el.textFontSizeInput = document.getElementById('text-font-size-input');
  el.imgScaleInput = document.getElementById('img-scale-input');
  el.imgRotationInput = document.getElementById('img-rotation-input');
  el.previewZoomInput = document.getElementById('preview-zoom-input');

  // Master Designs
  el.masterDesignsBar = document.getElementById('master-designs-bar');
  el.masterDesignsTabs = document.getElementById('master-designs-tabs');
  el.addDesignBtn = document.getElementById('add-design-btn');
  el.duplicateDesignBtn = document.getElementById('duplicate-design-btn');
  el.deleteDesignBtn = document.getElementById('delete-design-btn');
  el.exportBatchBtn = document.getElementById('export-batch-btn');
}

// Auto-populate el if document is already parsed when module executes
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOM);
  } else {
    initDOM();
  }
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
export function showToast(message, duration = 2800) {
  if (!el || !el.toastContainer || typeof document === 'undefined') return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
