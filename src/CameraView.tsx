import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, Check, X, AlertCircle, CameraOff } from 'lucide-react';
import { useCamera } from './useCamera';
import { builtinFrames, bundledFrames } from './frames';
import {
  APP_TITLE,
  FRAME_W,
  FRAME_H,
  TOTAL_SHOTS,
  SLOT_COUNT,
  SHOTS_PER_SLOT,
  COUNTDOWN_SECONDS,
  SHOT_DELAY_MS,
  slotIndexForShot,
  takeIndexForShot,
  type FrameTemplate,
  type Photo,
} from './types';

type Props = {
  onComplete: (photos: Photo[], frame: FrameTemplate) => void;
  onCancel: () => void;
};

export function CameraView({ onComplete, onCancel }: Props) {
  const { videoRef, isStreaming, facing, error, startCamera, switchCamera, capture, stopCamera } = useCamera();
  const [selectedFrame, setSelectedFrame] = useState<FrameTemplate>(builtinFrames[0]);
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'shooting' | 'done'>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [shots, setShots] = useState<Photo[]>([]);
  const [currentShot, setCurrentShot] = useState(0);
  const [flash, setFlash] = useState(false);
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const activeSlotIndex = slotIndexForShot(currentShot);
  const activeTake = takeIndexForShot(currentShot);
  const activeSlot = selectedFrame.slots[activeSlotIndex];
  const zooming = phase === 'countdown' || phase === 'shooting';

  useEffect(() => {
    startCamera(facing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedFrame.overlayUrl) {
      setOverlayImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setOverlayImg(img);
    img.src = selectedFrame.overlayUrl;
  }, [selectedFrame.overlayUrl]);

  // 프레임 오버레이 캔버스 제어
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);

    if (overlayImg) {
      ctx.drawImage(overlayImg, 0, 0, FRAME_W, FRAME_H);
    } else {
      ctx.fillStyle = selectedFrame.bgColor;
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);
      ctx.globalCompositeOperation = 'destination-out';
      for (const slot of selectedFrame.slots) {
        ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // 디지털 줌 연출을 위해 가이드는 깔끔한 흰색 테두리로 표시
    if (zooming && activeSlot) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 8;
      ctx.strokeRect(activeSlot.x, activeSlot.y, activeSlot.w, activeSlot.h);
    }
  }, [selectedFrame, overlayImg, zooming, activeSlot]);

  const runSequence = useCallback(async () => {
    const collected: Photo[] = [];

    for (let i = 0; i < TOTAL_SHOTS; i++) {
      setCurrentShot(i);
      setPhase('countdown');
      for (let c = COUNTDOWN_SECONDS; c > 0; c--) {
        setCountdown(c);
        await sleep(1000);
      }
      setCountdown(0);

      setPhase('shooting');
      const slot = selectedFrame.slots[slotIndexForShot(i)];
      const data = capture(slot);
      if (data) {
        setFlash(true);
        setTimeout(() => setFlash(false), 300);
        const photo: Photo = {
          id: `photo-${Date.now()}-${i}`,
          src: data,
          slotIndex: slotIndexForShot(i),
          takeIndex: takeIndexForShot(i),
        };
        collected.push(photo);
        setShots([...collected]);
      }

      if (i < TOTAL_SHOTS - 1) {
        await sleep(SHOT_DELAY_MS);
      }
    }

    setPhase('done');
  }, [capture, selectedFrame]);

  const handleStart = () => {
    setShots([]);
    setCurrentShot(0);
    runSequence();
  };

  const handleFinish = () => {
    const frame = {
      ...selectedFrame,
      slots: selectedFrame.slots.map((s, i) => ({
        ...s,
        photoId: shots.find((p) => p.slotIndex === i && p.takeIndex === 0)?.id ?? null,
      })),
    };
    stopCamera();
    onComplete(shots, frame);
  };

  const handleRetake = () => {
    setShots([]);
    setPhase('idle');
    setCurrentShot(0);
  };

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // [해결책 A 핵심] 사용자는 몸을 움직이지 않도록 비디오 중앙을 기준으로 현재 Slot 크기 비율에 맞게 디지털 줌 계산
  const slotScale = activeSlot
    ? Math.min(FRAME_W / activeSlot.w, FRAME_H / activeSlot.h) * 0.85
    : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-brand-100">
        <button
          onClick={() => { stopCamera(); onCancel(); }}
          className="flex items-center gap-1.5 text-gray-600 hover:text-brand-600 transition-colors"
        >
          <X size={20} />
          <span className="text-sm font-medium">나가기</span>
        </button>
        <h1 className="font-display text-lg text-brand-600">{APP_TITLE}</h1>
        <div className="w-16" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        <div className="relative w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl bg-black">
          {/* 중앙 기준 디지털 줌 적용 영역 */}
          <div
            className="absolute inset-0 camera-stage transition-transform duration-500 ease-out"
            style={{
              transform: zooming ? `scale(${slotScale})` : 'scale(1)',
              transformOrigin: 'center center',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>

          {flash && <div className="flash-overlay animate-flash" />}

          {phase === 'countdown' && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                key={countdown}
                className="font-display text-8xl text-white drop-shadow-lg animate-pop"
                style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
              >
                {countdown}
              </span>
            </div>
          )}

          {phase === 'shooting' && countdown === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-display text-5xl text-white drop-shadow-lg animate-pop">
                찰칵!
              </span>
            </div>
          )}

          {(phase === 'countdown' || phase === 'shooting') && (
            <div className="absolute top-3 left-3 bg-black/60 text-white text-sm px-3 py-1 rounded-full font-body z-10">
              칸 {activeSlotIndex + 1} · {activeTake + 1}/{SHOTS_PER_SLOT} · {currentShot + 1}/{TOTAL_SHOTS}
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white p-6 text-center gap-3 z-20">
              <AlertCircle size={40} className="text-brand-400" />
              <p className="text-sm font-body">{error}</p>
              <button
                onClick={() => startCamera(facing)}
                className="mt-2 px-4 py-2 bg-brand-500 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}

          {!isStreaming && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center gap-3 z-20">
              <CameraOff size={40} className="text-gray-400" />
              <p className="text-sm font-body text-gray-300">카메라를 시작하는 중...</p>
            </div>
          )}
        </div>

        {shots.length > 0 && (
          <div className="w-full max-w-sm">
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className="flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 border-brand-200 animate-scaleIn relative"
                >
                  <img src={shot.src} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5">
                    {shot.slotIndex + 1}-{shot.takeIndex + 1}
                  </span>
                </div>
              ))}
              {Array.from({ length: TOTAL_SHOTS - shots.length }).map((_, i) => {
                const idx = shots.length + i;
                return (
                  <div
                    key={`empty-${i}`}
                    className="flex-shrink-0 w-16 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
                  >
                    <span className="text-gray-400 text-xs">
                      {slotIndexForShot(idx) + 1}-{takeIndexForShot(idx) + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <div className="w-full max-w-sm">
            {bundledFrames.length === 0 ? (
              <p className="text-xs text-gray-500 text-center font-body">
                `public/frames` 폴더에 PNG 프레임을 넣어주세요 (1080×1920)
              </p>
            ) : bundledFrames.length > 1 ? (
              <>
                <p className="text-xs text-gray-500 mb-2 text-center font-body">촬영할 프레임</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 items-center justify-center">
                  {bundledFrames.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFrame(f)}
                      className={`flex-shrink-0 w-12 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                        selectedFrame.id === f.id
                          ? 'border-brand-500 ring-2 ring-brand-300 scale-105'
                          : 'border-gray-200 hover:border-brand-300'
                      }`}
                      title={f.name}
                    >
                      {f.overlayUrl ? (
                        <img src={f.overlayUrl} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: f.bgColor }} />
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 text-center font-body">{selectedFrame.name}</p>
            )}
          </div>
        )}
      </div>

      <footer className="px-4 py-4 bg-white/80 backdrop-blur-sm border-t border-brand-100">
        <div className="max-w-sm mx-auto flex items-center justify-center gap-3">
          {phase === 'idle' && (
            <>
              {isMobile && (
                <button
                  onClick={switchCamera}
                  disabled={!isStreaming}
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
                  title="카메라 전환"
                >
                  <SwitchCamera size={24} className="text-gray-700" />
                </button>
              )}
              <button
                onClick={handleStart}
                disabled={!isStreaming}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-brand-500 text-white rounded-xl font-display text-lg shadow-lg hover:bg-brand-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera size={22} />
                촬영 시작
              </button>
            </>
          )}

          {(phase === 'countdown' || phase === 'shooting') && (
            <div className="flex-1 flex items-center justify-center py-3.5 bg-gray-200 rounded-xl font-display text-lg text-gray-500">
              칸 {activeSlotIndex + 1}/{SLOT_COUNT} · {activeTake + 1}/{SHOTS_PER_SLOT}장
            </div>
          )}

          {phase === 'done' && (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center justify-center gap-2 px-5 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 active:scale-95 transition-all"
              >
                다시 촬영
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-brand-500 text-white rounded-xl font-display text-lg shadow-lg hover:bg-brand-600 active:scale-95 transition-all"
              >
                <Check size={22} />
                사진 고르기
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
