export const prepareMetaTemplateText = (value) => ({
  text: String(value ?? ''),
  examples: []
});

export const extractTemplateVariableNumbers = (text = '') => {
  const matches = String(text || '').matchAll(/\{\{(\d+)\}\}/g);
  return [...new Set(Array.from(matches, (match) => Number(match[1])).filter((number) => number > 0))]
    .sort((left, right) => left - right);
};

export const insertNextTemplateVariable = (text = '', selectionStart = 0, selectionEnd = selectionStart) => {
  const body = String(text || '');
  const currentVariables = extractTemplateVariableNumbers(body);
  const number = (currentVariables.length ? Math.max(...currentVariables) : 0) + 1;
  const start = Math.max(0, Math.min(Number(selectionStart) || 0, body.length));
  const end = Math.max(start, Math.min(Number(selectionEnd) || start, body.length));
  const placeholder = `{{${number}}}`;
  return {
    text: `${body.slice(0, start)}${placeholder}${body.slice(end)}`,
    number,
    cursor: start + placeholder.length
  };
};
