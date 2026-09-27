"""Export launcher icons from the vector brand mark, with an opaque background."""
from pathlib import Path
import re
import pymupdf

ROOT = Path(__file__).resolve().parent
source = (ROOT / 'favicon.svg').read_text(encoding='utf8')
mark = ''.join(re.findall(r'<path\b[^>]+/>', source))
for size, maskable in [(180, False), (192, False), (512, False), (512, True)]:
    # Android crops the full-bleed background; keep the mark inside its safe circle.
    transform = 'translate(5.76 5.76) scale(.82)' if maskable else ''
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#14263e"/><g transform="{transform}">{mark}</g></svg>'
    with pymupdf.open(stream=svg.encode(), filetype='svg') as vector:
        with pymupdf.open(stream=vector.convert_to_pdf(), filetype='pdf') as doc:
            pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(size / 64, size / 64), alpha=False)
            assert pix.width == pix.height == size and not pix.alpha
            name = f'maskable-{size}-v2.png' if maskable else f'icon-{size}-v2.png'
            pix.save(ROOT / 'icons' / name)
            assert pix.pixel(0, 0) == (20, 38, 62)
            if maskable:
                # Regression: old export had transparent cutouts inside the background.
                for y in range(size):
                    for x in range(size):
                        if pix.pixel(x, y) != (20, 38, 62):
                            assert (x - size/2)**2 + (y - size/2)**2 < (size*.4)**2
            print(name)
