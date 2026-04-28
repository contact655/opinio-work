/**
 * get_session_cookie.mjs
 *
 * Generates a Supabase Magic Link for the given email and outputs
 * a curl-ready Cookie header string.
 *
 * Usage:
 *   node scripts/get_session_cookie.mjs <email>
 *
 * Reads credentials from .env.local automatically.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "/Users/hisato/opinio-work/node_modules/@supabase/supabase-js/dist/index.mjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { createChunks } = require("/Users/hisato/opinio-work/node_modules/@supabase/ssr/dist/main/utils/chunker.js");

// ─── Args ─────────────────────────────────────────────────────────────────────

const email = process.argv[2]?.trim();
if (!email) {
  process.stderr.write("Usage: node scripts/get_session_cookie.mjs <email>\n");
  process.exit(1);
}

// ─── Load .env.local ──────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  process.stderr.write("Error: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local\n");
  process.exit(1);
}

// ─── Step 1: Generate Magic Link via admin client ──────────────────────────────

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: "http://localhost:3000" },
});

if (linkErr || !linkData) {
  process.stderr.write("generateLink error: " + (linkErr?.message ?? "no data") + "\n");
  process.exit(1);
}

// ─── Step 2: Extract token ────────────────────────────────────────────────────

const actionUrl = new URL(linkData.properties?.action_link ?? "");
const token = actionUrl.searchParams.get("token") ?? linkData.properties?.hashed_token;
if (!token) {
  process.stderr.write("No token in response: " + JSON.stringify(linkData) + "\n");
  process.exit(1);
}

// ─── Step 3: Verify OTP → session ─────────────────────────────────────────────

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: token,
});

if (verifyErr || !verifyData?.session) {
  process.stderr.write("verifyOtp error: " + (verifyErr?.message ?? "no session") + "\n");
  process.exit(1);
}

const session = verifyData.session;

// ─── Step 4: Build Cookie string via @supabase/ssr createChunks ───────────────

const cookieName = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const sessionJson = JSON.stringify({
  access_token:  session.access_token,
  refresh_token: session.refresh_token,
  token_type:    session.token_type,
  expires_in:    session.expires_in,
  expires_at:    session.expires_at,
  user:          session.user,
});

const chunks = createChunks(cookieName, sessionJson);
const cookieStr = chunks.map((c) => `${c.name}=${c.value}`).join("; ");

process.stdout.write(`Cookie: ${cookieStr}\n`);
process.stderr.write(`[info] user: ${session.user.email} | chunks: ${chunks.length}\n`);
