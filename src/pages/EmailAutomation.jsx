import React, { useMemo, useState } from "react";
import axios from "axios";
import "./EmailAutomation.css";

const MAX_PREVIEW_ROWS = 10;

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

const EmailAutomation = () => {
  const [subject, setSubject] = useState("");
  const [templateMessage, setTemplateMessage] = useState("Hi {{name}},\n\nThank you for being with us.");
  const [recipients, setRecipients] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "info" });
  const [isSending, setIsSending] = useState(false);
  const [sendReport, setSendReport] = useState(null);

  const previewRows = useMemo(() => recipients.slice(0, MAX_PREVIEW_ROWS), [recipients]);

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
        type: data?.failed > 0 ? "warning" : "success"
      });
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

      <section className="panel preview-box">
        <div className="preview-head">
          <h3>Recipients Preview</h3>
          <span>{recipients.length} valid recipients</span>
        </div>

        {recipients.length ? (
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
        ) : (
          <p className="empty-state">No recipients loaded yet.</p>
        )}

        {recipients.length > MAX_PREVIEW_ROWS ? (
          <p className="preview-note">Showing first {MAX_PREVIEW_ROWS} recipients only.</p>
        ) : null}
      </section>

      {sendReport ? (
        <section className="panel report-box">
          <h3>Send Report</h3>
          <p>Total: {sendReport.total || recipients.length}</p>
          <p>Sent: {sendReport.sent || 0}</p>
          <p>Failed: {sendReport.failed || 0}</p>
          {Array.isArray(sendReport.report) && sendReport.report.some((item) => item.status === "failed") ? (
            <div className="report-errors">
              {sendReport.report
                .filter((item) => item.status === "failed")
                .slice(0, 5)
                .map((item) => (
                  <p key={item.email}>
                    {item.email}: {item.error || "Failed"}
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
