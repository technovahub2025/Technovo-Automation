export const WORKFLOW_CAPABILITY_DEFS = [
  { key: 'audio', label: 'Audio', types: ['audio', 'greeting'] },
  { key: 'input', label: 'Input', types: ['input'] },
  { key: 'transfer', label: 'Transfer', types: ['transfer', 'handoff'] },
  { key: 'queue', label: 'Queue', types: ['queue'] },
  { key: 'booking', label: 'Booking', types: ['availability_check', 'slot_offer', 'booking_confirm', 'booking_create'] },
  { key: 'whatsapp', label: 'WhatsApp', types: ['whatsapp_notify'] },
  { key: 'voicemail', label: 'Voicemail', types: ['voicemail'] }
];

export const WORKFLOW_MONITOR_STAT_DEFS = [
  { key: 'totalCalls', label: 'Total Calls', tone: 'neutral', capability: null },
  { key: 'activeCalls', label: 'Active', tone: 'success', capability: null },
  { key: 'completedCalls', label: 'Completed', tone: 'neutral', capability: null },
  { key: 'failedCalls', label: 'Failed', tone: 'danger', capability: null },
  { key: 'timeoutCalls', label: 'Timeout', tone: 'warning', capability: null },
  { key: 'bookedCalls', label: 'Booked', tone: 'success', capability: 'booking' },
  { key: 'cancelledCalls', label: 'Cancelled', tone: 'danger', capability: 'booking' },
  { key: 'rejectedCalls', label: 'Rejected', tone: 'danger', capability: 'booking' },
  { key: 'whatsappSent', label: 'WhatsApp Sent', tone: 'success', capability: 'whatsapp' },
  { key: 'whatsappFailed', label: 'WhatsApp Failed', tone: 'danger', capability: 'whatsapp' },
  { key: 'transfers', label: 'Transfers', tone: 'neutral', capability: 'transfer' },
  { key: 'voicemailCalls', label: 'Voicemail', tone: 'neutral', capability: 'voicemail' },
  { key: 'queuedCalls', label: 'Queued', tone: 'neutral', capability: 'queue' },
  { key: 'avgQueueWaitLabel', label: 'Avg Queue Wait', tone: 'warning', capability: 'queue' }
];

const normalizeType = (value) => String(value || '').trim().toLowerCase();

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

export const resolveWorkflowName = (workflow = {}) => {
  const safeWorkflow = workflow || {};
  return String(
    safeWorkflow.displayName ||
    safeWorkflow.ivrName ||
    safeWorkflow.name ||
    safeWorkflow.promptKey ||
    'Workflow Monitor'
  ).trim();
};

export const resolveNodeLabel = (node = {}) => {
  const data = node.data || {};
  return (
    String(
      data.label ||
      data.title ||
      data.name ||
      data.messageText ||
      data.text ||
      node.label ||
      node.name ||
      ''
    ).trim() ||
    normalizeType(node.type).replace(/_/g, ' ') ||
    node.id ||
    'Unknown node'
  );
};

