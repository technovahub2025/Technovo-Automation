import React from "react";
import "./PublicWhatsAppOptInSuccess.css";

function PublicWhatsAppOptInSuccess() {
  return (
    <div className="public-optin-success">
      <div className="public-optin-success-card">
        <span className="public-optin-success-eyebrow">Consent Confirmed</span>
        <h1>Thanks for opting in</h1>
        <p>
          You will receive WhatsApp updates from Technovohub. You can reply STOP anytime to opt out.
        </p>
        <a className="public-optin-success-button" href="/" rel="noreferrer">
          Back to site
        </a>
      </div>
    </div>
  );
}

export default PublicWhatsAppOptInSuccess;
