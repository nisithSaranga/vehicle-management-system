# Vehicle Management System

Vehicle and compliance management for Riyon International Pvt Ltd. The
repository contains a web dashboard, an Android mobile app, shared TypeScript
types, and Supabase database and Edge Function code.

## Repository structure

- `dashboard/` - React and Vite web dashboard
- `mobile/` - Expo and React Native Android app
- `shared/` - Shared TypeScript package
- `supabase/` - Database migrations and Edge Functions

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project for local development

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create environment files for the dashboard and mobile app using the
corresponding `.env.example` files. Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Only the Supabase publishable/anon key belongs in client applications. Never
commit or expose the service-role key.

Apply the SQL migrations in `supabase/migrations/` to the Supabase project.
Additional Supabase setup is documented in [supabase/README.md](supabase/README.md).

## Development

Start the dashboard:

```bash
npm run dev:dashboard
```

Start the mobile app:

```bash
npm run dev:mobile
```

Run the dashboard build and typecheck:

```bash
npm run build:dashboard
npm run typecheck
```

## Android deployment

The GitHub Actions workflow
`.github/workflows/build-mobile-android.yml` builds a signed preview APK.
Run **Actions > Build mobile Android app > Run workflow**, then download the
`riyon-vehicle-management-android` artifact and install the APK on the target
Android devices.

The complete deployment process, including required GitHub and Expo secrets,
is documented in [mobile/DEPLOYMENT.md](mobile/DEPLOYMENT.md).

The `preview` EAS profile creates an installable APK. The `production` profile
creates an Android App Bundle for a future Google Play release.

## License

See [mobile/LICENSE](mobile/LICENSE).
