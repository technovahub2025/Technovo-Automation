import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import Papa from "papaparse";
import { getCsvRowVariables } from "../src/utils/broadcastCsvVariables.js";
import { buildValidationRecipientPayload } from "../src/utils/broadcastValidationRecipient.js";

const require = createRequire(import.meta.url);
const { buildBroadcastAudienceValidation } = require("../../nexion_broadcast_backend/services/whatsappOutreach/policy.js");
const Broadcast = require("../../nexion_broadcast_backend/models/Broadcast.js");

test("validation recovers nested CSV values when recipient variables were cleared", () => {
  for (const key of ["data", "fullData", "attributes"]) {
    const recipient = { phone: "919876543210", variables: [], [key]: { "VAR 1": "https://srbtravels.online/" } };
    assert.deepEqual(buildValidationRecipientPayload(recipient).variables, ["https://srbtravels.online/"]);
  }
});

test("CSV URL variable survives validation response and broadcast storage", () => {
  const parsed = Papa.parse("phone,var1\n9500304530,https://srbtravels.online/", { header: true });
  const row = parsed.data[0];
  const recipient = {
    phone: `91${row.phone}`,
    variables: getCsvRowVariables(row, parsed.meta.fields, "phone"),
    data: row,
  };
  const request = JSON.parse(JSON.stringify(buildValidationRecipientPayload(recipient)));
  const validation = buildBroadcastAudienceValidation({
    recipients: [request],
    templateCategory: "utility",
  });
  assert.equal(validation.summary.eligible, 1);
  const broadcast = new Broadcast({
    name: "CSV variable regression",
    templateName: "srb_travel",
    recipients: JSON.parse(JSON.stringify(validation.eligibleRecipients)),
  });
  assert.deepEqual([...broadcast.recipients[0].variables], ["https://srbtravels.online/"]);
});

test("validation keeps each recipient's values and opt-out status", () => {
  const recipients = [
    { phone: "919876543210", variables: ["Alice"], data: { whatsappOptInStatus: "opted_out" } },
    { phone: "919876543211", variables: ["Bob"] },
  ].map(buildValidationRecipientPayload);
  assert.deepEqual(recipients.map((recipient) => recipient.variables), [["Alice"], ["Bob"]]);
  assert.equal(recipients[0].whatsappOptInStatus, "opted_out");
  assert.deepEqual(buildValidationRecipientPayload({ phone: "919876543210" }).variables, []);
});
