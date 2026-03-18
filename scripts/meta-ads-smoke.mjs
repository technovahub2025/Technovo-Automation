// Meta Ads backend smoke test (non-destructive).
// Usage:
//   node scripts/meta-ads-smoke.mjs
// Optional env overrides:
//   API_BASE_URL   - defaults to VITE_API_BASE_URL or VITE_API_URL from .env
//   AUTH_TOKEN     - bearer token to use (falls back to token/authToken in .env if present)
//   AD_ACCOUNT_ID  - meta ad account id to save (optional)
//   PAGE_ID        - page id to save (optional)
//   WHATSAPP_NUM   - WhatsApp number to save (optional)
//   TOPUP_AMOUNT   - amount for wallet topup (default 1)
//
// The script stops on first failure and prints a concise summary.

import fs from "fs";
import path from "path";
import url from "url";
import axios from "axios";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

// Minimal .env parser (no quotes/escapes)
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce((acc, line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return acc;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      acc[key] = val;
      return acc;
    }, {});
}

const env = { ...loadDotEnv(envPath), ...process.env };

const baseURL =
  env.API_BASE_URL ||
  env.VITE_API_BASE_URL ||
  env.VITE_API_URL ||
  "http://localhost:3001";
const adminBase =
  env.VITE_API_ADMIN_URL ||
  env.ADMIN_API_BASE_URL ||
  env.ADMIN_URL ||
  baseURL;
const loginEmail = env.LOGIN_EMAIL || env.AUTH_EMAIL || "";
const loginPassword = env.LOGIN_PASSWORD || env.AUTH_PASSWORD || "";
let token =
  env.AUTH_TOKEN ||
  env.VITE_AUTH_TOKEN ||
  env.authToken ||
  env.token; // only accept explicit token values

const client = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});

const ctx = {
  adAccountId: env.AD_ACCOUNT_ID || "",
  pageId: env.PAGE_ID || "",
  whatsapp: env.WHATSAPP_NUM || "",
  topup: Number(env.TOPUP_AMOUNT || 1),
};

async function step(name, fn) {
  process.stdout.write(`▶ ${name} ... `);
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    console.log(`ok (${ms}ms)`);
    return result;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || String(err);
    console.error(`FAILED: ${msg}`);
    if (err?.response?.data) {
      console.error("  server response:", JSON.stringify(err.response.data, null, 2));
    }
    process.exitCode = 1;
    throw err;
  }
}

async function main() {
  console.log(`Base URL: ${baseURL}`);
  console.log(`Auth token: ${token ? "present" : "missing (requests may 401)"}`);

  // If no token but credentials provided, attempt login on adminBase
  if (!token && loginEmail && loginPassword) {
    await step(`login ${adminBase}/api/nexion/login`, async () => {
      try {
        const res = await axios.post(`${adminBase}/api/nexion/login`, {
          email: loginEmail,
          password: loginPassword,
        });
        token = res.data?.token;
      } catch (err) {
        // try superadmin as fallback
        const res = await axios.post(`${adminBase}/superadmin/login`, {
          email: loginEmail,
          password: loginPassword,
        });
        token = res.data?.token;
      }
      if (!token) throw new Error("Login did not return a token");
      client.defaults.headers.Authorization = `Bearer ${token}`;
      console.log("login ok");
    });
  }

  await step("overview", () => client.get("/api/meta-ads/overview"));

  const adAccountsResp = await step("adaccounts", () => client.get("/api/meta-ads/adaccounts"));
  if (!ctx.adAccountId && Array.isArray(adAccountsResp.data)) {
    ctx.adAccountId = adAccountsResp.data[0]?.id || "";
  }

  if (ctx.adAccountId) {
    await step("save-adaccount", () =>
      client.post("/api/meta-ads/save-adaccount", { adAccountId: ctx.adAccountId })
    );
  } else {
    console.log("ℹ skip save-adaccount (no AD_ACCOUNT_ID found)");
  }

  await step("connect", () => client.post("/api/meta-ads/connect"));
  await step("connect/auth-url", () =>
    client.post("/api/meta-ads/connect/auth-url", { origin: baseURL })
  );

  if (ctx.adAccountId || ctx.pageId || ctx.whatsapp) {
    await step("settings/selection", () =>
      client.post("/api/meta-ads/settings/selection", {
        selectedAdAccountId: ctx.adAccountId || undefined,
        selectedPageId: ctx.pageId || undefined,
        linkedWhatsappNumber: ctx.whatsapp || undefined,
      })
    );
  } else {
    console.log("ℹ skip settings/selection (no AD_ACCOUNT_ID/PAGE_ID/WHATSAPP_NUM provided)");
  }

  await step("campaigns/sync-all", () => client.post("/api/meta-ads/campaigns/sync-all"));

  await step("diagnostics", () => client.get("/api/meta-ads/diagnostics"));

  await step("wallet", () => client.get("/api/meta-ads/wallet"));

  if (Number.isFinite(ctx.topup) && ctx.topup > 0) {
    await step("wallet/topup", () =>
      client.post("/api/meta-ads/wallet/topup", { amount: ctx.topup })
    );
  } else {
    console.log("ℹ skip wallet/topup (invalid TOPUP_AMOUNT)");
  }

  console.log("✅ Meta Ads smoke test completed");
}

main().catch(() => {
  // step already set exitCode
});
