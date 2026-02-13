import { useEffect, useCallback } from 'react';
import useSocket from './useSocket';

const useIVRWorkflowSocket = (workflowId) => {
  const { socket, connected } = useSocket();

  // Join workflow editing room
  const joinWorkflow = useCallback((id) => {
    if (socket && connected) {
      socket.emit('join_workflow', id || workflowId);
    }
  }, [socket, connected, workflowId]);

  // Leave workflow editing room
  const leaveWorkflow = useCallback((id) => {
    if (socket && connected) {
      socket.emit('leave_workflow', id || workflowId);
    }
  }, [socket, connected, workflowId]);

  // Listen for TTS audio generation progress
  const onTTSProgress = useCallback((callback) => {
    if (socket && connected) {
      const eventName = `workflow-${workflowId}-progress`;
      socket.on(eventName, callback);
      return () => socket.off(eventName, callback);
    }
  }, [socket, connected, workflowId]);

  // Listen for TTS audio generation completion
  const onTTSCompleted = useCallback((callback) => {
    if (socket && connected) {
      const eventName = `workflow-${workflowId}-completed`;
      socket.on(eventName, callback);
      return () => socket.off(eventName, callback);
    }
  }, [socket, connected, workflowId]);

  // Listen for TTS audio generation failure
  const onTTSFailed = useCallback((callback) => {
    if (socket && connected) {
      const eventName = `workflow-${workflowId}-failed`;
      socket.on(eventName, callback);
      return () => socket.off(eventName, callback);
    }
  }, [socket, connected, workflowId]);

  // Add node with real-time sync
  const addNode = useCallback((node, position) => {
    if (socket && connected) {
      socket.emit('workflow_node_add', {
        workflowId,
        node,
        position
      });
    }
  }, [socket, connected, workflowId]);

  // Move node with real-time sync
  const moveNode = useCallback((nodeId, position) => {
    if (socket && connected) {
      socket.emit('workflow_node_move', {
        workflowId,
        nodeId,
        position
      });
    }
  }, [socket, connected, workflowId]);

  // Connect nodes with real-time sync
  const connectNodes = useCallback((sourceNode, targetNode, sourceHandle, targetHandle, edgeId = null) => {
    if (socket && connected) {
      socket.emit('workflow_edge_connect', {
        workflowId,
        sourceNode,
        targetNode,
        sourceHandle,
        targetHandle,
        edgeId
      });
    }
  }, [socket, connected, workflowId]);

  // Delete edge with real-time sync
  const deleteEdge = useCallback((edgeId) => {
    if (socket && connected) {
      socket.emit('workflow_edge_delete', {
        workflowId,
        edgeId
      });
    }
  }, [socket, connected, workflowId]);

  // Reattach edge (change source/target/handles) with real-time sync
  const reattachEdge = useCallback((edgeId, updates) => {
    if (socket && connected) {
      socket.emit('workflow_edge_reattach', {
        workflowId,
        edgeId,
        updates
      });
    }
  }, [socket, connected, workflowId]);

  // Update edge metadata (label, type, data)
  const updateEdge = useCallback((edgeId, updates) => {
    if (socket && connected) {
      socket.emit('workflow_edge_update', {
        workflowId,
        edgeId,
        updates
      });
    }
  }, [socket, connected, workflowId]);

  // Delete node with real-time sync
  const deleteNode = useCallback((nodeId) => {
    if (socket && connected) {
      socket.emit('workflow_node_delete', {
        workflowId,
        nodeId
      });
    }
  }, [socket, connected, workflowId]);

  // Start workflow test
  const startTest = useCallback((testScenario) => {
    if (socket && connected) {
      socket.emit('workflow_test_start', {
        workflowId,
        testScenario
      });
    }
  }, [socket, connected, workflowId]);

  return {
    joinWorkflow,
    leaveWorkflow,
    onTTSProgress,
    onTTSCompleted,
    onTTSFailed,
    addNode,
    moveNode,
    connectNodes,
    deleteEdge,
    reattachEdge,
    updateEdge,
    deleteNode,
    startTest,
    connected
  };
};

export default useIVRWorkflowSocket;
