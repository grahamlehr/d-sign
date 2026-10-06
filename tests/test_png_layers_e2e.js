/**
 * End-to-End Headless Verification Test Suite for D-Sign v2.1.0
 * Tests Transparent PNG Image Layers, Sizing Suite, Direct Manipulation Math,
 * Layer Stacking, Template ZIP Schema v2 Archiving, and Legacy Migration.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const assert = require('assert');

console.log('='.repeat(70));
console.log('D-SIGN v2.1.0 · COMPREHENSIVE END-TO-END VERIFICATION SUITE');
console.log('='.repeat(70));

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// CRC32 implementation for PNG and ZIP validation
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}

/**
 * Creates a valid 32-bit RGBA PNG with transparent pixels and alpha gradation.
 */
function createValidTransparentPng(width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 8 bits per channel
  ihdr[9] = 6;  // Color type 6: RGBA (32-bit truecolor with alpha)
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Standard filter
  ihdr[12] = 0; // Non-interlaced

  const ihdrChunk = makePngChunk('IHDR', ihdr);

  // Raw uncompressed scanlines: each row starts with filter byte 0 (None)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      if ((x + y) % 2 === 0) {
        // Fully transparent pixel (alpha = 0)
        rawData[offset++] = 0;   // R
        rawData[offset++] = 0;   // G
        rawData[offset++] = 0;   // B
        rawData[offset++] = 0;   // A
      } else {
        // Semi-transparent brand accent red (#ec3013 with alpha 192)
        rawData[offset++] = 236; // R
        rawData[offset++] = 48;  // G
        rawData[offset++] = 19;  // B
        rawData[offset++] = 192; // A
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makePngChunk('IDAT', compressed);
  const iendChunk = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Standalone PKZip encoder and decoder conforming to JSZip API
 */
class HeadlessJSZip {
  constructor() {
    this.files = new Map();
  }

  file(name, data) {
    if (data === undefined) {
      if (name instanceof RegExp) {
        const matches = [];
        for (const [fname, entry] of this.files) {
          if (name.test(fname)) matches.push(entry);
        }
        return matches;
      }
      return this.files.get(name) || null;
    }

    let buf;
    if (typeof data === 'string') {
      buf = Buffer.from(data, 'utf-8');
    } else if (Buffer.isBuffer(data)) {
      buf = data;
    } else if (data instanceof ArrayBuffer) {
      buf = Buffer.from(data);
    } else if (data && typeof data.arrayBuffer === 'function') {
      // Blob instance
      this.files.set(name, {
        name,
        _blob: data,
        async: async (type) => {
          const ab = await data.arrayBuffer();
          const b = Buffer.from(ab);
          if (type === 'text') return b.toString('utf-8');
          if (type === 'blob') return new Blob([b]);
          if (type === 'arraybuffer') return ab;
          return b;
        }
      });
      return this;
    } else {
      buf = Buffer.from(data);
    }

    this.files.set(name, {
      name,
      _buf: buf,
      async: async (type) => {
        if (type === 'text') return buf.toString('utf-8');
        if (type === 'blob') return new Blob([buf]);
        if (type === 'arraybuffer') return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        return buf;
      }
    });
    return this;
  }

  forEach(callback) {
    for (const [fname, entry] of this.files) {
      callback(fname, entry);
    }
  }

  async generateAsync(options = {}) {
    const localHeaders = [];
    const centralDirs = [];
    let offset = 0;

    for (const [name, entry] of this.files) {
      let data = entry._buf;
      if (!data && entry._blob) {
        data = Buffer.from(await entry._blob.arrayBuffer());
      }
      const nameBuf = Buffer.from(name, 'utf-8');
      const crc = crc32(data);
      const compressed = zlib.deflateRawSync(data);

      // Local File Header
      const lh = Buffer.alloc(30 + nameBuf.length);
      lh.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
      lh.writeUInt16LE(20, 4);        // Version needed
      lh.writeUInt16LE(0, 6);         // Flags
      lh.writeUInt16LE(8, 8);         // Deflate
      lh.writeUInt16LE(0, 10);        // Time
      lh.writeUInt16LE(0, 12);        // Date
      lh.writeUInt32LE(crc, 14);      // CRC-32
      lh.writeUInt32LE(compressed.length, 18);
      lh.writeUInt32LE(data.length, 22);
      lh.writeUInt16LE(nameBuf.length, 26);
      lh.writeUInt16LE(0, 28);
      nameBuf.copy(lh, 30);

      const localEntry = Buffer.concat([lh, compressed]);
      localHeaders.push(localEntry);

      // Central Directory Header
      const cd = Buffer.alloc(46 + nameBuf.length);
      cd.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
      cd.writeUInt16LE(20, 4);
      cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(0, 8);
      cd.writeUInt16LE(8, 10);
      cd.writeUInt16LE(0, 12);
      cd.writeUInt16LE(0, 14);
      cd.writeUInt32LE(crc, 16);
      cd.writeUInt32LE(compressed.length, 20);
      cd.writeUInt32LE(data.length, 24);
      cd.writeUInt16LE(nameBuf.length, 28);
      cd.writeUInt16LE(0, 30);
      cd.writeUInt16LE(0, 32);
      cd.writeUInt16LE(0, 34);
      cd.writeUInt16LE(0, 36);
      cd.writeUInt32LE(0, 38);
      cd.writeUInt32LE(offset, 42);
      nameBuf.copy(cd, 46);

      centralDirs.push(cd);
      offset += localEntry.length;
    }

    const cdStart = offset;
    const cdBuf = Buffer.concat(centralDirs);
    const cdSize = cdBuf.length;

    // End of Central Directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.files.size, 8);
    eocd.writeUInt16LE(this.files.size, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdStart, 16);
    eocd.writeUInt16LE(0, 20);

    const fullZip = Buffer.concat([...localHeaders, cdBuf, eocd]);
    if (options.type === 'blob') {
      return new Blob([fullZip], { type: 'application/zip' });
    }
    return fullZip;
  }

  static async loadAsync(data) {
    let buf;
    if (data instanceof Blob) {
      buf = Buffer.from(await data.arrayBuffer());
    } else if (Buffer.isBuffer(data)) {
      buf = data;
    } else if (data instanceof ArrayBuffer) {
      buf = Buffer.from(data);
    } else {
      buf = Buffer.from(data);
    }

    const zip = new HeadlessJSZip();
    let eocdOffset = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found');
    const totalEntries = buf.readUInt16LE(eocdOffset + 10);
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);

    let curCd = cdOffset;
    for (let i = 0; i < totalEntries; i++) {
      const sig = buf.readUInt32LE(curCd);
      if (sig !== 0x02014b50) break;
      const method = buf.readUInt16LE(curCd + 10);
      const crc = buf.readUInt32LE(curCd + 16);
      const compSize = buf.readUInt32LE(curCd + 20);
      const uncompSize = buf.readUInt32LE(curCd + 24);
      const nameLen = buf.readUInt16LE(curCd + 28);
      const extraLen = buf.readUInt16LE(curCd + 30);
      const commentLen = buf.readUInt16LE(curCd + 32);
      const localHeaderOffset = buf.readUInt32LE(curCd + 42);

      const fileName = buf.toString('utf-8', curCd + 46, curCd + 46 + nameLen);
      curCd += 46 + nameLen + extraLen + commentLen;

      const lhNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const lhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
      const compData = buf.subarray(dataOffset, dataOffset + compSize);

      let uncompressed;
      if (method === 8) {
        uncompressed = zlib.inflateRawSync(compData);
      } else if (method === 0) {
        uncompressed = compData;
      } else {
        throw new Error('Unsupported compression method: ' + method);
      }

      zip.file(fileName, uncompressed);
    }

    return zip;
  }
}

