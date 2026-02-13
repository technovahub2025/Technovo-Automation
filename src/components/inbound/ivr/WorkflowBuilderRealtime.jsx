import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useIVRWorkflowSocket from '../../../hooks/useIVRWorkflowSocket';
import useSocket from '../../../hooks/useSocket';
import WorkflowCanvas from './WorkflowCanvas';
import NodePalette from './NodePalette';
import TestPanel from './TestPanel';
import PropertyPanel from './PropertyPanel';
import './WorkflowBuilderRealtime.css';

const WorkflowBuilderRealtime = ({ workflowId, initialData, industry, onSave }) => {
    const [nodes, setNodes] = useState(initialData?.nodes || []);
    const [edges, setEdges] = useState(initialData?.edges || []);
    const [activeUsers, setActiveUsers] = useState([]);
    const [testResults, setTestResults] = useState([]);
    const [isTesting, setIsTesting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [connectingFrom, setConnectingFrom] = useState(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);

    // Undo/Redo states
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);

    const {
        addNode: emitAddNode,
        moveNode: emitMoveNode,
        connectNodes: emitConnectNodes,
        deleteNode: emitDeleteNode,
        startTest,
        connected
    } = useIVRWorkflowSocket(workflowId);

    const { socket } = useSocket();

    const showNotification = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    const selectedNode = useMemo(() =>
        nodes.find(n => n.id === selectedNodeId),
        [nodes, selectedNodeId]);

    // Push to history before a state change
    const saveToHistory = useCallback(() => {
        setHistory(prev => [...prev, { nodes: [...nodes], edges: [...edges] }]);
        setFuture([]);
    }, [nodes, edges]);

    // Real-time synchronization
    useEffect(() => {
        if (!socket) return;

        socket.on('workflow_node_added', (data) => {
            if (data.workflowId === workflowId) {
                setNodes(prev => [...prev, data.node]);
                if (data.addedBy !== socket.id) showNotification('Node added by another user');
            }
        });

        socket.on('workflow_node_updated', (data) => {
            if (data.workflowId === workflowId) {
                setNodes(prev => prev.map(n => n.id === data.nodeId ? { 
                    ...n, 
                    data: data.data,
                    audioUrl: data.audioUrl,
                    audioAssetId: data.audioAssetId
                } : n));
                if (data.updatedBy !== socket.id) {
                    showNotification('Node property updated');
                }
            }
        });

        socket.on('workflow_node_moved', (data) => {
            if (data.workflowId === workflowId) {
                setNodes(prev => prev.map(node =>
                    node.id === data.nodeId ? { ...node, position: data.position } : node
                ));
            }
        });

        socket.on('workflow_node_deleted', (data) => {
            if (data.workflowId === workflowId) {
                setNodes(prev => prev.filter(node => node.id !== data.nodeId));
                setEdges(prev => prev.filter(edge => edge.source !== data.nodeId && edge.target !== data.nodeId));
                if (data.deletedBy !== socket.id) showNotification('Node deleted by another user');
                if (selectedNodeId === data.nodeId) setSelectedNodeId(null);
            }
        });

        socket.on('workflow_edge_connected', (data) => {
            if (data.workflowId === workflowId) {
                setEdges(prev => [...prev, data.edge]);
            }
        });

        socket.on('workflow_user_joined', (data) => {
            if (data.userId !== socket.id) {
                setActiveUsers(prev => [...new Set([...prev, data.userId])]);
                showNotification('Another user joined');
            }
        });

        socket.on('workflow_user_left', (data) => {
            setActiveUsers(prev => prev.filter(id => id !== data.userId));
        });

        socket.on('workflow_test_node', (data) => {
            if (data.workflowId === workflowId) setTestResults(prev => [...prev, data]);
        });

        return () => {
            socket.off('workflow_node_added');
            socket.off('workflow_node_updated');
            socket.off('workflow_node_moved');
            socket.off('workflow_node_deleted');
            socket.off('workflow_edge_connected');
            socket.off('workflow_user_joined');
            socket.off('workflow_user_left');
            socket.off('workflow_test_node');
        };
    }, [workflowId, socket, selectedNodeId]);

    const handleNodeAdd = useCallback((nodeType, position) => {
        saveToHistory();
        const newNode = {
            id: `node_${Date.now()}`,
            type: nodeType,
            position,
            data: getDefaultNodeData(nodeType, industry)
        };
        emitAddNode(newNode, position);
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    }, [emitAddNode, industry, saveToHistory]);

    const handleNodeMove = useCallback((nodeId, newPosition) => {
        if (nodeId === 'new') return;
        emitMoveNode(nodeId, newPosition);
        setNodes(prev => prev.map(node =>
            node.id === nodeId ? { ...node, position: newPosition } : node
        ));
    }, [emitMoveNode]);

    const handleNodeUpdate = useCallback((nodeId, newData) => {
        saveToHistory();
        // Only emit socket event, don't update local state immediately
        // Let the socket response handle the state update to avoid conflicts
        socket.emit('workflow_node_update', { workflowId, nodeId, data: newData });
    }, [workflowId, socket, saveToHistory]);

    const handleNodeDelete = useCallback((nodeId) => {
        saveToHistory();
        emitDeleteNode(nodeId);
        setNodes(prev => prev.filter(node => node.id !== nodeId));
        setEdges(prev => prev.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
        setSelectedNodeId(null);
    }, [emitDeleteNode, saveToHistory]);

    const handleConnect = useCallback((params) => {
        if (!connectingFrom) {
            setConnectingFrom(params.source);
            showNotification('Click another node to connect');
        } else {
            const source = connectingFrom;
            const target = params.source;
            if (source === target) {
                setConnectingFrom(null);
                return;
            }

            saveToHistory();
            const newEdge = {
                id: `edge_${Date.now()}`,
                source,
                target,
                sourceHandle: 'out',
                targetHandle: 'in'
            };

            emitConnectNodes(source, target, 'out', 'in');
            setEdges(prev => [...prev, newEdge]);
            setConnectingFrom(null);
        }
    }, [connectingFrom, emitConnectNodes, saveToHistory]);

    const undo = useCallback(() => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setFuture(prev => [{ nodes: [...nodes], edges: [...edges] }, ...prev]);
        setNodes(previous.nodes);
        setEdges(previous.edges);
        setHistory(prev => prev.slice(0, -1));
        showNotification('Action undone');
    }, [history, nodes, edges]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        const next = future[0];
        setHistory(prev => [...prev, { nodes: [...nodes], edges: [...edges] }]);
        setNodes(next.nodes);
        setEdges(next.edges);
        setFuture(prev => prev.slice(1));
        showNotification('Action redone');
    }, [future, nodes, edges]);

    const handleTest = useCallback(() => {
        setIsTesting(true);
        setTestResults([]);
        startTest({ industry, nodes, edges });
    }, [startTest, industry, nodes, edges]);

    return (
        <div className="workflow-builder-realtime">
            {notification && <div className="workflow-notification">{notification}</div>}

            <div className="builder-toolbar">
                <div className="toolbar-left">
                    <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
                        {connected ? '🟢' : '🔴'} {connected ? 'Live Sync' : 'Offline'}
                    </span>
                    <div className="undo-redo-btns">
                        <button className="tb-btn" onClick={undo} disabled={history.length === 0} title="Undo">↩️</button>
                        <button className="tb-btn" onClick={redo} disabled={future.length === 0} title="Redo">↪️</button>
                    </div>
                </div>

                <div className="toolbar-center">
                    <h3>{initialData?.name || 'New IVR Workflow'}</h3>
                </div>

                <div className="toolbar-right">
                    {activeUsers.length > 0 && (
                        <span className="collab-badge">👥 {activeUsers.length + 1} Editors</span>
                    )}
                    <button className="btn btn-primary" onClick={() => onSave?.({ nodes, edges })}>
                        Save Workflow
                    </button>
                </div>
            </div>

            <div className="builder-layout">
                <NodePalette industry={industry} onNodeAdd={handleNodeAdd} />

                <div className="builder-main">
                    <WorkflowCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodeMove={handleNodeMove}
                        onConnect={handleConnect}
                        onNodeDelete={handleNodeDelete}
                        onNodeSelect={(id) => setSelectedNodeId(id)}
                        industry={industry}
                    />
                </div>

                {selectedNode ? (
                    <PropertyPanel
                        selectedNode={selectedNode}
                        onUpdate={handleNodeUpdate}
                        onDelete={handleNodeDelete}
                        onClose={() => setSelectedNodeId(null)}
                    />
                ) : (
                    <div className="builder-sidebar">
                        <TestPanel onTest={handleTest} isTesting={isTesting} testResults={testResults} />
                    </div>
                )}
            </div>
        </div>
    );
};

