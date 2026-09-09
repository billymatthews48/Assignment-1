// Two-account Row Level Security verification script.
//
// Creates two throwaway accounts against your live Neon project, has each
// create a contact, then proves User A cannot read, update, or delete User
// B's contact (and vice versa) — i.e. RLS is actually enforced by Postgres,
// not just hidden by the UI.
//
// Usage (run against a real Neon project with the schema in db/schema.sql
// already applied):
//
//   node --env-file=.env.local scripts/rls-check.mjs
//
// Exits non-zero and prints which assertion failed if RLS is misconfigured.

import { createClient } from "@neondatabase/neon-js";
import { BetterAuthVanillaAdapter } from "@neondatabase/neon-js/auth/vanilla/adapters";

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

if (!authUrl || !dataApiUrl) {
  console.error(
    "Missing NEXT_PUBLIC_NEON_AUTH_URL / NEXT_PUBLIC_NEON_DATA_API_URL. " +
      "Run with: node --env-file=.env.local scripts/rls-check.mjs"
  );
  process.exit(1);
}

function makeClient() {
  return createClient({
    auth: { url: authUrl, adapter: BetterAuthVanillaAdapter() },
    dataApi: { url: dataApiUrl },
  });
}

function randomEmail(label) {
  return `rls-check-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}

async function signUp(client, label) {
  const email = randomEmail(label);
  const password = `Sup3r-Secret-${Math.random().toString(36).slice(2)}`;
  const { data, error } = await client.auth.signUp.email({
    email,
    password,
    name: `RLS Check ${label}`,
  });
  if (error) throw new Error(`Sign up failed for ${label}: ${error.message}`);
  return { email, password, userId: data?.user?.id };
}

async function main() {
  console.log("Creating two test accounts...");
  const clientA = makeClient();
  const clientB = makeClient();

  const userA = await signUp(clientA, "a");
  const userB = await signUp(clientB, "b");
  console.log(`  User A: ${userA.email}`);
  console.log(`  User B: ${userB.email}`);

  console.log("\nEach user creates one contact...");
  const { data: contactA, error: insertAErr } = await clientA
    .from("contacts")
    .insert({ name: "Alice's Contact", priority: "high" })
    .select()
    .single();
  if (insertAErr) throw new Error(`Insert for A failed: ${insertAErr.message}`);

  const { data: contactB, error: insertBErr } = await clientB
    .from("contacts")
    .insert({ name: "Bob's Contact", priority: "low" })
    .select()
    .single();
  if (insertBErr) throw new Error(`Insert for B failed: ${insertBErr.message}`);

  console.log("\nChecking SELECT isolation...");
  const { data: aListing } = await clientA.from("contacts").select("*");
  assert(
    !aListing?.some((c) => c.id === contactB.id),
    "User A's contact list does not include User B's contact"
  );

  const { data: bListing } = await clientB.from("contacts").select("*");
  assert(
    !bListing?.some((c) => c.id === contactA.id),
    "User B's contact list does not include User A's contact"
  );

  console.log("\nChecking direct fetch-by-id isolation...");
  const { data: aReadingB } = await clientA.from("contacts").select("*").eq("id", contactB.id);
  assert((aReadingB ?? []).length === 0, "User A cannot read User B's contact by id");

  console.log("\nChecking UPDATE isolation...");
  await clientA.from("contacts").update({ name: "Hacked" }).eq("id", contactB.id);
  const { data: bAfterAttack } = await clientB
    .from("contacts")
    .select("*")
    .eq("id", contactB.id)
    .single();
  assert(
    bAfterAttack?.name === "Bob's Contact",
    "User A's update to User B's contact had no effect"
  );

  console.log("\nChecking DELETE isolation...");
  await clientA.from("contacts").delete().eq("id", contactB.id);
  const { data: bStillThere } = await clientB
    .from("contacts")
    .select("*")
    .eq("id", contactB.id)
    .single();
  assert(bStillThere?.id === contactB.id, "User A's delete of User B's contact had no effect");

  console.log("\nCleaning up...");
  await clientA.from("contacts").delete().eq("id", contactA.id);
  await clientB.from("contacts").delete().eq("id", contactB.id);

  console.log(`\n${failures === 0 ? "PASSED" : "FAILED"}: ${failures} assertion failure(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nScript error:", err);
  process.exit(1);
});
