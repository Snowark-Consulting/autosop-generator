/**
 * extracts a screenshot from a video file at a specific timestamp
 */
export const captureFrame = async (videoFile: File, timestampSeconds: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      // Seek to time
      video.currentTime = timestampSeconds;
    };

    video.onseeked = () => {
      // Draw to canvas
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(video.src);
          resolve(dataUrl);
        } else {
          reject(new Error('Could not get canvas context'));
        }
      } catch (e) {
        reject(e);
      }
    };

    video.onerror = (e) => {
      reject(e);
    };
  });
};

/**
 * Converts a file to base64 for Gemini API
 */
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Content = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Extracts a sequence of frames from the video to send to Gemini.
 * This reduces payload size significantly compared to sending the raw video.
 */
export const extractFramesFromVideo = async (videoFile: File, maxFrames = 45): Promise<Array<{ inlineData: { data: string; mimeType: string } }>> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.playsInline = true;

    const frames: Array<{ inlineData: { data: string; mimeType: string } }> = [];

    video.onloadedmetadata = async () => {
      const startProcessing = () => {
        const duration = video.duration;
        // Calculate interval to get roughly maxFrames
        const interval = Math.max(1, duration / maxFrames);
        
        let currentTime = 0;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const processFrame = () => {
          if (currentTime > duration || !isFinite(currentTime)) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
            return;
          }

          video.currentTime = currentTime;
        };

        video.onseeked = () => {
          if (!ctx) return;

          // Resize frame to reduce size (Gemini doesn't need 4k for context)
          // Max dimension 384px is enough for visual context without bloating payload
          const MAX_DIMENSION = 384;
          const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Low quality JPEG (0.5) is fine for AI context and saves roughly 20-30% vs 0.6
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          const base64Content = dataUrl.split(',')[1];

          frames.push({
            inlineData: {
              data: base64Content,
              mimeType: 'image/jpeg',
            },
          });

          currentTime += interval;
          processFrame();
        };

        // Start processing
        processFrame();
      };

      if (!isFinite(video.duration)) {
        // Workaround for WebM screen recordings with missing duration metadata
        video.onseeked = () => {
          video.onseeked = null;
          video.currentTime = 0;
          video.onseeked = () => {
            video.onseeked = null;
            startProcessing();
          };
        };
        video.currentTime = Number.MAX_SAFE_INTEGER;
      } else {
        startProcessing();
      }

      video.onerror = (e) => reject(e);
    };
  });
};