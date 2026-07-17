# Авторизация через Google (Firebase Auth)

Сайт использует Firebase Authentication (провайдер Google) для входа. Данные
«был здесь» и «избранное» хранятся в Realtime Database под ключом пользователя:

```
users/<uid>/visited/<placeId>   = true
users/<uid>/favorites/<placeId> = true
```

Без входа кнопки видны, но клик открывает окно входа Google; отметить что-либо
можно только залогинившись. Модули деградируют мягко: при заглушечном
`site/lib/firebase-config.json` (`apiKey: "REPLACE_ME"`) авторизация и обе фичи
полностью выключаются, остальной сайт работает.

## Разовая настройка в Firebase Console

Проект: **portugal-events** (`site/lib/firebase-config.json`).

1. **Включить провайдера Google.**
   Console → Build → Authentication → Sign-in method → Add new provider →
   **Google** → Enable → выбрать support email → Save.

2. **Добавить authorized domains.**
   Authentication → Settings → Authorized domains → Add domain:
   - `mi-crafts.com` (продакшн)
   - `localhost` обычно уже добавлен (нужен для `npm run dev`)

3. **Применить правила Realtime Database.**
   Console → Build → Realtime Database → Rules → вставить содержимое
   [`database.rules.json`](../database.rules.json) → Publish.

   Правила дают каждому доступ только к своему `users/<uid>` — чужие данные
   нельзя ни прочитать, ни изменить. Всё остальное (в т.ч. старый путь
   `spaces/…`) закрыто.

> ⚠️ Без шагов 1–2 вход через Google не сработает. Без шага 3 данные технически
> не защищены — любой сможет писать в чужой `users/<uid>`.

## Что изменилось в коде

- `site/lib/firebase.ts` — общий ленивый инстанс Firebase (app + database).
- `site/lib/auth.ts` — Google sign-in/out, `onAuthChange`, `getUid`.
- `site/lib/userData.ts` — общий слой для пер-юзерных наборов
  (`users/<uid>/<kind>`), следит за сменой пользователя.
- `site/lib/visited.ts` / `site/lib/favorites.ts` — тонкие обёртки над ним.
- `FavoriteController` переехал с `localStorage` на Firebase (пер-юзерно,
  синхронизация между устройствами).
- `Header.astro` — кнопка «Войти» / аватар + «Выйти».

Старые данные (общий `spaces/public/visited` и `localStorage`-избранное) не
переносятся — у каждого пользователя набор начинается с чистого листа.
