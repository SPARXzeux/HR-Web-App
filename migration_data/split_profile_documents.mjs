// One-time migration: moves CV / passport / identity-document data OUT of
// hr_profile_extra_<id> KV rows (fetched in full by useProfiles() on every
// dashboard page load, including the login screen) and into their own
// hr_profile_docs_<id> KV rows (only fetched on demand, via
// useProfileDocuments(), when someone actually opens a documents view).
//
// This is the data-side half of a performance fix — the app code (see
// src/lib/hrData.ts) already reads/writes the new location going forward.
// Existing employees' already-uploaded documents are still sitting in the
// OLD hr_profile_extra_<id> rows until this script runs once. Until then,
// the app still displays them correctly (hrData.ts / useProfileDocuments
// reads whatever's actually in hr_profile_docs_<id>, which will be empty
// for anyone not yet migrated) — wait, more precisely: this script is what
// makes existing documents show up again in the new on-demand views, AND
// is what actually shrinks the payload useProfiles() downloads. Run it
// once, promptly, after deploying the hrData.ts changes.
//
// Safe to re-run: for each profile, if hr_profile_extra_<id> has no
// document fields left, it's skipped (already migrated or never had any).
//
// Usage:
//   node split_profile_documents.mjs
//
// Requires Node 18+ (built-in fetch). No dependencies.

const BASE = 'http://157.230.7.89';
const DOC_FIELDS = ['cvFileName', 'cvFileData', 'identityDocs', 'passportFileName', 'passportFileData'];

async function listAllKV(filter) {
  const results = [];
  let page = 1;
  for (;;) {
    const url = `${BASE}/api/collections/hr_delcargo_store/records?page=${page}&perPage=200&filter=${encodeURIComponent(filter)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    results.push(...(data.items || []));
    if (page >= (data.totalPages || 1)) break;
    page++;
  }
  return results;
}

async function getFirst(filter) {
  const url = `${BASE}/api/collections/hr_delcargo_store/records?perPage=1&filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Get failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.items?.[0] || null;
}

async function updateRecord(id, fields) {
  const res = await fetch(`${BASE}/api/collections/hr_delcargo_store/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createRecord(fields) {
  const res = await fetch(`${BASE}/api/collections/hr_delcargo_store/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('--- Splitting profile documents out of hr_profile_extra_ rows ---');
  const extraRows = await listAllKV('key ~ "hr_profile_extra_"');
  console.log(`Found ${extraRows.length} hr_profile_extra_ row(s).`);

  let migrated = 0;
  let skipped = 0;

  for (const row of extraRows) {
    const value = row.value || {};
    const docFields = {};
    let hasDocData = false;
    for (const field of DOC_FIELDS) {
      if (value[field] !== undefined) {
        docFields[field] = value[field];
        hasDocData = true;
      }
    }

    if (!hasDocData) {
      skipped++;
      continue;
    }

    const profileId = row.key.replace('hr_profile_extra_', '');
    const docsKey = `hr_profile_docs_${profileId}`;

    // Merge into (or create) the new hr_profile_docs_<id> row.
    const existingDocsRow = await getFirst(`key = "${docsKey}"`);
    if (existingDocsRow) {
      await updateRecord(existingDocsRow.id, { value: { ...(existingDocsRow.value || {}), ...docFields } });
    } else {
      await createRecord({ key: docsKey, value: docFields });
    }

    // Strip the document fields out of the old row so useProfiles() stops
    // downloading them.
    const strippedValue = { ...value };
    for (const field of DOC_FIELDS) delete strippedValue[field];
    await updateRecord(row.id, { value: strippedValue });

    migrated++;
    console.log(`  migrated: ${profileId}`);
  }

  console.log(`\nDone. ${migrated} profile(s) migrated, ${skipped} already clean/skipped.`);
  console.log('Spot-check a migrated employee\'s documents (profile page / HR review modal / DocumentsModal) before considering this complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
