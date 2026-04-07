import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Grip,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  Save,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import whatsappWorkflowService from "../services/whatsappWorkflowService";

const STORAGE_LIBRARY_KEY = "nexion_whatsapp_workflow_library";
const STORAGE_ACTIVE_KEY = "nexion_whatsapp_workflow_active";
const GRID_SIZE = 28;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;
const DEFAULT_VIEWPORT = { x: 320, y: 180, zoom: 1 };
const NODE_WIDTH = 272;
const NODE_HEIGHT = 146;
const WORLD_ORIGIN = 4000;
const WORLD_SIZE = 8000;
const WORLD_PADDING = 24;
const WORLD_MIN_X = -WORLD_ORIGIN + WORLD_PADDING;
const WORLD_MIN_Y = -WORLD_ORIGIN + WORLD_PADDING;
const WORLD_MAX_X = WORLD_SIZE - WORLD_ORIGIN - NODE_WIDTH - WORLD_PADDING;
const WORLD_MAX_Y = WORLD_SIZE - WORLD_ORIGIN - NODE_HEIGHT - WORLD_PADDING;
const MAX_HISTORY = 80;

const CATEGORY_META = {
  trigger: {
    label: "Triggers",
    accent: "#34d399",
    shadow: "rgba(52, 211, 153, 0.24)",
  },
  action: {
    label: "Actions",
    accent: "#38bdf8",
    shadow: "rgba(56, 189, 248, 0.24)",
  },
  logic: {
    label: "Logic",
    accent: "#a78bfa",
    shadow: "rgba(167, 139, 250, 0.24)",
  },
  integration: {
    label: "Integrations",
    accent: "#fb923c",
    shadow: "rgba(251, 146, 60, 0.24)",
  },
  data: {
    label: "Data",
    accent: "#facc15",
    shadow: "rgba(250, 204, 21, 0.22)",
  },
};

const CATEGORY_ORDER = ["trigger", "action", "logic", "integration", "data"];

const NODE_LIBRARY = [
  {
    type: "message-received",
    category: "trigger",
    icon: "📩",
    title: "Message Received",
    description: "Start a workflow whenever a WhatsApp message arrives.",
    inputPorts: [],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Message Received",
      description: "Starts whenever a new inbound WhatsApp message is received.",
      triggerScope: "all-messages",
    },
  },
  {
    type: "schedule",
    category: "trigger",
    icon: "⏰",
    title: "Schedule",
    description: "Run on a cron-like schedule.",
    inputPorts: [],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Schedule",
      description: "Starts on a recurring schedule.",
      cron: "0 9 * * *",
      timezone: "Asia/Kolkata",
    },
  },
  {
    type: "keyword-match",
    category: "trigger",
    icon: "🔘",
    title: "Keyword Match",
    description: "Start when the incoming message contains defined keywords.",
    inputPorts: [],
    outputPorts: [{ id: "matched", label: "Match" }],
    defaults: {
      label: "Keyword Match",
      description: "Triggers when the message contains any matching keyword.",
      keywords: ["order status"],
      matchMode: "contains-any",
    },
  },
  {
    type: "contact-joined",
    category: "trigger",
    icon: "📞",
    title: "Contact Joined",
    description: "Start when a new contact is created or subscribed.",
    inputPorts: [],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Contact Joined",
      description: "Runs when a new WhatsApp contact enters the workspace.",
      source: "all",
    },
  },
  {
    type: "send-text",
    category: "action",
    icon: "💬",
    title: "Send Text Message",
    description: "Send a WhatsApp text reply.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Send Text Message",
      description: "Sends a text response back to the user.",
      message: "Hi {{name}}, how can I help you today?",
    },
  },
  {
    type: "send-media",
    category: "action",
    icon: "🖼️",
    title: "Send Media",
    description: "Send an image, video, or file.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Send Media",
      description: "Sends a media asset to the user.",
      mediaType: "image",
      mediaUrl: "",
      caption: "",
    },
  },
  {
    type: "send-template",
    category: "action",
    icon: "📋",
    title: "Send Template Message",
    description: "Send a pre-approved WhatsApp template.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Send Template Message",
      description: "Sends a WhatsApp template with variables.",
      templateName: "order_update",
      language: "en",
      templateParams: "{{name}}, {{status}}",
    },
  },
  {
    type: "send-location",
    category: "action",
    icon: "📍",
    title: "Send Location",
    description: "Send a pinned location to the contact.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Send Location",
      description: "Sends a location pin back to the contact.",
      latitude: "28.6139",
      longitude: "77.2090",
      locationLabel: "Main Support Center",
    },
  },
  {
    type: "mark-read",
    category: "action",
    icon: "✅",
    title: "Mark as Read",
    description: "Mark the conversation as read.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Mark as Read",
      description: "Marks the conversation thread as read.",
    },
  },
  {
    type: "assign-label",
    category: "action",
    icon: "🏷️",
    title: "Assign Label",
    description: "Apply a label to the conversation.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Assign Label",
      description: "Attaches a label for routing or reporting.",
      labelName: "Priority",
    },
  },
  {
    type: "assign-agent",
    category: "action",
    icon: "👤",
    title: "Assign Agent",
    description: "Route the chat to a teammate.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Assign Agent",
      description: "Assigns the conversation to a human agent.",
      agentName: "Support Team",
    },
  },
  {
    type: "if-else",
    category: "logic",
    icon: "🔀",
    title: "If/Else Condition",
    description: "Branch based on one or more conditions.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
    defaults: {
      label: "If/Else Condition",
      description: "Routes the workflow based on a condition.",
      conditions: [
        {
          id: "cond_1",
          field: "order.status",
          operator: "exists",
          value: "",
        },
      ],
      previewBranch: "yes",
    },
  },
  {
    type: "loop",
    category: "logic",
    icon: "🔁",
    title: "Loop",
    description: "Repeat a branch multiple times.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [
      { id: "repeat", label: "Repeat" },
      { id: "done", label: "Done" },
    ],
    defaults: {
      label: "Loop",
      description: "Repeats a step for a collection or a fixed count.",
      loopMode: "repeat-n",
      iterations: 3,
    },
  },
  {
    type: "wait",
    category: "logic",
    icon: "⏳",
    title: "Wait / Delay",
    description: "Pause execution for a period of time.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Continue" }],
    defaults: {
      label: "Wait / Delay",
      description: "Pauses before continuing the workflow.",
      duration: 5,
      unit: "minutes",
    },
  },
  {
    type: "random-split",
    category: "logic",
    icon: "🎲",
    title: "Random Split",
    description: "Distribute traffic across branches randomly.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
    defaults: {
      label: "Random Split",
      description: "Sends traffic randomly to A, B, or C.",
      weights: { a: 50, b: 30, c: 20 },
    },
  },
  {
    type: "http-request",
    category: "integration",
    icon: "🌐",
    title: "HTTP Request",
    description: "Call an external API.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "HTTP Request",
      description: "Fetches or posts data from an external API.",
      method: "GET",
      url: "https://api.example.com/orders/{{orderId}}",
      headersText: "Authorization: Bearer {{token}}",
      body: "",
    },
  },
  {
    type: "google-sheets",
    category: "integration",
    icon: "🗄️",
    title: "Google Sheets",
    description: "Read or write rows from a Google Sheet.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Google Sheets",
      description: "Reads or writes rows in Google Sheets.",
      operation: "append-row",
      spreadsheet: "",
      worksheet: "Sheet1",
    },
  },
  {
    type: "send-email",
    category: "integration",
    icon: "📧",
    title: "Send Email",
    description: "Send an email through Gmail or SMTP.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Send Email",
      description: "Escalates the event by email.",
      to: "ops@example.com",
      subject: "WhatsApp workflow alert",
      emailBody: "A workflow event needs review.",
    },
  },
  {
    type: "airtable",
    category: "integration",
    icon: "🗃️",
    title: "Airtable",
    description: "Read or write Airtable records.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Airtable",
      description: "Syncs fields with Airtable.",
      baseName: "",
      tableName: "",
      operation: "create-record",
    },
  },
  {
    type: "ai-reply",
    category: "integration",
    icon: "🤖",
    title: "AI Reply (OpenAI)",
    description: "Generate a reply using a prompt-driven AI response.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "AI Reply (OpenAI)",
      description: "Generates a WhatsApp response from a prompt.",
      model: "gpt-5.4-mini",
      temperature: 0.4,
      systemPrompt:
        "You are a helpful WhatsApp support assistant. Keep replies concise, clear, and friendly.",
      prompt:
        "Reply to the customer based on the latest message and the workflow context. Mention order status if available.",
    },
  },
  {
    type: "set-variable",
    category: "data",
    icon: "📝",
    title: "Set Variable",
    description: "Create or update a workflow variable.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Set Variable",
      description: "Creates a variable that later nodes can use.",
      variableName: "customerTier",
      variableValue: "gold",
    },
  },
  {
    type: "extract-data",
    category: "data",
    icon: "🔍",
    title: "Extract Data",
    description: "Pull values from text with patterns or keys.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Extract Data",
      description: "Extracts values from the inbound message.",
      sourceField: "message.text",
      pattern: "(ORDER-[0-9]+)",
    },
  },
  {
    type: "transform",
    category: "data",
    icon: "🔄",
    title: "Transform",
    description: "Map, filter, or format data.",
    inputPorts: [{ id: "in", label: "In" }],
    outputPorts: [{ id: "out", label: "Next" }],
    defaults: {
      label: "Transform",
      description: "Formats data for the next node.",
      transformExpression: "status.toUpperCase()",
    },
  },
];

const NODE_MAP = NODE_LIBRARY.reduce((accumulator, node) => {
  accumulator[node.type] = node;
  return accumulator;
}, {});

const DEFAULT_COLLAPSED = CATEGORY_ORDER.reduce((accumulator, category) => {
  accumulator[category] = false;
  return accumulator;
}, {});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function toFiniteNumber(value, fallback = 0) {
  const normalized =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isFinite(normalized) ? normalized : fallback;
}

function clampNodePosition(position) {
  return {
    x: clamp(toFiniteNumber(position?.x, 0), WORLD_MIN_X, WORLD_MAX_X),
    y: clamp(toFiniteNumber(position?.y, 0), WORLD_MIN_Y, WORLD_MAX_Y),
  };
}

function sanitizeViewport(viewport) {
  return {
    x: toFiniteNumber(viewport?.x, DEFAULT_VIEWPORT.x),
    y: toFiniteNumber(viewport?.y, DEFAULT_VIEWPORT.y),
    zoom: clamp(toFiniteNumber(viewport?.zoom, DEFAULT_VIEWPORT.zoom), MIN_ZOOM, MAX_ZOOM),
  };
}

