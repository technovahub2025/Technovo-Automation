import React, { useState } from "react";
import useFeatureFlag from "../hooks/useFeatureFlag";
import "./WhatsAppCampaignBuilder.css";
import "../styles/theme.css";

const steps = [
  "Select Template",
  "Upload Media",
  "Import Contacts",
  "Schedule Campaign",
  "Launch"
];

const WhatsAppCampaignBuilder = () => {
  const [activeStep, setActiveStep] = useState(0);
  const canBroadcast = useFeatureFlag("broadcastMessaging", true);

  return (
    <div className="nx-page builder-page">
      <header className="nx-page__header">
        <h1 className="nx-title">WhatsApp Campaign Builder</h1>
        <p className="nx-subtitle">Create and launch broadcast campaigns in minutes.</p>
      </header>

      {!canBroadcast && (
        <div className="locked-banner">
          Upgrade your plan to enable WhatsApp broadcast scheduling.
        </div>
      )}

      <div className="builder-steps">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`builder-step ${index === activeStep ? "active" : ""}`}
          >
            <span>{index + 1}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>

      <div className="builder-card">
        <h3>{steps[activeStep]}</h3>
        <p>Configure this step using existing campaign settings.</p>
        <div className="builder-actions">
          <button
            className="ghost-btn"
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
          >
            Back
          </button>
          <button
            className="primary-btn"
            onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
            disabled={!canBroadcast}
          >
            {activeStep === steps.length - 1 ? "Launch" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppCampaignBuilder;
