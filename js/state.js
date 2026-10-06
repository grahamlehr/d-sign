/* ==========================================================================
   State Management & History (Undo/Redo) Stack
   ========================================================================== */

import { showToast } from './dom.js';
import { syncAllUIControls, syncActiveLayerControls, updateCanvasDimensions } from './ui.js';
import { updatePreview } from './canvas.js';

export const state = {
  theme: 'daylight',
  preset: 'landscape',
  width: 1920,
  height: 1080,
  zoomMode: 'fit',

  // Background
  bgImage: null,
  bgImageName: '',
  bgImageBlob: null,
  bgImageDataUrl: '',
  bgSizeMode: 'cover',
  bgZoom: 1.0,
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgGrayscale: false,

  // Canvas globals
  canvasBgColor: '#0b0f19',
  canvasTransparent: false,
  enableTint: false,
  tintColor: '#000000',
  tintOpacity: 40,

  // Direct interaction modes
  isPanMode: false,
  isSpacePressed: false,
  enableSnapping: true,
  viewportPanX: 0,
  viewportPanY: 0,

  // Guides (Vertical and Horizontal non-exported guidelines)
  guides: { horizontal: [], vertical: [] },

  // Layers & Selection
  layers: [
    {
      id: 'layer_1',
      type: 'text',
      name: 'Main Headline',
      x: 50.0,
      y: 45.0,
      rotation: 0,
      opacity: 100,
      visible: true,
      textContent: 'D-SIGN DIGITAL SIGNAGE · MAIN TERMINAL',
      textFontFamily: 'Archivo',
      textWeight: '800',
      textAlign: 'center',
      textX: 50.0,
      textY: 45.0,
      textFontSize: 70,
      textLineHeight: 1.2,
      textLetterSpacing: 1.5,
      textColor: '#ffffff',
      enableShadow: false,
      shadowColor: '#000000',
      shadowBlur: 15,
      shadowX: 3,
      shadowY: 3,
      enableBgBlock: false,
      bgBlockColor: '#000000',
      bgBlockOpacity: 60,
      bgBlockPadding: 20,
      bgBlockRadius: 0
    }
  ],
  activeLayerId: 'layer_1',
  selectedLayerIds: ['layer_1'],
  customFonts: [],

  // Master Designs (Artboards/Templates)
  activeDesignId: 'design_1',
  designs: []
};

// Undo History Stack
export const historyStack = [];
export const MAX_HISTORY = 25;
export const imageElementCache = new Map();

/**
 * Normalizes a layer to ensure all common layer properties (type, coordinates, rotation, opacity, visibility)
 * exist and are synchronized between polymorphic x/y and legacy textX/textY.
 * Guarantees backwards compatibility with Schema v1 project files and existing text layers.
 * @param {Object} layer - Layer configuration object
 * @returns {Object} Normalized layer object
 */
export function normalizeLayer(layer) {
  if (!layer) return layer;
  if (!layer.type) {
    layer.type = 'text';
  }
  if (layer.x === undefined && layer.textX !== undefined) {
    layer.x = layer.textX;
  }
  if (layer.y === undefined && layer.textY !== undefined) {
    layer.y = layer.textY;
  }
  if (layer.textX === undefined && layer.x !== undefined) {
    layer.textX = layer.x;
  }
  if (layer.textY === undefined && layer.y !== undefined) {
    layer.textY = layer.y;
  }
  layer.rotation = layer.rotation || 0;
  layer.opacity = (layer.opacity !== undefined) ? layer.opacity : 100;
  layer.visible = (layer.visible !== undefined) ? layer.visible : true;
  if (layer.type === 'image') {
    if (layer.width === undefined) layer.width = layer.origWidth || 400;
    if (layer.height === undefined) layer.height = layer.origHeight || 400;
    if (layer.aspectRatio === undefined) layer.aspectRatio = (layer.width && layer.height) ? (layer.width / layer.height) : 1.0;
    if (layer.lockAspectRatio === undefined) layer.lockAspectRatio = true;
    if (layer.scale === undefined) layer.scale = (layer.origWidth && layer.width) ? (layer.width / layer.origWidth) : 1.0;
  }
  return layer;
}

