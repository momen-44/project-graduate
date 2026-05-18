from __future__ import annotations

import base64
import os
from typing import Any, List, Tuple

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None

try:
    import requests
except Exception:  # pragma: no cover
    requests = None

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

try:
    import tensorflow as tf
except Exception:  # pragma: no cover
    tf = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_CANDIDATES = [
    os.path.join(BASE_DIR, "mobilenetv2_fruit_vegetable_final.keras"),
    os.path.join(BASE_DIR, "mobilenetv2_fruit_vegetable_final.h5"),
]
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.txt")
UNKNOWN_LABEL = "unknown"
DEFAULT_PREDICTION_THRESHOLD = float(os.getenv("PREDICTION_THRESHOLD", "0.70"))

LOCAL_NUTRITION_DB = {
    "apple": {
        "calories": 52,
        "protein": 0.3,
        "carbs": 14.0,
        "fats": 0.2,
        "fiber": 2.4,
        "unit": "per 100g",
        "about": "A hydrating fruit with fiber and vitamin C that supports digestion and immunity.",
    },
    "banana": {
        "calories": 89,
        "protein": 1.1,
        "carbs": 22.8,
        "fats": 0.3,
        "fiber": 2.6,
        "unit": "per 100g",
        "about": "A potassium-rich fruit that provides quick energy and supports muscle function.",
    },
    "beetroot": {
        "calories": 43,
        "protein": 1.6,
        "carbs": 9.6,
        "fats": 0.2,
        "fiber": 2.8,
        "unit": "per 100g",
        "about": "A root vegetable high in folate and nitrates, often linked to better blood flow.",
    },
    "bell pepper": {
        "calories": 31,
        "protein": 1.0,
        "carbs": 6.0,
        "fats": 0.3,
        "fiber": 2.1,
        "unit": "per 100g",
        "about": "A crunchy vegetable rich in vitamin C and antioxidants with very low calories.",
    },
    "cabbage": {
        "calories": 25,
        "protein": 1.3,
        "carbs": 5.8,
        "fats": 0.1,
        "fiber": 2.5,
        "unit": "per 100g",
        "about": "A low-calorie cruciferous vegetable with fiber and vitamin K for gut and bone health.",
    },
    "capsicum": {
        "calories": 31,
        "protein": 1.0,
        "carbs": 6.0,
        "fats": 0.3,
        "fiber": 2.1,
        "unit": "per 100g",
        "about": "Another name for bell pepper, known for vitamin C and antioxidant compounds.",
    },
    "carrot": {
        "calories": 41,
        "protein": 0.9,
        "carbs": 9.6,
        "fats": 0.2,
        "fiber": 2.8,
        "unit": "per 100g",
        "about": "A root vegetable rich in beta-carotene that supports eye and skin health.",
    },
    "cauliflower": {
        "calories": 25,
        "protein": 1.9,
        "carbs": 5.0,
        "fats": 0.3,
        "fiber": 2.0,
        "unit": "per 100g",
        "about": "A versatile cruciferous vegetable with fiber and vitamin C, good for low-carb meals.",
    },
    "chilli pepper": {
        "calories": 40,
        "protein": 2.0,
        "carbs": 8.8,
        "fats": 0.4,
        "fiber": 1.5,
        "unit": "per 100g",
        "about": "A spicy pepper containing capsaicin, which may support metabolism and appetite control.",
    },
    "corn": {
        "calories": 86,
        "protein": 3.3,
        "carbs": 19.0,
        "fats": 1.4,
        "fiber": 2.0,
        "unit": "per 100g",
        "about": "A starchy vegetable that provides energy, fiber, and small amounts of B vitamins.",
    },
    "cucumber": {
        "calories": 15,
        "protein": 0.7,
        "carbs": 3.6,
        "fats": 0.1,
        "fiber": 0.5,
        "unit": "per 100g",
        "about": "A very hydrating vegetable with low calories, often used in weight-friendly meals.",
    },
    "eggplant": {
        "calories": 25,
        "protein": 1.0,
        "carbs": 5.9,
        "fats": 0.2,
        "fiber": 3.0,
        "unit": "per 100g",
        "about": "A fiber-rich vegetable with antioxidants, useful for filling and balanced dishes.",
    },
    "garlic": {
        "calories": 149,
        "protein": 6.4,
        "carbs": 33.0,
        "fats": 0.5,
        "fiber": 2.1,
        "unit": "per 100g",
        "about": "A flavor-packed bulb known for sulfur compounds that may support heart health.",
    },
    "ginger": {
        "calories": 80,
        "protein": 1.8,
        "carbs": 17.8,
        "fats": 0.8,
        "fiber": 2.0,
        "unit": "per 100g",
        "about": "A warming root commonly used to help digestion and reduce nausea.",
    },
    "grapes": {
        "calories": 69,
        "protein": 0.7,
        "carbs": 18.1,
        "fats": 0.2,
        "fiber": 0.9,
        "unit": "per 100g",
        "about": "A sweet fruit that contains antioxidants such as polyphenols and resveratrol.",
    },
    "jalepeno": {
        "calories": 30,
        "protein": 1.2,
        "carbs": 6.0,
        "fats": 0.4,
        "fiber": 1.2,
        "unit": "per 100g",
        "about": "A spicy green pepper that adds flavor with minimal calories.",
    },
    "kiwi": {
        "calories": 61,
        "protein": 1.1,
        "carbs": 14.7,
        "fats": 0.5,
        "fiber": 3.0,
        "unit": "per 100g",
        "about": "A vitamin C rich fruit with fiber that supports immunity and digestion.",
    },
    "lemon": {
        "calories": 29,
        "protein": 1.1,
        "carbs": 9.3,
        "fats": 0.3,
        "fiber": 2.8,
        "unit": "per 100g",
        "about": "A citrus fruit high in vitamin C, often used to boost flavor without many calories.",
    },
    "lettuce": {
        "calories": 15,
        "protein": 1.4,
        "carbs": 2.9,
        "fats": 0.2,
        "fiber": 1.3,
        "unit": "per 100g",
        "about": "A light leafy vegetable that adds volume and hydration to meals.",
    },
    "mango": {
        "calories": 60,
        "protein": 0.8,
        "carbs": 15.0,
        "fats": 0.4,
        "fiber": 1.6,
        "unit": "per 100g",
        "about": "A tropical fruit rich in vitamin A and C with naturally sweet taste.",
    },
    "onion": {
        "calories": 40,
        "protein": 1.1,
        "carbs": 9.3,
        "fats": 0.1,
        "fiber": 1.7,
        "unit": "per 100g",
        "about": "A common aromatic vegetable containing antioxidants and prebiotic fibers.",
    },
    "orange": {
        "calories": 47,
        "protein": 0.9,
        "carbs": 11.8,
        "fats": 0.1,
        "fiber": 2.4,
        "unit": "per 100g",
        "about": "A citrus fruit known for vitamin C and hydration support.",
    },
    "paprika": {
        "calories": 282,
        "protein": 14.1,
        "carbs": 54.0,
        "fats": 12.9,
        "fiber": 34.9,
        "unit": "per 100g (powder)",
        "about": "A dried pepper spice that is concentrated in flavor and antioxidants.",
    },
    "pear": {
        "calories": 57,
        "protein": 0.4,
        "carbs": 15.2,
        "fats": 0.1,
        "fiber": 3.1,
        "unit": "per 100g",
        "about": "A juicy fruit with soluble fiber that may support satiety and gut health.",
    },
    "peas": {
        "calories": 81,
        "protein": 5.4,
        "carbs": 14.5,
        "fats": 0.4,
        "fiber": 5.7,
        "unit": "per 100g",
        "about": "A legume vegetable with relatively high plant protein and fiber.",
    },
    "pineapple": {
        "calories": 50,
        "protein": 0.5,
        "carbs": 13.1,
        "fats": 0.1,
        "fiber": 1.4,
        "unit": "per 100g",
        "about": "A tropical fruit with vitamin C and bromelain enzymes.",
    },
    "pomegranate": {
        "calories": 83,
        "protein": 1.7,
        "carbs": 18.7,
        "fats": 1.2,
        "fiber": 4.0,
        "unit": "per 100g",
        "about": "A fruit rich in polyphenol antioxidants linked to heart-friendly benefits.",
    },
    "potato": {
        "calories": 77,
        "protein": 2.0,
        "carbs": 17.5,
        "fats": 0.1,
        "fiber": 2.2,
        "unit": "per 100g",
        "about": "A staple starchy vegetable that provides energy and potassium.",
    },
    "raddish": {
        "calories": 16,
        "protein": 0.7,
        "carbs": 3.4,
        "fats": 0.1,
        "fiber": 1.6,
        "unit": "per 100g",
        "about": "A crunchy root vegetable with a peppery taste and very low calories.",
    },
    "soy beans": {
        "calories": 173,
        "protein": 17.0,
        "carbs": 9.9,
        "fats": 9.0,
        "fiber": 5.0,
        "unit": "per 100g (fresh)",
        "about": "A high-protein legume rich in healthy fats and micronutrients.",
    },
    "spinach": {
        "calories": 23,
        "protein": 2.9,
        "carbs": 3.6,
        "fats": 0.4,
        "fiber": 2.2,
        "unit": "per 100g",
        "about": "A leafy green rich in folate, iron, and vitamin K.",
    },
    "sweetcorn": {
        "calories": 86,
        "protein": 3.3,
        "carbs": 19.0,
        "fats": 1.4,
        "fiber": 2.0,
        "unit": "per 100g",
        "about": "Sweet corn kernels that provide carbohydrates, fiber, and carotenoids.",
    },
    "sweetpotato": {
        "calories": 86,
        "protein": 1.6,
        "carbs": 20.1,
        "fats": 0.1,
        "fiber": 3.0,
        "unit": "per 100g",
        "about": "A nutrient-dense root rich in beta-carotene and complex carbohydrates.",
    },
    "tomato": {
        "calories": 18,
        "protein": 0.9,
        "carbs": 3.9,
        "fats": 0.2,
        "fiber": 1.2,
        "unit": "per 100g",
        "about": "A low-calorie fruit vegetable rich in lycopene and vitamin C.",
    },
    "turnip": {
        "calories": 28,
        "protein": 0.9,
        "carbs": 6.4,
        "fats": 0.1,
        "fiber": 1.8,
        "unit": "per 100g",
        "about": "A mild root vegetable with vitamin C and fiber for everyday meals.",
    },
    "watermelon": {
        "calories": 30,
        "protein": 0.6,
        "carbs": 7.6,
        "fats": 0.2,
        "fiber": 0.4,
        "unit": "per 100g",
        "about": "A highly hydrating fruit with refreshing taste and low calorie density.",
    },
}

