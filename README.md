# Galenite site (Static Frontend + Cloudflare Worker API)

## Архитектура
- **Frontend**: статические страницы (`/auth`, `/health`, `/galen_chat`) без хранения секретов.
- **Backend API**: Cloudflare Worker (`worker/index.js`).
- **Auth**: только Telegram Login Widget + серверная cookie-сессия (`HttpOnly`).

## Worker API endpoints
- `GET /api/ping`
- `GET /api/food/search?q=apple`
- `POST /api/auth/telegram`
- `GET /api/auth/me`
- `POST /api/auth/logout`

## Cloudflare Worker variables/secrets
Задаются в **Worker Settings → Variables and Secrets**:

Plaintext variables:
- `OPENFOODFACTS_BASE_URL=https://world.openfoodfacts.net`
- `PRODUCTS_PROVIDER=openfoodfacts`
- `TELEGRAM_AUTH_MAX_AGE_SECONDS=604800`
- `TELEGRAM_BOT_USERNAME=glnt_auth_bot`
- `ALLOWED_ORIGINS=https://galenite.ru,https://www.galenite.ru`

Secrets:
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`

> В клиентском коде нет `TELEGRAM_BOT_TOKEN` и `SESSION_SECRET`.

## Telegram auth verification
Worker валидирует payload по официальной схеме:
1. Собирает `data_check_string` из всех полей, кроме `hash`.
2. Сортирует ключи.
3. `secret_key = SHA256(bot_token)`.
4. `calc_hash = HMAC_SHA256(data_check_string, secret_key)` в hex.
5. Time-constant сравнение `calc_hash` и `hash`.
6. Проверка freshness `auth_date` (`now - auth_date <= TELEGRAM_AUTH_MAX_AGE_SECONDS`).

## Frontend config
На страницах `auth/index.html` и `health/index.html` можно задать:
```html
<script>window.API_BASE_URL = "https://galenite.ru";</script>
```
Если не задано, используются относительные пути (`/api/...`) на текущем origin (рекомендуется для `galenite.ru`).

## Локальная проверка
```bash
npm test
```

## Чек-лист ручной проверки
1. `/api/ping` отвечает `{ ok: true }`.
2. `/auth` -> Telegram login -> редирект на `/health`.
3. `/health` без логина редиректит на `/auth`.
4. `/api/food/search?q=apple` возвращает `items`.
5. Logout чистит cookie-сессию и доступ к `/health` теряется.
