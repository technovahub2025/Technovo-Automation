import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Link,
  Settings,
  MessageSquare,
  Phone,
  PhoneCall,
  Voicemail,
  RotateCcw,
  X,
  GitBranch,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Minimize2,
  Maximize2,
  ScanEye,
  Undo2,
  Redo2
} from 'lucide-react';
import apiService from "../../../services/api";
import NodeConfigPanel from './NodeConfigPanel';
import './WorkflowBuilderCanvas.css';

const NODE_TYPES = [
  { type: 'greeting', label: 'Greeting/Menu', icon: MessageSquare, color: '#2563eb' },
  { type: 'input', label: 'User Input', icon: Phone, color: '#10b981' },
  { type: 'conditional', label: 'Conditional', icon: GitBranch, color: '#ec4899' },
  { type: 'transfer', label: 'Transfer', icon: PhoneCall, color: '#f59e0b' },
  { type: 'voicemail', label: 'Voicemail', icon: Voicemail, color: '#8b5cf6' },
  { type: 'repeat', label: 'Repeat', icon: RotateCcw, color: '#6b7280' },
  { type: 'end', label: 'End', icon: X, color: '#ef4444' }
];

const GRID_SIZE = 20;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 110;
const MAX_HISTORY = 50;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;

const createNodeData = (type) => {
  const timestamp = Date.now();
  switch (type) {
    case 'greeting':
      return { 
        text: 'Welcome to our IVR. Please choose an option.',
        promptKey: `greeting_${timestamp}`
      };
    case 'input':
      return { 
        digit: '1', 
        label: 'Customer Support', 
        action: 'transfer',
        promptKey: `input_${timestamp}`
      };
    case 'transfer':
      return { 
        destination: '+1234567890', 
        department: 'support',
        promptKey: `transfer_${timestamp}`
      };
    case 'voicemail':
      return { 
        mailbox: 'general', 
        transcription: true,
        promptKey: `voicemail_${timestamp}`
      };
    case 'repeat':
      return { 
        max_repeats: 3,
        promptKey: `repeat_${timestamp}`
      };
    case 'end':
      return { 
        message: 'Thank you for calling. Goodbye.',
        promptKey: `end_${timestamp}`
      };
    case 'conditional':
      return { 
        condition: 'business_hours',
        promptKey: `conditional_${timestamp}`
      };
    default:
      return { 
        promptKey: `${type}_${timestamp}`
      };
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const WorkflowBuilderCanvas = ({
  workflow,
  workflowId,
  onChange,
  onNodeAdded,
  onNodeMoved,
  onEdgeConnected,
  onNodeRemoved,
  onEdgeRemoved,
  onEdgeReattached,
  availableVoices,
  activeNodeId,
  activeEdgeIds = [],
  onValidationChange
}) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [configNode, setConfigNode] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [edgeMenu, setEdgeMenu] = useState(null);
  const [reconnectEdgeId, setReconnectEdgeId] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const canvasRef = useRef(null);
  const dragStateRef = useRef(null);
  const lastWorkflowRef = useRef(workflow);

  const nodes = workflow?.nodes || [];
  const edges = workflow?.edges || [];

  // Memoize workflow and nodes/edges to prevent infinite loops
  const stableWorkflow = useMemo(() => workflow, [JSON.stringify(workflow)]);
  const stableNodes = useMemo(() => nodes, [JSON.stringify(nodes)]);
  const stableEdges = useMemo(() => edges, [JSON.stringify(edges)]);

  useEffect(() => {
    lastWorkflowRef.current = stableWorkflow;
  }, [stableWorkflow]);

  const applyWorkflowUpdate = useCallback((nextWorkflow, { recordHistory = true } = {}) => {
    if (recordHistory) {
      setHistory(prev => [...prev, lastWorkflowRef.current].slice(-MAX_HISTORY));
      setFuture([]);
    }

    // Save to backend with audio generation
    const saveWorkflow = async () => {
      try {
        const workflowIdToUse = workflowId || workflow._id || workflow.id;
        if (!workflowIdToUse) {
          console.error('No workflow ID found:', workflow);
          return;
        }
        
        const response = await apiService.put(`/api/workflow/${workflowIdToUse}`, {
          nodes: nextWorkflow.nodes,
          edges: nextWorkflow.edges
        });
        
        if (response.data.success) {
          // Update local state with backend response
          onChange(response.data.data);
        }
      } catch (error) {
        console.error('Failed to save workflow:', error);
      }
    };

    // Debounced save
    const timeoutId = setTimeout(saveWorkflow, 1000);
    return () => clearTimeout(timeoutId);
  }, [workflowId, stableWorkflow, onChange]);

  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture(next => [lastWorkflowRef.current, ...next].slice(0, MAX_HISTORY));
      lastWorkflowRef.current = previous;
      onChange(previous);
      return prev.slice(0, -1);
    });
  }, [onChange]);

  const handleRedo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const nextWorkflow = prev[0];
      setHistory(hist => [...hist, lastWorkflowRef.current].slice(-MAX_HISTORY));
      lastWorkflowRef.current = nextWorkflow;
      onChange(nextWorkflow);
      return prev.slice(1);
    });
  }, [onChange]);

  const toCanvasPoint = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [pan.x, pan.y, zoom]);

  const snapPoint = useCallback((point) => {
    if (!snapEnabled) return point;
    return {
      x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(point.y / GRID_SIZE) * GRID_SIZE
    };
  }, [snapEnabled]);

  const resolveCollision = useCallback((position, ignoreId = null) => {
    let candidate = { ...position };
    let hasCollision = true;
    let safety = 0;
    while (hasCollision && safety < 50) {
      hasCollision = nodes.some(node => {
        if (ignoreId && node.id === ignoreId) return false;
        const overlapX = Math.abs(node.position.x - candidate.x) < NODE_WIDTH - 20;
        const overlapY = Math.abs(node.position.y - candidate.y) < NODE_HEIGHT - 20;
        return overlapX && overlapY;
      });
      if (hasCollision) {
        candidate = { x: candidate.x, y: candidate.y + GRID_SIZE * 2 };
      }
      safety += 1;
    }
    return candidate;
  }, [nodes]);

  const computeValidation = useCallback(() => {
    const errors = [];
    if (nodes.length === 0) {
      errors.push({ code: 'NO_NODES', message: 'Add at least one node.' });
      return errors;
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    const incoming = new Map(nodes.map(n => [n.id, 0]));
    edges.forEach(edge => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        errors.push({ code: 'BROKEN_EDGE', message: 'Broken connection detected.', edgeId: edge.id });
      } else {
        incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
      }
    });

    const startNode = nodes.find(n => incoming.get(n.id) === 0) || nodes[0];
    nodes.forEach(node => {
      if (node.id !== startNode.id && incoming.get(node.id) === 0) {
        errors.push({ code: 'ORPHAN_NODE', message: 'Orphaned node detected.', nodeId: node.id });
      }
    });

    const adjacency = new Map(nodes.map(n => [n.id, []]));
    edges.forEach(edge => {
      if (adjacency.has(edge.source)) adjacency.get(edge.source).push(edge.target);
    });

    const reachable = new Set();
    const stack = [startNode.id];
    while (stack.length) {
      const current = stack.pop();
      if (reachable.has(current)) continue;
      reachable.add(current);
      (adjacency.get(current) || []).forEach(next => stack.push(next));
    }

    nodes.forEach(node => {
      if (!reachable.has(node.id)) {
        errors.push({ code: 'UNREACHABLE_NODE', message: 'Unreachable node detected.', nodeId: node.id });
      }
    });

    const endNodes = nodes.filter(n => n.type === 'end');
    if (endNodes.length === 0) {
      errors.push({ code: 'NO_END', message: 'Add at least one end node.' });
    } else if (!endNodes.some(n => reachable.has(n.id))) {
      errors.push({ code: 'UNREACHABLE_END', message: 'No reachable end node.' });
    }

    return errors;
  }, [stableNodes, stableEdges]);

  const validationErrors = useMemo(() => computeValidation(), [computeValidation]);

  useEffect(() => {
    onValidationChange?.(validationErrors);
  }, [onValidationChange, validationErrors]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('nodeType');
    if (!nodeType) return;

    const position = resolveCollision(snapPoint(toCanvasPoint(event.clientX, event.clientY)));
    const newNode = {
      id: `node_${Date.now()}`,
      type: nodeType,
      position,
      data: createNodeData(nodeType)
    };

    applyWorkflowUpdate({
      ...workflow,
      nodes: [...nodes, newNode]
    });

    onNodeAdded?.(newNode, position);
  }, [applyWorkflowUpdate, nodes, onNodeAdded, snapPoint, toCanvasPoint, workflow]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handleNodeMouseDown = useCallback((event, nodeId) => {
    event.stopPropagation();
    const { x, y } = toCanvasPoint(event.clientX, event.clientY);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragStateRef.current = {
      nodeId,
      offsetX: x - node.position.x,
      offsetY: y - node.position.y,
      recorded: false,
      snapshot: lastWorkflowRef.current
    };
  }, [nodes, toCanvasPoint]);

  const handleMouseMove = useCallback((event) => {
    if (dragStateRef.current) {
      const { nodeId, offsetX, offsetY } = dragStateRef.current;
      const point = toCanvasPoint(event.clientX, event.clientY);
      const newPosition = resolveCollision(
        snapPoint({ x: point.x - offsetX, y: point.y - offsetY }),
        nodeId
      );
      if (!dragStateRef.current.recorded) {
        setHistory(prev => [...prev, dragStateRef.current.snapshot].slice(-MAX_HISTORY));
        dragStateRef.current.recorded = true;
        setFuture([]);
      }
      const updatedNodes = nodes.map(node => node.id === nodeId ? { ...node, position: newPosition } : node);
      const updatedWorkflow = { ...workflow, nodes: updatedNodes };
      lastWorkflowRef.current = updatedWorkflow;
      onChange(updatedWorkflow);
      onNodeMoved?.(nodeId, newPosition);
      return;
    }

    if (isPanning) {
      setPan(prev => ({
        x: prev.x + event.movementX,
        y: prev.y + event.movementY
      }));
    }
  }, [isPanning, nodes, onNodeMoved, snapPoint, toCanvasPoint, workflow, onChange]);

  const handleMouseUp = useCallback(() => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
    }
    setIsPanning(false);
  }, []);

  const handleNodeRemove = useCallback((nodeId) => {
    const updatedNodes = nodes.filter((node) => node.id !== nodeId);
    const updatedEdges = edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    );

    applyWorkflowUpdate({
      ...workflow,
      nodes: updatedNodes,
      edges: updatedEdges
    });

    onNodeRemoved?.(nodeId);
  }, [nodes, edges, workflow, applyWorkflowUpdate, onNodeRemoved]);

  const handleEdgeRemove = useCallback((edgeId) => {
    const updatedEdges = edges.filter(edge => edge.id !== edgeId);
    applyWorkflowUpdate({ ...workflow, edges: updatedEdges });
    onEdgeRemoved?.(edgeId);
  }, [applyWorkflowUpdate, edges, onEdgeRemoved, workflow]);

  const handleConnectStart = useCallback((nodeId) => {
    setConnectingFrom(nodeId);
  }, []);

  const handleNodeConfig = useCallback((nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setConfigNode(node);
      setConfigPanelOpen(true);
    }
  }, [nodes]);

  const handleNodeConfigSave = useCallback((nodeId, config) => {
    const updatedNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...config } } : n
    );

    applyWorkflowUpdate({
      ...workflow,
      nodes: updatedNodes
    });

    setConfigPanelOpen(false);
    setConfigNode(null);
  }, [nodes, workflow, applyWorkflowUpdate]);

  const handleNodeConfigAutoSave = useCallback((nodeId, config) => {
    const updatedNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...config } } : n
    );

    applyWorkflowUpdate({
      ...workflow,
      nodes: updatedNodes
    }, { recordHistory: false });
  }, [nodes, workflow, applyWorkflowUpdate]);

  const handleNodeConfigClose = useCallback(() => {
    setConfigPanelOpen(false);
    setConfigNode(null);
  }, []);

  const resolveEdgeLabel = useCallback((edge) => {
    if (edge.label) return edge.label;
    if (edge.sourceHandle) return String(edge.sourceHandle);
    return '';
  }, []);

  const handleConnectFinish = useCallback((nodeId) => {
    if (!connectingFrom || connectingFrom === nodeId) {
      setConnectingFrom(null);
      return;
    }

    const sourceNode = nodes.find(n => n.id === connectingFrom);
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!sourceNode || !targetNode) return;

    let sourceHandle = null;
    if (sourceNode.type === 'input' && sourceNode.data?.digit) {
      sourceHandle = sourceNode.data.digit;
    }
    if (sourceNode.type === 'conditional') {
      const existing = edges.filter(edge => edge.source === sourceNode.id).map(edge => edge.sourceHandle);
      sourceHandle = existing.includes('true') && !existing.includes('false') ? 'false' : 'true';
    }

    const newEdge = {
      id: `edge_${Date.now()}`,
      source: connectingFrom,
      target: nodeId,
      sourceHandle,
      targetHandle: null
    };

    applyWorkflowUpdate({
      ...workflow,
      edges: [...edges, newEdge]
    });

    onEdgeConnected?.(newEdge);
    setConnectingFrom(null);
  }, [connectingFrom, nodes, applyWorkflowUpdate, workflow, edges, onEdgeConnected]);

  const handleReconnectFinish = useCallback((nodeId) => {
    if (!reconnectEdgeId) return;
    const edge = edges.find(e => e.id === reconnectEdgeId);
    if (!edge) return;

    const updatedEdges = edges.map(e => e.id === reconnectEdgeId ? { ...e, target: nodeId } : e);
    applyWorkflowUpdate({ ...workflow, edges: updatedEdges });
    onEdgeReattached?.(reconnectEdgeId, { target: nodeId });
    setReconnectEdgeId(null);
    setEdgeMenu(null);
    setSelectedEdge(null);
  }, [applyWorkflowUpdate, edges, onEdgeReattached, reconnectEdgeId, workflow]);

  const edgeLines = useMemo(() => {
    return edges.map((edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.source);
      const targetNode = nodes.find((node) => node.id === edge.target);
      if (!sourceNode || !targetNode) return null;

      const x1 = sourceNode.position.x + NODE_WIDTH;
      const y1 = sourceNode.position.y + NODE_HEIGHT / 2;
      const x2 = targetNode.position.x;
      const y2 = targetNode.position.y + NODE_HEIGHT / 2;
      const midX = (x1 + x2) / 2;

      const arrowSize = 8;
      const arrowOffset = arrowSize * 1.5;
      
      // Calculate the end point for the line (before arrow)
      const lineEndX = x2 - arrowOffset;
      const lineEndY = y2;
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: resolveEdgeLabel(edge),
        color: edge.sourceHandle === 'true' ? '#16a34a'
          : edge.sourceHandle === 'false' ? '#dc2626'
            : edge.sourceHandle === 'timeout' ? '#f59e0b'
              : edge.sourceHandle === 'no_match' ? '#64748b'
                : '#94a3b8',
        path: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${lineEndX} ${lineEndY}`,
        arrowPath: `M ${lineEndX} ${lineEndY} L ${x2} ${y2} M ${x2 - arrowSize} ${y2 - arrowSize/2} L ${x2} ${y2} L ${x2 - arrowSize} ${y2 + arrowSize/2}`,
        center: { x: midX, y: (y1 + y2) / 2 }
      };
    }).filter(Boolean);
  }, [edges, nodes, resolveEdgeLabel]);

  const handleEdgeClick = useCallback((edge, event) => {
    event.stopPropagation();
    setSelectedEdge(edge.id);
    setSelectedNode(null);
    setEdgeMenu({
      edgeId: edge.id,
      x: edge.center.x,
      y: edge.center.y
    });
  }, []);

  const applyAutoLayout = useCallback((direction = 'LR') => {
    if (!nodes.length) return;

    const spacingX = 280;
    const spacingY = 180;

    // Build graph
    const incoming = new Map(nodes.map(n => [n.id, 0]));
    const outgoing = new Map(nodes.map(n => [n.id, []]));

    edges.forEach(e => {
      incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
      outgoing.get(e.source)?.push(e.target);
    });

    // Multiple root nodes supported
    const roots = nodes.filter(n => incoming.get(n.id) === 0);
    const visited = new Set();
    const levels = new Map();

    const queue = roots.map((n, i) => ({ id: n.id, level: 0 }));

    while (queue.length) {
      const { id, level } = queue.shift();
      if (visited.has(id)) continue;

      visited.add(id);
      levels.set(id, level);

      outgoing.get(id)?.forEach(target => {
        queue.push({ id: target, level: level + 1 });
      });
    }

    // Group by level
    const levelMap = new Map();
    nodes.forEach(n => {
      const level = levels.get(n.id) ?? 0;
      if (!levelMap.has(level)) levelMap.set(level, []);
      levelMap.get(level).push(n.id);
    });

    // Position nodes
    const updatedNodes = nodes.map(node => {
      const level = levels.get(node.id) ?? 0;
      const siblings = levelMap.get(level) || [];
      const index = siblings.indexOf(node.id);

      const x =
        direction === 'LR'
          ? level * spacingX
          : index * spacingX;

      const y =
        direction === 'LR'
          ? index * spacingY
          : level * spacingY;

      return {
        ...node,
        position: snapPoint({ x, y })
      };
    });

    applyWorkflowUpdate({
      ...workflow,
      nodes: updatedNodes
    });
  }, [nodes, edges, workflow, snapPoint, applyWorkflowUpdate]);


  const insertNodeBetween = useCallback((edgeId, nodeType) => {
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const mid = {
      x: (sourceNode.position.x + targetNode.position.x) / 2,
      y: (sourceNode.position.y + targetNode.position.y) / 2
    };

    const newNode = {
      id: `node_${Date.now()}`,
      type: nodeType,
      position: snapPoint(mid),
      data: createNodeData(nodeType)
    };

    const firstEdge = {
      id: `edge_${Date.now()}_a`,
      source: edge.source,
      target: newNode.id,
      sourceHandle: edge.sourceHandle,
      targetHandle: null,
      label: edge.label
    };

    const secondEdge = {
      id: `edge_${Date.now()}_b`,
      source: newNode.id,
      target: edge.target,
      sourceHandle: null,
      targetHandle: edge.targetHandle
    };

    applyWorkflowUpdate({
      ...workflow,
      nodes: [...nodes, newNode],
      edges: [...edges.filter(e => e.id !== edgeId), firstEdge, secondEdge]
    });

    onNodeAdded?.(newNode, newNode.position);
    onEdgeConnected?.(firstEdge);
    onEdgeConnected?.(secondEdge);
    onEdgeRemoved?.(edgeId);
    applyAutoLayout('LR');
    setEdgeMenu(null);
    setSelectedEdge(null);
  }, [applyWorkflowUpdate, edges, nodes, onEdgeConnected, onEdgeRemoved, onNodeAdded, snapPoint, workflow, applyAutoLayout]);

  const fitToScreen = useCallback(() => {
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map(n => n.position.x));
    const maxX = Math.max(...nodes.map(n => n.position.x + NODE_WIDTH));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxY = Math.max(...nodes.map(n => n.position.y + NODE_HEIGHT));

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const width = maxX - minX + 80;
    const height = maxY - minY + 80;
    const scaleX = canvasRect.width / width;
    const scaleY = canvasRect.height / height;
    const nextZoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM);

    setZoom(nextZoom);
    setPan({
      x: canvasRect.width / 2 - ((minX + maxX) / 2) * nextZoom,
      y: canvasRect.height / 2 - ((minY + maxY) / 2) * nextZoom
    });
  }, [nodes]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      setZoom(prev => clamp(prev + delta, MIN_ZOOM, MAX_ZOOM));
      return;
    }
    setPan(prev => ({
      x: prev.x - event.deltaX,
      y: prev.y - event.deltaY
    }));
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (event.key.toLowerCase() === '=') {
        event.preventDefault();
        setZoom(prev => clamp(prev + 0.1, MIN_ZOOM, MAX_ZOOM));
      }
      if (event.key.toLowerCase() === '-') {
        event.preventDefault();
        setZoom(prev => clamp(prev - 0.1, MIN_ZOOM, MAX_ZOOM));
      }
      if (event.key.toLowerCase() === '0') {
        event.preventDefault();
        resetView();
      }
    }

    if (event.key.toLowerCase() === 'f') {
      fitToScreen();
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedEdge) {
        handleEdgeRemove(selectedEdge);
        setSelectedEdge(null);
        setEdgeMenu(null);
      } else if (selectedNode) {
        handleNodeRemove(selectedNode);
        setSelectedNode(null);
      }
    }
  }, [fitToScreen, handleEdgeRemove, handleNodeRemove, handleRedo, handleUndo, resetView, selectedEdge, selectedNode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const minimapData = useMemo(() => {
    if (!nodes.length) return null;
    const minX = Math.min(...nodes.map(n => n.position.x));
    const maxX = Math.max(...nodes.map(n => n.position.x + NODE_WIDTH));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxY = Math.max(...nodes.map(n => n.position.y + NODE_HEIGHT));
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [nodes]);

  return (
    <>
      <div className="workflow-builder">
        <aside className="node-palette">
          <div className="palette-header">
            <h4>Builder</h4>
            <p>Drag nodes into canvas</p>
          </div>
          <div className="palette-list">
            {NODE_TYPES.map((node) => (
              <div
                key={node.type}
                className="palette-item"
                draggable
                onDragStart={(event) => event.dataTransfer.setData('nodeType', node.type)}
              >
                <div className="palette-icon" style={{ backgroundColor: node.color }}>
                  <node.icon size={18} color="white" />
                </div>
                <span className="palette-label">{node.label}</span>
                <Plus size={14} className="palette-plus" />
              </div>
            ))}
          </div>
          <div className="palette-footer">
            <button className="palette-action" onClick={() => applyAutoLayout('LR')}>
              <LayoutGrid size={14} /> Auto-Layout (L→R)
            </button>
            <button className="palette-action" onClick={() => applyAutoLayout('TB')}>
              <LayoutGrid size={14} /> Auto-Layout (T→B)
            </button>
          </div>
        </aside>

        <div
          ref={canvasRef}
          className={`workflow-canvas ${nodes.length === 0 ? 'empty' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            setIsPanning(true);
            setSelectedNode(null);
            setSelectedEdge(null);
            setEdgeMenu(null);
          }}
          onWheel={handleWheel}
        >
          {nodes.length === 0 && (
            <div className="empty-canvas-message">
              <div className="empty-icon">
                <Plus size={48} />
              </div>
              <h3>Drag nodes into canvas</h3>
              <p>Start building your IVR workflow by dragging components from the left panel</p>
            </div>
          )}

          <div
            className="canvas-viewport"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <svg className="workflow-edges">
              {edgeLines.map((edge) => (
                <g
                  key={edge.id}
                  className={`edge-group ${selectedEdge === edge.id ? 'selected' : ''} ${activeEdgeIds.includes(edge.id) ? 'active' : ''}`}
                >
                  <path
                    d={edge.path}
                    stroke={activeEdgeIds.includes(edge.id) ? '#2563eb' : edge.color}
                    strokeWidth="2"
                    fill="none"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleEdgeClick(edge, event)}
                  />
                  <path
                    d={edge.arrowPath}
                    stroke={activeEdgeIds.includes(edge.id) ? '#2563eb' : edge.color}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleEdgeClick(edge, event)}
                  />
                  <path
                    d={edge.path}
                    stroke="transparent"
                    strokeWidth="10"
                    fill="none"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleEdgeClick(edge, event)}
                  />
                  <path
                    d={edge.arrowPath}
                    stroke="transparent"
                    strokeWidth="10"
                    fill="none"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleEdgeClick(edge, event)}
                  />
                  {edge.label && (
                    <text x={edge.center.x} y={edge.center.y - 6} className="edge-label">
                      {edge.label}
                    </text>
                  )}
                  <circle
                    className="edge-action-dot"
                    cx={edge.center.x}
                    cy={edge.center.y}
                    r="6"
                    fill={activeEdgeIds.includes(edge.id) ? '#2563eb' : edge.color}
                    onClick={(event) => handleEdgeClick(edge, event)}
                  />
                </g>
              ))}
            </svg>

            {nodes.map((node) => {
              const nodeType = NODE_TYPES.find(n => n.type === node.type);
              const hasError = validationErrors.some(err => err.nodeId === node.id);

              return (
                <div
                  key={node.id}
                  className={`workflow-node ${selectedNode === node.id ? 'selected' : ''} ${hasError ? 'error' : ''} ${activeNodeId === node.id ? 'active' : ''}`}
                  style={{ left: node.position.x, top: node.position.y }}
                  onMouseDown={(event) => handleNodeMouseDown(event, node.id)}
                  onClick={() => {
                    setSelectedNode(node.id);
                    setSelectedEdge(null);
                    setEdgeMenu(null);
                    if (reconnectEdgeId) {
                      handleReconnectFinish(node.id);
                      return;
                    }
                    if (connectingFrom && connectingFrom !== node.id) {
                      handleConnectFinish(node.id);
                    }
                  }}
                >
                  <div className="node-header">
                    <div className="node-title">
                      <div className="node-icon" style={{ color: nodeType?.color || '#6b7280' }}>
                        {nodeType?.icon ? <nodeType.icon size={16} /> : <MessageSquare size={16} />}
                      </div>
                      <span>{nodeType?.label || node.type}</span>
                    </div>
                    <button
                      type="button"
                      className="node-icon-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNodeRemove(node.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="node-body">
                    <p>{nodeType?.label || node.type}</p>
                  </div>
                  <div className="node-actions">
                    <button
                      type="button"
                      className="node-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNodeConfig(node.id);
                      }}
                      title="Configure node"
                    >
                      <Settings size={14} />
                      Configure
                    </button>
                    <button
                      type="button"
                      className={`node-action ${connectingFrom === node.id ? 'active' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleConnectStart(node.id);
                      }}
                    >
                      <Link size={14} />
                      Connect
                    </button>
                  </div>
                  {hasError && <div className="node-warning">Check connection</div>}
                </div>
              );
            })}
          </div>

          {edgeMenu && (
            <div
              className="edge-menu"
              style={{
                left: edgeMenu.x * zoom + pan.x,
                top: edgeMenu.y * zoom + pan.y
              }}
            >
              <div className="edge-menu-header">Edge Actions</div>
              <div className="edge-menu-actions">
                {NODE_TYPES.map((node) => (
                  <button
                    key={node.type}
                    className="edge-menu-btn"
                    onClick={() => insertNodeBetween(edgeMenu.edgeId, node.type)}
                  >
                    <node.icon size={12} />
                    Insert {node.label}
                  </button>
                ))}
                <button
                  className="edge-menu-btn"
                  onClick={() => setReconnectEdgeId(edgeMenu.edgeId)}
                >
                  <Link size={12} />
                  Reconnect
                </button>
                <button
                  className="edge-menu-btn destructive"
                  onClick={() => handleEdgeRemove(edgeMenu.edgeId)}
                >
                  <Trash2 size={12} />
                  Disconnect
                </button>
              </div>
            </div>
          )}

          <div className="canvas-controls">
            <button onClick={() => setZoom(prev => clamp(prev + 0.1, MIN_ZOOM, MAX_ZOOM))}>
              <ZoomIn size={16} />
              <span>Zoom In</span>
            </button>
            <button onClick={() => setZoom(prev => clamp(prev - 0.1, MIN_ZOOM, MAX_ZOOM))}>
              <ZoomOut size={16} />
              <span>Zoom Out</span>
            </button>
            <button onClick={fitToScreen}>
              <Maximize2 size={16} />
              <span>Fit to Screen</span>
            </button>
            <button onClick={resetView}>
              <Minimize2 size={16} />
              <span>Reset View</span>
            </button>
            <button onClick={() => setSnapEnabled(prev => !prev)}>
              <LayoutGrid size={16} className={snapEnabled ? 'active' : ''} />
              <span>Snap</span>
            </button>
            <button onClick={() => setShowMiniMap(prev => !prev)}>
              <ScanEye size={16} className={showMiniMap ? 'active' : ''} />
              <span>Mini Map</span>
            </button>
            <button onClick={handleUndo} disabled={history.length === 0}>
              <Undo2 size={16} />
              <span>Undo</span>
            </button>
            <button onClick={handleRedo} disabled={future.length === 0}>
              <Redo2 size={16} />
              <span>Redo</span>
            </button>
          </div>

          {validationErrors.length > 0 && (
            <div className="validation-banner">
              <strong>Workflow issues:</strong> {validationErrors[0].message}
              {validationErrors.length > 1 && ` (+${validationErrors.length - 1} more)`}
            </div>
          )}

          {showMiniMap && minimapData && (
            <div className="mini-map">
              <svg viewBox={`${minimapData.minX} ${minimapData.minY} ${minimapData.width} ${minimapData.height}`}>
                {nodes.map(node => (
                  <rect
                    key={node.id}
                    x={node.position.x}
                    y={node.position.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="6"
                    className={`mini-node ${selectedNode === node.id ? 'selected' : ''}`}
                  />
                ))}
              </svg>
            </div>
          )}
        </div>
      </div>

      {configPanelOpen && (
        <NodeConfigPanel
          node={configNode}
          onSave={handleNodeConfigSave}
          onClose={handleNodeConfigClose}
          onAutoSave={handleNodeConfigAutoSave}
          availableVoices={availableVoices || []}
        />
      )}
    </>
  );
};

export default WorkflowBuilderCanvas;
