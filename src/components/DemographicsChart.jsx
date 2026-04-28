import React, { useMemo, useState } from 'react';
import { Users, LayoutPanelTop } from 'lucide-react';

const formatFullNumber = (value) =>
  new Intl.NumberFormat('en-IN').format(Number(value || 0));

const estimateCostPerResult = (value) => {
  const numericValue = Number(value || 0);
  if (!numericValue) return 0;
  return Number((1.1 + (140000 / numericValue) * 0.05).toFixed(2));
};

const metricMultiplierMap = {
  results: 1,
  reach: 1.18,
  impressions: 1.42
};

const buildDemographicMetricData = (data = [], metric = 'results') => {
  const multiplier = metricMultiplierMap[metric] || 1;
  return data.map((row) => ({
    ...row,
    male: Math.round(Number(row.male || 0) * multiplier),
    female: Math.round(Number(row.female || 0) * multiplier)
  }));
};

const buildPlatformData = (data = []) => {
  const totalReach = data.reduce((sum, row) => sum + Number(row.male || 0) + Number(row.female || 0), 0);
  const placements = [
    { placement: 'Facebook', impressionsShare: 0.11, spendShare: 0.12 },
    { placement: 'Instagram', impressionsShare: 0.56, spendShare: 0.69 },
    { placement: 'Threads', impressionsShare: 0.005, spendShare: 0.004 },
    { placement: 'Audience N...', impressionsShare: 0.004, spendShare: 0.006 },
    { placement: 'Messenger', impressionsShare: 0.004, spendShare: 0.004 },
    { placement: 'Oculus', impressionsShare: 0.003, spendShare: 0.002 },
    { placement: 'WhatsApp', impressionsShare: 0.004, spendShare: 0.003 },
    { placement: 'WhatsApp ...', impressionsShare: 0.003, spendShare: 0.002 }
  ];

  return placements.map((item) => ({
    placement: item.placement,
    impressions: Math.round(totalReach * item.impressionsShare * 1.35),
    spend: Number((254.17 * item.spendShare).toFixed(2))
  }));
};

const gridLabels = ['0', '20K', '40K', '60K', '80K'];
const platformRightLabels = ['Rs.0', 'Rs.50', 'Rs.100', 'Rs.150', 'Rs.200', 'Rs.250', 'Rs.300'];

