"""Vectoriza las máscaras alfa de los logos de YKONO extraídos de los PDF de referencia."""
import sys, json
import numpy as np
from PIL import Image
import potrace

def trace(mask_path, upscale=4, crop=True):
    img = Image.open(mask_path).convert("L")
    if crop:
        bbox = img.point(lambda v: 255 if v > 40 else 0).getbbox()
        img = img.crop(bbox)
    w, h = img.size
    img = img.resize((w * upscale, h * upscale), Image.LANCZOS)
    arr = np.array(img) <= 127
    bmp = potrace.Bitmap(arr)
    path = bmp.trace(turdsize=8, alphamax=1.0, opticurve=True, opttolerance=0.2)
    parts = []
    for curve in path:
        sp = curve.start_point
        d = [f"M{sp.x:.1f} {sp.y:.1f}"]
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f"L{seg.c.x:.1f} {seg.c.y:.1f}L{seg.end_point.x:.1f} {seg.end_point.y:.1f}")
            else:
                d.append(
                    f"C{seg.c1.x:.1f} {seg.c1.y:.1f} {seg.c2.x:.1f} {seg.c2.y:.1f} {seg.end_point.x:.1f} {seg.end_point.y:.1f}"
                )
        d.append("Z")
        parts.append("".join(d))
    return {"width": w * upscale, "height": h * upscale, "d": " ".join(parts)}

out = {}
for name, path in json.loads(sys.argv[1]).items():
    out[name] = trace(path)
    print(name, out[name]["width"], out[name]["height"], len(out[name]["d"]), file=sys.stderr)
json.dump(out, open(sys.argv[2], "w"))
