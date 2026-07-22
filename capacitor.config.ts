import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.delcargo.internal',
  appName: 'Delcargo Internal',
  // Matches next.config.ts's `output: 'export'` build output — `next build`
  // writes the static site into `out/`, which Capacitor then bundles into
  // the native app as its local web content.
  webDir: 'out',
  // The app now talks to PocketBase over HTTPS at pb.delcargo.us (see
  // src/lib/pocketbase.ts) instead of a bare HTTP IP, so the cleartext
  // exception this used to need (cleartext: true, androidScheme: 'http' —
  // plus the matching AndroidManifest.xml usesCleartextTraffic and Info.plist
  // NSAllowsArbitraryLoads entries, both removed) is gone. Capacitor's
  // default androidScheme is already 'https', so no server block is needed
  // at all.
  //
  // IMPORTANT: don't build/ship this until pb.delcargo.us is actually live
  // with a valid HTTPS certificate — see the PocketBase HTTPS migration
  // notes. Until then the app has no way to reach PocketBase at all.
};

export default config;