export const resolveNodeSummary = (node = {}) => {
  const data = node.data || {};
  const type = normalizeType(node.type);

  if (type === 'audio' || type === 'greeting') {
    return [
      data.mode ? `Mode ${data.mode}` : null,
      data.voice ? `Voice ${data.voice}` : null,
      data.language ? `Language ${data.language}` : null,
      data.afterPlayback ? `After ${data.afterPlayback}` : null,
      data.maxRetries ?? data.max_retries ? `Retries ${data.maxRetries ?? data.max_retries}` : null
    ].filter(Boolean).join(' • ') || 'Audio prompt configured';
  }

  if (type === 'input') {
    return [
      data.digit ? `Digit ${data.digit}` : null,
      data.action ? `Action ${data.action}` : null,
      data.timeoutSeconds ?? data.timeout ? `Timeout ${data.timeoutSeconds ?? data.timeout}` : null,
      data.maxAttempts ?? data.max_attempts ? `Attempts ${data.maxAttempts ?? data.max_attempts}` : null
    ].filter(Boolean).join(' • ') || 'Input routing configured';
  }

  if (type === 'transfer' || type === 'handoff') {
    return [
      data.destination || data.transferNumber ? `Destination ${data.destination || data.transferNumber}` : null,
      data.department ? `Department ${data.department}` : null,
      data.timeout ? `Timeout ${data.timeout}` : null
    ].filter(Boolean).join(' • ') || 'Transfer routing';
  }

  if (type === 'queue') {
    return [
      data.queueName || data.queue_name ? `Queue ${data.queueName || data.queue_name}` : null,
      data.workflowSid || data.workflow_sid ? `Workflow ${data.workflowSid || data.workflow_sid}` : null
    ].filter(Boolean).join(' • ') || 'Queue routing';
  }

  if (type === 'availability_check') {
    return [
      data.promptText || data.prompt_text ? `Prompt ${data.promptText || data.prompt_text}` : null,
      data.timezone ? `Timezone ${data.timezone}` : null,
      data.numDigits ?? data.num_digits ? `Digits ${data.numDigits ?? data.num_digits}` : null,
      data.maxRetries ?? data.max_retries ? `Retries ${data.maxRetries ?? data.max_retries}` : null
    ].filter(Boolean).join(' • ') || 'Availability check';
  }

  if (type === 'slot_offer') {
    return [
      data.promptText || data.prompt_text ? `Prompt ${data.promptText || data.prompt_text}` : null,
      data.offerText || data.offer_text ? `Offer ${data.offerText || data.offer_text}` : null,
      data.yesDigits || data.yes_digits ? `Yes ${data.yesDigits || data.yes_digits}` : null,
      data.noDigits || data.no_digits ? `No ${data.noDigits || data.no_digits}` : null
    ].filter(Boolean).join(' • ') || 'Slot offer';
  }

  if (type === 'booking_confirm') {
    return [
      data.promptText || data.prompt_text ? `Prompt ${data.promptText || data.prompt_text}` : null,
      data.yesDigits || data.yes_digits ? `Yes ${data.yesDigits || data.yes_digits}` : null,
      data.noDigits || data.no_digits ? `No ${data.noDigits || data.no_digits}` : null
    ].filter(Boolean).join(' • ') || 'Booking confirmation';
  }

  if (type === 'booking_create') {
    return [
      data.bookingReferencePrefix || data.booking_reference_prefix ? `Prefix ${data.bookingReferencePrefix || data.booking_reference_prefix}` : null,
      data.tokenPrefix || data.token_prefix ? `Token ${data.tokenPrefix || data.token_prefix}` : null,
      data.preventDuplicates ?? data.prevent_duplicates ? 'Duplicate guard enabled' : null
    ].filter(Boolean).join(' • ') || 'Booking creation';
  }

  if (type === 'whatsapp_notify') {
    return [
      data.customerRecipient || data.customer_recipient ? `Customer ${data.customerRecipient || data.customer_recipient}` : null,
      data.adminRecipient || data.admin_recipient ? `Admin ${data.adminRecipient || data.admin_recipient}` : null,
      data.customerTemplateName || data.customer_template_name ? `Customer template ${data.customerTemplateName || data.customer_template_name}` : null,
      data.adminTemplateName || data.admin_template_name ? `Admin template ${data.adminTemplateName || data.admin_template_name}` : null
    ].filter(Boolean).join(' • ') || 'WhatsApp notify';
  }

  if (type === 'voicemail') {
    return [
      data.mailbox ? `Mailbox ${data.mailbox}` : null,
      data.transcription ?? data.transcribe ? 'Transcription on' : null
    ].filter(Boolean).join(' • ') || 'Voicemail';
  }

  if (type === 'end') {
    return [
      data.reason || data.terminationType ? `Reason ${data.reason || data.terminationType}` : null,
      data.callbackDelay || data.callback_delay ? `Callback ${data.callbackDelay || data.callback_delay}` : null
    ].filter(Boolean).join(' • ') || 'End call';
  }

  return 'No additional configuration';
};

export const buildWorkflowCapabilityState = (workflow = {}) => {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes.filter(Boolean) : [];
  const edges = Array.isArray(workflow?.edges) ? workflow.edges.filter(Boolean) : [];
  const nodeMap = nodes.reduce((acc, node) => {
    const type = normalizeType(node.type);
    if (!type) return acc;
    if (!acc[type]) acc[type] = [];
    acc[type].push(node);
    return acc;
  }, {});

  const capabilities = WORKFLOW_CAPABILITY_DEFS
    .map((capability) => ({
      ...capability,
      nodes: capability.types.flatMap((type) => nodeMap[type] || []),
      enabled: capability.types.some((type) => Boolean(nodeMap[type]?.length))
    }))
    .filter((capability) => capability.enabled);

  const capabilityMap = capabilities.reduce((acc, capability) => {
    acc[capability.key] = capability;
    return acc;
  }, {});

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodesByType: nodeMap,
    capabilities,
    capabilityMap,
    nodes,
    edges
  };
};

export const buildWorkflowMonitorChrome = (capabilityState = {}) => {
  const capabilities = Array.isArray(capabilityState.capabilities) ? capabilityState.capabilities : [];
  const capabilityKeys = new Set(capabilities.map((capability) => capability.key));

  const visibleStats = WORKFLOW_MONITOR_STAT_DEFS.filter((stat) => !stat.capability || capabilityKeys.has(stat.capability));

  const visibleColumnGroups = new Set(['core']);
  ['input', 'transfer', 'queue', 'booking', 'whatsapp', 'voicemail', 'audio'].forEach((key) => {
    if (capabilityKeys.has(key)) visibleColumnGroups.add(key);
  });

  const visibleFilters = {
    booking: capabilityKeys.has('booking'),
    whatsapp: capabilityKeys.has('whatsapp'),
    queue: capabilityKeys.has('queue'),
    transfer: capabilityKeys.has('transfer'),
    voicemail: capabilityKeys.has('voicemail'),
    input: capabilityKeys.has('input')
  };

  return {
    capabilityKeys,
    visibleStats,
    visibleColumnGroups,
    visibleFilters,
    capabilityLabels: capabilities.map((capability) => capability.label),
    heroSubtitle: capabilities.length > 0
      ? `${capabilities.map((capability) => capability.label).join(' • ')} workflow`
      : 'Core call monitoring',
    statusLabel: capabilities.length > 0
      ? `${capabilities.length} capabilities detected`
      : 'Core call monitoring'
  };
};

