"""Render the share card from the existing vector mark and editable typography."""
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'social'
OUT.mkdir(exist_ok=True)
doc = pymupdf.open()
page = doc.new_page(width=1200, height=630)
navy = (20/255, 38/255, 62/255)
cyan = (112/255, 214/255, 238/255)
white = (0.96, 0.98, 1)
muted = (0.66, 0.75, 0.85)
page.draw_rect(page.rect, color=navy, fill=navy)
for radius in [150, 220, 290]:
    page.draw_circle((1060, 310), radius, color=(0.14, 0.24, 0.35), width=1)
page.draw_line((0, 570), (1200, 570), color=(0.2, 0.31, 0.42))
fonts = Path('C:/Windows/Fonts')
page.insert_font(fontname='regular', fontfile=str(fonts/'segoeui.ttf'))
page.insert_font(fontname='bold', fontfile=str(fonts/'segoeuib.ttf'))
def text(x, y, value, size, color=white, bold=False):
    page.insert_text((x,y), value, fontname='bold' if bold else 'regular', fontsize=size, color=color)
text(64, 100, 'PilotSpace', 46, bold=True)
text(64, 209, 'Тренажёр ЧЛЭ', 64, bold=True)
text(64, 289, 'для пилотов', 64, bold=True)
text(66, 355, 'Готовьтесь в своём темпе.', 28, muted)
text(66, 396, 'Даже без интернета.', 28, muted)
text(66, 494, 'Бесплатно  ·  Без регистрации', 25, cyan)
text(66, 609, 'pilotspace.ru', 22, muted)
text(793, 609, 'Учиться с комфортом', 22, muted)
with pymupdf.open(ROOT/'favicon.svg') as vector:
    with pymupdf.open(stream=vector.convert_to_pdf(), filetype='pdf') as logo:
        page.show_pdf_page(pymupdf.Rect(848, 182, 1120, 454), logo, 0)
page.get_pixmap(alpha=False).save(OUT/'pilotspace-share-v1.png')
doc.close()
print(OUT/'pilotspace-share-v1.png')
