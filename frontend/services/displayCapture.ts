export type DisplayCaptureFailureCode =
  | 'DISPLAY_CAPTURE_UNAVAILABLE'
  | 'DISPLAY_CAPTURE_CANCELLED'
  | 'DISPLAY_CAPTURE_NO_VIDEO_TRACK'
  | 'DISPLAY_CAPTURE_INVALID_STATE'
  | 'DISPLAY_CAPTURE_FAILED';

export class DisplayCaptureFailure extends Error {
  constructor(
    public readonly code: DisplayCaptureFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'DisplayCaptureFailure';
  }
}

/**
 * A browser may still offer a tab or an entire display in its picker. These
 * constraints only request video and keep audio out of the capture scope.
 */
export const LIVE_DISPLAY_CAPTURE_CONSTRAINTS: DisplayMediaStreamConstraints = {
  video: {
    displaySurface: 'window',
    frameRate: { ideal: 30, max: 30 },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};

export interface ActiveDisplayCapture {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
  resolution: string;
}

type DisplayMediaDevice = Pick<MediaDevices, 'getDisplayMedia'>;

export function isDisplayCaptureSupported(
  mediaDevices: DisplayMediaDevice | null | undefined,
): mediaDevices is DisplayMediaDevice {
  return typeof mediaDevices?.getDisplayMedia === 'function';
}

export function stopDisplayCapture(stream: Pick<MediaStream, 'getTracks'> | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function requestLiveDisplayCapture(
  mediaDevices: DisplayMediaDevice | null | undefined,
): Promise<ActiveDisplayCapture> {
  if (!isDisplayCaptureSupported(mediaDevices)) {
    throw new DisplayCaptureFailure(
      'DISPLAY_CAPTURE_UNAVAILABLE',
      'Live screen sharing is not available in this browser context. Nothing is being captured.',
    );
  }

  let stream: MediaStream;
  try {
    stream = await mediaDevices.getDisplayMedia(LIVE_DISPLAY_CAPTURE_CONSTRAINTS);
  } catch (error) {
    throw toDisplayCaptureFailure(error);
  }

  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    stopDisplayCapture(stream);
    throw new DisplayCaptureFailure(
      'DISPLAY_CAPTURE_NO_VIDEO_TRACK',
      'The selected source did not provide a video track. Nothing is being observed.',
    );
  }

  const { width, height } = videoTrack.getSettings();
  return {
    stream,
    videoTrack,
    resolution: width && height ? `${width}x${height}` : 'reported by browser',
  };
}

export function toDisplayCaptureFailure(error: unknown): DisplayCaptureFailure {
  if (error instanceof DisplayCaptureFailure) return error;

  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : '';

  if (name === 'NotAllowedError' || name === 'AbortError') {
    return new DisplayCaptureFailure(
      'DISPLAY_CAPTURE_CANCELLED',
      'Screen sharing was cancelled. The Studio has not received any display frames.',
    );
  }

  if (name === 'InvalidStateError') {
    return new DisplayCaptureFailure(
      'DISPLAY_CAPTURE_INVALID_STATE',
      'Screen sharing must be started directly from the “Choose source” button.',
    );
  }

  return new DisplayCaptureFailure(
    'DISPLAY_CAPTURE_FAILED',
    'Screen sharing could not start. The Studio is not observing display frames.',
  );
}