export function pushHistorySnapshot() {
  if (historyStack.length >= MAX_HISTORY) {
    historyStack.shift();
  }

  // Cache live image elements by dataUrl before snapshotting
  state.layers.forEach(l => {
    if (l.type === 'image' && l.dataUrl && l.image && (typeof HTMLImageElement !== 'undefined' ? l.image instanceof HTMLImageElement : true)) {
      imageElementCache.set(l.dataUrl, l.image);
    }
  });

  // Prepare clean serializable layer list (strip non-serializable DOM & Blob instances)
  const cleanLayers = state.layers.map(layer => {
    if (layer.type === 'image') {
      const { image, blob, ...rest } = layer;
      return rest;
    }
    return { ...layer };
  });

  historyStack.push(JSON.stringify({
    preset: state.preset,
    width: state.width,
    height: state.height,
    bgZoom: state.bgZoom,
    bgOffsetX: state.bgOffsetX,
    bgOffsetY: state.bgOffsetY,
    bgGrayscale: state.bgGrayscale,
    canvasBgColor: state.canvasBgColor,
    canvasTransparent: state.canvasTransparent,
    enableTint: state.enableTint,
    tintColor: state.tintColor,
    tintOpacity: state.tintOpacity,
    guides: state.guides,
    layers: cleanLayers,
    activeLayerId: state.activeLayerId,
    selectedLayerIds: state.selectedLayerIds || [state.activeLayerId]
  }));
}

export function undoLastAction() {
  if (historyStack.length === 0) {
    showToast('No more undo steps');
    return;
  }
  const snapshot = JSON.parse(historyStack.pop());
  state.preset = snapshot.preset;
  state.width = snapshot.width;
  state.height = snapshot.height;
  state.bgZoom = snapshot.bgZoom;
  state.bgOffsetX = snapshot.bgOffsetX;
  state.bgOffsetY = snapshot.bgOffsetY;
  state.bgGrayscale = snapshot.bgGrayscale;
  state.canvasBgColor = snapshot.canvasBgColor;
  state.canvasTransparent = snapshot.canvasTransparent || false;
  state.enableTint = snapshot.enableTint;
  state.tintColor = snapshot.tintColor;
  state.tintOpacity = snapshot.tintOpacity;
  if (snapshot.guides) {
    state.guides = {
      horizontal: snapshot.guides.horizontal || [],
      vertical: snapshot.guides.vertical || []
    };
  }

  // Restore layers and re-attach image references
  state.layers = (snapshot.layers || []).map(layer => {
    const norm = normalizeLayer(layer);
    if (norm.type === 'image') {
      if (norm.dataUrl && imageElementCache.has(norm.dataUrl)) {
        norm.image = imageElementCache.get(norm.dataUrl);
      } else if (norm.dataUrl) {
        const img = new Image();
        img.onload = () => updatePreview();
        img.src = norm.dataUrl;
        norm.image = img;
        imageElementCache.set(norm.dataUrl, img);
      }
    }
    return norm;
  });

  state.activeLayerId = snapshot.activeLayerId;
  state.selectedLayerIds = snapshot.selectedLayerIds || [snapshot.activeLayerId];

  syncAllUIControls();
  updateCanvasDimensions();
  updatePreview();
  showToast('Action undone');
}

/**
 * Creates a master design object representing an artboard/page
 */
export function createDefaultDesign(name = 'Master 1', id = 'design_1') {
  return {
    id: id,
    name: name,
    preset: state.preset || 'landscape',
    width: state.width || 1920,
    height: state.height || 1080,
    canvasBgColor: state.canvasBgColor || '#0b0f19',
    canvasTransparent: state.canvasTransparent || false,
    bgImage: state.bgImage || null,
    bgImageName: state.bgImageName || '',
    bgImageBlob: state.bgImageBlob || null,
    bgImageDataUrl: state.bgImageDataUrl || '',
    bgSizeMode: state.bgSizeMode || 'cover',
    bgZoom: state.bgZoom !== undefined ? state.bgZoom : 1.0,
    bgOffsetX: state.bgOffsetX !== undefined ? state.bgOffsetX : 0,
    bgOffsetY: state.bgOffsetY !== undefined ? state.bgOffsetY : 0,
    bgGrayscale: state.bgGrayscale || false,
    enableTint: state.enableTint || false,
    tintColor: state.tintColor || '#000000',
    tintOpacity: state.tintOpacity !== undefined ? state.tintOpacity : 40,
    layers: (state.layers || []).map(l => {
      const { image, blob, ...rest } = l;
      return { ...rest };
    }),
    activeLayerId: state.activeLayerId || (state.layers && state.layers[0] ? state.layers[0].id : null),
    selectedLayerIds: state.selectedLayerIds ? [...state.selectedLayerIds] : [state.activeLayerId],
    guides: {
      horizontal: state.guides && state.guides.horizontal ? [...state.guides.horizontal] : [],
      vertical: state.guides && state.guides.vertical ? [...state.guides.vertical] : []
    }
  };
}

