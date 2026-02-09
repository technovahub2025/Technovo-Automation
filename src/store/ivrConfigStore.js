// IVR Configuration Store - Single Source of Truth
// Centralized configuration management for IVR systems

export const IVR_CONFIG_DEFAULTS = {
  ivrName: '',
  greeting: {
    text: '',
    audioUrl: null,
    audioAssetId: null,
    voice: 'en-US-AriaNeural'
  },
  menuOptions: [
    {
      digit: '1',
      label: '',
      action: 'transfer',
      destination: ''
    }
  ],
  settings: {
    timeout: 10,
    maxAttempts: 3,
    invalidInputMessage: 'Invalid selection. Please try again.'
  },
  status: 'draft',
  tags: [],
  workflowConfig: {
    industry: 'custom',
    nodes: [],
    edges: [],
    settings: {}
  }
};

/**
 * Build IVR payload with proper validation and merging
 * @param {Object} currentConfig - Current IVR configuration
 * @param {Object} updates - Updates to apply
 * @returns {Object} Validated and merged IVR configuration
 */
export const buildIVRPayload = (currentConfig, updates = {}) => {
  const merged = {
    ...IVR_CONFIG_DEFAULTS,
    ...currentConfig,
    ...updates,
    greeting: {
      ...IVR_CONFIG_DEFAULTS.greeting,
      ...currentConfig.greeting,
      ...updates.greeting,
    },
    settings: {
      ...IVR_CONFIG_DEFAULTS.settings,
      ...currentConfig.settings,
      ...updates.settings,
    },
    menuOptions: updates.menuOptions || currentConfig.menuOptions || IVR_CONFIG_DEFAULTS.menuOptions,
    workflowConfig: {
      ...IVR_CONFIG_DEFAULTS.workflowConfig,
      ...currentConfig.workflowConfig,
      ...updates.workflowConfig,
    }
  };

  // 🔒 HARD GUARANTEE - Validation
  if (!Array.isArray(merged.menuOptions) || merged.menuOptions.length === 0) {
    throw new Error('IVR menu must have at least one option');
  }

  // Validate menu options structure
  merged.menuOptions.forEach((option, index) => {
    if (!option.digit) {
      throw new Error(`Menu option ${index + 1} must have a digit`);
    }
    if (!option.action) {
      throw new Error(`Menu option ${index + 1} must have an action`);
    }
  });

  // Validate greeting
  if (!merged.greeting.text) {
    throw new Error('IVR must have a greeting message');
  }

  // Validate settings
  if (merged.settings.timeout < 1 || merged.settings.timeout > 60) {
    throw new Error('Timeout must be between 1 and 60 seconds');
  }

  if (merged.settings.maxAttempts < 1 || merged.settings.maxAttempts > 10) {
    throw new Error('Max attempts must be between 1 and 10');
  }

  return merged;
};

/**
 * Create new IVR configuration
 * @param {string} name - IVR name
 * @returns {Object} New IVR configuration
 */
export const createIVRConfig = (name) => {
  return buildIVRPayload({}, {
    ivrName: name,
    greeting: {
      text: `Welcome to ${name}. Please choose an option.`,
      voice: 'en-US-AriaNeural'
    },
    menuOptions: [
      {
        digit: '1',
        label: 'Customer Support',
        action: 'transfer',
        destination: '+10000000000'
      }
    ]
  });
};

/**
 * Update IVR configuration safely
 * @param {Object} currentConfig - Current configuration
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated configuration
 */
export const updateIVRConfig = (currentConfig, updates) => {
  return buildIVRPayload(currentConfig, updates);
};

/**
 * Validate IVR configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateIVRConfig = (config) => {
  const errors = [];

  try {
    buildIVRPayload(config);
    return { isValid: true, errors: [] };
  } catch (error) {
    return { isValid: false, errors: [error.message] };
  }
};

/**
 * Get configuration summary for display
 * @param {Object} config - IVR configuration
 * @returns {Object} Summary data
 */
export const getIVRSummary = (config) => {
  return {
    name: config.ivrName || 'Untitled IVR',
    greetingText: config.greeting?.text || 'No greeting set',
    optionCount: config.menuOptions?.length || 0,
    timeout: config.settings?.timeout || 10,
    maxAttempts: config.settings?.maxAttempts || 3,
    voice: config.greeting?.voice || 'Default',
    status: config.status || 'draft',
    nodeCount: config.workflowConfig?.nodes?.length || 0,
    edgeCount: config.workflowConfig?.edges?.length || 0,
    industry: config.workflowConfig?.industry || 'custom'
  };
};

/**
 * Format IVR configuration for API submission
 * @param {Object} config - IVR configuration
 * @returns {Object} API-ready payload
 */
export const formatForAPI = (config) => {
  const validated = buildIVRPayload(config);
  
  return {
    ...validated,
    updatedAt: new Date().toISOString(),
    // Add any API-specific formatting here
  };
};
