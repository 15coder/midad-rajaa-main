"""
Generate PNG icons for مداد PWA from SVG-like drawing using Python stdlib only
"""
import struct
import zlib
import os
import math

ICONS_DIR = r"C:\Users\AMEER\.gemini\antigravity\scratch\mdad-store\icons"
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

def write_png(filename, width, height, pixels):
    """Write a PNG file given a list of (r,g,b,a) tuples row by row."""
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    # Build raw image data
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter byte
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw += bytes([r, g, b, a])

    compressed = zlib.compress(raw, 9)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    # RGBA = color type 6
    ihdr_data = struct.pack('>II', width, height) + bytes([8, 6, 0, 0, 0])
    ihdr = make_chunk(b'IHDR', ihdr_data)
    idat = make_chunk(b'IDAT', compressed)
    iend = make_chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(sig + ihdr + idat + iend)

def lerp(a, b, t):
    return a + (b - a) * t

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def blend(bg, fg, alpha):
    """Alpha composite fg over bg, alpha 0..1"""
    a = alpha
    return tuple(int(bg[i] * (1 - a) + fg[i] * a) for i in range(3))

def dist(x1, y1, x2, y2):
    return math.sqrt((x2-x1)**2 + (y2-y1)**2)

def generate_icon(size):
    pixels = []
    s = size
    
    for y in range(s):
        for x in range(s):
            # Normalized coords 0..1
            nx = x / s
            ny = y / s
            
            # --- Background gradient: #1a1a2e -> #16213e ---
            bg_r = int(lerp(0x1a, 0x16, nx + ny * 0.5))
            bg_g = int(lerp(0x1a, 0x21, nx + ny * 0.5))
            bg_b = int(lerp(0x2e, 0x3e, nx + ny * 0.5))
            
            r, g, b, a = bg_r, bg_g, bg_b, 255
            
            # Rounded rect mask (corner radius = 23.4% of size)
            corner = s * 0.234
            cx, cy = x, y
            # Distance from nearest corner
            qx = abs(cx - s/2) - (s/2 - corner)
            qy = abs(cy - s/2) - (s/2 - corner)
            d = math.sqrt(max(qx,0)**2 + max(qy,0)**2) + min(max(qx,qy),0) - corner
            if d > 0:
                a = 0
                pixels.append((0, 0, 0, 0))
                continue
            
            # --- Brain left half (pink ellipse) ---
            # Center at ~43% x, 39% y, radius 15.6% x, 17.6% y
            bx, by = s * 0.43, s * 0.39
            brx, bry = s * 0.156, s * 0.176
            if ((x - bx)/brx)**2 + ((y - by)/bry)**2 < 1:
                alpha = 0.85
                r, g, b = blend((r,g,b), (0xF4, 0xA5, 0xB8), alpha)
            
            # --- Brain right half (blue ellipse) ---
            bx2, by2 = s * 0.585, s * 0.39
            if ((x - bx2)/brx)**2 + ((y - by2)/bry)**2 < 1:
                alpha = 0.85
                r, g, b = blend((r,g,b), (0xA5, 0xB8, 0xD4), alpha)
            
            # --- Eyes (white circles) ---
            # Left eye
            ex1, ey1 = s * 0.43, s * 0.449
            if dist(x, y, ex1, ey1) < s * 0.043:
                r, g, b = blend((r,g,b), (255, 255, 255), 0.95)
                # Pupil
                if dist(x, y, ex1, ey1 + s*0.006) < s * 0.027:
                    r, g, b = blend((r,g,b), (0x1a, 0x3a, 0x6b), 0.95)
                    # Shine
                    if dist(x, y, ex1 + s*0.01, ey1 - s*0.01) < s * 0.01:
                        r, g, b = 255, 255, 255
            
            # Right eye
            ex2, ey2 = s * 0.576, s * 0.449
            if dist(x, y, ex2, ey2) < s * 0.043:
                r, g, b = blend((r,g,b), (255, 255, 255), 0.95)
                if dist(x, y, ex2, ey2 + s*0.006) < s * 0.027:
                    r, g, b = blend((r,g,b), (0x1a, 0x3a, 0x6b), 0.95)
                    if dist(x, y, ex2 + s*0.01, ey2 - s*0.01) < s * 0.01:
                        r, g, b = 255, 255, 255
            
            # --- Book (navy rectangle) ---
            # Left page
            bk_x1, bk_y1 = s * 0.30, s * 0.517
            bk_x2, bk_y2 = s * 0.495, s * 0.653
            if bk_x1 < x < bk_x2 and bk_y1 < y < bk_y2:
                r, g, b = blend((r,g,b), (0x0f, 0x24, 0x60), 0.92)
            
            # Right page
            bk_x3, bk_y3 = s * 0.498, s * 0.517
            bk_x4, bk_y4 = s * 0.70, s * 0.653
            if bk_x3 < x < bk_x4 and bk_y3 < y < bk_y4:
                r, g, b = blend((r,g,b), (0x1a, 0x3a, 0x8c), 0.92)
            
            # Spine
            sp_x1, sp_x2 = s * 0.484, s * 0.512
            sp_y1, sp_y2 = s * 0.508, s * 0.66
            if sp_x1 < x < sp_x2 and sp_y1 < y < sp_y2:
                r, g, b = blend((r,g,b), (0x0d, 0x1f, 0x50), 0.98)
            
            # --- Gradient accent overlay for "مداد" text area ---
            # Simple colored band at bottom
            text_y = s * 0.76
            if y > text_y:
                t = (y - text_y) / (s - text_y)
                # Blue to purple gradient
                tr = int(lerp(0x00, 0xBF, t * 0.5))
                tg = int(lerp(0x7A, 0x5A, t * 0.5))
                tb = int(lerp(0xFF, 0xF2, t * 0.5))
                r, g, b = blend((r,g,b), (tr,tg,tb), 0.3)
            
            # --- Sparkle dots ---
            sparkles = [
                (0.254, 0.293, s*0.012, (0xFF, 0xD6, 0x0A)),
                (0.742, 0.273, s*0.008, (0x5A, 0xC8, 0xFA)),
                (0.215, 0.508, s*0.006, (0xBF, 0x5A, 0xF2)),
            ]
            for sx, sy, sr, sc in sparkles:
                if dist(x, y, s*sx, s*sy) < sr:
                    r, g, b = blend((r,g,b), sc, 0.75)
            
            pixels.append((
                clamp(r, 0, 255),
                clamp(g, 0, 255),
                clamp(b, 0, 255),
                a
            ))
    
    return pixels

print("Generating PWA icons...")
for size in SIZES:
    print(f"  Creating {size}x{size}...")
    pixels = generate_icon(size)
    filename = os.path.join(ICONS_DIR, f"icon-{size}.png")
    write_png(filename, size, size, pixels)
    print(f"  ✓ icon-{size}.png")

# Also copy 192 as badge
import shutil
shutil.copy(
    os.path.join(ICONS_DIR, "icon-96.png"),
    os.path.join(ICONS_DIR, "badge-72.png")
)

# Screenshot placeholder (simple 390x844 dark image)
sw, sh = 390, 844
sc_pixels = []
for y in range(sh):
    for x in range(sw):
        nx, ny = x/sw, y/sh
        r = int(lerp(0x0a, 0x16, nx))
        g = int(lerp(0x0a, 0x21, ny))
        b = int(lerp(0x0f, 0x3e, (nx+ny)/2))
        sc_pixels.append((r, g, b, 255))

write_png(os.path.join(ICONS_DIR, "screenshot-1.png"), sw, sh, sc_pixels)
print("✓ screenshot-1.png")
print("\n✅ All icons generated successfully!")
