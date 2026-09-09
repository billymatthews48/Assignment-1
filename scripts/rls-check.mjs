// Two-account Row Level Security verification script.
//
// Creates two throwaway accounts against your live Neon project, has each
// create a contact, then proves User A cannot read, update, or delete User
// B's contact (and vice versa) — i.e. RLS is actually enforced by Postgres,
// not just hidden by the UI.
//
// Each user's session runs in its own child Node process. This matters:
// Better Auth's client keeps session state in module-level fetch/JWT
// caches, so two `createClient()` instances created back-to-back *in the
// same process* can bleed into each other and silently share a session —
// an artifact of running two "users" in one process, not something that
// happens in real usage (every browser tab/profile is its own process with
// its own cookie jar). Spawning a separate process per user reproduces real
// isolation and avoids that false negative.
//
// Usage (run against a real Neon project with the schema in db/schema.sql
// already applied):
//
//   npm run rls-check
//
// Exits non-zero and prints which assertion failed if RLS is misconfigured.

import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

if (!authUrl || !dataApiUrl) {
  console.error(
    "Missing NEXT_PUBLIC_NEON_AUTH_URL / NEXT_PUBLIC_NEON_DATA_API_URL. " +
      "Run with: node --env-file=.env.local scripts/rls-check.mjs"
  );
  process.exit(1);
}

const WORKER_PATH = fileURLToPath(import.meta.url);

/** Runs one "action" in a fresh child process and returns its JSON result. */
function runInChildProcess(action, payload) {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PATH, ["--worker", action], {
      env: process.env,
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    child.send(payload ?? {});
    child.on("message", (msg) => resolve(msg));
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker for "${action}" exited with code ${code}`));
    });
    child.on("error", reject);
  });
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

async function orchestrate() {
  console.log("Creating two test accounts (each in its own process)...");
  const userA = await runInChildProcess("signup-and-create", { label: "a", name: "Alice's Contact" });
  const userB = await runInChildProcess("signup-and-create", { label: "b", name: "Bob's Contact" });
  console.log(`  User A: ${userA.email} -> contact ${userA.contactId}`);
  console.log(`  User B: ${userB.email} -> contact ${userB.contactId}`);

  assert(userA.userId !== userB.userId, "The two accounts have different user ids");
  assert(userA.contactId !== userB.contactId, "The two contacts have different ids");

  console.log("\nChecking SELECT isolation...");
  const aListing = await runInChildProcess("list", { cookiePair: userA.cookiePair });
  assert(
    !aListing.rows.some((c) => c.id === userB.contactId),
    "User A's contact list does not include User B's contact"
  );
  const bListing = await runInChildProcess("list", { cookiePair: userB.cookiePair });
  assert(
    !bListing.rows.some((c) => c.id === userA.contactId),
    "User B's contact list does not include User A's contact"
  );

  console.log("\nChecking cross-account READ isolation...");
  const aReadsB = await runInChildProcess("read-by-id", {
    cookiePair: userA.cookiePair,
    id: userB.contactId,
  });
  assert(aReadsB.rows.length === 0, "User A cannot read User B's contact by id");

  console.log("\nChecking cross-account UPDATE isolation...");
  await runInChildProcess("update-by-id", {
    cookiePair: userA.cookiePair,
    id: userB.contactId,
    name: "HACKED",
  });
  const bAfterAttack = await runInChildProcess("read-by-id", {
    cookiePair: userB.cookiePair,
    id: userB.contactId,
  });
  assert(
    bAfterAttack.rows[0]?.name === "Bob's Contact",
    "User A's update to User B's contact had no effect"
  );

  console.log("\nChecking cross-account DELETE isolation...");
  await runInChildProcess("delete-by-id", { cookiePair: userA.cookiePair, id: userB.contactId });
  const bStillThere = await runInChildProcess("read-by-id", {
    cookiePair: userB.cookiePair,
    id: userB.contactId,
  });
  assert(bStillThere.rows.length === 1, "User A's delete of User B's contact had no effect");

  console.log("\nCleaning up...");
  await runInChildProcess("delete-by-id", { cookiePair: userA.cookiePair, id: userA.contactId });
  await runInChildProcess("delete-by-id", { cookiePair: userB.cookiePair, id: userB.contactId });

  console.log(`\n${failures === 0 ? "PASSED" : "FAILED"}: ${failures} assertion failure(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

// --- Worker mode: everything below runs in a child process, one auth
// session per process, and reports its result back over IPC. ---

async function worker(action) {
  const { createClient } = await import("@neondatabase/neon-js");
  const { BetterAuthVanillaAdapter } = await import("@neondatabase/neon-js/auth/vanilla/adapters");
  const origin = "http://localhost:3001";

  const payload = await new Promise((resolve) => process.once("message", resolve));

  function clientFor(cookiePair) {
    return createClient({
      auth: {
        url: authUrl,
        adapter: BetterAuthVanillaAdapter({ fetchOptions: { headers: { origin, cookie: cookiePair } } }),
      },
      dataApi: { url: dataApiUrl },
    });
  }

  if (action === "signup-and-create") {
    const email = `rls-check-${payload.label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const password = `Sup3r-Secret-${Math.random().toString(36).slice(2)}`;

    const res = await fetch(`${authUrl}/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify({ email, password, name: `RLS Check ${payload.label}` }),
    });
    if (!res.ok) throw new Error(`Sign up failed: HTTP ${res.status} ${await res.text()}`);
    const cookiePair = res.headers.get("set-cookie").split(";")[0];

    const client = clientFor(cookiePair);
    const { data, error } = await client
      .from("contacts")
      .insert({ name: payload.name, priority: "high" })
      .select()
      .single();
    if (error) throw new Error(`Insert failed: ${error.message}`);

    process.send({ email, cookiePair, contactId: data.id, userId: data.user_id });
    return;
  }

  const client = clientFor(payload.cookiePair);

  if (action === "list") {
    const { data, error } = await client.from("contacts").select("*");
    if (error) throw new Error(error.message);
    process.send({ rows: data ?? [] });
  } else if (action === "read-by-id") {
    const { data, error } = await client.from("contacts").select("*").eq("id", payload.id);
    if (error) throw new Error(error.message);
    process.send({ rows: data ?? [] });
  } else if (action === "update-by-id") {
    await client.from("contacts").update({ name: payload.name }).eq("id", payload.id);
    process.send({ ok: true });
  } else if (action === "delete-by-id") {
    await client.from("contacts").delete().eq("id", payload.id);
    process.send({ ok: true });
  } else {
    throw new Error(`Unknown worker action: ${action}`);
  }
}

const workerFlagIndex = process.argv.indexOf("--worker");
if (workerFlagIndex !== -1) {
  const action = process.argv[workerFlagIndex + 1];
  worker(action)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`Worker error (${action}):`, err.message);
      process.exit(1);
    });
} else {
  orchestrate().catch((err) => {
    console.error("\nScript error:", err);
    process.exit(1);
  });
}
