export const SIDEBAR_ACCESS_GROUPS = [
  {
    key: "inbox",
    label: "Inbox",
    description: "Show the Inbox entry in the sidebar.",
    flags: ["teamInbox"]
  },
  {
    key: "bulkMessages",
    label: "Bulk Messages",
    description: "Show Bulk Messages and its submenu items.",
    flags: ["broadcastDashboard", "broadcastMessaging", "templates", "contacts", "teamInbox"]
  },
  {
    key: "crm",
    label: "CRM",
    description: "Show CRM and its workspace sections.",
    flags: [
      "crmHome",
      "crmPipeline",
      "crmTasks",
      "crmDeals",
      "crmMeetings",
      "crmReports",
      "crmOps",
      "crmLeadScoringSettings",
      "crmTaskCalendar"
    ]
  },
  {
    key: "metaAds",
    label: "Meta Ads",
    description: "Show Meta Ads and related insights/connect pages.",
    flags: ["adsManager", "analytics", "metaConnect", "metaLeads"]
  },
  {
    key: "voice",
    label: "Voice",
    description: "Show Voice and its calling tools.",
    flags: ["voiceCampaign", "inboundAutomation", "outboundVoice", "callAnalytics"]
  },
  {
    key: "missed",
    label: "Missed",
    description: "Show the Missed Calls entry in the sidebar.",
    flags: ["missedCall"]
  },
  {
    key: "email",
    label: "Email",
    description: "Show the Email automation entry in the sidebar.",
    flags: ["workflowAutomation"]
  }
];

const SIDEBAR_ACCESS_FLAG_KEYS = Array.from(
  new Set(SIDEBAR_ACCESS_GROUPS.flatMap((group) => group.flags))
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

export const isSidebarAccessGroupEnabled = (flags = {}, group = {}) =>
  Array.isArray(group?.flags) && group.flags.some((flag) => Boolean(flags?.[flag]));