LABEL_ALIASES = {
    "bellpepper": "bell pepper",
    "chili pepper": "chilli pepper",
    "chilipepper": "chilli pepper",
    "chillipepper": "chilli pepper",
    "jalapeno": "jalepeno",
    "radish": "raddish",
    "soybeans": "soy beans",
    "sweet corn": "sweetcorn",
    "sweet potato": "sweetpotato",
}

app = Flask(__name__)
CORS(app)


def load_class_names(path: str) -> List[str]:
    if not os.path.exists(path):
        return list(LOCAL_NUTRITION_DB.keys())

    with open(path, "r", encoding="utf-8") as f:
        names = [line.strip() for line in f if line.strip()]

    return names or list(LOCAL_NUTRITION_DB.keys())


def load_model(paths: List[str]):
    if tf is None:
        return None

    for path in paths:
        if not os.path.exists(path):
            continue

        try:
            return tf.keras.models.load_model(path)
        except Exception:
            continue

    return None


CLASS_NAMES = load_class_names(CLASS_NAMES_PATH)
MODEL = load_model(MODEL_CANDIDATES)


def preprocess_image(img: Any):
    if np is None:
        raise RuntimeError("numpy is not installed")

    img = img.convert("RGB").resize((224, 224))
    arr = np.array(img, dtype="float32") / 255.0
    return np.expand_dims(arr, axis=0)


