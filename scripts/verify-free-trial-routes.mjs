/**
 * End-to-end verification of the free-trial restriction against a running app.
 * Usage: node scripts/verify-free-trial-routes.mjs  (server must be up, e.g. `npm run dev:web`)
 *
 * Covers, through the real HTTP API:
 *  - first free claim succeeds (201)
 *  - second claim is refused with FREE_TRIAL_USED + the user-facing message
 *  - deleting the website does not restore the trial
 *  - concurrent duplicate claims: exactly one wins
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const jar = new Map();
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function call(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const cookie = cookieHeader();
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "omit" });
  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body };
}

const post = (path, body) =>
  call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function signup(email) {
  return post("/api/auth/signup", { name: "Free Trial Route Test", email, password: "correct horse battery staple 42" });
}

const randomSuffix = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function scenarioFreshUser() {
  console.log("--- scenario: add → free claim → delete → re-add blocked ---");
  jar.clear();
  const signupRes = await signup(`route-trial-${randomSuffix()}@example.com`);
  check("signup returns 201", signupRes.status === 201, JSON.stringify(signupRes.body));

  const first = await post("/api/websites", { url: "https://example.com", plan: "free", skipReachabilityCheck: true });
  check("first free claim returns 201", first.status === 201, JSON.stringify(first.body));
  check("201 includes websiteId", !!first.body?.websiteId, JSON.stringify(first.body));

  const second = await post("/api/websites", { url: "https://example.org", plan: "free", skipReachabilityCheck: true });
  check("second claim returns 409", second.status === 409, JSON.stringify(second.body));
  check(
    "409 code is FREE_TRIAL_USED",
    second.body?.error?.code === "FREE_TRIAL_USED",
    JSON.stringify(second.body),
  );
  check(
    "409 message is the user-facing message",
    second.body?.error?.message === "You have already used your free trial. Please choose a paid plan to continue.",
    JSON.stringify(second.body),
  );

  if (first.body?.websiteId) {
    const del = await call(`/api/websites/${first.body.websiteId}`, { method: "DELETE" });
    check("DELETE website returns 200", del.status === 200, JSON.stringify(del.body));
  }

  const third = await post("/api/websites", { url: "https://example.net", plan: "free", skipReachabilityCheck: true });
  check(
    "claim after deleting the website still returns 409 (trial remains used)",
    third.status === 409 && third.body?.error?.code === "FREE_TRIAL_USED",
    JSON.stringify(third.body),
  );
}

async function scenarioConcurrent() {
  console.log("--- scenario: two concurrent claims, exactly one wins ---");
  jar.clear();
  const signupRes = await signup(`route-trial-${randomSuffix()}@example.com`);
  check("signup returns 201", signupRes.status === 201, JSON.stringify(signupRes.body));

  const [a, b] = await Promise.all([
    post("/api/websites", { url: "https://example.com", plan: "free", skipReachabilityCheck: true }),
    post("/api/websites", { url: "https://example.org", plan: "free", skipReachabilityCheck: true }),
  ]);
  const statuses = [a.status, b.status].sort();
  check(
    "exactly one request succeeds with 201 and the other gets 409",
    statuses.length === 2 && statuses[0] === 201 && statuses[1] === 409,
    `statuses=${statuses.join(",")}`,
  );
}

await scenarioFreshUser();
await scenarioConcurrent();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
