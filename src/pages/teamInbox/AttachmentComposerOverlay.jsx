import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileText,
  Pencil,
  Plus,
  RotateCw,
  Send,
  Smile,
  Sparkles,
  Square,
  Undo2,
  X
} from 'lucide-react';
import {
  applyCropToImageFile,
  applyDrawStrokeToImageFile,
  applyPixelateToImageFile,
  applyRotationToImageFile,
  applyTextToImageFile,
  buildAttachmentComposerItemId,
  formatDraftAttachmentSize,
  getDraftAttachmentExtension,
  inferAttachmentComposerMediaType,
  isSupportedAttachmentComposerFile
} from './attachmentComposerUtils';

const DRAW_COLORS = ['#202c33', '#9ca3af', '#ffffff', '#4FC3F7', '#66BB6A', '#BB6BD9', '#F2994A', '#FF5252'];
const DEFAULT_DRAW_COLOR = DRAW_COLORS[0];
const DEFAULT_TEXT_SIZE = 34;
const MIN_SELECTION_SIZE = 12;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getNormalizedRect = (start = null, end = null) => {
  if (!start || !end) return null;
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
};

const shouldKeepSelectionRect = (rect = null) =>
  Boolean(rect && rect.width >= MIN_SELECTION_SIZE && rect.height >= MIN_SELECTION_SIZE);

