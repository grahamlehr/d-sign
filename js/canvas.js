/* ==========================================================================
   Canvas & DOM Preview Renderer
   ========================================================================== */

import { state, normalizeLayer } from './state.js';
import { el } from './dom.js';
import { hexToRgba } from './utils.js';

export function updatePreview() {
  if (!el || !el.previewFrame) return;
  const pf = el.previewFrame;

  if (state.canvasTransparent) {
    pf.style.backgroundColor = 'transparent';
    pf.classList.add('checkerboard');
  } else {
    pf.style.backgroundColor = state.canvasBgColor;
  }

  // Background adjustments
  pf.style.setProperty('--bg-zoom', state.bgZoom.toString());
  pf.style.setProperty('--bg-offset-x', state.bgOffsetX.toString());
  pf.style.setProperty('--bg-offset-y', state.bgOffsetY.toString());

  if (state.bgImage && el.previewBgImage) {
    el.previewBgImage.style.objectFit = state.bgSizeMode;
  }
  if (el.previewBgImage) {
    el.previewBgImage.classList.toggle('grayscale', state.bgGrayscale);
  }

  // Tint Filter
  if (state.enableTint) {
    pf.style.setProperty('--tint-color', state.tintColor);
    pf.style.setProperty('--tint-opacity', (state.tintOpacity / 100).toString());
  } else {
    pf.style.setProperty('--tint-opacity', '0');
  }

  // Rebuild Dynamic Layers (Text & Images)
  if (!el.previewTextContainer) return;
  el.previewTextContainer.innerHTML = '';
  const scale = parseFloat(pf.style.getPropertyValue('--scale-factor')) || 1;

  state.layers.forEach(layer => {
    normalizeLayer(layer);
    if (layer.visible === false) return;

    const isActive = layer.id === state.activeLayerId;
    const isSelected = state.selectedLayerIds ? state.selectedLayerIds.includes(layer.id) : isActive;
    const box = document.createElement('div');
    box.className = 'preview-text-box' + (isActive ? ' active-layer' : '') + (isSelected && !isActive ? ' multi-selected' : '');
    box.dataset.id = layer.id;

    const posX = layer.x !== undefined ? layer.x : layer.textX;
    const posY = layer.y !== undefined ? layer.y : layer.textY;

    box.style.left = `${posX}%`;
    box.style.top = `${posY}%`;
    box.style.opacity = ((layer.opacity !== undefined ? layer.opacity : 100) / 100).toString();

    if (layer.type === 'image') {
      if (isActive) {
        box.classList.add('has-handles');
      }
      box.style.transform = `translate(-50%, -50%) rotate(${layer.rotation || 0}deg)`;
      const imgEl = document.createElement('img');
      imgEl.style.display = 'block';
      imgEl.style.pointerEvents = 'none';
      const displayW = (layer.width !== undefined ? layer.width : ((layer.origWidth || 400) * (layer.scale !== undefined ? layer.scale : 1.0))) * scale;
      const displayH = (layer.height !== undefined ? layer.height : ((layer.origHeight || 400) * (layer.scale !== undefined ? layer.scale : 1.0))) * scale;
      imgEl.style.width = `${displayW}px`;
      imgEl.style.height = `${displayH}px`;
      imgEl.style.objectFit = 'contain';
      let filters = [];
      if (layer.grayscale) {
        filters.push('grayscale(100%)');
      }
      if (layer.enableShadow) {
        const sx = (layer.shadowX !== undefined ? layer.shadowX : 3) * scale;
        const sy = (layer.shadowY !== undefined ? layer.shadowY : 3) * scale;
        const sb = (layer.shadowBlur !== undefined ? layer.shadowBlur : 15) * scale;
        const sc = layer.shadowColor || '#000000';
        filters.push(`drop-shadow(${sx}px ${sy}px ${sb}px ${sc})`);
      }
      imgEl.style.filter = filters.length > 0 ? filters.join(' ') : 'none';
      if (layer.dataUrl) {
        imgEl.src = layer.dataUrl;
      } else if (layer.image && layer.image.src) {
        imgEl.src = layer.image.src;
      }
      box.appendChild(imgEl);

      // On-canvas interactive transform handles for active image layer
      if (isActive) {
        const stalk = document.createElement('div');
        stalk.className = 'rotation-stalk';
        box.appendChild(stalk);

        const rotHandle = document.createElement('div');
        rotHandle.className = 'rotation-handle';
        rotHandle.title = 'Rotate layer (Hold Shift for 45° snap)';
        rotHandle.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>';
        box.appendChild(rotHandle);

        const handles = ['nw', 'ne', 'se', 'sw'];
        handles.forEach(pos => {
          const handle = document.createElement('div');
          handle.className = `resize-handle resize-${pos}`;
          handle.dataset.handle = pos;
          box.appendChild(handle);
        });
      }
    } else {
      let tx = '-50%';
      if (layer.textAlign === 'left') tx = '0%';
      else if (layer.textAlign === 'right') tx = '-100%';
      box.style.transform = `translate(${tx}, -50%) rotate(${layer.rotation || 0}deg)`;

      box.style.textAlign = layer.textAlign;
      box.style.fontFamily = `"${layer.textFontFamily}", "Archivo", sans-serif`;
      box.style.fontSize = `${layer.textFontSize * scale}px`;
      box.style.fontWeight = layer.textWeight;
      box.style.color = layer.textColor;
      box.style.lineHeight = layer.textLineHeight;
      box.style.letterSpacing = `${layer.textLetterSpacing * scale}px`;

      if (layer.enableBgBlock) {
        const bg = hexToRgba(layer.bgBlockColor, layer.bgBlockOpacity / 100);
        box.style.backgroundColor = bg;
        box.style.padding = `${layer.bgBlockPadding * scale}px`;
      } else {
        box.style.backgroundColor = 'transparent';
        box.style.padding = '0';
      }

      if (layer.enableShadow) {
        box.style.textShadow = `
          ${layer.shadowX * scale}px 
          ${layer.shadowY * scale}px 
          ${layer.shadowBlur * scale}px 
          ${layer.shadowColor}
        `;
      } else {
        box.style.textShadow = 'none';
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'layer-text-render';
      textSpan.textContent = layer.textContent;
      box.appendChild(textSpan);
    }

    // Active HUD badge showing live percentage coordinates and metrics
    const hud = document.createElement('div');
    hud.className = 'coords-hud tn';
    const posXNum = parseFloat(posX) || 0;
    const posYNum = parseFloat(posY) || 0;
    if (layer.type === 'image') {
      const curW = Math.round(layer.width !== undefined ? layer.width : ((layer.origWidth || 400) * (layer.scale !== undefined ? layer.scale : 1.0)));
      const curRot = (parseFloat(layer.rotation || 0)).toFixed(1);
      hud.textContent = `X: ${posXNum.toFixed(1)}%  Y: ${posYNum.toFixed(1)}% · W: ${curW}px · ∠ ${curRot}°`;
    } else {
      hud.textContent = `X: ${posXNum.toFixed(1)}%  Y: ${posYNum.toFixed(1)}%`;
    }
    box.appendChild(hud);

    el.previewTextContainer.appendChild(box);
  });

  // Rebuild Canvas Guides (Non-exported)
  if (el.previewCanvasWrapper) {
    el.previewCanvasWrapper.querySelectorAll('.canvas-guide').forEach(g => g.remove());
    if (state.guides) {
      (state.guides.horizontal || []).forEach((pos, idx) => {
        const guideEl = document.createElement('div');
        guideEl.className = 'canvas-guide guide-h';
        guideEl.dataset.type = 'h';
        guideEl.dataset.index = idx;
        guideEl.style.top = `${pos}%`;
        guideEl.title = `H-Guide: ${pos.toFixed(1)}% (drag to move, drag off canvas to delete)`;
        const label = document.createElement('span');
        label.className = 'guide-label tn';
        label.textContent = `${pos.toFixed(1)}%`;
        guideEl.appendChild(label);
        el.previewCanvasWrapper.appendChild(guideEl);
      });
      (state.guides.vertical || []).forEach((pos, idx) => {
        const guideEl = document.createElement('div');
        guideEl.className = 'canvas-guide guide-v';
        guideEl.dataset.type = 'v';
        guideEl.dataset.index = idx;
        guideEl.style.left = `${pos}%`;
        guideEl.title = `V-Guide: ${pos.toFixed(1)}% (drag to move, drag off canvas to delete)`;
        const label = document.createElement('span');
        label.className = 'guide-label tn';
        label.textContent = `${pos.toFixed(1)}%`;
        guideEl.appendChild(label);
        el.previewCanvasWrapper.appendChild(guideEl);
      });
    }
  }
}
