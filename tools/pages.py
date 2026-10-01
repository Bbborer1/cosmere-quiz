"""Print extracted text for a printed-page range. Usage: pages.py handbook 7 14"""
import json, re, sys
book, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
for p in json.load(open(f"extract/{book}.json")):
    if p["page"].isdigit() and a <= int(p["page"]) <= b:
        t = re.sub(r"[ \t]*\n[ \t]*", " ", p["text"].replace("\xa0", " "))
        t = re.sub(r"-\s(?=[a-z])", "-", t)
        print(f"\n### p.{p['page']} | {p['chapter']} > {p['section']}\n{re.sub(r' {2,}', ' ', t).strip()}")
