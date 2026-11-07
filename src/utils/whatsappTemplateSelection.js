export const getWhatsAppTemplateSelectionValue = (template = {}) =>
  JSON.stringify([
    String(template?.name || '').trim(),
    String(template?.language || '').trim()
  ]);

export const parseWhatsAppTemplateSelectionValue = (value = '') => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return { name: '', language: '' };

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return {
        name: String(parsed[0] || '').trim(),
        language: String(parsed[1] || '').trim()
      };
    }
  } catch {
    // Preserve legacy saved selections that stored just the template name.
  }

  return { name: rawValue, language: '' };
};

export const normalizeMetaWhatsAppTemplate = (template = {}) => {
  const components = Array.isArray(template.components) ? template.components : [];
  const body = components.find((component) => String(component?.type || '').toUpperCase() === 'BODY');
  const bodyText = String(body?.text || template?.content?.body || '').trim();
  const exampleRows = Array.isArray(body?.example?.body_text) ? body.example.body_text : [];
  const exampleValues = Array.isArray(exampleRows[0]) ? exampleRows[0] : [];
  const placeholderNumbers = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g))
    .map((match) => Number(match[1]))
    .filter((number, index, values) => number > 0 && values.indexOf(number) === index)
    .sort((left, right) => left - right);

  return {
    ...template,
    content: {
      ...(template.content && typeof template.content === 'object' ? template.content : {}),
      body: bodyText
    },
    variables: placeholderNumbers.map((number) => ({
      name: `var${number}`,
      example: String(exampleValues[number - 1] || '').trim(),
      required: false
    }))
  };
};
