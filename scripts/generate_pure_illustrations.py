#!/usr/bin/env python3
"""
UCS CTF Platform - Pure Graphical Illustration Generator
Generates high-resolution 1297x1369 RGBA transparent PNG illustrations
for CTF categories with NO CODE / NO TEXT SNIPPETS.
Only pure visual cyberpunk & technical vector art!
"""

import math
import os
import shutil
from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 1297, 1369
SCALE = 2
SW, SH = WIDTH * SCALE, HEIGHT * SCALE
CX, CY = SW // 2, SH // 2

class CyberArtCanvas:
    def __init__(self, pri_color, sec_color, acc_color=(255, 255, 255, 255)):
        self.pri = pri_color  # Main neon RGBA
        self.sec = sec_color  # Secondary neon RGBA
        self.acc = acc_color  # Highlight RGBA
        
        self.bg = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
        self.glow = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
        self.fg = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
        self.hi = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
        
        self.draw_bg = ImageDraw.Draw(self.bg)
        self.draw_glow = ImageDraw.Draw(self.glow)
        self.draw_fg = ImageDraw.Draw(self.fg)
        self.draw_hi = ImageDraw.Draw(self.hi)

    def draw_glowing_circle(self, cx, cy, r, outline_color, width=3, glow_width=12):
        bbox = (cx - r, cy - r, cx + r, cy + r)
        self.draw_glow.ellipse(bbox, outline=outline_color, width=glow_width)
        self.draw_fg.ellipse(bbox, outline=outline_color, width=width)

    def draw_glowing_line(self, p1, p2, color, width=3, glow_width=10):
        self.draw_glow.line([p1, p2], fill=color, width=glow_width)
        self.draw_fg.line([p1, p2], fill=color, width=width)

    def draw_glowing_polygon(self, points, fill_color=None, outline_color=None, width=3, glow_width=10):
        if fill_color:
            self.draw_bg.polygon(points, fill=fill_color)
        if outline_color:
            self.draw_glow.polygon(points, outline=outline_color)
            self.draw_fg.polygon(points, outline=outline_color)

    def finish(self, glow_radius=16):
        # Blur the glow layer
        blurred_glow = self.glow.filter(ImageFilter.GaussianBlur(glow_radius))
        # Composite layers
        out = Image.alpha_composite(self.bg, blurred_glow)
        out = Image.alpha_composite(out, self.fg)
        out = Image.alpha_composite(out, self.hi)
        # Downsample to target size with Lanczos
        return out.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def create_web_illustration():
    """Web Exploitation: Cyber Spider & Glowing Holographic Web Gateway"""
    c = CyberArtCanvas(
        pri_color=(0, 240, 255, 230),     # Cyan
        sec_color=(0, 255, 102, 210),     # Lime Green
        acc_color=(255, 255, 255, 255)
    )
    
    # 1. Concentric Holographic Spiderweb
    num_spokes = 16
    web_r_max = int(580 * SCALE)
    spoke_angles = [i * (2 * math.pi / num_spokes) for i in range(num_spokes)]
    
    for r in range(int(90 * SCALE), web_r_max, int(70 * SCALE)):
        pts = [(CX + r * math.cos(a), CY + r * math.sin(a)) for a in spoke_angles]
        for i in range(num_spokes):
            p1 = pts[i]
            p2 = pts[(i + 1) % num_spokes]
            c.draw_glowing_line(p1, p2, c.pri, width=2 * SCALE, glow_width=8 * SCALE)
            # Web node dot
            c.draw_fg.ellipse((p1[0]-4*SCALE, p1[1]-4*SCALE, p1[0]+4*SCALE, p1[1]+4*SCALE), fill=c.sec)
    
    for a in spoke_angles:
        x2 = CX + web_r_max * math.cos(a)
        y2 = CY + web_r_max * math.sin(a)
        c.draw_glowing_line((CX, CY), (x2, y2), c.sec, width=2 * SCALE, glow_width=8 * SCALE)
        
    # 2. Outer Technical Segmented Ring
    ring_r = int(540 * SCALE)
    c.draw_glowing_circle(CX, CY, ring_r, c.pri, width=3 * SCALE, glow_width=12 * SCALE)
    c.draw_glowing_circle(CX, CY, ring_r + int(24 * SCALE), c.sec, width=1 * SCALE, glow_width=6 * SCALE)
    
    for i in range(32):
        ang = i * (2 * math.pi / 32)
        x1 = CX + (ring_r + int(10 * SCALE)) * math.cos(ang)
        y1 = CY + (ring_r + int(10 * SCALE)) * math.sin(ang)
        x2 = CX + (ring_r + int(22 * SCALE)) * math.cos(ang)
        y2 = CY + (ring_r + int(22 * SCALE)) * math.sin(ang)
        c.draw_fg.line([(x1, y1), (x2, y2)], fill=c.pri, width=2 * SCALE)

    # 3. Central Robotic Arachnid / Cyber Spider Chassis
    # Abdomen (diamond / oval facet)
    abd_pts = [
        (CX, CY + int(180 * SCALE)),
        (CX - int(90 * SCALE), CY + int(70 * SCALE)),
        (CX - int(50 * SCALE), CY - int(10 * SCALE)),
        (CX + int(50 * SCALE), CY - int(10 * SCALE)),
        (CX + int(90 * SCALE), CY + int(70 * SCALE)),
    ]
    c.draw_glowing_polygon(abd_pts, fill_color=(0, 240, 255, 45), outline_color=c.pri, width=4 * SCALE, glow_width=16 * SCALE)
    
    # Abdomen energy core
    c.draw_fg.ellipse((CX - 30*SCALE, CY + 50*SCALE, CX + 30*SCALE, CY + 110*SCALE), fill=c.sec)
    c.draw_glow.ellipse((CX - 40*SCALE, CY + 40*SCALE, CX + 40*SCALE, CY + 120*SCALE), fill=c.pri)

    # Cephalothorax (head/thorax)
    thx_pts = [
        (CX - int(60 * SCALE), CY - int(20 * SCALE)),
        (CX - int(45 * SCALE), CY - int(90 * SCALE)),
        (CX, CY - int(120 * SCALE)),
        (CX + int(45 * SCALE), CY - int(90 * SCALE)),
        (CX + int(60 * SCALE), CY - int(20 * SCALE)),
    ]
    c.draw_glowing_polygon(thx_pts, fill_color=(0, 255, 102, 60), outline_color=c.sec, width=4 * SCALE, glow_width=14 * SCALE)

    # Glowing Cyber Optics (Cluster of 6 eyes)
    eye_offsets = [(-25, -70), (-10, -85), (10, -85), (25, -70), (-15, -60), (15, -60)]
    for ox, oy in eye_offsets:
        ex, ey = CX + ox * SCALE, CY + oy * SCALE
        c.draw_fg.ellipse((ex - 5*SCALE, ey - 5*SCALE, ex + 5*SCALE, ey + 5*SCALE), fill=(255, 255, 255, 255))
        c.draw_glow.ellipse((ex - 12*SCALE, ey - 12*SCALE, ex + 12*SCALE, ey + 12*SCALE), fill=c.pri)

    # 4. Articulated Robotic Legs (8 legs, 3 segments each)
    leg_configs = [
        # Side, angle1, angle2, reach1, reach2, reach3
        (-1, 0.4, 0.9, 140, 160, 150),
        (-1, 0.1, 0.5, 160, 170, 140),
        (-1, -0.2, 0.1, 150, 160, 130),
        (-1, -0.6, -0.2, 130, 150, 120),
        (1, 0.4, 0.9, 140, 160, 150),
        (1, 0.1, 0.5, 160, 170, 140),
        (1, -0.2, 0.1, 150, 160, 130),
        (1, -0.6, -0.2, 130, 150, 120),
    ]
    
    for side, a1, a2, r1, r2, r3 in leg_configs:
        hip_x = CX + side * 45 * SCALE
        hip_y = CY - (20 + a1 * 60) * SCALE
        
        knee_x = hip_x + side * r1 * SCALE * 0.9
        knee_y = hip_y - r1 * SCALE * 0.5 * (1 if a1 < 0.2 else -0.5)
        
        ankle_x = knee_x + side * r2 * SCALE * 0.7
        ankle_y = knee_y + r2 * SCALE * 0.8
        
        claw_x = ankle_x + side * r3 * SCALE * 0.5
        claw_y = ankle_y + r3 * SCALE * 0.4
        
        c.draw_glowing_line((hip_x, hip_y), (knee_x, knee_y), c.pri, width=5 * SCALE, glow_width=14 * SCALE)
        c.draw_glowing_line((knee_x, knee_y), (ankle_x, ankle_y), c.sec, width=4 * SCALE, glow_width=12 * SCALE)
        c.draw_glowing_line((ankle_x, ankle_y), (claw_x, claw_y), c.pri, width=3 * SCALE, glow_width=10 * SCALE)
        
        # Joint caps
        for jx, jy in [(knee_x, knee_y), (ankle_x, ankle_y)]:
            c.draw_fg.ellipse((jx - 6*SCALE, jy - 6*SCALE, jx + 6*SCALE, jy + 6*SCALE), fill=(255, 255, 255, 255))

    return c.finish()


