-- 1. Сначала создайте пользователя в Supabase:
--    Authentication → Users → Add user.
-- 2. Замените email ниже и выполните этот запрос в SQL Editor.
-- Пароль в SQL не указывается и в репозиторий не сохраняется.

select public.grant_admin(
  'admin@example.com',
  'TBD Design Lead'
);
