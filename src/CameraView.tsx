// src/CameraView.tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera } from 'lucide-react';
import { defaultSlots } from './frames';
import { APP_TITLE, FRAME_W, FRAME_H, SLOT_COUNT, TAKES_PER_SLOT, type FrameTemplate, type Photo } from './types';
import { sound } from './sound';

type Props = {
  frame: FrameTemplate;
  timerSeconds: number; // 프레임 고를 때 선택한 카운트다운 초
  onComplete: (photos: Photo[]) => void;
};

export function CameraView({ frame, timerSeconds, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [currentTake, setCurrentTake] = useState(0);
  const [isShooting, setIsShooting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  const totalPhotos = SLOT_COUNT * TAKES_PER_SLOT;
  const currentPhotoIndex = currentSlot * TAKES_PER_SLOT + currentTake;

  // 카메라 스트림 켜기
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      alert('카메라 권한을 확인해주세요.');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // 사진 캡처
  const capturePhoto = useCallback(() => {
    sound.playShutter();
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    const slot = defaultSlots[currentSlot];
    canvas.width = slot.w;
    canvas.height = slot.h;
    const ctx = canvas.getContext('2d')!;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetRatio = slot.w / slot.h;
    let sw = vw, sh = vh, sx = 0, sy = 0;

    if (vw / vh > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, slot.w, slot.h);

    const newPhoto: Photo = {
      id: `photo-${currentSlot}-${currentTake}-${Date.now()}`,
      slotIndex: currentSlot,
      takeIndex: currentTake,
      src: canvas.toDataURL('image/jpeg', 0.95),
    };

    setPhotos((prev) => {
      const updated = [...prev, newPhoto];
      if (updated.length >= totalPhotos) {
        setTimeout(() => onComplete(updated), 500);
      }
      return updated;
    });

    if (currentTake + 1 < TAKES_PER_SLOT) {
      setCurrentTake(currentTake + 1);
    } else if (currentSlot + 1 < SLOT_COUNT) {
      setCurrentSlot(currentSlot + 1);
      setCurrentTake(0);
    }
  }, [currentSlot, currentTake, facingMode, totalPhotos, onComplete]);

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      sound.playBeep();
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      capturePhoto();
      setCountdown(null);
      if (currentPhotoIndex + 1 < totalPhotos) {
        setTimeout(() => setCountdown(timerSeconds), 1000);
      } else {
        setIsShooting(false);
      }
    }
  }, [countdown, capturePhoto, currentPhotoIndex, totalPhotos, timerSeconds]);

  const handleStartShooting = () => {
    setIsShooting(true);
    setCountdown(timerSeconds);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="relative min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-between p-4 select-none">
      {flash && <div className="absolute inset-0 bg-white z-50 transition-opacity duration-150" />}

      {/* 상단 헤더 */}
      <header className="w-full max-w-2xl flex items-center justify-between py-2 z-10">
        <h1 className="font-display text-xl text-brand-400">{APP_TITLE}</h1>
        
        {/* 전/후면 카메라 전환 버튼 */}
        <button
          onClick={toggleCamera}
          disabled={isShooting}
          className="p-2.5 bg-neutral-800/80 hover:bg-neutral-700 rounded-xl border border-neutral-700 text-gray-300 active:scale-95 transition-all disabled:opacity-50"
          title="카메라 전환"
        >
          <SwitchCamera size={20} />
        </button>
      </header>

      {/* 메인 카메라 가이드 미리보기 */}
      <div className="relative w-full max-w-sm aspect-[1181/1748] rounded-2xl overflow-hidden bg-black shadow-2xl flex items-center justify-center border border-neutral-800">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* 2×2 빨간 가이드 선 */}
        <div className="absolute inset-0 pointer-events-none">
          {defaultSlots.map((slot, idx) => {
            const isCurrent = isShooting && idx === currentSlot;
            return (
              <div
                key={idx}
                className={`absolute border-2 transition-all duration-300 ${
                  isCurrent
                    ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : 'border-white/30'
                }`}
                style={{
                  left: `${(slot.x / FRAME_W) * 100}%`,
                  top: `${(slot.y / FRAME_H) * 100}%`,
                  width: `${(slot.w / FRAME_W) * 100}%`,
                  height: `${(slot.h / FRAME_H) * 100}%`,
                }}
              >
                <span className="absolute top-1 left-1 bg-black/60 text-[10px] px-1.5 py-0.5 rounded text-white/80">
                  {idx + 1}번 칸 ({currentSlot === idx ? `${currentTake + 1}/2` : '대기'})
                </span>
              </div>
            );
          })}
        </div>

        {/* 대형 숫자 카운트다운 */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-20">
            <span className="font-display text-8xl text-white drop-shadow-lg animate-ping">
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* 하단 제어부 */}
      <footer className="w-full max-w-2xl flex flex-col items-center gap-3 py-4 z-10">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">
            {isShooting
              ? `${currentSlot + 1}번째 칸의 ${currentTake + 1}번째 촬영 중...`
              : `설정된 카운트다운: ${timerSeconds}초`}
          </p>
        </div>

        <button
          onClick={handleStartShooting}
          disabled={isShooting}
          className="flex items-center gap-2 px-8 py-4 bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-700 text-white rounded-2xl font-display text-lg shadow-lg active:scale-95 transition-all"
        >
          <Camera size={22} />
          {isShooting ? '촬영 진행 중...' : '촬영 시작'}
        </button>
      </footer>
    </div>
  );
}