export const filterWorkflowMonitorColumns = (columns = [], capabilityState = {}) => {
  const chrome = buildWorkflowMonitorChrome(capabilityState);
  const visibleGroups = chrome.visibleColumnGroups;
  const safeColumns = Array.isArray(columns) ? columns : [];

  return safeColumns.filter((column) => {
    const group = String(column?.group || 'core').trim().toLowerCase();
    return group === 'core' || visibleGroups.has(group);
  });
};

const ACTION_CAPABILITY_MAP = {
  booking: 'booking',
  cancelled: 'booking',
  rejected: 'booking',
  whatsapp: 'whatsapp',
  transfer: 'transfer',
  voicemail: 'voicemail',
  input: 'input',
  queue: 'queue'
};

export const filterWorkflowMonitorActionOptions = (actions = [], capabilityState = {}) => {
  const chrome = buildWorkflowMonitorChrome(capabilityState);
  const visibleFilters = chrome.visibleFilters;
  return Array.isArray(actions)
    ? actions.filter((action) => {
        if (!action || action === 'all') return true;
        const capability = ACTION_CAPABILITY_MAP[action];
        return !capability || visibleFilters[capability] || capabilityState.capabilityMap?.[capability];
      })
    : [];
};

export const getWorkflowMonitorRowTags = (row = {}) => {
  const tags = new Set();
  const bookingStatus = normalizeStatus(row.bookingStatus);
  const callStatus = normalizeStatus(row.callStatus);
  const customerWhatsAppStatus = normalizeStatus(row.customerWhatsAppStatus);
  const adminWhatsAppStatus = normalizeStatus(row.adminWhatsAppStatus);
  const queueName = String(row.queueName || '').trim();

  if (callStatus === 'running') tags.add('live');
  if (bookingStatus && bookingStatus !== 'not booked') tags.add('booking');
  if (bookingStatus === 'cancelled') tags.add('cancelled');
  if (bookingStatus === 'rejected') tags.add('rejected');
  if (row.transferAttempted || row.transferDestination) tags.add('transfer');
  if (queueName || Number(row.queuePosition || 0) > 0 || Number(row.queueWaitTime || 0) > 0) tags.add('queue');
  if (customerWhatsAppStatus && customerWhatsAppStatus !== 'not sent') tags.add('whatsapp');
  if (adminWhatsAppStatus && adminWhatsAppStatus !== 'not sent') tags.add('whatsapp');
  if (row.voicemailRecorded) tags.add('voicemail');
  if (row.lastInput) tags.add('input');
  if (callStatus === 'failed' || row.errorMessage) tags.add('error');
  if (callStatus === 'timeout') tags.add('timeout');
  if (callStatus === 'completed') tags.add('completed');
  return Array.from(tags);
};

export const computeWorkflowMonitorSummary = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const queueWaitSeconds = safeRows
    .map((row) => Number(row.queueWaitTime || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  const totalQueueWait = queueWaitSeconds.reduce((sum, value) => sum + value, 0);

  return {
    totalCalls: safeRows.length,
    activeCalls: safeRows.filter((row) => normalizeStatus(row.callStatus) === 'running').length,
    completedCalls: safeRows.filter((row) => normalizeStatus(row.callStatus) === 'completed').length,
    failedCalls: safeRows.filter((row) => normalizeStatus(row.callStatus) === 'failed').length,
    timeoutCalls: safeRows.filter((row) => normalizeStatus(row.callStatus) === 'timeout').length,
    bookedCalls: safeRows.filter((row) => ['reserved', 'confirmed'].includes(normalizeStatus(row.bookingStatus))).length,
    cancelledCalls: safeRows.filter((row) => normalizeStatus(row.bookingStatus) === 'cancelled').length,
    rejectedCalls: safeRows.filter((row) => normalizeStatus(row.bookingStatus) === 'rejected').length,
    whatsappSent: safeRows.filter((row) => normalizeStatus(row.customerWhatsAppStatus) === 'sent' || normalizeStatus(row.adminWhatsAppStatus) === 'sent').length,
    whatsappFailed: safeRows.filter((row) => normalizeStatus(row.customerWhatsAppStatus) === 'failed' || normalizeStatus(row.adminWhatsAppStatus) === 'failed').length,
    transfers: safeRows.filter((row) => row.transferAttempted || row.transferDestination).length,
    voicemailCalls: safeRows.filter((row) => row.voicemailRecorded).length,
    queuedCalls: safeRows.filter((row) => String(row.queueName || '').trim() || Number(row.queuePosition || 0) > 0 || Number(row.queueWaitTime || 0) > 0).length,
    avgQueueWaitSeconds: queueWaitSeconds.length > 0 ? totalQueueWait / queueWaitSeconds.length : 0,
    maxQueueWaitSeconds: queueWaitSeconds.length > 0 ? Math.max(...queueWaitSeconds) : 0
  };
};

