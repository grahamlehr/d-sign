/* ==========================================================================
   Project Serialization & Production Export (JSON, ZIP, PNG)
   ========================================================================== */

import { APP_VERSION, SCHEMA_VERSION } from './constants.js';
import { state, pushHistorySnapshot, normalizeLayer, imageElementCache } from './state.js';
import { el, showToast } from './dom.js';
import { hexToRgba, compareVersions, base64ToArrayBuffer, arrayBufferToBase64, getImageBlob, getCanvasWrappedLines } from './utils.js';
import { syncAllUIControls, updateCanvasDimensions, fitPreviewToScreen } from './ui.js';
import { updatePreview } from './canvas.js';

export function saveProjectData() {
  // Clean layers of non-serializable DOM / Blob properties while preserving dataUrl and configuration
  const cleanLayers = state.layers.map(layer => {
    if (layer.type === 'image') {
      const { image, blob, ...rest } = layer;
      return rest;
    }
    return { ...layer };
  });

  const projectData = {
    app: 'digital-signage-generator',
    framework: 'CueSmith-Modernist',
    dSignVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    version: '2.1',
    preset: state.preset,
    width: state.width,
    height: state.height,

    bgImageName: state.bgImageName,
    bgSizeMode: state.bgSizeMode,
    bgZoom: state.bgZoom,
    bgOffsetX: state.bgOffsetX,
    bgOffsetY: state.bgOffsetY,
    bgGrayscale: state.bgGrayscale,

    canvasBgColor: state.canvasBgColor,
    canvasTransparent: state.canvasTransparent || false,
    enableTint: state.enableTint,
    tintColor: state.tintColor,
    tintOpacity: state.tintOpacity,

    guides: state.guides || { horizontal: [], vertical: [] },
    designs: (state.designs && state.designs.length > 0) ? state.designs : undefined,

    layers: cleanLayers,
    activeLayerId: state.activeLayerId,
    selectedLayerIds: state.selectedLayerIds || [state.activeLayerId],
    customFonts: state.customFonts
  };

  if (typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `D-Sign-${state.preset}-${Date.now()}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (_) {}
  }
  showToast('Project JSON exported');
  return projectData;
}

export async function loadProjectData(projectData) {
  if (projectData.app !== 'digital-signage-generator') {
    showToast('Invalid Signage project file');
    return;
  }
  pushHistorySnapshot();

  state.preset = projectData.preset || 'landscape';
  state.width = projectData.width || 1920;
  state.height = projectData.height || 1080;

  state.bgImageName = projectData.bgImageName || '';
  state.bgSizeMode = projectData.bgSizeMode || 'cover';
  state.bgZoom = projectData.bgZoom || 1.0;
  state.bgOffsetX = projectData.bgOffsetX || 0;
  state.bgOffsetY = projectData.bgOffsetY || 0;
  state.bgGrayscale = !!projectData.bgGrayscale;

  state.canvasBgColor = projectData.canvasBgColor || '#0b0f19';
  state.canvasTransparent = projectData.canvasTransparent !== undefined ? !!projectData.canvasTransparent : false;
  state.enableTint = projectData.enableTint !== undefined ? projectData.enableTint : false;
  state.tintColor = projectData.tintColor || '#000000';
  state.tintOpacity = projectData.tintOpacity !== undefined ? projectData.tintOpacity : 40;

  if (projectData.guides) {
    state.guides = {
      horizontal: projectData.guides.horizontal || [],
      vertical: projectData.guides.vertical || []
    };
  }

  if (projectData.designs && Array.isArray(projectData.designs) && projectData.designs.length > 0) {
    state.designs = projectData.designs;
    state.activeDesignId = projectData.activeDesignId || state.designs[0].id;
  }

  const rawLayers = (projectData.layers && projectData.layers.length > 0 ? projectData.layers : [
    {
      id: 'layer_1',
      type: 'text',
      name: 'Main Headline',
      x: 50.0,
      y: 45.0,
      rotation: 0,
      opacity: 100,
      visible: true,
      textContent: 'D-SIGN DIGITAL SIGNAGE',
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
  ]);

  const restoredLayers = [];
  for (const layer of rawLayers) {
    const norm = normalizeLayer({ ...layer });
    if (norm.type === 'image' && norm.dataUrl) {
      let img = imageElementCache.get(norm.dataUrl);
      if (!img) {
        img = new Image();
        await new Promise((resolve) => {
          img.onload = () => resolve(img);
          img.onerror = () => resolve(img);
          img.src = norm.dataUrl;
        });
        imageElementCache.set(norm.dataUrl, img);
      } else if (!img.complete) {
        await new Promise((resolve) => {
          img.onload = () => resolve(img);
          img.onerror = () => resolve(img);
        });
      }
      norm.image = img;
      if (norm.image && norm.image.naturalWidth) {
        if (!norm.origWidth) norm.origWidth = norm.image.naturalWidth;
        if (!norm.origHeight) norm.origHeight = norm.image.naturalHeight;
      }
    }
    restoredLayers.push(norm);
  }

  state.layers = restoredLayers;
  state.activeLayerId = (state.layers.find(l => l.id === projectData.activeLayerId) || state.layers[0] || {}).id || null;

  // Custom fonts restoring
  state.customFonts = projectData.customFonts || [];
  state.customFonts.forEach(font => {
    try {
      const binaryString = (typeof window !== 'undefined' ? window.atob(font.base64) : atob(font.base64));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      font.buffer = bytes.buffer;
      const fontFace = new FontFace(font.name, bytes.buffer);
      fontFace.load().then(loaded => {
        document.fonts.add(loaded);
        if (el.textFont) {
          const exists = Array.from(el.textFont.options).some(o => o.value === font.name);
          if (!exists) {
            const option = document.createElement('option');
            option.value = font.name;
            option.textContent = `Custom: ${font.fileName.replace(/\.[^/.]+$/, "")}`;
            el.textFont.appendChild(option);
          }
        }
      });
    } catch (e) {
      console.error("Font restoration failed", e);
    }
  });

  // Background notification
  if (el.bgImageName) {
    if (state.bgImageName) {
      el.bgImageName.textContent = state.bgImageName;
      if (el.bgStatusTag) {
        el.bgStatusTag.textContent = 'NEEDS FILE';
        el.bgStatusTag.className = 'tag tag-accent';
      }
      showToast(`Project requires background: ${state.bgImageName}`);
    } else {
      el.bgImageName.textContent = 'No file selected';
      if (el.bgStatusTag) {
        el.bgStatusTag.textContent = 'EMPTY';
        el.bgStatusTag.className = 'tag tag-neutral';
      }
    }
  }

  if (el.customW && el.customH) {
    el.customW.value = state.width;
    el.customH.value = state.height;
  }

  syncAllUIControls();
  updateCanvasDimensions();
  fitPreviewToScreen();
  updatePreview();
  return state.layers;
}

export async function exportTemplateZip() {
  const JSZipLib = (typeof JSZip !== 'undefined' ? JSZip : (typeof window !== 'undefined' ? window.JSZip : null));
  if (!JSZipLib) {
    showToast('JSZip library is not available');
    return;
  }

  try {
    const zip = new JSZipLib();

    // 1. Background image
    let bgImagePath = '';
    if (state.bgImage) {
      const imgName = state.bgImageName || 'background.png';
      bgImagePath = `images/${imgName}`;
      const imgBlob = await getImageBlob();
      if (imgBlob) {
        zip.file(bgImagePath, imgBlob);
      }
    }

    // 2. Custom fonts
    if (state.customFonts && state.customFonts.length > 0) {
      state.customFonts.forEach(font => {
        const buffer = font.buffer || (font.base64 ? base64ToArrayBuffer(font.base64) : null);
        const fileName = font.fileName || (font.name + '.ttf');
        if (buffer && fileName) {
          zip.file(`fonts/${fileName}`, buffer);
        }
      });
    }

    // 3. Transparent PNG Image Layers
    const templateLayers = state.layers.map(layer => {
      if (layer.type === 'image') {
        const layerImgName = (layer.name || ('layer_' + layer.id)).replace(/[^a-zA-Z0-9._-]/g, '_');
        const safeImgName = layerImgName.includes('.') ? layerImgName : `${layerImgName}.png`;
        const layerPath = `images/layers/${layer.id}_${safeImgName}`;

        let blobOrBuffer = null;
        if (typeof Blob !== 'undefined' && layer.blob instanceof Blob) {
          blobOrBuffer = layer.blob;
        } else if (layer.dataUrl && typeof layer.dataUrl === 'string') {
          const parts = layer.dataUrl.split(',');
          const b64 = parts.length > 1 ? parts[1] : parts[0];
          if (b64) {
            blobOrBuffer = base64ToArrayBuffer(b64);
          }
        } else if (layer.image && layer.image.src && layer.image.src.startsWith('data:')) {
          const parts = layer.image.src.split(',');
          const b64 = parts.length > 1 ? parts[1] : parts[0];
          if (b64) {
            blobOrBuffer = base64ToArrayBuffer(b64);
          }
        }

        if (blobOrBuffer) {
          zip.file(layerPath, blobOrBuffer);
        }

        // In template.json: Record relative imagePath, omit large dataUrl and DOM image/blob
        const { image, blob, dataUrl, ...rest } = layer;
        return {
          ...rest,
          imagePath: layerPath
        };
      }
      return { ...layer };
    });

    // 4. template.json metadata
    const templateData = {
      app: 'digital-signage-generator',
      framework: 'CueSmith-Modernist',
      dSignVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      version: '2.1',
      preset: state.preset,
      width: state.width,
      height: state.height,
      bgImageName: state.bgImageName,
      bgImagePath: state.bgImage ? (state.bgImageName ? 'images/' + state.bgImageName : 'images/background.png') : '',
      bgSizeMode: state.bgSizeMode,
      bgZoom: state.bgZoom,
      bgOffsetX: state.bgOffsetX,
      bgOffsetY: state.bgOffsetY,
      bgGrayscale: state.bgGrayscale,
      canvasBgColor: state.canvasBgColor,
      canvasTransparent: state.canvasTransparent || false,
      enableTint: state.enableTint,
      tintColor: state.tintColor,
      tintOpacity: state.tintOpacity,
      guides: state.guides || { horizontal: [], vertical: [] },
      designs: (state.designs && state.designs.length > 0) ? state.designs : undefined,
      layers: templateLayers,
      activeLayerId: state.activeLayerId,
      customFonts: state.customFonts.map(f => {
        const fileName = f.fileName || (f.name + '.ttf');
        return {
          name: f.name,
          fileName: fileName,
          path: 'fonts/' + fileName
        };
      })
    };

    zip.file('template.json', JSON.stringify(templateData, null, 2));

    // 5. Generate zip archive
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // 6. Download trigger (.dsign file format)
    if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
      try {
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.download = `D-Sign-Template-${state.preset}-${Date.now()}.dsign`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (_) {}
    }

    showToast('Template package (.dsign) exported');
    return { zipBlob, templateData };
  } catch (err) {
    console.error('Export template failed:', err);
    showToast('Export failed: ' + err.message);
  }
}

export async function loadTemplateZip(file) {
  if (!file) return;
  const JSZipLib = (typeof JSZip !== 'undefined' ? JSZip : (typeof window !== 'undefined' ? window.JSZip : null));
  if (!JSZipLib) {
    showToast('JSZip library is not available');
    return;
  }

  try {
    const zip = await JSZipLib.loadAsync(file);

    // Locate template.json (root or subfolder)
    let templateEntry = zip.file('template.json');
    let basePath = '';
    if (!templateEntry) {
      const matched = zip.file(/template\.json$/i);
      if (matched && matched.length > 0) {
        templateEntry = matched[0];
        const slashIdx = templateEntry.name.lastIndexOf('/');
        if (slashIdx !== -1) {
          basePath = templateEntry.name.substring(0, slashIdx + 1);
        }
      }
    }
    if (!templateEntry && typeof zip.forEach === 'function') {
      zip.forEach((relPath, entry) => {
        if (!templateEntry && relPath.toLowerCase().endsWith('template.json')) {
          templateEntry = entry;
          const slashIdx = entry.name.lastIndexOf('/');
          if (slashIdx !== -1) {
            basePath = entry.name.substring(0, slashIdx + 1);
          }
        }
      });
    }

    if (!templateEntry) {
      showToast('Invalid template: template.json not found in archive');
      return;
    }

    const jsonText = await templateEntry.async('text');
    const templateData = JSON.parse(jsonText);

    if (templateData.app !== 'digital-signage-generator') {
      showToast('Invalid Signage template archive: unknown app signature');
      return;
    }

    // Compare versions & evaluate breaking changes
    const templateVer = templateData.dSignVersion || templateData.version || '1.0.0';
    const templateMajor = parseInt(String(templateVer).replace(/^v/i, '').split('.')[0], 10) || 1;
    const appMajor = parseInt(APP_VERSION.split('.')[0], 10) || 2;
    if (templateMajor > appMajor) {
      showToast(`Warning: Template is from major version v${templateVer} (current is v${APP_VERSION}). Features may be incompatible.`, 5000);
    } else if (compareVersions(templateVer, APP_VERSION) > 0) {
      showToast(`Notice: Template was created with newer D-Sign v${templateVer}`, 3500);
    }

    pushHistorySnapshot();

    // Restore custom fonts from zip
    state.customFonts = [];
    if (templateData.customFonts && Array.isArray(templateData.customFonts)) {
      for (const fontInfo of templateData.customFonts) {
        try {
          const fontRelPath = fontInfo.path || ('fonts/' + fontInfo.fileName);
          let fontFile = zip.file(basePath + fontRelPath);
          if (!fontFile && fontInfo.fileName) {
            const safeName = fontInfo.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fontMatches = zip.file(new RegExp(safeName + '$', 'i'));
            if (fontMatches && fontMatches.length > 0) {
              fontFile = fontMatches[0];
            }
          }

          let fontBuffer = null;
          if (fontFile) {
            fontBuffer = await fontFile.async('arraybuffer');
          } else if (fontInfo.base64) {
            fontBuffer = base64ToArrayBuffer(fontInfo.base64);
          }

          if (fontBuffer) {
            const base64 = fontInfo.base64 || arrayBufferToBase64(fontBuffer);
            const fontName = fontInfo.name || ('Custom_' + (fontInfo.fileName || 'font').replace(/[^a-zA-Z0-9]/g, '_'));
            const fontFace = new FontFace(fontName, fontBuffer);
            const loadedFace = await fontFace.load();
            document.fonts.add(loadedFace);

            if (el.textFont) {
              const exists = Array.from(el.textFont.options).some(o => o.value === fontName);
              if (!exists) {
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = `Custom: ${(fontInfo.fileName || fontName).replace(/\.[^/.]+$/, '')}`;
                el.textFont.appendChild(option);
              }
            }

            state.customFonts.push({
              name: fontName,
              fileName: fontInfo.fileName || (fontName + '.ttf'),
              base64: base64,
              buffer: fontBuffer
            });
          }
        } catch (fontErr) {
          console.warn('Failed restoring font from archive:', fontInfo, fontErr);
        }
      }
    }

    // Restore background image
    let imageRestored = false;
    const targetImgPath = templateData.bgImagePath || (templateData.bgImageName ? ('images/' + templateData.bgImageName) : null);

    let imgEntry = null;
    if (targetImgPath) {
      imgEntry = zip.file(basePath + targetImgPath);
    }
    if (!imgEntry && templateData.bgImageName) {
      const safeImgName = templateData.bgImageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = zip.file(new RegExp(safeImgName + '$', 'i'));
      if (matches && matches.length > 0) {
        imgEntry = matches[0];
      }
    }
    if (!imgEntry) {
      const imgMatches = zip.file(/(^|\/)images\/[^/]+$/i);
      if (imgMatches && imgMatches.length > 0) {
        imgEntry = imgMatches[0];
      }
    }

    if (imgEntry) {
      try {
        const imgBlob = await imgEntry.async('blob');
        state.bgImageBlob = imgBlob;
        state.bgImageName = templateData.bgImageName || imgEntry.name.split('/').pop();

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(imgBlob);
        });
        state.bgImageDataUrl = dataUrl;

        const objectUrl = URL.createObjectURL(imgBlob);
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            state.bgImage = img;
            if (el.previewBgImage) {
              el.previewBgImage.src = objectUrl;
              el.previewBgImage.classList.add('loaded');
            }
            if (el.bgAdjustmentsPanel) {
              el.bgAdjustmentsPanel.classList.remove('hidden');
            }
            if (el.bgImageName) {
              el.bgImageName.textContent = state.bgImageName;
            }
            if (el.bgStatusTag) {
              el.bgStatusTag.textContent = 'LOADED';
              el.bgStatusTag.className = 'tag tag-accent';
            }
            resolve();
          };
          img.onerror = (e) => {
            URL.revokeObjectURL(objectUrl);
            reject(e);
          };
          img.src = objectUrl;
        });

        imageRestored = true;
      } catch (imgLoadErr) {
        console.warn('Failed restoring background image from archive:', imgLoadErr);
      }
    }

    if (!imageRestored) {
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
      if (el.bgImageInput) {
        el.bgImageInput.value = '';
      }
      if (el.bgImageName) {
        el.bgImageName.textContent = 'No file selected';
      }
      if (el.bgStatusTag) {
        el.bgStatusTag.textContent = 'EMPTY';
        el.bgStatusTag.className = 'tag tag-neutral';
      }
    }

    // Restore canvas, preset, size, tint, grayscale, layers, activeLayerId
    state.preset = templateData.preset || 'landscape';
    state.width = templateData.width || 1920;
    state.height = templateData.height || 1080;

    state.bgSizeMode = templateData.bgSizeMode || 'cover';
    state.bgZoom = templateData.bgZoom !== undefined ? templateData.bgZoom : 1.0;
    state.bgOffsetX = templateData.bgOffsetX !== undefined ? templateData.bgOffsetX : 0;
    state.bgOffsetY = templateData.bgOffsetY !== undefined ? templateData.bgOffsetY : 0;
    state.bgGrayscale = !!templateData.bgGrayscale;

    state.canvasBgColor = templateData.canvasBgColor || '#0b0f19';
    state.canvasTransparent = templateData.canvasTransparent !== undefined ? !!templateData.canvasTransparent : false;
    state.enableTint = templateData.enableTint !== undefined ? templateData.enableTint : false;
    state.tintColor = templateData.tintColor || '#000000';
    state.tintOpacity = templateData.tintOpacity !== undefined ? templateData.tintOpacity : 40;

    if (templateData.guides) {
      state.guides = {
        horizontal: templateData.guides.horizontal || [],
        vertical: templateData.guides.vertical || []
      };
    }

    if (templateData.designs && Array.isArray(templateData.designs) && templateData.designs.length > 0) {
      state.designs = templateData.designs;
      state.activeDesignId = templateData.activeDesignId || state.designs[0].id;
    }

    const rawLayers = (templateData.layers && templateData.layers.length > 0 ? templateData.layers : [
      {
        id: 'layer_1',
        type: 'text',
        name: 'Main Headline',
        x: 50.0,
        y: 45.0,
        rotation: 0,
        opacity: 100,
        visible: true,
        textContent: 'D-SIGN DIGITAL SIGNAGE',
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
    ]);

    const restoredLayers = [];
    for (const layer of rawLayers) {
      const norm = normalizeLayer({ ...layer });
      if (norm.type === 'image') {
        let imgEntry = null;

        // Direct check with basePath
        if (norm.imagePath) {
          imgEntry = zip.file(basePath + norm.imagePath) || zip.file(norm.imagePath);
        }

        // Search images/layers/ matching layer id
        if (!imgEntry && norm.id) {
          const idRegex = new RegExp(`(^|/)images/layers/${norm.id}[_.-]`, 'i');
          const matches = zip.file(idRegex);
          if (matches && matches.length > 0) {
            imgEntry = matches[0];
          }
        }

        // Search images/layers/ matching layer name
        if (!imgEntry && norm.name) {
          const safeName = norm.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const nameRegex = new RegExp(`(^|/)images/layers/.*${safeName}$`, 'i');
          const matches = zip.file(nameRegex);
          if (matches && matches.length > 0) {
            imgEntry = matches[0];
          }
        }

        // Search fallback by file name in imagePath
        if (!imgEntry && norm.imagePath) {
          const baseFileName = norm.imagePath.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const fileRegex = new RegExp(`(^|/)images/layers/.*${baseFileName}$`, 'i');
          const matches = zip.file(fileRegex);
          if (matches && matches.length > 0) {
            imgEntry = matches[0];
          }
        }

        // Fallback: search images/layers/ via zip.forEach
        if (!imgEntry && typeof zip.forEach === 'function') {
          const targetId = norm.id ? String(norm.id).toLowerCase() : null;
          const targetName = norm.name ? String(norm.name).toLowerCase() : null;
          zip.forEach((relPath, entry) => {
            if (imgEntry) return;
            const lower = relPath.toLowerCase();
            if (lower.includes('images/layers/')) {
              if (targetId && lower.includes(targetId)) {
                imgEntry = entry;
              } else if (targetName && lower.endsWith(targetName)) {
                imgEntry = entry;
              }
            }
          });
        }

        if (imgEntry) {
          try {
            const imgBlob = await imgEntry.async('blob');
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(imgBlob);
            });
            norm.blob = imgBlob;
            norm.dataUrl = dataUrl;
          } catch (blobErr) {
            console.warn('Failed extracting image layer from ZIP:', blobErr);
          }
        }

        // Reconstruct HTMLImageElement
        if (norm.dataUrl) {
          let img = imageElementCache.get(norm.dataUrl);
          if (!img) {
            img = new Image();
            await new Promise((resolve) => {
              img.onload = () => resolve(img);
              img.onerror = () => resolve(img);
              img.src = norm.dataUrl;
            });
            imageElementCache.set(norm.dataUrl, img);
          } else if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = () => resolve(img);
              img.onerror = () => resolve(img);
            });
          }
          norm.image = img;
          if (norm.image && norm.image.naturalWidth) {
            if (!norm.origWidth) norm.origWidth = norm.image.naturalWidth;
            if (!norm.origHeight) norm.origHeight = norm.image.naturalHeight;
          }
        }
      }
      restoredLayers.push(norm);
    }

    state.layers = restoredLayers;
    state.activeLayerId = (state.layers.find(l => l.id === templateData.activeLayerId) || state.layers[0] || {}).id || null;

    if (el.customW && el.customH) {
      el.customW.value = state.width;
      el.customH.value = state.height;
    }

    // Sync UI controls and canvas
    syncAllUIControls();
    updateCanvasDimensions();
    fitPreviewToScreen();
    updatePreview();
    showToast('Template archive loaded successfully');
    return templateData;
  } catch (err) {
    console.error('Error loading template ZIP:', err);
    showToast('Failed to load template archive: ' + err.message);
  }
}

export async function exportPNG() {
  showToast(`Rendering ${state.width} × ${state.height} PNG...`, 2000);

  const canvas = document.createElement('canvas');
  canvas.width = state.width;
  canvas.height = state.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    // Pre-decode pending background and layer images
    const preloads = [];
    if (state.bgImage) {
      if (state.bgImage.decode) {
        preloads.push(state.bgImage.decode().catch(() => {}));
      } else if (!state.bgImage.complete) {
        preloads.push(new Promise(resolve => {
          state.bgImage.onload = resolve;
          state.bgImage.onerror = resolve;
        }));
      }
    }

    for (const layer of state.layers) {
      if (layer.type === 'image') {
        let img = layer.image || (layer.dataUrl ? imageElementCache.get(layer.dataUrl) : null);
        if (!img && layer.dataUrl) {
          img = new Image();
          img.src = layer.dataUrl;
          imageElementCache.set(layer.dataUrl, img);
        }
        if (img) {
          layer.image = img;
          if (img.decode) {
            preloads.push(img.decode().catch(() => {}));
          } else if (!img.complete) {
            preloads.push(new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            }));
          }
        }
      }
    }

    if (preloads.length > 0) {
      await Promise.all(preloads);
    }

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Base solid or transparent color
    if (!state.canvasTransparent) {
      ctx.fillStyle = state.canvasBgColor;
      ctx.fillRect(0, 0, state.width, state.height);
    } else {
      ctx.clearRect(0, 0, state.width, state.height);
    }

    // Background image rendering
    if (state.bgImage && (state.bgImage.complete || state.bgImage.naturalWidth)) {
      const containerRatio = state.width / state.height;
      const imgRatio = state.bgImage.width / state.bgImage.height;
      let baseW = state.width;
      let baseH = state.height;

      if (state.bgSizeMode === 'cover') {
        if (imgRatio > containerRatio) {
          baseH = state.height;
          baseW = state.height * imgRatio;
        } else {
          baseW = state.width;
          baseH = state.width / imgRatio;
        }
      } else {
        if (imgRatio > containerRatio) {
          baseW = state.width;
          baseH = state.width / imgRatio;
        } else {
          baseH = state.height;
          baseW = state.height * imgRatio;
        }
      }

      ctx.save();
      if (state.bgGrayscale) {
        ctx.filter = 'grayscale(1) contrast(1.08)';
      }
      ctx.translate(state.width / 2, state.height / 2);
      const tx = (state.bgOffsetX / 100) * state.width;
      const ty = (state.bgOffsetY / 100) * state.height;
      ctx.translate(tx, ty);
      ctx.scale(state.bgZoom, state.bgZoom);
      ctx.drawImage(state.bgImage, -baseW / 2, -baseH / 2, baseW, baseH);
      ctx.restore();
    }

    // Tint overlay
    if (state.enableTint && state.tintOpacity > 0) {
      ctx.save();
      ctx.fillStyle = hexToRgba(state.tintColor, state.tintOpacity / 100);
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
    }

    // Iterate through state.layers in array order
    for (const layer of state.layers) {
      normalizeLayer(layer);
      if (layer.visible === false) continue;

      if (layer.type === 'image') {
        let img = layer.image || (layer.dataUrl ? imageElementCache.get(layer.dataUrl) : null);
        if (!img && layer.dataUrl) {
          img = new Image();
          img.src = layer.dataUrl;
          imageElementCache.set(layer.dataUrl, img);
          layer.image = img;
        }
        if (img && !img.complete && !img.naturalWidth) {
          if (img.decode) {
            await img.decode().catch(() => {});
          } else {
            await new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }
        }

        if (img && (img.complete || img.naturalWidth)) {
          ctx.save();
          ctx.globalAlpha = ((layer.opacity !== undefined ? layer.opacity : 100) / 100);

          const posX = ((layer.x !== undefined ? layer.x : layer.textX) / 100) * state.width;
          const posY = ((layer.y !== undefined ? layer.y : layer.textY) / 100) * state.height;
          const drawW = layer.width !== undefined ? layer.width : ((layer.origWidth || 400) * (layer.scale !== undefined ? layer.scale : 1.0));
          const drawH = layer.height !== undefined ? layer.height : ((layer.origHeight || 400) * (layer.scale !== undefined ? layer.scale : 1.0));

          // 2D transformation matrix
          ctx.translate(posX, posY);
          if (layer.rotation) {
            ctx.rotate((layer.rotation * Math.PI) / 180);
          }

          // Grayscale filter
          if (layer.grayscale) {
            ctx.filter = 'grayscale(1) contrast(1.08)';
          }

          // Native Canvas 2D silhouette drop shadow
          if (layer.enableShadow) {
            ctx.shadowColor = layer.shadowColor || '#000000';
            ctx.shadowBlur = layer.shadowBlur !== undefined ? layer.shadowBlur : 15;
            ctx.shadowOffsetX = layer.shadowX !== undefined ? layer.shadowX : 3;
            ctx.shadowOffsetY = layer.shadowY !== undefined ? layer.shadowY : 3;
          }

          // Draw image centered at origin
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }
        continue;
      }

      // Text layer rendering
      ctx.save();
      ctx.globalAlpha = ((layer.opacity !== undefined ? layer.opacity : 100) / 100);

      const fontSize = layer.textFontSize;
      ctx.font = `${layer.textWeight} ${fontSize}px "${layer.textFontFamily}", "Archivo", sans-serif`;
      ctx.textAlign = layer.textAlign;
      ctx.textBaseline = 'top';

      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = layer.textLetterSpacing + 'px';
      }

      const maxBoxWidth = 0.85 * state.width;
      const lines = getCanvasWrappedLines(ctx, layer.textContent, maxBoxWidth);
      const lineGap = layer.textLineHeight * fontSize;
      const totalTextHeight = (lines.length - 1) * lineGap + fontSize;

      let maxLineWidth = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > maxLineWidth) maxLineWidth = w;
      }

      const tx = ((layer.x !== undefined ? layer.x : layer.textX) / 100) * state.width;
      const ty = ((layer.y !== undefined ? layer.y : layer.textY) / 100) * state.height;

      if (layer.rotation) {
        ctx.translate(tx, ty);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.translate(-tx, -ty);
      }

      const pad = layer.enableBgBlock ? layer.bgBlockPadding : 0;

      const W_box = maxLineWidth + 2 * pad;
      const H_box = totalTextHeight + 2 * pad;

      let X_box = tx - W_box / 2;
      if (layer.textAlign === 'left') X_box = tx - pad;
      else if (layer.textAlign === 'right') X_box = tx - W_box + pad;
      const Y_box = ty - H_box / 2;

      // Backing Plate Box
      if (layer.enableBgBlock) {
        ctx.fillStyle = hexToRgba(layer.bgBlockColor, layer.bgBlockOpacity / 100);
        ctx.fillRect(X_box, Y_box, W_box, H_box);
      }

      // Shadows
      if (layer.enableShadow) {
        ctx.shadowColor = layer.shadowColor || '#000000';
        ctx.shadowBlur = layer.shadowBlur !== undefined ? layer.shadowBlur : 15;
        ctx.shadowOffsetX = layer.shadowX !== undefined ? layer.shadowX : 3;
        ctx.shadowOffsetY = layer.shadowY !== undefined ? layer.shadowY : 3;
      }

      // Draw Lines
      ctx.fillStyle = layer.textColor;
      const startY = ty - totalTextHeight / 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], tx, startY + (i * lineGap));
      }

      ctx.restore();
    }

    // Generate PNG download link with sanitized filename
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const cleanName = (state.bgImageName ? state.bgImageName.replace(/\.[^/.]+$/, "") : 'graphic')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');

    link.download = `D-Sign-${state.preset}-${cleanName}-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    showToast('PNG successfully downloaded');
  } catch (err) {
    console.error('PNG export failed:', err);
    showToast('PNG export failed: ' + err.message);
  }
}

