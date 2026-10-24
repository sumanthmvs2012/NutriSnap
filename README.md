# NutriSnap
Creation of NutriCal app

# NutriSnap AI

A local nutrition tracker prototype with a photo upload flow. The photo-analysis path sends the selected image from the browser to a local Python server, which calls the Gemini API. Keep the Gemini API key on the server side; never put it in `public/app.js`, `index.html`, or another browser file.

## Project layout

```text
nutrisnap-ai/
├── README.md
├── server.py
└── public/
    ├── index.html
    ├── app.js
    ├── styles.css
    └── ...
```

Place `server.py` beside `public`, not inside `public`. Put this README in the same project root.

## Current progress and known issue

The uploaded `server.py` serves the `public` directory on port `4173`, exposes `GET /api/health`, and accepts photo-analysis requests at `POST /api/analyze`. It gets the API key from the `GEMINI_API_KEY` environment variable. The configured model is `gemini-3.8-flash`, which Google lists as a Gemini API model in its [official model guide](https://ai.google.dev/gemini-api/docs/models).

The uploaded `public/app.js` calls `$()` several times but does not define `$`. This causes a JavaScript error before the photo button and file input handlers can be attached. Fix this before testing Gemini. The uploaded `index.html` still has a `DEMO MODE` badge and a sample-scan button; those labels are static and do not prove whether the Gemini connection works.

## Fix the JavaScript startup error

1. Open `public/app.js` in VS Code.
2. Add this line at the very top, before `let selectedPhoto = null;`:

   ```javascript
   const $ = (id) => document.getElementById(id);
   ```

3. Save with **Ctrl+S**.
4. In the browser, hard-refresh the page with **Ctrl+Shift+R**.

The photo input accepts JPG, PNG, and WebP images up to 7 MB. After selecting one, the button should read **Analyze this photo**.

## Set the Gemini key and run locally (Windows PowerShell)

Do not paste the key into this README, chat, or any website file. In the PowerShell terminal opened at the folder containing `server.py`, set it for that terminal session:

```powershell
$keySecure = Read-Host "Paste your Gemini API key" -AsSecureString
$env:GEMINI_API_KEY = [System.Net.NetworkCredential]::new("", $keySecure).Password
py server.py
```

If the server is already running in that terminal, press **Ctrl+C** first. Keep the terminal open while testing; closing it removes the temporary environment value. On startup it should print `NutriSnap running at http://localhost:4173`.

Open `http://localhost:4173` on the same computer. First check `http://localhost:4173/api/health`; a working server returns `{"ok": true}`. Then hard-refresh, choose a food photo, and click **Analyze this photo**. The terminal should log a `POST /api/analyze` request.

## Troubleshooting

- **`py server.py` says the file cannot be found:** use `cd` to enter the inner `nutrisnap-ai` directory that contains both `server.py` and `public`; run `dir server.py` before starting it.
- **Page loads but the photo button does nothing:** confirm the `$` helper is at the top of `public/app.js`, save, hard-refresh, and check the browser developer console for JavaScript errors.
- **The page still shows DEMO MODE:** that badge is hard-coded in the uploaded `public/index.html`. Check whether selecting a photo changes the button to **Analyze this photo**; the badge alone does not diagnose the API connection.
- **The server says the key is missing:** set `$env:GEMINI_API_KEY` in the same PowerShell window, then restart `py server.py` there.
- **Gemini rejects the request:** verify the key and project in Google AI Studio. Do not share the key in a screenshot; redact it before sharing terminal output.
- **The page shows a useful error:** copy the exact error text and any new server message, with secrets removed.

Nutrition values from a photo are estimates, not medical advice. Images may not reveal serving weight, recipe, or hidden ingredients.

## Future updates: keep this README current

Whenever the project changes, add a dated entry under **Update history** describing:

- files changed and what changed;
- any new setup command or environment variable (never include its secret value);
- how to run or test the change;
- the confirmed result and any remaining error.

Use this format:

```text
### YYYY-MM-DD — Short change name
- Changed: `path/to/file` — what changed.
- Setup: command or setting needed (no secret values).
- Test: steps performed.
- Result: what worked or the exact remaining error.
```

## Update history

### 2026-10-05 — Project structure checked
- Confirmed the working project folder is `NutriSnap-AI/nutrisnap-ai/`.
- `server.py` is beside the `public/` folder, so the server’s folder layout is correct.
- `public/app.js` already starts with the `$` helper.
- Keep the project README in `NutriSnap-AI/nutrisnap-ai/`, beside `server.py`. The README in the outer folder is separate.
- Next test: run `py server.py` from the inner `nutrisnap-ai` folder, check `/api/health`, then select a photo and click **Analyze this photo**. If it fails, note the app error and the PowerShell output.

### 2026-10-05, 6:03 AM (America/Chicago) — Local analysis check
- `GET /api/health` returned `200`, confirming the local server is running.
- The terminal output shared so far contains no `POST /api/analyze`.
- The browser showed a sample result; the `DEMO MODE` badge is static page text.
- Next: clear the old site/service-worker data in Chrome, hard reload `http://localhost:4173`, choose a photo, and click **Analyze this photo**. Check PowerShell for `POST /api/analyze`.

### 2026-10-06, 1:07 AM (America/Chicago) — Gemini 503 investigation
- Inspected the latest project ZIP. `public/app.js` already defines the `$` helper and sends selected photos to `/api/analyze`.
- Confirmed `gemini-3.8-flash` is a supported model with image input.
- The reported HTTP 503 means Gemini was temporarily unavailable; the current server made one attempt and did not retry.
- Prepared and tested a `server.py` change with up to 3 retries and exponential backoff. Mock tests confirmed recovery after temporary 503 responses and a stop after 4 total attempts.
- Next: apply the change to the inner project's `server.py`, restart the server in the same PowerShell window, then test a photo again. A real Gemini retest is still needed.

### 2026-10-07, 12:50 AM (America/Chicago) — Photo-analysis test plan
- The current flow sends a selected photo to Gemini and displays its food and nutrition estimate.
- Test one clear food photo with one click. A successful request should show the result fields and a `POST /api/analyze` response of `200`.
- A successful scan confirms the connection, not nutrition accuracy. Compare a known serving with its package label; photos may not reveal portion size or hidden ingredients.
- Next logic gap: the current JavaScript fills the meal form but does not save the meal to the daily log.
- Planned next steps: save reviewed meals locally, ask the user to confirm serving size, then use a food database for nutrition lookup.


## Update history

### 2026-10-15 

# NutriSnap AI

A local nutrition tracker. Photos are sent from the browser to a local Python server, which classifies the food with a Hugging Face model (`nateraw/food`) running on your computer. No API key is required.

## Run locally (Windows PowerShell)

```powershell
cd C:\Users\suman\Downloads\NutriSnap-AI\nutrisnap-ai
pip install transformers pillow torch torchvision
py server.py
```

Open `http://localhost:4173`. The first run downloads the model.

## Update history

### 2026-10-15 — Switched from Gemini to Hugging Face
- Changed: `server.py` — local `nateraw/food` classifier, label normalization, correct error codes.
- Changed: `public/app.js` — meal log, water counter, dialog handlers.
- Changed: `public/sw.js` — network-first caching.
- Result: Gemini removed (it returned HTTP 404/503).

Date- 24th Oct 2026
<!-- filepath: /c:/Users/suman/Downloads/NutriSnap-AI/nutrisnap-ai/README.md -->
# NutriSnap AI

A local nutrition tracker. The browser sends a photo to a local Python server, which classifies the food with a Hugging Face model (`nateraw/food`) running on your computer. No API key is required.

## Project layout

```text
nutrisnap-ai/
├── README.md
├── server.py
├── foods.json      # nutrition data, edit to add dishes
└── public/
```

## Run (Windows PowerShell)

```powershell
cd C:\Users\suman\Downloads\NutriSnap-AI\nutrisnap-ai
pip install transformers pillow torch torchvision
py server.py
```

Open `http://localhost:4173`. The first run downloads the model.

## Add a new dish

Add an entry to `foods.json` (values per 100 g plus a typical serving). No restart needed. The model can only recognize its 101 Food-101 classes, so a dish outside them is matched to the nearest one.

## Limits

Weight is a typical serving, ingredients are the standard recipe, and all values are estimates, not medical advice.

## Update history

### 2026-10-24 — Data moved to foods.json
- Changed: `server.py` reads `foods.json`, adds weight, ingredients, health verdict, low-confidence warning.
- Changed: `public/app.js` shows new fields and removes a stray line that broke the meal log.
- Changed: `public/index.html` removed `method="dialog"`.
- Earlier: Gemini removed (HTTP 404/503), replaced by local Hugging Face model.
