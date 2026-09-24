/**
 * offscreen.js — Records a tab MediaStream and mints blob URLs for the
 * "tab-capture" action.
 *
 * The service worker owns the tabCapture stream ID and the downloads; this
 * document only exists because MediaRecorder, getUserMedia and
 * URL.createObjectURL are unavailable in a service worker.
 * The recording state is mirrored into location.hash so the service worker can
 * recover it after being terminated mid-recording.
 */
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

let recorder = null;
let chunks = [];
let audioContext = null;
const blobUrls = new Set();

function pickMimeType() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

async function startRecording(streamId) {
  if (recorder) {
    throw new Error('Đang có một phiên ghi hình khác.');
  }

  const constraint = (source) => ({
    mandatory: {
      chromeMediaSource: source,
      chromeMediaSourceId: streamId,
    },
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: constraint('tab'),
    video: constraint('tab'),
  });

  // getUserMedia on a tab stream mutes the tab, so route the audio back out.
  audioContext = new AudioContext();
  audioContext.createMediaStreamSource(stream).connect(audioContext.destination);

  const mimeType = pickMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) {
      chunks.push(event.data);
    }
  };
  recorder.start();

  // The service worker can be terminated mid-recording, so the state lives in
  // this document's URL where getContexts() can read it back.
  const startedAt = Date.now();
  location.hash = `recording:${startedAt}`;
  return { startedAt };
}

function stopRecording() {
  if (!recorder) {
    throw new Error('Chưa bắt đầu ghi hình.');
  }

  const activeRecorder = recorder;
  const mimeType = activeRecorder.mimeType || 'video/webm';

  return new Promise((resolve, reject) => {
    activeRecorder.onerror = (event) => reject(event.error || new Error('Ghi hình thất bại.'));
    activeRecorder.onstop = () => {
      // Stopping the tracks also clears the tab's recording indicator.
      activeRecorder.stream.getTracks().forEach((track) => track.stop());
      audioContext?.close();
      audioContext = null;
      recorder = null;
      location.hash = '';

      const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      chunks = [];
      blobUrls.add(url);
      resolve({ url, mimeType });
    };
    activeRecorder.stop();
  });
}

/**
 * chrome.downloads.download truncates long data: URLs, so screenshots are
 * re-wrapped as a blob URL here before the service worker downloads them.
 */
async function createBlobUrl(dataUrl) {
  const response = await fetch(dataUrl);
  const url = URL.createObjectURL(await response.blob());
  blobUrls.add(url);
  return { url };
}

function releaseUrl(url) {
  if (blobUrls.delete(url)) {
    URL.revokeObjectURL(url);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen') {
    return undefined;
  }

  const handlers = {
    'tabCapture:offscreenStart': () => startRecording(message.streamId),
    'tabCapture:offscreenStop': () => stopRecording(),
    'tabCapture:offscreenBlobUrl': () => createBlobUrl(message.dataUrl),
    'tabCapture:offscreenRelease': () => {
      releaseUrl(message.url);
      return {};
    },
  };

  const handler = handlers[message.type];
  if (!handler) {
    return undefined;
  }

  Promise.resolve()
    .then(handler)
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((error) => {
      console.error('[Tab capture offscreen]', error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});
