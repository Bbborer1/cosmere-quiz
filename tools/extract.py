"""Extract per-page text from the source PDFs, tagged with printed page label and TOC section.

Output: extract/<book>.txt (human/grep friendly) and extract/<book>.json.
Run: .venv/bin/python tools/extract.py
"""
import json, re, fitz

BOOKS = {
    "handbook": "source/STC_Stormlight_Handbook_digital.pdf",
    "worldguide": "source/STC_Stormlight_World_Guide_digital.pdf",
    "welcome": "source/STC_Welcome_to_Roshar_digital.pdf",
}

def clean(s):
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()

for key, path in BOOKS.items():
    doc = fitz.open(path)
    toc = doc.get_toc()  # [level, title, 1-based pdf page]
    pages = []
    for i in range(doc.page_count):
        page = doc[i]
        label = page.get_label() or str(i + 1)
        # Deepest TOC entries starting at or before this page
        chapter = section = ""
        for lvl, title, pg in toc:
            if pg - 1 > i:
                break
            if lvl == 1:
                chapter, section = clean(title), ""
            elif lvl == 2:
                section = clean(title)
        pages.append({"pdf": i + 1, "page": label, "chapter": chapter,
                      "section": section, "text": page.get_text()})
    with open(f"extract/{key}.json", "w") as f:
        json.dump(pages, f, ensure_ascii=False)
    with open(f"extract/{key}.txt", "w") as f:
        for p in pages:
            f.write(f"\n\n===== [{key}] p.{p['page']} (pdf {p['pdf']}) | {p['chapter']} > {p['section']} =====\n")
            f.write(p["text"])
    print(key, len(pages), "pages")
