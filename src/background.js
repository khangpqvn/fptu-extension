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

/**
 * The offscreen document writes "#recording:<startedAt>" into its own URL, which
 * survives service worker termination unlike an in-memory variable.
 */
async function getRecordingState() {
  const context = await getOffscreenContext();
  const hash = context?.documentUrl?.split('#')[1] ?? '';
  const [marker, startedAt] = hash.split(':');
  if (marker !== 'recording') {
    return { recording: false, startedAt: null };
  }
  return { recording: true, startedAt: Number(startedAt) || null };
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
    await sendToOffscreen({ type: 'tabCapture:offscreenRelease', url }).catch(() => {});
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

async function startRecording(tabId) {
  const { recording, startedAt } = await getRecordingState();
  if (recording) {
    return { startedAt };
  }

  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  const response = await sendToOffscreen({ type: 'tabCapture:offscreenStart', streamId });
  return { startedAt: response.startedAt };
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

  const senderTabId = sender?.tab?.id;
  switch (message.type) {
    case 'tabCapture:getState':
      return () => getRecordingState();
    case 'tabCapture:screenshot':
      return senderTabId ? () => captureScreenshot(senderTabId) : null;
    case 'tabCapture:startRecording':
      return senderTabId ? () => startRecording(senderTabId) : null;
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
