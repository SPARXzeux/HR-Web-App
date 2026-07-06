const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pftbzajbfelexyyhqmef.supabase.co';
const supabaseAnonKey = 'sb_publishable_fqs9oSIYNtzkhqOa-xzAjg_9DxUGbAI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing Supabase Connection...');
  
  // 1. Test Select profiles
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error('Select Error:', error);
  } else {
    console.log('Select Success! Found profile keys:', data.length > 0 ? Object.keys(data[0]) : 'No profiles found');
  }

  // 2. Test mock upsert
  const mockId = `test_emp_${Date.now()}`;
  const mockProfile = {
    id: mockId,
    full_name: 'Test Upsert',
    email: 'test_upsert@delcargo.us',
    role: 'employee',
    joined_date: '2026-07-06',
    onboarding_completed: false,
    base_salary: 50000,
    teams: ['Engineering'],
    password: 'password123',
    is_team_lead: false,
    lead_teams: []
  };

  const { error: upsertErr } = await supabase.from('profiles').upsert(mockProfile);
  if (upsertErr) {
    console.error('Upsert Error:', upsertErr);
  } else {
    console.log('Upsert Success!');
    // Clean up
    await supabase.from('profiles').delete().eq('id', mockId);
  }
}

test();
