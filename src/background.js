/**
 * background.js — Service worker. Injects action scripts into the active tab and
 * owns tab screenshot/recording for the "tab-capture" action.
 */
const OFFSCREEN_PATH = 'offscreen.html';
const OFFSCREEN_URL = chrome.runtime.getURL(OFFSCREEN_PATH);
const EXTRA_ACTION_FILES = {
  'qr-share-link': ['actions/qr-share-link/qrcode.min.js'],
};

// =========================
// ACTION INJECTION
// =========================

function executeAction(actionId, tabId) {
  const files = [
    ...(EXTRA_ACTION_FILES[actionId] || []),
    `actions/${actionId}/script.js`,
  ];

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve({});
      }
    });
  });
}

// =========================
// OFFSCREEN DOCUMENT
// =========================

let creatingOffscreenDocument = null;
let microphonePermissionWindowId = null;

async function openMicrophonePermissionWindow() {
  if (microphonePermissionWindowId !== null) {
    try {
      await chrome.windows.update(microphonePermissionWindowId, { focused: true });
      return;
    } catch (_) {
      microphonePermissionWindowId = null;
    }
  }

  const permissionWindow = await chrome.windows.create({
    url: chrome.runtime.getURL('microphone-permission.html'),
    type: 'popup',
    width: 420,
    height: 280,
    focused: true,
  });
  microphonePermissionWindowId = permissionWindow.id ?? null;
}

/**
 * Matched on the URL prefix rather than through the documentUrls filter, because
 * the offscreen document appends a "#recording" hash to its own URL.
 */
async function getOffscreenContext() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  return contexts.find((context) => context.documentUrl?.startsWith(OFFSCREEN_URL)) ?? null;
}

async function ensureOffscreenDocument() {
  if (await getOffscreenContext()) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['USER_MEDIA', 'BLOBS'],
      justification: 'Ghi hình và chụp ảnh tab hiện tại.',
    }).finally(() => {
      creatingOffscreenDocument = null;
    });
  }

  await creatingOffscreenDocument;
}

async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ target: 'offscreen', ...message });
  if (!response?.success) {
    throw new Error(response?.error || 'Offscreen document không phản hồi.');
  }
  return response;
}

// =========================
// TAB CAPTURE
// =========================

function timestamp() {
  const pad = (value) => String(value).padStart(2, '0');
  const now = new Date();
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getIdleRecordingState() {
  return {
    recording: false,
    paused: false,
    startedAt: null,
    includeTabAudio: true,
    includeMicrophone: false,
    pausedAt: null,
    pausedDurationMs: 0,
    elapsedMs: 0,
  };
}

/**
 * The offscreen document writes recording metadata into its own URL hash, which
 * survives service worker termination unlike an in-memory variable.
 */
async function getRecordingState() {
  const context = await getOffscreenContext();
  const hash = context?.documentUrl?.split('#')[1] ?? '';
  const [marker, startedAtValue, audioMode, status = 'active', pausedAtValue = '0', pausedDurationValue = '0'] = hash.split(':');
  const startedAt = Number(startedAtValue);
  const pausedAt = Number(pausedAtValue);
  const pausedDurationMs = Number(pausedDurationValue);
  const paused = status === 'paused';

  if (marker !== 'recording'
    || !Number.isFinite(startedAt)
    || startedAt <= 0
    || !['active', 'paused'].includes(status)
    || !Number.isFinite(pausedDurationMs)
    || pausedDurationMs < 0
    || (paused && (!Number.isFinite(pausedAt) || pausedAt <= 0))) {
    return getIdleRecordingState();
  }

  const currentPauseMs = paused ? Date.now() - pausedAt : 0;
  return {
    recording: true,
    paused,
    startedAt,
    includeTabAudio: audioMode?.[0] !== '0',
    includeMicrophone: audioMode?.[1] === '1',
    pausedAt: paused ? pausedAt : null,
    pausedDurationMs,
    elapsedMs: Math.max(0, Date.now() - startedAt - pausedDurationMs - currentPauseMs),
  };
}

/**
 * download() resolves once Chrome has finished reading the blob, because
 * revoking the URL while the file is still streaming truncates the download.
 */
function waitForDownload(downloadId) {
  return new Promise((resolve, reject) => {
    const settle = (state) => {
      if (state === 'complete') {
        chrome.downloads.onChanged.removeListener(onChanged);
        resolve();
      } else if (state === 'interrupted') {
        chrome.downloads.onChanged.removeListener(onChanged);
        reject(new Error('Chrome đã hủy quá trình tải file.'));
      }
    };

    function onChanged(delta) {
      if (delta.id === downloadId && delta.state) {
        settle(delta.state.current);
      }
    }

    chrome.downloads.onChanged.addListener(onChanged);
    // The download may already have finished before the listener was attached.
    chrome.downloads.search({ id: downloadId }).then(([item]) => settle(item?.state));
  });
}

async function download(url, filename) {
  try {
    const downloadId = await chrome.downloads.download({ url, filename });
    await waitForDownload(downloadId);
  } finally {
    // Do not recreate an offscreen document solely to release a URL from one
    // that has already closed. A new document cannot own that URL.
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'tabCapture:offscreenRelease',
      url,
    }).catch(() => {});
  }
  return { filename };
}

