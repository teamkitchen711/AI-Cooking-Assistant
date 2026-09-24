/*
 * AudioStreamer handles Web Audio capture (16kHz PCM) and playback (24kHz PCM)
 * for the Chef Bon Gemini Live Voice experience.
 */

// Converts Float32Array to 16-bit linear PCM Int16Array
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

// Converts Uint8Array to base64 string
function uint8ToBase64(uint8Array) {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary);
}

// Converts base64 string to Float32Array for 16-bit PCM
function base64ToFloat32(base64Str) {
  const binary = window.atob(base64Str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

// Downsamples float audio buffer from inRate to outRate (16kHz)
function downsampleBuffer(buffer, inRate, outRate = 16000) {
  if (inRate === outRate) return buffer;
  const ratio = inRate / outRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export class AudioStreamer {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.playbackContext = null;
    this.nextPlayTime = 0;
    this.activeSources = [];
    this.isRecording = false;
  }

  /**
   * Starts recording audio from user's microphone.
   * Chunks are downsampled to 16kHz PCM and emitted via onAudioData(base64Chunk).
   */
  async startRecording({ onAudioData, onVolumeChange }) {
    if (this.isRecording) return;

    // Initialize AudioContext for recording
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Buffer size 4096 gives ~85-90ms chunks at 44.1/48kHz
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const input = e.inputBuffer.getChannelData(0);

      // Volume calculation for visual audio meter
      if (onVolumeChange) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
          sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);
        onVolumeChange(Math.min(1, rms * 5));
      }

      // Downsample to 16kHz and convert to 16-bit PCM
      const downsampled = downsampleBuffer(input, this.audioContext.sampleRate, 16000);
      const pcmBytes = floatTo16BitPCM(downsampled);
      const base64Chunk = uint8ToBase64(pcmBytes);

      if (onAudioData) {
        onAudioData(base64Chunk);
      }
    };

    this.sourceNode.connect(this.processorNode);
    // Connect to destination to keep ScriptProcessor running (Chrome requirement)
    this.processorNode.connect(this.audioContext.destination);

    this.isRecording = true;
  }

  /**
   * Stops recording and releases hardware microphone tracks.
   */
  stopRecording() {
    this.isRecording = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch (_) {}
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
  }

  /**
   * Queues and smoothly schedules 24kHz raw PCM audio chunks received from Gemini Live.
   */
  playPcmChunk(base64Chunk) {
    if (!base64Chunk) return;

    if (!this.playbackContext || this.playbackContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = 0;
    }

    if (this.playbackContext.state === 'suspended') {
      this.playbackContext.resume();
    }

    try {
      const float32Samples = base64ToFloat32(base64Chunk);
      const audioBuffer = this.playbackContext.createBuffer(1, float32Samples.length, 24000);
      audioBuffer.copyToChannel(float32Samples, 0);

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);

      const currentTime = this.playbackContext.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      source.start(startTime);

      this.nextPlayTime = startTime + audioBuffer.duration;
      this.activeSources.push(source);

      source.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== source);
      };
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }

  /**
   * Immediately halts any current audio playback (e.g. on user barge-in / interruption).
   */
  stopPlayback() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    });
    this.activeSources = [];
    if (this.playbackContext) {
      this.nextPlayTime = this.playbackContext.currentTime;
    }
  }

  /**
   * Completely tears down both recording and playback.
   */
  close() {
    this.stopRecording();
    this.stopPlayback();
    if (this.playbackContext) {
      try {
        this.playbackContext.close();
      } catch (_) {}
      this.playbackContext = null;
    }
  }
}
