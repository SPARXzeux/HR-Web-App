// One-time migration: moves real data that is currently trapped inside the
// hr_delcargo_store KV table into the proper hr_payroll and hr_teams
// collections, so the app can stop reading payroll history / the teams list
// out of KV once pages switch over to hrData.ts.
//
// Safe to re-run: it skips creating a payroll row for an employeeId that
// already has one in hr_payroll, and skips creating a team whose name
// already exists in hr_teams.
//
// Usage:
//   node migrate_kv_to_collections.mjs
//
// Requires Node 18+ (built-in fetch). No dependencies.

const BASE = 'http://157.230.7.89';

async function getKV(key) {
  const url = `${BASE}/api/collections/hr_delcargo_store/records?filter=${encodeURIComponent(`key = "${key}"`)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.items?.[0]?.value ?? null;
}

async function listAll(collection) {
  const res = await fetch(`${BASE}/api/collections/${collection}/records?perPage=200`);
  const data = await res.json();
  return data.items || [];
}

async function create(collection, fields) {
  const res = await fetch(`${BASE}/api/collections/${collection}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create ${collection} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function migratePayroll() {
  console.log('--- Migrating payroll ---');
  const existing = await listAll('hr_payroll');
  const existingEmployeeIds = new Set(existing.map(r => r.employee_id).filter(Boolean));

  const sources = ['hr_payroll_prod_v1', 'hr_payroll_v6'];
  let created = 0;
  for (const key of sources) {
    const rows = (await getKV(key)) || [];
    for (const r of rows) {
      const employeeId = r.employeeId || r.employee_id || '';
      if (employeeId && existingEmployeeIds.has(employeeId)) {
        console.log(`  skip (already in hr_payroll): ${r.name || employeeId}`);
        continue;
      }
      await create('hr_payroll', {
        employee_id: employeeId,
        employee_name: r.name || '',
        role: r.role || 'Staff',
        region: r.region || 'Pakistan',
        base_salary: r.baseSalary || 0,
        bonus: r.bonus || 0,
        deductions: r.deductions || 0,
        net_pay: (r.baseSalary || 0) + (r.bonus || 0) - (r.deductions || 0) + (r.incrementAmount || 0),
        increment_amount: r.incrementAmount || 0,
        unpaid_leaves: r.unpaidLeaves || 0,
        processed: !!r.processed,
        status: r.processed ? 'paid' : 'pending',
        paid_date: '',
        month: '',
        year: 0,
      });
      if (employeeId) existingEmployeeIds.add(employeeId);
      created++;
      console.log(`  created: ${r.name || employeeId}`);
    }
  }
  console.log(`Payroll migration done. ${created} row(s) created.`);
}

async function migrateTeams() {
  console.log('--- Migrating teams ---');
  const existingTeams = await listAll('hr_teams');
  const existingNames = new Set(existingTeams.map(t => t.name));

  const names = (await getKV('hr_custom_teams_prod_v1')) || [];
  const profiles = await listAll('hr_profiles');

  let created = 0;
  for (const name of names) {
    if (existingNames.has(name)) {
      console.log(`  skip (already in hr_teams): ${name}`);
      continue;
    }
    const members = profiles.filter(p => Array.isArray(p.teams) && p.teams.includes(name)).map(p => p.email);
    await create('hr_teams', { name, lead_email: '', members, warehouse_id: '' });
    created++;
    console.log(`  created: ${name} (${members.length} member(s))`);
  }
  console.log(`Teams migration done. ${created} row(s) created.`);
}

async function main() {
  await migratePayroll();
  await migrateTeams();
  console.log('\nAll done. Verify hr_payroll and hr_teams in the PocketBase admin dashboard before deleting the old KV rows.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