/**
 * Ensures state.designs is initialized with at least one design
 */
export function initDesigns() {
  if (!state.designs || state.designs.length === 0) {
    const initial = createDefaultDesign('Master 1', 'design_1');
    state.designs = [initial];
    state.activeDesignId = initial.id;
  }
}

/**
 * Synchronizes currently active design entry in state.designs from the global state
 */
export function syncActiveDesignFromState() {
  initDesigns();
  const current = state.designs.find(d => d.id === state.activeDesignId) || state.designs[0];
  if (!current) return;
  current.preset = state.preset;
  current.width = state.width;
  current.height = state.height;
  current.canvasBgColor = state.canvasBgColor;
  current.canvasTransparent = state.canvasTransparent;
  current.bgImage = state.bgImage;
  current.bgImageName = state.bgImageName;
  current.bgImageBlob = state.bgImageBlob;
  current.bgImageDataUrl = state.bgImageDataUrl;
  current.bgSizeMode = state.bgSizeMode;
  current.bgZoom = state.bgZoom;
  current.bgOffsetX = state.bgOffsetX;
  current.bgOffsetY = state.bgOffsetY;
  current.bgGrayscale = state.bgGrayscale;
  current.enableTint = state.enableTint;
  current.tintColor = state.tintColor;
  current.tintOpacity = state.tintOpacity;
  current.layers = state.layers.map(l => {
    const { image, blob, ...rest } = l;
    return rest;
  });
  current.activeLayerId = state.activeLayerId;
  current.selectedLayerIds = state.selectedLayerIds ? [...state.selectedLayerIds] : [state.activeLayerId];
  current.guides = {
    horizontal: [...(state.guides.horizontal || [])],
    vertical: [...(state.guides.vertical || [])]
  };
}

/**
 * Hydrates the global state from a given design object
 */
export function syncStateFromDesign(design) {
  if (!design) return;
  state.activeDesignId = design.id;
  state.preset = design.preset || 'landscape';
  state.width = design.width || 1920;
  state.height = design.height || 1080;
  state.canvasBgColor = design.canvasBgColor || '#0b0f19';
  state.canvasTransparent = design.canvasTransparent || false;
  state.bgImage = design.bgImage || null;
  state.bgImageName = design.bgImageName || '';
  state.bgImageBlob = design.bgImageBlob || null;
  state.bgImageDataUrl = design.bgImageDataUrl || '';
  state.bgSizeMode = design.bgSizeMode || 'cover';
  state.bgZoom = design.bgZoom !== undefined ? design.bgZoom : 1.0;
  state.bgOffsetX = design.bgOffsetX !== undefined ? design.bgOffsetX : 0;
  state.bgOffsetY = design.bgOffsetY !== undefined ? design.bgOffsetY : 0;
  state.bgGrayscale = design.bgGrayscale || false;
  state.enableTint = design.enableTint || false;
  state.tintColor = design.tintColor || '#000000';
  state.tintOpacity = design.tintOpacity !== undefined ? design.tintOpacity : 40;
  state.guides = {
    horizontal: design.guides && design.guides.horizontal ? [...design.guides.horizontal] : [],
    vertical: design.guides && design.guides.vertical ? [...design.guides.vertical] : []
  };

  // Rebuild layers with cached images where available
  state.layers = (design.layers || []).map(layer => {
    const norm = normalizeLayer(layer);
    if (norm.type === 'image') {
      if (norm.dataUrl && imageElementCache.has(norm.dataUrl)) {
        norm.image = imageElementCache.get(norm.dataUrl);
      } else if (norm.dataUrl) {
        const img = new Image();
        img.onload = () => updatePreview();
        img.src = norm.dataUrl;
        norm.image = img;
        imageElementCache.set(norm.dataUrl, img);
      }
    }
    return norm;
  });

  state.activeLayerId = design.activeLayerId || (state.layers[0] ? state.layers[0].id : null);
  state.selectedLayerIds = design.selectedLayerIds && design.selectedLayerIds.length > 0
    ? [...design.selectedLayerIds]
    : [state.activeLayerId];
}

/**
 * Switch active design by ID
 */
export function switchActiveDesign(id) {
  syncActiveDesignFromState();
  const target = state.designs.find(d => d.id === id);
  if (!target) return;
  syncStateFromDesign(target);
  historyStack.length = 0; // Reset history for clean design context
  syncAllUIControls();
  updateCanvasDimensions();
  updatePreview();
}

/**
 * Add a new blank master design
 */
