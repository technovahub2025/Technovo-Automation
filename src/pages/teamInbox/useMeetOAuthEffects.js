import { useEffect, useRef } from 'react';
import { resolveApiBaseUrl } from '../../services/apiBaseUrl';
import {
  buildGoogleOAuthTrustedOrigins,
  isGoogleOAuthEventOriginTrusted,
  isOAuthPopupOpen,
  resolveGoogleOAuthEvent
} from '../../utils/googleOAuthEvents';

export const useMeetOAuthEffects = ({
  showContactInfo,
  loadMeetAuthStatus,
  meetConnecting,
  setMeetConnecting,
  googleOAuthPopupRef,
  setContactInfoMessage,
  setContactInfoMessageTone
}) => {
  const loadMeetAuthStatusRef = useRef(loadMeetAuthStatus);
  const callbacksRef = useRef({
    setMeetConnecting,
    setContactInfoMessage,
    setContactInfoMessageTone
  });

  useEffect(() => {
    loadMeetAuthStatusRef.current = loadMeetAuthStatus;
  }, [loadMeetAuthStatus]);

  useEffect(() => {
    callbacksRef.current = {
      setMeetConnecting,
      setContactInfoMessage,
      setContactInfoMessageTone
    };
  }, [setMeetConnecting, setContactInfoMessage, setContactInfoMessageTone]);

  useEffect(() => {
    if (!showContactInfo) return;
    loadMeetAuthStatusRef.current();
  }, [showContactInfo]);

  useEffect(() => {
    const trustedOrigins = buildGoogleOAuthTrustedOrigins({
      windowOrigin: window.location.origin,
      apiBaseUrl: resolveApiBaseUrl()
    });

    const handleGoogleOAuthMessage = async (event) => {
      if (!isGoogleOAuthEventOriginTrusted(event?.origin, trustedOrigins)) {
        return;
      }

      const oauthEvent = resolveGoogleOAuthEvent(event?.data);
      if (oauthEvent.type === 'ignore') return;

      if (oauthEvent.type === 'success') {
        callbacksRef.current.setMeetConnecting(false);
        if (isOAuthPopupOpen(googleOAuthPopupRef.current)) {
          googleOAuthPopupRef.current.close();
        }
        callbacksRef.current.setContactInfoMessage(oauthEvent.message);
        callbacksRef.current.setContactInfoMessageTone('success');
        await loadMeetAuthStatusRef.current();
      }

      if (oauthEvent.type === 'error') {
        callbacksRef.current.setMeetConnecting(false);
        if (isOAuthPopupOpen(googleOAuthPopupRef.current)) {
          googleOAuthPopupRef.current.close();
        }
        callbacksRef.current.setContactInfoMessage(oauthEvent.message);
        callbacksRef.current.setContactInfoMessageTone('error');
      }
    };

    window.addEventListener('message', handleGoogleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleGoogleOAuthMessage);
      if (isOAuthPopupOpen(googleOAuthPopupRef.current)) {
        googleOAuthPopupRef.current.close();
      }
    };
  }, [googleOAuthPopupRef]);

  useEffect(() => {
    if (!meetConnecting) return undefined;

    const watcher = setInterval(() => {
      if (!googleOAuthPopupRef.current) return;
      if (isOAuthPopupOpen(googleOAuthPopupRef.current)) return;
      callbacksRef.current.setMeetConnecting(false);
      googleOAuthPopupRef.current = null;
    }, 500);

    return () => clearInterval(watcher);
  }, [meetConnecting, googleOAuthPopupRef]);
};
