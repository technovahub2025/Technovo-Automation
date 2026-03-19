import React, { useState } from "react";
import axios from "axios";
import "./Billing.css";
import "../styles/theme.css";

const plans = [
  { code: "trial", name: "Trial", price: "₹0", note: "3 Days", cta: "Start Trial" },
  { code: "basic", name: "Basic", price: "₹3999", note: "per month", cta: "Upgrade to Basic" },
  { code: "growth", name: "Growth", price: "₹6999", note: "per month", cta: "Upgrade to Growth" },
  { code: "enterprise", name: "Enterprise", price: "Custom", note: "contact sales", cta: "Contact Sales" }
];

const Billing = () => {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const API_URL = import.meta.env.VITE_API_ADMIN_URL;

  const handleUpgrade = async (planCode) => {
    if (!API_URL) return alert("Billing API not configured");
    setLoadingPlan(planCode);
    try {
      const res = await axios.post(`${API_URL}/api/subscriptions/create`, {
        planCode,
        billingCycle: "monthly"
      });
      const checkoutUrl = res.data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      alert(res.data?.message || "Subscription initiated. Please complete payment.");
    } catch (err) {
      alert(err?.response?.data?.message || "Unable to start upgrade.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="nx-page billing-page">
      <header className="nx-page__header">
        <h1 className="nx-title">Billing & Plans</h1>
        <p className="nx-subtitle">Choose the plan that fits your growth stage.</p>
      </header>

      <div className="billing-grid">
        {plans.map((plan) => (
          <div key={plan.code} className="billing-card">
            <h3>{plan.name}</h3>
            <div className="billing-price">{plan.price}</div>
            <div className="billing-note">{plan.note}</div>
            <ul>
              <li>WhatsApp templates</li>
              <li>Voice campaigns</li>
              <li>Usage analytics</li>
            </ul>
            <button
              className="primary-btn"
              onClick={() => handleUpgrade(plan.code)}
              disabled={loadingPlan === plan.code}
            >
              {loadingPlan === plan.code ? "Processing..." : plan.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Billing;
