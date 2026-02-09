import React from 'react';
import { Play, CheckCircle, AlertCircle } from 'lucide-react';

const TestPanel = ({ onTest, isTesting, testResults }) => {
    return (
        <div className="test-panel">
            <div className="panel-header">
                <h4>Workflow Simulation</h4>
                <button
                    className={`btn ${isTesting ? 'btn-secondary' : 'btn-success'}`}
                    onClick={onTest}
                    disabled={isTesting}
                >
                    <Play size={16} />
                    {isTesting ? 'Simulating...' : 'Run Test'}
                </button>
            </div>

            <div className="test-results">
                {testResults.length === 0 ? (
                    <div className="empty-results">
                        <p>Start a simulation to see the call flow step-by-step.</p>
                    </div>
                ) : (
                    <div className="results-list">
                        {testResults.map((result, index) => (
                            <div key={index} className={`result-item ${result.status}`}>
                                {result.status === 'completed' ? (
                                    <CheckCircle size={14} className="status-icon success" />
                                ) : result.status === 'error' ? (
                                    <AlertCircle size={14} className="status-icon error" />
                                ) : (
                                    <div className="status-spinner" />
                                )}
                                <div className="result-info">
                                    <span className="node-name">{result.nodeType} node</span>
                                    <span className="node-status">{result.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestPanel;
