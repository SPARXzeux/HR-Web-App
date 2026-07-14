import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.delcargo.internal',
  appName: 'Delcargo Internal',
  // Matches next.config.ts's `output: 'export'` build output — `next build`
  // writes the static site into `out/`, which Capacitor then bundles into
  // the native app as its local web content.
  webDir: 'out',
  server: {
    // The app talks directly to PocketBase over plain HTTP
    // (http://157.230.7.89 — see src/lib/pocketbase.ts). Android 9+ and iOS
    // both block cleartext HTTP by default, so this must be allowed
    // explicitly or every API call will silently fail on a real device.
    // See the Android/iOS setup notes for the manifest/plist changes this
    // still requires beyond this config file.
    cleartext: true,
    androidScheme: 'http',
  },
};

export default config;