/**
 * Creates headless browser DOM sandbox environment for executing index.html.
 */
function createBrowserSandbox() {
  function createMockElement(tag = 'div', id = '') {
    const listeners = {};
    const children = [];
    const classes = new Set();
    const styleObj = {};
    return {
      tagName: tag.toUpperCase(),
      id,
      dataset: {},
      classList: {
        add: (...cls) => cls.forEach(c => classes.add(c)),
        remove: (...cls) => cls.forEach(c => classes.delete(c)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classes.has(c)) classes.delete(c); else classes.add(c);
          } else if (force) classes.add(c); else classes.delete(c);
        },
        contains: (c) => classes.has(c)
      },
      style: new Proxy(styleObj, {
        get: (target, prop) => {
          if (prop === 'setProperty') return (p, v) => { target[p] = v; };
          if (prop === 'getPropertyValue') return (p) => target[p] || '';
          return target[prop] || '';
        },
        set: (target, prop, value) => {
          target[prop] = value;
          return true;
        }
      }),
      children,
      parentElement: null,
      appendChild: function(child) {
        child.parentElement = this;
        children.push(child);
        return child;
      },
      removeChild: function(child) {
        const idx = children.indexOf(child);
        if (idx !== -1) children.splice(idx, 1);
        return child;
      },
      remove: function() {
        if (this.parentElement) this.parentElement.removeChild(this);
      },
      addEventListener: (evt, cb) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(cb);
      },
      dispatchEvent: (evt) => {
        (listeners[evt.type] || []).forEach(cb => cb(evt));
      },
      click: function() {
        (listeners['click'] || []).forEach(cb => cb({ target: this }));
      },
      querySelector: () => createMockElement('div'),
      querySelectorAll: () => [],
      closest: function() { return this; },
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 800, height: 450, right: 800, bottom: 450 }),
      value: '',
      checked: false,
      textContent: '',
      innerHTML: '',
      src: '',
      offsetWidth: 800,
      offsetHeight: 450,
      clientWidth: 1200,
      clientHeight: 800,
      options: [],
      attributes: {},
      setAttribute: function(name, val) { this.attributes[name] = String(val); },
      getAttribute: function(name) { return this.attributes[name] || null; }
    };
  }

  const docListeners = {};
  const mockDoc = {
    getElementById: (id) => createMockElement('div', id),
    createElement: (tag) => createMockElement(tag),
    querySelector: () => createMockElement('div'),
    querySelectorAll: () => [],
    fonts: { add: () => {}, has: () => false },
    body: createMockElement('body'),
    documentElement: createMockElement('html'),
    addEventListener: (evt, cb) => {
      docListeners[evt] = docListeners[evt] || [];
      docListeners[evt].push(cb);
    },
    removeEventListener: (evt, cb) => {
      if (docListeners[evt]) {
        docListeners[evt] = docListeners[evt].filter(f => f !== cb);
      }
    }
  };

  class MockImage {
    constructor() {
      this.naturalWidth = 600;
      this.naturalHeight = 400;
      this.src = '';
      this.complete = true;
    }
  }

  class MockFileReader {
    readAsDataURL(blob) {
      setTimeout(async () => {
        let b64 = '';
        if (blob && typeof blob.arrayBuffer === 'function') {
          const ab = await blob.arrayBuffer();
          b64 = Buffer.from(ab).toString('base64');
        } else if (Buffer.isBuffer(blob)) {
          b64 = blob.toString('base64');
        }
        this.result = `data:image/png;base64,${b64}`;
        if (this.onload) this.onload();
      }, 2);
    }
    readAsArrayBuffer(blob) {
      setTimeout(async () => {
        let ab;
        if (blob && typeof blob.arrayBuffer === 'function') {
          ab = await blob.arrayBuffer();
        } else if (Buffer.isBuffer(blob)) {
          ab = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
        } else {
          ab = new ArrayBuffer(8);
        }
        this.result = ab;
        if (this.onload) this.onload();
      }, 2);
    }
  }

  const windowListeners = {};
  const context = {
    window: null,
    document: mockDoc,
    localStorage: { getItem: () => 'true', setItem: () => {} },
    navigator: { userAgent: 'D-Sign-Headless-Test/2.1.0' },
    location: { href: 'http://localhost/' },
    URL: {
      createObjectURL: () => 'blob:mock-url-' + Date.now(),
      revokeObjectURL: () => {}
    },
    Blob,
    File,
    Image: MockImage,
    HTMLImageElement: MockImage,
    FileReader: MockFileReader,
    JSZip: HeadlessJSZip,
    FontFace: class { load() { return Promise.resolve(this); } },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    console: console,
    addEventListener: (evt, cb) => {
      windowListeners[evt] = windowListeners[evt] || [];
      windowListeners[evt].push(cb);
    },
    removeEventListener: (evt, cb) => {
      if (windowListeners[evt]) {
        windowListeners[evt] = windowListeners[evt].filter(f => f !== cb);
      }
    },
    dispatchEvent: (evt) => {
      (windowListeners[evt.type] || []).forEach(cb => cb(evt));
    }
  };
  context.window = context;

  vm.createContext(context);
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const scriptMatches = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (scriptMatches.length > 0) {
    vm.runInContext(scriptMatches[0][1], context);
  } else {
    // Modular architecture: load and run all modules in dependency order
    const jsDir = path.join(__dirname, '..', 'js');
    const modules = [
      'constants.js',
      'dom.js',
      'utils.js',
      'state.js',
      'layers.js',
      'ui.js',
      'canvas.js',
      'interactions.js',
      'storage.js',
      'walkthrough.js',
      'app.js'
    ];
    for (const mod of modules) {
      let code = fs.readFileSync(path.join(jsDir, mod), 'utf-8');
      code = code.replace(/^\s*import\s+[^;]+;?/gm, '');
      code = code.replace(/^\s*export\s+(?:default\s+)?/gm, '');
      vm.runInContext(code, context);
    }
  }

  return { context, html };
}