function getDefaultNodeData(nodeType, industry) {
    const templates = {
        audio: { label: 'Audio Message', mode: 'tts', messageText: `Welcome to our ${industry} service`, voice: 'en-GB-SoniaNeural', language: 'en-GB', afterPlayback: 'next' },
        input: { label: 'Keypad Input', text: 'Please enter an option.', numDigits: 1, timeout: 10 },
        transfer: { label: 'Transfer', text: 'Connecting you now.', destination: '' },
        voicemail: { label: 'Voicemail', text: 'Please leave a message.' },

        // New Node Types
        condition: { label: 'Condition', variable: 'input', operator: 'equals', value: '1' },
        run_api: { label: 'API Call', url: 'https://api.example.com', method: 'GET', outputVariable: 'apiResult' },
        set_variable: { label: 'Set Variable', variable: 'customVar', value: 'value' },
        queue: { label: 'Queue', queueName: 'General', text: 'Please hold while we connect you to an agent.' },
        sms: { label: 'Send SMS', message: 'Hello from IVR', to: '{{callerNumber}}' },
        ai_assistant: { label: 'AI Assistant', streamUrl: '', initialMessage: 'How can I help you today?' },

        // Industry Services
        booking_service: { label: 'Booking', service: 'booking', industry: 'hotel', api_endpoint: '/api/hotel/booking' },
        claims_service: { label: 'Claims', service: 'claims', industry: 'insurance', api_endpoint: '/api/insurance/claims' },

        end: { label: 'Hang up', text: 'Thank you for calling. Goodbye.' }
    };
    return templates[nodeType] || { label: nodeType };
}

export default WorkflowBuilderRealtime;
