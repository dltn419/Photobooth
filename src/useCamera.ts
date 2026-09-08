import { useRef, useState, useCallback, useEffect } from 'react';
import { FRAME_W, FRAME_H } from './types';

type Facing = 'user' | 'environment';

export type CaptureRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [facing, setFacing] = useState<Facing>('user');
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (mode: Facing) => {
    setError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsStreaming(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '카메라를 시작할 수 없습니다';
      setError(msg);
      setIsStreaming(false);
    }
  }, []);

  const switchCamera = useCallback(() => {
    const next: Facing = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    startCamera(next);
  }, [facing, startCamera]);

  const capture = useCallback((region?: CaptureRegion): string | null => {
    if (!videoRef.current || !isStreaming) return null;

    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return null;

    const crop = region ?? { x: 0, y: 0, w: FRAME_W, h: FRAME_H };

    const cover = document.createElement('canvas');
    cover.width = FRAME_W;
    cover.height = FRAME_H;
    const cctx = cover.getContext('2d')!;

    const canvasRatio = FRAME_W / FRAME_H;
    const videoRatio = vw / vh;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (videoRatio > canvasRatio) {
      sw = vh * canvasRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / canvasRatio;
      sy = (vh - sh) / 2;
    }

    if (facing === 'user') {
      cctx.translate(FRAME_W, 0);
      cctx.scale(-1, 1);
    }
    cctx.drawImage(video, sx, sy, sw, sh, 0, 0, FRAME_W, FRAME_H);
    cctx.setTransform(1, 0, 0, 1, 0, 0);

    const outW = Math.round(crop.w * 2);
    const outH = Math.round(crop.h * 2);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    out.getContext('2d')!.drawImage(
      cover,
      crop.x, crop.y, crop.w, crop.h,
      0, 0, outW, outH,
    );

    return out.toDataURL('image/jpeg', 0.92);
  }, [isStreaming, facing]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    videoRef,
    isStreaming,
    facing,
    error,
    startCamera,
    switchCamera,
    capture,
    stopCamera,
  };
}
