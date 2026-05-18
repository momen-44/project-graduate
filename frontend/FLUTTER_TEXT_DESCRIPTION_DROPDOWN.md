# Flutter Text Analysis Prompt

The existing Flutter UI and meal-analysis flow already exist. Do not rebuild them from scratch. Modify the current implementation only.

Goal

- Keep `Breakfast`, `Lunch`, and `Dinner` as separate meal sections.
- Each meal section must use an independent multi-select dropdown.
- Suggestions must be filtered by the meal description and stay relevant to the selected meal.
- Keep the UI labels and prompt text in English.

Required behavior

- Use the current description input and suggestion flow already present in the app.
- Replace any free-text or single-choice flow with multi-select behavior if needed.
- Suggestions should be derived from the meal description using keyword and synonym matching.
- Multiple items may be selected at once.
- When multiple items are selected, reduce the grams proportionally and recalculate calories.
- Use a default target meal weight of 100 grams.
- If default serving grams exist, distribute the target weight proportionally.
- If default serving grams do not exist, split the target weight equally.
- Show adjusted grams and adjusted calories for each selected item.
- Show a short user-facing message explaining that the serving sizes were reduced to fit the target meal weight (100g default).
- Keep calorie updates live when grams are changed manually.
- Always calculate calories from the existing item nutrition data already in the app (do not invent new calorie baselines).
- If grams are reduced, calories must reduce proportionally for the same item.

Important constraints

- Do not create new Flutter screens or rewrite the architecture.
- Reuse the existing UI, data flow, and API wiring.
- Remove any prompt text, UI copy, or helper content that is not needed for this feature.
- Keep only the meal-specific suggestion logic, multi-select behavior, gram reduction, and calorie recalculation.

Output expectation

- Update the existing Flutter implementation to support the above behavior.
- Keep changes minimal, focused, and aligned with the current codebase.
