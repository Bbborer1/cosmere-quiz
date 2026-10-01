"""Draw the app icon: a faceted sapphire gem on a deep-blue field. Run: .venv/bin/python tools/make_icons.py"""
from PIL import Image, ImageDraw, ImageFilter

S = 1024
img = Image.new("RGB", (S, S), (11, 20, 36))

# soft radial glow behind the gem
glow = Image.new("L", (S, S), 0)
ImageDraw.Draw(glow).ellipse((S*0.18, S*0.18, S*0.82, S*0.82), fill=150)
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.09))
img.paste(Image.new("RGB", (S, S), (40, 110, 200)), (0, 0), glow)

d = ImageDraw.Draw(img)
cx, top, mid, bot = S/2, S*0.27, S*0.42, S*0.76
w_top, w_mid = S*0.15, S*0.25
# outline points of a cut gem (crown + pavilion), kept inside the maskable safe zone
L, R = cx - w_mid, cx + w_mid
TL, TR = cx - w_top, cx + w_top
facets = [
    ((TL, top), (TR, top), (cx, mid), (156, 214, 255)),          # table
    ((TL, top), (cx, mid), (L, mid), (95, 170, 245)),            # left crown
    ((TR, top), (R, mid), (cx, mid), (120, 190, 255)),           # right crown
    ((L, mid), (cx, mid), (cx, bot), (36, 98, 190)),             # left pavilion
    ((cx, mid), (R, mid), (cx, bot), (58, 128, 222)),            # right pavilion
]
for a, b, c, col in facets:
    d.polygon([a, b, c], fill=col)
edge = (210, 235, 255)
d.line([(TL, top), (TR, top), (R, mid), (cx, bot), (L, mid), (TL, top)], fill=edge, width=10, joint="curve")
d.line([(L, mid), (R, mid)], fill=edge, width=6)
d.line([(TL, top), (cx, mid), (TR, top)], fill=edge, width=5)
d.line([(cx, mid), (cx, bot)], fill=edge, width=5)
# topaz sparkle
sx, sy, r = S*0.69, S*0.28, S*0.06
d.polygon([(sx, sy-r), (sx+r*0.22, sy-r*0.22), (sx+r, sy), (sx+r*0.22, sy+r*0.22),
           (sx, sy+r), (sx-r*0.22, sy+r*0.22), (sx-r, sy), (sx-r*0.22, sy-r*0.22)], fill=(240, 196, 92))

for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
    img.resize((size, size), Image.LANCZOS).save(f"icons/{name}")
print("icons written")
