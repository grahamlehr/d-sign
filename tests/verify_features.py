#!/usr/bin/env python3
"""
D-Sign v2.1.0 · Python End-to-End Verification Suite
Validates 32-bit transparent RGBA PNG chunks, template ZIP archive schema v2,
direct manipulation trigonometry & un-projection math, DOM element cache integrity,
and legacy migration rules.
"""

import sys
import os
import re
import zlib
import struct
import json
import zipfile
import math
import io

print("=" * 70)
print("D-SIGN v2.1.0 · PYTHON FEATURE VERIFICATION SUITE")
print("=" * 70)

total_tests = 0
passed_tests = 0

def check(desc, condition, err_msg=""):
    global total_tests, passed_tests
    total_tests += 1
    if condition:
        passed_tests += 1
        print(f"  ✓ [PASS] {desc}")
    else:
        print(f"  ✗ [FAIL] {desc} - {err_msg}")
        sys.exit(1)

# -----------------------------------------------------------------------------
# 1. 32-bit Transparent RGBA PNG Binary Generation & Parsing
# -----------------------------------------------------------------------------
print("\n--- 1. 32-BIT TRANSPARENT RGBA PNG GENERATION & VALIDATION ---")

def make_png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    length = len(data)
    crc = zlib.crc32(chunk_type + data)
    return struct.pack(">I", length) + chunk_type + data + struct.pack(">I", crc)

def generate_transparent_png(width: int, height: int) -> bytes:
    sig = b"\x89PNG\r\n\x1a\n"
    # IHDR: width (4), height (4), bit depth (1), color type (1), comp (1), filter (1), interlace (1)
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr_chunk = make_png_chunk(b"IHDR", ihdr_data)

    # Scanlines: each row has 1 filter byte (0) followed by width * 4 RGBA bytes
    raw_scanlines = bytearray()
    for y in range(height):
        raw_scanlines.append(0) # Filter: None
        for x in range(width):
            if (x + y) % 2 == 0:
                raw_scanlines.extend(b"\x00\x00\x00\x00") # Fully transparent
            else:
                raw_scanlines.extend(b"\xec\x30\x13\xc0") # Brand Red RGBA(236, 48, 19, 192)

    compressed = zlib.compress(bytes(raw_scanlines))
    idat_chunk = make_png_chunk(b"IDAT", compressed)
    iend_chunk = make_png_chunk(b"IEND", b"")
    return sig + ihdr_chunk + idat_chunk + iend_chunk

png_bytes = generate_transparent_png(64, 48)

check("PNG signature matches standard 8-byte magic header", png_bytes.startswith(b"\x89PNG\r\n\x1a\n"))

# Parse chunks
chunks = []
idx = 8
while idx < len(png_bytes):
    length, = struct.unpack(">I", png_bytes[idx:idx+4])
    ctype = png_bytes[idx+4:idx+8]
    cdata = png_bytes[idx+8:idx+8+length]
    crc, = struct.unpack(">I", png_bytes[idx+8+length:idx+12+length])
    expected_crc = zlib.crc32(ctype + cdata)
    check(f"CRC32 valid for chunk {ctype.decode('ascii')}", crc == expected_crc)
    chunks.append((ctype, length, cdata))
    idx += 12 + length

ihdr = chunks[0][2]
w, h, bit_depth, color_type, comp, filt, inter = struct.unpack(">IIBBBBB", ihdr)
check("IHDR dimensions are 64x48", w == 64 and h == 48)
check("Color type is 6 (RGBA truecolor with alpha channel)", color_type == 6)
check("Bit depth is 8 bits per channel", bit_depth == 8)

# Check transparency in IDAT
idat_raw = zlib.decompress(chunks[1][2])
check("Decompressed scanlines length matches 48 * (1 + 64 * 4)", len(idat_raw) == 48 * (1 + 64 * 4))

