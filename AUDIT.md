# Аудит исходной версии и результат переноса

## Найденные зависимости исходного проекта

- `cloudflare:workers` использовался для получения runtime bindings.
- `runtime().DB` и тип `D1Database` использовались для таблиц и запросов.
- `runtime().FILES` и тип `R2Bucket` использовались для загрузки, чтения и удаления файлов.
- `.openai/hosting.json` объявлял внутренние bindings `DB` и `FILES`.
- `vinext`, Wrangler и Sites Vite plugin собирали Cloudflare Worker для OpenAI Sites.
- Next.js route handlers в `app/api/**` выполняли всю серверную логику.
- `ADMIN_EMAIL` и `ADMIN_PASSWORD` проверялись собственным endpoint с HttpOnly cookie.
- `app/chatgpt-auth.ts` содержал вспомогательную интеграцию с заголовками OpenAI/ChatGPT Auth.

## Что сделано в переносимой версии

- framework заменён с Next.js/vinext на Vite + React;
- route handlers заменены одной Supabase Edge Function `brief-api`;
- D1 заменена на Supabase Postgres;
- R2/FILES заменён приватным bucket `brief-attachments`;
- ADMIN_EMAIL/ADMIN_PASSWORD заменены Supabase Auth и таблицей `admin_profiles`;
- добавлены RLS policies для всех таблиц;
- прямой доступ анонимного браузера к таблицам закрыт;
- service role используется только в Edge Function;
- загрузка файла идёт по одноразовому signed upload URL;
- просмотр и скачивание администратором идут по короткоживущим signed URLs;
- добавлена нормализованная запись референсов в таблицу `references`;
- сохранены edit token, автосохранение и блокировка отправленной анкеты;
- добавлены SPA redirects для Bolt/Netlify hosting;
- удалены зависимости от OpenAI Sites, D1, FILES, Wrangler и vinext.

## Что не изменялось

- опубликованный резервный сайт OpenAI Sites;
- дизайн интерфейса;
- утверждённое содержание и конфигурация анкеты;
- уже собранные данные резервного сайта.
