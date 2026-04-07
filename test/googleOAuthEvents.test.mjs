import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGoogleOAuthTrustedOrigins,
  GOOGLE_OAUTH_ERROR_TYPE,
  GOOGLE_OAUTH_SUCCESS_TYPE,
  isGoogleOAuthEventOriginTrusted,
  isOAuthPopupOpen,
  resolveGoogleOAuthEvent
} from "../src/utils/googleOAuthEvents.js";

test("resolveGoogleOAuthEvent returns ignore for invalid payload", () => {
  assert.deepEqual(resolveGoogleOAuthEvent(null), { type: "ignore", message: "" });
  assert.deepEqual(resolveGoogleOAuthEvent("not-an-object"), { type: "ignore", message: "" });
  assert.deepEqual(resolveGoogleOAuthEvent({ type: "unknown_event" }), { type: "ignore", message: "" });
});

test("resolveGoogleOAuthEvent returns success for google oauth success payload", () => {
  const result = resolveGoogleOAuthEvent({ type: GOOGLE_OAUTH_SUCCESS_TYPE });
  assert.equal(result.type, "success");
  assert.equal(result.message, "Google Calendar connected successfully.");
});

test("resolveGoogleOAuthEvent returns error message from payload for oauth error", () => {
  const result = resolveGoogleOAuthEvent({
    type: GOOGLE_OAUTH_ERROR_TYPE,
    error: " Access blocked for this user "
  });
  assert.equal(result.type, "error");
  assert.equal(result.message, "Access blocked for this user");
});

test("resolveGoogleOAuthEvent falls back to default oauth error message", () => {
  const result = resolveGoogleOAuthEvent({
    type: GOOGLE_OAUTH_ERROR_TYPE,
    error: ""
  });
  assert.equal(result.type, "error");
  assert.equal(result.message, "Google Calendar connection failed.");
});

test("isOAuthPopupOpen reports popup open state correctly", () => {
  assert.equal(isOAuthPopupOpen(null), false);
  assert.equal(isOAuthPopupOpen({}), false);
  assert.equal(isOAuthPopupOpen({ closed: true }), false);
  assert.equal(isOAuthPopupOpen({ closed: false }), true);
});

test("buildGoogleOAuthTrustedOrigins returns deduped frontend/backend origins", () => {
  const trustedOrigins = buildGoogleOAuthTrustedOrigins({
    windowOrigin: "http://localhost:5173",
    apiBaseUrl: "http://localhost:3001/api"
  });

  assert.deepEqual(
    trustedOrigins.sort(),
    ["http://localhost:3001", "http://localhost:5173"].sort()
  );
});

test("buildGoogleOAuthTrustedOrigins ignores invalid origins", () => {
  const trustedOrigins = buildGoogleOAuthTrustedOrigins({
    windowOrigin: "not-a-url",
    apiBaseUrl: ""
  });
  assert.deepEqual(trustedOrigins, []);
});

test("isGoogleOAuthEventOriginTrusted accepts configured origin and rejects unknown origin", () => {
  const trustedOrigins = ["http://localhost:5173", "http://localhost:3001"];

  assert.equal(
    isGoogleOAuthEventOriginTrusted("http://localhost:3001", trustedOrigins),
    true
  );
  assert.equal(
    isGoogleOAuthEventOriginTrusted("https://malicious.example.com", trustedOrigins),
    false
  );
  assert.equal(
    isGoogleOAuthEventOriginTrusted("invalid-origin", trustedOrigins),
    false
  );
});
