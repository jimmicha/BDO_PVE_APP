# Deployment and service setup

The connected beta backend is vcxptrbumythgwzpgybr. Its migrations, reviewed seed catalog and delete-account Edge Function are installed. A separate staging project is still required. Never use production player data in development fixtures.

## Web

The separate Vercel project is bdo-companion. Build with pnpm install --frozen-lockfile and pnpm build; publish dist using the repository's vercel.json configuration. Configure VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and VITE_APP_URL for the appropriate environment. VITE variables are public. Do not add a service-role key to the frontend or Vercel build output.

The current production deployment is https://www.blackdesertcompanion.app (also https://bdo-companion.vercel.app), updated on 2026-09-08 with the imported gear reference. Subsequent source edits require a new build and deployment. Connect this repository to Vercel for reproducible automatic deployments once a repository is available. The custom domain was already attached to the connected project at deployment time; this implementation did not purchase it.

## Supabase Auth

1. Set Site URL to the stable deployed app origin. Allow its /auth/callback and /auth/reset URLs, the equivalent localhost development URLs, and com.jimmicha.bdocompanion://auth/callback and com.jimmicha.bdocompanion://auth/reset.
2. Keep email confirmation enabled. Configure the Before User Created hook to public.before_user_created using the installed database hook. Verify the exact function name against supabase/config.toml before selecting it.
3. Configure Google OAuth with a client created in the owner's Google Cloud project, and Discord OAuth with an application created in the owner's Discord Developer Portal. Add the Supabase callback URI shown by each provider's settings. Enable secure manual identity linking and test matching verified identities on both platforms. The frontend already offers Google, Discord and email/password sign-in, plus in-app linking of any of them to the current account.
4. Configure Resend SMTP with a verified sender domain. Keep SMTP and OAuth secrets in service settings. Test signup, verification, recovery, expired links and Android browser return links with real mailboxes.
5. Add invited emails to app_private.beta_members using a privileged operator connection. jimmicha3@gmail.com is already the designated administrator. This does not create a password or an Auth account.

The current connector cannot configure Auth provider settings, and the in-app Supabase dashboard is signed out. No real verification or recovery email test has been completed.

## Android

Install Java 21, Android command-line tools, platform 36 and build-tools 36. Set JAVA_HOME and ANDROID_HOME. Run pnpm android:sync, then android/gradlew.bat assembleDebug on Windows (or ./gradlew assembleDebug from android on Linux). Android source assets and deep links are included; local tool downloads timed out, so an APK has not yet been validated.

Update: portable Java 21, Android platform 36, build-tools 36 and platform-tools are now installed under the ignored .local directory after verified downloads. On Windows, run scripts/build-android.ps1; it discovers these workspace tools and builds the debug APK. For a signed bundle use scripts/build-android.ps1 -Task bundleRelease, which refuses to proceed without all four signing environment variables and a valid keystore path. The Gradle wrapper pins its official distribution checksum. Device tests still require a connected Android device or emulator.

For release, provide ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD through protected build secrets. Run bundleRelease. Use the generated AAB in Google Play internal testing; configure Play App Signing, testers, privacy policy, data safety and the public /account-deletion page. Keep signing material outside source control. Finish real-device onboarding, Google/email login, guided completion, export and deletion before distribution.

## Costs and release gates

Use free hosting tiers for the beta. No domain, store registration or service upgrade has been purchased. Review the exact vendor price and recurring commitment with the owner before purchase. A verified email domain and Google Play account may require paid setup. Do not describe the beta as ready for invited testers until all outstanding checks in VERIFICATION.md are complete.
