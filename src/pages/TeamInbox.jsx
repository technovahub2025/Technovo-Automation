import React, { useState, useEffect, useRef } from 'react';

import { useLocation } from 'react-router-dom';

import { Search, Filter, Paperclip, Send, Smile, Phone, MoreVertical, Check, CheckCheck } from 'lucide-react';

import './TeamInbox.css';

import { whatsappService } from '../services/whatsappService';

import webSocketService from '../services/websocketService';



const TeamInbox = () => {

  const location = useLocation();

  const [conversations, setConversations] = useState([]);

  const [selectedConversation, setSelectedConversation] = useState(null);

  const [messages, setMessages] = useState([]);

  const [messageInput, setMessageInput] = useState('');

  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  const [wsConnected, setWsConnected] = useState(false);

  const [showSelectMenu, setShowSelectMenu] = useState(false);

  const [selectedForDeletion, setSelectedForDeletion] = useState([]);

  const [showSelectMode, setShowSelectMode] = useState(false);

  const [showMessageSelectMenu, setShowMessageSelectMenu] = useState(false);

  const [showMessageSelectMode, setShowMessageSelectMode] = useState(false);

  const [selectedMessagesForDeletion, setSelectedMessagesForDeletion] = useState([]);

  const messagesEndRef = useRef(null);



  // Initialize WebSocket connection

  useEffect(() => {

    const handleConnect = () => {

      setWsConnected(true);

      console.log('✅ WebSocket connected in TeamInbox');

    };



    const handleDisconnect = () => {

      setWsConnected(false);

      console.log('❌ WebSocket disconnected in TeamInbox');

    };



    const handleNewMessage = (data) => {

      console.log('📨 New message received:', data);

      

      // Update conversations list

      setConversations(prev => {

        const updated = prev.map(conv => 

          conv._id === data.conversation._id ? data.conversation : conv

        );

        

        // If conversation doesn't exist, add it

        if (!updated.find(conv => conv._id === data.conversation._id)) {

          updated.unshift(data.conversation);

        }

        

        return updated.sort((a, b) => 

          new Date(b.lastMessageTime) - new Date(a.lastMessageTime)

        );

      });



      // Update messages if this conversation is selected

      if (selectedConversation && selectedConversation._id === data.conversation._id) {

        setMessages(prev => [...prev, data.message]);

      }

    };



    const handleMessageSent = (data) => {

      console.log('📤 Message sent confirmation:', data);

      

      if (selectedConversation && selectedConversation._id === data.message.conversationId) {

        setMessages(prev => [...prev, data.message]);

      }

    };



    const handleMessageStatus = (data) => {

      console.log('📊 Message status update:', data);

      

      // Update message status in the current conversation

      setMessages(prev => 

        prev.map(msg => 

          msg.whatsappMessageId === data.messageId 

            ? { ...msg, status: data.status }

            : msg

        )

      );

    };



    // Connect to WebSocket

    webSocketService.connect();

    webSocketService.on('connected', handleConnect);

    webSocketService.on('disconnected', handleDisconnect);

    webSocketService.on('newMessage', handleNewMessage);

    webSocketService.on('messageSent', handleMessageSent);

    webSocketService.on('messageStatus', handleMessageStatus);



    return () => {

      webSocketService.off('connected', handleConnect);

      webSocketService.off('disconnected', handleDisconnect);

      webSocketService.off('newMessage', handleNewMessage);

      webSocketService.off('messageSent', handleMessageSent);

      webSocketService.off('messageStatus', handleMessageStatus);

    };

  }, [selectedConversation]);



  // Load conversations on component mount

  useEffect(() => {

    loadConversations();

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

      loadMessages(selectedConversation._id);

    }

  }, [selectedConversation]);



  // Auto-scroll to bottom when new messages arrive

  useEffect(() => {

    scrollToBottom();

  }, [messages]);



  const loadConversations = async () => {

    try {

      setLoading(true);

      const data = await whatsappService.getConversations();

      setConversations(data);

    } catch (error) {

      console.error('Failed to load conversations:', error);

    } finally {

      setLoading(false);

    }

  };



  const loadMessages = async (conversationId) => {

    try {

      const data = await whatsappService.getMessages(conversationId);

      setMessages(data);

    } catch (error) {

      console.error('Failed to load messages:', error);

    }

  };



  const sendMessage = async () => {

    if (!messageInput.trim() || !selectedConversation) return;



    try {

      const result = await whatsappService.sendMessage(

        selectedConversation.contactPhone,

        messageInput,

        selectedConversation._id

      );



      if (result.success) {

        setMessageInput('');

        // Message will be added via WebSocket event

      } else {

        console.error('Failed to send message:', result.error);

      }

    } catch (error) {

      console.error('Error sending message:', error);

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



  const scrollToBottom = () => {

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  };



  const deleteCurrentConversation = async () => {

    if (!selectedConversation) return;

    

    if (window.confirm(`Are you sure you want to delete this conversation with ${selectedConversation.contactId?.name || selectedConversation.contactPhone}?`)) {

      try {

        await whatsappService.deleteConversation(selectedConversation._id);

        setConversations(prev => prev.filter(conv => conv._id !== selectedConversation._id));

        setSelectedConversation(null);

        setMessages([]);

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

        await whatsappService.deleteSelectedMessages(selectedMessagesForDeletion);

        setMessages(prev => prev.filter(msg => !selectedMessagesForDeletion.includes(msg._id)));

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

    switch (status) {

      case 'sent':

        return <Check size={16} className="text-gray-400" />;

      case 'delivered':

        return <CheckCheck size={16} className="text-gray-400" />;

      case 'read':

        return <CheckCheck size={16} className="text-blue-500" />;

      case 'failed':

        return <span className="text-red-500">✗</span>;

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



  const filteredConversations = conversations.filter(conv =>

    conv.contactId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||

    conv.contactPhone?.includes(searchTerm) ||

    conv.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())

  );



  return (

    <div className="inbox-container">

      <div className="inbox-sidebar">

        <div className="inbox-header">

          <h2>Team Inbox</h2>

          <div className="inbox-actions">

            <div className={`connection-indicator ${wsConnected ? 'connected' : 'disconnected'}`} />

            <button className="icon-btn"><Filter size={18} /></button>

            <div className="inbox-header-menu">

              <button className="icon-btn" onClick={() => setShowSelectMenu(!showSelectMenu)}><MoreVertical size={18} /></button>

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

                      if (conversation.unreadCount > 0) {

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

                      {conversation.unreadCount > 0 && (

                        <span className="unread-badge">{conversation.unreadCount}</span>

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

                <button className="resolve-btn" onClick={deleteCurrentConversation}>Resolve</button>

                <div className="chat-header-menu">

                  <button className="icon-btn text-white" onClick={() => setShowMessageSelectMenu(!showMessageSelectMenu)}><MoreVertical size={18} /></button>

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

                    </div>

                  )}

                </div>

              </div>

            </div>



            <div className="chat-messages">

              {showMessageSelectMode && (

                <div className="message-selection-actions">

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

              {messages.map((message, index) => (

                <div

                  key={message._id || index}

                  className={`message ${message.sender === 'agent' ? 'outgoing' : 'incoming'} ${showMessageSelectMode ? 'select-mode' : ''}`}

                  onClick={() => {

                    if (showMessageSelectMode) {

                      toggleMessageSelection(message._id || index);

                    }

                  }}

                >

                  {showMessageSelectMode && (

                    <div className="message-select-checkbox">

                      <input

                        type="checkbox"

                        checked={selectedMessagesForDeletion.includes(message._id || index)}

                        onChange={() => toggleMessageSelection(message._id || index)}

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

                      {formatTime(message.timestamp)}

                    </span>

                    {message.sender === 'agent' && getStatusIcon(message.status)}

                  </div>

                </div>

              ))}

              <div ref={messagesEndRef} />

            </div>



            <div className="chat-input-area">

              <button className="attach-btn"><Paperclip size={20} /></button>

              <input

                type="text"

                placeholder="Type a message..."

                value={messageInput}

                onChange={(e) => setMessageInput(e.target.value)}

                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}

              />

              <button className="emoji-btn"><Smile size={20} /></button>

              <button 

                className="send-btn" 

                onClick={sendMessage}

                disabled={!messageInput.trim()}

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

      </div>

    </div>

  );

};



export default TeamInbox;

