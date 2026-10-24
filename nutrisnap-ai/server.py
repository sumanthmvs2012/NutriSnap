import base64
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

from PIL import Image
from transformers import pipeline

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
FOODS_FILE = ROOT / "foods.json"
MAX_IMAGE_BYTES = 7 * 1024 * 1024
MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
LOW_CONFIDENCE = 40.0

# Food-specific model (downloads on first run)
classifier = pipeline("image-classification", model="nateraw/food")

DEFAULT_FOOD = {
    "serving_g": 200, "kcal": 150, "protein": 6, "carbs": 20, "fat": 5,
    "ingredients": ["ingredients could not be determined"],
}


def load_foods():
    """Read the food table on every request so edits to foods.json apply without a restart."""
    try:
        with open(FOODS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Could not read foods.json: {exc}")
        return {}


def clean_label(label):
    return label.lower().replace("_", " ").split(",")[0].strip()


def estimate_nutrition(food_name):
    """Scale per-100g values to a typical serving."""
    foods = load_foods()
    key = clean_label(food_name)
    known = key in foods
    item = foods.get(key, DEFAULT_FOOD)
    factor = item["serving_g"] / 100
    return {
        "known": known,
        "weight": item["serving_g"],
        "calories": round(item["kcal"] * factor),
        "protein": round(item["protein"] * factor, 1),
        "carbs": round(item["carbs"] * factor, 1),
        "fat": round(item["fat"] * factor, 1),
        "ingredients": item["ingredients"],
    }


def health_verdict(n):
    if not n["known"]:
        return "Unknown", "No nutrition data for this food, so no rating is possible. Enter values manually."

    notes = []
    if n["calories"] > 600:
        notes.append("high in calories")
    if n["fat"] > 25:
        notes.append("high in fat")
    if n["carbs"] > 60:
        notes.append("high in carbs")
    if n["protein"] >= 20:
        notes.append("a good protein source")

    if n["calories"] > 600 or n["fat"] > 25:
        return "Not so good", "This serving is " + ", ".join(notes) + ". Eat it occasionally."
    if n["protein"] >= 15 or n["calories"] <= 250:
        extra = f" ({', '.join(notes)})" if notes else ""
        return "Good", "A balanced, reasonable choice" + extra + "."
    return "Okay", "Fine in moderation as part of a balanced day."


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self):
        # Stop the browser from caching old files
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(200, {"ok": True})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/analyze":
            self.send_json(404, {"error": "Unknown endpoint."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_IMAGE_BYTES * 2:
                raise ValueError("Choose an image smaller than 7 MB.")

            payload = json.loads(self.rfile.read(length))
            mime_type = payload.get("mimeType", "")
            image_data = payload.get("data", "")

            if mime_type not in MIME_TYPES:
                raise ValueError("Choose a JPG, PNG, or WebP photo.")

            image_bytes = base64.b64decode(image_data, validate=True)
            if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
                raise ValueError("Choose an image smaller than 7 MB.")
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc) or "The image could not be read."})
            return

        try:
            image = Image.open(BytesIO(image_bytes)).convert("RGB")
            predictions = classifier(image, top_k=3)
            top = predictions[0]
        except Exception as exc:
            print(f"Analysis error: {exc}")
            self.send_json(500, {"error": "Could not analyze the image."})
            return

        name = clean_label(top["label"]).title()
        confidence = round(top["score"] * 100, 1)
        nutrition = estimate_nutrition(top["label"])
        verdict, verdict_note = health_verdict(nutrition)

        assumptions = "Weight and nutrition are estimates for one typical serving, not measured from the photo."
        if confidence < LOW_CONFIDENCE:
            assumptions = (
                "The match is weak; this may be a dish the model does not know. "
                "Check the name and edit the values before saving. " + assumptions
            )

        self.send_json(200, {
            "name": name,
            "description": f"Detected with {confidence}% confidence",
            "estimated_calories": nutrition["calories"],
            "protein_g": nutrition["protein"],
            "carbs_g": nutrition["carbs"],
            "fat_g": nutrition["fat"],
            "estimated_weight_g": nutrition["weight"],
            "ingredients": nutrition["ingredients"],
            "health_verdict": verdict,
            "health_note": verdict_note,
            "alternatives": [clean_label(p["label"]).title() for p in predictions[1:]],
            "confidence": "high" if confidence > 80 else "medium" if confidence > 50 else "low",
            "assumptions": assumptions,
            "needs_confirmation": True,
        })

    def send_json(self, status, data):
        raw = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4173"))
    print(f"NutriSnap running at http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()