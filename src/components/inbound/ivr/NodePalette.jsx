import React from 'react';
import { Plus } from 'lucide-react';

const NODE_TYPES = [
    { type: 'input', label: 'User Input', icon: '⌨️', description: 'Collect keypad press' },
    { type: 'condition', label: 'Condition', icon: '🔀', description: 'Logic & Branching' },
    { type: 'run_api', label: 'API Call', icon: '⚡', description: 'External HTTP Request' },
    { type: 'set_variable', label: 'Set Variable', icon: '💾', description: 'Store data in context' },
    { type: 'queue', label: 'Queue', icon: '👥', description: 'Enqueue Call' },
    { type: 'transfer', label: 'Transfer', icon: '📞', description: 'Transfer to number' },
    { type: 'voicemail', label: 'Voicemail', icon: '📬', description: 'Record message' },
    { type: 'sms', label: 'Send SMS', icon: '💬', description: 'Send text message' },
    { type: 'ai_assistant', label: 'AI Assistant', icon: '🤖', description: 'Streaming AI Agent' },
    { type: 'repeat', label: 'Repeat', icon: '🔄', description: 'Repeat menu' },
    { type: 'end', label: 'End', icon: '🔚', description: 'Hang up call' }
];

const NodePalette = ({ industry, onNodeAdd }) => {
    return (
        <div className="node-palette-sidebar">
            <div className="palette-header">
                <h4>Node Palette</h4>
                <span className="industry-label">{industry} Industry</span>
            </div>
            <div className="palette-list">
                {NODE_TYPES.map((node) => (
                    <div
                        key={node.type}
                        className="palette-item"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('nodeType', node.type)}
                        onClick={() => onNodeAdd(node.type, { x: 50, y: 50 })}
                    >
                        <div className="palette-icon">{node.icon}</div>
                        <div className="palette-info">
                            <span className="node-label">{node.label}</span>
                            <span className="node-desc">{node.description}</span>
                        </div>
                        <Plus size={16} className="add-icon" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NodePalette;
