# Galenite static base

Базовый каркас статического сайта для дальнейшей разработки.

## Структура
- `index.html`
- `style.css`
- `/image`
- `CNAME`

## Запуск локально
Открыть `index.html` в браузере.

## Примечания
Репозиторий предназначен для GitHub Pages с кастомным доменом `galenite.ru`. DNS будет настроен отдельно.

## Настройки аккаунта
- Страница `/account/` позволяет редактировать никнейм, короткий user prompt (до 50 символов) и аватар. Данные сохраняются в Firestore (`users/{uid}`) и Storage (`avatars/{uid}/avatar.webp`) и автоматически попадают в системный контекст Galen.
- Лимиты (длина промта, размер аватара) и стили лежат в `account/account.js` и `account/style.css`.

### Firebase rules
Правила безопасности находятся в `firebase/firestore.rules` и `firebase/storage.rules`.
Применение из CLI:
```
firebase deploy --only firestore:rules,storage:rules
```
