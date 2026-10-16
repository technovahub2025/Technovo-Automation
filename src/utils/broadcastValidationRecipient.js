export const buildValidationRecipientPayload = (recipient = {}) => ({
  phone: String(recipient?.phone || "").trim(),
  variables: Array.isArray(recipient?.variables) ? recipient.variables : [],
  name: String(recipient?.name || "").trim(),
  contactId: String(recipient?.contactId || "").trim() || null,
  sourceType:
    String(
      recipient?.sourceType || recipient?.data?.sourceType || "",
    ).trim() || null,
  whatsappOptInStatus: String(
    recipient?.whatsappOptInStatus ||
      recipient?.data?.whatsappOptInStatus ||
      recipient?.fullData?.whatsappOptInStatus ||
      "",
  ).trim(),
  whatsappOptInScope: String(
    recipient?.whatsappOptInScope ||
      recipient?.data?.whatsappOptInScope ||
      recipient?.fullData?.whatsappOptInScope ||
      "",
  ).trim(),
  whatsappOptOutAt:
    recipient?.whatsappOptOutAt ||
    recipient?.data?.whatsappOptOutAt ||
    recipient?.fullData?.whatsappOptOutAt ||
    null,
  serviceWindowClosesAt:
    recipient?.serviceWindowClosesAt ||
    recipient?.data?.serviceWindowClosesAt ||
    recipient?.fullData?.serviceWindowClosesAt ||
    null,
  lastInboundMessageAt:
    recipient?.lastInboundMessageAt ||
    recipient?.data?.lastInboundMessageAt ||
    recipient?.fullData?.lastInboundMessageAt ||
    null,
  isBlocked: Boolean(
    recipient?.isBlocked ||
    recipient?.data?.isBlocked ||
    recipient?.fullData?.isBlocked,
  ),
});
