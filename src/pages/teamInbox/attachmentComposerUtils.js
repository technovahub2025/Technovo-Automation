const DEFAULT_IMAGE_MIME_TYPE = 'image/png';

export const SUPPORTED_ATTACHMENT_COMPOSER_DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'zip'
]);

export const formatDraftAttachmentSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
};

export const getDraftAttachmentExtension = (file = {}) => {
  const fileName = String(file?.name || '').trim();
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex > -1) {
    return fileName.slice(lastDotIndex + 1).toUpperCase();
  }

  const mimeType = String(file?.type || '').trim().toLowerCase();
  if (mimeType.includes('/')) {
    return mimeType.split('/')[1].toUpperCase();
  }

  return 'FILE';
};

export const getDraggedFileExtension = (file = {}) => {
  const fileName = String(file?.name || '').trim();
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex < 0) return '';
  return fileName.slice(lastDotIndex + 1).toLowerCase();
};

export const inferAttachmentComposerMediaType = (file = {}) =>
  String(file?.type || '').toLowerCase().startsWith('image/') ? 'image' : 'document';

export const isSupportedAttachmentComposerFile = (file = {}) => {
  const mimeType = String(file?.type || '')
    .trim()
    .toLowerCase();
  if (mimeType.startsWith('image/')) return true;
  if (mimeType.startsWith('audio/')) return false;
  return SUPPORTED_ATTACHMENT_COMPOSER_DOCUMENT_EXTENSIONS.has(getDraggedFileExtension(file));
};

export const buildAttachmentComposerItemId = (file, index = 0) =>
  `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}-${String(file?.name || 'attachment')}`;

const getOutputImageMimeType = (file = {}) => {
  const normalized = String(file?.type || '').trim().toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/png' || normalized === 'image/webp') {
    return normalized;
  }
  return DEFAULT_IMAGE_MIME_TYPE;
};

const getFileNameWithExtension = (file = {}, extension = 'png') => {
  const originalName = String(file?.name || '').trim();
  if (!originalName) return `attachment.${extension}`;
  const lastDotIndex = originalName.lastIndexOf('.');
  if (lastDotIndex < 0) return `${originalName}.${extension}`;
  return `${originalName.slice(0, lastDotIndex)}.${extension}`;
};

const canvasToFile = (canvas, sourceFile = {}) =>
  new Promise((resolve, reject) => {
    const mimeType = getOutputImageMimeType(sourceFile);
    const fallbackExtension = mimeType.split('/')[1] || 'png';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to export edited image.'));
          return;
        }
        resolve(
          new File([blob], getFileNameWithExtension(sourceFile, fallbackExtension), {
            type: mimeType,
            lastModified: Date.now()
          })
        );
      },
      mimeType,
      mimeType === 'image/jpeg' ? 0.92 : undefined
    );
  });

export const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Missing image file.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to load image preview.'));
    };
    image.src = objectUrl;
  });

export const applyRotationToImageFile = async (file, degrees = 90) => {
  const image = await loadImageFromFile(file);
  const normalizedRotation = ((Number(degrees || 0) % 360) + 360) % 360;
  const radians = (normalizedRotation * Math.PI) / 180;
  const swapDimensions = normalizedRotation === 90 || normalizedRotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swapDimensions ? image.height : image.width;
  canvas.height = swapDimensions ? image.width : image.height;

  const context = canvas.getContext('2d');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(image, -image.width / 2, -image.height / 2);

  return canvasToFile(canvas, file);
};

export const applyCropToImageFile = async (file, cropRect = {}) => {
  const image = await loadImageFromFile(file);
  const cropX = Math.max(0, Math.floor(Number(cropRect.x || 0)));
  const cropY = Math.max(0, Math.floor(Number(cropRect.y || 0)));
  const cropWidth = Math.max(1, Math.floor(Number(cropRect.width || 0)));
  const cropHeight = Math.max(1, Math.floor(Number(cropRect.height || 0)));

  const canvas = document.createElement('canvas');
  canvas.width = Math.min(cropWidth, image.width - cropX);
  canvas.height = Math.min(cropHeight, image.height - cropY);

  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    cropX,
    cropY,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvasToFile(canvas, file);
};

export const applyPixelateToImageFile = async (file, blurRect = {}, blurStrength = 18) => {
  const image = await loadImageFromFile(file);
  const blurX = Math.max(0, Math.floor(Number(blurRect.x || 0)));
  const blurY = Math.max(0, Math.floor(Number(blurRect.y || 0)));
  const blurWidth = Math.max(1, Math.floor(Number(blurRect.width || 0)));
  const blurHeight = Math.max(1, Math.floor(Number(blurRect.height || 0)));

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);

  const tempCanvas = document.createElement('canvas');
  const sampleWidth = Math.max(1, Math.floor(blurWidth / Math.max(2, Number(blurStrength || 18))));
  const sampleHeight = Math.max(1, Math.floor(blurHeight / Math.max(2, Number(blurStrength || 18))));
  tempCanvas.width = sampleWidth;
  tempCanvas.height = sampleHeight;
  const tempContext = tempCanvas.getContext('2d');
  tempContext.drawImage(
    canvas,
    blurX,
    blurY,
    blurWidth,
    blurHeight,
    0,
    0,
    sampleWidth,
    sampleHeight
  );

  context.imageSmoothingEnabled = false;
  context.drawImage(
    tempCanvas,
    0,
    0,
    sampleWidth,
    sampleHeight,
    blurX,
    blurY,
    blurWidth,
    blurHeight
  );
  context.imageSmoothingEnabled = true;

  return canvasToFile(canvas, file);
};

export const applyDrawStrokeToImageFile = async (
  file,
  points = [],
  color = '#202c33',
  brushSize = 8
) => {
  if (!Array.isArray(points) || points.length < 2) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  context.strokeStyle = color;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = Number(brushSize || 8);
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }

  context.stroke();
  return canvasToFile(canvas, file);
};

export const applyTextToImageFile = async (
  file,
  {
    text = '',
    x = 0,
    y = 0,
    color = '#202c33',
    fontSize = 32,
    withBackground = false
  } = {}
) => {
  const nextText = String(text || '').trim();
  if (!nextText) return file;

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);

  const safeFontSize = Math.max(14, Math.floor(Number(fontSize || 32)));
  context.font = `600 ${safeFontSize}px "Segoe UI", sans-serif`;
  context.textBaseline = 'top';
  const measured = context.measureText(nextText);
  const textWidth = Math.ceil(measured.width);
  const textHeight = safeFontSize + 10;
  const textX = Math.max(0, Math.min(Number(x || 0), image.width - textWidth - 12));
  const textY = Math.max(0, Math.min(Number(y || 0), image.height - textHeight - 12));

  if (withBackground) {
    context.fillStyle = 'rgba(17, 27, 33, 0.55)';
    context.beginPath();
    context.roundRect(textX - 8, textY - 6, textWidth + 16, textHeight + 8, 12);
    context.fill();
  }

  context.fillStyle = color;
  context.fillText(nextText, textX, textY);

  return canvasToFile(canvas, file);
};
