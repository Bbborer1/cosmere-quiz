# Cosmere DM Quiz

A multiple-choice practice quiz for running the Cosmere RPG (Stormlight). Plain HTML/JS, no build step, works offline and installs to a phone home screen.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## How it works

- **Ratio:** every block of 4 questions is 2 Rules, 1 World, 1 Scenario, in shuffled order.
- **No repeats:** each category is dealt from a shuffled deck, which reshuffles once it's used up.
- **Missed questions:** a missed question comes back after about 3, then 8, then 20 more questions. It leaves the review list after 3 correct answers in a row.
- **Progress:** saved in `localStorage` on the device. The Stats screen has export and import for backups.

## Question bank

Questions live in `data/batches/*.json`. `tools/build.py` merges them into `data/questions.json` and validates them:

```bash
.venv/bin/python tools/build.py
```

Each question has a `verify` list of short phrases. The build checks that each phrase actually appears on the cited printed page (or the page after) of the extracted PDF text. That catches citation drift. The phrases aren't shipped to the app.

Page numbers are **printed** page numbers. They come from the PDFs' embedded page labels, which match the page footers.

### Rebuilding the extracted text

The source PDFs (`source/`) and the extracted text (`extract/`) are git-ignored, so book text never ends up in the repo.

```bash
python3 -m venv .venv && .venv/bin/pip install pymupdf pillow
.venv/bin/python tools/extract.py
.venv/bin/python tools/pages.py handbook 301 314   # read printed pages 301–314
```

### Content rules

Questions and explanations are paraphrased. Citations point to where the rule lives in the book; they never reproduce its text.

## Deploying

Any static host works over HTTPS (needed for offline/install), e.g. GitHub Pages. When you ship changes, bump `CACHE` in `sw.js` so phones pick up the new files.
