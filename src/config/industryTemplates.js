// Industry Templates for IVR Workflow Builder
// Pre-configured workflows for different business types

export const INDUSTRY_TEMPLATES = {
  hotel: {
    name: "Hotel Management",
    icon: "🏨",
    description: "Complete hotel IVR system with reservations, room service, and guest services",
    defaultFlow: {
      greeting: "Welcome to our hotel. Press 1 for reservations, 2 for room service, 3 for front desk, 4 for checkout.",
      nodes: [
        {
          id: "greeting_1",
          type: "greeting",
          position: { x: 100, y: 50 },
          data: {
            text: "Welcome to our hotel. How can I help you today?",
            voice: "en-US-AriaNeural",
            language: "en-US"
          }
        },
        {
          id: "input_1",
          type: "input",
          position: { x: 100, y: 150 },
          data: {
            digit: "1",
            label: "Reservations",
            action: "booking_service",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "booking_service_1",
          type: "booking_service",
          position: { x: 300, y: 100 },
          data: {
            service: "booking",
            industry: "hotel",
            api_endpoint: "/api/hotel/booking",
            confirmation_required: true
          }
        },
        {
          id: "input_2",
          type: "input",
          position: { x: 100, y: 250 },
          data: {
            digit: "2",
            label: "Room Service",
            action: "room_service",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "room_service_1",
          type: "transfer",
          position: { x: 300, y: 250 },
          data: {
            destination: "+1234567890",
            department: "room_service",
            ring_time: 30
          }
        },
        {
          id: "input_3",
          type: "input",
          position: { x: 100, y: 350 },
          data: {
            digit: "3",
            label: "Front Desk",
            action: "transfer_front_desk",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "front_desk_1",
          type: "transfer",
          position: { x: 300, y: 350 },
          data: {
            destination: "+1234567891",
            department: "front_desk",
            ring_time: 30
          }
        },
        {
          id: "input_4",
          type: "input",
          position: { x: 100, y: 450 },
          data: {
            digit: "4",
            label: "Checkout",
            action: "checkout_service",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "checkout_1",
          type: "voicemail",
          position: { x: 300, y: 450 },
          data: {
            mailbox: "checkout",
            transcription: true,
            notification_email: "checkout@hotel.com"
          }
        },
        {
          id: "repeat_1",
          type: "repeat",
          position: { x: 500, y: 300 },
          data: {
            repeat_type: "menu",
            max_repeats: 3,
            fallback_node: "voicemail_1"
          }
        },
        {
          id: "voicemail_1",
          type: "voicemail",
          position: { x: 700, y: 300 },
          data: {
            mailbox: "general",
            transcription: true,
            notification_email: "reception@hotel.com"
          }
        }
      ],
      edges: [
        { id: "edge_1", source: "greeting_1", target: "input_1" },
        { id: "edge_2", source: "input_1", target: "booking_service_1" },
        { id: "edge_3", source: "input_2", target: "room_service_1" },
        { id: "edge_4", source: "input_3", target: "front_desk_1" },
        { id: "edge_5", source: "input_4", target: "checkout_1" },
        { id: "edge_6", source: "booking_service_1", target: "repeat_1" },
        { id: "edge_7", source: "room_service_1", target: "repeat_1" },
        { id: "edge_8", source: "front_desk_1", target: "repeat_1" },
        { id: "edge_9", source: "checkout_1", target: "repeat_1" },
        { id: "edge_10", source: "repeat_1", target: "voicemail_1" }
      ]
    }
  },

  insurance: {
    name: "Insurance Services",
    icon: "🛡️",
    description: "Insurance IVR system for claims, policy information, and agent assistance",
    defaultFlow: {
      greeting: "Welcome to our insurance services. Press 1 for claims, 2 for policy information, 3 to speak with an agent.",
      nodes: [
        {
          id: "greeting_1",
          type: "greeting",
          position: { x: 100, y: 50 },
          data: {
            text: "Welcome to our insurance services. How can I assist you today?",
            voice: "en-US-AriaNeural",
            language: "en-US"
          }
        },
        {
          id: "input_1",
          type: "input",
          position: { x: 100, y: 150 },
          data: {
            digit: "1",
            label: "File a Claim",
            action: "claims_service",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "claims_service_1",
          type: "claims_service",
          position: { x: 300, y: 100 },
          data: {
            service: "claims",
            industry: "insurance",
            api_endpoint: "/api/insurance/claims",
            claim_types: ["auto", "home", "health", "life"],
            documentation_required: true
          }
        },
        {
          id: "input_2",
          type: "input",
          position: { x: 100, y: 250 },
          data: {
            digit: "2",
            label: "Policy Information",
            action: "policy_service",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "policy_service_1",
          type: "claims_service",
          position: { x: 300, y: 250 },
          data: {
            service: "policy",
            industry: "insurance",
            api_endpoint: "/api/insurance/policy",
            info_types: ["coverage", "premium", "deductible", "benefits"]
          }
        },
        {
          id: "input_3",
          type: "input",
          position: { x: 100, y: 350 },
          data: {
            digit: "3",
            label: "Speak with Agent",
            action: "transfer_agent",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "agent_1",
          type: "transfer",
          position: { x: 300, y: 350 },
          data: {
            destination: "+1234567892",
            department: "claims",
            ring_time: 45,
            queue_enabled: true
          }
        },
        {
          id: "emergency_1",
          type: "conditional",
          position: { x: 500, y: 200 },
          data: {
            condition: "emergency_detected",
            true_path: "emergency_transfer",
            false_path: "normal_flow"
          }
        },
        {
          id: "emergency_transfer",
          type: "transfer",
          position: { x: 700, y: 150 },
          data: {
            destination: "911",
            priority: "emergency",
            recording: true
          }
        }
      ],
      edges: [
        { id: "edge_1", source: "greeting_1", target: "input_1" },
        { id: "edge_2", source: "input_1", target: "claims_service_1" },
        { id: "edge_3", source: "input_2", target: "policy_service_1" },
        { id: "edge_4", source: "input_3", target: "agent_1" },
        { id: "edge_5", source: "claims_service_1", target: "emergency_1" },
        { id: "edge_6", source: "policy_service_1", target: "emergency_1" },
        { id: "edge_7", source: "emergency_1", target: "emergency_transfer", sourceHandle: "true" },
        { id: "edge_8", source: "emergency_1", target: "agent_1", sourceHandle: "false" }
      ]
    }
  },

  healthcare: {
    name: "Healthcare",
    icon: "🏥",
    description: "Healthcare IVR system for appointments, prescriptions, and emergency services",
    defaultFlow: {
      greeting: "Welcome to our healthcare center. Press 1 for appointments, 2 for prescriptions, 3 for emergency.",
      nodes: [
        {
          id: "greeting_1",
          type: "greeting",
          position: { x: 100, y: 50 },
          data: {
            text: "Welcome to our healthcare center. Please select an option.",
            voice: "en-US-AriaNeural",
            language: "en-US",
            hipaa_compliant: true
          }
        },
        {
          id: "input_1",
          type: "input",
          position: { x: 100, y: 150 },
          data: {
            digit: "1",
            label: "Appointments",
            action: "appointment_service",
            validation: { timeout: 15, maxAttempts: 3 },
            hipaa_required: true
          }
        },
        {
          id: "appointment_service_1",
          type: "appointment_service",
          position: { x: 300, y: 100 },
          data: {
            service: "appointment",
            industry: "healthcare",
            api_endpoint: "/api/healthcare/appointments",
            departments: ["general", "cardiology", "pediatrics", "emergency"],
            insurance_verification: true,
            hipaa_compliant: true
          }
        },
        {
          id: "input_2",
          type: "input",
          position: { x: 100, y: 250 },
          data: {
            digit: "2",
            label: "Prescriptions",
            action: "prescription_service",
            validation: { timeout: 15, maxAttempts: 3 },
            hipaa_required: true
          }
        },
        {
          id: "prescription_service_1",
          type: "appointment_service",
          position: { x: 300, y: 250 },
          data: {
            service: "prescription",
            industry: "healthcare",
            api_endpoint: "/api/healthcare/prescriptions",
            refill_types: ["routine", "urgent", "emergency"],
            pharmacy_integration: true,
            hipaa_compliant: true
          }
        },
        {
          id: "input_3",
          type: "input",
          position: { x: 100, y: 350 },
          data: {
            digit: "3",
            label: "Emergency",
            action: "emergency_protocol",
            validation: { timeout: 5, maxAttempts: 1 },
            priority: "high"
          }
        },
        {
          id: "emergency_triage",
          type: "conditional",
          position: { x: 300, y: 350 },
          data: {
            condition: "emergency_severity",
            true_path: "emergency_transfer",
            false_path: "urgent_care",
            triage_questions: ["breathing", "conscious", "bleeding", "pain_level"]
          }
        },
        {
          id: "emergency_transfer",
          type: "transfer",
          position: { x: 500, y: 300 },
          data: {
            destination: "911",
            priority: "emergency",
            recording: true,
            location_tracking: true
          }
        },
        {
          id: "urgent_care",
          type: "transfer",
          position: { x: 500, y: 400 },
          data: {
            destination: "+1234567893",
            department: "urgent_care",
            priority: "urgent",
            hipaa_compliant: true
          }
        },
        {
          id: "nurse_line",
          type: "transfer",
          position: { x: 300, y: 450 },
          data: {
            destination: "+1234567894",
            department: "nurse_line",
            available_24_7: true,
            hipaa_compliant: true
          }
        }
      ],
      edges: [
        { id: "edge_1", source: "greeting_1", target: "input_1" },
        { id: "edge_2", source: "input_1", target: "appointment_service_1" },
        { id: "edge_3", source: "input_2", target: "prescription_service_1" },
        { id: "edge_4", source: "input_3", target: "emergency_triage" },
        { id: "edge_5", source: "emergency_triage", target: "emergency_transfer", sourceHandle: "true" },
        { id: "edge_6", source: "emergency_triage", target: "urgent_care", sourceHandle: "false" },
        { id: "edge_7", source: "appointment_service_1", target: "nurse_line" },
        { id: "edge_8", source: "prescription_service_1", target: "nurse_line" }
      ]
    }
  },

  retail: {
    name: "Retail Store",
    icon: "🛍️",
    description: "Retail IVR system for store hours, product inquiries, and customer service",
    defaultFlow: {
      greeting: "Welcome to our store. Press 1 for store hours, 2 for product inquiries, 3 for customer service.",
      nodes: [
        {
          id: "greeting_1",
          type: "greeting",
          position: { x: 100, y: 50 },
          data: {
            text: "Welcome to our store. How can I help you today?",
            voice: "en-US-AriaNeural",
            language: "en-US"
          }
        },
        {
          id: "input_1",
          type: "input",
          position: { x: 100, y: 150 },
          data: {
            digit: "1",
            label: "Store Hours",
            action: "store_info",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "store_hours",
          type: "greeting",
          position: { x: 300, y: 100 },
          data: {
            text: "We are open Monday through Friday from 9 AM to 9 PM, Saturday from 10 AM to 8 PM, and Sunday from 11 AM to 6 PM.",
            voice: "en-US-AriaNeural",
            language: "en-US"
          }
        },
        {
          id: "input_2",
          type: "input",
          position: { x: 100, y: 250 },
          data: {
            digit: "2",
            label: "Product Inquiries",
            action: "product_service",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "product_service_1",
          type: "appointment_service",
          position: { x: 300, y: 250 },
          data: {
            service: "product_inquiry",
            industry: "retail",
            api_endpoint: "/api/retail/products",
            inventory_check: true,
            price_lookup: true
          }
        },
        {
          id: "input_3",
          type: "input",
          position: { x: 100, y: 350 },
          data: {
            digit: "3",
            label: "Customer Service",
            action: "transfer_customer_service",
            validation: { timeout: 10, maxAttempts: 3 }
          }
        },
        {
          id: "customer_service",
          type: "transfer",
          position: { x: 300, y: 350 },
          data: {
            destination: "+1234567895",
            department: "customer_service",
            ring_time: 30,
            queue_enabled: true
          }
        }
      ],
      edges: [
        { id: "edge_1", source: "greeting_1", target: "input_1" },
        { id: "edge_2", source: "input_1", target: "store_hours" },
        { id: "edge_3", source: "input_2", target: "product_service_1" },
        { id: "edge_4", source: "input_3", target: "customer_service" }
      ]
    }
  }
};

// Node types configuration for each industry
export const INDUSTRY_NODE_TYPES = {
  hotel: [
    { type: "greeting", name: "Welcome Message", icon: "👋", category: "basic" },
    { type: "input", name: "Customer Input", icon: "⌨️", category: "basic" },
    { type: "booking_service", name: "Booking Service", icon: "📅", category: "service" },
    { type: "transfer", name: "Transfer to Department", icon: "📞", category: "action" },
    { type: "voicemail", name: "Voicemail", icon: "📬", category: "action" },
    { type: "repeat", name: "Repeat Options", icon: "🔄", category: "control" },
    { type: "end", name: "End Call", icon: "🔚", category: "control" }
  ],
  
  insurance: [
    { type: "greeting", name: "Welcome Message", icon: "👋", category: "basic" },
    { type: "input", name: "Customer Input", icon: "⌨️", category: "basic" },
    { type: "claims_service", name: "Claims Service", icon: "📋", category: "service" },
    { type: "transfer", name: "Transfer to Agent", icon: "📞", category: "action" },
    { type: "conditional", name: "Emergency Check", icon: "🚨", category: "logic" },
    { type: "voicemail", name: "Voicemail", icon: "📬", category: "action" },
    { type: "repeat", name: "Repeat Options", icon: "🔄", category: "control" },
    { type: "end", name: "End Call", icon: "🔚", category: "control" }
  ],
  
  healthcare: [
    { type: "greeting", name: "Welcome Message", icon: "👋", category: "basic" },
    { type: "input", name: "Patient Input", icon: "⌨️", category: "basic" },
    { type: "appointment_service", name: "Appointment Service", icon: "🗓️", category: "service" },
    { type: "transfer", name: "Transfer to Nurse", icon: "📞", category: "action" },
    { type: "conditional", name: "Emergency Triage", icon: "🚨", category: "logic" },
    { type: "voicemail", name: "Voicemail", icon: "📬", category: "action" },
    { type: "repeat", name: "Repeat Options", icon: "🔄", category: "control" },
    { type: "end", name: "End Call", icon: "🔚", category: "control" }
  ],
  
  retail: [
    { type: "greeting", name: "Welcome Message", icon: "👋", category: "basic" },
    { type: "input", name: "Customer Input", icon: "⌨️", category: "basic" },
    { type: "appointment_service", name: "Product Service", icon: "📦", category: "service" },
    { type: "transfer", name: "Transfer to Service", icon: "📞", category: "action" },
    { type: "voicemail", name: "Voicemail", icon: "📬", category: "action" },
    { type: "repeat", name: "Repeat Options", icon: "🔄", category: "control" },
    { type: "end", name: "End Call", icon: "🔚", category: "control" }
  ]
};

// Helper function to get industry template
export function getIndustryTemplate(industry) {
  return INDUSTRY_TEMPLATES[industry] || null;
}

// Helper function to get node types for industry
export function getIndustryNodeTypes(industry) {
  return INDUSTRY_NODE_TYPES[industry] || INDUSTRY_NODE_TYPES.retail;
}

// Helper function to get all industries
export function getAllIndustries() {
  return Object.keys(INDUSTRY_TEMPLATES).map(key => ({
    key,
    ...INDUSTRY_TEMPLATES[key]
  }));
}