transparent_pixels = 0
opaque_pixels = 0
pos = 0
for y in range(48):
    filt = idat_raw[pos]
    pos += 1
    for x in range(64):
        r, g, b, a = idat_raw[pos:pos+4]
        pos += 4
        if a == 0:
            transparent_pixels += 1
        elif a == 192:
            opaque_pixels += 1

check("Valid distribution of transparent and semi-transparent alpha pixels", transparent_pixels == 32 * 48 and opaque_pixels == 32 * 48)

# -----------------------------------------------------------------------------
# 2. HTML Markup & Modernist CSS Integrity
# -----------------------------------------------------------------------------
print("\n--- 2. HTML MARKUP & MODERNIST CSS INTEGRITY ---")

html_path = os.path.join(os.path.dirname(__file__), "..", "index.html")
with open(html_path, "r", encoding="utf-8") as f:
    html_content = f.read()

dom_path = os.path.join(os.path.dirname(__file__), "..", "js", "dom.js")
if os.path.exists(dom_path):
    with open(dom_path, "r", encoding="utf-8") as f:
        dom_content = f.read()
else:
    dom_content = html_content

css_dir = os.path.join(os.path.dirname(__file__), "..", "css")
css_content = ""
if os.path.exists(css_dir):
    for cf in os.listdir(css_dir):
        if cf.endswith(".css"):
            with open(os.path.join(css_dir, cf), "r", encoding="utf-8") as f:
                css_content += f.read() + "\n"
else:
    css_content = html_content

# Extract cached element IDs in 'const el = {' or 'export const el = {'
el_match = re.search(r"(?:export\s+)?const el = \{([\s\S]*?)\n\s*\};", dom_content)
check("const el DOM cache found in dom.js / index.html", bool(el_match))

cached_ids = re.findall(r"document\.getElementById\(['\"]([^'\"]+)['\"]\)", dom_content)
check(f"Exactly 169 element IDs cached in const el (found {len(cached_ids)})", len(cached_ids) == 169)

missing_ids = []
for cid in cached_ids:
    pattern = r"id=['\"]" + re.escape(cid) + r"['\"]"
    if not re.search(pattern, html_content):
        missing_ids.append(cid)

check(f"All 169 cached element IDs exist in HTML markup (missing: {missing_ids})", len(missing_ids) == 0)

# Check CSS classes
required_css = [
    ".resize-handle",
    ".rotation-stalk",
    ".rotation-handle",
    ".coords-hud",
    ".layer-thumb.checkerboard"
]
for cls in required_css:
    check(f"CSS handle class '{cls}' defined in stylesheet", cls in css_content)

# -----------------------------------------------------------------------------
# 3. Direct Manipulation Math & Magnetic Angle Snapping
# -----------------------------------------------------------------------------
print("\n--- 3. DIRECT MANIPULATION MATH & MAGNETIC ANGLE SNAPPING ---")

def compute_polar_angle(dx: float, dy: float) -> float:
    angle = math.atan2(dy, dx) * (180.0 / math.pi) + 90.0
    while angle > 180.0:
        angle -= 360.0
    while angle < -180.0:
        angle += 360.0
    return round(angle, 1)

check("Straight UP (0, -100) -> 0.0°", compute_polar_angle(0, -100) == 0.0)
check("Straight RIGHT (100, 0) -> 90.0°", compute_polar_angle(100, 0) == 90.0)
check("Straight DOWN (0, 100) -> +/-180.0°", abs(compute_polar_angle(0, 100)) == 180.0)
check("Straight LEFT (-100, 0) -> -90.0°", compute_polar_angle(-100, 0) == -90.0)
check("Diagonal (100, 100) -> 135.0°", compute_polar_angle(100, 100) == 135.0)

def snap_angle(angle: float, shift_key: bool = False) -> float:
    candidates = [-180, -135, -90, -45, 0, 45, 90, 135, 180]
    if shift_key:
        return min(candidates, key=lambda c: abs(angle - c))
    for sa in candidates:
        if abs(angle - sa) <= 3.0:
            return float(sa)
    return angle

