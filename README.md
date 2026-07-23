# TBD — Visual Identity Session / Bolt + Supabase

Переносимая версия существующего приложения TBD Visual Identity Session. Интерфейс сохранён, а внутренние сервисы OpenAI Sites заменены на:

- Vite + React для интерфейса и Bolt hosting;
- Supabase Postgres для данных;
- приватный Supabase Storage bucket `brief-attachments`;
- Supabase Auth для административного входа;
- Supabase Edge Function `brief-api` для анонимных сессий, edit token и закрытых административных операций.

Действующий сайт OpenAI Sites этой копией не изменяется и остаётся резервной версией.

## Что сохранено

- анонимный старт без формы личных данных;
- интро, утверждённые разделы и вопросы;
- автосохранение и восстановление черновика;
- персональная ссылка с edit token;
- загрузка и удаление файлов;
- ссылки, референсы и антиреференсы;
- финальная проверка и отправка;
- запрет редактирования отправленной анкеты;
- административная панель;
- временные signed URLs для просмотра и скачивания файлов;
- внутренняя заметка;
- JSON, печать/PDF и ZIP-экспорт.

## Архитектура безопасности

Браузер получает только `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.

Публичная часть не обращается напрямую к таблицам и не получает административных прав. Анонимные операции проходят через `brief-api`, где проверяются ID анкеты, edit token, статус и разрешённые вопросы.

`SUPABASE_SERVICE_ROLE_KEY` используется только внутри Supabase Edge Function. Он не должен добавляться в переменные Bolt с префиксом `VITE_`, попадать в браузерную сборку или GitHub.

Все таблицы защищены Row Level Security. Bucket `brief-attachments` приватный. Административные ссылки на файлы действуют ограниченное время и выдаются только после проверки Supabase Auth и записи пользователя в `admin_profiles`.

## Локальный запуск интерфейса

Требуется Node.js 22.12 или новее.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

В `.env.local` для интерфейса заполните:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

## Настройка нового Supabase project

1. Создайте пустой Supabase project.
2. Откройте SQL Editor.
3. Полностью выполните файл `supabase/initial-setup.sql`.
4. Проверьте, что появились таблицы:
   - `submissions`;
   - `answers`;
   - `references`;
   - `attachments`;
   - `submission_events`;
   - `admin_profiles`.
5. В Storage проверьте приватный bucket `brief-attachments`.
6. В Authentication → Users создайте администратора через Add user. Публичная регистрация приложением не предусмотрена.
7. Откройте `supabase/assign-admin.sql`, замените только пример email и выполните файл в SQL Editor.

Пароль администратора задаётся в Supabase Auth и никогда не записывается в SQL или репозиторий.

## Edge Function

Функция находится в `supabase/functions/brief-api`.

Для развёртывания через Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set APP_URL=https://YOUR-BOLT-DOMAIN EDIT_TOKEN_SECRET=LONG_RANDOM_SECRET
supabase functions deploy brief-api --no-verify-jwt
```

`APP_URL` можно перечислить через запятую, если временно нужны production и preview origin. После запуска оставьте только доверенные адреса.

Supabase предоставляет `SUPABASE_URL`, `SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY` размещённым Edge Functions автоматически. Для локального запуска функции service role можно задать отдельно, но не добавляйте его в Bolt client environment.

Секрет для edit token можно создать локально:

```bash
openssl rand -hex 32
```

## Импорт в Bolt через приватный GitHub

1. Создайте пустой приватный репозиторий GitHub.
2. Загрузите в него содержимое этого проекта, включая скрытые файлы `.env.example` и `.gitignore`.
3. Не загружайте `.env`, `.env.local`, `node_modules` или `dist`.
4. В Bolt выберите Import from GitHub и укажите приватный репозиторий.
5. Подключите нужный Supabase project в настройках Bolt.
6. Добавьте в Bolt:
   - `VITE_SUPABASE_URL`;
   - `VITE_SUPABASE_ANON_KEY`.
7. Команда установки: `pnpm install`.
8. Команда разработки: `pnpm dev`.
9. Production build: `pnpm build`.
10. Папка публикации: `dist`.

Проект использует Vite, потому что Supabase integration в Bolt поддерживается для Vite-проектов, а не для Next.js-проектов. Серверные Next.js route handlers исходной версии заменены на Supabase Edge Function.

## Проверки

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

После импорта обязательно проверьте:

1. анонимное создание анкеты;
2. автосохранение и возврат по персональной ссылке;
3. загрузку JPG/PDF/MP4 и удаление файла;
4. наличие строк во всех таблицах;
5. появление файлов только в приватном bucket;
6. финальную отправку и блокировку дальнейшего редактирования;
7. вход администратора;
8. список и карточку анкеты;
9. временный просмотр и скачивание файла;
10. внутреннюю заметку;
11. JSON, PDF/печать и ZIP.

## Важное о существующих данных

Эта копия подготавливает новое хранилище Supabase, но автоматически не переносит уже собранные записи из внутренней базы OpenAI Sites. Резервный сайт продолжает хранить и показывать свои данные отдельно. Если понадобится перенос накопленных ответов, сначала экспортируйте их из административной панели резервного сайта, затем подготовьте отдельный контролируемый импорт в Supabase.
