import React, { useState, useEffect, useRef, useContext } from 'react';



import { useLocation, useNavigate, useParams } from 'react-router-dom';



import { Search, Filter, Paperclip, Send, Smile, Phone, MoreVertical, Check, CheckCheck } from 'lucide-react';



import './TeamInbox.css';



import { whatsappService } from '../services/whatsappService';



import webSocketService from '../services/websocketService';
import { AuthContext } from './authcontext';







const TeamInbox = () => {



  const location = useLocation();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useContext(AuthContext);



  const [conversations, setConversations] = useState([]);



  const [selectedConversation, setSelectedConversation] = useState(null);



  const [messages, setMessages] = useState([]);



  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);



  const [loading, setLoading] = useState(true);



  const [searchTerm, setSearchTerm] = useState('');



  const [wsConnected, setWsConnected] = useState(false);



  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [conversationFilter, setConversationFilter] = useState('all');



  const [selectedForDeletion, setSelectedForDeletion] = useState([]);



  const [showSelectMode, setShowSelectMode] = useState(false);



  const [showMessageSelectMenu, setShowMessageSelectMenu] = useState(false);



  const [showMessageSelectMode, setShowMessageSelectMode] = useState(false);



  const [selectedMessagesForDeletion, setSelectedMessagesForDeletion] = useState([]);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const inboxMenuRef = useRef(null);
  const messageMenuRef = useRef(null);
  const filterMenuRef = useRef(null);
  const isConversationSwitchRef = useRef(false);
  const realtimeResyncTimerRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
  const currentUserId = user?.id || user?._id || storedUser?.id || storedUser?._id || localStorage.getItem('userId') || null;



    const appendMessageUnique = (incomingMessage) => {

    if (!incomingMessage) return;

    setMessages(prev => {

      const exists = prev.some(msg => {

        if (incomingMessage._id && msg._id) return msg._id === incomingMessage._id;

        if (incomingMessage.whatsappMessageId && msg.whatsappMessageId) {

          return msg.whatsappMessageId === incomingMessage.whatsappMessageId;

        }

        return false;

      });

      return exists ? prev : [...prev, incomingMessage];

    });

  };

  const getUnreadCount = (conversation) => {
    const value =
      conversation?.unreadCount ??
      conversation?.unread_count ??
      conversation?.unreadMessages ??
      0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };
  const normalizeConversation = (conversation) => ({
    ...conversation,
    unreadCount: getUnreadCount(conversation)
  });






  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    setShowContactInfo(false);
  }, [selectedConversation?._id]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (inboxMenuRef.current && !inboxMenuRef.current.contains(event.target)) {
        setShowSelectMenu(false);
      }
      if (messageMenuRef.current && !messageMenuRef.current.contains(event.target)) {
        setShowMessageSelectMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const scheduleRealtimeResync = (targetConversationId) => {
    if (!targetConversationId) return;
    if (realtimeResyncTimerRef.current) {
      clearTimeout(realtimeResyncTimerRef.current);
      realtimeResyncTimerRef.current = null;
    }

    realtimeResyncTimerRef.current = setTimeout(() => {
      const activeConversation = selectedConversationRef.current;
      if (!activeConversation) return;
      if (String(activeConversation._id) !== String(targetConversationId)) return;
      loadMessages(activeConversation._id);
    }, 180);
  };

  // Initialize WebSocket connection



  useEffect(() => {



    const handleConnect = () => {



      setWsConnected(true);
      loadConversations({ silent: true });



      console.log('âœ… WebSocket connected in TeamInbox');



    };







    const handleDisconnect = () => {



      setWsConnected(false);



      console.log('âŒ WebSocket disconnected in TeamInbox');



    };







    const handleNewMessage = (data) => {



      console.log('ðŸ“¨ New message received:', data);



      



      // Update conversations list



      setConversations(prev => {
        const incomingConversation = normalizeConversation(data?.conversation || {});
        const activeConversation = selectedConversationRef.current;
        const isSelectedConversation =
          activeConversation && activeConversation._id === incomingConversation._id;
        const isIncomingContactMessage = data?.message?.sender === 'contact';

        let found = false;
        const updated = prev.map(conv => {
          if (conv._id !== incomingConversation._id) return conv;

          found = true;
          const mergedConversation = normalizeConversation({ ...conv, ...incomingConversation });

          if (isSelectedConversation && isIncomingContactMessage) {
            mergedConversation.unreadCount = 0;
          } else if (isIncomingContactMessage) {
            mergedConversation.unreadCount = Math.max(
              getUnreadCount(incomingConversation),
              getUnreadCount(conv) + 1,
              1
            );
          }

          return mergedConversation;
        });

        if (!found && incomingConversation._id) {
          updated.unshift(normalizeConversation({
            ...incomingConversation,
            unreadCount:
              isSelectedConversation && isIncomingContactMessage
                ? 0
                : Math.max(getUnreadCount(incomingConversation), isIncomingContactMessage ? 1 : 0)
          }));
        }

        return updated.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
      });







      // Update messages if this conversation is selected



      const activeConversation = selectedConversationRef.current;
      if (activeConversation && activeConversation._id === data?.conversation?._id) {
        const incoming = data?.message || {};
        if (incoming?.sender === 'agent') {
          setMessages((prev) => {
            const incomingId = incoming?._id ? String(incoming._id) : '';
            const incomingWamid = incoming?.whatsappMessageId ? String(incoming.whatsappMessageId) : '';

            // Already present -> refresh fields only.
            const existingIndex = prev.findIndex((msg) => {
              const msgId = msg?._id ? String(msg._id) : '';
              const msgWamid = msg?.whatsappMessageId ? String(msg.whatsappMessageId) : '';
              return (incomingId && msgId === incomingId) || (incomingWamid && msgWamid === incomingWamid);
            });
            if (existingIndex >= 0) {
              return prev.map((msg, idx) => (idx === existingIndex ? { ...msg, ...incoming } : msg));
            }

            // Replace optimistic temp bubble with confirmed agent message.
            const optimisticIndex = prev.findIndex(
              (msg) =>
                typeof msg?._id === 'string' &&
                msg._id.startsWith('temp-') &&
                msg.sender === 'agent' &&
                msg.text === incoming.text
            );
            if (optimisticIndex >= 0) {
              return prev.map((msg, idx) => (idx === optimisticIndex ? { ...msg, ...incoming } : msg));
            }

            return [...prev, incoming];
          });
        } else {
          appendMessageUnique(incoming);
          markAsRead(activeConversation._id);
        }
        scheduleRealtimeResync(activeConversation._id);
      }



    };







    const handleMessageSent = (data) => {



      console.log('ðŸ“¤ Message sent confirmation:', data);



      



      const activeConversation = selectedConversationRef.current;
      if (activeConversation && activeConversation._id === data.message.conversationId) {
        setMessages((prev) => {
          const incoming = data.message || {};
          const incomingId = incoming?._id ? String(incoming._id) : '';
          const incomingWamid = incoming?.whatsappMessageId ? String(incoming.whatsappMessageId) : '';

          // If already exists, only refresh fields/status.
          const existingIndex = prev.findIndex((msg) => {
            const msgId = msg?._id ? String(msg._id) : '';
            const msgWamid = msg?.whatsappMessageId ? String(msg.whatsappMessageId) : '';
            return (incomingId && msgId === incomingId) || (incomingWamid && msgWamid === incomingWamid);
          });
          if (existingIndex >= 0) {
            return prev.map((msg, idx) => (idx === existingIndex ? { ...msg, ...incoming } : msg));
          }

          // Try replacing an optimistic pending message with same text.
          const optimisticIndex = prev.findIndex(
            (msg) =>
              typeof msg?._id === 'string' &&
              msg._id.startsWith('temp-') &&
              msg.sender === 'agent' &&
              msg.text === incoming.text
          );
          if (optimisticIndex >= 0) {
            return prev.map((msg, idx) => (idx === optimisticIndex ? { ...msg, ...incoming } : msg));
          }

          return [...prev, incoming];
        });
      }



    };







    const handleMessageStatus = (data) => {
      console.log('Message status update:', data);

      const incomingStatus = String(data?.status || '').toLowerCase();
      const incomingMessageIds = new Set(
        [
          data?.messageId,
          data?.id,
          data?.whatsappMessageId,
          data?.message?._id,
          data?.message?.messageId,
          data?.message?.whatsappMessageId
        ]
          .filter(Boolean)
          .map((v) => String(v))
      );

      const statusRank = { sent: 1, delivered: 2, read: 3, failed: 4 };
      let foundMatch = false;

      setMessages((prev) =>
        prev.map((msg) => {
          const msgIds = [
            msg?._id,
            msg?.messageId,
            msg?.whatsappMessageId
          ]
            .filter(Boolean)
            .map((v) => String(v));

          const matched = msgIds.some((id) => incomingMessageIds.has(id));
          if (!matched) return msg;

          foundMatch = true;
          const currentStatus = String(msg?.status || '').toLowerCase();
          const currentRank = statusRank[currentStatus] || 0;
          const nextRank = statusRank[incomingStatus] || currentRank;

          return nextRank >= currentRank
            ? { ...msg, status: incomingStatus || currentStatus }
            : msg;
        })
      );

      const activeConversation = selectedConversationRef.current;
      const eventConversationId = data?.conversationId ? String(data.conversationId) : '';
      if (!foundMatch && activeConversation && eventConversationId && String(activeConversation._id) === eventConversationId) {
        loadMessages(activeConversation._id);
      }
      if (activeConversation && eventConversationId && String(activeConversation._id) === eventConversationId) {
        scheduleRealtimeResync(activeConversation._id);
      }
    };







    // Connect to WebSocket



    webSocketService.connect(currentUserId);



    webSocketService.on('connected', handleConnect);



    webSocketService.on('disconnected', handleDisconnect);



    webSocketService.on('newMessage', handleNewMessage);
    webSocketService.on('new_message', handleNewMessage);



    webSocketService.on('messageSent', handleMessageSent);
    webSocketService.on('message_sent', handleMessageSent);



    webSocketService.on('messageStatus', handleMessageStatus);
    webSocketService.on('message_status', handleMessageStatus);







    return () => {



      webSocketService.off('connected', handleConnect);



      webSocketService.off('disconnected', handleDisconnect);



      webSocketService.off('newMessage', handleNewMessage);
      webSocketService.off('new_message', handleNewMessage);



      webSocketService.off('messageSent', handleMessageSent);
      webSocketService.off('message_sent', handleMessageSent);



      webSocketService.off('messageStatus', handleMessageStatus);
      webSocketService.off('message_status', handleMessageStatus);



    };



  }, [currentUserId]);

  useEffect(() => {
    return () => {
      if (realtimeResyncTimerRef.current) {
        clearTimeout(realtimeResyncTimerRef.current);
      }
    };
  }, []);



  useEffect(() => {



    loadConversations();



  }, []);
  useEffect(() => {
    const onFocusRefresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      loadConversations({ silent: true });
    };
    window.addEventListener('focus', onFocusRefresh);
    document.addEventListener('visibilitychange', onFocusRefresh);
    return () => {
      window.removeEventListener('focus', onFocusRefresh);
      document.removeEventListener('visibilitychange', onFocusRefresh);
    };
  }, []);







  // Handle phone number from navigation state



  useEffect(() => {



    if (location.state?.phoneNumber && conversations.length > 0) {



      const targetConversation = conversations.find(



        conv => conv.contactPhone === location.state.phoneNumber



      );



      



      if (targetConversation) {



        setSelectedConversation(targetConversation);



      } else {



        // If no conversation exists, create a new one or show a message



        console.log('No conversation found for phone:', location.state.phoneNumber);



        // Optionally create a new conversation here



      }



    }



  }, [location.state, conversations]);







  // Load messages when conversation is selected



  useEffect(() => {
    if (selectedConversation) {
      isConversationSwitchRef.current = true;
      loadMessages(selectedConversation._id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (!conversationId || !conversations.length) return;
    const targetConversation = conversations.find(
      (conv) => String(conv._id) === String(conversationId)
    );
    if (targetConversation && selectedConversation?._id !== targetConversation._id) {
      setSelectedConversation(targetConversation);
      if (getUnreadCount(targetConversation) > 0) {
        markAsRead(targetConversation._id);
      }
    }
  }, [conversationId, conversations, selectedConversation?._id]);







  // Auto-scroll to bottom when new messages arrive



  useEffect(() => {
    if (isConversationSwitchRef.current) {
      scrollToBottom('auto');
      isConversationSwitchRef.current = false;
      return;
    }
    scrollToBottom('smooth');
  }, [messages]);







  const loadConversations = async ({ silent = false } = {}) => {



    try {



      if (!silent) setLoading(true);



      const data = await whatsappService.getConversations();



      setConversations(Array.isArray(data) ? data.map(normalizeConversation) : []);



    } catch (error) {



      console.error('Failed to load conversations:', error);



    } finally {



      if (!silent) setLoading(false);



    }



  };







  const loadMessages = async (conversationId) => {



    try {



      const data = await whatsappService.getMessages(conversationId);



      setMessages(Array.isArray(data) ? data : []);



    } catch (error) {



      console.error('Failed to load messages:', error);



    }



  };







  const sendMessage = async () => {



    if (!messageInput.trim() || !selectedConversation || sendingMessage) return;







    let optimisticId = null;
    let textToSend = '';
    try {
      setSendingMessage(true);
      const activeConversationId = selectedConversation?._id || conversationId;
      textToSend = messageInput.trim();
      optimisticId = `temp-${Date.now()}`;

      // Optimistic UI: show outgoing message instantly.
      setMessageInput('');
      appendMessageUnique({
        _id: optimisticId,
        sender: 'agent',
        text: textToSend,
        status: 'sending',
        timestamp: new Date().toISOString(),
        conversationId: activeConversationId
      });

      setConversations(prev =>
        prev.map(conv =>
          conv._id === selectedConversation._id
            ? {
                ...conv,
                lastMessage: textToSend,
                lastMessageTime: new Date().toISOString(),
                lastMessageFrom: 'agent'
              }
            : conv
        )
      );



      const result = await whatsappService.sendMessage(



        selectedConversation.contactPhone,



        textToSend,



        activeConversationId



      );







            if (result?.success) {

        const sentMessage = result.message || result.data?.message;

        if (sentMessage) {
          setMessages((prev) => {
            const sentId = sentMessage?._id ? String(sentMessage._id) : '';
            const sentWamid = sentMessage?.whatsappMessageId ? String(sentMessage.whatsappMessageId) : '';

            // Replace optimistic temp bubble
            let next = prev.map((msg) =>
              msg._id === optimisticId
                ? { ...msg, ...sentMessage, status: sentMessage.status || 'sent' }
                : msg
            );

            // If temp wasn't found (already removed/replaced), ensure message exists once
            const existsAfterReplace = next.some((msg) => {
              const msgId = msg?._id ? String(msg._id) : '';
              const msgWamid = msg?.whatsappMessageId ? String(msg.whatsappMessageId) : '';
              return (sentId && msgId === sentId) || (sentWamid && msgWamid === sentWamid);
            });
            if (!existsAfterReplace) {
              next = [...next, { ...sentMessage, status: sentMessage.status || 'sent' }];
            }

            // De-duplicate same real message (can happen due to websocket + API race)
            const seen = new Set();
            next = next.filter((msg) => {
              const msgId = msg?._id ? String(msg._id) : '';
              const msgWamid = msg?.whatsappMessageId ? String(msg.whatsappMessageId) : '';
              const key = msgId || msgWamid;
              if (!key) return true;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            return next;
          });

        } else {

          setMessages(prev =>
            prev.map(msg =>
              msg._id === optimisticId
                ? { ...msg, status: 'sent' }
                : msg
            )
          );

        }

      } else {



        setMessages(prev => prev.filter(msg => msg._id !== optimisticId));
        setMessageInput(textToSend);
        console.error('Failed to send message:', result?.error);
        alert(result?.error || 'Message send failed');



      }



    } catch (error) {



      if (optimisticId) {
        setMessages(prev => prev.filter(msg => msg._id !== optimisticId));
      }
      if (textToSend) {
        setMessageInput((prev) => prev || textToSend);
      }
      console.error('Error sending message:', error);
      alert(error?.message || 'Unable to send message');



    } finally {
      setSendingMessage(false);
    }



  };







  const markAsRead = async (conversationId) => {



    try {



      await whatsappService.markConversationAsRead(conversationId);



      



      // Update local state



      setConversations(prev => 



        prev.map(conv => 



          conv._id === conversationId 



            ? { ...conv, unreadCount: 0 }



            : conv



        )



      );



    } catch (error) {



      console.error('Failed to mark conversation as read:', error);



    }



  };







  const scrollToBottom = (behavior = 'smooth') => {
    const chatContainer = chatMessagesRef.current;
    if (!chatContainer) return;

    if (behavior === 'auto') {
      chatContainer.scrollTop = chatContainer.scrollHeight;
      return;
    }

    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior
    });
  };







  const deleteCurrentConversation = async () => {



    if (!selectedConversation) return;



    



    if (window.confirm(`Are you sure you want to delete this conversation with ${selectedConversation.contactId?.name || selectedConversation.contactPhone}?`)) {



      try {



        await whatsappService.deleteConversation(selectedConversation._id);



        setConversations(prev => prev.filter(conv => conv._id !== selectedConversation._id));



        setSelectedConversation(null);



        setMessages([]);
        navigate('/inbox');



        alert('Conversation deleted successfully!');



      } catch (error) {



        console.error('Failed to delete conversation:', error);



        alert('Failed to delete conversation');



      }



    }



  };







  const toggleSelectForDeletion = (conversationId) => {



    console.log('Toggling conversation:', conversationId);



    console.log('Current selected:', selectedForDeletion);



    setSelectedForDeletion(prev => {



      const newSelection = prev.includes(conversationId) 



        ? prev.filter(id => id !== conversationId)



        : [...prev, conversationId];



      console.log('New selection:', newSelection);



      return newSelection;



    });



  };







  const deleteSelectedChats = async () => {



    if (selectedForDeletion.length === 0) {



      alert('Please select chats to delete');



      return;



    }



    



    if (window.confirm(`Are you sure you want to delete ${selectedForDeletion.length} chat(s)?`)) {



      try {



        await whatsappService.deleteSelectedConversations(selectedForDeletion);



        setConversations(prev => prev.filter(conv => !selectedForDeletion.includes(conv._id)));



        if (selectedConversation && selectedForDeletion.includes(selectedConversation._id)) {



          setSelectedConversation(null);



          setMessages([]);
          navigate('/inbox');



        }



        setSelectedForDeletion([]);



        setShowSelectMode(false);



        alert('Selected chats deleted successfully!');



      } catch (error) {



        console.error('Failed to delete selected chats:', error);



        alert('Failed to delete selected chats');



      }



    }



  };







  const toggleMessageSelection = (messageId) => {



    console.log('Toggling message:', messageId);



    console.log('Current selected messages:', selectedMessagesForDeletion);



    setSelectedMessagesForDeletion(prev => {



      const newSelection = prev.includes(messageId) 



        ? prev.filter(id => id !== messageId)



        : [...prev, messageId];



      console.log('New message selection:', newSelection);



      return newSelection;



    });



  };







  const deleteSelectedMessages = async () => {



    console.log('Attempting to delete selected messages. Selected count:', selectedMessagesForDeletion.length);



    if (selectedMessagesForDeletion.length === 0) {



      alert('Please select messages to delete');



      return;



    }



    



    if (window.confirm(`Are you sure you want to delete ${selectedMessagesForDeletion.length} message(s)?`)) {



      try {



        const selectedSet = new Set(selectedMessagesForDeletion);
        const persistedMessageIds = messages
          .map((msg, idx) => ({ msg, key: getMessageKey(msg, idx) }))
          .filter(item => selectedSet.has(item.key) && item.msg?._id)
          .map(item => item.msg._id);

        if (persistedMessageIds.length > 0) {
          await whatsappService.deleteSelectedMessages(persistedMessageIds);
        }

        setMessages(prev => prev.filter((msg, idx) => !selectedSet.has(getMessageKey(msg, idx))));



        setSelectedMessagesForDeletion([]);



        setShowMessageSelectMode(false);



        alert('Selected messages deleted successfully!');



      } catch (error) {



        console.error('Failed to delete selected messages:', error);



        alert('Failed to delete selected messages');



      }



    }



  };







  const getStatusIcon = (status) => {
    const normalizedStatus = String(status || '').toLowerCase();

    switch (normalizedStatus) {
      case 'sent':
        return <Check size={16} className="message-status-icon status-sent" />;

      case 'delivered':
        return <CheckCheck size={16} className="message-status-icon status-delivered" />;

      case 'read':
        return <CheckCheck size={16} className="message-status-icon status-read" />;

      case 'failed':
        return <span className="message-status-icon status-failed">x</span>;

      default:
        return null;
    }
  };







  const formatTime = (timestamp) => {



    const date = new Date(timestamp);



    return date.toLocaleTimeString('en-US', { 



      hour: '2-digit', 



      minute: '2-digit' 



    });



  };

  const formatDateLabel = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };







  const safeConversations = Array.isArray(conversations) ? conversations : [];
  const getMessageKey = (message, index) => message._id || message.whatsappMessageId || `tmp-${index}`;

  const filteredConversations = safeConversations
    .filter(conv =>
      conv.contactId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.contactPhone?.includes(searchTerm) ||
      conv.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(conv => {
      if (conversationFilter === 'unread') return getUnreadCount(conv) > 0;
      if (conversationFilter === 'read') return getUnreadCount(conv) === 0;
      return true;
    });

  const groupedMessages = [];
  let lastDateKey = '';
  messages.forEach((message, index) => {
    const ts = message.timestamp || message.whatsappTimestamp || message.createdAt;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== lastDateKey) {
      groupedMessages.push({
        type: 'separator',
        key: `sep-${key}-${index}`,
        label: formatDateLabel(ts)
      });
      lastDateKey = key;
    }
    groupedMessages.push({ type: 'message', key: message._id || `msg-${index}`, message, index });
  });







  return (



    <div className="inbox-container">



      <div className="inbox-sidebar">



        <div className="inbox-header">



          <h2>Team Inbox</h2>



          <div className="inbox-actions">



            <div className={`connection-indicator ${wsConnected ? 'connected' : 'disconnected'}`} />



            <div className="inbox-header-menu" ref={filterMenuRef}>
              <button
                className="icon-btn"
                onClick={() => {
                  setShowFilterMenu(!showFilterMenu);
                  setShowSelectMenu(false);
                  setShowMessageSelectMenu(false);
                }}
              >
                <Filter size={18} />
              </button>
              {showFilterMenu && (
                <div className="inbox-select-menu">
                  <button
                    className="select-menu-item"
                    onClick={() => {
                      setConversationFilter('all');
                      setShowFilterMenu(false);
                    }}
                  >
                    All Chats
                  </button>
                  <button
                    className="select-menu-item"
                    onClick={() => {
                      setConversationFilter('unread');
                      setShowFilterMenu(false);
                    }}
                  >
                    Unread
                  </button>
                  <button
                    className="select-menu-item"
                    onClick={() => {
                      setConversationFilter('read');
                      setShowFilterMenu(false);
                    }}
                  >
                    Read
                  </button>
                </div>
              )}
            </div>



            <div className="inbox-header-menu" ref={inboxMenuRef}>



              <button
                className="icon-btn"
                onClick={() => {
                  setShowSelectMenu(!showSelectMenu);
                  setShowFilterMenu(false);
                  setShowMessageSelectMenu(false);
                }}
              ><MoreVertical size={18} /></button>



              {showSelectMenu && (



                <div className="inbox-select-menu">



                  <button className="select-menu-item" onClick={() => {



                    setShowSelectMode(!showSelectMode);



                    setShowSelectMenu(false);



                    if (showSelectMode) {



                      setSelectedForDeletion([]);



                    }



                  }}>



                    {showSelectMode ? 'Cancel Select' : 'Select Chat'}



                  </button>



                </div>



              )}



            </div>



          </div>



        </div>







        <div className="search-bar">



          <Search size={18} className="search-icon" />



          <input



            type="text"



            placeholder="Search conversations..."



            value={searchTerm}



            onChange={(e) => setSearchTerm(e.target.value)}



          />



        </div>







        <div className="conversation-list">



          {loading ? (



            <div className="loading">Loading conversations...</div>



          ) : (



            <>



              {showSelectMode && (



                <div className="selection-actions">



                  <button 



                    className="delete-selected-btn" 



                    onClick={deleteSelectedChats}



                    disabled={selectedForDeletion.length === 0}



                    style={{ opacity: selectedForDeletion.length === 0 ? 0.5 : 1 }}



                  >



                    Delete Selected ({selectedForDeletion.length})



                  </button>



                  <button className="resolve-btn" onClick={() => {



                    setShowSelectMode(false);



                    setSelectedForDeletion([]);



                  }}>Resolve</button>



                </div>



              )}



              {filteredConversations.map(conversation => (



                <div



                  key={conversation._id}



                  className={`conversation-item ${selectedConversation?._id === conversation._id ? 'active' : ''} ${showSelectMode ? 'select-mode' : ''}`}



                  onClick={() => {



                    console.log('Conversation clicked:', conversation._id, 'Select mode:', showSelectMode);



                    if (showSelectMode) {



                      toggleSelectForDeletion(conversation._id);



                    } else {



                      setSelectedConversation(conversation);
                      navigate(`/inbox/${conversation._id}`);



                      if (getUnreadCount(conversation) > 0) {



                        markAsRead(conversation._id);



                      }



                    }



                  }}



                >



                  {showSelectMode && (



                    <div className="select-checkbox">



                      <input



                        type="checkbox"



                        checked={selectedForDeletion.includes(conversation._id)}



                        onChange={() => toggleSelectForDeletion(conversation._id)}



                        onClick={(e) => e.stopPropagation()}



                      />



                    </div>



                  )}



                  <div className="avatar">



                    {conversation.contactId?.name?.charAt(0) || conversation.contactPhone?.charAt(0)}



                  </div>



                  <div className="conversation-info">



                    <div className="conversation-top">



                      <span className="name">



                        {conversation.contactId?.name || conversation.contactPhone}



                      </span>



                      <span className="time">



                        {formatTime(conversation.lastMessageTime)}



                      </span>



                    </div>



                    <div className="conversation-bottom">



                      <p className="preview">{conversation.lastMessage}</p>



                      {getUnreadCount(conversation) > 0 && (



                        <span className="unread-badge">{getUnreadCount(conversation)}</span>



                      )}



                    </div>



                  </div>



                </div>



              ))}



            </>



          )}



        </div>



      </div>







      <div className="chat-area">



        {selectedConversation ? (



          <>



            <div className="chat-header">



              <div className="avatar">



                {selectedConversation.contactId?.name?.charAt(0) || selectedConversation.contactPhone?.charAt(0)}



              </div>



              <div className="chat-header-info">



                <span className="name text-white">



                  {selectedConversation.contactId?.name || selectedConversation.contactPhone}



                </span>



                <span className="status text-white">{selectedConversation.contactPhone}</span>



              </div>



              <div className="chat-header-actions">



                <button className="icon-btn text-white"><Phone size={18} /></button>



                <div className="chat-header-menu" ref={messageMenuRef}>



                  <button
                    className="icon-btn text-white"
                    onClick={() => {
                      setShowMessageSelectMenu(!showMessageSelectMenu);
                      setShowSelectMenu(false);
                      setShowFilterMenu(false);
                    }}
                  ><MoreVertical size={18} /></button>



                  {showMessageSelectMenu && (



                    <div className="message-select-menu">



                      <button className="select-menu-item" onClick={() => {



                        setShowMessageSelectMode(!showMessageSelectMode);



                        setShowMessageSelectMenu(false);



                        if (showMessageSelectMode) {



                          setSelectedMessagesForDeletion([]);



                        }



                      }}>



                        {showMessageSelectMode ? 'Cancel Select' : 'Select Chat'}



                      </button>
                      <button
                        className="select-menu-item"
                        onClick={() => {
                          setShowMessageSelectMenu(false);
                          deleteCurrentConversation();
                        }}
                      >
                        Delete Chat
                      </button>
                      <button
                        className="select-menu-item"
                        onClick={() => {
                          setShowMessageSelectMenu(false);
                          setShowContactInfo(true);
                        }}
                      >
                        Contact Information
                      </button>



                    </div>



                  )}



                </div>



              </div>



            </div>







            <div className="chat-messages" ref={chatMessagesRef}>



              {groupedMessages.map((item) => {
                if (item.type === 'separator') {
                  return (
                    <div key={item.key} className="message-date-separator">
                      <span>{item.label}</span>
                    </div>
                  );
                }

                const message = item.message;
                const messageKey = getMessageKey(message, item.index);

                return (
                  <div
                    key={messageKey}
                    className={`message ${message.sender === 'agent' ? 'outgoing' : 'incoming'} ${showMessageSelectMode ? 'select-mode' : ''}`}
                    onClick={() => {
                      if (showMessageSelectMode) {
                        toggleMessageSelection(messageKey);
                      }
                    }}
                  >
                    {showMessageSelectMode && (
                      <div className="message-select-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedMessagesForDeletion.includes(messageKey)}
                          onChange={() => toggleMessageSelection(messageKey)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

                    <div className="bubble">
                      {message.text}
                      {message.mediaUrl && (
                        <div className="media-attachment">
                          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                            View Media
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="message-info">
                      <span className="timestamp">
                        {formatTime(message.timestamp || message.whatsappTimestamp || message.createdAt)}
                      </span>
                      {message.sender === 'agent' && getStatusIcon(message.status)}
                    </div>
                  </div>
                );
              })}



              <div ref={messagesEndRef} />



            </div>







            <div className="chat-input-area">
              {showMessageSelectMode && (
                <div className="message-selection-actions sticky-bottom-actions">
                  <button
                    className="delete-selected-btn"
                    onClick={deleteSelectedMessages}
                    disabled={selectedMessagesForDeletion.length === 0}
                    style={{ opacity: selectedMessagesForDeletion.length === 0 ? 0.5 : 1 }}
                  >
                    Delete Selected ({selectedMessagesForDeletion.length})
                  </button>
                </div>
              )}



              <button className="attach-btn"><Paperclip size={20} /></button>



              <input



                type="text"



                placeholder="Type a message..."



                value={messageInput}



                onChange={(e) => setMessageInput(e.target.value)}



                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}



              />



              <button className="emoji-btn"><Smile size={20} /></button>



              <button 



                className="send-btn" 



                onClick={sendMessage}



                disabled={!messageInput.trim() || sendingMessage}



              >



                <Send size={18} />



              </button>



            </div>



          </>



        ) : (



          <div className="no-conversation-selected">



            <div className="placeholder-content">



              <h3>Welcome to Team Inbox</h3>



              <p>Select a conversation to start messaging</p>



            </div>



          </div>



        )}

        {selectedConversation && showContactInfo && (
          <div className="contact-info-modal-overlay" onClick={() => setShowContactInfo(false)}>
            <div className="contact-info-modal" onClick={(e) => e.stopPropagation()}>
              <div className="contact-info-modal-header">
                <h3>Contact Information</h3>
                <button className="icon-btn" onClick={() => setShowContactInfo(false)}>
                  <MoreVertical size={16} />
                </button>
              </div>
              <div className="contact-info-row">
                <span>Name</span>
                <strong>{selectedConversation.contactId?.name || '-'}</strong>
              </div>
              <div className="contact-info-row">
                <span>Phone</span>
                <strong>{selectedConversation.contactPhone || '-'}</strong>
              </div>
              <div className="contact-info-row">
                <span>Email</span>
                <strong>{selectedConversation.contactId?.email || '-'}</strong>
              </div>
              <div className="contact-info-row">
                <span>Tags</span>
                <strong>
                  {Array.isArray(selectedConversation.contactId?.tags) && selectedConversation.contactId.tags.length > 0
                    ? selectedConversation.contactId.tags.join(', ')
                    : '-'}
                </strong>
              </div>
              <div className="contact-info-row">
                <span>Notes</span>
                <strong>{selectedConversation.contactId?.notes || '-'}</strong>
              </div>
            </div>
          </div>
        )}



      </div>



    </div>



  );



};







export default TeamInbox;










