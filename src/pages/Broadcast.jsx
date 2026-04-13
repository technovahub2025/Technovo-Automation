import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { apiClient } from '../services/whatsappapi';
import { useBroadcast, useCampaignAutomation } from '../hooks/useBroadcast';

// Import components
import BroadcastHeader from '../components/broadcastComponents/BroadcastHeader';
import DateRangeFilter from '../components/broadcastComponents/DateRangeFilter';
import OverviewStats from '../components/broadcastComponents/OverviewStats';

import { getCachedOverviewStats } from '../utils/stableBroadcastStats';

import BroadcastListControls from '../components/broadcastComponents/BroadcastListControls';
import BroadcastTable from '../components/broadcastComponents/BroadcastTable';
import ScheduleForm from '../components/broadcastComponents/ScheduleForm';
import DeleteModal from '../components/broadcastComponents/DeleteModal';
import BroadcastTypeChoice from '../components/broadcastComponents/BroadcastTypeChoice';
import NewBroadcastPopup from '../components/broadcastComponents/NewBroadcastPopup';


import AllCampaignsPopup from '../components/broadcastComponents/AllCampaignsPopup';

// Import existing components
import CampaignResultsModal from '../components/broadcastComponents/CampaignResultsModal';
import BroadcastResultsPopup from '../components/broadcastComponents/BroadcastResultsPopup';
import BroadcastAnalyticsModal from '../components/broadcastComponents/BroadcastAnalyticsModal';
import BroadcastAudienceValidationModal from '../components/broadcastComponents/BroadcastAudienceValidationModal';
import OutboundDialer from '../components/outbound/OutboundDialer';
import { stripAppRouteBase } from '../utils/appRouteBase';

// Import styles
import '../styles/whatsapp.css';
import '../styles/message-preview.css';
import '../styles/broadcast-list-controls.css';



