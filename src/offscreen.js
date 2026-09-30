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
let recordingStreams = [];
let recordingStream = null;
let audioDestination = null;
const blobUrls = new Set();

function pickMimeType() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function tabConstraint(streamId) {
  return {
    mandatory: {
      chromeMediaSource: 'tab',
      chromeMediaSourceId: streamId,
    },
  };
}

async function cleanupRecording() {
  recordingStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  recordingStreams = [];
  recordingStream?.getTracks().forEach((track) => track.stop());
  recordingStream = null;
  audioDestination?.stream.getTracks().forEach((track) => track.stop());
  audioDestination = null;

  const context = audioContext;
  audioContext = null;
  if (context && context.state !== 'closed') {
    await context.close().catch(() => {});
  }

  recorder = null;
  chunks = [];
  location.hash = '';
}

function setRecordingHash(startedAt, includeTabAudio, includeMicrophone) {
  const audioMode = `${includeTabAudio ? '1' : '0'}${includeMicrophone ? '1' : '0'}`;
  location.hash = `recording:${startedAt}:${audioMode}`;
}

async function startRecording(streamId, includeTabAudio, includeMicrophone) {
  if (recorder) {
    throw new Error('Đang có một phiên ghi hình khác.');
  }

  let tabStream;
  let microphoneStream;
  try {
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: includeTabAudio ? tabConstraint(streamId) : false,
      video: tabConstraint(streamId),
    });
    recordingStreams.push(tabStream);

    if (includeMicrophone) {
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        throw new Error('Không thể dùng microphone. Hãy cấp quyền microphone rồi thử lại.');
      }
      recordingStreams.push(microphoneStream);
    }

    recordingStream = new MediaStream(tabStream.getVideoTracks());
    if (includeTabAudio || includeMicrophone) {
      audioContext = new AudioContext();
      audioDestination = audioContext.createMediaStreamDestination();

      if (includeTabAudio && tabStream.getAudioTracks().length) {
        const tabSource = audioContext.createMediaStreamSource(tabStream);
        tabSource.connect(audioDestination);
        // getUserMedia on a tab stream mutes the tab, so route only tab audio
        // back to the speakers. Never play the microphone to avoid feedback.
        tabSource.connect(audioContext.destination);
      }

      if (includeMicrophone && microphoneStream?.getAudioTracks().length) {
        const microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
        microphoneSource.connect(audioDestination);
      }

      audioDestination.stream.getAudioTracks().forEach((track) => recordingStream.addTrack(track));
    }

    const mimeType = pickMimeType();
    recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunks.push(event.data);
      }
    };
    recorder.start();

    const startedAt = Date.now();
    setRecordingHash(startedAt, includeTabAudio, includeMicrophone);
    return { startedAt, includeTabAudio, includeMicrophone };
  } catch (error) {
    await cleanupRecording();
    throw error;
  }
}

function stopRecording() {
  if (!recorder) {
    throw new Error('Chưa bắt đầu ghi hình.');
  }

  const activeRecorder = recorder;
  const mimeType = activeRecorder.mimeType || 'video/webm';

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = async (error) => {
      if (settled) {
        return;
      }
      settled = true;
      await cleanupRecording();
      reject(error);
    };

    activeRecorder.onerror = (event) => {
      fail(event.error || new Error('Ghi hình thất bại.'));
    };
    activeRecorder.onstop = async () => {
      if (settled) {
        return;
      }
      settled = true;
      const blob = new Blob(chunks, { type: mimeType });
      await cleanupRecording();
      const url = URL.createObjectURL(blob);
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
    'tabCapture:offscreenStart': () => startRecording(
      message.streamId,
      message.includeTabAudio,
      message.includeMicrophone,
    ),
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
