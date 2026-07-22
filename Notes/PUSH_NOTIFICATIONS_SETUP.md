# Push Notifications (OneSignal) — Setup Guide

The code side of this is already wired up (see "What's already done" below).
What's left is account/credential setup on OneSignal's, Google's, and
Apple's own sites — none of that can be done from inside this codebase, it
has to happen in your browser / Xcode.

This app uses OneSignal for exactly one thing: push notifications. Nothing
else (no email, SMS, in-app messages, journeys) is wired up, and none of
that needs to be — ignore those sections of OneSignal's dashboard.

## 1. Create your OneSignal app

1. Go to https://onesignal.com and sign up for a free account.
2. Click **New App/Website**, name it (e.g. "DelCargo HR"), and choose
   **Apple iOS (APNs)**, **Google Android (FCM)**, and **Web Push** as your
   platforms (pick whichever of the three you actually need — you said all
   three).
3. Once created, go to **Settings → Keys & IDs** and copy the **OneSignal
   App ID** (a UUID like `1234abcd-...`).
4. Open `src/lib/push.ts` in this repo and replace:
   ```ts
   export const ONESIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID';
   ```
   with your real App ID. That's the only line you need to touch.

## 2. Android — Firebase credentials

OneSignal needs your Firebase project's credentials to deliver Android
push. You do **not** need to add a `google-services.json` file to this
repo — everything goes into the OneSignal dashboard instead.

1. If you don't already have one, create a free Firebase project at
   https://console.firebase.google.com.
2. In Firebase: **Project settings → Cloud Messaging** — copy the
   **Server key** (Cloud Messaging API, legacy) and **Sender ID**.
   (If Google has hidden the legacy Server Key on your project, follow
   OneSignal's guide for the newer service-account-based setup:
   https://documentation.onesignal.com/docs/android-firebase-credentials —
   Google has changed this flow a few times, so check that page for
   whatever's current when you do this.)
3. In OneSignal: **Settings → Platforms → Google Android (FCM)** — paste
   those credentials in.
4. Run, from this project's root:
   ```
   npm install
   npx cap sync android
   ```

## 3. iOS — Apple Push Notification key

1. In your Apple Developer account (https://developer.apple.com/account):
   **Certificates, Identifiers & Profiles → Keys → +** — create a new key
   with **Apple Push Notifications service (APNs)** enabled. Download the
   `.p8` file (Apple only lets you download it once — keep it safe) and
   note the **Key ID** and your **Team ID**.
2. In OneSignal: **Settings → Platforms → Apple iOS (APNs)** — upload that
   `.p8` file along with the Key ID and Team ID.
3. Open the iOS project in Xcode (`npx cap open ios` from this repo, after
   running `npm install && npx cap sync ios`).
4. In Xcode: select the **App** target → **Signing & Capabilities** tab →
   **+ Capability** → add **Push Notifications**. This is a one-click
   toggle — Xcode writes the entitlement for you.
5. Build/run from Xcode to a real device or simulator to test (push doesn't
   work in the iOS Simulator before Xcode 14/iOS 16, so use a real device
   if your Xcode/iOS is older).

## 4. Web push (browser)

Nothing extra needed beyond step 1 — `public/OneSignalSDKWorker.js` and the
script tag in `src/app/layout.tsx` are already in place. Just make sure
**Web Push** is one of the platforms you enabled in step 1, and that your
site's URL is set correctly under **Settings → Platforms → Web Push**
(OneSignal will ask for your production domain).

## 5. Test it

- **Web**: run `npm run dev`, open the site, log in — you should get a
  browser permission prompt. Approve it, then send yourself a test push
  from OneSignal's dashboard (**Messages → New Push**, target "Test
  Devices" or "All Users").
- **Android**: `npx cap sync android && npx cap open android`, run on a
  device/emulator with Google Play Services, log in, approve the
  permission prompt, send a test push.
- **iOS**: same idea via `npx cap open ios`, on a real device (or a modern
  simulator).

## What's already done (code side)

- `src/lib/push.ts` — single module that initializes push for whichever
  shell the app is running in (native Capacitor vs. plain browser), and
  logs the signed-in user in to OneSignal under their email as the
  "external ID". That means once this is live, you can target a specific
  employee by email from OneSignal's dashboard/API, not just broadcast to
  everyone.
- Push init is triggered automatically after login, from
  `src/app/(dashboard)/layout.tsx`.
- Push logout (`logoutPush()`) is wired into both sign-out buttons
  (`Sidebar.tsx` and `TopNav.tsx`) so a shared/kiosk device doesn't keep
  the previous employee's push subscription linked to their account.
- `public/OneSignalSDKWorker.js` + `src/components/PushWebScript.tsx` —
  browser-only Web Push SDK loader (skipped entirely inside the native app,
  where the Capacitor plugin is used instead).
- `@onesignal/capacitor-plugin` (verified latest: `1.1.2`, compatible with
  this project's Capacitor 8.x) added to `package.json` — run `npm install`
  to pull it in.

Until you paste in a real App ID, `initPush()` no-ops with a console
warning — the app works exactly as before, nothing breaks.
