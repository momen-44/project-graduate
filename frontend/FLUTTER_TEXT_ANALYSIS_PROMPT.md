Flutter task: food text analysis now uses selectable options only

Goal

- Replace the free-text food description input with a selectable list of predefined options.
- Users should not be able to type arbitrary text for the food description.
- The backend now exposes the allowed values through `GET /food/text-options`.

Backend contract

- Fetch allowed descriptions from:
  - `GET /food/text-options`
- Submit analysis with:
  - `POST /food/text`
  - JSON body:
    - `mealType`: `breakfast | lunch | dinner | snack`
    - `description`: one of the values returned by `/food/text-options`
    - `userContext`: optional string

Required UI changes

- Replace the text field for description with:
  - a dropdown, segmented control, chips, or bottom-sheet selector
- Use the backend options list as the source of truth
- Disable manual typing for the description field
- If you want meal-specific filtering, group the options by meal type on the client
- Show a friendly validation message if nothing is selected

Suggested client flow

1. Load `GET /food/text-options` when the screen opens
2. Render the returned options as selectable chips or a dropdown
3. Keep a selected `description` value in state
4. Send only the selected value to `POST /food/text`
5. Render the returned nutrition result as before

Example request

```json
{
  "mealType": "lunch",
  "description": "Grilled chicken with rice",
  "userContext": "post workout"
}
```

Behavior notes

- The backend will reject any description that is not in the allowed options list.
- Keep the existing auth headers and token handling unchanged.
- If the options endpoint fails, show a retry state instead of falling back to free text.

Prompt & UI contract additions (required)

- The Flutter client must include the following markers when building any human-facing prompt or when asking an auxiliary AI/assistant for formatted suggestions. These are simple text markers the UI or any client-side AI should place verbatim inside the prompt so the backend / AI response includes clearly delimited fields:
  - `#sym:suggestionText`
  - `#sym:healthyAlternatives`
  - `#sym:dailyAdvice`

- Usage: include the three tokens as labels in the prompt text you send to any generative assistant (or when formatting text locally). Each token marks the start of the requested piece of text. The assistant's response should include each token followed by the requested content. Example prompt template follows.

Prompt template (copy-paste)

"User selected: {{description}} (meal: {{mealType}}). Provide a short, helpful suggestion for this meal, then list 3 healthy alternatives, then a single-line daily advice. Structure the output using these exact tokens so the response can be parsed reliably:

#sym:suggestionText
<one or two sentence suggestion>
#sym:healthyAlternatives

- <alternative 1>
- <alternative 2>
- <alternative 3>
  #sym:dailyAdvice
  <one-line daily advice>
  "

Dart example — fetch options, build prompt, and send to your AI helper or backend (copy-paste)

```dart
// Fetch options
final res = await http.get(Uri.parse('$baseUrl/food/text-options'));
final List<String> options = jsonDecode(res.body) as List<String>;

// Build the prompt before calling an assistant (or for local formatting)
String buildPrompt({required String description, required String mealType}) {
  return '''User selected: $description (meal: $mealType). Provide a short, helpful suggestion for this meal, then list 3 healthy alternatives, then a single-line daily advice. Use the tokens below exactly so the app can parse the response.

#sym:suggestionText
''';
}

// Example: call backend to record the selection (required POST /food/text)
final body = {
  'mealType': 'lunch',
  'description': 'Grilled chicken with rice',
  'userContext': 'post workout'
};
final recordRes = await http.post(
  Uri.parse('$baseUrl/food/text'),
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
  body: jsonEncode(body),
);

// If you also call a generative assistant from the client, send the full prompt string
// and parse its response by locating the tokens '#sym:suggestionText', '#sym:healthyAlternatives', '#sym:dailyAdvice'.

// Simple parser (very tolerant):
Map<String, String> parseAssistantResponse(String text) {
  String extract(String token) {
    final idx = text.indexOf(token);
    if (idx == -1) return '';
    final nextTokenIdx = text.indexOf('#sym:', idx + token.length);
    final end = nextTokenIdx == -1 ? text.length : nextTokenIdx;
    return text.substring(idx + token.length, end).trim();
  }

  return {
    'suggestionText': extract('#sym:suggestionText'),
    'healthyAlternatives': extract('#sym:healthyAlternatives'),
    'dailyAdvice': extract('#sym:dailyAdvice'),
  };
}

```

Notes

- Keep `description` strictly one of the backend-provided options.
- The `#sym:` tokens are literal markers; do not translate or remove them. They help the client parse the assistant response reliably.
- If you need, I can also provide a ready-made Flutter widget (chips + per-item grams input + multi-select) that integrates this prompt building and parsing.

If you want me to directly add the Flutter widget/snippet to the repo, tell me and I will implement it.
