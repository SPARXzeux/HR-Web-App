import PocketBase from 'pocketbase';

const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
const PB_URL = isNative ? 'http://157.230.7.89' : '/api/pb';

export const pb = new PocketBase(PB_URL);

// Optional: Automatically disable auto-cancellation globally if requests are rapid
pb.autoCancellation(false);
