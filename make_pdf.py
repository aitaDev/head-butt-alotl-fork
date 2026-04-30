from pathlib import Path

src = Path('mob_guide.txt').read_text()
lines = []
for raw in src.splitlines():
    if not raw:
        lines.append('')
        continue
    text = raw
    while len(text) > 95:
        cut = text.rfind(' ', 0, 95)
        if cut <= 0:
            cut = 95
        lines.append(text[:cut])
        text = text[cut:].lstrip()
    lines.append(text)

pages = []
page = []
for line in lines:
    if len(page) >= 48:
        pages.append(page)
        page = []
    page.append(line)
if page:
    pages.append(page)

objects = []

def add_obj(data: bytes):
    objects.append(data)
    return len(objects)

font_id = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
page_ids = []
content_ids = []

for page_lines in pages:
    content = [b"BT\n/F1 10 Tf\n50 790 Td\n12 TL\n"]
    first = True
    for line in page_lines:
        safe = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        if first:
            content.append(f"({safe}) Tj\n".encode())
            first = False
        else:
            content.append(b"T*\n")
            content.append(f"({safe}) Tj\n".encode())
    content.append(b"ET\n")
    content_bytes = b''.join(content)
    content_id = add_obj(f"<< /Length {len(content_bytes)} >>\nstream\n".encode() + content_bytes + b"endstream")
    content_ids.append(content_id)
    page_id = add_obj(b"")
    page_ids.append(page_id)

pages_kids = ' '.join(f'{pid} 0 R' for pid in page_ids)
pages_id = add_obj(f"<< /Type /Pages /Kids [{pages_kids}] /Count {len(page_ids)} >>".encode())

for idx, page_id in enumerate(page_ids):
    page_obj = f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_ids[idx]} 0 R >>".encode()
    objects[page_id - 1] = page_obj

catalog_id = add_obj(f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode())

pdf = bytearray(b"%PDF-1.4\n")
offsets = [0]
for i, obj in enumerate(objects, start=1):
    offsets.append(len(pdf))
    pdf.extend(f"{i} 0 obj\n".encode())
    pdf.extend(obj)
    pdf.extend(b"\nendobj\n")

xref_pos = len(pdf)
pdf.extend(f"xref\n0 {len(objects)+1}\n".encode())
pdf.extend(b"0000000000 65535 f \n")
for off in offsets[1:]:
    pdf.extend(f"{off:010d} 00000 n \n".encode())
pdf.extend(f"trailer\n<< /Size {len(objects)+1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode())

Path('mob_guide.pdf').write_bytes(pdf)
print('wrote mob_guide.pdf')
