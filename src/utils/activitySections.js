const wa = (kind, label) => ({ service: 'broadcast', kind, label });
const voice = (kind, label) => ({ service: 'voice', kind, label });
const crm = [wa('contacts', 'Contacts'), wa('tasks', 'Tasks'), wa('deals', 'Deals'), wa('meetings', 'Meetings')];
const voiceActivity = [voice('broadcasts', 'Voice broadcasts'), voice('campaigns', 'Outbound campaigns'), voice('workflows', 'IVR workflows'), voice('schedules', 'Schedules'), voice('calls', 'Calls'), voice('templates', 'Voice templates'), voice('leads', 'Voice leads')];
const email = [{ service: 'admin', kind: 'email', label: 'Emails' }];
const sections = {
  '/': [wa('broadcasts', 'Broadcasts'), wa('templates', 'Templates'), ...crm, wa('campaigns', 'Campaigns'), wa('ads', 'Meta ads'), wa('workflows', 'WhatsApp workflows'), wa('missedcalls', 'Missed calls'), ...voiceActivity, ...email],
  '/broadcast': [wa('broadcasts', 'Broadcasts')],
  '/broadcast-dashboard': [wa('broadcasts', 'Broadcasts')],
  '/templates': [wa('templates', 'Templates')],
  '/contacts': [wa('contacts', 'Contacts')],
  '/inbox': [wa('messages', 'Messages')],
  '/crm/home': crm,
  '/crm/pipeline': [wa('contacts', 'Pipeline contacts')],
  '/crm/tasks': [wa('tasks', 'Tasks')],
  '/crm/follow-ups': [wa('tasks', 'Follow-ups')],
  '/crm/tasks-calendar': [wa('tasks', 'Tasks')],
  '/crm/deals': [wa('deals', 'Deals')],
  '/crm/meetings': [wa('meetings', 'Meetings')],
  '/crm/ops': crm,
  '/crm/reports': crm,
  '/ads-manager': [wa('campaigns', 'Campaigns')],
  '/campaignmanagement': [wa('campaigns', 'Campaigns')],
  '/meta-ads-manager': [wa('ads', 'Meta ads')],
  '/meta-leads': [wa('contacts', 'Meta leads')],
  '/insights': [wa('campaigns', 'Campaigns'), wa('ads', 'Meta ads')],
  '/whatsapp-workflow': [wa('workflows', 'WhatsApp workflows')],
  '/voice-broadcast': [voice('broadcasts', 'Voice broadcasts')],
  '/voice-automation/inbound': [voice('workflows', 'IVR workflows'), voice('leads', 'Voice leads')],
  '/voice-automation/outbound': [voice('campaigns', 'Outbound campaigns'), voice('templates', 'Voice templates')],
  '/voice-automation/outbound/schedules': [voice('schedules', 'Schedules')],
  '/voice-automation/history': [voice('calls', 'Calls')],
  '/missedcalls/overview': [wa('missedcalls', 'Missed calls')],
  '/missedcalls/calls': [wa('missedcalls', 'Missed calls')],
  '/missedcalls/automation': [wa('missedcalls', 'Missed calls')],
  '/email-automation/dashboard': email,
  '/email-automation/bulk-email': email
};
export const getActivitySections = (path) => sections[path] || (path.startsWith('/inbox/') ? sections['/inbox'] : null);