export function addNewDesign(name = '') {
  syncActiveDesignFromState();
  const num = state.designs.length + 1;
  const newName = name || `Master ${num}`;
  const newId = `design_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const layerId = `layer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newDesign = {
    id: newId,
    name: newName,
    preset: state.preset,
    width: state.width,
    height: state.height,
    canvasBgColor: state.canvasBgColor,
    canvasTransparent: state.canvasTransparent,
    bgImage: null,
    bgImageName: '',
    bgImageBlob: null,
    bgImageDataUrl: '',
    bgSizeMode: 'cover',
    bgZoom: 1.0,
    bgOffsetX: 0,
    bgOffsetY: 0,
    bgGrayscale: false,
    enableTint: false,
    tintColor: '#000000',
    tintOpacity: 40,
    layers: [
      {
        id: layerId,
        type: 'text',
        name: 'Headline',
        x: 50.0,
        y: 45.0,
        rotation: 0,
        opacity: 100,
        visible: true,
        textContent: `${newName.toUpperCase()} · SIGNAGE`,
        textFontFamily: 'Archivo',
        textWeight: '800',
        textAlign: 'center',
        textX: 50.0,
        textY: 45.0,
        textFontSize: 70,
        textLineHeight: 1.2,
        textLetterSpacing: 1.5,
        textColor: '#ffffff',
        enableShadow: false,
        shadowColor: '#000000',
        shadowBlur: 15,
        shadowX: 3,
        shadowY: 3,
        enableBgBlock: false,
        bgBlockColor: '#000000',
        bgBlockOpacity: 60,
        bgBlockPadding: 20,
        bgBlockRadius: 0
      }
    ],
    activeLayerId: layerId,
    selectedLayerIds: [layerId],
    guides: { horizontal: [], vertical: [] }
  };
  state.designs.push(newDesign);
  switchActiveDesign(newId);
  showToast(`Added: ${newName}`);
}

/**
 * Duplicate the currently active master design
 */