const Broadcast = ({ composerMode = false, composerType = null, chooserMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = stripAppRouteBase(location.pathname);

  const {

    // State

    activeTab, setActiveTab,
    messageType, setMessageType,
    officialTemplates,
    templates,
    templateName, setTemplateName,
    language, setLanguage,

    templateFilter, setTemplateFilter,

    broadcasts,

    recipients, setRecipients,

    uploadedFile, setUploadedFile,

    isSending, setIsSending,

    sendResults, setSendResults,

    showResultsPopup, setShowResultsPopup,

    showNewBroadcastPopup, setShowNewBroadcastPopup,

    showBroadcastTypeChoice, setShowBroadcastTypeChoice,


    customMessage, setCustomMessage,

    scheduledTime, setScheduledTime,

    selectedCampaigns, setSelectedCampaigns,

    showDropdown, setShowDropdown,

    showDeleteModal, setShowDeleteModal,

    selectionMode, setSelectionMode,

    lastUpdated,

    searchTerm, setSearchTerm,

    statusFilter, setStatusFilter,

    sortBy, setSortBy,

    sortOrder, setSortOrder,

    showFilterDropdown, setShowFilterDropdown,

    dateFilter, setDateFilter,

    startDate, setStartDate,

    endDate, setEndDate,

    selectedPeriod, setSelectedPeriod,

    templateVariables, setTemplateVariables,

    fileVariables, setFileVariables,

    selectedLocalTemplate, setSelectedLocalTemplate,

    broadcastName, setBroadcastName,



    // Functions

    loadTemplates,

    loadBroadcasts,

    formatLastUpdated,

    getSuccessPercentage,

    getReadPercentage,

    getRepliedPercentage,

    getSortByLabel,

    getStatusClass,

    extractTemplateVariables,

    getFilteredAndSortedBroadcasts,

    downloadAllCampaigns

  } = useBroadcast();

  useEffect(() => {
    if (composerMode) {
      setActiveTab('schedule');
    }
  }, [composerMode, setActiveTab]);

  useEffect(() => {
    if (chooserMode) {
      setShowBroadcastTypeChoice(true);
      setActiveTab('overview');
    }
  }, [chooserMode, setShowBroadcastTypeChoice, setActiveTab]);

  useEffect(() => {
    if (!composerMode) return;
    if (composerType === 'custom') {
      setMessageType('text');
      return;
    }
    if (composerType === 'template') {
      setMessageType('template');
    }
  }, [composerMode, composerType, setMessageType]);

  useEffect(() => {
    if (currentPath === '/broadcast') {
      setActiveTab('overview');
      setShowBroadcastTypeChoice(false);
      setShowNewBroadcastPopup(false);
    }
  }, [currentPath, setActiveTab, setShowBroadcastTypeChoice, setShowNewBroadcastPopup]);



  // Additional state for pagination

  const [currentPage, setCurrentPage] = useState(1);

  const [itemsPerPage] = useState(5);

  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [audienceValidationModalOpen, setAudienceValidationModalOpen] = useState(false);
  const [pendingAudienceValidation, setPendingAudienceValidation] = useState(null);
  const [broadcastMode, setBroadcastMode] = useState('whatsapp');
  const [outboundPhaseTab, setOutboundPhaseTab] = useState('quick');
  const broadcastSubmitInFlightRef = useRef(false);
  const {
    scheduleLoading,
    retryLoading,
    abTestLoading,
    rotationLoading,
    scheduleResponse, 
    retryStats,
    abTestResults,
    rotationStats,
    error: automationError,
    scheduleCampaign,
    triggerRetry,
    createABTest,
    loadRotationStats
  } = useCampaignAutomation();

  const extractTemplateBody = (template) => {
    if (!template || typeof template !== 'object') return '';

    if (typeof template.templateContent === 'string' && template.templateContent.trim()) {
      return template.templateContent.trim();
    }

    if (typeof template.content === 'string' && template.content.trim()) {
      return template.content.trim();
    }

    if (template.content && typeof template.content === 'object') {
      if (typeof template.content.body === 'string' && template.content.body.trim()) {
        return template.content.body.trim();
      }
      if (typeof template.content.text === 'string' && template.content.text.trim()) {
        return template.content.text.trim();
      }
    }

    if (Array.isArray(template.components)) {
      const bodyComponent = template.components.find((comp) => {
        const type = String(comp?.type || '').toUpperCase();
        return type === 'BODY' || type === 'body';
      });
      if (typeof bodyComponent?.text === 'string' && bodyComponent.text.trim()) {
        return bodyComponent.text.trim();
      }
    }

    return '';
  };



  // Get filtered and sorted broadcasts

  const filteredBroadcasts = getFilteredAndSortedBroadcasts();



  // Show only 5 recent campaigns by default

  const displayBroadcasts = filteredBroadcasts.slice(0, 5);



  const indexOfLastItem = currentPage * itemsPerPage;

  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const currentBroadcasts = displayBroadcasts;

  const totalPages = Math.ceil(displayBroadcasts.length / itemsPerPage);



  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const stats = getCachedOverviewStats(broadcasts);



  // Filter templates by category

  const filteredTemplates = officialTemplates.filter(template =>

    templateFilter === 'all' || template.category?.toLowerCase() === templateFilter.toLowerCase()

  );



  // Event handlers

  const handleDropdownToggle = (campaignId, event) => {

    event.stopPropagation();

    setShowDropdown(showDropdown === campaignId ? null : campaignId);

  };



  const handleSelectCampaign = () => {

    setSelectionMode(true);

    setSelectedCampaigns([]);

    setShowDropdown(null);

  };



  const handleExitSelectionMode = () => {

    setSelectionMode(false);

    setSelectedCampaigns([]);

  };



  const handleCheckboxChange = (campaignId, event) => {

    event.stopPropagation();

    if (event.target.checked) {

      setSelectedCampaigns((prev) => [...prev, campaignId]);

    } else {

      setSelectedCampaigns((prev) => prev.filter((id) => id !== campaignId));

    }

  };



  const handleSelectAll = (event) => {

    if (event.target.checked) {

      const allIds = currentBroadcasts.map((b) => b._id);

      setSelectedCampaigns(allIds);

    } else {

      setSelectedCampaigns([]);

    }

  };



  const handleDeleteClick = (campaign) => {

    setSelectedCampaigns([campaign._id]);

    setShowDeleteModal(true);

    setShowDropdown(null);

  };



  const handleBulkDelete = () => {

    if (selectedCampaigns.length === 0) return;

    setShowDeleteModal(true);

  };



  const handleDeleteConfirm = async () => {

    if (selectedCampaigns.length === 0) return;



    try {

      await Promise.all(selectedCampaigns.map((id) => apiClient.deleteBroadcast(id)));

      await loadBroadcasts();



      setShowDeleteModal(false);

      setSelectedCampaigns([]);

      setSelectionMode(false);

    } catch (error) {

      console.error('Failed to delete campaigns:', error);

      alert('Failed to delete campaigns. Please try again.');

    }

  };



  const handleDeleteCancel = () => {

    setShowDeleteModal(false);

  };



  const handleLocalTemplateSelect = (templateName) => {

    setSelectedLocalTemplate(templateName);



    if (templateName) {

      const selectedTemplate = templates.find(t => t.name === templateName);

      if (selectedTemplate) {

        let contentString = '';

        if (typeof selectedTemplate.content === 'string') {

          contentString = selectedTemplate.content;

        } else if (selectedTemplate.content && selectedTemplate.content.body) {

          contentString = selectedTemplate.content.body;

        } else if (selectedTemplate.components) {

          const bodyComponent = selectedTemplate.components.find(comp => comp.type === 'BODY');

          if (bodyComponent && bodyComponent.text) {

            contentString = bodyComponent.text;

          }

        }



        setCustomMessage(contentString);

        extractTemplateVariables(contentString);

      }

    } else {

      setCustomMessage('');

      setTemplateVariables([]);

    }

  };



  const handleTemplateNameChange = (e) => {

    const selectedTemplateName = e.target.value;

    setTemplateName(selectedTemplateName);



    const selectedTemplate = officialTemplates.find(t => t.name === selectedTemplateName);

    if (selectedTemplate) {

      setLanguage(selectedTemplate.language || 'en_US');



      if (selectedTemplate.content?.body) {

        extractTemplateVariables(selectedTemplate.content.body);

      } else if (selectedTemplate.components) {

        const bodyComponent = selectedTemplate.components.find(

          comp => comp.type === 'BODY' && comp.text

        );

        if (bodyComponent) {

          extractTemplateVariables(bodyComponent.text);

        }

      }

    } else {

      setTemplateVariables([]);

      setLanguage('en_US');

    }

  };



  const handleFileUpload = async (event) => {

    const file = event.target.files?.[0];

    if (!file) return;



    setUploadedFile(file);



    const reader = new FileReader();

    reader.onload = async (e) => {

      const base64Data = e.target.result.split(',')[1];



      try {

        const result = await apiClient.uploadCSV({ csvData: base64Data });



        if (result.data.success) {

          const recipientsWithFullData = result.data.csvData || result.data.recipients || [];

          setRecipients(recipientsWithFullData);



          if (recipientsWithFullData.length > 0) {

            const firstRecipient = recipientsWithFullData[0];

            const fileVarKeys = Object.keys(firstRecipient).filter(

              (key) => key.toLowerCase().startsWith('var') && firstRecipient[key] != null

            );



            setFileVariables(fileVarKeys);




          }

        } else {

          alert('Failed to process CSV: ' + (result.data.error || result.data.message));

        }

      } catch (error) {

        alert('Failed to upload CSV: ' + error.message);

      }

    };



    reader.readAsDataURL(file);

  };



  const handleClearUpload = () => {

    setUploadedFile(null);

    setRecipients([]);

    setFileVariables([]);




    const fileInput = document.getElementById('csv-file-popup');

    if (fileInput) {

      fileInput.value = '';

    }

  };

  const buildProcessedRecipients = () =>
    recipients.map((recipient) => ({
      phone: recipient.phone,
      variables: recipient.variables || [],
      data: recipient.data || recipient.fullData || recipient
    }));

  const validateAudienceOrAbort = async ({ recipientsPayload, selectedTemplate }) => {
    const templateCategory =
      messageType === 'template'
        ? String(selectedTemplate?.category || '').trim().toLowerCase()
        : '';

    const validationResponse = await apiClient.validateBroadcastAudience({
      recipients: recipientsPayload,
      messageType,
      templateCategory
    });

    const validation =
      validationResponse?.data?.data || validationResponse?.data || null;

    return {
      templateCategory,
      validation
    };
  };

  const openAudienceValidationModal = (validationResult) => {
    setPendingAudienceValidation(validationResult);
    setAudienceValidationModalOpen(true);
  };

  const closeAudienceValidationModal = () => {
    setAudienceValidationModalOpen(false);
    setPendingAudienceValidation(null);
  };



  const createBroadcast = async () => {
    if (broadcastSubmitInFlightRef.current) {
      console.warn('Duplicate schedule click blocked (request already in flight)');
      return;
    }

    console.log('🔍 createBroadcast called');
    console.log('🔍 broadcastName:', broadcastName);
    console.log('🔍 recipients.length:', recipients.length);
    console.log('🔍 scheduledTime:', scheduledTime);
    console.log('🔍 messageType:', messageType);

    if (!broadcastName || !recipients.length) {

      console.log('❌ Validation failed - missing broadcastName or recipients');
      alert('Please provide a campaign name and upload recipients');

      return;

    }



    try {

      const healthCheck = await apiClient.healthCheck();

      console.log('✅ Backend health check passed');

    } catch (error) {

      console.error('❌ Backend health check failed:', error);

      alert('Backend server is not responding. Please check if the server is running on localhost:3001');

      return;

    }



    let templateContent = '';
    let selectedTemplate = null;

    if (messageType === 'template') {

      if (!templateName) {

        alert('Please select a template');

        return;

      }



      selectedTemplate = officialTemplates.find(t => t.name === templateName);

      if (!selectedTemplate) {

        alert('Template not found. Please sync templates and try again.');

        return;

      }

      // Extract template content for storing in broadcast
      templateContent = extractTemplateBody(selectedTemplate);



      const approvedStatuses = ['APPROVED', 'approved', 'ACTIVE', 'active'];

      if (!approvedStatuses.includes(selectedTemplate.status)) {

        console.warn(`⚠️ Template "${templateName}" has status "${selectedTemplate.status}". Proceeding anyway...`);

      }



      if (!language) {

        alert('Template language not set. Please select the template again.');

        return;

      }

    }



    try {
      broadcastSubmitInFlightRef.current = true;
      setIsSending(true);
      const processedRecipients = buildProcessedRecipients();
      const audienceValidation = await validateAudienceOrAbort({
        recipientsPayload: processedRecipients,
        selectedTemplate
      });
      if (!audienceValidation) {
        return;
      }
      if (!audienceValidation.validation?.canProceed || Number(audienceValidation.validation?.summary?.invalid || 0) > 0) {
        openAudienceValidationModal(audienceValidation);
        return;
      }

      const payload = {

        name: broadcastName,

        messageType,

        recipients: audienceValidation.validation?.eligibleRecipients || processedRecipients,

        ...(messageType === 'template' ? {

          templateName,

          language,

          templateContent,
          templateCategory: audienceValidation.templateCategory,

          templateParameters: templateVariables.map((variable, index) => ({

            type: 'text',

            text: `Parameter ${index + 1}` // Default value, should be replaced with actual data

          }))

        } : { customMessage }),

        ...(scheduledTime ? { 
          scheduledAt: new Date(scheduledTime).toISOString() 
        } : {}),

      };



      console.log('🚀 Sending broadcast payload:', payload);



      const result = await apiClient.createBroadcast(payload);



      if (result.data.success) {

        alert(scheduledTime ? 'Broadcast scheduled successfully!' : 'Broadcast created successfully!');

        await loadBroadcasts();



        setBroadcastName('');

        setTemplateName('');

        setCustomMessage('');

        setScheduledTime('');

        setUploadedFile(null);

        setRecipients([]);

        setFileVariables([]);



        setShowNewBroadcastPopup(false);

        if (composerMode) {
          navigate('/broadcast');
        } else {
          setActiveTab('overview');
        }

      } else {

        alert('Failed: ' + (result.data.error || result.data.message));

      }

    } catch (error) {

      console.error('Broadcast creation error:', error);

      alert('Failed to create broadcast: ' + error.message);

    } finally {
      broadcastSubmitInFlightRef.current = false;
      setIsSending(false);
    }

  };



  const handleSendBroadcast = async () => {
    if (broadcastSubmitInFlightRef.current) {
      console.warn('Duplicate send click blocked (request already in flight)');
      return;
    }

    if (!broadcastName || !broadcastName.trim()) {

      alert('Please provide a campaign name');

      return;

    }

    if (!recipients.length) {

      alert('Please upload a CSV file with recipients');

      return;

    }



    try {

      const healthCheck = await apiClient.healthCheck();

      console.log('✅ Backend health check passed');

    } catch (error) {

      console.error('❌ Backend health check failed:', error);

      alert('Backend server is not responding. Please check if the server is running on localhost:3001');

      return;

    }



    // Initialize templateContent with default value
    let templateContent = '';
    let selectedTemplate = null;

    if (messageType === 'template') {

      if (!templateName) {

        alert('Please select a template');

        return;

      }



      selectedTemplate = officialTemplates.find(t => t.name === templateName);



      if (!selectedTemplate) {

        alert('Template not found. Please sync templates and try again.');

        return;

      }

      // Extract template content for storing in broadcast
      templateContent = extractTemplateBody(selectedTemplate);


      const approvedStatuses = ['APPROVED', 'approved', 'ACTIVE', 'active'];

      if (!approvedStatuses.includes(selectedTemplate.status)) {

        console.warn(`⚠️ Template "${templateName}" has status "${selectedTemplate.status}". Proceeding anyway...`);

      }



      if (!language) {

        alert('Template language not set. Please select the template again.');

        return;

      }

    }



    broadcastSubmitInFlightRef.current = true;
    setIsSending(true);



    try {
      const processedRecipients = buildProcessedRecipients();
      const audienceValidation = await validateAudienceOrAbort({
        recipientsPayload: processedRecipients,
        selectedTemplate
      });
      if (!audienceValidation) {
        return;
      }
      if (!audienceValidation.validation?.canProceed || Number(audienceValidation.validation?.summary?.invalid || 0) > 0) {
        openAudienceValidationModal(audienceValidation);
        return;
      }



      const payload = {

        broadcast_name: broadcastName.trim(),

        messageType,

        recipients: audienceValidation.validation?.eligibleRecipients || processedRecipients,

        ...(messageType === 'template' ? { 
          templateName, 
          language,
          templateContent,
          templateCategory: audienceValidation.templateCategory
        } : { customMessage }),

      };



      console.log('🚀 Sending broadcast payload:', payload);



      const result = await apiClient.sendBulkMessages(payload);

      setSendResults(result.data);



      if (result.data.success) {

        setSendResults(result.data);

        setShowResultsPopup(true);

        await loadBroadcasts();



        setShowNewBroadcastPopup(false);



        setBroadcastName('');

        setTemplateName('');

        setCustomMessage('');

        setScheduledTime('');

        setMessageType('template');

        if (composerMode) {
          navigate('/broadcast');
        }

      } else {

        alert('Failed to send: ' + (result.data.error || result.data.message));

      }

    } catch (error) {

      console.error('Broadcast send error:', error);

      alert('Failed to send campaign: ' + error.message);

    } finally {

      broadcastSubmitInFlightRef.current = false;
      setIsSending(false);

    }

  };



  const executeBroadcast = async (broadcastId) => {

    try {

      const result = await apiClient.sendBroadcast(broadcastId);

      if (result.data.success) {

        alert('Broadcast sent successfully!');

        await loadBroadcasts();

      } else {

        alert('Failed to send broadcast: ' + (result.data.error || result.data.message));

      }

    } catch (error) {

      alert('Failed to send broadcast: ' + error.message);

    }

  };



  const stopBroadcast = async (broadcastId) => {

    try {

      const result = await apiClient.cancelBroadcast(broadcastId);

      if (result.data.success) {

        alert('Broadcast stopped successfully!');

        await loadBroadcasts();

      } else {

        alert('Failed to stop broadcast: ' + (result.data.error || result.data.message));

      }

    } catch (error) {

      alert('Failed to stop broadcast: ' + error.message);

    }

  };



  const syncBroadcastStats = async (broadcastId) => {

    try {

      await apiClient.syncBroadcastStats(broadcastId);

      await loadBroadcasts();

    } catch (error) {

      console.warn(`Failed to sync stats for ${broadcastId}`, error);

      throw error;

    }

  };



  const handleResultsPopupClose = () => {

    setShowResultsPopup(false);

    setActiveTab('overview');

    window.location.reload();

  };



  const handleChooseTemplate = () => {

    setMessageType('template');

    setShowBroadcastTypeChoice(false);

    navigate('/broadcast/new/template');

  };



  const handleChooseCustomMessage = () => {

    setMessageType('text');

    setShowBroadcastTypeChoice(false);

    navigate('/broadcast/new/message');

  };



  const getCurrentTime = () => {

    const now = new Date();

    return now.toLocaleTimeString('en-US', {

      hour: 'numeric',

      minute: '2-digit',

      hour12: true,

    });

  };



  const handleViewAnalytics = (broadcast) => {

    console.log('📊 View Analytics for broadcast:', broadcast.name);

    setSelectedBroadcast(broadcast);

    setShowAnalyticsModal(true);

  };

  const handleBackToOverview = () => {
    if (composerMode) {
      navigate('/broadcast');
      return;
    }
    setActiveTab('overview');
  };

  const resetComposerForm = () => {
    setBroadcastName('');
    setTemplateName('');
    setCustomMessage('');
    setScheduledTime('');
    setUploadedFile(null);
    setRecipients([]);
    setFileVariables([]);
    setTemplateVariables([]);
    setSelectedLocalTemplate('');
    setMessageType('template');
  };

  const buildBroadcastPayloadFromValidation = ({
    validationResult,
    recipientsPayload,
    selectedTemplate,
    mode
  }) => {
    const templateCategory = validationResult?.templateCategory || '';

    return {
      ...(mode === 'send'
        ? {
            broadcast_name: broadcastName.trim(),
            messageType,
            recipients: validationResult?.validation?.eligibleRecipients || recipientsPayload
          }
        : {
            name: broadcastName,
            messageType,
            recipients: validationResult?.validation?.eligibleRecipients || recipientsPayload
          }),
      ...(messageType === 'template'
        ? {
            templateName,
            language,
            templateContent: selectedTemplate ? extractTemplateBody(selectedTemplate) : '',
            templateCategory,
            ...(mode === 'create'
              ? {
                  templateParameters: templateVariables.map((variable, index) => ({
                    type: 'text',
                    text: `Parameter ${index + 1}`
                  }))
                }
              : {})
          }
        : mode === 'send'
          ? { customMessage }
          : { customMessage }),
      ...(mode === 'create' && scheduledTime
        ? { scheduledAt: new Date(scheduledTime).toISOString() }
        : {})
    };
  };

  const continueBroadcastWithEligibleRecipients = async () => {
    const validationResult = pendingAudienceValidation;
    if (!validationResult?.validation?.canProceed) {
      closeAudienceValidationModal();
      return;
    }

    const processedRecipients = buildProcessedRecipients();
    const selectedTemplate = messageType === 'template'
      ? officialTemplates.find((t) => t.name === templateName) || null
      : null;
    const mode = scheduledTime ? 'create' : 'send';
    const payload = buildBroadcastPayloadFromValidation({
      validationResult,
      recipientsPayload: processedRecipients,
      selectedTemplate,
      mode
    });

    closeAudienceValidationModal();

    try {
      if (mode === 'create') {
        const result = await apiClient.createBroadcast(payload);
        if (result.data.success) {
          alert(scheduledTime ? 'Broadcast scheduled successfully!' : 'Broadcast created successfully!');
          await loadBroadcasts();
          resetComposerForm();
          setShowNewBroadcastPopup(false);
          if (composerMode) navigate('/broadcast');
          else setActiveTab('overview');
          return;
        }
        alert('Failed: ' + (result.data.error || result.data.message));
        return;
      }

      const result = await apiClient.sendBulkMessages(payload);
      setSendResults(result.data);
      if (result.data.success) {
        setShowResultsPopup(true);
        await loadBroadcasts();
        setShowNewBroadcastPopup(false);
        resetComposerForm();
        if (composerMode) navigate('/broadcast');
        return;
      }
      alert('Failed to send: ' + (result.data.error || result.data.message));
    } catch (error) {
      console.error('Broadcast continue after validation error:', error);
      alert('Failed to continue broadcast: ' + error.message);
    } finally {
      broadcastSubmitInFlightRef.current = false;
      setIsSending(false);
    }
  };

  if (composerMode) {
    return (
      <div className="broadcast-page">
        <div className="page-header">
          <div>
            <h2>Create Broadcast Campaign</h2>
            <p>Compose, preview and send your WhatsApp broadcast from one page.</p>
          </div>
        </div>

        <ScheduleForm
          messageType={messageType}
          broadcastName={broadcastName}
          onBroadcastNameChange={(e) => setBroadcastName(e.target.value)}
          templateName={templateName}
          onTemplateNameChange={handleTemplateNameChange}
          templateFilter={templateFilter}
          onTemplateFilterChange={(value) => setTemplateFilter(value)}
          officialTemplates={officialTemplates}
          filteredTemplates={filteredTemplates}
          customMessage={customMessage}
          onCustomMessageChange={(e) => {
            if (e.target.value.length <= 1000) setCustomMessage(e.target.value);
          }}
          selectedLocalTemplate={selectedLocalTemplate}
          onLocalTemplateSelect={handleLocalTemplateSelect}
          templates={templates}
          onFileUpload={handleFileUpload}
          uploadedFile={uploadedFile}
          recipients={recipients}
          fileVariables={fileVariables}
          onClearUpload={handleClearUpload}
          scheduledTime={scheduledTime}
          onScheduledTimeChange={(e) => setScheduledTime(e.target.value)}
          isSending={isSending}
          onCreateBroadcast={createBroadcast}
          onSendBroadcast={handleSendBroadcast}
          sendResults={sendResults}
          onBackToOverview={handleBackToOverview}
          onResetForm={resetComposerForm}
        />
      </div>
    );
  }



  return (

    <div className="broadcast-page">
      <div className="template-pills">
        <button
          type="button"
          className={broadcastMode === 'whatsapp' ? 'pill active' : 'pill'}
          onClick={() => setBroadcastMode('whatsapp')}
        >
          WhatsApp Broadcast
        </button>
        <button
          type="button"
          className={broadcastMode === 'outbound-local' ? 'pill active' : 'pill'}
          onClick={() => setBroadcastMode('outbound-local')}
        >
          Outbound Voice
        </button>
      </div>

      {broadcastMode === 'outbound-local' ? (
        <>
          <div className="phase2-subtabs">
            <button
              type="button"
              className={outboundPhaseTab === 'quick' ? 'phase2-subtab active' : 'phase2-subtab'}
              onClick={() => setOutboundPhaseTab('quick')}
            >
              Quick
            </button>
            <button
              type="button"
              className={outboundPhaseTab === 'schedule' ? 'phase2-subtab active' : 'phase2-subtab'}
              onClick={() => setOutboundPhaseTab('schedule')}
            >
              Schedule
            </button>
            <button
              type="button"
              className={outboundPhaseTab === 'retry' ? 'phase2-subtab active' : 'phase2-subtab'}
              onClick={() => setOutboundPhaseTab('retry')}
            >
              Retry
            </button>
            <button
              type="button"
              className={outboundPhaseTab === 'abtest' ? 'phase2-subtab active' : 'phase2-subtab'}
              onClick={() => setOutboundPhaseTab('abtest')}
            >
              A/B
            </button>
          </div>

          {outboundPhaseTab === 'quick' && <OutboundDialer />}

          {outboundPhaseTab === 'schedule' && (
            <>
              <CampaignScheduler
                onSchedule={scheduleCampaign}
                loading={scheduleLoading}
                error={automationError}
                scheduleResponse={scheduleResponse}
              />
              <NumberRotation
                stats={rotationStats}
                loading={rotationLoading}
                onRefresh={loadRotationStats}
                error={automationError}
              />
            </>
          )}

          {outboundPhaseTab === 'retry' && (
            <RetryDashboard
              retryStats={retryStats}
              onRetry={triggerRetry}
              loading={retryLoading}
              error={automationError}
            />
          )}

          {outboundPhaseTab === 'abtest' && (
            <ABTestCreator
              onCreate={createABTest}
              loading={abTestLoading}
              results={abTestResults}
              error={automationError}
            />
          )}
        </>
      ) : (
        <>

      <BroadcastHeader

        activeTab={activeTab}

        onShowBroadcastTypeChoice={() => navigate('/broadcast/new')}

      />



      {activeTab === 'overview' && (

        <>

          <DateRangeFilter

            startDate={startDate}

            endDate={endDate}

            selectedPeriod={selectedPeriod}

            onStartDateChange={(e) => setStartDate(e.target.value)}

            onEndDateChange={(e) => setEndDate(e.target.value)}

            onPeriodChange={(e) => setSelectedPeriod(e.target.value)}

            onApplyFilter={() => setCurrentPage(1)}

            onExportCampaigns={() => downloadAllCampaigns(filteredBroadcasts)}

          />



          <OverviewStats stats={stats} />



          <div className="history-section">

            <BroadcastListControls

              searchTerm={searchTerm}

              onSearchChange={(e) => setSearchTerm(e.target.value)}

              statusFilter={statusFilter}

              onStatusFilterChange={(value) => setStatusFilter(value)}

              sortBy={sortBy}

              onSortByChange={(value) => setSortBy(value)}

              sortOrder={sortOrder}

              onSortOrderChange={(value) => setSortOrder(value)}

              onRefresh={() => loadBroadcasts()}

              totalBroadcasts={currentBroadcasts.length}

              lastUpdated={broadcasts.length > 0 ? Math.max(...broadcasts.map(b => new Date(b.updatedAt || b.createdAt))) : new Date()}

              formatLastUpdated={formatLastUpdated}

            />



            <BroadcastTable

              broadcasts={currentBroadcasts}

              selectionMode={selectionMode}

              selectedCampaigns={selectedCampaigns}

              onSelectAll={handleSelectAll}

              onCheckboxChange={handleCheckboxChange}

              getSuccessPercentage={getSuccessPercentage}

              getReadPercentage={getReadPercentage}

              getRepliedPercentage={getRepliedPercentage}

              getStatusClass={getStatusClass}

              onStopBroadcast={stopBroadcast}

              onDeleteClick={handleDeleteClick}

              onViewAnalytics={handleViewAnalytics}

            />

          </div>

        </>

      )}



      {activeTab === 'schedule' && (

        <ScheduleForm

          messageType={messageType}

          broadcastName={broadcastName}

          onBroadcastNameChange={(e) => setBroadcastName(e.target.value)}

          templateName={templateName}

          onTemplateNameChange={handleTemplateNameChange}

          templateFilter={templateFilter}

          onTemplateFilterChange={(value) => setTemplateFilter(value)}

          officialTemplates={officialTemplates}

          filteredTemplates={filteredTemplates}

          customMessage={customMessage}

          onCustomMessageChange={(e) => {

            if (e.target.value.length <= 1000) setCustomMessage(e.target.value);

          }}

          selectedLocalTemplate={selectedLocalTemplate}

          onLocalTemplateSelect={handleLocalTemplateSelect}

          templates={templates}

          onFileUpload={handleFileUpload}

          uploadedFile={uploadedFile}

          recipients={recipients}

          fileVariables={fileVariables}

          onClearUpload={handleClearUpload}

          scheduledTime={scheduledTime}

          onScheduledTimeChange={(e) => setScheduledTime(e.target.value)}

          isSending={isSending}

          onCreateBroadcast={createBroadcast}

          onSendBroadcast={handleSendBroadcast}

          sendResults={sendResults}

          onBackToOverview={handleBackToOverview}

          onResetForm={resetComposerForm}

        />

      )}



      <DeleteModal

        showDeleteModal={showDeleteModal}

        selectedCampaigns={selectedCampaigns}

        broadcasts={broadcasts}

        onDeleteConfirm={handleDeleteConfirm}

        onDeleteCancel={handleDeleteCancel}

      />



      <BroadcastResultsPopup

        isOpen={showResultsPopup}

        onClose={handleResultsPopupClose}

        results={sendResults}

        broadcastName={broadcastName}

        isSending={false}

      />



      <BroadcastTypeChoice

        showBroadcastTypeChoice={showBroadcastTypeChoice}

        onClose={() => {
          setShowBroadcastTypeChoice(false);
          if (chooserMode) navigate('/broadcast');
        }}

        onChooseTemplate={handleChooseTemplate}

        onChooseCustomMessage={handleChooseCustomMessage}

      />



      <NewBroadcastPopup

        showNewBroadcastPopup={showNewBroadcastPopup}

        broadcastName={broadcastName}

        onBroadcastNameChange={(e) => setBroadcastName(e.target.value)}

        messageType={messageType}

        templateName={templateName}

        onTemplateNameChange={handleTemplateNameChange}

        officialTemplates={officialTemplates}

        customMessage={customMessage}

        onCustomMessageChange={(e) => setCustomMessage(e.target.value)}

        uploadedFile={uploadedFile}

        recipients={recipients}

        onFileUpload={handleFileUpload}

        onClearUpload={handleClearUpload}

        scheduledTime={scheduledTime}

        onScheduledTimeChange={(value) => setScheduledTime(typeof value === 'string' ? value : value?.target?.value || '')}

        isSending={isSending}

        onCreateBroadcast={createBroadcast}

        onSendBroadcast={handleSendBroadcast}

        onClose={() => setShowNewBroadcastPopup(false)}

        onBackToChoice={() => {

          setShowNewBroadcastPopup(false);

          setShowBroadcastTypeChoice(true);

        }}

        getCurrentTime={getCurrentTime}

      />



      <AllCampaignsPopup
        showAllCampaignsPopup={false}
        broadcasts={broadcasts}
        filteredBroadcasts={filteredBroadcasts}
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => setStatusFilter(value)}
        showFilterDropdown={showFilterDropdown}
        onFilterDropdownToggle={() => setShowFilterDropdown(!showFilterDropdown)}
        onClose={() => { }}
        getReadPercentage={getReadPercentage}
        getStatusClass={getStatusClass}
        onStopBroadcast={stopBroadcast}
        onDeleteClick={handleDeleteClick}
      />

      <BroadcastAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        broadcast={selectedBroadcast}
      />
      <BroadcastAudienceValidationModal
        open={audienceValidationModalOpen}
        validation={pendingAudienceValidation?.validation || null}
        onClose={() => {
          closeAudienceValidationModal();
          broadcastSubmitInFlightRef.current = false;
          setIsSending(false);
        }}
        onProceed={continueBroadcastWithEligibleRecipients}
      />
      </>
      )}

    </div>
  );
};

export default Broadcast;



