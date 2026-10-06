/* ==========================================================================
   Utility Functions & Binary Conversions
   ========================================================================== */

import { state } from './state.js';

export function hexToRgba(hex, alpha) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function syncColorControls(pickerEl, hexEl, onUpdate) {
  if (!pickerEl || !hexEl) return;
  pickerEl.addEventListener('input', (e) => {
    const val = e.target.value;
    hexEl.value = val;
    onUpdate(val);
  });
  hexEl.addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(val) || /^#[0-9A-F]{3}$/i.test(val)) {
      pickerEl.value = val;
      onUpdate(val);
    }
  });
}

export function compareVersions(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;
  const parts1 = String(v1).replace(/^v/i, '').split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = String(v2).replace(/^v/i, '').split('.').map(p => parseInt(p, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export function base64ToArrayBuffer(base64) {
  const binaryString = (typeof window !== 'undefined' ? window.atob(base64) : atob(base64));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return (typeof window !== 'undefined' ? window.btoa(binary) : btoa(binary));
}

export async function getImageBlob() {
  if (state.bgImageBlob) {
    return state.bgImageBlob;
  }
  const src = state.bgImageDataUrl || (state.bgImage && state.bgImage.src ? state.bgImage.src : null);
  if (!src) return null;

  try {
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) {
      const res = await fetch(src);
      const blob = await res.blob();
      state.bgImageBlob = blob;
      return blob;
    }
  } catch (err) {
    console.warn('Fetch image blob failed, attempting canvas fallback:', err);
  }

  if (state.bgImage && state.bgImage.complete && state.bgImage.naturalWidth) {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = state.bgImage.naturalWidth;
        canvas.height = state.bgImage.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(state.bgImage, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) state.bgImageBlob = blob;
          resolve(blob);
        }, 'image/png');
      } catch (e) {
        console.error('Canvas export to blob failed:', e);
        resolve(null);
      }
    });
  }

  return null;
}

export function getCanvasWrappedLines(ctx, text, maxWidth) {
  const rawLines = text.split('\n');
  const wrappedLines = [];
  for (const rawLine of rawLines) {
    const words = rawLine.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    wrappedLines.push(currentLine);
  }
  return wrappedLines;
}
