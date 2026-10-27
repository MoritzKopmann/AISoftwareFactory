# Playback map mock

Design mock for #708: one box per class, one block per public function, arrows function to function.

- Run: `node serve.mjs`, then open http://localhost:5310/?ac=AC1 (also `AC2`, `AC3`, `All`; add `&theme=dark`).
- Screenshots and layout checks: `node shoot.mjs` while the server runs. Uses the globally installed Playwright.
- `/aisf/` is served from `packages/app/assets/kit`.

AC3 shows a criterion with two starting points (paths A and B) and the split question under the map.
