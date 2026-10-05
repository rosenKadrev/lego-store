# BrickStore — LEGO магазин

Angular 22 (SPA, без SSR) + NgRx Signal Store + Tailwind CSS 4 + Supabase (Postgres, Auth, Storage, RLS).
Плащане: наложен платеж. Каталог: Rebrickable CSV.

## Локална разработка

Изисква Docker Desktop.

```bash
npm install
npx supabase start                 # локален Supabase (миграциите се прилагат автоматично)
cp .env.example .env.local         # попълнете SUPABASE_SECRET_KEY от `npx supabase status`
npm run catalog:sync               # сваля най-новите CSV от Rebrickable и ги импортира
docker exec -i supabase_db_lego-store psql -U postgres < scripts/seed-demo-listings.sql  # демо обяви (по избор)
npm start                          # http://localhost:4200
```

### Каталог от Rebrickable

- **Масово (седмично):** `npm run catalog:sync` сваля CSV файловете от https://rebrickable.com/downloads/
  (обновяват се всеки ден, без API ключ) в `data/rebrickable/` и ги импортира. Пуска се многократно —
  обновява съществуващите редове. В production го пуска `.github/workflows/sync-catalog.yml` всеки
  понеделник (нужни са GitHub secrets `SUPABASE_URL` и `SUPABASE_SECRET_KEY`; има и бутон „Run workflow“).
- **Единично (нови сетове):** в „Нова обява“, ако номерът го няма, бутон „Търси в Rebrickable“ вика
  Edge Function `rebrickable-lookup`, която добавя сета (с темата и минифигурките) през Rebrickable API.
  API ключът (Rebrickable → Profile → Settings → API) е само на сървъра:
  - локално: файл `supabase/functions/.env` с ред `REBRICKABLE_API_KEY=...` (не се комитва),
    после `npx supabase stop && npx supabase start`;
  - production: `npx supabase secrets set REBRICKABLE_API_KEY=...` и `npx supabase functions deploy rebrickable-lookup`.

### Админ

Админ може да е **само** `roro.910102@gmail.com` (задава се в `public.admin_email()` в
`supabase/migrations/20261002150000_single_admin.sql`). Профилът става админ автоматично, след като
имейлът е потвърден; всички останали регистрации са клиенти и базата отказва да ги направи админи.
За смяна на имейла на админа — нова миграция с друга стойност в `admin_email()`.

### Типове от базата

След промяна на схемата: `npx supabase gen types typescript --local --schema public > src/app/core/database.types.ts`

## Production (Supabase проект `wagtffhpvowbybhqpwfj`)

```bash
npx supabase db push               # прилага миграциите
SUPABASE_URL=https://wagtffhpvowbybhqpwfj.supabase.co SUPABASE_SECRET_KEY=... \
  node scripts/import-rebrickable.mjs
```

Попълнете publishable ключа в `src/environments/environment.ts`, `npm run build` и качете
`dist/lego-store/browser` на статичен хостинг със SPA fallback (всички пътища → `index.html`).
В Supabase → Authentication:

- **URL Configuration:** Site URL = домейнът; в Redirect URLs добавете `https://вашия-домейн/**`
  (без това линковете от имейлите за потвърждение и нова парола водят към грешен адрес).
- **Email Templates → Reset password:** subject и HTML от `supabase/templates/recovery.html`.
- **SMTP Settings:** вграденият имейл на Supabase праща само няколко имейла на час — за реален
  магазин свържете собствен SMTP (напр. Resend, Brevo).
- **Providers → Email:** минимална дължина на паролата 8 (както в `config.toml`).

Локално всички имейли се виждат в Mailpit: http://127.0.0.1:54324

## Структура

- `supabase/migrations` — схема, RLS, `place_order` (атомарно резервиране на наличност), `set_order_status`
- `src/app/stores` — signal stores: auth, cart (localStorage), themes, catalog, product
- `src/app/admin` — обяви (търсене в каталога, снимки), поръчки (статуси, товарителници, рискови клиенти)
- `src/app/pages` — начало, каталог с филтри, продукт, количка, поръчка, вход/регистрация, профил

**Модел:** `sets`/`minifigs` са каталогът; `listings` е това, което се продава. Нов продукт = една обява с
наличност N. Употребяван = отделна обява за всяка бройка (наличност 0/1) със собствени снимки.