export function duplicateActiveDesign() {
  syncActiveDesignFromState();
  const current = state.designs.find(d => d.id === state.activeDesignId) || state.designs[0];
  if (!current) return;
  const cloneId = `design_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cloneName = `${current.name} (Copy)`;
  const cloneLayers = (current.layers || []).map((l, i) => ({
    ...l,
    id: `layer_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`
  }));
  const clone = {
    ...JSON.parse(JSON.stringify(current)),
    id: cloneId,
    name: cloneName,
    bgImage: current.bgImage,
    bgImageBlob: current.bgImageBlob,
    layers: cloneLayers,
    activeLayerId: cloneLayers[0] ? cloneLayers[0].id : null,
    selectedLayerIds: cloneLayers[0] ? [cloneLayers[0].id] : []
  };
  const idx = state.designs.indexOf(current);
  state.designs.splice(idx + 1, 0, clone);
  switchActiveDesign(cloneId);
  showToast(`Duplicated: ${cloneName}`);
}

/**
 * Delete a master design by ID
 */
export function deleteActiveDesign(id) {
  if (state.designs.length <= 1) {
    showToast('At least one master design is required');
    return;
  }
  const targetId = id || state.activeDesignId;
  const idx = state.designs.findIndex(d => d.id === targetId);
  if (idx === -1) return;
  state.designs.splice(idx, 1);
  if (state.activeDesignId === targetId) {
    const nextDesign = state.designs[Math.min(idx, state.designs.length - 1)];
    switchActiveDesign(nextDesign.id);
  } else {
    syncAllUIControls();
  }
  showToast('Master design removed');
}

/**
 * Deselect all layers
 */
export function deselectLayers() {
  state.activeLayerId = null;
  state.selectedLayerIds = [];
}

/**
 * Select a layer, supporting single selection, multi-selection (Shift/Cmd click), and deselection
 */
export function selectLayer(id, isMulti = false) {
  if (!id) {
    deselectLayers();
    return;
  }
  if (!state.selectedLayerIds) state.selectedLayerIds = [];
  if (!isMulti) {
    state.activeLayerId = id;
    state.selectedLayerIds = [id];
  } else {
    const idx = state.selectedLayerIds.indexOf(id);
    if (idx !== -1) {
      state.selectedLayerIds.splice(idx, 1);
      if (state.activeLayerId === id) {
        state.activeLayerId = state.selectedLayerIds.length > 0
          ? state.selectedLayerIds[state.selectedLayerIds.length - 1]
          : null;
      }
    } else {
      state.selectedLayerIds.push(id);
      state.activeLayerId = id;
    }
  }
}

/**
 * Alignment Suite for multiple selected layers
 * Types: 'left', 'centerX'/'center-x', 'right', 'top', 'middleY'/'middle-y', 'bottom'
 */
export function alignSelectedLayers(type, relativeToCanvas = false) {
  const ids = state.selectedLayerIds && state.selectedLayerIds.length > 0
    ? state.selectedLayerIds
    : (state.activeLayerId ? [state.activeLayerId] : []);
  if (!ids || ids.length === 0) return;

  const targetLayers = state.layers.filter(l => ids.includes(l.id));
  if (targetLayers.length === 0) return;

  pushHistorySnapshot();

  const cWidth = state.width || 1920;
  const cHeight = state.height || 1080;

  // Helper to get pixel bounding dimensions of a layer
  const getDims = (layer) => {
    let w = 400;
    let h = 100;
    if (layer.type === 'image') {
      w = layer.width !== undefined ? layer.width : ((layer.origWidth || 400) * (layer.scale || 1.0));
      h = layer.height !== undefined ? layer.height : ((layer.origHeight || 400) * (layer.scale || 1.0));
    } else {
      if (layer.width && layer.height) {
        w = layer.width;
        h = layer.height;
      } else {
        const textLen = (layer.textContent && layer.textContent.length) ? layer.textContent.length : 10;
        const fs = layer.textFontSize || 70;
        w = fs * textLen * 0.55;
        h = fs * (layer.textLineHeight || 1.2);
      }
    }
    return { w, h };
  };

  // Compute visual bounds for each target layer
  const items = targetLayers.map(layer => {
    const curX = parseFloat(layer.x !== undefined ? layer.x : layer.textX) || 50.0;
    const curY = parseFloat(layer.y !== undefined ? layer.y : layer.textY) || 50.0;
    const { w, h } = getDims(layer);

    const wPct = (w / cWidth) * 100;
    const hPct = (h / cHeight) * 100;

    let vLeft, vRight, vMidX;
    if (layer.type === 'text' && layer.textAlign === 'left') {
      vLeft = curX;
      vRight = curX + wPct;
      vMidX = curX + wPct / 2;
    } else if (layer.type === 'text' && layer.textAlign === 'right') {
      vLeft = curX - wPct;
      vRight = curX;
      vMidX = curX - wPct / 2;
    } else {
      // center or image
      vLeft = curX - wPct / 2;
      vRight = curX + wPct / 2;
      vMidX = curX;
    }
    const vTop = curY - hPct / 2;
    const vBottom = curY + hPct / 2;
    const vMidY = curY;

    return {
      layer,
      curX,
      curY,
      w,
      h,
      vLeft,
      vRight,
      vTop,
      vBottom,
      vMidX,
      vMidY
    };
  });

  const minLeft = Math.min(...items.map(i => i.vLeft));
  const maxRight = Math.max(...items.map(i => i.vRight));
  const minTop = Math.min(...items.map(i => i.vTop));
  const maxBottom = Math.max(...items.map(i => i.vBottom));
  const groupMidX = (minLeft + maxRight) / 2;
  const groupMidY = (minTop + maxBottom) / 2;

  const isCanvasRel = targetLayers.length === 1 || relativeToCanvas;
  const targetLeft = isCanvasRel ? 0 : minLeft;
  const targetRight = isCanvasRel ? 100 : maxRight;
  const targetCenterX = isCanvasRel ? 50 : groupMidX;
  const targetTop = isCanvasRel ? 0 : minTop;
  const targetBottom = isCanvasRel ? 100 : maxBottom;
  const targetCenterY = isCanvasRel ? 50 : groupMidY;

  items.forEach(item => {
    let deltaX = 0;
    let deltaY = 0;

    if (type === 'left') deltaX = targetLeft - item.vLeft;
    else if (type === 'center-x' || type === 'centerX') deltaX = targetCenterX - item.vMidX;
    else if (type === 'right') deltaX = targetRight - item.vRight;
    else if (type === 'top') deltaY = targetTop - item.vTop;
    else if (type === 'middle-y' || type === 'middleY') deltaY = targetCenterY - item.vMidY;
    else if (type === 'bottom') deltaY = targetBottom - item.vBottom;

    if (deltaX !== 0) {
      const newX = Math.round((item.curX + deltaX) * 10) / 10;
      item.layer.x = newX;
      item.layer.textX = newX;
    }
    if (deltaY !== 0) {
      const newY = Math.round((item.curY + deltaY) * 10) / 10;
      item.layer.y = newY;
      item.layer.textY = newY;
    }
  });

  updatePreview();
  syncActiveLayerControls();
  showToast(`Layers aligned: ${type}`);
}

