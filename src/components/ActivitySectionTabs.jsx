import './ActivitySectionTabs.css';

export default function ActivitySectionTabs({ value, onChange }) {
  return (
    <div className="activity-section-tabs" role="tablist" aria-label="Activity creator">
      {[['all', 'All activity'], ['agent', 'Agent']].map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key}
          className={value === key ? 'active' : ''} onClick={() => onChange(key)}>{label}</button>
      ))}
    </div>
  );
}
