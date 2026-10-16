const variableIndex = (header) => {
  const match = String(header || "").trim().match(/^var\s*([1-9]\d*)$/i);
  return match ? Number(match[1]) : null;
};

export const getCsvVariableFields = (fields = []) =>
  fields
    .filter((field) => variableIndex(field) !== null)
    .sort((a, b) => variableIndex(a) - variableIndex(b));

export const getCsvVariableNames = (fields = []) =>
  [...new Set(getCsvVariableFields(fields).map((field) => `var${variableIndex(field)}`))];

export const getRecipientVariableNames = (recipients = []) =>
  getCsvVariableNames(recipients.flatMap((recipient) =>
    [recipient, recipient?.data, recipient?.fullData, recipient?.data?.fullData]
      .flatMap((data) => Object.keys(data || {})),
  ));

export const getRecipientVariables = (recipient = {}) => {
  for (const data of [recipient, recipient?.data, recipient?.fullData, recipient?.attributes, recipient?.data?.fullData]) {
    if (Array.isArray(data?.variables) && data.variables.length > 0) return data.variables;
  }
  for (const data of [recipient?.fullData, recipient?.data, recipient?.attributes, recipient?.data?.fullData, recipient]) {
    const fields = getCsvVariableFields(Object.keys(data || {}));
    if (fields.length) return getCsvRowVariables(data, fields, "phone");
  }
  return [];
};

export const getCsvRowVariables = (row, fields, phoneField) => {
  const variableFields = getCsvVariableFields(fields);
  if (!variableFields.length) {
    // Preserve positional columns for existing CSVs with custom headers.
    return fields
      .filter((field) => String(field || "").trim() !== phoneField)
      .map((field) => String(row?.[field] ?? "").trim());
  }
  const values = [];
  for (const field of variableFields) {
    while (values.length < variableIndex(field)) values.push("");
    values[variableIndex(field) - 1] = String(row?.[field] ?? "").trim();
  }
  return values;
};