def create_crypto_illustration():
    """Cryptography: Sacred 3D Cyber Lock, Golden Floating Key & Crystal Prism"""
    c = CyberArtCanvas(
        pri_color=(250, 204, 21, 240),    # Neon Gold / Amber
        sec_color=(0, 240, 255, 220),     # Cyan
        acc_color=(255, 255, 255, 255)
    )
    
    # 1. Background Concentric Cipher Wheels / Astrolabe
    wheel_r1 = int(520 * SCALE)
    wheel_r2 = int(430 * SCALE)
    wheel_r3 = int(340 * SCALE)
    
    c.draw_glowing_circle(CX, CY, wheel_r1, c.pri, width=2 * SCALE, glow_width=10 * SCALE)
    c.draw_glowing_circle(CX, CY, wheel_r2, c.sec, width=2 * SCALE, glow_width=8 * SCALE)
    c.draw_glowing_circle(CX, CY, wheel_r3, c.pri, width=3 * SCALE, glow_width=12 * SCALE)
    
    for i in range(60):
        ang = i * (2 * math.pi / 60)
        tick_len = (18 if i % 5 == 0 else 8) * SCALE
        x1 = CX + (wheel_r1 - tick_len) * math.cos(ang)
        y1 = CY + (wheel_r1 - tick_len) * math.sin(ang)
        x2 = CX + wheel_r1 * math.cos(ang)
        y2 = CY + wheel_r1 * math.sin(ang)
        c.draw_fg.line([(x1, y1), (x2, y2)], fill=c.pri, width=2 * SCALE)
        
    for i in range(24):
        ang = i * (2 * math.pi / 24)
        x = CX + wheel_r2 * math.cos(ang)
        y = CY + wheel_r2 * math.sin(ang)
        # Cipher node diamonds
        s = 8 * SCALE
        c.draw_glowing_polygon([(x, y-s), (x+s, y), (x, y+s), (x-s, y)], fill_color=c.sec, outline_color=c.acc, width=2*SCALE)

    # 2. Monumental Cyber Padlock (Center)
    # Heavy U-Shackle
    shackle_cx = CX
    shackle_cy = CY - int(110 * SCALE)
    shackle_r = int(140 * SCALE)
    shackle_w = int(45 * SCALE)
    
    # Outer shackle arc & legs
    s_pts_outer = []
    for deg in range(180, 361, 5):
        rad = math.radians(deg)
        s_pts_outer.append((shackle_cx + (shackle_r + shackle_w//2) * math.cos(rad), shackle_cy + (shackle_r + shackle_w//2) * math.sin(rad)))
    s_pts_outer.append((shackle_cx + (shackle_r + shackle_w//2), CY + int(10 * SCALE)))
    s_pts_outer.append((shackle_cx + (shackle_r - shackle_w//2), CY + int(10 * SCALE)))
    for deg in range(360, 179, -5):
        rad = math.radians(deg)
        s_pts_outer.append((shackle_cx + (shackle_r - shackle_w//2) * math.cos(rad), shackle_cy + (shackle_r - shackle_w//2) * math.sin(rad)))
    s_pts_outer.append((shackle_cx - (shackle_r + shackle_w//2), CY + int(10 * SCALE)))
    
    c.draw_glowing_polygon(s_pts_outer, fill_color=(250, 204, 21, 50), outline_color=c.pri, width=4 * SCALE, glow_width=16 * SCALE)
    
    # Lock Body (Angular chamfered shield body)
    bw = int(220 * SCALE)
    bh = int(240 * SCALE)
    top_y = CY - int(20 * SCALE)
    bot_y = top_y + bh
    
    body_pts = [
        (CX - bw, top_y + int(40 * SCALE)),
        (CX - bw + int(40 * SCALE), top_y),
        (CX + bw - int(40 * SCALE), top_y),
        (CX + bw, top_y + int(40 * SCALE)),
        (CX + bw, bot_y - int(60 * SCALE)),
        (CX, bot_y),
        (CX - bw, bot_y - int(60 * SCALE)),
    ]
    c.draw_glowing_polygon(body_pts, fill_color=(20, 24, 28, 220), outline_color=c.pri, width=5 * SCALE, glow_width=18 * SCALE)
    
    # Inner body inset
    body_inset = [
        (CX - bw + 20*SCALE, top_y + 45*SCALE),
        (CX - bw + 45*SCALE, top_y + 20*SCALE),
        (CX + bw - 45*SCALE, top_y + 20*SCALE),
        (CX + bw - 20*SCALE, top_y + 45*SCALE),
        (CX + bw - 20*SCALE, bot_y - 65*SCALE),
        (CX, bot_y - 20*SCALE),
        (CX - bw + 20*SCALE, bot_y - 65*SCALE),
    ]
    c.draw_glowing_polygon(body_inset, fill_color=(0, 240, 255, 30), outline_color=c.sec, width=2 * SCALE, glow_width=10 * SCALE)

    # Keyhole emblem (Glowing Keyhole)
    kh_y = top_y + int(100 * SCALE)
    c.draw_glowing_circle(CX, kh_y, int(28 * SCALE), c.pri, width=4 * SCALE, glow_width=16 * SCALE)
    c.draw_fg.ellipse((CX - 18*SCALE, kh_y - 18*SCALE, CX + 18*SCALE, kh_y + 18*SCALE), fill=(255, 255, 255, 255))
    kh_slot = [
        (CX - int(12 * SCALE), kh_y),
        (CX + int(12 * SCALE), kh_y),
        (CX + int(20 * SCALE), kh_y + int(60 * SCALE)),
        (CX - int(20 * SCALE), kh_y + int(60 * SCALE)),
    ]
    c.draw_glowing_polygon(kh_slot, fill_color=(255, 255, 255, 255), outline_color=c.pri, width=3 * SCALE)

    # 3. Floating 3D Cyber Key (Golden Neon)
    key_ox = CX + int(240 * SCALE)
    key_oy = CY + int(160 * SCALE)
    # Bow (handle ring)
    c.draw_glowing_circle(key_ox, key_oy, int(55 * SCALE), c.pri, width=6 * SCALE, glow_width=18 * SCALE)
    c.draw_glowing_circle(key_ox, key_oy, int(25 * SCALE), c.sec, width=3 * SCALE, glow_width=10 * SCALE)
    # Shaft
    c.draw_glowing_line((key_ox, key_oy - int(55 * SCALE)), (key_ox, key_oy - int(280 * SCALE)), c.pri, width=8 * SCALE, glow_width=18 * SCALE)
    # Bitting (teeth)
    teeth_y = key_oy - int(240 * SCALE)
    c.draw_glowing_line((key_ox, teeth_y), (key_ox + int(45 * SCALE), teeth_y), c.pri, width=6 * SCALE)
    c.draw_glowing_line((key_ox, teeth_y + int(35 * SCALE)), (key_ox + int(65 * SCALE), teeth_y + int(35 * SCALE)), c.pri, width=6 * SCALE)
    c.draw_glowing_line((key_ox, teeth_y + int(70 * SCALE)), (key_ox + int(35 * SCALE), teeth_y + int(70 * SCALE)), c.pri, width=6 * SCALE)

    # 4. Floating Sacred Crystalline Prism (Left Side)
    prism_ox = CX - int(260 * SCALE)
    prism_oy = CY - int(140 * SCALE)
    pw, ph = int(70 * SCALE), int(130 * SCALE)
    p_top = (prism_ox, prism_oy - ph)
    p_bot = (prism_ox, prism_oy + ph)
    p_l = (prism_ox - pw, prism_oy)
    p_r = (prism_ox + pw, prism_oy)
    p_c = (prism_ox, prism_oy + int(20 * SCALE))
    
    c.draw_glowing_polygon([p_top, p_l, p_c], fill_color=(0, 240, 255, 60), outline_color=c.sec, width=2 * SCALE)
    c.draw_glowing_polygon([p_top, p_r, p_c], fill_color=(250, 204, 21, 60), outline_color=c.pri, width=2 * SCALE)
    c.draw_glowing_polygon([p_bot, p_l, p_c], fill_color=(0, 240, 255, 40), outline_color=c.sec, width=2 * SCALE)
    c.draw_glowing_polygon([p_bot, p_r, p_c], fill_color=(250, 204, 21, 40), outline_color=c.pri, width=2 * SCALE)

    return c.finish()


def create_pwn_illustration():
    """Binary Exploitation: Cyberpunk Cyborg Skull & Laser Targeting System"""
    c = CyberArtCanvas(
        pri_color=(239, 68, 68, 240),     # Neon Crimson / Blood Red
        sec_color=(0, 255, 102, 220),     # Lime Green
        acc_color=(255, 255, 255, 255)
    )
    
    # 1. Outer Aiming Reticle / Threat Target Brackets
    target_r = int(520 * SCALE)
    c.draw_glowing_circle(CX, CY, target_r, c.pri, width=2 * SCALE, glow_width=10 * SCALE)
    
    # Heavy corner brackets
    bw = int(140 * SCALE)
    br_r = target_r + int(30 * SCALE)
    for ang_deg in [45, 135, 225, 315]:
        rad = math.radians(ang_deg)
        bx = CX + br_r * math.cos(rad)
        by = CY + br_r * math.sin(rad)
        c.draw_glowing_circle(bx, by, int(15 * SCALE), c.pri, width=3 * SCALE)

    # 2. Massive Cyborg Skull (Center)
    # Cranium (facets)
    cranium = [
        (CX, CY - int(340 * SCALE)),
        (CX + int(140 * SCALE), CY - int(320 * SCALE)),
        (CX + int(240 * SCALE), CY - int(220 * SCALE)),
        (CX + int(260 * SCALE), CY - int(80 * SCALE)),
        (CX + int(210 * SCALE), CY + int(40 * SCALE)),
        (CX + int(140 * SCALE), CY + int(100 * SCALE)),
        (CX + int(110 * SCALE), CY + int(190 * SCALE)),
        (CX + int(70 * SCALE), CY + int(260 * SCALE)),
        (CX, CY + int(280 * SCALE)),
        (CX - int(70 * SCALE), CY + int(260 * SCALE)),
        (CX - int(110 * SCALE), CY + int(190 * SCALE)),
        (CX - int(140 * SCALE), CY + int(100 * SCALE)),
        (CX - int(210 * SCALE), CY + int(40 * SCALE)),
        (CX - int(260 * SCALE), CY - int(80 * SCALE)),
        (CX - int(240 * SCALE), CY - int(220 * SCALE)),
        (CX - int(140 * SCALE), CY - int(320 * SCALE)),
    ]
    c.draw_glowing_polygon(cranium, fill_color=(25, 15, 20, 230), outline_color=c.pri, width=6 * SCALE, glow_width=22 * SCALE)
    
    # Forehead Armor Plates & Seam lines
    c.draw_glowing_line((CX, CY - int(340 * SCALE)), (CX, CY - int(120 * SCALE)), c.sec, width=4 * SCALE, glow_width=12 * SCALE)
    c.draw_glowing_line((CX - int(140 * SCALE), CY - int(220 * SCALE)), (CX + int(140 * SCALE), CY - int(220 * SCALE)), c.sec, width=3 * SCALE)
    c.draw_glowing_line((CX - int(200 * SCALE), CY - int(140 * SCALE)), (CX - int(70 * SCALE), CY - int(140 * SCALE)), c.pri, width=3 * SCALE)
    c.draw_glowing_line((CX + int(70 * SCALE), CY - int(140 * SCALE)), (CX + int(200 * SCALE), CY - int(140 * SCALE)), c.pri, width=3 * SCALE)

    # Menacing Angular Eye Sockets
    # Left eye (High-tech Laser Scope)
    lex = CX - int(100 * SCALE)
    ley = CY - int(40 * SCALE)
    left_eye = [
        (lex - int(65 * SCALE), ley - int(20 * SCALE)),
        (lex + int(40 * SCALE), ley - int(35 * SCALE)),
        (lex + int(50 * SCALE), ley + int(30 * SCALE)),
        (lex - int(35 * SCALE), ley + int(45 * SCALE)),
    ]
    c.draw_glowing_polygon(left_eye, fill_color=(0, 0, 0, 255), outline_color=c.pri, width=4 * SCALE, glow_width=14 * SCALE)
    # Laser iris
    c.draw_glowing_circle(lex, ley, int(22 * SCALE), c.pri, width=3 * SCALE, glow_width=12 * SCALE)
    c.draw_fg.ellipse((lex - 8*SCALE, ley - 8*SCALE, lex + 8*SCALE, ley + 8*SCALE), fill=(255, 255, 255, 255))
    c.draw_glow.ellipse((lex - 16*SCALE, ley - 16*SCALE, lex + 16*SCALE, ley + 16*SCALE), fill=c.pri)

    # Right eye (Cybernetic Optical Sensor)
    rex = CX + int(100 * SCALE)
    rey = CY - int(40 * SCALE)
    right_eye = [
        (rex - int(40 * SCALE), rey - int(35 * SCALE)),
        (rex + int(65 * SCALE), rey - int(20 * SCALE)),
        (rex + int(35 * SCALE), rey + int(45 * SCALE)),
        (rex - int(50 * SCALE), rey + int(30 * SCALE)),
    ]
    c.draw_glowing_polygon(right_eye, fill_color=(0, 0, 0, 255), outline_color=c.sec, width=4 * SCALE, glow_width=14 * SCALE)
    # Camera aperture triangles in right eye
    c.draw_glowing_circle(rex, rey, int(25 * SCALE), c.sec, width=3 * SCALE, glow_width=12 * SCALE)
    c.draw_fg.ellipse((rex - 9*SCALE, rey - 9*SCALE, rex + 9*SCALE, rey + 9*SCALE), fill=c.sec)

    # Nasal Cavity (Inverted Triangle)
    nose = [
        (CX, CY + int(10 * SCALE)),
        (CX + int(30 * SCALE), CY + int(70 * SCALE)),
        (CX, CY + int(60 * SCALE)),
        (CX - int(30 * SCALE), CY + int(70 * SCALE)),
    ]
    c.draw_glowing_polygon(nose, fill_color=(0, 0, 0, 255), outline_color=c.pri, width=3 * SCALE)

    # Cybernetic Teeth / Metal Jaw Grille
    tooth_w = int(22 * SCALE)
    tooth_h = int(50 * SCALE)
    tooth_y = CY + int(140 * SCALE)
    for i in range(-3, 4):
        tx = CX + i * (tooth_w + 6 * SCALE)
        t_pts = [
            (tx - tooth_w//2, tooth_y),
            (tx + tooth_w//2, tooth_y),
            (tx + tooth_w//2 - 2*SCALE, tooth_y + tooth_h),
            (tx - tooth_w//2 + 2*SCALE, tooth_y + tooth_h),
        ]
        c.draw_glowing_polygon(t_pts, fill_color=(239, 68, 68, 40), outline_color=c.pri, width=2 * SCALE)

    # 3. Crossed Energy Sabers / Laser Rods Behind Skull
    rod_len = int(580 * SCALE)
    c.draw_glowing_line((CX - rod_len, CY - rod_len), (CX + rod_len, CY + rod_len), c.sec, width=6 * SCALE, glow_width=20 * SCALE)
    c.draw_glowing_line((CX - rod_len, CY + rod_len), (CX + rod_len, CY - rod_len), c.pri, width=6 * SCALE, glow_width=20 * SCALE)

    return c.finish()


def create_reverse_illustration():
    """Reverse Engineering: Microprocessor Silicon Core & Cybernetic Gears"""
    c = CyberArtCanvas(
        pri_color=(168, 85, 247, 240),    # Neon Violet / Purple
        sec_color=(0, 240, 255, 220),     # Cyan
        acc_color=(255, 255, 255, 255)
    )
    
    # 1. Background Circular Circuit Tracks & Logic Bus
    for r in [int(500 * SCALE), int(420 * SCALE), int(330 * SCALE)]:
        c.draw_glowing_circle(CX, CY, r, c.pri, width=2 * SCALE, glow_width=8 * SCALE)
        
    for i in range(16):
        ang = i * (2 * math.pi / 16)
        x1 = CX + int(330 * SCALE) * math.cos(ang)
        y1 = CY + int(330 * SCALE) * math.sin(ang)
        x2 = CX + int(490 * SCALE) * math.cos(ang)
        y2 = CY + int(490 * SCALE) * math.sin(ang)
        c.draw_glowing_line((x1, y1), (x2, y2), c.sec, width=2 * SCALE)
        c.draw_fg.ellipse((x2 - 5*SCALE, y2 - 5*SCALE, x2 + 5*SCALE, y2 + 5*SCALE), fill=c.pri)

    # 2. Interlocking High-Tech Precision Gears (Mechanical Dissection)
    def draw_gear(gx, gy, radius, teeth, color):
        tooth_depth = int(22 * SCALE)
        gear_pts = []
        for i in range(teeth * 2):
            ang = i * (math.pi / teeth)
            r = radius + (tooth_depth if i % 2 == 1 else 0)
            gear_pts.append((gx + r * math.cos(ang), gy + r * math.sin(ang)))
        c.draw_glowing_polygon(gear_pts, fill_color=(20, 15, 30, 200), outline_color=color, width=4 * SCALE, glow_width=14 * SCALE)
        c.draw_glowing_circle(gx, gy, radius - int(35 * SCALE), color, width=2 * SCALE)
        c.draw_glowing_circle(gx, gy, int(25 * SCALE), color, width=3 * SCALE)

    # Top Right Gear
    draw_gear(CX + int(240 * SCALE), CY - int(180 * SCALE), int(150 * SCALE), 14, c.pri)
    # Bottom Left Gear
    draw_gear(CX - int(240 * SCALE), CY + int(180 * SCALE), int(130 * SCALE), 12, c.sec)

    # 3. Central Quantum CPU Die (Square Carrier with Pins)
    chip_size = int(240 * SCALE)
    chip_rect = [
        (CX - chip_size, CY - chip_size),
        (CX + chip_size, CY - chip_size),
        (CX + chip_size, CY + chip_size),
        (CX - chip_size, CY + chip_size),
    ]
    c.draw_glowing_polygon(chip_rect, fill_color=(15, 10, 25, 240), outline_color=c.sec, width=6 * SCALE, glow_width=20 * SCALE)
    
    # Radiating Gold/Cyan Contact Pins (24 pins per side)
    num_pins = 16
    for i in range(num_pins):
        offset = (i - (num_pins - 1) / 2) * (chip_size * 1.6 / num_pins)
        pin_len = int(50 * SCALE)
        # Top
        c.draw_glowing_line((CX + offset, CY - chip_size), (CX + offset, CY - chip_size - pin_len), c.pri, width=3 * SCALE)
        # Bottom
        c.draw_glowing_line((CX + offset, CY + chip_size), (CX + offset, CY + chip_size + pin_len), c.pri, width=3 * SCALE)
        # Left
        c.draw_glowing_line((CX - chip_size, CY + offset), (CX - chip_size - pin_len, CY + offset), c.pri, width=3 * SCALE)
        # Right
        c.draw_glowing_line((CX + chip_size, CY + offset), (CX + chip_size + pin_len, CY + offset), c.pri, width=3 * SCALE)

    # Silicon Core Interior: Logic Gate Octagon & Labyrinth
    inner_oct = []
    for deg in range(22, 382, 45):
        rad = math.radians(deg)
        inner_oct.append((CX + int(140 * SCALE) * math.cos(rad), CY + int(140 * SCALE) * math.sin(rad)))
    c.draw_glowing_polygon(inner_oct, fill_color=(168, 85, 247, 50), outline_color=c.pri, width=4 * SCALE, glow_width=14 * SCALE)
    
    # Glowing Central Energy Core
    c.draw_glowing_circle(CX, CY, int(60 * SCALE), (255, 255, 255, 255), width=4 * SCALE, glow_width=20 * SCALE)
    c.draw_fg.ellipse((CX - 35*SCALE, CY - 35*SCALE, CX + 35*SCALE, CY + 35*SCALE), fill=c.sec)
    
    # 4. Diagonal Laser Probes / Dissection Ray
    c.draw_glowing_line((CX - int(450 * SCALE), CY - int(450 * SCALE)), (CX - int(100 * SCALE), CY - int(100 * SCALE)), c.pri, width=4 * SCALE)
    c.draw_glowing_line((CX + int(450 * SCALE), CY + int(450 * SCALE)), (CX + int(100 * SCALE), CY + int(100 * SCALE)), c.sec, width=4 * SCALE)

    return c.finish()


def create_forensics_illustration():
    """Digital Forensics: High-Tech Cyber Magnifier, Biometric Fingerprint & Sonar"""
    c = CyberArtCanvas(
        pri_color=(6, 182, 212, 240),     # Neon Cyan / Teal
        sec_color=(0, 255, 102, 220),     # Lime Green
        acc_color=(255, 255, 255, 255)
    )
    
    # 1. Background Radar Scanning Coordinates & Concentric Ticks
    radar_r = int(520 * SCALE)
    c.draw_glowing_circle(CX, CY, radar_r, c.pri, width=2 * SCALE, glow_width=10 * SCALE)
    c.draw_glowing_circle(CX, CY, int(380 * SCALE), c.sec, width=1 * SCALE, glow_width=6 * SCALE)
    
    # Crosshairs through center
    c.draw_glowing_line((CX - radar_r, CY), (CX + radar_r, CY), c.pri, width=2 * SCALE, glow_width=6 * SCALE)
    c.draw_glowing_line((CX, CY - radar_r), (CX, CY + radar_r), c.pri, width=2 * SCALE, glow_width=6 * SCALE)
    
    # 2. Glowing Biometric Digital Fingerprint (Under the lens)
    lens_cx = CX - int(40 * SCALE)
    lens_cy = CY - int(50 * SCALE)
    
    # Fingerprint ridges (concentric wavy elliptical arches)
    num_ridges = 11
    for i in range(1, num_ridges + 1):
        rw = int((i * 18 + 15) * SCALE)
        rh = int((i * 26 + 25) * SCALE)
        # Top arch
        c.draw_fg.arc((lens_cx - rw, lens_cy - rh, lens_cx + rw, lens_cy + rh), start=180, end=360, fill=c.sec, width=3 * SCALE)
        # Bottom loops with offset
        c.draw_fg.arc(
            (lens_cx - rw, lens_cy - rh + int(15 * SCALE), lens_cx + rw, lens_cy + rh + int(15 * SCALE)),
            start=0,
            end=180,
            fill=c.pri,
            width=3 * SCALE
        )
        
    # Minutiae feature points on fingerprint
    minutiae = [(-40, -60), (30, -80), (50, 10), (-60, 40), (20, 90), (-10, 120)]
    for mx, my in minutiae:
        px, py = lens_cx + mx * SCALE, lens_cy + my * SCALE
        c.draw_glowing_circle(px, py, int(9 * SCALE), (255, 255, 255, 255), width=2 * SCALE, glow_width=10 * SCALE)
        c.draw_fg.ellipse((px - 3*SCALE, py - 3*SCALE, px + 3*SCALE, py + 3*SCALE), fill=c.pri)

    # 3. High-Tech Cyber Magnifying Glass
    lens_radius = int(270 * SCALE)
    # Heavy Outer Ring
    c.draw_glowing_circle(lens_cx, lens_cy, lens_radius, c.pri, width=8 * SCALE, glow_width=24 * SCALE)
    c.draw_glowing_circle(lens_cx, lens_cy, lens_radius - int(20 * SCALE), c.sec, width=3 * SCALE, glow_width=10 * SCALE)
    
    # Calibrated Rim Markings
    for i in range(36):
        ang = i * (2 * math.pi / 36)
        x1 = lens_cx + (lens_radius - int(16 * SCALE)) * math.cos(ang)
        y1 = lens_cy + (lens_radius - int(16 * SCALE)) * math.sin(ang)
        x2 = lens_cx + lens_radius * math.cos(ang)
        y2 = lens_cy + lens_radius * math.sin(ang)
        c.draw_fg.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 255), width=2 * SCALE)

    # Diagonal Ergonomic Cyber Handle
    handle_ang = math.radians(45)
    h_start_x = lens_cx + lens_radius * math.cos(handle_ang)
    h_start_y = lens_cy + lens_radius * math.sin(handle_ang)
    h_len = int(320 * SCALE)
    h_end_x = h_start_x + h_len * math.cos(handle_ang)
    h_end_y = h_start_y + h_len * math.sin(handle_ang)
    
    # Handle body (thick metallic rod with neon power core)
    c.draw_glowing_line((h_start_x, h_start_y), (h_end_x, h_end_y), c.pri, width=22 * SCALE, glow_width=32 * SCALE)
    c.draw_glowing_line((h_start_x, h_start_y), (h_end_x, h_end_y), c.sec, width=8 * SCALE, glow_width=16 * SCALE)
    c.draw_glowing_circle(h_end_x, h_end_y, int(18 * SCALE), (255, 255, 255, 255), width=4 * SCALE)

    # 4. Digital Waveform Across the Bottom
    wave_y = CY + int(420 * SCALE)
    wave_pts = []
    for x in range(int(100 * SCALE), SW - int(100 * SCALE), int(15 * SCALE)):
        y = wave_y + int(math.sin(x * 0.015) * 35 * SCALE + math.cos(x * 0.04) * 20 * SCALE)
        wave_pts.append((x, y))
    for i in range(len(wave_pts) - 1):
        c.draw_glowing_line(wave_pts[i], wave_pts[i+1], c.sec, width=3 * SCALE, glow_width=10 * SCALE)

    return c.finish()


def create_misc_illustration():
    """Misc & AI: Cybernetic Neural Brain & Floating 4D Hypercube Tesseract"""
    c = CyberArtCanvas(
        pri_color=(244, 63, 94, 240),     # Neon Pink / Rose
        sec_color=(0, 255, 102, 220),     # Lime Green
        acc_color=(0, 240, 255, 255)      # Cyan
    )
    
    # 1. Background Synaptic Neural Network (Brain Constellation)
    # Generate symmetrical synaptic nodes
    brain_nodes = [
        # Left hemisphere
        (-80, -220), (-160, -180), (-240, -100), (-260, 20), (-220, 140), (-140, 220), (-60, 240),
        (-120, -100), (-160, 0), (-130, 100), (-60, -40), (-60, 60), (-60, 150),
        # Right hemisphere
        (80, -220), (160, -180), (240, -100), (260, 20), (220, 140), (140, 220), (60, 240),
        (120, -100), (160, 0), (130, 100), (60, -40), (60, 60), (60, 150),
    ]
    
    scaled_nodes = [(CX + nx * SCALE, CY + ny * SCALE) for nx, ny in brain_nodes]
    
    # Draw synaptic axon links between close nodes
    for i, p1 in enumerate(scaled_nodes):
        for j, p2 in enumerate(scaled_nodes):
            if i < j:
                dist = math.hypot(p1[0] - p2[0], p1[1] - p2[1])
                if dist < 210 * SCALE:
                    c.draw_glowing_line(p1, p2, c.pri, width=2 * SCALE, glow_width=8 * SCALE)
                    
    # Draw glowing synaptic neurons
    for px, py in scaled_nodes:
        c.draw_glowing_circle(px, py, int(11 * SCALE), c.acc, width=3 * SCALE, glow_width=12 * SCALE)
        c.draw_fg.ellipse((px - 5*SCALE, py - 5*SCALE, px + 5*SCALE, py + 5*SCALE), fill=(255, 255, 255, 255))

    # 2. Central Floating 4D Hypercube (Tesseract)
    # Outer cube vertices (isometric 3D)
    osize = int(180 * SCALE)
    isize = int(85 * SCALE)
    
    outer_v = [
        (CX - osize, CY - osize * 0.5),
        (CX, CY - osize),
        (CX + osize, CY - osize * 0.5),
        (CX + osize, CY + osize * 0.5),
        (CX, CY + osize),
        (CX - osize, CY + osize * 0.5),
    ]
    
    inner_v = [
        (CX - isize, CY - isize * 0.5),
        (CX, CY - isize),
        (CX + isize, CY - isize * 0.5),
        (CX + isize, CY + isize * 0.5),
        (CX, CY + isize),
        (CX - isize, CY + isize * 0.5),
    ]
    
    # Outer cube wireframe
    for i in range(6):
        c.draw_glowing_line(outer_v[i], outer_v[(i+1)%6], c.sec, width=5 * SCALE, glow_width=16 * SCALE)
    # Center y-struts
    c.draw_glowing_line(outer_v[1], (CX, CY), c.sec, width=4 * SCALE)
    c.draw_glowing_line(outer_v[3], (CX, CY), c.sec, width=4 * SCALE)
    c.draw_glowing_line(outer_v[5], (CX, CY), c.sec, width=4 * SCALE)
    
    # Inner cube wireframe
    for i in range(6):
        c.draw_glowing_line(inner_v[i], inner_v[(i+1)%6], (255, 255, 255, 255), width=4 * SCALE, glow_width=14 * SCALE)
        
    # Hyper-dimensional struts connecting outer to inner vertices
    for i in range(6):
        c.draw_glowing_line(outer_v[i], inner_v[i], c.acc, width=3 * SCALE, glow_width=10 * SCALE)

    # 3. Glowing Tesseract Quantum Core
    c.draw_glowing_circle(CX, CY, int(35 * SCALE), (255, 255, 255, 255), width=4 * SCALE, glow_width=24 * SCALE)
    c.draw_fg.ellipse((CX - 18*SCALE, CY - 18*SCALE, CX + 18*SCALE, CY + 18*SCALE), fill=c.pri)

    # 4. Orbital Particle Rings Around Tesseract
    for ring_r in [int(320 * SCALE), int(420 * SCALE)]:
        c.draw_glowing_circle(CX, CY, ring_r, c.sec, width=1 * SCALE, glow_width=6 * SCALE)

    return c.finish()


def create_blockchain_illustration():
    """Blockchain: 3D Isometric Crystal Blocks & Laser Chain Links"""
    c = CyberArtCanvas(
        pri_color=(59, 130, 246, 240),    # Neon Blue
        sec_color=(0, 255, 102, 220),     # Lime Green
        acc_color=(255, 255, 255, 255)
    )
    
    # Helper to draw an isometric 3D cube
    def draw_iso_block(bx, by, size, color_top, color_left, color_right, border_color):
        dx = int(size * math.cos(math.radians(30)))
        dy = int(size * math.sin(math.radians(30)))
        
        top_pts = [(bx, by - size), (bx + dx, by - dy), (bx, by), (bx - dx, by - dy)]
        left_pts = [(bx - dx, by - dy), (bx, by), (bx, by + size), (bx - dx, by + size - dy)]
        right_pts = [(bx, by), (bx + dx, by - dy), (bx + dx, by + size - dy), (bx, by + size)]
        
        c.draw_glowing_polygon(top_pts, fill_color=color_top, outline_color=border_color, width=4*SCALE, glow_width=14*SCALE)
        c.draw_glowing_polygon(left_pts, fill_color=color_left, outline_color=border_color, width=4*SCALE, glow_width=14*SCALE)
        c.draw_glowing_polygon(right_pts, fill_color=color_right, outline_color=border_color, width=4*SCALE, glow_width=14*SCALE)
        
        # Center glow node
        c.draw_fg.ellipse((bx - 12*SCALE, by - 12*SCALE, bx + 12*SCALE, by + 12*SCALE), fill=(255, 255, 255, 255))

    # 3 Floating blocks forming a chain
    b1_x, b1_y = CX - int(240 * SCALE), CY - int(120 * SCALE)
    b2_x, b2_y = CX, CY + int(40 * SCALE)
    b3_x, b3_y = CX + int(240 * SCALE), CY - int(120 * SCALE)
    
    # Laser chains connecting the blocks
    c.draw_glowing_line((b1_x, b1_y), (b2_x, b2_y), c.sec, width=8 * SCALE, glow_width=24 * SCALE)
    c.draw_glowing_line((b2_x, b2_y), (b3_x, b3_y), c.sec, width=8 * SCALE, glow_width=24 * SCALE)
    c.draw_glowing_line((b1_x, b1_y), (b3_x, b3_y), c.pri, width=4 * SCALE, glow_width=16 * SCALE)
    
    # Draw blocks
    draw_iso_block(b1_x, b1_y, int(110 * SCALE), (59, 130, 246, 80), (59, 130, 246, 50), (59, 130, 246, 60), c.pri)
    draw_iso_block(b3_x, b3_y, int(110 * SCALE), (59, 130, 246, 80), (59, 130, 246, 50), (59, 130, 246, 60), c.pri)
    # Center block (larger genesis block)
    draw_iso_block(b2_x, b2_y, int(150 * SCALE), (0, 255, 102, 100), (0, 255, 102, 60), (0, 255, 102, 80), c.sec)

    return c.finish()


def create_osint_illustration():
    """OSINT: Orbital Reconnaissance Satellite & Global Target Scanner"""
    c = CyberArtCanvas(
        pri_color=(249, 115, 22, 240),    # Neon Orange / Amber
        sec_color=(0, 240, 255, 220),     # Cyan
        acc_color=(255, 255, 255, 255)
    )
    
    # 1. Holographic Earth Globe Grid (Bottom Center)
    globe_cy = CY + int(320 * SCALE)
    globe_r = int(320 * SCALE)
    c.draw_glowing_circle(CX, globe_cy, globe_r, c.sec, width=3 * SCALE, glow_width=12 * SCALE)
    
    # Latitude lines
    for i in range(-3, 4):
        lat_r = int(globe_r * math.cos(math.radians(i * 22)))
        lat_y = globe_cy + int(globe_r * math.sin(math.radians(i * 22)))
        c.draw_fg.line([(CX - lat_r, lat_y), (CX + lat_r, lat_y)], fill=c.sec, width=2 * SCALE)
        
    # Longitude ellipse arcs
    for i in range(1, 4):
        ew = int(globe_r * (i / 4.0))
        c.draw_fg.ellipse((CX - ew, globe_cy - globe_r, CX + ew, globe_cy + globe_r), outline=c.sec, width=2 * SCALE)

    # 2. High-Tech Recon Satellite (Upper Center)
    sat_cx = CX
    sat_cy = CY - int(200 * SCALE)
    
    # Satellite Main Chassis (faceted bus)
    sat_w, sat_h = int(90 * SCALE), int(140 * SCALE)
    sat_rect = [
        (sat_cx - sat_w, sat_cy - sat_h),
        (sat_cx + sat_w, sat_cy - sat_h),
        (sat_cx + sat_w, sat_cy + sat_h),
        (sat_cx - sat_w, sat_cy + sat_h),
    ]
    c.draw_glowing_polygon(sat_rect, fill_color=(20, 25, 30, 240), outline_color=c.pri, width=5 * SCALE, glow_width=16 * SCALE)
    
    # Parabolic Dish Antenna pointed downward
    dish_cy = sat_cy + sat_h + int(50 * SCALE)
    dish_w = int(120 * SCALE)
    c.draw_glowing_polygon([
        (sat_cx - dish_w, dish_cy - int(30 * SCALE)),
        (sat_cx + dish_w, dish_cy - int(30 * SCALE)),
        (sat_cx, dish_cy + int(30 * SCALE)),
    ], fill_color=(249, 115, 22, 60), outline_color=c.pri, width=4 * SCALE)
    
    # Conical Radar Scan Beam from Dish to Globe
    c.draw_glowing_line((sat_cx, dish_cy + int(30 * SCALE)), (CX - int(180 * SCALE), globe_cy - int(120 * SCALE)), c.pri, width=2 * SCALE, glow_width=8 * SCALE)
    c.draw_glowing_line((sat_cx, dish_cy + int(30 * SCALE)), (CX + int(180 * SCALE), globe_cy - int(120 * SCALE)), c.pri, width=2 * SCALE, glow_width=8 * SCALE)
    
    # Dual Solar Arrays (Wings)
    wing_w = int(240 * SCALE)
    wing_h = int(100 * SCALE)
    # Left wing
    lw_x1 = sat_cx - sat_w - int(30 * SCALE) - wing_w
    lw_y1 = sat_cy - wing_h // 2
    c.draw_glowing_polygon([
        (lw_x1, lw_y1), (lw_x1 + wing_w, lw_y1),
        (lw_x1 + wing_w, lw_y1 + wing_h), (lw_x1, lw_y1 + wing_h)
    ], fill_color=(0, 240, 255, 45), outline_color=c.sec, width=3 * SCALE, glow_width=12 * SCALE)
    
    # Right wing
    rw_x1 = sat_cx + sat_w + int(30 * SCALE)
    rw_y1 = sat_cy - wing_h // 2
    c.draw_glowing_polygon([
        (rw_x1, rw_y1), (rw_x1 + wing_w, rw_y1),
        (rw_x1 + wing_w, rw_y1 + wing_h), (rw_x1, rw_y1 + wing_h)
    ], fill_color=(0, 240, 255, 45), outline_color=c.sec, width=3 * SCALE, glow_width=12 * SCALE)

    return c.finish()


def main():
    out_dir = "/home/hackertit/CODE_PROJECT/CTF_USTH/SuperBQA/apps/web/static/club/characters"
    os.makedirs(out_dir, exist_ok=True)
    
    print("[*] Generating Pure Graphical CTF Illustrations (NO CODE)...")
    
    tasks = [
        ("web.png", "anby.png", create_web_illustration),
        ("crypto.png", "miyabi.png", create_crypto_illustration),
        ("pwn.png", "billy.png", create_pwn_illustration),
        ("reverse.png", "ellen.png", create_reverse_illustration),
        ("forensics.png", "nicole.png", create_forensics_illustration),
        ("misc.png", "lycaon.png", create_misc_illustration),
        ("blockchain.png", None, create_blockchain_illustration),
        ("osint.png", None, create_osint_illustration),
    ]
    
    for modern_name, legacy_name, generator_fn in tasks:
        print(f"  -> Rendering {modern_name}...")
        img = generator_fn()
        modern_path = os.path.join(out_dir, modern_name)
        img.save(modern_path, "PNG", optimize=True)
        print(f"     Saved {modern_path} ({img.size[0]}x{img.size[1]})")
        
        if legacy_name:
            legacy_path = os.path.join(out_dir, legacy_name)
            shutil.copyfile(modern_path, legacy_path)
            print(f"     Mirrored to legacy alias {legacy_name}")
            
    print("[✓] All pure graphical CTF illustrations generated successfully!")

if __name__ == "__main__":
    main()
