import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Paperclip, Smile, MoreVertical, Phone, Video, Info, Users, BarChart3, Radio, Check, CheckCheck, Clock, MessageSquare, Bell, FileText, Mail } from 'lucide-react';
import webSocketService from '../services/websocketService';
import { whatsappService } from '../services/whatsappService';
import BulkMessaging from '../components/BulkMessaging';
import TemplateManagement from '../components/TemplateManagement';

const WhatsAppBusinessPlatform = () => {
  const [activeTab, setActiveTab] = useState('inbox');
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  
  // Contact editing state
  const [editingContact, setEditingContact] = useState(null);
  const [showContactEditModal, setShowContactEditModal] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Initialize WebSocket connection
  useEffect(() => {
    const userId = 'frontend-user-' + Math.random().toString(36).slice(2, 11);

    const handleWebSocketMessage = (data) => {
      console.log('🔔 WebSocket message received:', data.type, data);
      
      switch (data.type) {
        case 'new_message':
          handleNewMessage(data);
          break;
        case 'message_sent':
          handleMessageSent(data);
          break;
        case 'message_status':
          handleMessageStatus(data);
          break;
        case 'conversation_read':
          handleConversationRead(data);
          break;
        case 'user_list':
          setConnectedUsers(Array.isArray(data.users) ? data.users : []);
          break;
        case 'connected':
          console.log('✅ WebSocket connected');
          break;
        case 'disconnected':
          console.log('❌ WebSocket disconnected');
          break;
        default:
          console.log('🔍 Unknown message type:', data.type);
      }
    };

    // Connect to WebSocket
    webSocketService.connect(userId, handleWebSocketMessage)
      .then(() => {
        console.log('✅ WebSocket connection established');
        setError(null);
      })
      .catch((error) => {
        console.error('❌ WebSocket connection failed:', error);
        setError('Failed to connect to real-time services');
      });

    // Set up event listeners
    webSocketService.on('new_message', handleNewMessage);
    webSocketService.on('message_sent', handleMessageSent);
    webSocketService.on('message_status', handleMessageStatus);
    webSocketService.on('conversation_read', handleConversationRead);
    webSocketService.on('user_list', setConnectedUsers);
    webSocketService.on('connected', () => setError(null));
    webSocketService.on('disconnected', () => setError('Connection lost'));

    return () => {
      webSocketService.disconnect();
    };
  }, []);

  // Handle new message from WebSocket
  const handleNewMessage = (data) => {
    if (data.conversation) {
      setConversations(prev => {
        const next = [...prev];
        const idx = next.findIndex((c) => getId(c) === getId(data.conversation));
        
        if (idx >= 0) {
          next.splice(idx, 1);
        }
        next.unshift(data.conversation);
        return next;
      });
    }

    if (selectedConvo && getId(data.conversation) === getId(selectedConvo) && data.message) {
      setMessages(prev => [...prev, data.message]);
    }
  };

  // Handle message sent confirmation
  const handleMessageSent = (data) => {
    if (!data.message) return;
    
    const msgConvoId = String(data.message.conversationId || '');
    const selectedId = getId(selectedConvo);

    if (msgConvoId && msgConvoId === selectedId) {
      setMessages(prev => {
        const existingTempIndex = prev.findIndex(msg => msg._id && msg._id.startsWith('temp-'));
        if (existingTempIndex >= 0) {
          const updated = [...prev];
          updated[existingTempIndex] = data.message;
          return updated;
        } else {
          return [...prev, data.message];
        }
      });
    }

    // Update conversation preview
    setConversations(prev => {
      const next = [...prev];
      const idx = next.findIndex((c) => getId(c) === msgConvoId);
      if (idx >= 0) {
        const updated = {
          ...next[idx],
          lastMessage: data.message.text,
          lastMessageTime: data.message.timestamp || new Date().toISOString(),
          lastMessageFrom: 'agent'
        };
        next.splice(idx, 1);
        next.unshift(updated);
      }
      return next;
    });
  };

  // Handle message status updates
  const handleMessageStatus = (data) => {
    setMessages(prev =>
      prev.map((msg) =>
        msg.whatsappMessageId === data.messageId ? { ...msg, status: data.status } : msg
      )
    );
  };

  // Handle conversation read updates
  const handleConversationRead = (data) => {
    setConversations(prev =>
      prev.map((c) => (getId(c) === data.conversationId ? { ...c, unreadCount: data.unreadCount || 0 } : c))
    );
  };

  // Fetch real data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('🔄 Fetching data from backend API...');
        
        // Fetch all data in parallel
        const [conversationsData, contactsData, broadcastsData, analyticsData] = await Promise.all([
          whatsappService.getConversations(),
          whatsappService.getContacts(),
          whatsappService.getBroadcasts(),
          whatsappService.getAnalytics()
        ]);

        console.log('📊 Data loaded:', {
          conversations: conversationsData.length,
          contacts: contactsData.length,
          broadcasts: broadcastsData.length,
          analytics: analyticsData
        });

        setConversations(conversationsData || []);
        setContacts(contactsData || []);
        setBroadcasts(broadcastsData || []);
        setAnalytics(analyticsData || {});
        setError(null);
        
      } catch (error) {
        console.error('❌ Error fetching data:', error);
        setError('Failed to load data from backend');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConvo) {
      const fetchMessages = async () => {
        try {
          const conversationId = getId(selectedConvo);
          
          if (!conversationId) {
            console.error('No valid conversation ID found');
            return;
          }
          
          // Mark conversation as read
          await whatsappService.markConversationAsRead(conversationId);
          
          // Fetch messages
          const messagesData = await whatsappService.getMessages(conversationId);
          setMessages(messagesData || []);

          // Update local unread count
          setConversations(prev =>
            prev.map((c) => (getId(c) === conversationId ? { ...c, unreadCount: 0 } : c))
          );
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };

      fetchMessages();
    }
  }, [selectedConvo]);

  // Utility functions
  const getId = (obj) => String(obj?._id || obj?.id || '');

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConvo) return;

    try {
      const conversationId = getId(selectedConvo);
      
      if (!conversationId) {
        console.error('No valid conversation ID found for sending message');
        return;
      }
      
      // Create optimistic message for immediate UI update
      const optimisticMessage = {
        _id: 'temp-' + Date.now(),
        conversationId: conversationId,
        sender: 'agent',
        text: messageInput,
        timestamp: new Date(),
        status: 'sent'
      };
      
      // Add message to UI immediately
      setMessages(prev => [...prev, optimisticMessage]);
      const messageText = messageInput;
      setMessageInput('');
      
      // Send message via backend API
      const result = await whatsappService.sendMessage(
        selectedConvo.contactPhone,
        messageText,
        conversationId
      );
      
      if (result.success) {
        // Replace optimistic message with real message from server
        setMessages(prev => prev.map(msg => 
          msg._id === optimisticMessage._id ? result.message : msg
        ));
        console.log('✅ Message sent successfully:', result.message);
      } else {
        // Remove optimistic message and show error
        setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
        console.error('❌ Failed to send message:', result.error);
        setMessageInput(messageText); // Restore message text
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg._id && msg._id.startsWith('temp-')));
    }
  };

  // Contact editing functions
  const handleEditContact = (contact) => {
    setEditingContact({ ...contact });
    setShowContactEditModal(true);
  };

  const handleSaveContact = async () => {
    if (!editingContact || !editingContact.id) {
      console.error('No contact selected for editing');
      return;
    }
    
    try {
      const result = await whatsappService.updateContact(editingContact.id, editingContact);
      if (result.success) {
        setContacts(prev => prev.map(c => c.id === editingContact.id ? editingContact : c));
        setShowContactEditModal(false);
        setEditingContact(null);
      } else {
        console.error('Failed to update contact:', result.error);
      }
    } catch (error) {
      console.error('Error updating contact:', error);
    }
  };

  const handleMessageContact = async (contact) => {
    try {
      // Try to find existing conversation for this contact
      const conversationsData = await whatsappService.getConversations();
      const conversation = conversationsData.find(c => 
        c.contactPhone === contact.phone || c.contactId === contact.id
      );
      
      if (!conversation) {
        // Create new conversation if none exists
        const createResult = await whatsappService.createConversation({
          contactId: contact.id,
          contactPhone: contact.phone,
          contactName: contact.name,
          status: 'active'
        });
        
        if (createResult.success) {
          conversation = createResult;
        }
      }
      
      // Switch to inbox tab and select conversation
      if (conversation) {
        setActiveTab('inbox');
        setSelectedConvo(conversation);
      }
    } catch (error) {
      console.error('Error navigating to contact chat:', error);
    }
  };

  const handleCancelEdit = () => {
    setShowContactEditModal(false);
    setEditingContact(null);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered': return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read': return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const messageDate = new Date(date);
    const diff = now - messageDate;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading WhatsApp Business Platform...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderInbox = () => (
    <div className="flex h-full">
      {/* Conversations List */}
      <div className="w-96 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.filter(c => 
            (c.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.contactPhone || '').includes(searchTerm)
          ).map(convo => (
            <div
              key={convo._id || convo.id || Math.random().toString(36)}
              onClick={() => setSelectedConvo(convo)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedConvo?._id === convo._id ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">
                    {convo.contactName ? convo.contactName.split(' ').map(n => n[0]).join('') : convo.contactPhone.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 truncate">{convo.contactName || convo.contactPhone}</h3>
                      <span className="text-xs text-gray-500">
                        {convo.lastMessageTime ? formatTime(new Date(convo.lastMessageTime)) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{convo.lastMessage || 'No messages'}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">Assigned to: {convo.assignedTo || 'Unassigned'}</span>
                      {convo.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedConvo ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">
                        {selectedConvo.contactName ? selectedConvo.contactName.split(' ').map(n => n[0]).join('') : selectedConvo.contactPhone.slice(-2)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedConvo.contactName || selectedConvo.contactPhone}</h2>
                    <p className="text-sm text-gray-500">{selectedConvo.contactPhone}</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg._id}
                  className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-2 rounded-lg ${
                      msg.sender === 'agent'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      <span className="text-xs opacity-70">{formatTime(new Date(msg.timestamp))}</span>
                      {msg.sender === 'agent' && getStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Smile className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={handleSendMessage}
                  className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderContacts = () => (
    <div className="p-6 bg-white h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
        <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
          Add Contact
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {contacts.map(contact => (
              <tr key={contact.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold mr-3">
                      {(contact.name || 'Unknown').split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-medium text-gray-900">{contact.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{contact.phone}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {contact.tags?.map(tag => (
                      <span key={tag} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{formatTime(contact.lastContact)}</td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => handleEditContact(contact)}
                    className="text-blue-600 hover:text-blue-700 mr-3"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleMessageContact(contact)}
                    className="text-green-600 hover:text-green-700"
                  >
                    Message
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBroadcast = () => (
    <div className="p-6 bg-white h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Broadcast Messages</h2>
        <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
          New Broadcast
        </button>
      </div>

      <div className="grid gap-4">
        {broadcasts.map(broadcast => (
          <div key={broadcast.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{broadcast.name}</h3>
                <p className="text-gray-600 mt-1">{broadcast.message}</p>
                <p className="text-sm text-gray-500 mt-2">Created {formatTime(broadcast.createdAt)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                broadcast.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {broadcast.status}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{broadcast.recipients}</div>
                <div className="text-sm text-gray-500">Recipients</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{broadcast.sent}</div>
                <div className="text-sm text-gray-500">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{broadcast.delivered}</div>
                <div className="text-sm text-gray-500">Delivered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{broadcast.read}</div>
                <div className="text-sm text-gray-500">Read</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{broadcast.replied}</div>
                <div className="text-sm text-gray-500">Replied</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="p-6 bg-gray-50 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Total Conversations</div>
          <div className="text-3xl font-bold text-gray-900">{analytics?.totalConversations}</div>
          <div className="text-sm text-green-600 mt-2">↑ 12% from last week</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Active Now</div>
          <div className="text-3xl font-bold text-gray-900">{analytics?.activeConversations}</div>
          <div className="text-sm text-green-600 mt-2">↑ 8% from last week</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Avg Response Time</div>
          <div className="text-3xl font-bold text-gray-900">{analytics?.avgResponseTime}</div>
          <div className="text-sm text-green-600 mt-2">↓ 15% from last week</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Response Rate</div>
          <div className="text-3xl font-bold text-gray-900">{analytics?.responseRate}%</div>
          <div className="text-sm text-green-600 mt-2">↑ 3% from last week</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Conversation Trend (Last 7 Days)</h3>
          <div className="flex items-end justify-between h-48 space-x-2">
            {analytics?.conversationTrend?.map((value, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-green-500 rounded-t"
                  style={{ height: `${(value / 80) * 100}%` }}
                />
                <span className="text-xs text-gray-500 mt-2">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Message Statistics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Messages Sent</span>
                <span className="font-semibold">{analytics?.messagesSent}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Messages Received</span>
                <span className="font-semibold">{analytics?.messagesReceived}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer Satisfaction</span>
                <span className="font-semibold text-yellow-600">★ {analytics?.customerSatisfaction}/5.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Contact Edit Modal
  const ContactEditModal = () => {
    if (!showContactEditModal || !editingContact) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <h3 className="text-lg font-semibold mb-4">Edit Contact</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={editingContact.name || ''}
                onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={editingContact.phone || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={editingContact.email || ''}
                onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={editingContact.tags ? editingContact.tags.join(', ') : ''}
                onChange={(e) => setEditingContact({ 
                  ...editingContact, 
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveContact}
              disabled={!editingContact || !editingContact.id}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-8 h-8" />
          <h1 className="text-xl font-bold">WhatsApp Business Platform</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm">{connectedUsers.length} team members online</span>
          </div>
          <button className="p-2 hover:bg-green-700 rounded-lg relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div className="w-8 h-8 rounded-full bg-green-800 flex items-center justify-center font-semibold">
            Y
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex space-x-1 p-2 overflow-x-auto">
          {[
            { id: 'inbox', icon: MessageSquare, label: 'Inbox' },
            { id: 'contacts', icon: Users, label: 'Contacts' },
            { id: 'bulk', icon: Mail, label: 'Bulk Messaging' },
            { id: 'templates', icon: FileText, label: 'Templates' },
            { id: 'broadcast', icon: Radio, label: 'Broadcast' },
            { id: 'analytics', icon: BarChart3, label: 'Dashboard' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-green-50 text-green-600 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'inbox' && renderInbox()}
        {activeTab === 'contacts' && renderContacts()}
        {activeTab === 'bulk' && <BulkMessaging />}
        {activeTab === 'templates' && <TemplateManagement />}
        {activeTab === 'broadcast' && renderBroadcast()}
        {activeTab === 'analytics' && renderAnalytics()}
      </div>
      
      {/* Contact Edit Modal */}
      <ContactEditModal />
    </div>
  );
};

export default WhatsAppBusinessPlatform;
