import React, { useState } from "react";
import useFeatureFlag from "../hooks/useFeatureFlag";
import "./VoiceCampaignBuilder.css";
import "../styles/theme.css";

const steps = [
  "Upload Audio / TTS",
  "Choose Provider",
  "Import Contacts",
  "Schedule Campaign",
  "Launch"
];

const VoiceCampaignBuilder = () => {
  const [activeStep, setActiveStep] = useState(0);
  const canVoice = useFeatureFlag("voiceCampaign", true);

  return (
    <div className="nx-page builder-page">
      <header className="nx-page__header">
        <h1 className="nx-title">Voice Campaign Builder</h1>
        <p className="nx-subtitle">Create outbound voice campaigns with audio or TTS.</p>
      </header>

      {!canVoice && (
        <div className="locked-banner">
          Upgrade your plan to unlock voice campaigns.
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
        <p>Use existing voice automation settings to configure this step.</p>
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
            disabled={!canVoice}
          >
            {activeStep === steps.length - 1 ? "Launch" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCampaignBuilder;
