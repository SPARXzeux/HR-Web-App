import PocketBase from 'pocketbase';

// PocketBase instance connected to DigitalOcean server
export const pb = new PocketBase('http://157.230.7.89');

// Optional: Automatically disable auto-cancellation globally if requests are rapid
pb.autoCancellation(false);
