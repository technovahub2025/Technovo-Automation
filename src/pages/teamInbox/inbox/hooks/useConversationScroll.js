import { useCallback, useEffect, useRef, useState } from 'react';

export const useConversationScroll = () => {
  const scrollerRef = useRef(null);
  const virtuosoRef = useRef(null);
  const [showJumpToNewest, setShowJumpToNewest] = useState(false);
  const [scrollerNode, setScrollerNodeState] = useState(null);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const rafRef = useRef(0);
  const lastShowJumpRef = useRef(false);

  const setScrollerNode = useCallback((node) => {
    scrollerRef.current = node || null;
    setScrollerNodeState(node || null);
  }, []);

  useEffect(() => {
    const element = scrollerNode;
    if (!element) return undefined;

    const updateState = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(() => {
        const scrollTop = Number(element.scrollTop || 0);
        const shouldShow = scrollTop > 260;
        if (lastShowJumpRef.current !== shouldShow) {
          lastShowJumpRef.current = shouldShow;
          setShowJumpToNewest(shouldShow);
        }
      });
    };

    updateState();
    element.addEventListener('scroll', updateState, { passive: true });
    return () => {
      element.removeEventListener('scroll', updateState);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollerNode]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewportProfile = () => {
      const compact = window.innerWidth < 768;
      setIsCompactViewport((current) => (current === compact ? current : compact));
    };

    updateViewportProfile();
    window.addEventListener('resize', updateViewportProfile, { passive: true });
    return () => window.removeEventListener('resize', updateViewportProfile);
  }, []);

  const scrollToNewest = useCallback(() => {
    const virtuoso = virtuosoRef.current;
    if (virtuoso && typeof virtuoso.scrollToIndex === 'function') {
      virtuoso.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' });
      return;
    }
    const element = scrollerRef.current;
    if (element && typeof element.scrollTo === 'function') {
      element.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return {
    scrollerRef,
    virtuosoRef,
    setScrollerNode,
    showJumpToNewest,
    scrollToNewest,
    isCompactViewport
  };
};
