import test from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import {
  getCsvVariableNames,
  getCsvRowVariables,
  getRecipientVariableNames,
} from "../src/utils/broadcastCsvVariables.js";

test("Excel CSV variables are detected and passed in template order", () => {
  const parsed = Papa.parse('\uFEFFphone,name,VAR 2, var1 \r\n919876543210,Contact,Second,First', { header: true });
  assert.deepEqual(getCsvVariableNames(parsed.meta.fields), ["var1", "var2"]);
  assert.deepEqual(getCsvRowVariables(parsed.data[0], parsed.meta.fields, "phone"), ["First", "Second"]);
});

test("CRM refresh detects variables in nested CSV data", () => {
  assert.deepEqual(getRecipientVariableNames([
    { phone: "919876543210", variables: ["Alice"], fullData: { var1: "Alice" } },
    { data: { "VAR 2": "" } },
    { data: { fullData: { var10: "Ten", var1: "Other" } } },
  ]), ["var1", "var2", "var10"]);
});

test("missing positions and empty values retain their template positions", () => {
  assert.deepEqual(getCsvRowVariables({ var2: 0, var3: "" }, ["phone", "var3", "var2"], "phone"), ["", "0", ""]);
});

test("custom positional CSV headers remain supported", () => {
  assert.deepEqual(getCsvRowVariables({ phone: "919876543210", name: "Alice", amount: 0 }, ["phone", "name", "amount"], "phone"), ["Alice", "0"]);
  assert.deepEqual(getCsvVariableNames(["phone", "name", "variable1", "var0"]), []);
});
