/* ==========================================================================
   Layers Manager (List Rendering, Add, Reorder, Delete, Duplicate)
   ========================================================================== */

import { state, pushHistorySnapshot, normalizeLayer, imageElementCache } from './state.js';
import { el, showToast } from './dom.js';
import { syncActiveLayerControls } from './ui.js';
import { updatePreview } from './canvas.js';

let draggedLayerId = null;

export function getActiveLayer() {
  return state.layers.find(l => l.id === state.activeLayerId) || state.layers[0];
}

export function updateActiveLayerProp(key, value) {
  const activeLayer = getActiveLayer();
  if (activeLayer) {
    activeLayer[key] = value;
    if (key === 'x') {
      activeLayer.textX = value;
    } else if (key === 'textX') {
      activeLayer.x = value;
    } else if (key === 'y') {
      activeLayer.textY = value;
    } else if (key === 'textY') {
      activeLayer.y = value;
    }
    updatePreview();
    if (key === 'textContent' || key === 'name' || key === 'type') {
      renderLayersList();
    }
  }
}

export function renderLayersList() {
  if (!el || !el.layersListContainer) return;
  const container = el.layersListContainer;
  container.innerHTML = '';

  if (el.layersCountBadge) {
    el.layersCountBadge.textContent = `${state.layers.length} ${state.layers.length === 1 ? 'LAYER' : 'LAYERS'}`;
  }

  state.layers.forEach((layer, index) => {
    const card = document.createElement('div');
    card.className = 'layer-card' + (layer.id === state.activeLayerId ? ' active' : '');
    card.dataset.id = layer.id;
    card.dataset.index = index;
    card.draggable = true;

    // Left Section: Handle + Icon/Thumb + Title + Tag
    const left = document.createElement('div');
    left.className = 'layer-card-left';

    const handle = document.createElement('span');
    handle.className = 'layer-drag-handle';
    handle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`;
    left.appendChild(handle);

    if (layer.type === 'image') {
      const thumb = document.createElement('div');
      thumb.className = 'layer-thumb checkerboard';
      const img = document.createElement('img');
      img.src = layer.dataUrl || (layer.image ? layer.image.src : '');
      img.alt = layer.name || 'image layer';
      thumb.appendChild(img);
      left.appendChild(thumb);

      const title = document.createElement('span');
      title.className = 'layer-title-text';
      const layerName = layer.name || `Image Layer ${index + 1}`;
      title.textContent = layerName;
      title.title = layerName;
      left.appendChild(title);

      const badge = document.createElement('span');
      badge.className = 'tag tag-neutral tn';
      badge.textContent = 'PNG';
      left.appendChild(badge);
    } else {
      const typeIcon = document.createElement('span');
      typeIcon.className = 'layer-type-icon';
      typeIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
      left.appendChild(typeIcon);

      const title = document.createElement('span');
      title.className = 'layer-title-text';
      const previewText = (layer.textContent ? layer.textContent.trim().split('\n')[0] : '') || `Text Layer ${index + 1}`;
      title.textContent = previewText;
      title.title = previewText;
      left.appendChild(title);

      const badge = document.createElement('span');
      badge.className = 'tag tag-neutral tn';
      badge.textContent = 'TXT';
      left.appendChild(badge);
    }

    // Actions: Up / Down / Delete
    const actions = document.createElement('div');
    actions.className = 'layer-card-actions';

    const upBtn = document.createElement('button');
    upBtn.className = 'mini-btn';
    upBtn.innerHTML = '▲';
    upBtn.disabled = index === 0;
    upBtn.title = 'Move Layer Up';
    upBtn.onclick = (e) => {
      e.stopPropagation();
      pushHistorySnapshot();
      swapLayers(index, index - 1);
    };

    const downBtn = document.createElement('button');
    downBtn.className = 'mini-btn';
    downBtn.innerHTML = '▼';
    downBtn.disabled = index === state.layers.length - 1;
    downBtn.title = 'Move Layer Down';
    downBtn.onclick = (e) => {
      e.stopPropagation();
      pushHistorySnapshot();
      swapLayers(index, index + 1);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'mini-btn delete';
    delBtn.innerHTML = '✕';
    delBtn.disabled = state.layers.length <= 1;
    delBtn.title = 'Delete Layer';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteLayer(layer.id);
    };

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(delBtn);

    card.appendChild(left);
    card.appendChild(actions);

    // Selection Click
    card.onclick = () => {
      state.activeLayerId = layer.id;
      renderLayersList();
      syncActiveLayerControls();
      updatePreview();
    };

    // Drag and Drop Events for Sidebar Reordering
    card.addEventListener('dragstart', (e) => {
      draggedLayerId = layer.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', layer.id);
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      card.classList.remove('drop-target-before', 'drop-target-after');
      if (e.clientY < midY) {
        card.classList.add('drop-target-before');
      } else {
        card.classList.add('drop-target-after');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drop-target-before', 'drop-target-after');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drop-target-before', 'drop-target-after');
      if (!draggedLayerId || draggedLayerId === layer.id) return;

      pushHistorySnapshot();

      const fromIdx = state.layers.findIndex(l => l.id === draggedLayerId);
      const toIdx = state.layers.findIndex(l => l.id === layer.id);
      const rect = card.getBoundingClientRect();
      const insertBefore = e.clientY < (rect.top + rect.height / 2);

      const [movedItem] = state.layers.splice(fromIdx, 1);
      let targetIndex = state.layers.findIndex(l => l.id === layer.id);
      if (!insertBefore) targetIndex += 1;

      state.layers.splice(targetIndex, 0, movedItem);
      state.activeLayerId = movedItem.id;

      renderLayersList();
      updatePreview();
      showToast('Layers reordered');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging', 'drop-target-before', 'drop-target-after');
      draggedLayerId = null;
    });

    container.appendChild(card);
  });
}

export function swapLayers(idxA, idxB) {
  const temp = state.layers[idxA];
  state.layers[idxA] = state.layers[idxB];
  state.layers[idxB] = temp;
  renderLayersList();
  updatePreview();
}

export function deleteLayer(layerId) {
  if (state.layers.length <= 1) {
    showToast('At least one layer must remain');
    return;
  }
  pushHistorySnapshot();
  const idx = state.layers.findIndex(l => l.id === layerId);
  if (idx === -1) return;
  state.layers.splice(idx, 1);

  if (state.activeLayerId === layerId) {
    state.activeLayerId = state.layers[Math.max(0, idx - 1)].id;
  }
  renderLayersList();
  syncActiveLayerControls();
  updatePreview();
  showToast('Layer deleted');
}

export const deleteTextLayer = deleteLayer;

export function addTextLayer() {
  pushHistorySnapshot();
  const newId = 'layer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const posY = 50.0 + ((state.layers.length * 6) % 30);
  const newLayer = {
    id: newId,
    type: 'text',
    name: 'Text Layer ' + (state.layers.length + 1),
    textContent: 'NEW SIGNAGE HEADER\nSubline Detail Text',
    textFontFamily: 'Archivo',
    textWeight: '800',
    textAlign: 'center',
    x: 50.0,
    y: posY,
    textX: 50.0,
    textY: posY,
    rotation: 0,
    opacity: 100,
    visible: true,
    textFontSize: 56,
    textLineHeight: 1.2,
    textLetterSpacing: 1.0,
    textColor: '#ffffff',
    enableShadow: false,
    shadowColor: '#000000',
    shadowBlur: 10,
    shadowX: 2,
    shadowY: 2,
    enableBgBlock: false,
    bgBlockColor: '#000000',
    bgBlockOpacity: 60,
    bgBlockPadding: 16,
    bgBlockRadius: 0
  };

  state.layers.push(newLayer);
  state.activeLayerId = newId;
  renderLayersList();
  syncActiveLayerControls();
  updatePreview();
  showToast('New text layer added');
  return newLayer;
}

export function addImageLayer(layerConfig) {
  const cfg = layerConfig || {};
  pushHistorySnapshot();

  const newId = 'layer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const origW = cfg.origWidth || (cfg.image ? cfg.image.naturalWidth : 400);
  const origH = cfg.origHeight || (cfg.image ? cfg.image.naturalHeight : 400);
  const aspRatio = (origW && origH) ? (origW / origH) : 1.0;
  const w = cfg.width || origW || 400;
  const h = cfg.height || origH || 400;
  const posX = cfg.x !== undefined ? cfg.x : 50.0;
  const posY = cfg.y !== undefined ? cfg.y : 50.0;

  const newLayer = {
    id: newId,
    type: 'image',
    name: cfg.name || 'image.png',
    dataUrl: cfg.dataUrl || '',
    blob: cfg.blob || null,
    image: cfg.image || null,
    origWidth: origW,
    origHeight: origH,
    aspectRatio: aspRatio,
    width: w,
    height: h,
    scale: cfg.scale !== undefined ? cfg.scale : ((origW && w) ? (w / origW) : 1.0),
    lockAspectRatio: true,
    rotation: cfg.rotation || 0,
    opacity: cfg.opacity !== undefined ? cfg.opacity : 100,
    x: posX,
    y: posY,
    textX: posX,
    textY: posY,
    visible: true,
    grayscale: false,
    enableShadow: false,
    shadowColor: '#000000',
    shadowBlur: 10,
    shadowX: 2,
    shadowY: 2
  };

  if (newLayer.dataUrl && newLayer.image) {
    imageElementCache.set(newLayer.dataUrl, newLayer.image);
  } else if (newLayer.dataUrl && !newLayer.image) {
    if (imageElementCache.has(newLayer.dataUrl)) {
      newLayer.image = imageElementCache.get(newLayer.dataUrl);
    } else {
      const img = new Image();
      img.onload = () => updatePreview();
      img.src = newLayer.dataUrl;
      newLayer.image = img;
      imageElementCache.set(newLayer.dataUrl, img);
    }
  }

  state.layers.push(newLayer);
  state.activeLayerId = newId;

  renderLayersList();
  syncActiveLayerControls();
  updatePreview();
  showToast('New image layer added');

  return newLayer;
}

export function duplicateActiveLayer() {
  const active = getActiveLayer();
  if (!active) return;
  pushHistorySnapshot();

  const newId = 'layer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  if (active.type === 'image') {
    const duplicated = {
      ...active,
      id: newId,
      name: active.name ? (active.name.replace(/\.[^/.]+$/, '') + ' (Copy)' + (active.name.includes('.') ? active.name.substring(active.name.lastIndexOf('.')) : '')) : 'image_copy.png',
      x: Math.min(95, (active.x !== undefined ? active.x : 50) + 3),
      y: Math.min(95, (active.y !== undefined ? active.y : 50) + 3),
    };
    duplicated.textX = duplicated.x;
    duplicated.textY = duplicated.y;

    if (active.image && (typeof HTMLImageElement !== 'undefined' ? active.image instanceof HTMLImageElement : true)) {
      duplicated.image = active.image;
    } else if (active.dataUrl) {
      if (imageElementCache.has(active.dataUrl)) {
        duplicated.image = imageElementCache.get(active.dataUrl);
      } else {
        const img = new Image();
        img.onload = () => updatePreview();
        img.src = active.dataUrl;
        duplicated.image = img;
        imageElementCache.set(active.dataUrl, img);
      }
    }

    normalizeLayer(duplicated);
    state.layers.push(duplicated);
    state.activeLayerId = newId;

    renderLayersList();
    syncActiveLayerControls();
    updatePreview();
    showToast('Image layer duplicated');
    return duplicated;
  }

  const duplicated = JSON.parse(JSON.stringify(active));
  duplicated.id = newId;
  duplicated.textX = Math.min(95, (duplicated.textX !== undefined ? duplicated.textX : 50) + 3);
  duplicated.textY = Math.min(95, (duplicated.textY !== undefined ? duplicated.textY : 45) + 3);
  duplicated.x = duplicated.textX;
  duplicated.y = duplicated.textY;
  normalizeLayer(duplicated);

  state.layers.push(duplicated);
  state.activeLayerId = newId;
  renderLayersList();
  syncActiveLayerControls();
  updatePreview();
  showToast('Layer duplicated (Cmd+D)');
  return duplicated;
}