/**
 * Batch export all master designs into a single ZIP archive of high-resolution PNGs
 */
export async function exportBatchDesignsPng() {
  const designs = state.designs && state.designs.length > 0 ? state.designs : [
    {
      id: 'design_1',
      name: 'Master 1',
      width: state.width,
      height: state.height,
      canvasBgColor: state.canvasBgColor,
      canvasTransparent: state.canvasTransparent,
      bgImage: state.bgImage,
      bgImageName: state.bgImageName,
      bgSizeMode: state.bgSizeMode,
      bgZoom: state.bgZoom,
      bgOffsetX: state.bgOffsetX,
      bgOffsetY: state.bgOffsetY,
      bgGrayscale: state.bgGrayscale,
      enableTint: state.enableTint,
      tintColor: state.tintColor,
      tintOpacity: state.tintOpacity,
      layers: state.layers
    }
  ];

  const JSZipLib = (typeof JSZip !== 'undefined' ? JSZip : (typeof window !== 'undefined' ? window.JSZip : null));
  if (!JSZipLib) {
    showToast('ZIP library not available for batch export');
    return;
  }

  showToast(`Rendering ${designs.length} master design(s)...`);
  const zip = new JSZipLib();

  for (let i = 0; i < designs.length; i++) {
    const d = designs[i];
    const canvas = document.createElement('canvas');
    canvas.width = d.width || 1920;
    canvas.height = d.height || 1080;
    const ctx = canvas.getContext('2d');

    // Base color
    if (!d.canvasTransparent) {
      ctx.fillStyle = d.canvasBgColor || '#0b0f19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Background image
    if (d.bgImage && (d.bgImage.complete || d.bgImage.naturalWidth)) {
      const containerRatio = canvas.width / canvas.height;
      const imgRatio = d.bgImage.width / d.bgImage.height;
      let baseW = canvas.width;
      let baseH = canvas.height;
      if ((d.bgSizeMode || 'cover') === 'cover') {
        if (imgRatio > containerRatio) {
          baseH = canvas.height;
          baseW = canvas.height * imgRatio;
        } else {
          baseW = canvas.width;
          baseH = canvas.width / imgRatio;
        }
      } else {
        if (imgRatio > containerRatio) {
          baseW = canvas.width;
          baseH = canvas.width / imgRatio;
        } else {
          baseH = canvas.height;
          baseW = canvas.height * imgRatio;
        }
      }
      ctx.save();
      if (d.bgGrayscale) ctx.filter = 'grayscale(1) contrast(1.08)';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.translate(((d.bgOffsetX || 0) / 100) * canvas.width, ((d.bgOffsetY || 0) / 100) * canvas.height);
      ctx.scale(d.bgZoom || 1.0, d.bgZoom || 1.0);
      ctx.drawImage(d.bgImage, -baseW / 2, -baseH / 2, baseW, baseH);
      ctx.restore();
    }

    // Tint
    if (d.enableTint && d.tintOpacity > 0) {
      ctx.save();
      ctx.fillStyle = hexToRgba(d.tintColor || '#000000', (d.tintOpacity || 40) / 100);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Layers
    for (const layer of (d.layers || [])) {
      normalizeLayer(layer);
      if (layer.visible === false) continue;
      if (layer.type === 'image') {
        let img = layer.image || (layer.dataUrl ? imageElementCache.get(layer.dataUrl) : null);
        if (img && (img.complete || img.naturalWidth)) {
          ctx.save();
          ctx.globalAlpha = ((layer.opacity !== undefined ? layer.opacity : 100) / 100);
          const posX = ((layer.x !== undefined ? layer.x : 50) / 100) * canvas.width;
          const posY = ((layer.y !== undefined ? layer.y : 50) / 100) * canvas.height;
          const drawW = layer.width !== undefined ? layer.width : 400;
          const drawH = layer.height !== undefined ? layer.height : 400;
          ctx.translate(posX, posY);
          if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
          if (layer.grayscale) ctx.filter = 'grayscale(1) contrast(1.08)';
          if (layer.enableShadow) {
            ctx.shadowColor = layer.shadowColor || '#000000';
            ctx.shadowBlur = layer.shadowBlur !== undefined ? layer.shadowBlur : 15;
            ctx.shadowOffsetX = layer.shadowX !== undefined ? layer.shadowX : 3;
            ctx.shadowOffsetY = layer.shadowY !== undefined ? layer.shadowY : 3;
          }
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }
      } else {
        ctx.save();
        ctx.globalAlpha = ((layer.opacity !== undefined ? layer.opacity : 100) / 100);
        const fontSize = layer.textFontSize || 70;
        ctx.font = `${layer.textWeight || '800'} ${fontSize}px "${layer.textFontFamily || 'Archivo'}", "Archivo", sans-serif`;
        ctx.textAlign = layer.textAlign || 'center';
        ctx.textBaseline = 'top';
        const lines = getCanvasWrappedLines(ctx, layer.textContent || '', 0.85 * canvas.width);
        const lineGap = (layer.textLineHeight || 1.2) * fontSize;
        const totalTextHeight = (lines.length - 1) * lineGap + fontSize;
        const tx = ((layer.x !== undefined ? layer.x : 50) / 100) * canvas.width;
        const ty = ((layer.y !== undefined ? layer.y : 50) / 100) * canvas.height;
        if (layer.rotation) {
          ctx.translate(tx, ty);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.translate(-tx, -ty);
        }
        ctx.fillStyle = layer.textColor || '#ffffff';
        const startY = ty - totalTextHeight / 2;
        for (let li = 0; li < lines.length; li++) {
          ctx.fillText(lines[li], tx, startY + (li * lineGap));
        }
        ctx.restore();
      }
    }

    const dataURL = canvas.toDataURL('image/png');
    const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
    const cleanName = (d.name || `master-${i + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    zip.file(`${cleanName}.png`, base64Data, { base64: true });
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.download = `D-Sign-All-Designs-${Date.now()}.zip`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('All master designs exported to ZIP');
}

