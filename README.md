# Galenite site

## Короткий аудит текущего проекта
- Фреймворк: без framework, статический HTML/CSS/JS сайт с отдельными директориями `auth/`, `health/`, `galen_chat/`.
- Маршрут `/health`: файл `health/index.html`, логика в `health/js/*`.
- БД/ORM: до рефактора отсутствовали (локальный `localStorage`), теперь добавлен SQLite через `node:sqlite`.
- Auth (до): Firebase Email/Password + Google. Auth (после): только Telegram Login Widget + server-side session.

## Запуск
1. Скопируйте `.env.example` в `.env` и заполните Telegram/AI/DATABASE параметры.
2. Запустите:
   ```bash
   npm start
   ```
3. Откройте `http://localhost:3000/auth/` и войдите через Telegram.
4. После авторизации доступен `http://localhost:3000/health/`.

## Что реализовано
- Telegram-only auth на backend, валидация `hash` по официальному алгоритму и проверка freshness `auth_date`.
- Сессии с HttpOnly cookie (`SameSite=Lax`, `Secure` в production).
- Новая `/health` страница: 2x2 dashboard (Calories, Water, Sleep, Weight), detail modal, bottom nav, AI Coach блок.
- База данных и миграции: users, products, meals/meal_items, water_logs, sleep_logs, weight_logs, sessions.
- ProductLookupService MVP: поиск по barcode через Open Food Facts с локальным кэшем.

## Тесты
```bash
npm test
```
