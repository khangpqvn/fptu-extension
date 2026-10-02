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
const MIME_CANDIDATES = {
  audio: [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ],
  videoOnly: [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ],
};

let recorder = null;
let chunks = [];
let audioContext = null;
let recordingStreams = [];
let recordingStream = null;
let audioDestination = null;
let recordingMetadata = null;
const blobUrls = new Set();

function pickMimeType(hasAudio) {
  const candidates = hasAudio ? MIME_CANDIDATES.audio : MIME_CANDIDATES.videoOnly;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function tabConstraint(streamId) {
  return {
    mandatory: {
      chromeMediaSource: 'tab',
      chromeMediaSourceId: streamId,
    },
  };
}

function getElapsedMs(metadata = recordingMetadata) {
  if (!metadata) {
    return 0;
  }

  const currentPauseMs = metadata.paused ? Date.now() - metadata.pausedAt : 0;
  return Math.max(0, Date.now() - metadata.startedAt - metadata.pausedDurationMs - currentPauseMs);
}

function getRecordingMetadata() {
  if (!recordingMetadata) {
    return { recording: false };
  }

  return {
    recording: true,
    paused: recordingMetadata.paused,
    startedAt: recordingMetadata.startedAt,
    includeTabAudio: recordingMetadata.includeTabAudio,
    includeMicrophone: recordingMetadata.includeMicrophone,
    pausedAt: recordingMetadata.pausedAt,
    pausedDurationMs: recordingMetadata.pausedDurationMs,
    elapsedMs: getElapsedMs(),
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
  recordingMetadata = null;
  location.hash = '';
}

function setRecordingHash() {
  const {
    startedAt,
    includeTabAudio,
    includeMicrophone,
    paused,
    pausedAt,
    pausedDurationMs,
  } = recordingMetadata;
  const audioMode = `${includeTabAudio ? '1' : '0'}${includeMicrophone ? '1' : '0'}`;
  location.hash = `recording:${startedAt}:${audioMode}:${paused ? 'paused' : 'active'}:${pausedAt || 0}:${pausedDurationMs}`;
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

    const mimeType = pickMimeType(recordingStream.getAudioTracks().length > 0);
    recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunks.push(event.data);
      }
    };
    recorder.start();

    recordingMetadata = {
      startedAt: Date.now(),
      includeTabAudio,
      includeMicrophone,
      paused: false,
      pausedAt: null,
      pausedDurationMs: 0,
    };
    setRecordingHash();
    return getRecordingMetadata();
  } catch (error) {
    await cleanupRecording();
    throw error;
  }
}

function pauseRecording() {
  if (!recorder || recorder.state !== 'recording' || !recordingMetadata) {
    throw new Error('Phiên ghi hình không thể tạm dừng.');
  }

  recorder.pause();
  recordingMetadata.paused = true;
  recordingMetadata.pausedAt = Date.now();
  setRecordingHash();
  return getRecordingMetadata();
}

function resumeRecording() {
  if (!recorder || recorder.state !== 'paused' || !recordingMetadata?.pausedAt) {
    throw new Error('Phiên ghi hình không thể tiếp tục.');
  }

  recorder.resume();
  recordingMetadata.pausedDurationMs += Date.now() - recordingMetadata.pausedAt;
  recordingMetadata.paused = false;
  recordingMetadata.pausedAt = null;
  setRecordingHash();
  return getRecordingMetadata();
}

function stopRecording() {
  if (!recorder || !['recording', 'paused'].includes(recorder.state)) {
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
    try {
      activeRecorder.stop();
    } catch (error) {
      fail(error);
    }
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

async function getMicrophonePermission() {
  const permission = await navigator.permissions.query({ name: 'microphone' });
  return { state: permission.state };
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
    'tabCapture:offscreenPause': () => pauseRecording(),
    'tabCapture:offscreenResume': () => resumeRecording(),
    'tabCapture:offscreenStop': () => stopRecording(),
    'tabCapture:offscreenBlobUrl': () => createBlobUrl(message.dataUrl),
    'tabCapture:offscreenMicrophonePermission': () => getMicrophonePermission(),
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
