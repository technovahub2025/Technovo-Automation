import { buildReportAnalytics } from "../utils/crmReportsAnalytics";

self.onmessage = (event) => {
  try {
    const payload = event?.data || {};
    const current = buildReportAnalytics(payload);
    const comparison = payload?.comparisonFilters
      ? buildReportAnalytics({
          summary: {},
          contacts: payload?.contacts || [],
          deals: payload?.deals || [],
          filters: payload.comparisonFilters
        })
      : null;
    const lastYear = payload?.lastYearFilters
      ? buildReportAnalytics({
          summary: {},
          contacts: payload?.contacts || [],
          deals: payload?.deals || [],
          filters: payload.lastYearFilters
        })
      : null;

    self.postMessage({
      success: true,
      data: {
        current,
        comparison,
        lastYear
      }
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error?.message || "Failed to compute CRM report analytics"
    });
  }
};