const AttachmentComposerOverlay = ({
  selectedConversation,
  getConversationAvatarText,
  getConversationDisplayName,
  pendingAttachment,
  onClose,
  onComplete,
  onSend,
  sendingMessage,
  replyPreview
}) => {
  const addMoreInputRef = useRef(null);
  const imageShellRef = useRef(null);
  const imageElementRef = useRef(null);
  const textEditorRef = useRef(null);
  const createdPreviewUrlsRef = useRef(new Set());
  const [composerItems, setComposerItems] = useState([]);
  const [activeItemId, setActiveItemId] = useState('');
  const [activeTool, setActiveTool] = useState('');
  const [selectionDraft, setSelectionDraft] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const [drawDraft, setDrawDraft] = useState(null);
  const [textDraft, setTextDraft] = useState(null);
  const [drawColor, setDrawColor] = useState(DEFAULT_DRAW_COLOR);
  const [drawSize, setDrawSize] = useState(8);
  const [textColor, setTextColor] = useState(DEFAULT_DRAW_COLOR);
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_SIZE);
  const [textWithBackground, setTextWithBackground] = useState(true);
  const [blurStrength, setBlurStrength] = useState(18);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  const [isSendingItems, setIsSendingItems] = useState(false);
  const [composerMessage, setComposerMessage] = useState('');

  const registerPreviewUrl = (file) => {
    if (inferAttachmentComposerMediaType(file) !== 'image') return '';
    const objectUrl = URL.createObjectURL(file);
    createdPreviewUrlsRef.current.add(objectUrl);
    return objectUrl;
  };

  const revokePreviewUrl = (objectUrl = '') => {
    const nextUrl = String(objectUrl || '').trim();
    if (!nextUrl) return;
    createdPreviewUrlsRef.current.delete(nextUrl);
    URL.revokeObjectURL(nextUrl);
  };

  const revokeAllPreviewUrls = () => {
    createdPreviewUrlsRef.current.forEach((objectUrl) => {
      URL.revokeObjectURL(objectUrl);
    });
    createdPreviewUrlsRef.current.clear();
  };

  useEffect(
    () => () => {
      revokeAllPreviewUrls();
    },
    []
  );

  useEffect(() => {
    revokeAllPreviewUrls();

    const nextItems = Array.isArray(pendingAttachment?.items)
      ? pendingAttachment.items
          .filter((item) => item?.file)
          .map((item, index) => {
            const mediaType = item?.mediaType || inferAttachmentComposerMediaType(item.file);
            return {
              id: String(item?.id || buildAttachmentComposerItemId(item.file, index)),
              file: item.file,
              mediaType,
              previewUrl: mediaType === 'image' ? registerPreviewUrl(item.file) : '',
              caption: index === 0 ? String(pendingAttachment?.restoreComposerText || '') : '',
              history: []
            };
          })
      : [];

    setComposerItems(nextItems);
    setActiveItemId(nextItems[0]?.id || '');
    setActiveTool('');
    setSelectionDraft(null);
    setSelectionRect(null);
    setDrawDraft(null);
    setTextDraft(null);
    setComposerMessage('');
    setIsApplyingEdit(false);
    setIsSendingItems(false);
  }, [pendingAttachment]);

  useEffect(() => {
    if (!textDraft || !textEditorRef.current) return;
    textEditorRef.current.focus();
    textEditorRef.current.select();
  }, [textDraft]);

  const activeItem = useMemo(() => {
    if (!composerItems.length) return null;
    return composerItems.find((item) => item.id === activeItemId) || composerItems[0];
  }, [composerItems, activeItemId]);

  const activeImageItem = activeItem?.mediaType === 'image';
  const editorBusy = Boolean(sendingMessage || isSendingItems || isApplyingEdit);
  const contactTitle =
    String(getConversationDisplayName(selectedConversation) || '').trim() ||
    String(selectedConversation?.contactPhone || '').trim() ||
    'Contact';

  useEffect(() => {
    if (!activeItem && composerItems.length) {
      setActiveItemId(composerItems[0].id);
    }
  }, [activeItem, composerItems]);

  useEffect(() => {
    setActiveTool('');
    setSelectionDraft(null);
    setSelectionRect(null);
    setDrawDraft(null);
    setTextDraft(null);
  }, [activeItemId]);

  const getActiveImageMetrics = () => {
    if (!imageShellRef.current || !imageElementRef.current || !activeImageItem) return null;
    const shellRect = imageShellRef.current.getBoundingClientRect();
    const naturalWidth = Number(imageElementRef.current.naturalWidth || 0);
    const naturalHeight = Number(imageElementRef.current.naturalHeight || 0);
    if (!shellRect.width || !shellRect.height || !naturalWidth || !naturalHeight) return null;

    return {
      displayWidth: shellRect.width,
      displayHeight: shellRect.height,
      naturalWidth,
      naturalHeight,
      left: shellRect.left,
      top: shellRect.top
    };
  };

  const getClampedDisplayPoint = (event) => {
    const metrics = getActiveImageMetrics();
    if (!metrics) return null;
    return {
      metrics,
      x: clamp(Number(event.clientX || 0) - metrics.left, 0, metrics.displayWidth),
      y: clamp(Number(event.clientY || 0) - metrics.top, 0, metrics.displayHeight)
    };
  };

  const convertDisplayPointToNatural = (point, metrics) => ({
    x: Math.round((point.x / metrics.displayWidth) * metrics.naturalWidth),
    y: Math.round((point.y / metrics.displayHeight) * metrics.naturalHeight)
  });

  const convertDisplayRectToNatural = (rect, metrics) => ({
    x: Math.round((rect.x / metrics.displayWidth) * metrics.naturalWidth),
    y: Math.round((rect.y / metrics.displayHeight) * metrics.naturalHeight),
    width: Math.max(1, Math.round((rect.width / metrics.displayWidth) * metrics.naturalWidth)),
    height: Math.max(1, Math.round((rect.height / metrics.displayHeight) * metrics.naturalHeight))
  });

  const updateComposerItems = (updater) => {
    setComposerItems((currentItems) => updater(currentItems));
  };

  const updateActiveItem = (updater) => {
    if (!activeItem) return;
    updateComposerItems((currentItems) =>
      currentItems.map((item) => (item.id === activeItem.id ? updater(item) : item))
    );
  };

  const replaceActiveImageFile = (nextFile) => {
    if (!activeItem) return;
    const nextMediaType = inferAttachmentComposerMediaType(nextFile);
    const nextPreviewUrl = nextMediaType === 'image' ? registerPreviewUrl(nextFile) : '';

    updateActiveItem((item) => ({
      ...item,
      file: nextFile,
      mediaType: nextMediaType,
      previewUrl: nextPreviewUrl,
      history: [
        ...item.history,
        {
          file: item.file,
          mediaType: item.mediaType,
          previewUrl: item.previewUrl
        }
      ]
    }));
  };

  const clearToolDrafts = () => {
    setSelectionDraft(null);
    setSelectionRect(null);
    setDrawDraft(null);
    setTextDraft(null);
  };

  const setToolMode = (nextTool) => {
    if (!activeImageItem || editorBusy) return;
    clearToolDrafts();
    setActiveTool((currentTool) => (currentTool === nextTool ? '' : nextTool));
    setComposerMessage('');
  };

  const showComposerFeedback = (message) => {
    setComposerMessage(String(message || '').trim());
  };

  const performImageEdit = async (work) => {
    if (!activeImageItem || editorBusy) return;
    setIsApplyingEdit(true);
    setComposerMessage('');
    try {
      const nextFile = await work();
      if (nextFile && nextFile !== activeItem.file) {
        replaceActiveImageFile(nextFile);
      }
      clearToolDrafts();
      setActiveTool('');
    } catch (error) {
      console.error('Unable to edit attachment preview:', error);
      showComposerFeedback(error?.message || 'Unable to apply that edit right now.');
    } finally {
      setIsApplyingEdit(false);
    }
  };

  useEffect(() => {
    if (!selectionDraft && !drawDraft) return undefined;

    const handlePointerMove = (event) => {
      const point = getClampedDisplayPoint(event);
      if (!point) return;

      if (selectionDraft) {
        setSelectionDraft((currentDraft) =>
          currentDraft
            ? {
                ...currentDraft,
                current: {
                  x: point.x,
                  y: point.y
                }
              }
            : currentDraft
        );
      }

      if (drawDraft) {
        setDrawDraft((currentDraft) =>
          currentDraft
            ? {
                ...currentDraft,
                points: [...currentDraft.points, { x: point.x, y: point.y }]
              }
            : currentDraft
        );
      }
    };

    const handlePointerUp = async () => {
      if (selectionDraft) {
        const nextRect = getNormalizedRect(selectionDraft.start, selectionDraft.current);
        setSelectionDraft(null);
        setSelectionRect(shouldKeepSelectionRect(nextRect) ? nextRect : null);
        return;
      }

      if (drawDraft && activeImageItem) {
        const strokePoints = drawDraft.points;
        setDrawDraft(null);
        if (strokePoints.length < 2) return;

        const metrics = getActiveImageMetrics();
        if (!metrics) return;

        const naturalPoints = strokePoints.map((point) =>
          convertDisplayPointToNatural(point, metrics)
        );

        await performImageEdit(() =>
          applyDrawStrokeToImageFile(
            activeItem.file,
            naturalPoints,
            drawColor,
            Math.max(2, Math.round(drawSize * (metrics.naturalWidth / metrics.displayWidth)))
          )
        );
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [selectionDraft, drawDraft, activeImageItem, activeItem, drawColor, drawSize, editorBusy]);

  const handleStagePointerDown = (event) => {
    if (!activeImageItem || editorBusy) return;
    const point = getClampedDisplayPoint(event);
    if (!point) return;

    if (activeTool === 'crop' || activeTool === 'blur') {
      setSelectionRect(null);
      setSelectionDraft({
        tool: activeTool,
        start: { x: point.x, y: point.y },
        current: { x: point.x, y: point.y }
      });
      return;
    }

    if (activeTool === 'draw') {
      setDrawDraft({
        points: [{ x: point.x, y: point.y }]
      });
      return;
    }

    if (activeTool === 'text') {
      setTextDraft({
        x: point.x,
        y: point.y,
        text: ''
      });
    }
  };

  const handleRotateImage = async () => {
    if (!activeImageItem || editorBusy) return;
    await performImageEdit(() => applyRotationToImageFile(activeItem.file, 90));
  };

  const handleUndoLastEdit = () => {
    if (!activeItem?.history?.length || editorBusy) return;

    updateActiveItem((item) => {
      const previousVersion = item.history[item.history.length - 1];
      if (!previousVersion) return item;
      return {
        ...item,
        file: previousVersion.file,
        mediaType: previousVersion.mediaType,
        previewUrl: previousVersion.previewUrl,
        history: item.history.slice(0, -1)
      };
    });
    clearToolDrafts();
    setActiveTool('');
  };

  const handleApplyCrop = async () => {
    if (!activeImageItem || !selectionRect) return;
    const metrics = getActiveImageMetrics();
    if (!metrics) return;
    const naturalCropRect = convertDisplayRectToNatural(selectionRect, metrics);
    await performImageEdit(() => applyCropToImageFile(activeItem.file, naturalCropRect));
  };

  const handleApplyBlur = async () => {
    if (!activeImageItem || !selectionRect) return;
    const metrics = getActiveImageMetrics();
    if (!metrics) return;
    const naturalBlurRect = convertDisplayRectToNatural(selectionRect, metrics);
    await performImageEdit(() =>
      applyPixelateToImageFile(activeItem.file, naturalBlurRect, blurStrength)
    );
  };

  const handleApplyText = async () => {
    if (!activeImageItem || !textDraft?.text?.trim()) {
      setActiveTool('');
      setTextDraft(null);
      return;
    }

    const metrics = getActiveImageMetrics();
    if (!metrics) return;

    const naturalPoint = convertDisplayPointToNatural(textDraft, metrics);
    await performImageEdit(() =>
      applyTextToImageFile(activeItem.file, {
        text: textDraft.text,
        x: naturalPoint.x,
        y: naturalPoint.y,
        color: textColor,
        fontSize: Math.max(18, Math.round(textSize * (metrics.naturalWidth / metrics.displayWidth))),
        withBackground: textWithBackground
      })
    );
  };

  const handleDone = async () => {
    if (activeTool === 'crop' && selectionRect) {
      await handleApplyCrop();
      return;
    }

    if (activeTool === 'blur' && selectionRect) {
      await handleApplyBlur();
      return;
    }

    if (activeTool === 'text' && textDraft?.text?.trim()) {
      await handleApplyText();
      return;
    }

    clearToolDrafts();
    setActiveTool('');
  };

  const handleAddMoreFiles = (event) => {
    const supportedFiles = Array.from(event?.target?.files || []).filter((file) =>
      isSupportedAttachmentComposerFile(file)
    );

    if (!supportedFiles.length) {
      event.target.value = '';
      return;
    }

    setComposerItems((currentItems) => {
      const nextItems = [
        ...currentItems,
        ...supportedFiles.map((file, index) => {
          const mediaType = inferAttachmentComposerMediaType(file);
          return {
            id: buildAttachmentComposerItemId(file, currentItems.length + index),
            file,
            mediaType,
            previewUrl: mediaType === 'image' ? registerPreviewUrl(file) : '',
            caption: '',
            history: []
          };
        })
      ];

      if (!activeItemId && nextItems[0]) {
        setActiveItemId(nextItems[0].id);
      }

      return nextItems;
    });

    event.target.value = '';
  };

  const handleThumbnailSelect = (itemId) => {
    if (editorBusy) return;
    setActiveItemId(itemId);
  };

  const handleRemoveComposerItem = (itemId) => {
    if (editorBusy) return;

    let shouldCloseComposer = false;
    let nextActiveItemId = '';
    let removedPreviewUrls = [];

    setComposerItems((currentItems) => {
      const itemIndex = currentItems.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) return currentItems;

      const removedItem = currentItems[itemIndex];
      removedPreviewUrls = [
        removedItem?.previewUrl,
        ...(Array.isArray(removedItem?.history)
          ? removedItem.history.map((entry) => entry?.previewUrl)
          : [])
      ].filter(Boolean);

      const nextItems = currentItems.filter((item) => item.id !== itemId);

      if (!nextItems.length) {
        shouldCloseComposer = true;
        nextActiveItemId = '';
        return nextItems;
      }

      if (activeItemId && activeItemId !== itemId) {
        nextActiveItemId = activeItemId;
        return nextItems;
      }

      nextActiveItemId =
        nextItems[itemIndex]?.id || nextItems[itemIndex - 1]?.id || nextItems[0]?.id || '';

      return nextItems;
    });

    removedPreviewUrls.forEach((previewUrl) => revokePreviewUrl(previewUrl));

    if (shouldCloseComposer) {
      setActiveItemId('');
      onClose?.();
      return;
    }

    setActiveItemId(nextActiveItemId);
  };

  const handleDownloadCurrentPreview = () => {
    if (!activeItem) return;
    const objectUrl = URL.createObjectURL(activeItem.file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = String(activeItem.file?.name || 'attachment').trim() || 'attachment';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const handleSendComposerItems = async () => {
    if (!composerItems.length || !onSend || editorBusy) return;
    setIsSendingItems(true);
    setComposerMessage('');

    try {
      const payload = composerItems.map((item) => ({
        id: item.id,
        file: item.file,
        caption: String(item.caption || '').trim()
      }));
      const sentIds = await onSend(payload);
      const sentIdSet = new Set(Array.isArray(sentIds) ? sentIds : []);

      if (sentIdSet.size === payload.length) {
        onComplete?.();
        return;
      }

      if (sentIdSet.size > 0) {
        setComposerItems((currentItems) =>
          currentItems.filter((item) => !sentIdSet.has(item.id))
        );
        const remainingItems = payload.filter((item) => !sentIdSet.has(item.id));
        setActiveItemId(remainingItems[0]?.id || '');
        showComposerFeedback('Some attachments were sent. The remaining items are still in preview.');
      } else {
        showComposerFeedback('We could not send the selected attachments right now.');
      }
    } finally {
      setIsSendingItems(false);
    }
  };

  const currentSelectionRect = selectionDraft
    ? getNormalizedRect(selectionDraft.start, selectionDraft.current)
    : selectionRect;

  if (!pendingAttachment || !composerItems.length || !activeItem) return null;

  return (
    <div className="attachment-compose-overlay" role="dialog" aria-modal="true" aria-label="Attachment preview">
      <div className="attachment-compose-shell" onClick={(event) => event.stopPropagation()}>
        <div className="attachment-compose-header attachment-compose-header--conversation">
          <button
            type="button"
            className="attachment-compose-header-btn"
            aria-label="Close attachment preview"
            title="Close"
            onClick={onClose}
            disabled={editorBusy}
          >
            <X size={20} />
          </button>

          <div className="attachment-compose-contact">
            <div className="attachment-compose-avatar">
              {getConversationAvatarText(selectedConversation)}
            </div>
            <div className="attachment-compose-contact-copy">
              <span className="attachment-compose-contact-title">{contactTitle}</span>
              <span className="attachment-compose-contact-subtitle">
                {activeImageItem ? 'Photo preview' : 'Document preview'}
              </span>
            </div>
          </div>

          <div className="attachment-compose-header-actions">
            <button
              type="button"
              className="attachment-compose-header-btn"
              aria-label="Undo last edit"
              title="Undo"
              onClick={handleUndoLastEdit}
              disabled={!activeImageItem || !activeItem.history.length || editorBusy}
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              className="attachment-compose-header-btn"
              aria-label="Download current preview"
              title="Download"
              onClick={handleDownloadCurrentPreview}
              disabled={editorBusy}
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              className="attachment-compose-done-btn"
              onClick={handleDone}
              disabled={!activeImageItem || editorBusy}
            >
              Done
            </button>
          </div>
        </div>

        <div className="attachment-compose-toolbar">
          <button
            type="button"
            className="attachment-compose-tool-btn"
            onClick={handleRotateImage}
            disabled={!activeImageItem || editorBusy}
            title="Rotate"
          >
            <RotateCw size={18} />
          </button>
          <button
            type="button"
            className={`attachment-compose-tool-btn ${activeTool === 'crop' ? 'is-active' : ''}`}
            onClick={() => setToolMode('crop')}
            disabled={!activeImageItem || editorBusy}
            title="Crop"
          >
            <Square size={18} />
          </button>
          <button
            type="button"
            className={`attachment-compose-tool-btn ${activeTool === 'blur' ? 'is-active' : ''}`}
            onClick={() => setToolMode('blur')}
            disabled={!activeImageItem || editorBusy}
            title="Blur"
          >
            <Sparkles size={18} />
          </button>
          <button
            type="button"
            className={`attachment-compose-tool-btn ${activeTool === 'draw' ? 'is-active' : ''}`}
            onClick={() => setToolMode('draw')}
            disabled={!activeImageItem || editorBusy}
            title="Draw"
          >
            <Pencil size={18} />
          </button>
          <button
            type="button"
            className={`attachment-compose-tool-btn ${activeTool === 'text' ? 'is-active' : ''}`}
            onClick={() => setToolMode('text')}
            disabled={!activeImageItem || editorBusy}
            title="Add text"
          >
            <span className="attachment-compose-tool-label">Aa</span>
          </button>
          <button
            type="button"
            className="attachment-compose-tool-btn"
            disabled
            title="Emoji stickers coming soon"
          >
            <Smile size={18} />
          </button>
        </div>

        <div className="attachment-compose-stage">
          <div className="attachment-compose-stage-board">
            {activeImageItem ? (
              <div
                ref={imageShellRef}
                className={`attachment-compose-image-shell ${
                  activeTool === 'crop' || activeTool === 'blur'
                    ? 'is-selection-mode'
                    : activeTool === 'draw'
                      ? 'is-draw-mode'
                      : activeTool === 'text'
                        ? 'is-text-mode'
                        : ''
                }`}
                onMouseDown={handleStagePointerDown}
              >
                <img
                  ref={imageElementRef}
                  src={activeItem.previewUrl}
                  alt={String(activeItem.file?.name || 'Attachment preview')}
                  className="attachment-compose-image"
                  draggable="false"
                />

                {(currentSelectionRect || drawDraft || textDraft) && (
                  <div className="attachment-compose-image-overlay">
                    {currentSelectionRect && (
                      <div
                        className={`attachment-compose-selection-box ${
                          activeTool === 'blur' ? 'is-blur' : ''
                        }`}
                        style={{
                          left: `${currentSelectionRect.x}px`,
                          top: `${currentSelectionRect.y}px`,
                          width: `${currentSelectionRect.width}px`,
                          height: `${currentSelectionRect.height}px`
                        }}
                      />
                    )}

                    {drawDraft?.points?.length > 1 && (
                      <svg
                        className="attachment-compose-draw-overlay"
                        viewBox={`0 0 ${imageShellRef.current?.clientWidth || 1} ${
                          imageShellRef.current?.clientHeight || 1
                        }`}
                      >
                        <polyline
                          fill="none"
                          stroke={drawColor}
                          strokeWidth={drawSize}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={drawDraft.points.map((point) => `${point.x},${point.y}`).join(' ')}
                        />
                      </svg>
                    )}

                    {textDraft && (
                      <div
                        className="attachment-compose-text-editor"
                        style={{
                          left: `${textDraft.x}px`,
                          top: `${textDraft.y}px`,
                          color: textColor,
                          fontSize: `${textSize}px`
                        }}
                      >
                        <input
                          ref={textEditorRef}
                          type="text"
                          value={textDraft.text}
                          placeholder="Type something"
                          onChange={(event) =>
                            setTextDraft((currentDraft) =>
                              currentDraft
                                ? {
                                    ...currentDraft,
                                    text: event.target.value
                                  }
                                : currentDraft
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleApplyText();
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setTextDraft(null);
                              setActiveTool('');
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="attachment-compose-document-stage">
                <div className="attachment-compose-document-card">
                  <div className="attachment-compose-document-badge" aria-hidden="true">
                    <FileText size={22} />
                    <span>{getDraftAttachmentExtension(activeItem.file)}</span>
                  </div>
                  <div className="attachment-compose-document-copy">
                    <span className="attachment-compose-document-name">
                      {String(activeItem.file?.name || 'Document').trim()}
                    </span>
                    <span className="attachment-compose-document-meta">
                      {[
                        getDraftAttachmentExtension(activeItem.file),
                        formatDraftAttachmentSize(activeItem.file?.size)
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="attachment-compose-footer">
          {replyPreview && (
            <div className="attachment-compose-reply">
              <span className="attachment-compose-reply-label">{replyPreview.senderLabel}</span>
              <span className="attachment-compose-reply-text">{replyPreview.preview}</span>
            </div>
          )}

          {composerMessage && <div className="attachment-compose-feedback">{composerMessage}</div>}

          {activeImageItem && (
            <div className="attachment-compose-tool-panel">
              {activeTool === 'draw' && (
                <>
                  <div className="attachment-compose-color-row">
                    {DRAW_COLORS.map((color) => (
                      <button
                        key={`draw-color-${color}`}
                        type="button"
                        className={`attachment-compose-color-swatch ${
                          drawColor === color ? 'is-active' : ''
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setDrawColor(color)}
                      />
                    ))}
                  </div>
                  <label className="attachment-compose-slider-row">
                    <span>Brush</span>
                    <input
                      type="range"
                      min="2"
                      max="24"
                      step="1"
                      value={drawSize}
                      onChange={(event) => setDrawSize(Number(event.target.value || 8))}
                    />
                    <span>{drawSize}px</span>
                  </label>
                </>
              )}

              {activeTool === 'text' && (
                <>
                  <div className="attachment-compose-color-row">
                    {DRAW_COLORS.map((color) => (
                      <button
                        key={`text-color-${color}`}
                        type="button"
                        className={`attachment-compose-color-swatch ${
                          textColor === color ? 'is-active' : ''
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setTextColor(color)}
                      />
                    ))}
                  </div>
                  <label className="attachment-compose-slider-row">
                    <span>Size</span>
                    <input
                      type="range"
                      min="18"
                      max="72"
                      step="2"
                      value={textSize}
                      onChange={(event) => setTextSize(Number(event.target.value || DEFAULT_TEXT_SIZE))}
                    />
                    <span>{textSize}px</span>
                  </label>
                  <label className="attachment-compose-chip-toggle">
                    <input
                      type="checkbox"
                      checked={textWithBackground}
                      onChange={(event) => setTextWithBackground(event.target.checked)}
                    />
                    <span>Background</span>
                  </label>
                </>
              )}

              {activeTool === 'blur' && (
                <>
                  <label className="attachment-compose-slider-row">
                    <span>Blur</span>
                    <input
                      type="range"
                      min="6"
                      max="36"
                      step="1"
                      value={blurStrength}
                      onChange={(event) => setBlurStrength(Number(event.target.value || 18))}
                    />
                    <span>{blurStrength}</span>
                  </label>
                  <div className="attachment-compose-inline-actions">
                    <button
                      type="button"
                      className="attachment-compose-inline-btn"
                      onClick={() => setSelectionRect(null)}
                      disabled={!selectionRect}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="attachment-compose-inline-btn is-primary"
                      onClick={handleApplyBlur}
                      disabled={!selectionRect || editorBusy}
                    >
                      <Check size={15} />
                      Apply blur
                    </button>
                  </div>
                </>
              )}

              {activeTool === 'crop' && (
                <div className="attachment-compose-inline-actions">
                  <button
                    type="button"
                    className="attachment-compose-inline-btn"
                    onClick={() => setSelectionRect(null)}
                    disabled={!selectionRect}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="attachment-compose-inline-btn is-primary"
                    onClick={handleApplyCrop}
                    disabled={!selectionRect || editorBusy}
                  >
                    <Check size={15} />
                    Crop
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="attachment-compose-caption-row">
            <textarea
              className="attachment-compose-caption-input"
              placeholder={activeImageItem ? 'Add a caption' : 'Add a message'}
              value={String(activeItem.caption || '')}
              onChange={(event) =>
                updateActiveItem((item) => ({
                  ...item,
                  caption: event.target.value
                }))
              }
              rows={1}
            />
          </div>

          <div className="attachment-compose-bottom-bar">
            <div className="attachment-compose-thumbnail-strip">
              {composerItems.map((item) => (
                <div key={item.id} className="attachment-compose-thumbnail-shell">
                  <button
                    type="button"
                    className={`attachment-compose-thumbnail ${
                      item.id === activeItem.id ? 'is-active' : ''
                    } ${item.mediaType !== 'image' ? 'is-document' : ''}`}
                    onClick={() => handleThumbnailSelect(item.id)}
                    title={String(item.file?.name || 'Attachment')}
                  >
                    {item.mediaType === 'image' ? (
                      <img src={item.previewUrl} alt={String(item.file?.name || 'Attachment')} />
                    ) : (
                      <div className="attachment-compose-thumbnail-document">
                        <FileText size={18} />
                        <span>{getDraftAttachmentExtension(item.file)}</span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    className="attachment-compose-thumbnail-remove"
                    aria-label={`Remove ${String(item.file?.name || 'attachment')}`}
                    title="Remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemoveComposerItem(item.id);
                    }}
                    disabled={editorBusy}
                  >
                    <X size={18} strokeWidth={2.35} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="attachment-compose-thumbnail attachment-compose-thumbnail--add"
                onClick={() => addMoreInputRef.current?.click()}
                disabled={editorBusy}
                title="Add more media"
              >
                <Plus size={18} />
              </button>
              <input
                ref={addMoreInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                multiple
                className="attachment-compose-hidden-input"
                onChange={handleAddMoreFiles}
              />
            </div>

            <button
              type="button"
              className="attachment-compose-send-btn"
              aria-label={editorBusy ? 'Sending attachment' : 'Send attachment'}
              title={editorBusy ? 'Sending attachment' : 'Send attachment'}
              onClick={handleSendComposerItems}
              disabled={editorBusy || !composerItems.length}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttachmentComposerOverlay;
