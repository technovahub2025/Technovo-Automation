const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getStableId = (entity, fallback = '') =>
  String(
    entity?._id ||
    entity?.id ||
    entity?.callSid ||
    entity?.sid ||
    entity?.promptKey ||
    entity?.menuName ||
    fallback ||
    ''
  );

export const normalizeQueueName = (value) => {
  const name = String(value || '').trim();
  return name || 'General';
};

export const normalizeInboundCall = (call = {}, fallbackId = '') => ({
  ...call,
  callSid: call.callSid || call.sid || call.id || fallbackId,
  phoneNumber: call.phoneNumber || call.from || call.callerNumber || call.caller?.phoneNumber || '-',
  queuedAt: call.queuedAt || call.queueEnteredAt || call.createdAt || null,
  createdAt: call.createdAt || call.timestamp || call.updatedAt || null,
  duration: toFiniteNumber(call.duration ?? call.durationSeconds, 0),
  status: call.status || call.callStatus || 'unknown'
});

export const normalizeQueueStatus = (raw) => {
  const source = raw?.queueStatus || raw?.queues || raw || {};
  if (!source || typeof source !== 'object') return {};

  if (source.name && Array.isArray(source.calls)) {
    return normalizeQueueStatus({ [source.name]: source.calls });
  }

  const normalized = {};
  Object.entries(source).forEach(([rawQueueName, queueValue]) => {
    const queueName = normalizeQueueName(queueValue?.name || rawQueueName);
    const calls = Array.isArray(queueValue)
      ? queueValue
      : Array.isArray(queueValue?.calls)
        ? queueValue.calls
        : null;

    if (!calls) return;

    normalized[queueName] = calls
      .map((caller, index) => ({
        ...normalizeInboundCall(caller, `${queueName}-${index}`),
        position: Number.isFinite(Number(caller?.position))
          ? Number(caller.position)
          : Number.isFinite(Number(caller?.queuePosition))
            ? Number(caller.queuePosition)
            : index + 1
      }))
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        const aTime = Date.parse(a.queuedAt || '');
        const bTime = Date.parse(b.queuedAt || '');
        if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
        if (!Number.isFinite(aTime)) return 1;
        if (!Number.isFinite(bTime)) return -1;
        return aTime - bTime;
      });
  });

  return normalized;
};

export const normalizeRoutingRule = (rule = {}) => ({
  ...rule,
  id: getStableId(rule),
  _id: rule._id || rule.id || '',
  priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 1,
  enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
  actionType: rule.actionType || (String(rule.action || '').startsWith('ivr:') ? 'ivr' : 'custom'),
  ivrMenuId: rule.ivrMenuId || '',
  ivrPromptKey: rule.ivrPromptKey || ''
});

export const normalizeRoutingRules = (responseData) => {
  const raw = responseData?.data?.data || responseData?.data || responseData?.routingRules || responseData?.rules || responseData || [];
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeRoutingRule)
    .filter((rule) => rule.id)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));
};

export const normalizeIVRMenu = (menu = {}) => {
  const nodes = Array.isArray(menu.workflowConfig?.nodes)
    ? menu.workflowConfig.nodes
    : Array.isArray(menu.nodes)
      ? menu.nodes
      : [];
  const edges = Array.isArray(menu.workflowConfig?.edges)
    ? menu.workflowConfig.edges
    : Array.isArray(menu.edges)
      ? menu.edges
      : [];
  const settings = menu.workflowConfig?.settings || menu.settings || menu.config || {};

  return {
    ...menu,
    _id: menu._id || menu.id || menu.promptKey || menu.menuName || '',
    id: menu.id || menu._id || menu.promptKey || menu.menuName || '',
    promptKey: menu.promptKey || menu.menuName || menu.name || '',
    displayName: menu.displayName || menu.ivrName || menu.name || menu.promptKey || 'Untitled IVR',
    status: String(menu.status || (menu.isActive ? 'active' : 'draft')).toLowerCase(),
    workflowConfig: {
      nodes,
      edges,
      settings
    },
    contactsUsed: toFiniteNumber(menu.contactsUsed, 0)
  };
};

export const normalizeIVRMenus = (data) => {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.ivrMenus)
      ? data.ivrMenus
      : Array.isArray(data?.menus)
        ? data.menus
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.ivrMenus)
            ? data.data.ivrMenus
            : [];

  return raw.map(normalizeIVRMenu).filter((menu) => getStableId(menu));
};

export const normalizeLead = (lead = {}) => ({
  ...lead,
  _id: lead._id || lead.id || lead.leadId || '',
  callerName: lead.callerName || lead.caller?.name || '',
  callerNumber: lead.callerNumber || lead.caller?.phoneNumber || lead.phoneNumber || '',
  notes: lead.notes || lead.bookingDetails?.notes || '',
  workflowName: lead.workflowName || lead.workflow?.displayName || '',
  workflowId: lead.workflowId || lead.workflow?._id || '',
  audioRecordings: Array.isArray(lead.audioRecordings) ? lead.audioRecordings : [],
  audioPrompts: Array.isArray(lead.audioPrompts)
    ? lead.audioPrompts
    : Array.isArray(lead.audioRecordings)
      ? lead.audioRecordings.map((item) => item?.url || item?.recordingUrl).filter(Boolean)
      : []
});

export const normalizePagination = (pagination = {}, fallback = {}) => {
  const limit = Math.max(1, toFiniteNumber(pagination.limit ?? fallback.limit, 50));
  const total = Math.max(0, toFiniteNumber(pagination.total ?? fallback.total, 0));
  return {
    page: Math.max(1, toFiniteNumber(pagination.page ?? fallback.page, 1)),
    limit,
    total,
    totalPages: Math.max(1, toFiniteNumber(pagination.totalPages ?? pagination.pages ?? Math.ceil(total / limit), 1))
  };
};
