# Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run
   `migrations/20261112230000_initial_schema.sql`.
3. Copy the project URL and **anon** key into both `dashboard/.env` and
   `mobile/.env`, using the corresponding `.env.example` files.
4. Create administrator and management users from Supabase Authentication.
5. Add matching rows to `public.profiles` with the appropriate role.

Only the anon key belongs in client applications. Never expose or commit the
service-role key.

## Reminder worker

The reminder worker is in `functions/process-reminders/index.ts`. Deploy it
with the Supabase CLI after linking the project:

```text
supabase functions deploy process-reminders
```

Schedule it daily using Supabase Cron or an external scheduler. The worker
creates reminder log entries and in-app notifications for compliance records
expiring within 30 days. The service-role key is used only by the deployed
Edge Function and must never be copied into either client `.env` file.