function snapPoint(position, enabled) {
  const safePoint = clampNodePosition(position);
  if (!enabled) {
    return safePoint;
  }
  return clampNodePosition({
    x: Math.round(safePoint.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(safePoint.y / GRID_SIZE) * GRID_SIZE,
  });
}

function resolveNodeDefinition(nodeOrType) {
  if (!nodeOrType) {
    return NODE_LIBRARY[0];
  }
  const type = typeof nodeOrType === "string" ? nodeOrType : nodeOrType.type;
  return NODE_MAP[type] || NODE_LIBRARY[0];
}

function getSafeNodePosition(node) {
  return clampNodePosition(node?.position);
}

function getNodeBounds(node) {
  const position = getSafeNodePosition(node);
  return {
    x: position.x,
    y: position.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
}

function getWorkflowBounds(nodes) {
  if (!nodes.length) {
    return { x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT };
  }
  const xs = nodes.map((node) => toFiniteNumber(node?.position?.x, 0));
  const ys = nodes.map((node) => toFiniteNumber(node?.position?.y, 0));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs) + NODE_WIDTH;
  const maxY = Math.max(...ys) + NODE_HEIGHT;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function calculateFitViewport(nodes, canvasRect) {
  if (!canvasRect) {
    return DEFAULT_VIEWPORT;
  }
  const bounds = getWorkflowBounds(nodes);
  const padding = 160;
  const availableWidth = Math.max(canvasRect.width - padding, 320);
  const availableHeight = Math.max(canvasRect.height - padding, 240);
  const scaleX = availableWidth / Math.max(bounds.width, 1);
  const scaleY = availableHeight / Math.max(bounds.height, 1);
  const zoom = clamp(Math.min(scaleX, scaleY, 1.15), MIN_ZOOM, MAX_ZOOM);
  return sanitizeViewport({
    x: canvasRect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: canvasRect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  });
}

function screenToWorld(clientX, clientY, rect, viewport) {
  const safeViewport = sanitizeViewport(viewport);
  return {
    x: (clientX - rect.left - safeViewport.x) / safeViewport.zoom,
    y: (clientY - rect.top - safeViewport.y) / safeViewport.zoom,
  };
}

function worldToScreen(point, viewport) {
  const safeViewport = sanitizeViewport(viewport);
  return {
    x: point.x * safeViewport.zoom + safeViewport.x,
    y: point.y * safeViewport.zoom + safeViewport.y,
  };
}

function getPortWorldPosition(node, side, handleId) {
  const position = getSafeNodePosition(node);
  const definition = resolveNodeDefinition(node);
  if (side === "input") {
    return {
      x: position.x,
      y: position.y + NODE_HEIGHT / 2,
    };
  }

  const outputs = definition.outputPorts || [];
  const handleIndex = outputs.findIndex((port) => port.id === handleId);
  const index = handleIndex >= 0 ? handleIndex : 0;
  return {
    x: position.x + NODE_WIDTH,
    y: position.y + 48 + index * 28,
  };
}

function getBezierPath(start, end) {
  const deltaX = Math.abs(end.x - start.x);
  const controlOffset = clamp(deltaX * 0.45, 80, 220);
  return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${
    end.x - controlOffset
  } ${end.y}, ${end.x} ${end.y}`;
}

function buildSampleWorkflow() {
  const keywordId = createId("node");
  const httpId = createId("node");
  const ifId = createId("node");
  const foundId = createId("node");
  const missingId = createId("node");

  return {
    id: createId("workflow"),
    name: "Order Status Auto-Reply",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: keywordId,
        type: "keyword-match",
        position: { x: 160, y: 180 },
        data: {
          ...clone(resolveNodeDefinition("keyword-match").defaults),
          keywords: ["order status"],
        },
      },
      {
        id: httpId,
        type: "http-request",
        position: { x: 520, y: 180 },
        data: {
          ...clone(resolveNodeDefinition("http-request").defaults),
          label: "Fetch Order API",
          method: "GET",
          url: "https://api.example.com/orders/{{orderId}}",
        },
      },
      {
        id: ifId,
        type: "if-else",
        position: { x: 900, y: 180 },
        data: {
          ...clone(resolveNodeDefinition("if-else").defaults),
          label: "Order Found?",
          conditions: [
            {
              id: createId("cond"),
              field: "order.status",
              operator: "exists",
              value: "",
            },
          ],
          previewBranch: "yes",
        },
      },
      {
        id: foundId,
        type: "send-text",
        position: { x: 1290, y: 96 },
        data: {
          ...clone(resolveNodeDefinition("send-text").defaults),
          message: "Your order is: {{status}}",
        },
      },
      {
        id: missingId,
        type: "send-text",
        position: { x: 1290, y: 286 },
        data: {
          ...clone(resolveNodeDefinition("send-text").defaults),
          message: "Order not found. Please check your ID.",
        },
      },
    ],
    edges: [
      {
        id: createId("edge"),
        source: keywordId,
        sourceHandle: "matched",
        target: httpId,
        targetHandle: "in",
      },
      {
        id: createId("edge"),
        source: httpId,
        sourceHandle: "out",
        target: ifId,
        targetHandle: "in",
      },
      {
        id: createId("edge"),
        source: ifId,
        sourceHandle: "yes",
        target: foundId,
        targetHandle: "in",
      },
      {
        id: createId("edge"),
        source: ifId,
        sourceHandle: "no",
        target: missingId,
        targetHandle: "in",
      },
    ],
  };
}

function buildBlankWorkflow(sequence = 1) {
  const triggerId = createId("node");
  const textId = createId("node");

  return {
    id: createId("workflow"),
    name: `WhatsApp Workflow ${sequence}`,
    updatedAt: null,
    nodes: [
      {
        id: triggerId,
        type: "message-received",
        position: { x: 180, y: 200 },
        data: clone(resolveNodeDefinition("message-received").defaults),
      },
      {
        id: textId,
        type: "send-text",
        position: { x: 520, y: 200 },
        data: {
          ...clone(resolveNodeDefinition("send-text").defaults),
          message: "Thanks for reaching out. We will reply shortly.",
        },
      },
    ],
    edges: [
      {
        id: createId("edge"),
        source: triggerId,
        sourceHandle: "out",
        target: textId,
        targetHandle: "in",
      },
    ],
  };
}

function normalizeImportedWorkflow(raw) {
  const workflow = raw?.workflow || raw;
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow?.edges) ? workflow.edges : [];

  return {
    id: workflow?.id || createId("workflow"),
    name: workflow?.name || "Imported WhatsApp Workflow",
    updatedAt: workflow?.updatedAt || null,
    nodes: nodes.map((node, index) => {
      const definition = resolveNodeDefinition(node?.type);
      return {
        id: node?.id || createId("node"),
        type: definition.type,
        position: clampNodePosition({
          x: toFiniteNumber(node?.position?.x, 180 + index * 40),
          y: toFiniteNumber(node?.position?.y, 180 + index * 24),
        }),
        data: {
          ...clone(definition.defaults),
          ...(node?.data || {}),
        },
      };
    }),
    edges: edges
      .filter((edge) => edge?.source && edge?.target)
      .map((edge) => ({
        id: edge.id || createId("edge"),
        source: edge.source,
        sourceHandle: edge.sourceHandle || "out",
        target: edge.target,
        targetHandle: edge.targetHandle || "in",
      })),
  };
}

function loadWorkflowLibrary() {
  if (typeof window === "undefined") {
    const sample = buildSampleWorkflow();
    return { library: [sample], activeId: sample.id };
  }

  try {
    const savedLibrary = localStorage.getItem(STORAGE_LIBRARY_KEY);
    const savedActive = localStorage.getItem(STORAGE_ACTIVE_KEY);
    if (!savedLibrary) {
      const sample = buildSampleWorkflow();
      return { library: [sample], activeId: sample.id };
    }

    const parsed = JSON.parse(savedLibrary);
    const library = Array.isArray(parsed)
      ? parsed.map((item) => normalizeImportedWorkflow(item))
      : [];

    if (!library.length) {
      const sample = buildSampleWorkflow();
      return { library: [sample], activeId: sample.id };
    }

    return {
      library,
      activeId: library.some((item) => item.id === savedActive)
        ? savedActive
        : library[0].id,
    };
  } catch (error) {
    const sample = buildSampleWorkflow();
    return { library: [sample], activeId: sample.id };
  }
}

function snapshotWorkflow(state) {
  return {
    workflowId: state.workflowId,
    workflowName: state.workflowName,
    nodes: clone(state.nodes),
    edges: clone(state.edges),
  };
}

function appendHistory(state) {
  return {
    history: [...state.history.slice(-(MAX_HISTORY - 1)), snapshotWorkflow(state)],
    future: [],
  };
}

function getNodeColorByCategory(node) {
  return CATEGORY_META[resolveNodeDefinition(node).category].accent;
}

function getEdgeColor(edge, nodes) {
  const sourceNode = nodes.find((node) => node.id === edge.source);
  return sourceNode ? getNodeColorByCategory(sourceNode) : "#5eead4";
}

function readDraggedNodeType(event, fallbackRef) {
  const transfer = event?.dataTransfer;
  const custom = transfer?.getData?.("application/x-wa-node");
  if (custom) return custom;
  const plain = transfer?.getData?.("text/plain");
  if (plain) return plain;
  return fallbackRef?.current || "";
}

function hasPath(edges, startId, targetId, visited = new Set()) {
  if (startId === targetId) {
    return true;
  }
  if (visited.has(startId)) {
    return false;
  }
  visited.add(startId);
  return edges
    .filter((edge) => edge.source === startId)
    .some((edge) => hasPath(edges, edge.target, targetId, visited));
}

function createConnectionValidation(state, connection) {
  if (connection.source === connection.target) {
    return { valid: false, message: "Self-connections are not allowed." };
  }

  const duplicate = state.edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.target === connection.target &&
      edge.targetHandle === connection.targetHandle
  );

  if (duplicate) {
    return { valid: false, message: "That connection already exists." };
  }

  if (hasPath(state.edges, connection.target, connection.source)) {
    return {
      valid: false,
      message: "That connection would create a circular dependency.",
    };
  }

  return { valid: true };
}

function getClipboardPackage(nodes, edges, selectedIds) {
  const selectedSet = new Set(selectedIds);
  return {
    nodes: nodes.filter((node) => selectedSet.has(node.id)).map((node) => clone(node)),
    edges: edges
      .filter((edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target))
      .map((edge) => clone(edge)),
  };
}

function instantiateClipboardPackage(clipboard, anchorPosition = null, offset = { x: 40, y: 40 }) {
  if (!clipboard?.nodes?.length) {
    return { nodes: [], edges: [] };
  }

  const bounds = getWorkflowBounds(clipboard.nodes);
  const shift = anchorPosition
    ? { x: anchorPosition.x - bounds.x, y: anchorPosition.y - bounds.y }
    : offset;
  const idMap = {};

  const nodes = clipboard.nodes.map((node) => {
    const nextId = createId("node");
    idMap[node.id] = nextId;
    const position = getSafeNodePosition(node);
    return {
      ...clone(node),
      id: nextId,
      position: clampNodePosition({
        x: position.x + shift.x,
        y: position.y + shift.y,
      }),
    };
  });

  const edges = clipboard.edges.map((edge) => ({
    ...clone(edge),
    id: createId("edge"),
    source: idMap[edge.source],
    target: idMap[edge.target],
  }));

  return { nodes, edges };
}

function collectNodesInBox(nodes, selectionBox) {
  if (!selectionBox) {
    return [];
  }

  const x1 = Math.min(selectionBox.start.x, selectionBox.end.x);
  const y1 = Math.min(selectionBox.start.y, selectionBox.end.y);
  const x2 = Math.max(selectionBox.start.x, selectionBox.end.x);
  const y2 = Math.max(selectionBox.start.y, selectionBox.end.y);

  return nodes
    .filter((node) => {
      const bounds = getNodeBounds(node);
      return (
        bounds.x < x2 &&
        bounds.x + bounds.width > x1 &&
        bounds.y < y2 &&
        bounds.y + bounds.height > y1
      );
    })
    .map((node) => node.id);
}

function getNodePreview(node) {
  const data = node.data || {};
  switch (node.type) {
    case "keyword-match":
      return (data.keywords || []).join(", ") || "No keywords";
    case "send-text":
      return data.message || "Empty message";
    case "if-else":
      return (data.conditions || [])
        .map((condition) => `${condition.field} ${condition.operator} ${condition.value}`.trim())
        .join(" and ");
    case "http-request":
      return `${data.method || "GET"} ${data.url || ""}`.trim();
    case "wait":
      return `${data.duration || 0} ${data.unit || "minutes"}`;
    case "ai-reply":
      return data.prompt || "No AI prompt configured";
    case "assign-agent":
      return data.agentName || "No agent selected";
    case "assign-label":
      return data.labelName || "No label selected";
    case "set-variable":
      return `${data.variableName || "variable"} = ${data.variableValue || ""}`;
    case "extract-data":
      return data.pattern || "No extraction rule";
    case "transform":
      return data.transformExpression || "No transform expression";
    default:
      return data.description || resolveNodeDefinition(node).description;
  }
}

function getExecutionEdges(node, edges) {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  if (!outgoing.length) {
    return [];
  }

  if (node.type === "if-else") {
    const branch = node.data?.previewBranch || "yes";
    return outgoing.filter((edge) => edge.sourceHandle === branch);
  }

  if (node.type === "random-split") {
    const handles = Object.entries(node.data?.weights || {})
      .flatMap(([key, value]) => new Array(Math.max(Number(value), 1)).fill(key))
      .filter(Boolean);
    const selectedHandle = handles[Math.floor(Math.random() * handles.length)] || "a";
    return outgoing.filter((edge) => edge.sourceHandle === selectedHandle).slice(0, 1);
  }

  if (node.type === "loop") {
    const repeatCount = clamp(Number(node.data?.iterations || 1), 1, 4);
    const repeatEdge = outgoing.find((edge) => edge.sourceHandle === "repeat");
    const doneEdge = outgoing.find((edge) => edge.sourceHandle === "done");
    const planned = [];
    for (let index = 0; index < repeatCount && repeatEdge; index += 1) {
      planned.push(repeatEdge);
    }
    if (doneEdge) {
      planned.push(doneEdge);
    }
    return planned;
  }

  return outgoing;
}

function getNodeDelay(node) {
  if (node.type === "wait") {
    const multiplierMap = {
      seconds: 70,
      minutes: 120,
      hours: 160,
    };
    return clamp(
      Number(node.data?.duration || 1) * (multiplierMap[node.data?.unit] || 120),
      320,
      1400
    );
  }
  return 520;
}

function createInitialState() {
  const { library, activeId } = loadWorkflowLibrary();
  const activeWorkflow = library.find((item) => item.id === activeId) || library[0];

  return {
    workflowLibrary: library,
    workflowId: activeWorkflow.id,
    workflowName: activeWorkflow.name,
    nodes: clone(activeWorkflow.nodes),
    edges: clone(activeWorkflow.edges),
    viewport: DEFAULT_VIEWPORT,
    selectedNodeIds: [],
    activeNodeId: activeWorkflow.nodes[0]?.id || null,
    selectedEdgeId: null,
    hoveredEdgeId: null,
    connectionDraft: null,
    contextMenu: null,
    selectionBox: null,
    logs: [],
    nodeStatuses: {},
    isRunning: false,
    toast: null,
    snapToGrid: true,
    paletteSearch: "",
    canvasSearch: "",
    isCanvasSearchOpen: false,
    collapsedCategories: DEFAULT_COLLAPSED,
    clipboard: null,
    interactionMode: "pan",
    history: [],
    future: [],
    isDirty: false,
    lastSavedAt: activeWorkflow.updatedAt || null,
    fitRequest: 1,
    isSyncing: false,
  };
}

function editorReducer(state, action) {
  switch (action.type) {
    case "SET_VIEWPORT":
      return {
        ...state,
        viewport: sanitizeViewport(action.payload),
      };
    case "REQUEST_FIT":
      return {
        ...state,
        fitRequest: state.fitRequest + 1,
      };
    case "SET_PALETTE_SEARCH":
      return {
        ...state,
        paletteSearch: action.payload,
      };
    case "SET_CANVAS_SEARCH":
      return {
        ...state,
        canvasSearch: action.payload,
      };
    case "SET_CANVAS_SEARCH_OPEN":
      return {
        ...state,
        isCanvasSearchOpen: action.payload,
      };
    case "SET_INTERACTION_MODE":
      return {
        ...state,
        interactionMode: action.payload,
      };
    case "TOGGLE_CATEGORY":
      return {
        ...state,
        collapsedCategories: {
          ...state.collapsedCategories,
          [action.payload]: !state.collapsedCategories[action.payload],
        },
      };
    case "SET_CONTEXT_MENU":
      return {
        ...state,
        contextMenu: action.payload,
      };
    case "SET_CONNECTION_DRAFT":
      return {
        ...state,
        connectionDraft: action.payload,
      };
    case "SET_SELECTION_BOX":
      return {
        ...state,
        selectionBox: action.payload,
      };
    case "SET_TOAST":
      return {
        ...state,
        toast: action.payload,
      };
    case "SET_SYNCING":
      return {
        ...state,
        isSyncing: action.payload,
      };
    case "SYNC_LIBRARY": {
      const library = Array.isArray(action.payload?.library)
        ? action.payload.library.map((workflow) => normalizeImportedWorkflow(workflow))
        : [];
      if (!library.length) {
        return {
          ...state,
          workflowLibrary: [],
          isSyncing: false,
        };
      }

      const requestedId = action.payload?.activeId || state.workflowId;
      const activeWorkflow = library.find((item) => item.id === requestedId) || library[0];
      return {
        ...state,
        workflowLibrary: library,
        workflowId: activeWorkflow.id,
        workflowName: activeWorkflow.name,
        nodes: clone(activeWorkflow.nodes),
        edges: clone(activeWorkflow.edges),
        selectedNodeIds: [],
        activeNodeId: activeWorkflow.nodes[0]?.id || null,
        selectedEdgeId: null,
        nodeStatuses: {},
        logs: [],
        history: [],
        future: [],
        isDirty: false,
        lastSavedAt: activeWorkflow.updatedAt || null,
        fitRequest: state.fitRequest + 1,
        isSyncing: false,
      };
    }
    case "SYNC_SAVED_WORKFLOW": {
      const workflow = normalizeImportedWorkflow(action.payload?.workflow || {});
      const library = Array.isArray(action.payload?.library)
        ? action.payload.library.map((item) => normalizeImportedWorkflow(item))
        : state.workflowLibrary;

      return {
        ...state,
        workflowLibrary: library,
        workflowId: workflow.id,
        workflowName: workflow.name,
        nodes: clone(workflow.nodes),
        edges: clone(workflow.edges),
        selectedNodeIds: [],
        activeNodeId: workflow.nodes[0]?.id || null,
        selectedEdgeId: null,
        isDirty: false,
        lastSavedAt: workflow.updatedAt || new Date().toISOString(),
        toast: action.payload?.toast || {
          type: "success",
          message: "Workflow saved.",
        },
      };
    }
    case "CLEAR_TOAST":
      return {
        ...state,
        toast: null,
      };
    case "SET_HOVERED_EDGE":
      return {
        ...state,
        hoveredEdgeId: action.payload,
      };
    case "SET_SELECTED_EDGE":
      return {
        ...state,
        selectedEdgeId: action.payload,
        selectedNodeIds: [],
        activeNodeId: null,
      };
    case "SET_SELECTED_NODES":
      return {
        ...state,
        selectedNodeIds: action.payload,
        selectedEdgeId: null,
        activeNodeId: action.payload[action.payload.length - 1] || null,
      };
    case "SELECT_NODE": {
      const nextSelected = action.append
        ? Array.from(new Set([...state.selectedNodeIds, action.payload]))
        : [action.payload];
      return {
        ...state,
        selectedNodeIds: nextSelected,
        selectedEdgeId: null,
        activeNodeId: action.payload,
      };
    }
    case "PUSH_HISTORY":
      return {
        ...state,
        ...appendHistory(state),
      };
    case "SET_WORKFLOW_NAME":
      return {
        ...state,
        ...appendHistory(state),
        workflowName: action.payload,
        isDirty: true,
      };
    case "LOAD_WORKFLOW": {
      const workflow = normalizeImportedWorkflow(action.payload);
      return {
        ...state,
        workflowId: workflow.id,
        workflowName: workflow.name,
        nodes: clone(workflow.nodes),
        edges: clone(workflow.edges),
        selectedNodeIds: [],
        activeNodeId: workflow.nodes[0]?.id || null,
        selectedEdgeId: null,
        nodeStatuses: {},
        logs: [],
        history: [],
        future: [],
        isDirty: false,
        lastSavedAt: workflow.updatedAt || null,
        fitRequest: state.fitRequest + 1,
      };
    }
    case "NEW_WORKFLOW": {
      const workflow = buildBlankWorkflow(action.payload);
      return {
        ...state,
        workflowId: workflow.id,
        workflowName: workflow.name,
        nodes: workflow.nodes,
        edges: workflow.edges,
        selectedNodeIds: [],
        activeNodeId: workflow.nodes[0]?.id || null,
        selectedEdgeId: null,
        nodeStatuses: {},
        logs: [],
        history: [],
        future: [],
        isDirty: true,
        lastSavedAt: null,
        fitRequest: state.fitRequest + 1,
      };
    }
    case "IMPORT_WORKFLOW": {
      const workflow = normalizeImportedWorkflow(action.payload);
      return {
        ...state,
        workflowId: workflow.id,
        workflowName: workflow.name,
        nodes: workflow.nodes,
        edges: workflow.edges,
        selectedNodeIds: [],
        activeNodeId: workflow.nodes[0]?.id || null,
        selectedEdgeId: null,
        nodeStatuses: {},
        logs: [],
        history: [],
        future: [],
        isDirty: true,
        lastSavedAt: null,
        fitRequest: state.fitRequest + 1,
      };
    }
    case "SAVE_WORKFLOW": {
      const savedWorkflow = {
        id: state.workflowId,
        name: state.workflowName.trim() || "Untitled WhatsApp Workflow",
        nodes: clone(state.nodes),
        edges: clone(state.edges),
        updatedAt: new Date().toISOString(),
      };
      const existing = state.workflowLibrary.filter((item) => item.id !== savedWorkflow.id);
      const workflowLibrary = [savedWorkflow, ...existing].sort((left, right) => {
        return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
      });

      return {
        ...state,
        workflowLibrary,
        workflowName: savedWorkflow.name,
        isDirty: false,
        lastSavedAt: savedWorkflow.updatedAt,
        toast: {
          type: "success",
          message: "Workflow saved locally to WhatsApp Workflow.",
        },
      };
    }
    case "ADD_NODE": {
      const nextNode = {
        ...action.payload,
        position: clampNodePosition(action.payload?.position),
      };
      return {
        ...state,
        ...appendHistory(state),
        nodes: [...state.nodes, nextNode],
        selectedNodeIds: [nextNode.id],
        activeNodeId: nextNode.id,
        selectedEdgeId: null,
        isDirty: true,
      };
    }
    case "PATCH_NODE": {
      const nextNodes = state.nodes.map((node) =>
        node.id === action.payload.id
          ? {
              ...node,
              data: {
                ...node.data,
                ...action.payload.patch,
              },
            }
          : node
      );
      return {
        ...state,
        ...(action.recordHistory === false ? {} : appendHistory(state)),
        nodes: nextNodes,
        isDirty: true,
      };
    }
    case "MOVE_NODES": {
      const positions = action.payload;
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          positions[node.id]
            ? {
                ...node,
                position: clampNodePosition(positions[node.id]),
              }
            : node
        ),
        isDirty: true,
      };
    }
    case "DELETE_NODES": {
      const idsToDelete = new Set(action.payload);
      return {
        ...state,
        ...appendHistory(state),
        nodes: state.nodes.filter((node) => !idsToDelete.has(node.id)),
        edges: state.edges.filter(
          (edge) => !idsToDelete.has(edge.source) && !idsToDelete.has(edge.target)
        ),
        selectedNodeIds: [],
        activeNodeId: null,
        selectedEdgeId: null,
        isDirty: true,
      };
    }
    case "ADD_EDGE":
      return {
        ...state,
        ...appendHistory(state),
        edges: [...state.edges, action.payload],
        connectionDraft: null,
        selectedEdgeId: action.payload.id,
        selectedNodeIds: [],
        activeNodeId: null,
        isDirty: true,
      };
    case "DELETE_EDGE":
      return {
        ...state,
        ...appendHistory(state),
        edges: state.edges.filter((edge) => edge.id !== action.payload),
        selectedEdgeId: state.selectedEdgeId === action.payload ? null : state.selectedEdgeId,
        isDirty: true,
      };
    case "SET_CLIPBOARD":
      return {
        ...state,
        clipboard: action.payload,
        toast: action.payload
          ? {
              type: "info",
              message: `${action.payload.nodes.length} node${
                action.payload.nodes.length === 1 ? "" : "s"
              } copied.`,
            }
          : state.toast,
      };
    case "PASTE_CLIPBOARD": {
      const duplicated = instantiateClipboardPackage(
        state.clipboard,
        action.payload?.anchor || null,
        action.payload?.offset || undefined
      );
      if (!duplicated.nodes.length) {
        return state;
      }
      return {
        ...state,
        ...appendHistory(state),
        nodes: [...state.nodes, ...duplicated.nodes],
        edges: [...state.edges, ...duplicated.edges],
        selectedNodeIds: duplicated.nodes.map((node) => node.id),
        activeNodeId: duplicated.nodes[duplicated.nodes.length - 1]?.id || null,
        selectedEdgeId: null,
        isDirty: true,
      };
    }
    case "CLEAR_WORKFLOW":
      return {
        ...state,
        ...appendHistory(state),
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        activeNodeId: null,
        selectedEdgeId: null,
        isDirty: true,
        fitRequest: state.fitRequest + 1,
      };
    case "SET_RUNNING":
      return {
        ...state,
        isRunning: action.payload,
      };
    case "SET_NODE_STATUS":
      return {
        ...state,
        nodeStatuses: {
          ...state.nodeStatuses,
          [action.payload.nodeId]: action.payload.status,
        },
      };
    case "RESET_EXECUTION":
      return {
        ...state,
        nodeStatuses: {},
        logs: [],
      };
    case "APPEND_LOG":
      return {
        ...state,
        logs: [...state.logs, action.payload].slice(-120),
      };
    case "CLEAR_LOGS":
      return {
        ...state,
        logs: [],
      };
    case "TOGGLE_SNAP":
      return {
        ...state,
        snapToGrid: !state.snapToGrid,
      };
    case "UNDO": {
      if (!state.history.length) {
        return state;
      }
      const previous = state.history[state.history.length - 1];
      return {
        ...state,
        workflowId: previous.workflowId,
        workflowName: previous.workflowName,
        nodes: clone(previous.nodes),
        edges: clone(previous.edges),
        history: state.history.slice(0, -1),
        future: [snapshotWorkflow(state), ...state.future].slice(0, MAX_HISTORY),
        selectedNodeIds: [],
        activeNodeId: previous.nodes[0]?.id || null,
        selectedEdgeId: null,
        isDirty: true,
      };
    }
    case "REDO": {
      if (!state.future.length) {
        return state;
      }
      const nextSnapshot = state.future[0];
      return {
        ...state,
        workflowId: nextSnapshot.workflowId,
        workflowName: nextSnapshot.workflowName,
        nodes: clone(nextSnapshot.nodes),
        edges: clone(nextSnapshot.edges),
        history: [...state.history, snapshotWorkflow(state)].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        selectedNodeIds: [],
        activeNodeId: nextSnapshot.nodes[0]?.id || null,
        selectedEdgeId: null,
        isDirty: true,
      };
    }
    default:
      return state;
  }
}

function WhatsAppWorkflow() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState);
  const canvasRef = useRef(null);
  const importInputRef = useRef(null);
  const canvasSearchInputRef = useRef(null);
  const interactionRef = useRef(null);
  const paletteDragTypeRef = useRef("");
  const lastDraggedNodeTypeRef = useRef("");
  const palettePointerDragRef = useRef(null);
  const paletteClickSuppressRef = useRef(false);
  const nativePaletteDragRef = useRef(false);
  const autoFitGuardRef = useRef({ workflowId: null, lastAttemptAt: 0 });
  const runTokenRef = useRef(0);
  const stateRef = useRef(state);

  stateRef.current = state;

  const activeNode = useMemo(
    () => state.nodes.find((node) => node.id === state.activeNodeId) || null,
    [state.nodes, state.activeNodeId]
  );

  const filteredNodeLibrary = useMemo(() => {
    const query = state.paletteSearch.trim().toLowerCase();
    return CATEGORY_ORDER.reduce((accumulator, category) => {
      accumulator[category] = NODE_LIBRARY.filter((node) => node.category === category).filter(
        (node) => {
          if (!query) {
            return true;
          }
          const searchableText = `${node.title} ${node.description} ${node.type}`.toLowerCase();
          return searchableText.includes(query);
        }
      );
      return accumulator;
    }, {});
  }, [state.paletteSearch]);

  const matchedNodeIds = useMemo(() => {
    const query = state.canvasSearch.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return state.nodes
      .filter((node) => {
        const text = `${node.data?.label || ""} ${getNodePreview(node)} ${node.type}`.toLowerCase();
        return text.includes(query);
      })
      .map((node) => node.id);
  }, [state.canvasSearch, state.nodes]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(state.workflowLibrary));
    localStorage.setItem(STORAGE_ACTIVE_KEY, state.workflowId);
    return undefined;
  }, [state.workflowLibrary, state.workflowId]);

  useEffect(() => {
    let isActive = true;
    const syncFromBackend = async () => {
      dispatch({ type: "SET_SYNCING", payload: true });
      try {
        const result = await whatsappWorkflowService.listWorkflows();
        if (!isActive) {
          return;
        }

        if (Array.isArray(result.library) && result.library.length) {
          dispatch({
            type: "SYNC_LIBRARY",
            payload: {
              library: result.library,
              activeId: result.activeId,
            },
          });
          if (result.source === "remote") {
            dispatch({
              type: "SET_TOAST",
              payload: {
                type: "success",
                message: "Workflow library synced from backend.",
              },
            });
          }
        } else {
          dispatch({ type: "SET_SYNCING", payload: false });
        }
      } catch (error) {
        if (isActive) {
          dispatch({ type: "SET_SYNCING", payload: false });
        }
      }
    };

    syncFromBackend();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!state.fitRequest || !canvasRef.current) {
      return;
    }
    dispatch({
      type: "SET_VIEWPORT",
      payload: calculateFitViewport(state.nodes, canvasRef.current.getBoundingClientRect()),
    });
  }, [state.fitRequest, state.nodes]);

  useEffect(() => {
    if (!canvasRef.current || !state.nodes.length) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) {
      return;
    }

    const viewport = sanitizeViewport(state.viewport);
    const hasAnyVisibleNode = state.nodes.some((node) => {
      const nodeX = toFiniteNumber(node?.position?.x, 0) * viewport.zoom + viewport.x;
      const nodeY = toFiniteNumber(node?.position?.y, 0) * viewport.zoom + viewport.y;
      const nodeWidth = NODE_WIDTH * viewport.zoom;
      const nodeHeight = NODE_HEIGHT * viewport.zoom;

      return (
        nodeX + nodeWidth > 0 &&
        nodeY + nodeHeight > 0 &&
        nodeX < rect.width &&
        nodeY < rect.height
      );
    });

    if (hasAnyVisibleNode) {
      autoFitGuardRef.current = { workflowId: state.workflowId, lastAttemptAt: 0 };
      return;
    }

    const now = Date.now();
    const sameWorkflow = autoFitGuardRef.current.workflowId === state.workflowId;
    const lastAttemptAt = sameWorkflow ? autoFitGuardRef.current.lastAttemptAt : 0;
    if (sameWorkflow && now - lastAttemptAt < 600) {
      return;
    }

    autoFitGuardRef.current = { workflowId: state.workflowId, lastAttemptAt: now };
    const rafId = window.requestAnimationFrame(() => {
      dispatch({ type: "REQUEST_FIT" });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [state.nodes, state.viewport, state.workflowId]);

  useEffect(() => {
    if (!state.isCanvasSearchOpen || !canvasSearchInputRef.current) {
      return;
    }
    canvasSearchInputRef.current.focus();
    canvasSearchInputRef.current.select();
  }, [state.isCanvasSearchOpen]);

  useEffect(() => {
    if (!state.toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      dispatch({ type: "CLEAR_TOAST" });
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [state.toast]);

  const addNodeAt = useCallback(
    (type, position) => {
      const definition = resolveNodeDefinition(type);
      dispatch({
        type: "ADD_NODE",
        payload: {
          id: createId("node"),
          type: definition.type,
          position: snapPoint(position, state.snapToGrid),
          data: clone(definition.defaults),
        },
      });
      dispatch({ type: "SET_CONTEXT_MENU", payload: null });
    },
    [state.snapToGrid]
  );

  const startPalettePointerDrag = useCallback((event, type) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    palettePointerDragRef.current = {
      type,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }, []);

  const fitToScreen = useCallback(() => {
    if (!canvasRef.current) {
      return;
    }
    dispatch({
      type: "SET_VIEWPORT",
      payload: calculateFitViewport(
        stateRef.current.nodes,
        canvasRef.current.getBoundingClientRect()
      ),
    });
  }, []);

  const updateZoom = useCallback((delta, focusPoint = null) => {
    if (!canvasRef.current) {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const currentViewport = stateRef.current.viewport;
    const targetZoom = clamp(currentViewport.zoom + delta, MIN_ZOOM, MAX_ZOOM);
    const focus = focusPoint || { x: rect.width / 2, y: rect.height / 2 };
    const worldX = (focus.x - currentViewport.x) / currentViewport.zoom;
    const worldY = (focus.y - currentViewport.y) / currentViewport.zoom;
    dispatch({
      type: "SET_VIEWPORT",
      payload: {
        zoom: targetZoom,
        x: focus.x - worldX * targetZoom,
        y: focus.y - worldY * targetZoom,
      },
    });
  }, []);

  const deleteSelected = useCallback(() => {
    if (stateRef.current.selectedNodeIds.length) {
      dispatch({ type: "DELETE_NODES", payload: stateRef.current.selectedNodeIds });
      return;
    }
    if (stateRef.current.selectedEdgeId) {
      dispatch({ type: "DELETE_EDGE", payload: stateRef.current.selectedEdgeId });
    }
  }, []);

  const copySelection = useCallback(() => {
    const selectedIds = stateRef.current.selectedNodeIds;
    if (!selectedIds.length) {
      return;
    }
    dispatch({
      type: "SET_CLIPBOARD",
      payload: getClipboardPackage(
        stateRef.current.nodes,
        stateRef.current.edges,
        selectedIds
      ),
    });
  }, []);

  const pasteSelection = useCallback((anchor = null) => {
    if (!stateRef.current.clipboard) {
      dispatch({
        type: "SET_TOAST",
        payload: { type: "warning", message: "Clipboard is empty." },
      });
      return;
    }
    dispatch({
      type: "PASTE_CLIPBOARD",
      payload: anchor ? { anchor } : { offset: { x: 44, y: 44 } },
    });
  }, []);

  const duplicateNodes = useCallback((nodeIds) => {
    if (!nodeIds?.length) {
      return;
    }
    dispatch({
      type: "SET_CLIPBOARD",
      payload: getClipboardPackage(stateRef.current.nodes, stateRef.current.edges, nodeIds),
    });
    dispatch({ type: "PASTE_CLIPBOARD", payload: { offset: { x: 42, y: 42 } } });
  }, []);

  const handleSaveWorkflow = useCallback(async () => {
    const snapshot = {
      id: stateRef.current.workflowId,
      name: stateRef.current.workflowName.trim() || "Untitled WhatsApp Workflow",
      nodes: clone(stateRef.current.nodes),
      edges: clone(stateRef.current.edges),
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: "SAVE_WORKFLOW" });
    dispatch({ type: "SET_SYNCING", payload: true });

    try {
      const result = await whatsappWorkflowService.saveWorkflow(snapshot);
      dispatch({
        type: "SYNC_SAVED_WORKFLOW",
        payload: {
          workflow: result.workflow,
          library: result.library,
          toast:
            result.source === "remote"
              ? {
                  type: "success",
                  message: "Workflow saved to backend.",
                }
              : {
                  type: "warning",
                  message: "Backend unavailable. Saved locally only.",
                },
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_TOAST",
        payload: {
          type: "error",
          message: "Failed to save workflow to backend.",
        },
      });
    } finally {
      dispatch({ type: "SET_SYNCING", payload: false });
    }
  }, []);

  const runWorkflow = useCallback(async () => {
    if (stateRef.current.isRunning) {
      return;
    }
    const triggerNodes = stateRef.current.nodes.filter(
      (node) => resolveNodeDefinition(node).category === "trigger"
    );
    if (!triggerNodes.length) {
      dispatch({
        type: "SET_TOAST",
        payload: { type: "warning", message: "Add at least one trigger node to run the workflow." },
      });
      return;
    }

    runTokenRef.current += 1;
    const token = runTokenRef.current;

    dispatch({ type: "RESET_EXECUTION" });
    dispatch({ type: "SET_RUNNING", payload: true });
    dispatch({
      type: "APPEND_LOG",
      payload: {
        id: createId("log"),
        level: "info",
        message: `Run started for "${stateRef.current.workflowName}".`,
        timestamp: new Date().toLocaleTimeString(),
      },
    });

    const workflowSnapshot = {
      id: stateRef.current.workflowId,
      name: stateRef.current.workflowName,
      nodes: clone(stateRef.current.nodes),
      edges: clone(stateRef.current.edges),
      updatedAt: stateRef.current.lastSavedAt,
    };

    try {
      const remoteResult = await whatsappWorkflowService.runWorkflow(workflowSnapshot, {
        source: "builder",
      });
      dispatch({
        type: "APPEND_LOG",
        payload: {
          id: createId("log"),
          level: "success",
          message:
            remoteResult?.data?.message ||
            `Backend run accepted (${remoteResult?.endpoint || "workflow endpoint"}).`,
          timestamp: new Date().toLocaleTimeString(),
        },
      });
      dispatch({ type: "SET_RUNNING", payload: false });
      return;
    } catch (error) {
      dispatch({
        type: "APPEND_LOG",
        payload: {
          id: createId("log"),
          level: "warning",
          message: "Backend run unavailable. Switching to local simulation.",
          timestamp: new Date().toLocaleTimeString(),
        },
      });
    }

    const queue = triggerNodes.map((node) => ({ nodeId: node.id }));

    while (queue.length && token === runTokenRef.current) {
      const nextItem = queue.shift();
      const node = stateRef.current.nodes.find((item) => item.id === nextItem.nodeId);
      if (!node) {
        continue;
      }

      dispatch({
        type: "SET_NODE_STATUS",
        payload: { nodeId: node.id, status: "running" },
      });
      dispatch({
        type: "APPEND_LOG",
        payload: {
          id: createId("log"),
          level: "info",
          message: `Executing ${node.data?.label || resolveNodeDefinition(node).title}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      });

      await new Promise((resolve) => {
        window.setTimeout(resolve, getNodeDelay(node));
      });

      if (token !== runTokenRef.current) {
        break;
      }

      dispatch({
        type: "SET_NODE_STATUS",
        payload: { nodeId: node.id, status: "success" },
      });

      const outgoing = getExecutionEdges(node, stateRef.current.edges);
      if (!outgoing.length) {
        dispatch({
          type: "APPEND_LOG",
          payload: {
            id: createId("log"),
            level: "success",
            message: `${node.data?.label || resolveNodeDefinition(node).title} finished the branch.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        });
      }

      outgoing.forEach((edge) => {
        queue.push({ nodeId: edge.target });
      });
    }

    if (token === runTokenRef.current) {
      dispatch({
        type: "APPEND_LOG",
        payload: {
          id: createId("log"),
          level: "success",
          message: "Workflow run completed.",
          timestamp: new Date().toLocaleTimeString(),
        },
      });
      dispatch({ type: "SET_RUNNING", payload: false });
    }
  }, []);

  const testSingleNode = useCallback(async (node) => {
    if (!node) {
      return;
    }
    const workflowSnapshot = {
      id: stateRef.current.workflowId,
      name: stateRef.current.workflowName,
      nodes: clone(stateRef.current.nodes),
      edges: clone(stateRef.current.edges),
      updatedAt: stateRef.current.lastSavedAt,
    };

    try {
      const remoteResult = await whatsappWorkflowService.testNode(workflowSnapshot, node, {
        source: "builder",
      });
      dispatch({
        type: "SET_NODE_STATUS",
        payload: { nodeId: node.id, status: "success" },
      });
      dispatch({
        type: "APPEND_LOG",
        payload: {
          id: createId("log"),
          level: "success",
          message:
            remoteResult?.data?.message ||
            `Node test executed by backend (${remoteResult?.endpoint || "workflow endpoint"}).`,
          timestamp: new Date().toLocaleTimeString(),
        },
      });
      dispatch({
        type: "SET_TOAST",
        payload: {
          type: "success",
          message: "Node test completed on backend.",
        },
      });
      return;
    } catch (error) {
      dispatch({
        type: "APPEND_LOG",
        payload: {
          id: createId("log"),
          level: "warning",
          message: "Backend node test unavailable. Running local test.",
          timestamp: new Date().toLocaleTimeString(),
        },
      });
    }

    dispatch({
      type: "SET_NODE_STATUS",
      payload: { nodeId: node.id, status: "running" },
    });
    dispatch({
      type: "APPEND_LOG",
      payload: {
        id: createId("log"),
        level: "info",
        message: `Testing ${node.data?.label || resolveNodeDefinition(node).title}`,
        timestamp: new Date().toLocaleTimeString(),
      },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    dispatch({
      type: "SET_NODE_STATUS",
      payload: { nodeId: node.id, status: "success" },
    });
    dispatch({
      type: "SET_TOAST",
      payload: {
        type: "success",
        message: `Node test succeeded for ${node.data?.label || resolveNodeDefinition(node).title}.`,
      },
    });
  }, []);

  const handleImportFile = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        dispatch({ type: "IMPORT_WORKFLOW", payload: JSON.parse(String(reader.result)) });
        dispatch({
          type: "SET_TOAST",
          payload: { type: "success", message: "Workflow JSON imported." },
        });
      } catch (error) {
        dispatch({
          type: "SET_TOAST",
          payload: { type: "error", message: "That JSON file could not be imported." },
        });
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }, []);

  const handleExport = useCallback(() => {
    const workflow = {
      id: state.workflowId,
      name: state.workflowName,
      nodes: state.nodes,
      edges: state.edges,
      updatedAt: state.lastSavedAt,
    };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.workflowName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-workflow.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [state.workflowId, state.workflowName, state.nodes, state.edges, state.lastSavedAt]);

  const closeContextualUi = useCallback(() => {
    dispatch({ type: "SET_CONTEXT_MENU", payload: null });
    dispatch({ type: "SET_CONNECTION_DRAFT", payload: null });
  }, []);

  const handleCanvasMouseDown = useCallback((event) => {
    if (!canvasRef.current) {
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const target = event.target;
    const isNodeInteractive =
      target.closest("[data-node-card='true']") ||
      target.closest("[data-port='true']") ||
      target.closest("[data-edge-delete='true']");

    if (isNodeInteractive) {
      return;
    }

    if (event.button === 2) {
      dispatch({
        type: "SET_CONTEXT_MENU",
        payload: {
          x: event.clientX - canvasRect.left,
          y: event.clientY - canvasRect.top,
          world: screenToWorld(event.clientX, event.clientY, canvasRect, stateRef.current.viewport),
        },
      });
      return;
    }

    dispatch({ type: "SET_CONTEXT_MENU", payload: null });
    if (event.button === 0) {
      event.preventDefault();
    }

    if (stateRef.current.interactionMode === "pan") {
      interactionRef.current = {
        type: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: { ...stateRef.current.viewport },
      };
    } else {
      const world = screenToWorld(event.clientX, event.clientY, canvasRect, stateRef.current.viewport);
      interactionRef.current = {
        type: "select-box",
        startWorld: world,
      };
      dispatch({ type: "SET_SELECTION_BOX", payload: { start: world, end: world } });
      dispatch({ type: "SET_SELECTED_NODES", payload: [] });
    }
  }, []);

  const handleNodeMouseDown = useCallback((event, node) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const alreadySelected = stateRef.current.selectedNodeIds.includes(node.id);
    const nextSelected =
      alreadySelected && !event.shiftKey
        ? stateRef.current.selectedNodeIds
        : event.shiftKey
        ? Array.from(new Set([...stateRef.current.selectedNodeIds, node.id]))
        : [node.id];

    dispatch({ type: "SELECT_NODE", payload: node.id, append: event.shiftKey });
    dispatch({ type: "PUSH_HISTORY" });

    const validNodeIds = nextSelected.filter((id) =>
      stateRef.current.nodes.some((item) => item.id === id)
    );

    interactionRef.current = {
      type: "move-nodes",
      startClient: { x: event.clientX, y: event.clientY },
      nodeIds: validNodeIds,
      positions: Object.fromEntries(
        validNodeIds.map((id) => {
          const targetNode = stateRef.current.nodes.find((item) => item.id === id);
          return [id, getSafeNodePosition(targetNode)];
        })
      ),
    };
  }, []);

  const handleOutputPortClick = useCallback((event, nodeId, handleId) => {
    event.stopPropagation();
    const node = stateRef.current.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    const portPosition = getPortWorldPosition(node, "output", handleId);
    dispatch({
      type: "SET_CONNECTION_DRAFT",
      payload: {
        source: nodeId,
        sourceHandle: handleId,
        from: portPosition,
        to: portPosition,
      },
    });
  }, []);

  const handleInputPortClick = useCallback((event, nodeId) => {
    event.stopPropagation();
    const draft = stateRef.current.connectionDraft;
    if (!draft) {
      return;
    }

    const connection = {
      id: createId("edge"),
      source: draft.source,
      sourceHandle: draft.sourceHandle,
      target: nodeId,
      targetHandle: "in",
    };

    const validation = createConnectionValidation(stateRef.current, connection);
    if (!validation.valid) {
      dispatch({
        type: "SET_TOAST",
        payload: { type: "warning", message: validation.message },
      });
      dispatch({ type: "SET_CONNECTION_DRAFT", payload: null });
      return;
    }

    dispatch({ type: "ADD_EDGE", payload: connection });
  }, []);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!canvasRef.current) {
        return;
      }

      if (stateRef.current.connectionDraft) {
        const rect = canvasRef.current.getBoundingClientRect();
        dispatch({
          type: "SET_CONNECTION_DRAFT",
          payload: {
            ...stateRef.current.connectionDraft,
            to: screenToWorld(event.clientX, event.clientY, rect, stateRef.current.viewport),
          },
        });
      }

      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();

      if (interaction.type === "pan") {
        dispatch({
          type: "SET_VIEWPORT",
          payload: {
            ...interaction.startViewport,
            x: interaction.startViewport.x + (event.clientX - interaction.startClient.x),
            y: interaction.startViewport.y + (event.clientY - interaction.startClient.y),
          },
        });
        return;
      }

      if (interaction.type === "move-nodes") {
        const deltaX = (event.clientX - interaction.startClient.x) / stateRef.current.viewport.zoom;
        const deltaY = (event.clientY - interaction.startClient.y) / stateRef.current.viewport.zoom;
        const nextPositions = {};
        interaction.nodeIds.forEach((nodeId) => {
          const startPosition = interaction.positions[nodeId];
          if (!startPosition) {
            return;
          }
          nextPositions[nodeId] = snapPoint(
            {
              x: startPosition.x + deltaX,
              y: startPosition.y + deltaY,
            },
            stateRef.current.snapToGrid
          );
        });
        dispatch({ type: "MOVE_NODES", payload: nextPositions });
        return;
      }

      if (interaction.type === "select-box") {
        const world = screenToWorld(event.clientX, event.clientY, rect, stateRef.current.viewport);
        const selectionBox = { start: interaction.startWorld, end: world };
        dispatch({ type: "SET_SELECTION_BOX", payload: selectionBox });
        dispatch({
          type: "SET_SELECTED_NODES",
          payload: collectNodesInBox(stateRef.current.nodes, selectionBox),
        });
      }
    };

    const handleMouseUp = () => {
      interactionRef.current = null;
      dispatch({ type: "SET_SELECTION_BOX", payload: null });
    };

    const handleClick = () => {
      dispatch({ type: "SET_CONTEXT_MENU", payload: null });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    const handlePalettePointerMove = (event) => {
      const drag = palettePointerDragRef.current;
      if (!drag || nativePaletteDragRef.current) {
        return;
      }
      const movedX = Math.abs(event.clientX - drag.startX);
      const movedY = Math.abs(event.clientY - drag.startY);
      if (movedX > 5 || movedY > 5) {
        drag.moved = true;
      }
    };

    const handlePalettePointerUp = (event) => {
      const drag = palettePointerDragRef.current;
      palettePointerDragRef.current = null;
      if (!drag || nativePaletteDragRef.current || !canvasRef.current) {
        return;
      }

      const movedX = Math.abs(event.clientX - drag.startX);
      const movedY = Math.abs(event.clientY - drag.startY);
      const movedEnough = drag.moved || movedX > 2 || movedY > 2;
      if (!movedEnough) {
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const insideCanvas =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!insideCanvas) {
        return;
      }

      const world = screenToWorld(event.clientX, event.clientY, rect, stateRef.current.viewport);
      addNodeAt(drag.type, { x: world.x - NODE_WIDTH / 2, y: world.y - NODE_HEIGHT / 2 });
      paletteClickSuppressRef.current = true;
      window.setTimeout(() => {
        paletteClickSuppressRef.current = false;
      }, 0);
    };

    window.addEventListener("mousemove", handlePalettePointerMove);
    window.addEventListener("mouseup", handlePalettePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePalettePointerMove);
      window.removeEventListener("mouseup", handlePalettePointerUp);
    };
  }, [addNodeAt]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isInputElement =
        ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "REDO" : "UNDO" });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && !isInputElement) {
        event.preventDefault();
        copySelection();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && !isInputElement) {
        event.preventDefault();
        pasteSelection();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        dispatch({ type: "SET_CANVAS_SEARCH_OPEN", payload: true });
        return;
      }

      if (event.key === "Escape") {
        closeContextualUi();
        dispatch({ type: "SET_CANVAS_SEARCH_OPEN", payload: false });
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !isInputElement) {
        event.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeContextualUi, copySelection, deleteSelected, pasteSelection]);

  const handleWheel = useCallback(
    (event) => {
      if (!canvasRef.current) {
        return;
      }
      event.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      updateZoom(event.deltaY > 0 ? -0.08 : 0.08, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [updateZoom]
  );

  const handleCanvasDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (!canvasRef.current) {
        return;
      }
      const type =
        readDraggedNodeType(event, paletteDragTypeRef) || lastDraggedNodeTypeRef.current;
      if (!type) {
        return;
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const world = screenToWorld(
        event.clientX,
        event.clientY,
        rect,
        stateRef.current.viewport
      );
      addNodeAt(type, { x: world.x - NODE_WIDTH / 2, y: world.y - NODE_HEIGHT / 2 });
      paletteDragTypeRef.current = "";
      lastDraggedNodeTypeRef.current = "";
      nativePaletteDragRef.current = false;
    },
    [addNodeAt]
  );

  const handleMiniMapClick = useCallback(
    (event) => {
      if (!canvasRef.current) {
        return;
      }

      const minimapRect = event.currentTarget.getBoundingClientRect();
      const bounds = getWorkflowBounds(state.nodes);
      const clickX = event.clientX - minimapRect.left;
      const clickY = event.clientY - minimapRect.top;
      const scale = Math.min(
        (minimapRect.width - 24) / Math.max(bounds.width, 1),
        (minimapRect.height - 24) / Math.max(bounds.height, 1)
      );
      const worldX = bounds.x + (clickX - 12) / scale;
      const worldY = bounds.y + (clickY - 12) / scale;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      dispatch({
        type: "SET_VIEWPORT",
        payload: {
          ...state.viewport,
          x: canvasRect.width / 2 - worldX * state.viewport.zoom,
          y: canvasRect.height / 2 - worldY * state.viewport.zoom,
        },
      });
    },
    [state.nodes, state.viewport]
  );

  const paletteGroups = CATEGORY_ORDER.map((category) => ({
    key: category,
    label: CATEGORY_META[category].label,
    nodes: filteredNodeLibrary[category],
  }));

  const minimapData = useMemo(() => {
    const bounds = getWorkflowBounds(state.nodes);
    const width = 190;
    const height = 126;
    const scale = Math.min((width - 24) / bounds.width, (height - 24) / bounds.height);
    return { bounds, width, height, scale };
  }, [state.nodes]);

  const canvasGridStyle = {
    backgroundImage:
      "radial-gradient(circle at 1px 1px, rgba(2, 132, 199, 0.18) 1px, transparent 0)",
    backgroundSize: `${GRID_SIZE * state.viewport.zoom}px ${GRID_SIZE * state.viewport.zoom}px`,
    backgroundPosition: `${state.viewport.x % (GRID_SIZE * state.viewport.zoom)}px ${
      state.viewport.y % (GRID_SIZE * state.viewport.zoom)
    }px`,
  };

  const selectedCount = state.selectedNodeIds.length;
  const totalNodes = state.nodes.length;
  const totalEdges = state.edges.length;

  const renderNodeSpecificFields = () => {
    if (!activeNode) {
      return null;
    }

    const patchActiveNode = (patch, recordHistory = true) => {
      dispatch({
        type: "PATCH_NODE",
        payload: { id: activeNode.id, patch },
        recordHistory,
      });
    };

    const definition = resolveNodeDefinition(activeNode);
    const data = activeNode.data || {};

    if (activeNode.type === "send-text") {
      return (
        <>
          <div className="wa-form-group">
            <label>Reply Prompt / Message</label>
            <textarea
              className="wa-textarea"
              value={data.message || ""}
              onChange={(event) => patchActiveNode({ message: event.target.value })}
            />
            <div className="wa-help">
              Variables are supported with double braces like <code>{`{{name}}`}</code> or <code>{`{{status}}`}</code>.
            </div>
          </div>
        </>
      );
    }

    if (activeNode.type === "if-else") {
      const conditions = data.conditions || [];
      return (
        <>
          <div className="wa-form-group">
            <label>Condition Builder</label>
            <div style={{ display: "grid", gap: 10 }}>
              {conditions.map((condition, index) => (
                <div className="wa-condition-card" key={condition.id || `${index}`}>
                  <div className="wa-inline-grid">
                    <input
                      className="wa-input"
                      value={condition.field}
                      placeholder="Field"
                      onChange={(event) => {
                        const next = conditions.map((item) =>
                          item.id === condition.id
                            ? { ...item, field: event.target.value }
                            : item
                        );
                        patchActiveNode({ conditions: next });
                      }}
                    />
                    <select
                      className="wa-select"
                      value={condition.operator}
                      onChange={(event) => {
                        const next = conditions.map((item) =>
                          item.id === condition.id
                            ? { ...item, operator: event.target.value }
                            : item
                        );
                        patchActiveNode({ conditions: next });
                      }}
                    >
                      <option value="equals">equals</option>
                      <option value="not-equals">not equals</option>
                      <option value="contains">contains</option>
                      <option value="exists">exists</option>
                      <option value="greater-than">greater than</option>
                    </select>
                  </div>
                  <input
                    className="wa-input"
                    value={condition.value}
                    placeholder="Value"
                    onChange={(event) => {
                      const next = conditions.map((item) =>
                        item.id === condition.id
                          ? { ...item, value: event.target.value }
                          : item
                      );
                      patchActiveNode({ conditions: next });
                    }}
                  />
                  <button
                    className="wa-ghost-button"
                    type="button"
                    onClick={() => {
                      patchActiveNode({
                        conditions: conditions.filter((item) => item.id !== condition.id),
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            className="wa-button"
            type="button"
            onClick={() => {
              patchActiveNode({
                conditions: [
                  ...conditions,
                  {
                    id: createId("cond"),
                    field: "",
                    operator: "equals",
                    value: "",
                  },
                ],
              });
            }}
          >
            <Plus size={16} />
            Add Condition
          </button>
          <div className="wa-form-group">
            <label>Preview Branch</label>
            <select
              className="wa-select"
              value={data.previewBranch || "yes"}
              onChange={(event) => patchActiveNode({ previewBranch: event.target.value })}
            >
              <option value="yes">Yes branch</option>
              <option value="no">No branch</option>
            </select>
          </div>
        </>
      );
    }

    if (activeNode.type === "http-request") {
      return (
        <>
          <div className="wa-inline-grid">
            <div className="wa-form-group">
              <label>Method</label>
              <select
                className="wa-select"
                value={data.method || "GET"}
                onChange={(event) => patchActiveNode({ method: event.target.value })}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
            </div>
            <div className="wa-form-group">
              <label>URL</label>
              <input
                className="wa-input"
                value={data.url || ""}
                onChange={(event) => patchActiveNode({ url: event.target.value })}
              />
            </div>
          </div>
          <div className="wa-form-group">
            <label>Headers</label>
            <textarea
              className="wa-textarea"
              value={data.headersText || ""}
              onChange={(event) => patchActiveNode({ headersText: event.target.value })}
            />
          </div>
          <div className="wa-form-group">
            <label>Body</label>
            <textarea
              className="wa-textarea"
              value={data.body || ""}
              onChange={(event) => patchActiveNode({ body: event.target.value })}
            />
          </div>
        </>
      );
    }

    if (activeNode.type === "wait") {
      return (
        <div className="wa-inline-grid">
          <div className="wa-form-group">
            <label>Duration</label>
            <input
              className="wa-input"
              type="number"
              min="1"
              value={data.duration || 1}
              onChange={(event) => patchActiveNode({ duration: Number(event.target.value) })}
            />
          </div>
          <div className="wa-form-group">
            <label>Unit</label>
            <select
              className="wa-select"
              value={data.unit || "minutes"}
              onChange={(event) => patchActiveNode({ unit: event.target.value })}
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
      );
    }

    if (activeNode.type === "keyword-match") {
      const keywords = data.keywords || [];
      return (
        <>
          <div className="wa-form-group">
            <label>Keyword List</label>
            <div className="wa-tag-list">
              {keywords.map((keyword) => (
                <span className="wa-tag" key={keyword}>
                  {keyword}
                  <button
                    type="button"
                    className="wa-icon-button"
                    style={{ width: 24, height: 24, borderRadius: 999, padding: 0 }}
                    onClick={() =>
                      patchActiveNode({
                        keywords: keywords.filter((item) => item !== keyword),
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="wa-inline-grid">
            <input
              className="wa-input"
              placeholder="Add a keyword and press Enter"
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.currentTarget.value.trim()) {
                  event.preventDefault();
                  patchActiveNode({
                    keywords: [...keywords, event.currentTarget.value.trim()],
                  });
                  event.currentTarget.value = "";
                }
              }}
            />
            <select
              className="wa-select"
              value={data.matchMode || "contains-any"}
              onChange={(event) => patchActiveNode({ matchMode: event.target.value })}
            >
              <option value="contains-any">Contains Any</option>
              <option value="contains-all">Contains All</option>
              <option value="exact-match">Exact Match</option>
            </select>
          </div>
        </>
      );
    }

    if (activeNode.type === "ai-reply") {
      return (
        <>
          <div className="wa-inline-grid">
            <div className="wa-form-group">
              <label>Model</label>
              <input
                className="wa-input"
                value={data.model || ""}
                onChange={(event) => patchActiveNode({ model: event.target.value })}
              />
            </div>
            <div className="wa-form-group">
              <label>Temperature</label>
              <input
                className="wa-input"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={data.temperature ?? 0.4}
                onChange={(event) => patchActiveNode({ temperature: Number(event.target.value) })}
              />
            </div>
          </div>
          <div className="wa-form-group">
            <label>System Prompt</label>
            <textarea
              className="wa-textarea"
              value={data.systemPrompt || ""}
              onChange={(event) => patchActiveNode({ systemPrompt: event.target.value })}
            />
          </div>
          <div className="wa-form-group">
            <label>Reply Prompt</label>
            <textarea
              className="wa-textarea"
              value={data.prompt || ""}
              onChange={(event) => patchActiveNode({ prompt: event.target.value })}
            />
          </div>
        </>
      );
    }

    if (activeNode.type === "random-split") {
      const weights = data.weights || { a: 50, b: 30, c: 20 };
      return (
        <div className="wa-inline-grid">
          {["a", "b", "c"].map((key) => (
            <div className="wa-form-group" key={key}>
              <label>Weight {key.toUpperCase()}</label>
              <input
                className="wa-input"
                type="number"
                value={weights[key] ?? 0}
                onChange={(event) =>
                  patchActiveNode({
                    weights: {
                      ...weights,
                      [key]: Number(event.target.value),
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      );
    }

    if (activeNode.type === "loop") {
      return (
        <div className="wa-inline-grid">
          <div className="wa-form-group">
            <label>Loop Mode</label>
            <select
              className="wa-select"
              value={data.loopMode || "repeat-n"}
              onChange={(event) => patchActiveNode({ loopMode: event.target.value })}
            >
              <option value="repeat-n">Repeat N Times</option>
              <option value="for-each">For Each Item</option>
            </select>
          </div>
          <div className="wa-form-group">
            <label>Iterations</label>
            <input
              className="wa-input"
              type="number"
              min="1"
              value={data.iterations || 1}
              onChange={(event) => patchActiveNode({ iterations: Number(event.target.value) })}
            />
          </div>
        </div>
      );
    }

    if (activeNode.type === "set-variable") {
      return (
        <div className="wa-inline-grid">
          <div className="wa-form-group">
            <label>Variable Name</label>
            <input
              className="wa-input"
              value={data.variableName || ""}
              onChange={(event) => patchActiveNode({ variableName: event.target.value })}
            />
          </div>
          <div className="wa-form-group">
            <label>Variable Value</label>
            <input
              className="wa-input"
              value={data.variableValue || ""}
              onChange={(event) => patchActiveNode({ variableValue: event.target.value })}
            />
          </div>
        </div>
      );
    }

    if (activeNode.type === "extract-data") {
      return (
        <>
          <div className="wa-form-group">
            <label>Source Field</label>
            <input
              className="wa-input"
              value={data.sourceField || ""}
              onChange={(event) => patchActiveNode({ sourceField: event.target.value })}
            />
          </div>
          <div className="wa-form-group">
            <label>Regex / Extraction Pattern</label>
            <input
              className="wa-input"
              value={data.pattern || ""}
              onChange={(event) => patchActiveNode({ pattern: event.target.value })}
            />
          </div>
        </>
      );
    }

    if (activeNode.type === "transform") {
      return (
        <div className="wa-form-group">
          <label>Transform Expression</label>
          <textarea
            className="wa-textarea"
            value={data.transformExpression || ""}
            onChange={(event) =>
              patchActiveNode({ transformExpression: event.target.value })
            }
          />
        </div>
      );
    }

    if (activeNode.type === "send-template") {
      return (
        <>
          <div className="wa-inline-grid">
            <div className="wa-form-group">
              <label>Template Name</label>
              <input
                className="wa-input"
                value={data.templateName || ""}
                onChange={(event) => patchActiveNode({ templateName: event.target.value })}
              />
            </div>
            <div className="wa-form-group">
              <label>Language</label>
              <input
                className="wa-input"
                value={data.language || ""}
                onChange={(event) => patchActiveNode({ language: event.target.value })}
              />
            </div>
          </div>
          <div className="wa-form-group">
            <label>Template Parameters</label>
            <textarea
              className="wa-textarea"
              value={data.templateParams || ""}
              onChange={(event) => patchActiveNode({ templateParams: event.target.value })}
            />
          </div>
        </>
      );
    }

    if (activeNode.type === "send-media") {
      return (
        <>
          <div className="wa-inline-grid">
            <div className="wa-form-group">
              <label>Media Type</label>
              <select
                className="wa-select"
                value={data.mediaType || "image"}
                onChange={(event) => patchActiveNode({ mediaType: event.target.value })}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="file">File</option>
              </select>
            </div>
            <div className="wa-form-group">
              <label>Media URL</label>
              <input
                className="wa-input"
                value={data.mediaUrl || ""}
                onChange={(event) => patchActiveNode({ mediaUrl: event.target.value })}
              />
            </div>
          </div>
          <div className="wa-form-group">
            <label>Caption</label>
            <textarea
              className="wa-textarea"
              value={data.caption || ""}
              onChange={(event) => patchActiveNode({ caption: event.target.value })}
            />
          </div>
        </>
      );
    }

    return (
      <>
        {definition.inputPorts?.length ? (
          <div className="wa-form-group">
            <label>Ports</label>
            <div className="wa-help">
              Input: {definition.inputPorts.map((port) => port.label).join(", ")}
              <br />
              Output: {definition.outputPorts.map((port) => port.label).join(", ")}
            </div>
          </div>
        ) : null}
        <div className="wa-help">
          This node uses the default builder controls and can still participate fully in the workflow.
        </div>
      </>
    );
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@400;500;600;700&display=swap');
    .wa-builder-page{--wa-bg:#0d0f14;--wa-border:rgba(122,141,179,.18);--wa-border-strong:rgba(0,229,255,.28);--wa-text:#eef4ff;--wa-text-soft:rgba(218,226,243,.72);--wa-muted:rgba(149,165,192,.68);--wa-cyan:#00e5ff;--wa-shadow:0 26px 80px rgba(0,0,0,.42);margin:-24px;min-height:calc(100vh - 48px);background:radial-gradient(circle at top left,rgba(0,229,255,.08),transparent 32%),linear-gradient(135deg,rgba(24,30,44,.98),rgba(10,12,16,1));color:var(--wa-text);display:grid;grid-template-columns:320px minmax(0,1fr);font-family:'Outfit','Inter',sans-serif;overflow:hidden}
    .wa-builder-page *{box-sizing:border-box}
    .wa-sidebar{background:rgba(12,16,24,.92);border-right:1px solid var(--wa-border);display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(20px)}
    .wa-shell{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
    .wa-topbar{height:74px;border-bottom:1px solid var(--wa-border);display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:18px;align-items:center;padding:0 22px;background:rgba(13,17,24,.88);backdrop-filter:blur(18px)}
    .wa-brand{display:flex;align-items:center;gap:16px;min-width:0}.wa-logo{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,rgba(0,229,255,.22),rgba(77,154,255,.16)),rgba(12,18,28,.96);border:1px solid rgba(0,229,255,.22);display:inline-flex;align-items:center;justify-content:center}.wa-logo svg{color:var(--wa-cyan)}.wa-brand-copy{min-width:0}
    .wa-brand-eyebrow,.wa-section-title{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--wa-muted);font-family:'JetBrains Mono',monospace}
    .wa-brand-eyebrow{margin-bottom:4px}
    .wa-workflow-name{width:100%;background:transparent;border:none;color:var(--wa-text);font-size:24px;font-weight:600;padding:0;outline:none}
    .wa-statusline{display:flex;align-items:center;gap:10px;color:var(--wa-text-soft);font-size:13px;margin-top:2px;flex-wrap:wrap}
    .wa-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;border:1px solid var(--wa-border);background:rgba(26,31,43,.78);color:var(--wa-text-soft);font-size:12px;font-family:'JetBrains Mono',monospace}
    .wa-topbar-actions,.wa-topbar-tools{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}.wa-segment{display:inline-flex;align-items:center;gap:4px;padding:4px;background:rgba(18,24,36,.92);border:1px solid var(--wa-border);border-radius:999px}
    .wa-button,.wa-ghost-button,.wa-tool-button,.wa-icon-button{border:1px solid var(--wa-border);background:rgba(19,24,35,.92);color:var(--wa-text);border-radius:14px;height:42px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;transition:all .2s ease;cursor:pointer}
    .wa-button:hover,.wa-ghost-button:hover,.wa-tool-button:hover,.wa-icon-button:hover{transform:translateY(-1px);border-color:var(--wa-border-strong);box-shadow:0 14px 28px rgba(0,0,0,.25)}
    .wa-button--primary{background:linear-gradient(135deg,rgba(0,229,255,.2),rgba(62,146,255,.18));border-color:rgba(0,229,255,.28)}.wa-button--run{background:linear-gradient(135deg,rgba(52,211,153,.22),rgba(14,99,87,.22));border-color:rgba(52,211,153,.28)}
    .wa-tool-button{width:38px;height:38px;padding:0;border-radius:999px}.wa-tool-button.active{background:rgba(0,229,255,.14);border-color:rgba(0,229,255,.4);color:var(--wa-cyan)}
    .wa-tool-button:disabled,.wa-button:disabled{cursor:not-allowed;opacity:.5;transform:none;box-shadow:none}
    .wa-sidebar-header{padding:24px 22px 18px;border-bottom:1px solid var(--wa-border);display:grid;gap:18px}
    .wa-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .wa-searchbox{position:relative}.wa-searchbox svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--wa-muted)}
    .wa-input,.wa-textarea,.wa-select{width:100%;background:rgba(18,24,36,.94);border:1px solid var(--wa-border);color:var(--wa-text);border-radius:14px;padding:12px 14px;font-size:14px;outline:none;transition:border-color .2s ease,box-shadow .2s ease;font-family:'Outfit','Inter',sans-serif}
    .wa-input:focus,.wa-textarea:focus,.wa-select:focus{border-color:rgba(0,229,255,.48);box-shadow:0 0 0 3px rgba(0,229,255,.12)}.wa-searchbox .wa-input{padding-left:42px}
    .wa-sidebar-body{flex:1;overflow-y:auto;padding:22px;display:grid;gap:18px}.wa-library-list,.wa-palette-list{display:grid;gap:10px}
    .wa-library-card{border:1px solid var(--wa-border);background:linear-gradient(135deg,rgba(26,31,43,.96),rgba(19,23,34,.92));border-radius:18px;padding:14px;display:grid;gap:8px;cursor:pointer;transition:all .2s ease;text-align:left}
    .wa-library-card:hover,.wa-library-card.active{border-color:rgba(0,229,255,.34);transform:translateY(-1px);box-shadow:0 18px 38px rgba(0,0,0,.24)}
    .wa-library-name{font-size:15px;font-weight:600}.wa-library-meta{font-size:12px;color:var(--wa-text-soft);display:flex;justify-content:space-between;gap:12px;font-family:'JetBrains Mono',monospace}
    .wa-accordion{border:1px solid var(--wa-border);border-radius:18px;background:rgba(15,20,30,.72);overflow:hidden}
    .wa-accordion-toggle{width:100%;background:transparent;border:none;color:inherit;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}
    .wa-accordion-title{display:flex;align-items:center;gap:12px;font-weight:600}.wa-accent-dot{width:10px;height:10px;border-radius:999px;display:inline-flex;flex-shrink:0}
    .wa-accordion-content{padding:0 12px 12px;display:grid;gap:10px}
    .wa-palette-node{border:1px solid var(--wa-border);border-radius:16px;background:rgba(19,24,35,.92);padding:12px 14px;display:grid;gap:8px;cursor:grab;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;text-align:left}
    .wa-palette-node:hover{border-color:rgba(0,229,255,.28);transform:translateY(-1px);box-shadow:0 12px 26px rgba(0,0,0,.22)}
    .wa-palette-node-top{display:flex;align-items:center;gap:10px;font-weight:600}.wa-palette-desc{color:var(--wa-text-soft);font-size:13px;line-height:1.5}
    .wa-stage{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) 200px;position:relative;overflow:hidden}.wa-canvas-shell{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(0,0,0,.18),transparent 20%),var(--wa-bg)}
    .wa-canvas{position:absolute;inset:0;overflow:hidden;cursor:grab}.wa-canvas.select-mode{cursor:crosshair}.wa-grid{position:absolute;inset:0;opacity:.9}
    .wa-world{position:absolute;left:0;top:0;width:${WORLD_SIZE}px;height:${WORLD_SIZE}px;transform-origin:0 0;will-change:transform}.wa-world-svg{position:absolute;inset:0;overflow:visible;pointer-events:none}.wa-world-svg .edge-hit{pointer-events:stroke;cursor:pointer}
    .wa-node{position:absolute;width:${NODE_WIDTH}px;min-height:${NODE_HEIGHT}px;background:linear-gradient(180deg,rgba(27,31,42,.98),rgba(18,21,30,.96));border:1px solid rgba(255,255,255,.05);border-radius:20px;border-left:5px solid transparent;box-shadow:0 16px 34px rgba(0,0,0,.28);padding:14px 16px 16px;color:var(--wa-text);user-select:none;transition:box-shadow .2s ease,transform .2s ease}
    .wa-node:hover{transform:translateY(-2px);box-shadow:0 28px 54px rgba(0,0,0,.34)}.wa-node.selected{box-shadow:0 0 0 1px rgba(0,229,255,.44),0 22px 56px rgba(0,0,0,.36)}.wa-node.match{box-shadow:0 0 0 1px rgba(250,204,21,.48),0 0 32px rgba(250,204,21,.18)}.wa-node.running{animation:waPulse 1.2s ease-in-out infinite}
    .wa-node-toolbar{position:absolute;top:12px;right:12px;opacity:0;pointer-events:none;display:inline-flex;gap:8px;transition:opacity .18s ease}.wa-node:hover .wa-node-toolbar,.wa-node.selected .wa-node-toolbar{opacity:1;pointer-events:auto}
    .wa-node-icon{width:38px;height:38px;border-radius:14px;background:rgba(255,255,255,.05);display:inline-flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}.wa-node-header{display:flex;align-items:flex-start;gap:12px;padding-right:60px}.wa-node-title{font-weight:600;font-size:15px;margin-bottom:4px}.wa-node-category{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--wa-muted);font-family:'JetBrains Mono',monospace}
    .wa-node-preview{margin-top:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.04);border-radius:14px;padding:12px;color:var(--wa-text-soft);font-size:13px;line-height:1.55;min-height:54px}
    .wa-port,.wa-port-input,.wa-port-output{position:absolute;width:18px;height:18px;border-radius:999px;border:2px solid rgba(255,255,255,.22);background:#0a0d14;box-shadow:0 0 0 4px rgba(255,255,255,.02);transform:translate(-50%,-50%);cursor:pointer}.wa-port:hover{transform:translate(-50%,-50%) scale(1.08)}
    .wa-port-label{position:absolute;transform:translateY(-50%);font-size:11px;color:var(--wa-muted);font-family:'JetBrains Mono',monospace;white-space:nowrap}
    .wa-node-status{position:absolute;bottom:12px;right:14px;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--wa-text-soft);padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(9,12,18,.8)}
    .wa-edge-delete{pointer-events:auto;cursor:pointer}.wa-connection-preview{stroke-dasharray:8 10;animation:waDash 1.4s linear infinite}.wa-selection-box{position:absolute;border:1px dashed rgba(0,229,255,.62);background:rgba(0,229,255,.1);pointer-events:none}
    .wa-canvas-controls{position:absolute;top:18px;right:18px;display:grid;gap:10px;z-index:4}.wa-control-stack,.wa-floating-search{border:1px solid var(--wa-border);border-radius:18px;padding:10px;background:rgba(12,16,23,.84);backdrop-filter:blur(14px);display:grid;gap:10px;box-shadow:var(--wa-shadow)}.wa-control-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.wa-zoom-readout{min-width:64px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--wa-text-soft)}
    .wa-minimap{position:absolute;right:18px;bottom:18px;width:190px;height:126px;border-radius:18px;border:1px solid var(--wa-border);background:rgba(12,16,23,.92);backdrop-filter:blur(14px);overflow:hidden;z-index:4;box-shadow:var(--wa-shadow);cursor:pointer}.wa-minimap svg{width:100%;height:100%}
    .wa-context-menu{position:absolute;min-width:260px;border-radius:18px;border:1px solid var(--wa-border);background:rgba(12,16,23,.96);box-shadow:0 28px 56px rgba(0,0,0,.36);padding:12px;z-index:10;display:grid;gap:10px;backdrop-filter:blur(18px)}.wa-context-menu h4{margin:0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--wa-muted);font-family:'JetBrains Mono',monospace}.wa-context-actions{display:grid;gap:8px}.wa-context-action{border:1px solid var(--wa-border);background:rgba(18,24,36,.92);color:var(--wa-text);border-radius:14px;min-height:40px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font-size:13px;text-align:left}
    .wa-config-panel{position:absolute;top:0;right:0;width:380px;max-width:calc(100% - 20px);height:100%;border-left:1px solid var(--wa-border);background:rgba(14,18,26,.96);backdrop-filter:blur(18px);transform:translateX(100%);transition:transform .22s ease;z-index:6;display:flex;flex-direction:column;box-shadow:-18px 0 42px rgba(0,0,0,.28)}.wa-config-panel.open{transform:translateX(0)}
    .wa-config-header{padding:20px;border-bottom:1px solid var(--wa-border);display:flex;align-items:center;justify-content:space-between;gap:16px}.wa-config-header h3{margin:0;font-size:18px}.wa-config-body{padding:20px;overflow-y:auto;display:grid;gap:18px}.wa-form-group{display:grid;gap:8px}.wa-form-group label{color:var(--wa-text-soft);font-size:13px;font-weight:500}.wa-textarea{min-height:110px;resize:vertical;font-family:'JetBrains Mono',monospace;line-height:1.5}.wa-config-footer{padding:18px 20px 20px;border-top:1px solid var(--wa-border);display:grid;gap:10px;margin-top:auto}
    .wa-inline-grid{display:grid;gap:10px;grid-template-columns:repeat(2,minmax(0,1fr))}.wa-tag-list{display:flex;flex-wrap:wrap;gap:8px}.wa-tag{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.18);font-size:12px;font-family:'JetBrains Mono',monospace}.wa-condition-card{border:1px solid var(--wa-border);border-radius:16px;padding:12px;display:grid;gap:10px;background:rgba(16,21,31,.8)}
    .wa-log-panel{border-top:1px solid var(--wa-border);background:rgba(8,10,15,.94);display:flex;flex-direction:column;min-height:0}.wa-log-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid var(--wa-border)}.wa-log-list{padding:14px 18px 18px;overflow-y:auto;display:grid;gap:10px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--wa-text-soft)}.wa-log-item{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px;border:1px solid rgba(255,255,255,.04);background:rgba(19,24,35,.82);border-radius:14px;padding:12px}
    .wa-log-time,.wa-help,.wa-empty-state{color:var(--wa-muted)}.wa-empty-state{text-align:center;padding:28px 16px;font-size:13px}
    .wa-toast{position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:8;border-radius:999px;padding:10px 14px;font-size:13px;border:1px solid var(--wa-border);background:rgba(14,18,25,.96);box-shadow:0 16px 36px rgba(0,0,0,.3)}
    .wa-toast.success{border-color:rgba(52,211,153,.38);color:#bbf7d0}.wa-toast.warning{border-color:rgba(251,191,36,.38);color:#fde68a}.wa-toast.error{border-color:rgba(248,113,113,.38);color:#fecaca}.spin{animation:spin .8s linear infinite}
    .wa-builder-page{--wa-bg:#f4f7fb;--wa-border:rgba(148,163,184,.35);--wa-border-strong:rgba(2,132,199,.45);--wa-text:#0f172a;--wa-text-soft:rgba(51,65,85,.84);--wa-muted:rgba(71,85,105,.82);--wa-cyan:#0284c7;--wa-shadow:0 18px 42px rgba(15,23,42,.14);background:radial-gradient(circle at top left,rgba(14,165,233,.12),transparent 40%),linear-gradient(135deg,#ffffff,#eef4ff)}
    .wa-sidebar{background:rgba(248,250,252,.96)}
    .wa-topbar{background:rgba(255,255,255,.95)}
    .wa-logo{background:linear-gradient(135deg,rgba(2,132,199,.14),rgba(59,130,246,.1)),#ffffff;border-color:rgba(2,132,199,.24)}
    .wa-pill{background:#f1f5f9}
    .wa-segment{background:#f8fafc}
    .wa-button,.wa-ghost-button,.wa-tool-button,.wa-icon-button{background:#ffffff}
    .wa-button:hover,.wa-ghost-button:hover,.wa-tool-button:hover,.wa-icon-button:hover{box-shadow:0 10px 24px rgba(15,23,42,.12)}
    .wa-input,.wa-textarea,.wa-select{background:#ffffff}
    .wa-library-card{background:linear-gradient(135deg,#ffffff,#f8fbff)}
    .wa-library-card:hover,.wa-library-card.active{box-shadow:0 12px 26px rgba(15,23,42,.12)}
    .wa-accordion{background:#f8fafc}
    .wa-palette-node{background:#ffffff}
    .wa-palette-node:hover{box-shadow:0 10px 22px rgba(15,23,42,.1)}
    .wa-canvas-shell{background:linear-gradient(180deg,rgba(2,132,199,.06),transparent 22%),var(--wa-bg)}
    .wa-node{background:linear-gradient(180deg,#ffffff,#f8fbff);border:1px solid rgba(148,163,184,.34);box-shadow:0 12px 30px rgba(15,23,42,.12)}
    .wa-node:hover{box-shadow:0 18px 36px rgba(15,23,42,.16)}
    .wa-node.selected{box-shadow:0 0 0 1px rgba(2,132,199,.38),0 20px 44px rgba(15,23,42,.16)}
    .wa-node-icon{background:rgba(2,132,199,.08)}
    .wa-node-preview{background:#f7fbff;border-color:rgba(148,163,184,.3)}
    .wa-port,.wa-port-input,.wa-port-output{border-color:rgba(71,85,105,.55);background:#ffffff;box-shadow:0 0 0 4px rgba(148,163,184,.2)}
    .wa-node-status{border-color:rgba(148,163,184,.36);background:#f8fafc}
    .wa-control-stack,.wa-floating-search{background:rgba(255,255,255,.95)}
    .wa-minimap{background:rgba(255,255,255,.96)}
    .wa-context-menu{background:rgba(255,255,255,.97);box-shadow:0 20px 40px rgba(15,23,42,.16)}
    .wa-context-action{background:#ffffff}
    .wa-config-panel{background:rgba(255,255,255,.97);box-shadow:-10px 0 28px rgba(15,23,42,.12)}
    .wa-condition-card{background:#f8fafc}
    .wa-log-panel{background:#f8fbff}
    .wa-log-item{border:1px solid rgba(148,163,184,.32);background:#ffffff}
    .wa-toast{background:rgba(255,255,255,.98);box-shadow:0 10px 24px rgba(15,23,42,.16)}
    .wa-toast.success{color:#166534}.wa-toast.warning{color:#854d0e}.wa-toast.error{color:#b91c1c}
    @keyframes waPulse{0%,100%{box-shadow:0 0 0 1px rgba(2,132,199,.42),0 12px 28px rgba(15,23,42,.14)}50%{box-shadow:0 0 0 1px rgba(2,132,199,.68),0 0 24px rgba(2,132,199,.18)}}@keyframes waDash{to{stroke-dashoffset:-36}}@keyframes spin{to{transform:rotate(360deg)}}
    @media (max-width:1200px){.wa-builder-page{grid-template-columns:290px minmax(0,1fr)}.wa-topbar{grid-template-columns:minmax(0,1fr);height:auto;padding:18px}}
    @media (max-width:1024px){.wa-builder-page{margin:-16px;min-height:calc(100vh - 32px);grid-template-columns:1fr}.wa-sidebar{max-height:38vh}.wa-stage{grid-template-rows:minmax(460px,1fr) 220px}}
    @media (max-width:768px){.wa-builder-page{margin:-12px;min-height:calc(100vh - 24px)}.wa-topbar,.wa-sidebar-header,.wa-sidebar-body{padding:16px}.wa-config-panel{width:100%;max-width:100%}.wa-inline-grid{grid-template-columns:1fr}.wa-minimap{width:160px;height:112px}}
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="wa-builder-page">
        <aside className="wa-sidebar">
          <div className="wa-sidebar-header">
            <div className="wa-section-title">
              <span>WhatsApp Workflow</span>
              <span>{state.workflowLibrary.length} saved</span>
            </div>
            <button
              className="wa-button wa-button--primary"
              type="button"
              onClick={() => {
                if (state.isDirty && !window.confirm("Discard unsaved changes and create a new workflow?")) {
                  return;
                }
                dispatch({ type: "NEW_WORKFLOW", payload: state.workflowLibrary.length + 1 });
              }}
            >
              <Plus size={16} />
              New Workflow
            </button>
            <div className="wa-searchbox">
              <Search size={16} />
              <input
                className="wa-input"
                placeholder="Search nodes..."
                value={state.paletteSearch}
                onChange={(event) => dispatch({ type: "SET_PALETTE_SEARCH", payload: event.target.value })}
              />
            </div>
          </div>
          <div className="wa-sidebar-body">
            <section className="wa-library-list">
              <div className="wa-section-title">
                <span>Local Workflows</span>
                <span>{state.workflowLibrary.length}</span>
              </div>
              {state.workflowLibrary.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  className={`wa-library-card ${workflow.id === state.workflowId ? "active" : ""}`}
                  onClick={() => {
                    if (state.isDirty && workflow.id !== state.workflowId && !window.confirm("Discard unsaved changes and switch workflows?")) {
                      return;
                    }
                    dispatch({ type: "LOAD_WORKFLOW", payload: workflow });
                  }}
                >
                  <div className="wa-library-name">{workflow.name}</div>
                  <div className="wa-library-meta">
                    <span>{workflow.nodes.length} nodes</span>
                    <span>{workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString() : "Unsaved"}</span>
                  </div>
                </button>
              ))}
            </section>
            <section className="wa-palette-list">
              <div className="wa-section-title">
                <span>Nodes</span>
                <span>Click or drag</span>
              </div>
              {paletteGroups.map((group) => (
                <div className="wa-accordion" key={group.key}>
                  <button type="button" className="wa-accordion-toggle" onClick={() => dispatch({ type: "TOGGLE_CATEGORY", payload: group.key })}>
                    <span className="wa-accordion-title">
                      <span className="wa-accent-dot" style={{ background: CATEGORY_META[group.key].accent }} />
                      {group.label}
                    </span>
                    {state.collapsedCategories[group.key] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {!state.collapsedCategories[group.key] ? (
                    <div className="wa-accordion-content">
                      {group.nodes.map((nodeDefinition) => (
                        <button
                          key={nodeDefinition.type}
                          type="button"
                          className="wa-palette-node"
                          draggable={false}
                          onMouseDown={(event) => startPalettePointerDrag(event, nodeDefinition.type)}
                          onClick={() => {
                            if (paletteClickSuppressRef.current) {
                              return;
                            }
                            if (!canvasRef.current) {
                              return;
                            }
                            const rect = canvasRef.current.getBoundingClientRect();
                            const centerWorld = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, state.viewport);
                            addNodeAt(nodeDefinition.type, { x: centerWorld.x - NODE_WIDTH / 2, y: centerWorld.y - NODE_HEIGHT / 2 });
                          }}
                        >
                          <div className="wa-palette-node-top">
                            <span className="wa-node-icon">{nodeDefinition.icon}</span>
                            <span>{nodeDefinition.title}</span>
                          </div>
                          <div className="wa-palette-desc">{nodeDefinition.description}</div>
                        </button>
                      ))}
                      {!group.nodes.length ? <div className="wa-empty-state">No nodes match that search.</div> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          </div>
        </aside>

        <section className="wa-shell">
          <header className="wa-topbar">
            <div className="wa-brand">
              <div className="wa-logo"><MessageSquare size={20} /></div>
              <div className="wa-brand-copy">
                <div className="wa-brand-eyebrow">WhatsApp Workflow Builder</div>
                <input className="wa-workflow-name" value={state.workflowName} onChange={(event) => dispatch({ type: "SET_WORKFLOW_NAME", payload: event.target.value })} />
                <div className="wa-statusline">
                  <span className="wa-pill">{totalNodes} nodes</span>
                  <span className="wa-pill">{totalEdges} connections</span>
                  <span className="wa-pill">{state.isDirty ? "Unsaved changes" : state.lastSavedAt ? `Saved ${new Date(state.lastSavedAt).toLocaleTimeString()}` : "Not saved yet"}</span>
                  {state.isSyncing ? <span className="wa-pill">Syncing...</span> : null}
                </div>
              </div>
            </div>
            <div className="wa-topbar-tools">
              <div className="wa-segment">
                <button className="wa-tool-button" type="button" onClick={() => dispatch({ type: "UNDO" })} disabled={!state.history.length} title="Undo"><Undo2 size={16} /></button>
                <button className="wa-tool-button" type="button" onClick={() => dispatch({ type: "REDO" })} disabled={!state.future.length} title="Redo"><Redo2 size={16} /></button>
                <button className="wa-tool-button" type="button" onClick={() => { if (state.nodes.length && window.confirm("Clear every node and connection from the canvas?")) { dispatch({ type: "CLEAR_WORKFLOW" }); } }} title="Clear Canvas"><Trash2 size={16} /></button>
              </div>
              <div className="wa-segment">
                <button className={`wa-tool-button ${state.interactionMode === "pan" ? "active" : ""}`} type="button" onClick={() => dispatch({ type: "SET_INTERACTION_MODE", payload: "pan" })} title="Pan mode"><Grip size={16} /></button>
                <button className={`wa-tool-button ${state.interactionMode === "select" ? "active" : ""}`} type="button" onClick={() => dispatch({ type: "SET_INTERACTION_MODE", payload: "select" })} title="Selection mode"><MousePointer2 size={16} /></button>
              </div>
            </div>
            <div className="wa-topbar-actions">
              <button className="wa-button" type="button" onClick={handleSaveWorkflow} disabled={state.isSyncing}>
                {state.isSyncing ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
                Save
              </button>
              <button className="wa-button" type="button" onClick={handleExport}><Download size={16} />Export JSON</button>
              <button className="wa-button" type="button" onClick={() => importInputRef.current?.click()}><Upload size={16} />Import JSON</button>
              <button className="wa-button wa-button--run" type="button" onClick={runWorkflow} disabled={state.isRunning}>
                {state.isRunning ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}Run Workflow
              </button>
            </div>
          </header>

          <div className="wa-stage">
            <div className="wa-canvas-shell">
              {state.toast ? <div className={`wa-toast ${state.toast.type || "info"}`}>{state.toast.message}</div> : null}
              <div
                ref={canvasRef}
                className={`wa-canvas ${state.interactionMode === "select" ? "select-mode" : ""}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseUpCapture={(event) => {
                  const drag = palettePointerDragRef.current;
                  if (!drag || nativePaletteDragRef.current || !canvasRef.current) {
                    return;
                  }
                  const movedX = Math.abs(event.clientX - drag.startX);
                  const movedY = Math.abs(event.clientY - drag.startY);
                  const movedEnough = drag.moved || movedX > 2 || movedY > 2;
                  if (!movedEnough) {
                    palettePointerDragRef.current = null;
                    return;
                  }
                  const rect = canvasRef.current.getBoundingClientRect();
                  const world = screenToWorld(
                    event.clientX,
                    event.clientY,
                    rect,
                    stateRef.current.viewport
                  );
                  addNodeAt(drag.type, {
                    x: world.x - NODE_WIDTH / 2,
                    y: world.y - NODE_HEIGHT / 2,
                  });
                  palettePointerDragRef.current = null;
                  paletteClickSuppressRef.current = true;
                  window.setTimeout(() => {
                    paletteClickSuppressRef.current = false;
                  }, 0);
                }}
                onWheel={handleWheel}
                onDrop={handleCanvasDrop}
                onDropCapture={handleCanvasDrop}
                onDragEnter={(event) => event.preventDefault()}
                onDragEnterCapture={(event) => event.preventDefault()}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDragOverCapture={(event) => event.preventDefault()}
              >
                <div className="wa-grid" style={canvasGridStyle} />
                <div className="wa-canvas-controls">
                  {state.isCanvasSearchOpen ? (
                    <div className="wa-floating-search">
                      <div className="wa-searchbox">
                        <Search size={16} />
                        <input ref={canvasSearchInputRef} className="wa-input" placeholder="Search nodes on canvas..." value={state.canvasSearch} onChange={(event) => dispatch({ type: "SET_CANVAS_SEARCH", payload: event.target.value })} />
                      </div>
                      <div className="wa-help">{matchedNodeIds.length} match{matchedNodeIds.length === 1 ? "" : "es"} highlighted.</div>
                    </div>
                  ) : null}
                  <div className="wa-control-stack">
                    <div className="wa-control-row">
                      <button className="wa-tool-button" type="button" onClick={() => updateZoom(0.08)} title="Zoom in"><ZoomIn size={16} /></button>
                      <button className="wa-tool-button" type="button" onClick={() => updateZoom(-0.08)} title="Zoom out"><ZoomOut size={16} /></button>
                      <span className="wa-zoom-readout">{Math.round(state.viewport.zoom * 100)}%</span>
                    </div>
                    <div className="wa-control-row">
                      <button className="wa-button" type="button" onClick={fitToScreen}><Maximize2 size={16} />Fit</button>
                      <button className="wa-button" type="button" onClick={() => dispatch({ type: "TOGGLE_SNAP" })}>Snap {state.snapToGrid ? "On" : "Off"}</button>
                    </div>
                    <div className="wa-control-row">
                      <button className="wa-button" type="button" onClick={copySelection}><Copy size={16} />Copy</button>
                      <button className="wa-button" type="button" onClick={() => pasteSelection()}><ClipboardPaste size={16} />Paste</button>
                    </div>
                  </div>
                </div>

                <div className="wa-world" style={{ transform: `translate(${state.viewport.x - WORLD_ORIGIN * state.viewport.zoom}px, ${state.viewport.y - WORLD_ORIGIN * state.viewport.zoom}px) scale(${state.viewport.zoom})` }}>
                  <svg className="wa-world-svg" width={WORLD_SIZE} height={WORLD_SIZE}>
                    {state.edges.map((edge) => {
                      const sourceNode = state.nodes.find((node) => node.id === edge.source);
                      const targetNode = state.nodes.find((node) => node.id === edge.target);
                      if (!sourceNode || !targetNode) return null;
                      const start = getPortWorldPosition(sourceNode, "output", edge.sourceHandle);
                      const end = getPortWorldPosition(targetNode, "input", edge.targetHandle);
                      const path = getBezierPath({ x: start.x + WORLD_ORIGIN, y: start.y + WORLD_ORIGIN }, { x: end.x + WORLD_ORIGIN, y: end.y + WORLD_ORIGIN });
                      const color = getEdgeColor(edge, state.nodes);
                      const highlighted = state.hoveredEdgeId === edge.id || state.selectedEdgeId === edge.id;
                      const midPoint = { x: (start.x + end.x) / 2 + WORLD_ORIGIN, y: (start.y + end.y) / 2 + WORLD_ORIGIN };
                      return (
                        <g key={edge.id}>
                          <path d={path} fill="none" stroke={color} strokeWidth={highlighted ? 3.4 : 2.3} strokeLinecap="round" strokeDasharray="7 9" className="wa-connection-preview" opacity={0.92} />
                          <path d={path} fill="none" stroke="transparent" strokeWidth="16" className="edge-hit" onMouseEnter={() => dispatch({ type: "SET_HOVERED_EDGE", payload: edge.id })} onMouseLeave={() => dispatch({ type: "SET_HOVERED_EDGE", payload: null })} onClick={(event) => { event.stopPropagation(); dispatch({ type: "SET_SELECTED_EDGE", payload: edge.id }); }} />
                          {highlighted ? (
                            <foreignObject x={midPoint.x - 16} y={midPoint.y - 16} width="32" height="32">
                              <button type="button" data-edge-delete="true" className="wa-icon-button wa-edge-delete" style={{ width: 32, height: 32, borderRadius: 999, padding: 0 }} onClick={(event) => { event.stopPropagation(); dispatch({ type: "DELETE_EDGE", payload: edge.id }); }}>
                                <X size={14} />
                              </button>
                            </foreignObject>
                          ) : null}
                        </g>
                      );
                    })}
                    {state.connectionDraft ? (
                      <path
                        d={getBezierPath({ x: state.connectionDraft.from.x + WORLD_ORIGIN, y: state.connectionDraft.from.y + WORLD_ORIGIN }, { x: state.connectionDraft.to.x + WORLD_ORIGIN, y: state.connectionDraft.to.y + WORLD_ORIGIN })}
                        fill="none"
                        stroke={getEdgeColor({ source: state.connectionDraft.source }, state.nodes)}
                        strokeWidth="2.5"
                        className="wa-connection-preview"
                      />
                    ) : null}
                  </svg>

                  {state.nodes.map((node) => {
                    const definition = resolveNodeDefinition(node);
                    const category = CATEGORY_META[definition.category];
                    const selected = state.selectedNodeIds.includes(node.id);
                    const isMatch = matchedNodeIds.includes(node.id);
                    const status = state.nodeStatuses[node.id];
                    const nodePosition = getSafeNodePosition(node);
                    return (
                      <div
                        key={node.id}
                        data-node-card="true"
                        className={`wa-node ${selected ? "selected" : ""} ${isMatch ? "match" : ""} ${status === "running" ? "running" : ""}`}
                        style={{ left: nodePosition.x + WORLD_ORIGIN, top: nodePosition.y + WORLD_ORIGIN, borderLeftColor: category.accent, boxShadow: selected ? `0 0 0 1px rgba(0,229,255,.42), 0 26px 60px ${category.shadow}` : undefined }}
                        onMouseDown={(event) => handleNodeMouseDown(event, node)}
                        onClick={(event) => { event.stopPropagation(); dispatch({ type: "SELECT_NODE", payload: node.id }); }}
                      >
                        <div className="wa-node-toolbar">
                          <button type="button" className="wa-icon-button" style={{ width: 30, height: 30, borderRadius: 999, padding: 0 }} onClick={(event) => { event.stopPropagation(); dispatch({ type: "SELECT_NODE", payload: node.id }); }}><MousePointer2 size={14} /></button>
                          <button type="button" className="wa-icon-button" style={{ width: 30, height: 30, borderRadius: 999, padding: 0 }} onClick={(event) => { event.stopPropagation(); dispatch({ type: "DELETE_NODES", payload: [node.id] }); }}><Trash2 size={14} /></button>
                        </div>
                        <div className="wa-node-header">
                          <div className="wa-node-icon">{definition.icon}</div>
                          <div>
                            <div className="wa-node-category">{category.label}</div>
                            <div className="wa-node-title">{node.data?.label || definition.title}</div>
                          </div>
                        </div>
                        <div className="wa-node-preview">{getNodePreview(node)}</div>
                        {definition.inputPorts?.length ? (
                          <>
                            <button type="button" data-port="true" className="wa-port wa-port-input" style={{ left: 0, top: NODE_HEIGHT / 2, borderColor: category.accent, boxShadow: `0 0 0 5px ${category.shadow}` }} onClick={(event) => handleInputPortClick(event, node.id)} />
                            <span className="wa-port-label" style={{ left: 18, top: NODE_HEIGHT / 2 }}>In</span>
                          </>
                        ) : null}
                        {definition.outputPorts.map((port, index) => (
                          <React.Fragment key={port.id}>
                            <button type="button" data-port="true" className="wa-port wa-port-output" style={{ left: NODE_WIDTH, top: 48 + index * 28, borderColor: category.accent, boxShadow: `0 0 0 5px ${category.shadow}` }} onClick={(event) => handleOutputPortClick(event, node.id, port.id)} />
                            <span className="wa-port-label" style={{ right: 18, top: 48 + index * 28, textAlign: "right" }}>{port.label}</span>
                          </React.Fragment>
                        ))}
                        {status ? <div className="wa-node-status"><span>{status === "success" ? "OK" : status === "error" ? "ERR" : "RUN"}</span><span>{status === "success" ? "✅" : status === "error" ? "❌" : "⏳"}</span></div> : null}
                      </div>
                    );
                  })}
                </div>

                {state.selectionBox ? (() => {
                  const start = worldToScreen(state.selectionBox.start, state.viewport);
                  const end = worldToScreen(state.selectionBox.end, state.viewport);
                  return <div className="wa-selection-box" style={{ left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }} />;
                })() : null}
                <div className="wa-minimap" onClick={handleMiniMapClick}>
                  <svg viewBox={`0 0 ${minimapData.width} ${minimapData.height}`}>
                    <rect x="0" y="0" width={minimapData.width} height={minimapData.height} fill="#10141e" />
                    {state.edges.map((edge) => {
                      const sourceNode = state.nodes.find((node) => node.id === edge.source);
                      const targetNode = state.nodes.find((node) => node.id === edge.target);
                      if (!sourceNode || !targetNode) return null;
                      const sourcePosition = getSafeNodePosition(sourceNode);
                      const targetPosition = getSafeNodePosition(targetNode);
                      return <line key={edge.id} x1={12 + (sourcePosition.x - minimapData.bounds.x) * minimapData.scale} y1={12 + (sourcePosition.y - minimapData.bounds.y + NODE_HEIGHT / 2) * minimapData.scale} x2={12 + (targetPosition.x - minimapData.bounds.x + NODE_WIDTH) * minimapData.scale} y2={12 + (targetPosition.y - minimapData.bounds.y + NODE_HEIGHT / 2) * minimapData.scale} stroke={getEdgeColor(edge, state.nodes)} strokeOpacity="0.7" strokeWidth="1.4" />;
                    })}
                    {state.nodes.map((node) => {
                      const nodePosition = getSafeNodePosition(node);
                      return (
                        <rect key={node.id} x={12 + (nodePosition.x - minimapData.bounds.x) * minimapData.scale} y={12 + (nodePosition.y - minimapData.bounds.y) * minimapData.scale} width={Math.max(NODE_WIDTH * minimapData.scale, 18)} height={Math.max(NODE_HEIGHT * minimapData.scale, 12)} rx="6" fill={getNodeColorByCategory(node)} fillOpacity={state.selectedNodeIds.includes(node.id) ? "0.9" : "0.55"} />
                      );
                    })}
                    {canvasRef.current ? (() => {
                      const rect = canvasRef.current.getBoundingClientRect();
                      const topLeft = screenToWorld(rect.left, rect.top, rect, state.viewport);
                      const bottomRight = screenToWorld(rect.left + rect.width, rect.top + rect.height, rect, state.viewport);
                      return <rect x={12 + (topLeft.x - minimapData.bounds.x) * minimapData.scale} y={12 + (topLeft.y - minimapData.bounds.y) * minimapData.scale} width={(bottomRight.x - topLeft.x) * minimapData.scale} height={(bottomRight.y - topLeft.y) * minimapData.scale} fill="transparent" stroke="#00e5ff" strokeWidth="1.4" />;
                    })() : null}
                  </svg>
                </div>

                {state.contextMenu ? (
                  <div className="wa-context-menu" style={{ left: state.contextMenu.x, top: state.contextMenu.y }} onClick={(event) => event.stopPropagation()}>
                    <h4>Canvas Menu</h4>
                    <div className="wa-context-actions">
                      <button type="button" className="wa-context-action" onClick={() => pasteSelection(state.contextMenu.world)}><span>Paste</span><ClipboardPaste size={16} /></button>
                      <button type="button" className="wa-context-action" onClick={() => dispatch({ type: "SET_SELECTED_NODES", payload: state.nodes.map((node) => node.id) })}><span>Select All</span><MousePointer2 size={16} /></button>
                    </div>
                    <h4>Add Node</h4>
                    <div className="wa-context-actions" style={{ maxHeight: 280, overflowY: "auto" }}>
                      {NODE_LIBRARY.map((nodeDefinition) => (
                        <button key={nodeDefinition.type} type="button" className="wa-context-action" onClick={() => addNodeAt(nodeDefinition.type, { x: state.contextMenu.world.x - NODE_WIDTH / 2, y: state.contextMenu.world.y - NODE_HEIGHT / 2 })}>
                          <span>{nodeDefinition.icon} {nodeDefinition.title}</span>
                          <Plus size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <aside className={`wa-config-panel ${activeNode ? "open" : ""}`}>
                  {activeNode ? (
                    <>
                      <div className="wa-config-header">
                        <div>
                          <div className="wa-brand-eyebrow">{CATEGORY_META[resolveNodeDefinition(activeNode).category].label}</div>
                          <h3>{activeNode.data?.label || resolveNodeDefinition(activeNode).title}</h3>
                        </div>
                        <button type="button" className="wa-icon-button" onClick={() => dispatch({ type: "SET_SELECTED_NODES", payload: [] })}><X size={16} /></button>
                      </div>
                      <div className="wa-config-body">
                        <div className="wa-form-group">
                          <label>Node Name</label>
                          <input className="wa-input" value={activeNode.data?.label || ""} onChange={(event) => dispatch({ type: "PATCH_NODE", payload: { id: activeNode.id, patch: { label: event.target.value } } })} />
                        </div>
                        <div className="wa-form-group">
                          <label>Description</label>
                          <textarea className="wa-textarea" value={activeNode.data?.description || ""} onChange={(event) => dispatch({ type: "PATCH_NODE", payload: { id: activeNode.id, patch: { description: event.target.value } } })} />
                        </div>
                        {renderNodeSpecificFields()}
                      </div>
                      <div className="wa-config-footer">
                        <button className="wa-button wa-button--primary" type="button" onClick={() => testSingleNode(activeNode)}><Play size={16} />Test Node</button>
                        <div className="wa-inline-grid">
                          <button className="wa-button" type="button" onClick={() => duplicateNodes([activeNode.id])}><Copy size={16} />Duplicate</button>
                          <button className="wa-button" type="button" onClick={() => dispatch({ type: "DELETE_NODES", payload: [activeNode.id] })}><Trash2 size={16} />Delete</button>
                        </div>
                      </div>
                    </>
                  ) : <div className="wa-empty-state">Select a node to configure its prompt, routing, and execution settings.</div>}
                </aside>
              </div>
            </div>

            <div className="wa-log-panel">
              <div className="wa-log-header">
                <div>
                  <div className="wa-section-title" style={{ marginBottom: 4 }}><span>Execution Log</span><span>{state.logs.length}</span></div>
                  <div className="wa-help">Trigger runs, node tests, and branch decisions appear here.</div>
                </div>
                <div className="wa-topbar-actions">
                  <span className="wa-pill">{selectedCount} selected</span>
                  <button className="wa-button" type="button" onClick={() => dispatch({ type: "CLEAR_LOGS" })}><Trash2 size={16} />Clear Logs</button>
                </div>
              </div>
              <div className="wa-log-list">
                {state.logs.length ? state.logs.slice().reverse().map((log) => (
                  <div className="wa-log-item" key={log.id}>
                    <div className="wa-log-time">{log.timestamp || "--:--:--"}</div>
                    <div>{log.message}</div>
                  </div>
                )) : <div className="wa-empty-state">No execution events yet. Run the workflow or test a node to populate the log.</div>}
              </div>
            </div>
          </div>
        </section>

        <input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImportFile} />
      </div>
    </>
  );
}

export default WhatsAppWorkflow;
