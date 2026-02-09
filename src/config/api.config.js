// Voice options for IVR system
export const VOICE_OPTIONS = {
  BRITISH_ENGLISH: [
    { value: 'en-GB-SoniaNeural', label: 'SoniaNeural (Female, English)', language: 'en-GB', gender: 'Female' },
    { value: 'en-GB-RyanNeural', label: 'RyanNeural (Male, English)', language: 'en-GB', gender: 'Male' }
  ],
  
  TAMIL: [
    { value: 'ta-IN-PallaviNeural', label: 'PallaviNeural (Female, Tamil)', language: 'ta-IN', gender: 'Female' },
    { value: 'ta-IN-ValluvarNeural', label: 'ValluvarNeural (Male, Tamil)', language: 'ta-IN', gender: 'Male' }
  ]
};

// Routing types for call routing system
export const ROUTING_TYPES = {
  VIP: 'vip',
  DEPARTMENT: 'department',
  TIME_BASED: 'time_based',
  SKILL_BASED: 'skill_based',
  ROUND_ROBIN: 'round_robin'
};

// API endpoints
export const API_ENDPOINTS = {
  IVR: {
    MENUS: '/api/ivr/menus',
    PROMPTS: '/api/ivr/prompts',
    TEST: '/api/ivr/test'
  },
  ROUTING: {
    RULES: '/api/routing/rules',
    TEST: '/api/routing/test'
  },
  CALLS: {
    ANALYTICS: '/api/calls/analytics',
    QUEUE_STATUS: '/api/calls/queue-status',
    ACTIVE_CALLS: '/api/calls/active'
  }
};

// Default configurations
export const DEFAULT_CONFIGS = {
  IVR_MENU: {
    timeout: 10,
    maxRetries: 3,
    invalidOption: {
      message: 'Invalid option. Please try again.',
      action: 'repeat'
    }
  },
  ROUTING_RULE: {
    priority: 1,
    enabled: true,
    conditions: [],
    destination: ''
  }
};

// Voice settings
export const VOICE_SETTINGS = {
  DEFAULT_LANGUAGE: 'en-GB',
  DEFAULT_VOICE: 'en-GB-SoniaNeural',
  SPEECH_RATE: 1.0,
  PITCH: 0.0,
  VOLUME: 1.0
};
