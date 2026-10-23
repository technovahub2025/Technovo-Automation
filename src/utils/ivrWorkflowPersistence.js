import { normalizeIVRMenus } from './inboundNormalizers.js';

export const buildIVRMenuRequestData = (menuName, config = {}) => {
  const nodes = Array.isArray(config?.nodes) ? config.nodes : [];
  const edges = Array.isArray(config?.edges) ? config.edges : [];
  const workflowConfig = {
    nodes,
    edges,
    settings: config?.config && typeof config.config === 'object' ? { ...config.config } : {}
  };

  return {
    menuName,
    name: config?.displayName || menuName,
    displayName: config?.displayName || menuName,
    workflowId: config?.workflowId || config?.menuId || config?.promptKey || menuName,
    promptKey: config?.promptKey || menuName,
    status: config?.status || 'draft',
    nodes,
    edges,
    workflowConfig,
    metadata: workflowConfig.settings
  };
};

const hasMenuList = (payload) =>
  Array.isArray(payload) ||
  Array.isArray(payload?.ivrMenus) ||
  Array.isArray(payload?.menus) ||
  Array.isArray(payload?.data) ||
  Array.isArray(payload?.data?.ivrMenus);

export const normalizeIVRMenuListResponse = (response) => {
  const payload = response?.data ?? response;
  if (!hasMenuList(payload)) {
    throw new Error('IVR menu response did not contain a workflow list.');
  }
  return normalizeIVRMenus(payload);
};