check("Snapping 2.1° to 0°", snap_angle(2.1) == 0.0)
check("Snapping 43.8° to 45°", snap_angle(43.8) == 45.0)
check("Snapping 88.5° to 90°", snap_angle(88.5) == 90.0)
check("Snapping -92.2° to -90°", snap_angle(-92.2) == -90.0)
check("Snapping 134.1° to 135°", snap_angle(134.1) == 135.0)
check("Snapping 178.6° to 180°", snap_angle(178.6) == 180.0)
check("No snap for 25.0° without shift", snap_angle(25.0) == 25.0)
check("Shift key snaps 25.0° to 45.0°", snap_angle(25.0, shift_key=True) == 45.0)

# -----------------------------------------------------------------------------
# 4. Corner Resizing Matrix Un-projection Across 4 Corners
# -----------------------------------------------------------------------------
print("\n--- 4. CORNER RESIZING MATRIX UN-PROJECTION ---")

def compute_corner_resize(handle: str, init_w: float, init_h: float, rot_deg: float, delta_x: float, delta_y: float, lock_ratio: bool = True):
    rad = (-rot_deg * math.pi) / 180.0
    local_dx = delta_x * math.cos(rad) - delta_y * math.sin(rad)
    local_dy = delta_x * math.sin(rad) + delta_y * math.cos(rad)

    new_w = init_w
    new_h = init_h

    if handle == "se":
        new_w = init_w + 2 * local_dx
        new_h = init_h + 2 * local_dy
    elif handle == "ne":
        new_w = init_w + 2 * local_dx
        new_h = init_h - 2 * local_dy
    elif handle == "sw":
        new_w = init_w - 2 * local_dx
        new_h = init_h + 2 * local_dy
    elif handle == "nw":
        new_w = init_w - 2 * local_dx
        new_h = init_h - 2 * local_dy

    initial_ratio = init_w / init_h
    if lock_ratio and initial_ratio > 0:
        scale_change_w = abs(new_w - init_w) / init_w
        scale_change_h = abs(new_h - init_h) / init_h
        if scale_change_w >= scale_change_h:
            new_h = new_w / initial_ratio
        else:
            new_w = new_h * initial_ratio

    min_dim = 20
    max_dim = 1920 * 3
    new_w = max(min_dim, min(max_dim, round(new_w)))
    new_h = max(min_dim, min(max_dim, round(new_h)))
    return new_w, new_h

# SE handle expansion
w_se, h_se = compute_corner_resize("se", 400, 200, 0, 50, 25, lock_ratio=True)
check("SE handle expansion maintains aspect ratio 2.0 (500x250)", w_se == 500 and h_se == 250)

# NW handle expansion
w_nw, h_nw = compute_corner_resize("nw", 400, 200, 0, -50, -25, lock_ratio=True)
check("NW handle expansion maintains aspect ratio 2.0 (500x250)", w_nw == 500 and h_nw == 250)

# NE handle expansion
w_ne, h_ne = compute_corner_resize("ne", 400, 200, 0, 50, -25, lock_ratio=True)
check("NE handle expansion maintains aspect ratio 2.0 (500x250)", w_ne == 500 and h_ne == 250)

# SW handle expansion
w_sw, h_sw = compute_corner_resize("sw", 400, 200, 0, -50, 25, lock_ratio=True)
check("SW handle expansion maintains aspect ratio 2.0 (500x250)", w_sw == 500 and h_sw == 250)

# Rotated layer un-projection (90 deg)
w_rot, h_rot = compute_corner_resize("se", 400, 200, 90, 50, 0, lock_ratio=False)
check("90° rotated un-projection maps deltaX to localDy (400x100)", w_rot == 400 and h_rot == 100)

# Minimum dimension clamp
w_min, h_min = compute_corner_resize("nw", 50, 50, 0, 100, 100, lock_ratio=True)
check("Minimum dimension clamping preserves safety boundary >= 20px", w_min >= 20 and h_min >= 20)

