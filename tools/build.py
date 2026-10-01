"""Merge data/batches/*.json into data/questions.json and validate.

Checks: schema, unique ids, distinct choices, answer index, that each `verify`
phrase appears on the cited printed page (or the page after, for text that wraps),
and the category ratio. Run: .venv/bin/python tools/build.py
"""
import glob, json, re, sys
from collections import Counter

BOOKS = {"handbook", "worldguide"}
CATS = {"rules", "world", "scenario"}

def norm(s):
    s = s.replace("\xa0", " ").replace("’", "'").replace("“", '"').replace("”", '"').replace("­", "")
    s = re.sub(r"-\s*\n\s*", "", s)
    return re.sub(r"\s+", " ", s).lower()

pages = {}
for book in BOOKS:
    for p in json.load(open(f"extract/{book}.json")):
        pages[(book, p["page"])] = norm(p["text"])

def page_text(book, page):
    t = pages.get((book, str(page)), "")
    if str(page).isdigit():
        t += " " + pages.get((book, str(int(page) + 1)), "")
    return t

qs, errors, ids = [], [], set()
for f in sorted(glob.glob("data/batches/*.json")):
    for q in json.load(open(f)):
        where = f"{f}:{q.get('id')}"
        for k in ("id", "category", "topic", "question", "choices", "answer", "explanation", "cite"):
            if k not in q: errors.append(f"{where} missing {k}")
        if q["id"] in ids: errors.append(f"{where} duplicate id")
        ids.add(q["id"])
        if q["category"] not in CATS: errors.append(f"{where} bad category")
        if len(q["choices"]) != 4 or len(set(q["choices"])) != 4: errors.append(f"{where} needs 4 distinct choices")
        if not 0 <= q["answer"] < len(q["choices"]): errors.append(f"{where} bad answer index")
        c = q["cite"]
        if c["book"] not in BOOKS: errors.append(f"{where} bad book")
        text = page_text(c["book"], c["page"])
        if not text: errors.append(f"{where} page {c['page']} not found")
        for v in q.get("verify", []):
            if norm(v) not in text: errors.append(f"{where} verify phrase not on p.{c['page']}: {v!r}")
        if not q.get("verify"): errors.append(f"{where} has no verify phrase")
        qs.append({k: q[k] for k in ("id", "category", "topic", "question", "choices", "answer", "explanation", "cite")})

counts = Counter(q["category"] for q in qs)
print(f"{len(qs)} questions:", dict(counts))
print("answer positions:", dict(Counter(q["answer"] for q in qs)))
if errors:
    print("\n".join(errors)); sys.exit(1)
json.dump({"questions": qs}, open("data/questions.json", "w"), ensure_ascii=False, indent=1)
print("wrote data/questions.json")
