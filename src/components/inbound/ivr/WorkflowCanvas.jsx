import React, { useCallback, useMemo, useRef } from 'react';
import { Trash2, Link } from 'lucide-react';

const WorkflowCanvas = ({
    nodes,
    edges,
    onNodeMove,
    onConnect,
    onNodeDelete,
    onNodeSelect,
    industry
}) => {
    const canvasRef = useRef(null);

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        const nodeType = event.dataTransfer.getData('nodeType');
        if (!nodeType) return;

        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const position = {
            x: event.clientX - (canvasRect?.left || 0),
            y: event.clientY - (canvasRect?.top || 0)
        };

        onNodeMove?.('new', position, nodeType);
    }, [onNodeMove]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
    }, []);

    const edgeLines = useMemo(() => {
        return edges.map((edge) => {
            const sourceNode = nodes.find((node) => node.id === edge.source);
            const targetNode = nodes.find((node) => node.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            return {
                id: edge.id,
                x1: sourceNode.position.x + 80,
                y1: sourceNode.position.y + 30,
                x2: targetNode.position.x + 80,
                y2: targetNode.position.y + 30
            };
        }).filter(Boolean);
    }, [edges, nodes]);

    return (
        <div
            ref={canvasRef}
            className="workflow-canvas-pure"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <svg className="workflow-edges">
                {edgeLines.map((line) => (
                    <line
                        key={line.id}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke="#94a3b8"
                        strokeWidth="2"
                    />
                ))}
            </svg>

            {nodes.map((node) => (
                <div
                    key={node.id}
                    className="workflow-node"
                    style={{ left: node.position.x, top: node.position.y }}
                    draggable
                    onClick={() => onNodeSelect?.(node.id)}
                    onDragEnd={(event) => {
                        const canvasRect = canvasRef.current?.getBoundingClientRect();
                        const position = {
                            x: event.clientX - (canvasRect?.left || 0),
                            y: event.clientY - (canvasRect?.top || 0)
                        };
                        onNodeMove(node.id, position);
                    }}
                >
                    <div className="node-header">
                        <span className="node-type-badge">{node.type}</span>
                        <button
                            className="delete-node-btn"
                            onClick={() => onNodeDelete(node.id)}
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div className="node-content">
                        {node.data?.label || node.data?.text || 'Node Config'}
                    </div>
                    <div className="node-ports">
                        <button className="port-btn out" onClick={() => onConnect({ source: node.id })}>
                            <Link size={12} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default WorkflowCanvas;
