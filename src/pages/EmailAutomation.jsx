import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./EmailAutomation.css";

const MAX_PREVIEW_ROWS = 10;
const TEMPLATE_STORAGE_KEY_BASE = "email_automation_templates_v1";
const HISTORY_STORAGE_KEY_BASE = "email_automation_history_v1";
const DEFAULT_TEMPLATES = [
  {
    id: "tpl-order-placed",
    name: "Order Placed",
    subject: "Your order has been placed",
    message:
      "Hi {{name}},\n\nThank you for your order. We have received it successfully and will share the next update soon.\n\nRegards,\nNexison Services"
  },
  {
    id: "tpl-payment-received",
    name: "Payment Received",
    subject: "Payment received successfully",
    message:
      "Hi {{name}},\n\nWe have received your payment. Thank you for completing the transaction.\n\nRegards,\nNexison Services"
  },
  {
    id: "tpl-shipped",
    name: "Shipment Update",
    subject: "Your shipment is on the way",
    message:
      "Hi {{name}},\n\nYour package has been dispatched and is on the way. We will notify you once it is delivered.\n\nRegards,\nNexison Services"
  }
];

const splitCsvLine = (line = "") => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseCsvRecipients = (text = "") => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { recipients: [], errors: ["CSV file is empty."] };
  }

  const header = splitCsvLine(lines[0]).map((value) => value.toLowerCase());
  const nameIndex = header.findIndex((key) => ["name", "username", "full_name", "full name"].includes(key));
  const emailIndex = header.findIndex((key) => ["email", "mail", "email_address", "email address"].includes(key));

  if (nameIndex === -1 || emailIndex === -1) {
    return {
      recipients: [],
      errors: ["CSV must include header columns: name and email."]
    };
  }

  const recipients = [];
  const seen = new Set();
  const errors = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const columns = splitCsvLine(lines[i]);
    const name = (columns[nameIndex] || "").trim();
    const email = (columns[emailIndex] || "").trim().toLowerCase();

    if (!name || !email) {
      errors.push(`Row ${rowNumber}: name or email is missing.`);
      continue;
    }

    if (!emailRegex.test(email)) {
      errors.push(`Row ${rowNumber}: invalid email \"${email}\".`);
      continue;
    }

    if (seen.has(email)) {
      errors.push(`Row ${rowNumber}: duplicate email \"${email}\".`);
      continue;
    }

    seen.add(email);
    recipients.push({ name, email });
  }

  return { recipients, errors };
};

const getEmailAutomationStorageScope = () => {
  if (typeof window === "undefined") return "guest";
  try {
    const userKey = import.meta.env.VITE_USER_KEY || "user";
    const rawUser = window.localStorage.getItem(userKey) || window.localStorage.getItem("user");
    if (!rawUser) return "guest";

    const parsed = JSON.parse(rawUser);
    const identity = parsed?._id || parsed?.id || parsed?.email || parsed?.username;
    if (!identity) return "guest";
    return String(identity).trim().toLowerCase();
  } catch {
    return "guest";
  }
};

