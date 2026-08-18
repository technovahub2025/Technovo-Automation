export const SIDEBAR_ACCESS_GROUPS = [
  {
    key: "inbox",
    label: "Inbox",
    description: "Show the Inbox entry in the sidebar.",
    items: [
      { flag: "teamInbox", label: "Inbox" }
    ]
  },
  {
    key: "bulkMessages",
    label: "Bulk Messages",
    description: "Show Bulk Messages and its submenu items.",
    items: [
      { flag: "broadcastDashboard", label: "Campaigns" },
      { flag: "teamInbox", label: "Team Inbox" },
      { flag: "broadcastMessaging", label: "Broadcast" },
      { flag: "templates", label: "Templates" },
      { flag: "contacts", label: "Contacts" }
    ]
  },
  {
    key: "crm",
    label: "CRM",
    description: "Show CRM and its workspace sections.",
    items: [
      { flag: "crmHome", label: "CRM Home" },
      { flag: "crmPipeline", label: "Pipeline" },
      { flag: "crmTasks", label: "Tasks" },
      { flag: "crmDeals", label: "Deals" },
      { flag: "crmMeetings", label: "Meetings" },
      { flag: "crmReports", label: "Reports" },
      { flag: "crmOps", label: "Follow-up Ops" },
      { flag: "crmLeadScoringSettings", label: "Lead Scoring Settings" },
      { flag: "crmTaskCalendar", label: "Task Calendar" }
    ]
  },
  {
    key: "metaAds",
    label: "Meta Ads",
    description: "Show Meta Ads and related insights/connect pages.",
    items: [
      { flag: "adsManager", label: "Campaigns" },
      { flag: "analytics", label: "Reports" },
      { flag: "metaConnect", label: "Connect Meta" },
      { flag: "metaLeads", label: "Leads" }
    ]
  },
  {
    key: "voice",
    label: "Voice",
    description: "Show Voice and its calling tools.",
    items: [
      { flag: "voiceCampaign", label: "Voice Broadcast" },
      { flag: "inboundAutomation", label: "Inbound / IVR" },
      { flag: "outboundVoice", label: "Outbound" },
      { flag: "callAnalytics", label: "Call Analytics" }
    ]
  },
  {
    key: "missed",
    label: "Missed",
    description: "Show the Missed Calls entry in the sidebar.",
    items: [
      { flag: "missedCall", label: "Missed Calls" }
    ]
  },
  {
    key: "email",
    label: "Email",
    description: "Show the Email automation entry in the sidebar.",
    items: [
      { flag: "workflowAutomation", label: "Email Automation" }
    ]
  }
];

const SIDEBAR_ACCESS_FLAG_KEYS = Array.from(
  new Set(SIDEBAR_ACCESS_GROUPS.flatMap((group) => (Array.isArray(group.items) ? group.items.map((item) => item.flag) : [])))
);

export const SIDEBAR_ACCESS_FLAGS = SIDEBAR_ACCESS_FLAG_KEYS.reduce((accumulator, flag) => {
  accumulator[flag] = false;
  return accumulator;
}, {});

export const buildSidebarFeatureFlags = (flags = {}) => {
  const source = flags && typeof flags === "object" ? flags : {};
  return SIDEBAR_ACCESS_FLAG_KEYS.reduce(
    (accumulator, flag) => {
      accumulator[flag] = Boolean(source[flag]);
      return accumulator;
    },
    { ...SIDEBAR_ACCESS_FLAGS }
  );
};

export const hasSidebarAccessSelection = (flags = {}) =>
  SIDEBAR_ACCESS_FLAG_KEYS.some((flag) => Boolean(flags?.[flag]));

export const collapseSidebarFeatureFlags = (flags = {}) =>
  hasSidebarAccessSelection(flags) ? buildSidebarFeatureFlags(flags) : {};

export const isSidebarAccessGroupEnabled = (flags = {}, group = {}) =>
  Array.isArray(group?.items) && group.items.some((item) => Boolean(flags?.[item.flag]));