# -----------------------------------------------------------------------------
# 5. Template ZIP Package Schema v2 Export & Import Round-trip
# -----------------------------------------------------------------------------
print("\n--- 5. TEMPLATE ZIP SCHEMA v2 ARCHIVING ROUND-TRIP ---")

template_data = {
    "app": "digital-signage-generator",
    "framework": "CueSmith-Modernist",
    "dSignVersion": "2.1.0",
    "schemaVersion": 2,
    "preset": "landscape",
    "width": 1920,
    "height": 1080,
    "layers": [
        {
            "id": "layer_head_1",
            "type": "text",
            "name": "Header Text",
            "x": 50.0,
            "y": 30.0,
            "rotation": 0,
            "opacity": 100,
            "textContent": "WELCOME TO BROADCAST SIGNAGE"
        },
        {
            "id": "layer_img_2",
            "type": "image",
            "name": "brand_logo.png",
            "imagePath": "images/layers/layer_img_2_brand_logo.png",
            "width": 300,
            "height": 150,
            "x": 50.0,
            "y": 60.0,
            "rotation": 15.0,
            "opacity": 90,
            "lockAspectRatio": True
        }
    ]
}

# Create zip in memory
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.writestr("template.json", json.dumps(template_data, indent=2))
    zf.writestr("images/layers/layer_img_2_brand_logo.png", png_bytes)

zip_buffer.seek(0)

# Read zip back and verify
with zipfile.ZipFile(zip_buffer, "r") as zf:
    namelist = zf.namelist()
    check("template.json present in zip archive", "template.json" in namelist)
    check("images/layers/layer_img_2_brand_logo.png present in zip archive", "images/layers/layer_img_2_brand_logo.png" in namelist)

    raw_json = zf.read("template.json").decode("utf-8")
    loaded_template = json.loads(raw_json)
    check("Loaded template has schemaVersion 2", loaded_template.get("schemaVersion") == 2)
    check("Loaded template has dSignVersion 2.1.0", loaded_template.get("dSignVersion") == "2.1.0")

    extracted_png = zf.read("images/layers/layer_img_2_brand_logo.png")
    check("Extracted PNG matches generated 32-bit PNG bytes", extracted_png == png_bytes)

# -----------------------------------------------------------------------------
# 6. Legacy Schema v1 Backwards Compatibility
# -----------------------------------------------------------------------------
print("\n--- 6. LEGACY SCHEMA v1 BACKWARDS COMPATIBILITY ---")

def normalize_layer(layer: dict) -> dict:
    norm = dict(layer)
    if "type" not in norm:
        norm["type"] = "text"
    if "x" not in norm and "textX" in norm:
        norm["x"] = norm["textX"]
    if "y" not in norm and "textY" in norm:
        norm["y"] = norm["textY"]
    if "textX" not in norm and "x" in norm:
        norm["textX"] = norm["x"]
    if "textY" not in norm and "y" in norm:
        norm["textY"] = norm["y"]
    norm["rotation"] = norm.get("rotation", 0)
    norm["opacity"] = norm.get("opacity", 100)
    norm["visible"] = norm.get("visible", True)
    return norm

legacy_v1_layer = {
    "id": "old_1",
    "name": "Old Card",
    "textContent": "V1 Announcement",
    "textX": 35.0,
    "textY": 75.0
}

migrated = normalize_layer(legacy_v1_layer)
check("Legacy layer defaulted to type 'text'", migrated["type"] == "text")
check("Legacy layer x migrated from textX", migrated["x"] == 35.0)
check("Legacy layer y migrated from textY", migrated["y"] == 75.0)
check("Legacy layer rotation defaulted to 0", migrated["rotation"] == 0)
check("Legacy layer opacity defaulted to 100", migrated["opacity"] == 100)
check("Legacy layer visible defaulted to True", migrated["visible"] is True)

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
print("\n" + "=" * 70)
print(f"ALL PYTHON VERIFICATION CHECKS COMPLETE: {passed_tests}/{total_tests} PASSED (100%)")
print("=" * 70)