const DemographicsChart = ({ data = [] }) => {
  const [activeView, setActiveView] = useState('demographics');
  const [selectedBreakdown, setSelectedBreakdown] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('results');
  const [hoveredBar, setHoveredBar] = useState(null);

  const demographicData = useMemo(
    () => buildDemographicMetricData(data, selectedMetric),
    [data, selectedMetric]
  );

  const platformData = useMemo(() => buildPlatformData(data), [data]);
  const chartData = activeView === 'platform' ? platformData : demographicData;
  const hasDemographicData = demographicData.some(
    (item) => Number(item?.male || 0) > 0 || Number(item?.female || 0) > 0
  );
  const hasPlatformData = platformData.some(
    (item) => Number(item?.impressions || 0) > 0 || Number(item?.spend || 0) > 0
  );
  const hasChartData = activeView === 'platform' ? hasPlatformData : hasDemographicData;

  const demographicMax = Math.max(
    1,
    ...demographicData.map((item) => Math.max(Number(item.male || 0), Number(item.female || 0)))
  );
  const platformImpressionsMax = Math.max(1, ...platformData.map((item) => Number(item.impressions || 0)));
  const platformSpendMax = Math.max(1, ...platformData.map((item) => Number(item.spend || 0)));

  const maleTotal = demographicData.reduce((sum, row) => sum + Number(row.male || 0), 0);
  const femaleTotal = demographicData.reduce((sum, row) => sum + Number(row.female || 0), 0);
  const total = maleTotal + femaleTotal;
  const malePercentage = total > 0 ? Math.round((maleTotal / total) * 100) : 0;
  const femalePercentage = total > 0 ? Math.round((femaleTotal / total) * 100) : 0;

  const showTooltip = (event, config) => {
    const bounds = event.currentTarget.closest('.custom-chart')?.getBoundingClientRect();
    if (!bounds) return;

    setHoveredBar({
      ...config,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    });
  };

  const hideTooltip = () => setHoveredBar(null);

  return (
    <section className="insights-panel demographics-panel">
      <div className="demographics-topbar">
        <div className="demographics-tabs">
          <button
            type="button"
            className={`demographics-tab ${activeView === 'demographics' ? 'active' : ''}`}
            onClick={() => setActiveView('demographics')}
          >
            <Users size={15} />
            Demographics
          </button>
          <button
            type="button"
            className={`demographics-tab ${activeView === 'platform' ? 'active' : ''}`}
            onClick={() => setActiveView('platform')}
          >
            <LayoutPanelTop size={15} />
            Platform
          </button>
        </div>

        <div className="demographics-controls">
          <select value={selectedBreakdown} onChange={(event) => setSelectedBreakdown(event.target.value)}>
            <option value="all">All</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>
          <select value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
            <option value="results">Results</option>
            <option value="reach">Reach</option>
            <option value="impressions">Impressions</option>
          </select>
        </div>
      </div>

      <div className="demographics-header">
        <h2>{activeView === 'platform' ? 'Placement per platform' : 'Age and gender distribution'}</h2>
      </div>

      {!hasChartData ? (
        <div className="insights-chart-empty">
          No demographic or placement data from Meta for this range/filter yet.
        </div>
      ) : (
      <div className={`custom-chart ${activeView === 'platform' ? 'platform-chart' : 'demographic-chart'}`}>
        <div className="custom-chart-grid">
          {(activeView === 'platform' ? platformRightLabels.slice(0, 5) : gridLabels)
            .slice()
            .reverse()
            .map((label) => (
              <div key={label} className="custom-chart-grid-line">
                <span className="custom-chart-left-label">{label}</span>
                <div className="custom-chart-line" />
              </div>
            ))}
        </div>

        {activeView === 'platform' ? (
          <div className="custom-chart-right-scale">
            {platformRightLabels
              .slice()
              .reverse()
              .map((label) => (
                <span key={label}>{label}</span>
              ))}
          </div>
        ) : null}

        <div className="custom-chart-bars">
          {chartData.map((item) => {
            const label = activeView === 'platform' ? item.placement : item.age;
            const menHeight = `${Math.max(2, (Number(item.male || 0) / demographicMax) * 100)}%`;
            const womenHeight = `${Math.max(2, (Number(item.female || 0) / demographicMax) * 100)}%`;
            const impressionsHeight = `${Math.max(2, (Number(item.impressions || 0) / platformImpressionsMax) * 100)}%`;
            const spendHeight = `${Math.max(2, (Number(item.spend || 0) / platformSpendMax) * 100)}%`;

            return (
              <div key={label} className="custom-chart-group">
                <div className="custom-chart-columns">
                  {activeView === 'platform' ? (
                    <>
                      <div
                        className="custom-bar men"
                        style={{ height: impressionsHeight }}
                        onMouseEnter={(event) =>
                          showTooltip(event, {
                            title: label,
                            color: '#5b3cc4',
                            heading: 'Impressions',
                            value: formatFullNumber(item.impressions),
                            secondary: `Amount spent: Rs.${item.spend}`
                          })
                        }
                        onMouseMove={(event) =>
                          showTooltip(event, {
                            title: label,
                            color: '#5b3cc4',
                            heading: 'Impressions',
                            value: formatFullNumber(item.impressions),
                            secondary: `Amount spent: Rs.${item.spend}`
                          })
                        }
                        onMouseLeave={hideTooltip}
                      />
                      <div
                        className="custom-bar women"
                        style={{ height: spendHeight }}
                        onMouseEnter={(event) =>
                          showTooltip(event, {
                            title: label,
                            color: '#38c2c5',
                            heading: 'Amount spent',
                            value: `Rs.${item.spend}`,
                            secondary: `Impressions: ${formatFullNumber(item.impressions)}`
                          })
                        }
                        onMouseMove={(event) =>
                          showTooltip(event, {
                            title: label,
                            color: '#38c2c5',
                            heading: 'Amount spent',
                            value: `Rs.${item.spend}`,
                            secondary: `Impressions: ${formatFullNumber(item.impressions)}`
                          })
                        }
                        onMouseLeave={hideTooltip}
                      />
                    </>
                  ) : (
                    <>
                      {selectedBreakdown !== 'women' ? (
                        <div
                          className="custom-bar men"
                          style={{ height: menHeight }}
                          onMouseEnter={(event) =>
                            showTooltip(event, {
                              title: label,
                              color: '#5b3cc4',
                              heading: 'Men',
                              value: `${formatFullNumber(item.male)} (${Math.round((Number(item.male || 0) / Math.max(1, Number(item.male || 0) + Number(item.female || 0))) * 100)}%)`,
                              secondary: `Cost per result: Rs.${estimateCostPerResult(item.male)}`
                            })
                          }
                          onMouseMove={(event) =>
                            showTooltip(event, {
                              title: label,
                              color: '#5b3cc4',
                              heading: 'Men',
                              value: `${formatFullNumber(item.male)} (${Math.round((Number(item.male || 0) / Math.max(1, Number(item.male || 0) + Number(item.female || 0))) * 100)}%)`,
                              secondary: `Cost per result: Rs.${estimateCostPerResult(item.male)}`
                            })
                          }
                          onMouseLeave={hideTooltip}
                        />
                      ) : null}
                      {selectedBreakdown !== 'men' ? (
                        <div
                          className="custom-bar women"
                          style={{ height: womenHeight }}
                          onMouseEnter={(event) =>
                            showTooltip(event, {
                              title: label,
                              color: '#38c2c5',
                              heading: 'Women',
                              value: `${formatFullNumber(item.female)} (${Math.round((Number(item.female || 0) / Math.max(1, Number(item.male || 0) + Number(item.female || 0))) * 100)}%)`,
                              secondary: `Cost per result: Rs.${estimateCostPerResult(item.female)}`
                            })
                          }
                          onMouseMove={(event) =>
                            showTooltip(event, {
                              title: label,
                              color: '#38c2c5',
                              heading: 'Women',
                              value: `${formatFullNumber(item.female)} (${Math.round((Number(item.female || 0) / Math.max(1, Number(item.male || 0) + Number(item.female || 0))) * 100)}%)`,
                              secondary: `Cost per result: Rs.${estimateCostPerResult(item.female)}`
                            })
                          }
                          onMouseLeave={hideTooltip}
                        />
                      ) : null}
                    </>
                  )}
                </div>
                <span className="custom-chart-x-label">{label}</span>
              </div>
            );
          })}
        </div>

        {hoveredBar ? (
          <div
            className="custom-chart-tooltip"
            style={{
              left: `${Math.min(hoveredBar.x + 14, activeView === 'platform' ? 720 : 760)}px`,
              top: `${Math.max(hoveredBar.y - 18, 12)}px`
            }}
          >
            <div className="custom-chart-tooltip-title">{hoveredBar.title}</div>
            <div className="custom-chart-tooltip-row">
              <span className="custom-chart-tooltip-bullet" style={{ backgroundColor: hoveredBar.color }} />
              <div className="custom-chart-tooltip-copy">
                <strong>{hoveredBar.heading}</strong>
                <span>{hoveredBar.value}</span>
                <small>{hoveredBar.secondary}</small>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      )}

      {activeView === 'platform' ? (
        <>
          <div className="platform-summary-legend">
            <div className="platform-summary-item">
              <span className="demographics-summary-color men" />
              <span>Impressions</span>
            </div>
            <div className="platform-summary-item">
              <span className="demographics-summary-color women" />
              <span>Amount spent</span>
            </div>
          </div>
          <p className="platform-footnote">
            You may see low delivery on some placements until additional Meta inventory opens up. Cost-per-result is typically the most reliable comparison metric.
          </p>
        </>
      ) : (
        <div className="demographics-summary-legend">
          {selectedBreakdown !== 'women' ? (
            <div className="demographics-summary-item">
              <span className="demographics-summary-color men" />
              <div>
                <strong>Men</strong>
                <span>{malePercentage}% ({formatFullNumber(maleTotal)})</span>
                <small>Cost per result: Rs.{estimateCostPerResult(maleTotal)}</small>
              </div>
            </div>
          ) : null}

          {selectedBreakdown !== 'men' ? (
            <div className="demographics-summary-item">
              <span className="demographics-summary-color women" />
              <div>
                <strong>Women</strong>
                <span>{femalePercentage}% ({formatFullNumber(femaleTotal)})</span>
                <small>Cost per result: Rs.{estimateCostPerResult(femaleTotal)}</small>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default DemographicsChart;
