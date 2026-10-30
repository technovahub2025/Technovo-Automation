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

export const getCsvPhoneValidationRejectionReason = (value = "") => {
  const raw = String(value ?? "").trim();
  if (!raw) return "phone_value_empty";
  if (!/^\+?[\d\s().-]+$/.test(raw)) {
    return "phone_contains_unsupported_characters";
  }
  const digits = normalizeCsvPhone(raw);
  if (digits.length < 10 || digits.length > 15) {
    return "phone_digit_count_out_of_range";
  }
  return "";
};

export const getCsvParsedColumnCount = (row = {}) => {
  if (Array.isArray(row)) return row.length;
  if (!row || typeof row !== "object") return 0;
  const extraColumns = Array.isArray(row.__parsed_extra) ? row.__parsed_extra.length : 0;
  return Object.keys(row).filter((key) => key !== "__parsed_extra").length + extraColumns;
};

export const validateCsvPhoneRows = (rows = [], phoneField = "") => {
  const invalidRows = [];
  const validRows = [];

  rows.forEach((entry, index) => {
    const row = entry?.data && typeof entry.data === "object" ? entry.data : entry;
    const lineNumber = Number(entry?.lineNumber || row?.__csvLineNumber) || index + 2;
    const rawPhone = row?.[phoneField];
    const rejectionReason = getCsvPhoneValidationRejectionReason(rawPhone);
    if (rejectionReason) {
      invalidRows.push({ lineNumber, reason: rejectionReason });
      return;
    }
    const phone = normalizeCsvPhone(rawPhone);
    validRows.push({ row, lineNumber, phone });
  });

  return { validRows, invalidRows, totalRows: rows.length };
};
