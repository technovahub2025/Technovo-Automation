const DEFAULT_COUNTRY_CODE = String(
  import.meta.env?.VITE_WHATSAPP_DEFAULT_COUNTRY_CODE || "91",
)
  .replace(/\D/g, "")
  .trim();

const PHONE_HEADER_ALIASES = new Set([
  "phone",
  "phonenumber",
  "mobile",
  "mobilenumber",
  "whatsappnumber",
  "contact",
  "contactnumber",
  "telephone",
  "number",
]);

export const normalizeCsvHeader = (header = "") =>
  String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

export const findCsvPhoneField = (fields = []) => {
  const candidates = (Array.isArray(fields) ? fields : []).filter((field) =>
    PHONE_HEADER_ALIASES.has(normalizeCsvHeader(field)),
  );

  if (candidates.length > 1) {
    return { field: "", candidates, error: "ambiguous" };
  }
  if (!candidates.length) {
    return { field: "", candidates: [], error: "missing" };
  }
  return { field: candidates[0], candidates, error: "" };
};

export const normalizeCsvPhone = (value = "") => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Accept only phone formatting punctuation around digits. This avoids
  // turning values such as "ID 1234567890" into apparently valid numbers.
  if (!/^\+?[\d\s().-]+$/.test(raw)) return "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Preserve explicitly supplied country codes. For local 10-digit numbers,
  // retain the app's existing configured-country behavior.
  if (
    !raw.startsWith("+") &&
    digits.length === 10 &&
    DEFAULT_COUNTRY_CODE
  ) {
    digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  }
  return digits;
};

export const validateCsvPhoneRows = (rows = [], phoneField = "") => {
  const invalidRows = [];
  const validRows = [];

  rows.forEach((entry, index) => {
    const row = entry?.data && typeof entry.data === "object" ? entry.data : entry;
    const lineNumber = Number(entry?.lineNumber || row?.__csvLineNumber) || index + 2;
    const phone = normalizeCsvPhone(row?.[phoneField]);
    if (phone.length < 10 || phone.length > 15) {
      invalidRows.push({ lineNumber, reason: "Expected 10 to 15 phone digits." });
      return;
    }
    validRows.push({ row, lineNumber, phone });
  });

  return { validRows, invalidRows, totalRows: rows.length };
};