async function captureScreenshot(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) {
    throw new Error('Hãy mở tab này lên trước khi chụp ảnh.');
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const { url } = await sendToOffscreen({ type: 'tabCapture:offscreenBlobUrl', dataUrl });
  return download(url, `tab-capture/screenshot-${timestamp()}.png`);
}

async function startRecording(tabId, options) {
  const state = await getRecordingState();
  if (state.recording) {
    return state;
  }

  const includeTabAudio = options?.includeTabAudio !== false;
  const includeMicrophone = options?.includeMicrophone === true;
  await ensureOffscreenDocument();
  if (includeMicrophone) {
    const permission = await sendToOffscreen({
      type: 'tabCapture:offscreenMicrophonePermission',
    });
    if (permission.state !== 'granted') {
      await openMicrophonePermissionWindow();
      return {
        ...getIdleRecordingState(),
        requiresMicrophonePermission: true,
      };
    }
  }
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  return sendToOffscreen({
    type: 'tabCapture:offscreenStart',
    streamId,
    includeTabAudio,
    includeMicrophone,
  });
}

function pauseRecording() {
  // The offscreen document owns MediaRecorder, so it validates the current
  // recorder state instead of relying on a potentially stale URL-hash read.
  return sendToOffscreen({ type: 'tabCapture:offscreenPause' });
}

function resumeRecording() {
  // The offscreen document owns MediaRecorder, so it validates the current
  // recorder state instead of relying on a potentially stale URL-hash read.
  return sendToOffscreen({ type: 'tabCapture:offscreenResume' });
}

async function stopRecording() {
  const { recording } = await getRecordingState();
  if (!recording) {
    throw new Error('Chưa bắt đầu ghi hình.');
  }

  const { url, mimeType } = await sendToOffscreen({ type: 'tabCapture:offscreenStop' });
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return download(url, `tab-capture/recording-${timestamp()}.${extension}`);
}

// =========================
// MESSAGE ROUTER
// =========================

function resolveHandler(message, sender) {
  if (typeof message?.type !== 'string' || message.target === 'offscreen') {
    return null;
  }

  if (message.type === 'autoRun' && typeof message.actionId === 'string') {
    const tabId = sender?.tab?.id;
    return tabId ? () => executeAction(message.actionId, tabId) : null;
  }

  if (message.type === 'executeAction' && typeof message.actionId === 'string'
    && typeof message.tabId === 'number') {
    return () => executeAction(message.actionId, message.tabId);
  }

  if (message.type === 'tabCapture:microphonePermissionGranted') {
    return async () => {
      if (microphonePermissionWindowId !== null) {
        await chrome.windows.remove(microphonePermissionWindowId).catch(() => {});
        microphonePermissionWindowId = null;
      }
      return {};
    };
  }

  const senderTabId = sender?.tab?.id;
  switch (message.type) {
    case 'tabCapture:getState':
      return () => getRecordingState();
    case 'tabCapture:screenshot':
      return senderTabId ? () => captureScreenshot(senderTabId) : null;
    case 'tabCapture:startRecording':
      return senderTabId ? () => startRecording(senderTabId, message) : null;
    case 'tabCapture:pauseRecording':
      return () => pauseRecording();
    case 'tabCapture:resumeRecording':
      return () => resumeRecording();
    case 'tabCapture:stopRecording':
      return () => stopRecording();
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = resolveHandler(message, sender);
  if (!handler) {
    return undefined;
  }

  Promise.resolve()
    .then(handler)
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((error) => {
      console.error(`[${message.type}]`, error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});
