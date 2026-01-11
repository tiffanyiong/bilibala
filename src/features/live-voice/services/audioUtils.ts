export type AudioBlob = { data: string; mimeType: string };

// Decodes base64 raw PCM string to a Uint8Array
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encodes Uint8Array to base64 string
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decodes raw PCM data into an AudioBuffer for playback
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Ensure the byte length is even to prevent Int16Array construction errors
  // If odd, slice off the last byte
  const bufferView = data.byteLength % 2 === 0 
      ? data 
      : data.subarray(0, data.byteLength - 1);

  // Use byteOffset and byteLength to safely create the view on the underlying buffer
  const dataInt16 = new Int16Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Converts Microphone Float32 data to Int16 PCM Blob for the API
export function createPcmBlob(data: Float32Array, sampleRate: number): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] before scaling
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

// Simple downsampler for voice input. Live audio commonly expects 16kHz PCM.
export function downsampleBuffer(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (outputSampleRate === inputSampleRate) return input;
  if (outputSampleRate > inputSampleRate) {
    // Avoid upsampling here (not needed for voice input).
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.floor(input.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetInput = 0;
  while (offsetResult < result.length) {
    const nextOffsetInput = Math.floor((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = count ? accum / count : input[offsetInput] || 0;
    offsetResult++;
    offsetInput = nextOffsetInput;
  }

  return result;
}

export function createPcmBlob16k(
  input: Float32Array,
  inputSampleRate: number,
): AudioBlob {
  const TARGET = 16000;
  const downsampled = downsampleBuffer(input, inputSampleRate, TARGET);
  return createPcmBlob(downsampled, TARGET);
}

// Converts float32 samples to 16-bit PCM ArrayBuffer (little-endian).
export function float32To16BitPcmBuffer(input: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

// Create 16kHz PCM bytes suitable for sending as a binary websocket frame.
export function createPcm16kArrayBuffer(input: Float32Array, inputSampleRate: number): ArrayBuffer {
  const TARGET = 16000;
  const downsampled = downsampleBuffer(input, inputSampleRate, TARGET);
  return float32To16BitPcmBuffer(downsampled);
}