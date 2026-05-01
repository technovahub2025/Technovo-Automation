import { useMemo } from 'react';
import {
  getUnreadCount,
  normalizeConversation,
  normalizePhone,
  getPhoneLookupKeys,
  isRealName,
  getMappedContactName,
  hasRealContactName,
  getConversationDisplayName,
  enrichConversationIdentity,
  getConversationAvatarText,
  getConversationIdValue,
  leadStageOptions,
  toDateTimeLocalInputValue,
  toIsoFromDateTimeLocalInput,
  formatDateTimeForActivity,
  applyLeadScoreUpdateToConversation,
  getConversationLeadScore,
  getContactIdFromConversation,
  getContactTagsRaw,
  deriveLeadStatus,
  getLeadStageValue,
  getCrmActivityLabel,
  getCrmActivityDescription
} from './teamInboxUtils';

export const useTeamInboxBoundUtils = (contactNameMap, stageOptions = leadStageOptions) =>
  useMemo(
    () => ({
      leadStageOptions: Array.isArray(stageOptions) && stageOptions.length ? stageOptions : leadStageOptions,
      getUnreadCount,
      normalizeConversation,
      normalizePhone,
      getPhoneLookupKeys,
      isRealName,
      getMappedContactName: (phone) => getMappedContactName(phone, contactNameMap),
      hasRealContactName,
      getConversationDisplayName: (conversation) =>
        getConversationDisplayName(conversation, contactNameMap),
      enrichConversationIdentity: (conversation, sources = []) =>
        enrichConversationIdentity(conversation, sources, contactNameMap),
      getConversationAvatarText: (conversation) =>
        getConversationAvatarText(conversation, contactNameMap),
      getConversationIdValue,
      toDateTimeLocalInputValue,
      toIsoFromDateTimeLocalInput,
      formatDateTimeForActivity,
      applyLeadScoreUpdateToConversation,
      getConversationLeadScore,
      getContactIdFromConversation,
      getContactTagsRaw,
      deriveLeadStatus,
      getLeadStageValue: (conversation) =>
        getLeadStageValue(conversation, Array.isArray(stageOptions) && stageOptions.length ? stageOptions : leadStageOptions),
      getCrmActivityLabel,
      getCrmActivityDescription
    }),
    [contactNameMap, stageOptions]
  );