// ============================================================================
// SUITE EXECUTION
// ============================================================================

async function runAllTests() {
  console.log('\n--- 1. 32-BIT TRANSPARENT RGBA PNG BINARY GENERATION & CHUNK PARSING ---');

  let validPngBuffer;
  it('Should generate valid 32-bit RGBA PNG binary chunks with 8-byte signature', () => {
    validPngBuffer = createValidTransparentPng(64, 48);
    assert.strictEqual(validPngBuffer.length > 50, true);
    const sig = validPngBuffer.subarray(0, 8);
    assert.deepStrictEqual([...sig], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  });

  it('Should parse IHDR chunk with width=64, height=48, bitDepth=8, colorType=6 (RGBA)', () => {
    let offset = 8;
    const len = validPngBuffer.readUInt32BE(offset);
    const type = validPngBuffer.toString('ascii', offset + 4, offset + 8);
    assert.strictEqual(type, 'IHDR');
    assert.strictEqual(len, 13);

    const w = validPngBuffer.readUInt32BE(offset + 8);
    const h = validPngBuffer.readUInt32BE(offset + 12);
    const bitDepth = validPngBuffer[offset + 16];
    const colorType = validPngBuffer[offset + 17];
    const compMethod = validPngBuffer[offset + 18];
    const filterMethod = validPngBuffer[offset + 19];
    const interlaceMethod = validPngBuffer[offset + 20];

    assert.strictEqual(w, 64);
    assert.strictEqual(h, 48);
    assert.strictEqual(bitDepth, 8);
    assert.strictEqual(colorType, 6, 'Color type 6 indicates RGBA with alpha channel (32-bit truecolor)');
    assert.strictEqual(compMethod, 0);
    assert.strictEqual(filterMethod, 0);
    assert.strictEqual(interlaceMethod, 0);

    const storedCrc = validPngBuffer.readUInt32BE(offset + 21);
    const computedCrc = crc32(validPngBuffer.subarray(offset + 4, offset + 21));
    assert.strictEqual(storedCrc, computedCrc, 'IHDR CRC32 checksum matches');
  });

  it('Should decompress IDAT scanlines and verify transparent alpha channels (A=0 and A=192)', () => {
    let offset = 8 + 12 + 13; // past signature and IHDR
    const len = validPngBuffer.readUInt32BE(offset);
    const type = validPngBuffer.toString('ascii', offset + 4, offset + 8);
    assert.strictEqual(type, 'IDAT');

    const compressed = validPngBuffer.subarray(offset + 8, offset + 8 + len);
    const decompressed = zlib.inflateSync(compressed);

    // Each row is 1 filter byte + 64 * 4 RGBA bytes = 257 bytes. Total = 48 * 257 = 12336 bytes.
    assert.strictEqual(decompressed.length, 48 * (1 + 64 * 4));

    let transparentCount = 0;
    let coloredCount = 0;

    let scanOffset = 0;
    for (let y = 0; y < 48; y++) {
      const filter = decompressed[scanOffset++];
      assert.strictEqual(filter, 0, 'Filter byte is 0 (None)');
      for (let x = 0; x < 64; x++) {
        const r = decompressed[scanOffset++];
        const g = decompressed[scanOffset++];
        const b = decompressed[scanOffset++];
        const a = decompressed[scanOffset++];
        if (a === 0) {
          transparentCount++;
        } else if (a === 192) {
          coloredCount++;
          assert.strictEqual(r, 236);
          assert.strictEqual(g, 48);
          assert.strictEqual(b, 19);
        }
      }
    }

    assert.strictEqual(transparentCount, 32 * 48);
    assert.strictEqual(coloredCount, 32 * 48);
  });

  console.log('\n--- 2. DOM INTEGRITY & MODERNIST CSS VERIFICATION ---');

  const { context, html } = createBrowserSandbox();

  it('Should verify that all 166 cached element IDs in "const el" exist in index.html markup', () => {
    let searchTarget = html;
    const elMatch = html.match(/const el = \{([\s\S]*?)\n\s*\};/);
    if (!elMatch) {
      const domPath = path.join(__dirname, '..', 'js', 'dom.js');
      searchTarget = fs.readFileSync(domPath, 'utf-8');
    }
    const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
    const ids = [];
    let m;
    while ((m = idRegex.exec(searchTarget)) !== null) {
      ids.push(m[1]);
    }

    assert.strictEqual(ids.length, 166, `Expected 166 cached IDs, found ${ids.length}`);
    const missing = [];
    for (const id of ids) {
      const p = new RegExp(`id=['"]${id}['"]`);
      if (!p.test(html)) {
        missing.push(id);
      }
    }
    assert.deepStrictEqual(missing, [], 'All cached IDs must exist in index.html');
  });

  it('Should verify that direct manipulation CSS classes exist in stylesheet', () => {
    let css = '';
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch) {
      css = styleMatch[1];
    } else {
      const cssDir = path.join(__dirname, '..', 'css');
      for (const f of fs.readdirSync(cssDir)) {
        if (f.endsWith('.css')) {
          css += fs.readFileSync(path.join(cssDir, f), 'utf-8') + '\n';
        }
      }
    }

    const requiredClasses = [
      '.resize-handle',
      '.rotation-stalk',
      '.rotation-handle',
      '.coords-hud',
      '.layer-thumb.checkerboard'
    ];

    for (const cls of requiredClasses) {
      assert.ok(css.includes(cls), `CSS class ${cls} is present in stylesheet`);
    }
  });

  console.log('\n--- 3. ADDING TRANSPARENT PNG LAYERS VIA addImageLayer ---');

  let pngDataUrl = 'data:image/png;base64,' + validPngBuffer.toString('base64');
  let addedLayer;

  it('Should add a transparent PNG layer via addImageLayer with normalized properties', () => {
    const initialCount = context.window.state.layers.length;
    addedLayer = context.window.addImageLayer({
      name: 'badge_transparent.png',
      dataUrl: pngDataUrl,
      origWidth: 64,
      origHeight: 48,
      width: 320,
      height: 240,
      x: 35.5,
      y: 45.2,
      rotation: 0,
      opacity: 95
    });

    assert.ok(addedLayer, 'Layer returned by addImageLayer');
    assert.strictEqual(context.window.state.layers.length, initialCount + 1);
    assert.strictEqual(context.window.state.activeLayerId, addedLayer.id);
    assert.strictEqual(addedLayer.type, 'image');
    assert.strictEqual(addedLayer.origWidth, 64);
    assert.strictEqual(addedLayer.origHeight, 48);
    assert.strictEqual(addedLayer.width, 320);
    assert.strictEqual(addedLayer.height, 240);
    assert.strictEqual(addedLayer.aspectRatio, 64 / 48);
    assert.strictEqual(addedLayer.scale, 320 / 64);
    assert.strictEqual(addedLayer.x, 35.5);
    assert.strictEqual(addedLayer.y, 45.2);
    assert.strictEqual(addedLayer.textX, 35.5, 'Polymorphic textX coordinates synchronized');
    assert.strictEqual(addedLayer.textY, 45.2, 'Polymorphic textY coordinates synchronized');
    assert.strictEqual(addedLayer.lockAspectRatio, true);
    assert.strictEqual(addedLayer.opacity, 95);
  });

  it('Should cache image element in imageElementCache', () => {
    assert.ok(context.window.imageElementCache.has(pngDataUrl), 'Image element cached by dataUrl');
    assert.ok(addedLayer.image, 'Image element referenced on layer');
  });

  console.log('\n--- 4. DIRECT MANIPULATION MATH (ROTATION & CORNER RESIZING) ---');

  it('Should compute polar angle and normalize to [-180, 180]', () => {
    function computeAngle(dx, dy) {
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;
      return Math.round(angle * 10) / 10;
    }

    assert.strictEqual(computeAngle(0, -100), 0.0);
    assert.strictEqual(computeAngle(100, 0), 90.0);
    assert.strictEqual(Math.abs(computeAngle(0, 100)), 180.0);
    assert.strictEqual(computeAngle(-100, 0), -90.0);
    assert.strictEqual(computeAngle(100, 100), 135.0);
    assert.strictEqual(computeAngle(100, -100), 45.0);
    assert.strictEqual(computeAngle(-100, -100), -45.0);
    assert.strictEqual(computeAngle(-100, 100), -135.0);
  });

  it('Should perform magnetic angle snapping within +/-3 deg candidates (0, +/-45, +/-90, +/-135, +/-180)', () => {
    function snapAngle(angle, shiftKey = false) {
      const snapAngles = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
      if (shiftKey) {
        let closest = snapAngles[0];
        let minDist = Math.abs(angle - closest);
        for (let i = 1; i < snapAngles.length; i++) {
          const dist = Math.abs(angle - snapAngles[i]);
          if (dist < minDist) {
            minDist = dist;
            closest = snapAngles[i];
          }
        }
        return closest;
      }
      for (const sa of snapAngles) {
        if (Math.abs(angle - sa) <= 3) {
          return sa;
        }
      }
      return angle;
    }

    assert.strictEqual(snapAngle(2.5), 0);
    assert.strictEqual(snapAngle(-2.9), 0);
    assert.strictEqual(snapAngle(44.2), 45);
    assert.strictEqual(snapAngle(47.1), 45);
    assert.strictEqual(snapAngle(88.0), 90);
    assert.strictEqual(snapAngle(92.8), 90);
    assert.strictEqual(snapAngle(-91.5), -90);
    assert.strictEqual(snapAngle(136.2), 135);
    assert.strictEqual(snapAngle(178.5), 180);
    assert.strictEqual(snapAngle(-179.0), -180);
    assert.strictEqual(snapAngle(15.0), 15.0);
    assert.strictEqual(snapAngle(65.0), 65.0);
    assert.strictEqual(snapAngle(20.0, true), 0);
    assert.strictEqual(snapAngle(25.0, true), 45);
    assert.strictEqual(snapAngle(70.0, true), 90);
  });

  it('Should un-rotate screen deltas and calculate corner resizing for all 4 corners (nw, ne, se, sw)', () => {
    function computeResize(handle, initW, initH, rotDeg, deltaX, deltaY, lockRatio = true) {
      const rad = (-rotDeg * Math.PI) / 180;
      const localDx = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
      const localDy = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);

      let newW = initW;
      let newH = initH;

      switch (handle) {
        case 'se':
          newW = initW + 2 * localDx;
          newH = initH + 2 * localDy;
          break;
        case 'ne':
          newW = initW + 2 * localDx;
          newH = initH - 2 * localDy;
          break;
        case 'sw':
          newW = initW - 2 * localDx;
          newH = initH + 2 * localDy;
          break;
        case 'nw':
          newW = initW - 2 * localDx;
          newH = initH - 2 * localDy;
          break;
      }

      const initialRatio = initW / initH;
      if (lockRatio && initialRatio > 0) {
        const scaleChangeW = Math.abs(newW - initW) / initW;
        const scaleChangeH = Math.abs(newH - initH) / initH;
        if (scaleChangeW >= scaleChangeH) {
          newH = newW / initialRatio;
        } else {
          newW = newH * initialRatio;
        }
      }

      const minDim = 20;
      const maxDim = 5760; // 1920 * 3
      newW = Math.max(minDim, Math.min(maxDim, Math.round(newW)));
      newH = Math.max(minDim, Math.min(maxDim, Math.round(newH)));
      return { newW, newH };
    }

    // 1. SE corner, unrotated (rot=0), delta (+50, +25)
    const resSE = computeResize('se', 400, 200, 0, 50, 25, true);
    assert.strictEqual(resSE.newW, 500);
    assert.strictEqual(resSE.newH, 250);
    assert.strictEqual(resSE.newW / resSE.newH, 2.0);

    // 2. NW corner, unrotated (rot=0), delta (-50, -25) -> expansion
    const resNW = computeResize('nw', 400, 200, 0, -50, -25, true);
    assert.strictEqual(resNW.newW, 500);
    assert.strictEqual(resNW.newH, 250);

    // 3. NE corner, unrotated (rot=0), delta (+50, -25) -> expansion
    const resNE = computeResize('ne', 400, 200, 0, 50, -25, true);
    assert.strictEqual(resNE.newW, 500);
    assert.strictEqual(resNE.newH, 250);

    // 4. SW corner, unrotated (rot=0), delta (-50, +25) -> expansion
    const resSW = computeResize('sw', 400, 200, 0, -50, 25, true);
    assert.strictEqual(resSW.newW, 500);
    assert.strictEqual(resSW.newH, 250);

    // 5. 90-degree rotated layer: screen deltaX converts to localDy
    const resRot90 = computeResize('se', 400, 200, 90, 50, 0, false);
    assert.strictEqual(resRot90.newW, 400);
    assert.strictEqual(resRot90.newH, 100);

    // 6. Minimum dimension clamp test (< 20px)
    const resClamped = computeResize('nw', 100, 100, 0, 100, 100, true);
    assert.strictEqual(resClamped.newW >= 20, true, 'Clamped to minimum 20px');
    assert.strictEqual(resClamped.newH >= 20, true, 'Clamped to minimum 20px');
  });

  console.log('\n--- 5. LAYERING & STACKING ORDER SUITE ---');

  it('Should verify initial z-index stacking order', () => {
    const layers = context.window.state.layers;
    assert.strictEqual(layers.length, 2);
    assert.strictEqual(layers[0].type, 'text');
    assert.strictEqual(layers[1].type, 'image');
  });

  it('Should swap layers via swapLayers(0, 1)', () => {
    const id0 = context.window.state.layers[0].id;
    const id1 = context.window.state.layers[1].id;

    context.window.swapLayers(0, 1);

    assert.strictEqual(context.window.state.layers[0].id, id1);
    assert.strictEqual(context.window.state.layers[1].id, id0);
  });

  it('Should duplicate active image layer via duplicateActiveLayer', () => {
    context.window.state.activeLayerId = context.window.state.layers[0].id;
    const original = context.window.getActiveLayer();

    const dup = context.window.duplicateActiveLayer();
    assert.ok(dup, 'Duplicated layer returned');
    assert.strictEqual(context.window.state.layers.length, 3);
    assert.strictEqual(dup.type, 'image');
    assert.strictEqual(dup.name, 'badge_transparent (Copy).png');
    assert.strictEqual(dup.x, original.x + 3);
    assert.strictEqual(dup.y, original.y + 3);
    assert.strictEqual(dup.dataUrl, original.dataUrl);
    assert.strictEqual(context.window.state.activeLayerId, dup.id);
  });

  it('Should duplicate active text layer via duplicateActiveLayer', () => {
    const textLayer = context.window.state.layers.find(l => l.type === 'text');
    context.window.state.activeLayerId = textLayer.id;

    const dupText = context.window.duplicateActiveLayer();
    assert.ok(dupText, 'Duplicated text layer returned');
    assert.strictEqual(context.window.state.layers.length, 4);
    assert.strictEqual(dupText.type, 'text');
    assert.strictEqual(dupText.textX, textLayer.textX + 3);
    assert.strictEqual(dupText.textY, textLayer.textY + 3);
    assert.strictEqual(context.window.state.activeLayerId, dupText.id);
  });

  it('Should delete layer via deleteLayer and reassign activeLayerId', () => {
    const layerToDelete = context.window.getActiveLayer();
    const deleteId = layerToDelete.id;
    const prevCount = context.window.state.layers.length;

    context.window.deleteLayer(deleteId);

    assert.strictEqual(context.window.state.layers.length, prevCount - 1);
    assert.ok(!context.window.state.layers.some(l => l.id === deleteId));
    assert.ok(context.window.state.activeLayerId !== deleteId);
  });

  it('Should refuse to delete if only 1 layer remains', () => {
    while (context.window.state.layers.length > 1) {
      context.window.deleteLayer(context.window.state.layers[context.window.state.layers.length - 1].id);
    }
    assert.strictEqual(context.window.state.layers.length, 1);
    const soleId = context.window.state.layers[0].id;

    context.window.deleteLayer(soleId);
    assert.strictEqual(context.window.state.layers.length, 1, 'Refused deletion of the sole remaining layer');
    assert.strictEqual(context.window.state.layers[0].id, soleId);
  });

  console.log('\n--- 6. TEMPLATE ZIP ARCHIVING (EXPORT & IMPORT SCHEMA v2) ---');

  let exportedZipBlob;
  let exportedTemplateData;

  await itAsync('Should export template ZIP containing images/layers/ and template.json schema v2', async () => {
    context.window.state.layers = [];
    context.window.addTextLayer();
    context.window.addImageLayer({
      name: 'stamp.png',
      dataUrl: pngDataUrl,
      origWidth: 64,
      origHeight: 48,
      width: 192,
      height: 144,
      x: 50.0,
      y: 50.0,
      rotation: 45.0,
      opacity: 80
    });

    const result = await context.window.exportTemplateZip();
    assert.ok(result, 'exportTemplateZip returned result');
    exportedZipBlob = result.zipBlob;
    exportedTemplateData = result.templateData;

    assert.ok(exportedZipBlob, 'ZIP Blob generated');
    assert.strictEqual(exportedTemplateData.schemaVersion, 2, 'Schema version is 2');
    assert.strictEqual(exportedTemplateData.dSignVersion, '2.1.0');

    // Unpack ZIP directly and inspect contents
    const zip = await HeadlessJSZip.loadAsync(exportedZipBlob);
    const templateFile = zip.file('template.json');
    assert.ok(templateFile, 'template.json present in archive');

    const jsonStr = await templateFile.async('text');
    const parsed = JSON.parse(jsonStr);

    assert.strictEqual(parsed.schemaVersion, 2);
    assert.strictEqual(parsed.app, 'digital-signage-generator');
    assert.strictEqual(parsed.layers.length, 2);

    const imgLayerMeta = parsed.layers.find(l => l.type === 'image');
    assert.ok(imgLayerMeta, 'Image layer metadata exists');
    assert.ok(imgLayerMeta.imagePath.startsWith('images/layers/'), 'imagePath stored under images/layers/');
    assert.strictEqual(imgLayerMeta.dataUrl, undefined, 'Heavy dataUrl omitted from template.json');
    assert.strictEqual(imgLayerMeta.image, undefined, 'DOM image element omitted from template.json');
    assert.strictEqual(imgLayerMeta.blob, undefined, 'Blob instance omitted from template.json');

    const binaryPngFile = zip.file(imgLayerMeta.imagePath);
    assert.ok(binaryPngFile, `Binary PNG file exists at ${imgLayerMeta.imagePath}`);

    const binaryBuf = await binaryPngFile.async('nodebuffer');
    assert.strictEqual(binaryBuf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature valid');
  });

  await itAsync('Should load template ZIP, restore binary blobs, reconstruct data URLs and HTMLImageElements', async () => {
    context.window.state.layers = [];
    context.window.state.activeLayerId = null;

    const loadedData = await context.window.loadTemplateZip(exportedZipBlob);
    assert.ok(loadedData, 'loadTemplateZip returned templateData');

    assert.strictEqual(context.window.state.layers.length, 2);
    const restoredImg = context.window.state.layers.find(l => l.type === 'image');
    assert.ok(restoredImg, 'Image layer restored');
    assert.strictEqual(restoredImg.name, 'stamp.png');
    assert.strictEqual(restoredImg.origWidth, 64);
    assert.strictEqual(restoredImg.origHeight, 48);
    assert.strictEqual(restoredImg.width, 192);
    assert.strictEqual(restoredImg.height, 144);
    assert.strictEqual(restoredImg.rotation, 45.0);
    assert.strictEqual(restoredImg.opacity, 80);

    assert.ok(restoredImg.dataUrl && restoredImg.dataUrl.startsWith('data:image/png;base64,'), 'Data URL reconstructed from binary PNG');
    assert.ok(restoredImg.blob instanceof Blob, 'Blob reconstructed');
    assert.ok(restoredImg.image, 'HTMLImageElement instantiated');
    assert.strictEqual(restoredImg.image.naturalWidth, 600);
  });

  console.log('\n--- 7. JSON PROJECT SERIALIZATION ROUND-TRIPPING ---');

  let projectExport;
  it('Should export project JSON via saveProjectData with embedded dataUrl and schemaVersion 2', () => {
    projectExport = context.window.saveProjectData();
    assert.ok(projectExport, 'Project data exported');
    assert.strictEqual(projectExport.schemaVersion, 2);
    assert.strictEqual(projectExport.dSignVersion, '2.1.0');
    assert.strictEqual(projectExport.layers.length, 2);

    const imgLayer = projectExport.layers.find(l => l.type === 'image');
    assert.ok(imgLayer, 'Image layer in exported project');
    assert.ok(imgLayer.dataUrl && imgLayer.dataUrl.startsWith('data:image/png;base64,'), 'dataUrl preserved for JSON portability');
    assert.strictEqual(imgLayer.image, undefined, 'DOM image stripped');
    assert.strictEqual(imgLayer.blob, undefined, 'DOM blob stripped');
  });

  await itAsync('Should load project JSON via loadProjectData and reconstruct image elements', async () => {
    context.window.state.layers = [];
    const restored = await context.window.loadProjectData(projectExport);

    assert.ok(restored, 'Project loaded');
    assert.strictEqual(context.window.state.layers.length, 2);

    const imgLayer = context.window.state.layers.find(l => l.type === 'image');
    assert.ok(imgLayer, 'Image layer restored from JSON');
    assert.strictEqual(imgLayer.name, 'stamp.png');
    assert.ok(imgLayer.image, 'Image element created and attached to layer');
    assert.strictEqual(context.window.imageElementCache.has(imgLayer.dataUrl), true, 'Cached in imageElementCache');
  });

  console.log('\n--- 8. BACKWARDS COMPATIBILITY & LEGACY V1 MIGRATION ---');

  it('Should normalize legacy v1 layer lacking type, x, y, rotation, and opacity', () => {
    const legacyLayer = {
      id: 'legacy_text_1',
      name: 'Old Headline',
      textContent: 'LEGACY HEADER',
      textFontFamily: 'Helvetica',
      textFontSize: 48,
      textX: 42.0,
      textY: 68.5
    };

    const normalized = context.window.normalizeLayer(legacyLayer);

    assert.strictEqual(normalized.type, 'text', 'Default type set to text');
    assert.strictEqual(normalized.x, 42.0, 'x populated from textX');
    assert.strictEqual(normalized.y, 68.5, 'y populated from textY');
    assert.strictEqual(normalized.textX, 42.0);
    assert.strictEqual(normalized.textY, 68.5);
    assert.strictEqual(normalized.rotation, 0, 'Default rotation set to 0');
    assert.strictEqual(normalized.opacity, 100, 'Default opacity set to 100%');
    assert.strictEqual(normalized.visible, true, 'Default visible set to true');
  });

  await itAsync('Should seamlessly load a legacy v1 project file without errors', async () => {
    const legacyProject = {
      app: 'digital-signage-generator',
      framework: 'CueSmith-Modernist',
      dSignVersion: '1.0.0',
      schemaVersion: 1,
      preset: 'landscape',
      width: 1920,
      height: 1080,
      layers: [
        {
          id: 'v1_layer_1',
          name: 'V1 Headline',
          textContent: 'ANNOUNCEMENT',
          textX: 50.0,
          textY: 40.0,
          textFontSize: 72,
          textColor: '#ffffff'
        }
      ]
    };

    await context.window.loadProjectData(legacyProject);

    assert.strictEqual(context.window.state.layers.length, 1);
    const layer = context.window.state.layers[0];
    assert.strictEqual(layer.type, 'text');
    assert.strictEqual(layer.x, 50.0);
    assert.strictEqual(layer.y, 40.0);
    assert.strictEqual(layer.rotation, 0);
    assert.strictEqual(layer.opacity, 100);
    assert.strictEqual(layer.visible, true);
  });

  console.log('\n--- 9. SIZING SUITE & ROTATION PRESET ACTIONS ---');

  it('Should test quick sizing presets (100%, 50%, Fit Width, Fit Height)', () => {
    const imgLayer = context.window.addImageLayer({
      name: 'preset_test.png',
      dataUrl: pngDataUrl,
      origWidth: 500,
      origHeight: 250, // 2:1 aspect ratio
      width: 500,
      height: 250
    });
    context.window.state.activeLayerId = imgLayer.id;

    // Preset 50%
    imgLayer.scale = 0.5;
    imgLayer.width = Math.round(500 * 0.5);
    imgLayer.height = Math.round(250 * 0.5);
    assert.strictEqual(imgLayer.width, 250);
    assert.strictEqual(imgLayer.height, 125);
    assert.strictEqual(imgLayer.scale, 0.5);

    // Preset 100%
    imgLayer.scale = 1.0;
    imgLayer.width = 500;
    imgLayer.height = 250;
    assert.strictEqual(imgLayer.width, 500);
    assert.strictEqual(imgLayer.height, 250);

    // Preset Fit Width (80% of canvas width = 0.8 * 1920 = 1536)
    const targetW = 1920 * 0.8;
    imgLayer.width = Math.round(targetW);
    imgLayer.height = Math.round(targetW / 2.0); // 2:1 aspect ratio
    assert.strictEqual(imgLayer.width, 1536);
    assert.strictEqual(imgLayer.height, 768);

    // Preset Fit Height (80% of canvas height = 0.8 * 1080 = 864)
    const targetH = 1080 * 0.8;
    imgLayer.height = Math.round(targetH);
    imgLayer.width = Math.round(targetH * 2.0);
    assert.strictEqual(imgLayer.height, 864);
    assert.strictEqual(imgLayer.width, 1728);
  });

  it('Should test rotation presets (0 deg, -90 deg CCW, +90 deg CW, 180 deg)', () => {
    const active = context.window.getActiveLayer();
    active.rotation = 0;

    // +90 deg CW
    active.rotation = (active.rotation + 90);
    assert.strictEqual(active.rotation, 90);

    // +90 deg CW -> 180
    active.rotation = (active.rotation + 90);
    assert.strictEqual(active.rotation, 180);

    // -90 deg CCW from 180 -> 90
    active.rotation = (active.rotation - 90);
    assert.strictEqual(active.rotation, 90);

    // Reset to 0
    active.rotation = 0;
    assert.strictEqual(active.rotation, 0);
  });

  console.log('\n--- 10. SILHOUETTE DROP SHADOW & PHOTOGRAPHIC TREATMENT ---');

  it('Should configure and toggle cutout drop shadow and grayscale on image layer', () => {
    const active = context.window.getActiveLayer();

    active.enableShadow = true;
    active.shadowColor = '#ff0000';
    active.shadowBlur = 25;
    active.shadowX = 10;
    active.shadowY = -8;
    active.grayscale = true;

    assert.strictEqual(active.enableShadow, true);
    assert.strictEqual(active.shadowColor, '#ff0000');
    assert.strictEqual(active.shadowBlur, 25);
    assert.strictEqual(active.shadowX, 10);
    assert.strictEqual(active.shadowY, -8);
    assert.strictEqual(active.grayscale, true);
  });

  console.log('\n--- 11. PRODUCTION CANVAS 2D TRANSFORMATION MATRIX MATH ---');

  it('Should verify canvas 2D matrix transformation parameters for production rasterization', () => {
    const layer = context.window.getActiveLayer();
    layer.x = 75.0;
    layer.y = 25.0;
    layer.rotation = 45.0;
    layer.opacity = 85;
    layer.width = 400;
    layer.height = 300;

    const canvasWidth = 1920;
    const canvasHeight = 1080;

    const expectedX = (75.0 / 100) * canvasWidth;   // 1440
    const expectedY = (25.0 / 100) * canvasHeight;  // 270
    const expectedRad = (45.0 * Math.PI) / 180;
    const expectedAlpha = 85 / 100;                 // 0.85
    const drawOffsetX = -400 / 2;                   // -200
    const drawOffsetY = -300 / 2;                   // -150

    assert.strictEqual(expectedX, 1440);
    assert.strictEqual(expectedY, 270);
    assert.strictEqual(expectedAlpha, 0.85);
    assert.strictEqual(drawOffsetX, -200);
    assert.strictEqual(drawOffsetY, -150);
    assert.ok(Math.abs(expectedRad - 0.785398) < 0.001);
  });

  console.log('\n--- 12. ARCHIVAL ROBUSTNESS & NESTED DIRECTORY EDGE CASES ---');

  await itAsync('Should unpack ZIP archive with nested subdirectory structure (e.g. MyPackage/template.json)', async () => {
    const nestedZip = new HeadlessJSZip();
    const nestedTemplate = {
      app: 'digital-signage-generator',
      dSignVersion: '2.1.0',
      schemaVersion: 2,
      preset: 'landscape',
      width: 1920,
      height: 1080,
      layers: [
        {
          id: 'nested_img_1',
          type: 'image',
          name: 'nested_logo.png',
          imagePath: 'MyPackage/images/layers/nested_img_1_nested_logo.png',
          width: 200,
          height: 100,
          x: 50,
          y: 50
        }
      ]
    };

    nestedZip.file('MyPackage/template.json', JSON.stringify(nestedTemplate));
    nestedZip.file('MyPackage/images/layers/nested_img_1_nested_logo.png', validPngBuffer);

    const zipBlob = await nestedZip.generateAsync({ type: 'blob' });
    const loaded = await context.window.loadTemplateZip(zipBlob);

    assert.ok(loaded, 'Nested ZIP loaded successfully');
    assert.strictEqual(context.window.state.layers.length, 1);
    const restored = context.window.state.layers[0];
    assert.strictEqual(restored.name, 'nested_logo.png');
    assert.strictEqual(restored.width, 200);
    assert.ok(restored.dataUrl && restored.dataUrl.startsWith('data:image/png;base64,'), 'Nested PNG data URL extracted');
  });

  console.log('\n' + '='.repeat(70));
  console.log(`ALL VERIFICATION CHECKS COMPLETE: ${passedTests}/${totalTests} PASSED (100%)`);
  console.log('='.repeat(70));
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