const EmailAutomation = () => {
  const storageScope = getEmailAutomationStorageScope();
  const templateStorageKey = `${TEMPLATE_STORAGE_KEY_BASE}_${storageScope}`;
  const historyStorageKey = `${HISTORY_STORAGE_KEY_BASE}_${storageScope}`;

  const [subject, setSubject] = useState("");
  const [templateMessage, setTemplateMessage] = useState("Hi {{name}},\n\nThank you for being with us.");
  const [recipients, setRecipients] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "info" });
  const [isSending, setIsSending] = useState(false);
  const [sendReport, setSendReport] = useState(null);
  const [showFailedDetails, setShowFailedDetails] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TEMPLATES;
    try {
      const raw = window.localStorage.getItem(templateStorageKey);
      if (!raw) return DEFAULT_TEMPLATES;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_TEMPLATES;
      return parsed;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateSubject, setNewTemplateSubject] = useState("");
  const [newTemplateMessage, setNewTemplateMessage] = useState("");
  const [campaignHistory, setCampaignHistory] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(historyStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const previewRows = useMemo(() => recipients, [recipients]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const templatesRaw = window.localStorage.getItem(templateStorageKey);
      const templatesParsed = templatesRaw ? JSON.parse(templatesRaw) : null;
      setSavedTemplates(Array.isArray(templatesParsed) && templatesParsed.length ? templatesParsed : DEFAULT_TEMPLATES);
    } catch {
      setSavedTemplates(DEFAULT_TEMPLATES);
    }

    try {
      const historyRaw = window.localStorage.getItem(historyStorageKey);
      const historyParsed = historyRaw ? JSON.parse(historyRaw) : null;
      setCampaignHistory(Array.isArray(historyParsed) ? historyParsed : []);
    } catch {
      setCampaignHistory([]);
    }
  }, [templateStorageKey, historyStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(templateStorageKey, JSON.stringify(savedTemplates));
  }, [savedTemplates, templateStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(historyStorageKey, JSON.stringify(campaignHistory));
  }, [campaignHistory, historyStorageKey]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStatusMessage({ text: "Please upload only a .csv file.", type: "error" });
      return;
    }

    const fileText = await file.text();
    const { recipients: parsedRecipients, errors } = parseCsvRecipients(fileText);

    setRecipients(parsedRecipients);
    setParseErrors(errors);
    setSendReport(null);

    if (parsedRecipients.length) {
      setStatusMessage({ text: `Loaded ${parsedRecipients.length} recipients.`, type: "success" });
    } else {
      setStatusMessage({ text: "No valid recipients found in uploaded CSV.", type: "error" });
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = [
      "name,email",
      "John Doe,john.doe@example.com",
      "Priya Sharma,priya.sharma@example.com"
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.setAttribute("download", "sample-recipients.csv");
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const handleSendBulkEmail = async () => {
    if (!subject.trim()) {
      setStatusMessage({ text: "Subject is required.", type: "error" });
      return;
    }

    if (!templateMessage.trim()) {
      setStatusMessage({ text: "Template message is required.", type: "error" });
      return;
    }

    if (!recipients.length) {
      setStatusMessage({ text: "Upload a valid recipient list before sending.", type: "error" });
      return;
    }

    try {
      setIsSending(true);
      setSendReport(null);
      setShowFailedDetails(false);

      const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
      const token = localStorage.getItem(tokenKey) || localStorage.getItem("authToken");
      const baseUrl = import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_API_URL || "";

      const response = await axios.post(
        `${baseUrl}/api/email/bulk-send`,
        {
          subject: subject.trim(),
          templateMessage,
          recipients
        },
        {
          timeout: Number(import.meta.env.VITE_BULK_EMAIL_TIMEOUT_MS || 45000),
          headers: token
            ? {
                Authorization: `Bearer ${token}`
              }
            : {}
        }
      );

      const data = response?.data || {};
      setSendReport(data);
      setStatusMessage({
        text: data?.message || "Bulk email request completed.",
        type: data?.failed > 0 ? "warning" : "info"
      });
      setCampaignHistory((prev) => [
        {
          id: Date.now(),
          createdAt: new Date().toISOString(),
          subject: subject.trim(),
          total: data?.total || recipients.length,
          sent: data?.accepted ?? data?.sent ?? 0,
          failed: data?.failed || 0
        },
        ...prev
      ].slice(0, 12));
    } catch (error) {
      if (error?.code === "ECONNABORTED") {
        setStatusMessage({
          text: "Request timed out. SMTP server may be slow/unreachable. Please retry.",
          type: "error"
        });
        return;
      }
      const message = error?.response?.data?.message || "Failed to send bulk emails.";
      const details = error?.response?.data?.error;
      setStatusMessage({
        text: details ? `${message}: ${details}` : message,
        type: "error"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleUseTemplate = (template) => {
    setSubject(template.subject || "");
    setTemplateMessage(template.message || "");
    setStatusMessage({ text: `Template loaded: ${template.name}`, type: "info" });
  };

  const handleDeleteTemplate = (templateId) => {
    setSavedTemplates((prev) => prev.filter((item) => item.id !== templateId));
    setStatusMessage({ text: "Template deleted.", type: "info" });
  };

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateSubject.trim() || !newTemplateMessage.trim()) {
      setStatusMessage({ text: "Template name, subject, and message are required.", type: "error" });
      return;
    }

    const createdTemplate = {
      id: `tpl-${Date.now()}`,
      name: newTemplateName.trim(),
      subject: newTemplateSubject.trim(),
      message: newTemplateMessage
    };

    setSavedTemplates((prev) => [createdTemplate, ...prev]);
    setNewTemplateName("");
    setNewTemplateSubject("");
    setNewTemplateMessage("");
    setStatusMessage({ text: `Template created: ${createdTemplate.name}`, type: "success" });
  };

  return (
    <div className="email-automation bulk-email-page">
      <section className="bulk-hero">
        <div>
          <p className="hero-kicker">Email Workflow</p>
          <h1>Bulk Email Automation</h1>
          <p className="subtitle">
            Upload contacts, craft your message with placeholders, and launch a personalized campaign in one flow.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-tile">
            <span>Recipients</span>
            <strong>{recipients.length}</strong>
          </div>
          <div className="metric-tile">
            <span>CSV Issues</span>
            <strong>{parseErrors.length}</strong>
          </div>
          <div className="metric-tile">
            <span>Last Sent</span>
            <strong>{sendReport?.sent ?? 0}</strong>
          </div>
        </div>
      </section>

      {statusMessage.text ? <div className={`status-message ${statusMessage.type}`}>{statusMessage.text}</div> : null}

      <section className="compose-grid">
        <article className="panel panel-main">
          <div className="panel-head">
            <h2>Compose Message</h2>
            <p>Use placeholders to personalize each email.</p>
          </div>

          <div className="field-group">
            <label htmlFor="subject">Email Subject</label>
            <input
              id="subject"
              type="text"
              placeholder="Enter campaign subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="field-group full-width">
            <label htmlFor="templateMessage">Template Message</label>
            <textarea
              id="templateMessage"
              rows={9}
              placeholder="Use {{name}} and {{email}} placeholders"
              value={templateMessage}
              onChange={(event) => setTemplateMessage(event.target.value)}
            />
            <small>
              Supported placeholders: <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>
            </small>
          </div>

          <div className="template-library">
            <div className="template-library-head">
              <h3>Default & Saved Templates</h3>
              <span>{savedTemplates.length} templates</span>
            </div>

            <div className="template-cards">
              {savedTemplates.map((item) => (
                <div className="template-card" key={item.id}>
                  <div className="template-card-title">{item.name}</div>
                  <div className="template-card-subject">{item.subject}</div>
                  <div className="template-card-preview">{item.message}</div>
                  <div className="template-card-actions">
                    <button type="button" className="template-btn use" onClick={() => handleUseTemplate(item)}>
                      Use
                    </button>
                    <button type="button" className="template-btn delete" onClick={() => handleDeleteTemplate(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="template-create">
              <h4>Create New Template</h4>
              <div className="template-create-grid">
                <input
                  type="text"
                  placeholder="Template name"
                  value={newTemplateName}
                  onChange={(event) => setNewTemplateName(event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Template subject"
                  value={newTemplateSubject}
                  onChange={(event) => setNewTemplateSubject(event.target.value)}
                />
              </div>
              <textarea
                rows={4}
                placeholder="Template message"
                value={newTemplateMessage}
                onChange={(event) => setNewTemplateMessage(event.target.value)}
              />
              <button type="button" className="template-create-btn" onClick={handleCreateTemplate}>
                Create Template
              </button>
            </div>
          </div>
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <h2>Recipients Source</h2>
            <p>Upload a CSV with columns: name, email</p>
          </div>

          <div className="field-group">
            <label htmlFor="csvFile">Recipient CSV</label>
            <input id="csvFile" type="file" accept=".csv" onChange={handleFileUpload} />
          </div>

          <div className="csv-help-row">
            <small>Need a template file?</small>
            <button className="sample-download-btn" type="button" onClick={handleDownloadSampleCsv}>
              Download Sample CSV
            </button>
          </div>

          <button className="send-btn" type="button" onClick={handleSendBulkEmail} disabled={isSending || !recipients.length}>
            {isSending ? "Sending emails..." : "Send Bulk Email"}
          </button>

          <section className="preview-box preview-box-side">
            <div className="preview-head">
              <h3>Recipients Preview</h3>
              <span>{recipients.length} valid recipients</span>
            </div>

            {recipients.length ? (
              <div className={`preview-table-wrap ${recipients.length > MAX_PREVIEW_ROWS ? "scrollable" : ""}`}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((recipient) => (
                      <tr key={recipient.email}>
                        <td>{recipient.name}</td>
                        <td>{recipient.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No recipients loaded yet.</p>
            )}

            {recipients.length > MAX_PREVIEW_ROWS ? <p className="preview-note">Scroll to view more recipients.</p> : null}
          </section>

          <div className="history-mini">
            <div className="history-mini-head">
              <h3>Recent Send History</h3>
              <span>{campaignHistory.length}</span>
            </div>
            {campaignHistory.length ? (
              <div className="history-mini-list">
                {campaignHistory.slice(0, 6).map((item) => (
                  <div className="history-mini-item" key={item.id}>
                    <div className="history-mini-subject">{item.subject || "Untitled campaign"}</div>
                    <div className="history-mini-meta">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      <span>Total {item.total}</span>
                      <span>Sent {item.sent}</span>
                      <span>Failed {item.failed}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="history-mini-empty">No campaigns sent yet.</p>
            )}
          </div>
        </aside>
      </section>

      {!!parseErrors.length && (
        <section className="panel errors-box">
          <h3>CSV Issues ({parseErrors.length})</h3>
          <ul>
            {parseErrors.slice(0, 8).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          {parseErrors.length > 8 ? <p>+{parseErrors.length - 8} more issues</p> : null}
        </section>
      )}

      {sendReport ? (
        <section className="panel report-box">
          <h3>Send Report</h3>
          <div className="report-summary">
            <p>Total: {sendReport.total || recipients.length}</p>
            <p>Accepted by SMTP: {sendReport.accepted ?? sendReport.sent ?? 0}</p>
            <button
              type="button"
              className={`failed-toggle ${showFailedDetails ? "open" : ""}`}
              disabled={!sendReport.failed}
              onClick={() => setShowFailedDetails((prev) => !prev)}
            >
              Failed: {sendReport.failed || 0}
            </button>
          </div>
          {sendReport.note ? <p>{sendReport.note}</p> : null}
          {showFailedDetails &&
          Array.isArray(sendReport.report) &&
          sendReport.report.some((item) => item.status === "failed") ? (
            <div className="report-errors">
              {sendReport.report
                .filter((item) => item.status === "failed")
                .map((item) => (
                  <p key={item.email}>
                    {item.email}: {item.userMessage || item.error || "Failed"}
                  </p>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default EmailAutomation;
