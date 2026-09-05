/**
 * Extracts audio from a video file, downsamples it to 8kHz mono 8-bit WAV to save space,
 * and returns it as a base64 encoded string for the Gemini API.
 */
export const extractAudioFromVideo = async (videoFile: File): Promise<{ inlineData: { data: string; mimeType: string } } | null> => {
  try {
    // 1. Read file into ArrayBuffer
    const arrayBuffer = await videoFile.arrayBuffer();
    
    // 2. Decode audio data using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // If no audio track or empty
    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn("No audio extracted from video.");
      return null;
    }

    // 3. Resample to 8kHz Mono and 8-bit depth
    // 8kHz is sufficient for speech recognition (telephone quality).
    // 8-bit depth cuts size in half vs 16-bit.
    // 8000Hz * 1 channel * 1 byte = 8KB/s.
    // 30 mins = 14.4MB (binary) -> ~19.2MB (Base64).
    // This allows us to process up to ~30 minutes of video within the 20MB Gemini payload limit.
    const TARGET_SAMPLE_RATE = 8000;
    const MAX_DURATION_SECONDS = 1800; // 30 Minutes
    
    const durationToProcess = Math.min(audioBuffer.duration, MAX_DURATION_SECONDS);
    
    if (audioBuffer.duration > MAX_DURATION_SECONDS) {
        console.warn(`Audio truncated: Video is ${audioBuffer.duration}s, analyzing first ${MAX_DURATION_SECONDS}s only.`);
    }

    // Create an OfflineAudioContext to render the new audio
    const offlineCtx = new OfflineAudioContext(1, durationToProcess * TARGET_SAMPLE_RATE, TARGET_SAMPLE_RATE);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    
    const resampledBuffer = await offlineCtx.startRendering();
    
    // 4. Convert AudioBuffer to 8-bit WAV Blob
    const wavBlob = audioBufferTo8BitWav(resampledBuffer);
    
    // 5. Convert Blob to Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Result is "data:audio/wav;base64,......"
        const base64 = result.split(',')[1];
        resolve({
          inlineData: {
            data: base64,
            mimeType: 'audio/wav'
          }
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(wavBlob);
    });

  } catch (error) {
    console.error("Audio extraction failed:", error);
    return null;
  }
};

/**
 * Helper to convert an AudioBuffer to an 8-bit Mono WAV file Blob.
 */
function audioBufferTo8BitWav(buffer: AudioBuffer): Blob {
  const numOfChan = 1; // We forced mono above
  const length = buffer.length * numOfChan + 44; // 8-bit = 1 byte per sample
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // Write WAV Header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * numOfChan); // avg. bytes/sec (SampleRate * 1byte * 1channel)
  setUint16(numOfChan); // block-align (1 byte per block for 8-bit mono)
  setUint16(8); // 8-bit resolution

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Get channel data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  // Write interleaved data (only 1 channel effectively)
  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // Clamp the value to [-1, 1]
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      // Convert to 0-255 (unsigned 8-bit), with 128 as silence
      // (sample + 1) / 2 * 255
      sample = ((sample + 1) / 2 * 255);
      view.setUint8(44 + offset, sample);
      offset += 1;
    }
    pos++;
  }

  return new Blob([outBuffer], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}