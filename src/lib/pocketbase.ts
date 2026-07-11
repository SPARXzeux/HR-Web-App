import PocketBase from 'pocketbase';

import { Capacitor } from '@capacitor/core';

// On native devices, use the IP directly. On Vercel, use the Next.js proxy route to bypass Mixed Content errors.
const PB_URL = Capacitor.isNativePlatform() ? 'http://157.230.7.89' : '/api/pb';

export const pb = new PocketBase(PB_URL);

// Optional: Automatically disable auto-cancellation globally if requests are rapid
pb.autoCancellation(false);
