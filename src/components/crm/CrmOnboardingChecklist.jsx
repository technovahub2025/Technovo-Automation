import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";

const CrmOnboardingChecklist = ({ contactsCount = 0, tasksCount = 0, dealsCount = 0 }) => {
  const steps = useMemo(
    () => [
      {
        id: "import_contacts",
        title: "Import contacts",
        description: "Bring leads into CRM from contacts or opt-in flows.",
        to: "/contacts",
        done: Number(contactsCount) > 0
      },
      {
        id: "start_conversation",
        title: "Start first conversation",
        description: "Open inbox and send a first WhatsApp message/template.",
        to: "/inbox",
        done: false
      },
      {
        id: "create_follow_up",
        title: "Create follow-up task",
        description: "Set due date and owner so no lead is missed.",
        to: "/crm/tasks",
        done: Number(tasksCount) > 0
      },
      {
        id: "create_deal",
        title: "Create first deal",
        description: "Track value, probability, and expected close date.",
        to: "/crm/deals",
        done: Number(dealsCount) > 0
      }
    ],
    [contactsCount, dealsCount, tasksCount]
  );

  const completedCount = steps.filter((step) => step.done).length;
  const allDone = completedCount === steps.length;

  return (
    <section className="crm-onboarding-card">
      <div className="crm-onboarding-card__header">
        <h3>Quick Start</h3>
        <span>
          {completedCount}/{steps.length} completed
        </span>
      </div>
      {allDone ? (
        <p className="crm-onboarding-card__done">Core setup completed. Your CRM is ready for daily execution.</p>
      ) : null}
      <div className="crm-onboarding-card__list">
        {steps.map((step) => (
          <NavLink key={step.id} to={step.to} className="crm-onboarding-item">
            {step.done ? (
              <CheckCircle2 size={16} className="crm-onboarding-item__icon done" />
            ) : (
              <Circle size={16} className="crm-onboarding-item__icon" />
            )}
            <div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          </NavLink>
        ))}
      </div>
    </section>
  );
};

export default CrmOnboardingChecklist;
