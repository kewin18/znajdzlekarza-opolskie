# Cloudflare Worker: Asystent Objawow (AI)

Ten Worker dodaje "prawdziwy tryb AI" dla asystenta objawow na stronie hostowanej na GitHub Pages.
GitHub Pages nie umozliwia uruchamiania backendu, wiec endpoint musi byc zewnetrzny.

## Wymagania
- Konto Cloudflare
- Zainstalowany Node.js
- Zainstalowany `wrangler` (CLI Cloudflare)
- Klucz OpenAI API (NIE wklejaj do frontendu)

## Kroki wdrozenia (skrót)
1. Wejdz do folderu:
   - `cd C:\Users\kewin\kewin\lekarze\cloudflare-worker`
2. Zaloguj sie do Cloudflare:
   - `npx wrangler login`
3. Ustaw sekret z kluczem OpenAI:
   - `npx wrangler secret put OPENAI_API_KEY`
4. (Opcjonalnie) ustaw model:
   - `npx wrangler secret put OPENAI_MODEL`
   - wpisz np. `gpt-4o-mini`
5. Wdróż:
   - `npx wrangler deploy`
6. Skopiuj URL Workera i ustaw w `index.html`:
   - `window.HEALTH_CHAT_ENDPOINT = "https://.../health-chat";`

## Bezpieczenstwo
- Klucz API trzymasz tylko w Cloudflare (sekret).
- Worker ma CORS ograniczony do `https://kewin18.github.io` (mozna zmienic w kodzie).

