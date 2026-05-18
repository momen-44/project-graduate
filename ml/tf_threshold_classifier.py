from __future__ import annotations

import json
import os
from typing import List, Tuple

import numpy as np
import tensorflow as tf
from PIL import Image


UNKNOWN_MESSAGE = "Unknown object (confidence below threshold)"


def load_class_names(class_names_path: str) -> List[str]:
    """Load class names from a text file (one class per line)."""
    if not os.path.exists(class_names_path):
        raise FileNotFoundError(f"Class names file not found: {class_names_path}")

    with open(class_names_path, "r", encoding="utf-8") as f:
        classes = [line.strip() for line in f if line.strip()]

    if not classes:
        raise ValueError("Class names file is empty.")

    return classes


def load_tf_model(model_path: str) -> tf.keras.Model:
    """Load a TensorFlow/Keras model from .h5 or .keras."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")

    if not (model_path.endswith(".h5") or model_path.endswith(".keras")):
        raise ValueError("TensorFlow model must be .h5 or .keras")

    return tf.keras.models.load_model(model_path)


def preprocess_image(image_path: str, target_size: Tuple[int, int] = (224, 224)) -> np.ndarray:
    """Read image from disk and convert it to a normalized model input tensor."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = Image.open(image_path).convert("RGB")
    image = image.resize(target_size)
    arr = np.array(image, dtype="float32") / 255.0
    return np.expand_dims(arr, axis=0)


def predict_with_threshold(
    model: tf.keras.Model,
    class_names: List[str],
    image_path: str,
    threshold: float = 0.70,
    target_size: Tuple[int, int] = (224, 224),
) -> dict:
    """
    Predict one image and reject unknown objects if max confidence is below threshold.

    Returns a dictionary with:
    - accepted: bool
    - label: predicted class or unknown message
    - confidence: max confidence (0..1)
    """
    if not 0 <= threshold <= 1:
        raise ValueError("threshold must be between 0 and 1")

    batch = preprocess_image(image_path=image_path, target_size=target_size)
    probs = model.predict(batch, verbose=0)[0]

    if len(probs) != len(class_names):
        raise ValueError(
            f"Output classes ({len(probs)}) do not match class_names ({len(class_names)})"
        )

    best_idx = int(np.argmax(probs))
    best_conf = float(probs[best_idx])

    if best_conf >= threshold:
        return {
            "accepted": True,
            "label": class_names[best_idx],
            "confidence": round(best_conf, 4),
        }

    return {
        "accepted": False,
        "label": UNKNOWN_MESSAGE,
        "confidence": round(best_conf, 4),
    }


def load_and_predict(
    model_path: str,
    class_names_path: str,
    image_path: str,
    threshold: float = 0.70,
    target_size: Tuple[int, int] = (224, 224),
) -> dict:
    """Convenience function: load model + classes, then predict one image."""
    model = load_tf_model(model_path)
    class_names = load_class_names(class_names_path)
    return predict_with_threshold(
        model=model,
        class_names=class_names,
        image_path=image_path,
        threshold=threshold,
        target_size=target_size,
    )


if __name__ == "__main__":
    # Update these paths for your machine before running.
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "mobilenetv2_fruit_vegetable_final.keras")
    class_names_path = os.path.join(base_dir, "class_names.txt")

    # Example 1: real fruit image.
    fruit_image_path = os.path.join(base_dir, "examples", "apple.jpg")

    # Example 2: chair image (should be rejected if confidence is low).
    chair_image_path = os.path.join(base_dir, "examples", "chair.jpg")

    threshold = 0.70

    fruit_result = load_and_predict(
        model_path=model_path,
        class_names_path=class_names_path,
        image_path=fruit_image_path,
        threshold=threshold,
    )

    chair_result = load_and_predict(
        model_path=model_path,
        class_names_path=class_names_path,
        image_path=chair_image_path,
        threshold=threshold,
    )

    print("Fruit image result:")
    print(json.dumps(fruit_result, ensure_ascii=False, indent=2))

    print("\nChair image result:")
    print(json.dumps(chair_result, ensure_ascii=False, indent=2))