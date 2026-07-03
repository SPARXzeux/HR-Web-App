import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to auth page as the default entry point. 
  // In a real implementation with Supabase, you would check the session here.
  redirect('/auth');
}
