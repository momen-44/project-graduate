# ML Service

This folder hosts the Flask inference service used by the Nest backend.

## Endpoints

- `GET /health`
- `POST /predict` with JSON payload:

```json
{
  "image_url": "https://example.com/food.jpg"
}
```

Response shape:

```json
{
  "label": "salad",
  "confidence": 0.93
}
```

## Notes

- If `mobilenetv2_fruit_vegetable_final.h5` is missing, the service returns a safe fallback prediction.
- To run locally:

```bash
pip install -r requirements.txt
python app.py
```
