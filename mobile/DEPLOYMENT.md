# Android deployment

The mobile app can be distributed to the four management devices without
Google Play by building an internal APK and sharing the GitHub Actions artifact.

## One-time setup

1. Create an Expo account and create an access token.
2. Run `npx eas-cli@latest login` locally, then from `mobile/` run:
   `npx eas-cli@latest init`.
3. Configure the `preview` environment variables in EAS:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Add the Expo access token to the GitHub repository as the `EXPO_TOKEN`
   Actions secret.

The Supabase anon key is intended for client applications. Never add the
service-role key to EAS, GitHub, or this app.

## Build an APK

From GitHub, run **Actions > Build mobile Android app > Run workflow**.
The workflow also runs when a tag matching `android-v*` is pushed. Download the
`riyon-vehicle-management-android` artifact and install the APK on each device.

For a local build, run:

```text
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile in `eas.json` intentionally creates an APK for direct
installation. The `production` profile creates an Android App Bundle for a
future Play Store release.
