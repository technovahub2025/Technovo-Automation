import { useCallback, useRef, useState } from 'react';

export const useConversationRealtimeQueue = () => {
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const [realtimeSyncLoading, setRealtimeSyncLoading] = useState(false);

  const flush = useCallback(() => {
    queueRef.current = [];
    setRealtimeSyncLoading(false);
    timerRef.current = null;
  }, []);

  const enqueue = useCallback((event) => {
    queueRef.current.push(event);
    setRealtimeSyncLoading(true);

    if (timerRef.current) return;
    timerRef.current = window.setTimeout(flush, 40);
  }, [flush]);

  return {
    enqueue,
    realtimeSyncLoading,
    flush
  };
};