def fallback_prediction() -> Tuple[str, float]:
    return "Unknown Food", 0.0


def is_prediction_accepted(confidence: float, threshold: float) -> bool:
    return confidence >= threshold


def normalize_label(label: str) -> str:
    normalized = label.strip().lower().replace("_", " ").replace("-", " ")
    normalized = " ".join(normalized.split())
    normalized = LABEL_ALIASES.get(normalized, normalized)

    if normalized in LOCAL_NUTRITION_DB:
        return normalized

    compact = normalized.replace(" ", "")
    return LABEL_ALIASES.get(compact, normalized)


def resolve_nutrition(label: str):
    canonical_label = normalize_label(label)
    nutrition = LOCAL_NUTRITION_DB.get(canonical_label)

    if nutrition is None:
        return None, None

    return canonical_label, nutrition


def build_prediction_response(label: str, confidence: float):
    canonical_label, nutrition = resolve_nutrition(label)

    response = {
        "label": canonical_label or label,
        "confidence": confidence,
        "nutrition": nutrition,
        "nutritionSource": "local-nutrition-db" if nutrition else None,
    }

    if nutrition is None:
        response["warning"] = "Nutrition data not found for this label."

    return response


@app.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "modelLoaded": MODEL is not None,
            "classes": len(CLASS_NAMES),
            "predictionThreshold": DEFAULT_PREDICTION_THRESHOLD,
        }
    )


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    uploaded_file = request.files.get("file")
    image_url = payload.get("image_url")
    image_base64 = payload.get("image_base64")

    if uploaded_file is None and not image_url and not image_base64:
        return jsonify({"error": "image_url, image_base64, or file is required"}), 400

    if Image is None or np is None:
        label, confidence = fallback_prediction()
        payload = build_prediction_response(label, confidence)
        payload.update({
            "fallback": True,
            "reason": "Missing runtime packages",
        })
        return jsonify(payload)

    try:
        from io import BytesIO

        if uploaded_file is not None:
            img = Image.open(uploaded_file.stream)
        elif image_base64:
            image_bytes = base64.b64decode(image_base64)
            img = Image.open(BytesIO(image_bytes))
        else:
            if requests is None:
                raise RuntimeError("requests is not installed")

            response = requests.get(image_url, timeout=15)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))

        batch = preprocess_image(img)

        if MODEL is None:
            label, confidence = fallback_prediction()
            payload = build_prediction_response(label, confidence)
            payload.update({
                "fallback": True,
                "reason": "Model file is missing or failed to load",
            })
            return jsonify(payload)

        preds = MODEL.predict(batch, verbose=0)[0]
        index = int(preds.argmax())
        confidence = float(preds[index])
        label = CLASS_NAMES[index] if index < len(CLASS_NAMES) else CLASS_NAMES[0]

        if not is_prediction_accepted(confidence, DEFAULT_PREDICTION_THRESHOLD):
            payload = build_prediction_response(UNKNOWN_LABEL, confidence)
            payload.update(
                {
                    "accepted": False,
                    "success": True,
                    "threshold": DEFAULT_PREDICTION_THRESHOLD,
                    "reason": "Low confidence prediction",
                }
            )
            return jsonify(payload)

        payload = build_prediction_response(label, confidence)
        payload.update(
            {
                "accepted": True,
                "success": True,
                "threshold": DEFAULT_PREDICTION_THRESHOLD,
            }
        )
        return jsonify(payload)
    except Exception as exc:
        label, confidence = fallback_prediction()
        payload = build_prediction_response(label, confidence)
        payload.update({
            "fallback": True,
            "reason": str(exc),
        })
        return jsonify(payload)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=True)
