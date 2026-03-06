export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string | null;
}

export interface VideoConstraints {
  maxFileSize: number;
  minDuration: number;
  maxDuration: number;
  minWidth: number;
  minHeight: number;
}

export const UPLOAD_VIDEO_CONSTRAINTS: VideoConstraints = {
  maxFileSize: 500 * 1024 * 1024, // 500MB
  minDuration: 10,
  maxDuration: 600,
  minWidth: 720,
  minHeight: 1280,
};

const THUMBNAIL_QUALITY = 0.7;
const THUMBNAIL_SEEK_TIME = 1; // seconds

/**
 * Validate file size, duration, resolution; generate thumbnail at 1s mark.
 * Returns a promise that resolves with metadata or rejects with a user-facing error string.
 */
export function analyzeVideoFile(
  file: File,
  constraints: VideoConstraints = UPLOAD_VIDEO_CONSTRAINTS,
): Promise<VideoMetadata> {
  // Validate file size synchronously before creating video element
  if (file.size > constraints.maxFileSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(0);
    const maxMB = constraints.maxFileSize / (1024 * 1024);
    return Promise.reject(`File too large: ${sizeMB}MB (max ${maxMB}MB)`);
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.onloadedmetadata = () => {
      const { duration, videoWidth: width, videoHeight: height } = video;

      if (duration < constraints.minDuration || duration > constraints.maxDuration) {
        cleanup();
        reject(`Duration ${duration.toFixed(0)}s — must be ${constraints.minDuration}s to ${constraints.maxDuration / 60}min`);
        return;
      }

      if (width < constraints.minWidth || height < constraints.minHeight) {
        cleanup();
        reject(`Resolution ${width}x${height} — minimum ${constraints.minWidth}x${constraints.minHeight}`);
        return;
      }

      video.currentTime = Math.min(THUMBNAIL_SEEK_TIME, duration);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');

      let thumbnailUrl: string | null = null;
      if (context) {
        context.drawImage(video, 0, 0);
        thumbnailUrl = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY);
      }

      cleanup();
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        thumbnailUrl,
      });
    };

    video.onerror = () => {
      cleanup();
      reject('Unable to read video file. Please use a valid MP4.');
    };
  });
}
