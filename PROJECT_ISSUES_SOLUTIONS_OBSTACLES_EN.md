# Project Issues, Applied Solutions, and Encountered Obstacles

This document summarizes the key problems we faced during implementation, how we addressed them, and the remaining obstacles.

## 1) Problems We Faced

| Problem | Evidence / Impact | Status |
|---|---|---|
| Difficulty standardizing runtime setup across project components (NestJS + ML) | The project runs from two different folders (`orm/` and `ml/`) with different commands and dependencies. | Partially addressed |
| Negative scenarios returning `500` instead of more accurate validation errors | The negative test section shows cases like "Description is required" with `500` responses. | Needs improvement |
| Missing academic ML evaluation metrics in the repository | The AI model results section confirms the absence of Accuracy/Precision/Recall/F1 and MAE/RMSE/R2 reports. | Still open |
| Some critical routes depend on external services/configuration (Cloudinary/Redis/JWT) | Protection, upload, and caching paths depend on environment variables and external service health. | Operationally handled, documentation still needs improvement |
| TypeORM migrations can break due to import path usage | Architecture notes indicate potential `MODULE_NOT_FOUND` issues when using `src/...` in certain migration contexts. | Working pattern established |
| ngrok tunnel instability during external-device testing | `ngrok.out.log` shows repeated `failed to reconnect session` errors and inability to reach `connect.ngrok-agent.com:443`. | Partially addressed |
| Flutter/backend base URL mismatch across docs and app service | Integration notes mention `localhost:5000` while `flutter_services/api_service.dart` resolves to `localhost:4000` (or `10.0.2.2:4000` on Android emulator). | Addressed with environment-based override strategy |
| Flutter auth/session edge cases across app restarts | Mobile client must handle token rotation, secure storage, and session revoke flow consistently. | Addressed with secure storage + refresh flow |

## 2) How We Solved Them

| Problem | Applied Solution | Outcome |
|---|---|---|
| Backend-ML path and integration complexity | Enforced a clear architecture where `ml.service.ts` acts as an HTTP client to `ml/app.py` only. | Better separation of concerns and lower integration complexity |
| Migration/import path issues | Adopted relative imports where needed in entities/migration-relevant files and standardized TypeORM scripts. | Reduced `MODULE_NOT_FOUND` failures |
| Lower text-analysis resilience when external AI is unavailable | Added a local fallback heuristic in `food.service.ts` instead of relying fully on Gemini. | Service continuity even during external AI issues |
| `Unknown Food` results in image analysis for some labels | Embedded local nutrition lookup in `ml/app.py` and returned `nutrition` + `nutritionSource`. | Improved output quality and source transparency |
| Need to prove system reliability | Executed endpoint-level integrated tests with per-endpoint timing output. | Achieved 27/27 successful endpoint tests (100% in the recorded run) |
| ngrok tunnel connection failures during remote/mobile integration | Reviewed ngrok runtime logs, identified repeated upstream dial failures, and switched to explicit environment-driven API URL configuration in clients instead of hardcoded local endpoints. | Reduced integration blockers and made endpoint switching predictable |
| Flutter base URL inconsistencies by platform | Kept platform-aware defaults (`10.0.2.2` for Android emulator, `localhost` for desktop/web) and enabled `API_BASE_URL` override via build/runtime env. | More reliable cross-platform API connectivity |
| Flutter session continuity and auth robustness | Implemented secure token storage and refresh-on-start (`tryAutoLogin` + `refreshSession`) with cleanup on refresh failure. | Improved login persistence and safer session handling |

## 3) Obstacles We Encountered

| Obstacle | Impact | Current Action |
|---|---|---|
| No complete offline ML evaluation report | Difficult to present academically rigorous model quality metrics. | Planned: add evaluation script and versioned results in repository |
| Dependence on external services for sensitive routes | Any key/service outage can affect upload or synchronization flows. | Strengthen pre-run config checks and document required environment variables |
| Error pathways returning `500` instead of `4xx` in some validation cases | Weaker API consumer experience and less precise error categorization. | Ongoing: improve DTO validation and exception handling layer |
| ngrok public URL volatility and network policy/proxy constraints | Tunnel URLs can change between runs, and blocked outbound routes can break sessions (`connect.ngrok-agent.com`). | Standardize startup checklist for tunnel health and propagate active tunnel URL through env vars |
| Flutter environment drift across team members/devices | Different local ports, emulator networking rules, and missing runtime overrides can cause hard-to-reproduce API failures. | Keep one source of truth for API base URL and enforce environment-specific launch configuration |

## 4) ngrok and Flutter Integration Notes

- ngrok evidence observed in runtime logs:
	- ngrok web inspector fallback from `127.0.0.1:4040` to `127.0.0.1:4041`.
	- Repeated reconnect failures to `connect.ngrok-agent.com:443`.
- Flutter integration constraints observed in project docs/services:
	- Registration flow uses multipart and enforces strict image validation and required profile fields.
	- Mobile clients must not depend on plain `localhost`; Android emulator requires `10.0.2.2` when running against local backend.
	- Auth integration requires secure storage, refresh-token rotation, and explicit revoke/session handling.

Recommended operational flow for mobile testing with external tunnels:

1. Start backend and verify local health endpoint.
2. Start ngrok tunnel and validate the public URL is reachable.
3. Launch Flutter with explicit API URL override (for example using `--dart-define=API_BASE_URL=<active-ngrok-url>`).
4. Run login/refresh/revoke smoke checks before full feature testing.

## 5) Executive Summary

- Most integration obstacles were overcome, and current endpoint test evidence indicates good stability for core routes.
- The largest remaining gap is moving from inference-only ML outputs to a scientifically documented evaluation report with standard metrics.
- Next priorities are to normalize validation failures to `4xx`, harden tunnel/environment automation (ngrok + Flutter), and add a reviewable ML evaluation artifact.
