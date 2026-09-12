// src/CameraView.tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, Check, X, AlertCircle, CameraOff, Timer } from 'lucide-react';
import { useCamera } from './useCamera';
import { builtinFrames, bundledFrames } from './frames';
import {
  APP_TITLE,
  FRAME_W,
  FRAME_H,
  TOTAL_SHOTS,
  SLOT_COUNT,
  SHOTS_PER_SLOT,
  SHOT_DELAY_MS,
  slotIndexForShot,
  takeIndexForShot,
  type FrameTemplate,
  type Photo,
} from './types';

type Props = {
  initialFrame?: FrameTemplate;
  timerSeconds?: number;
  onComplete: (photos: Photo[], frame: FrameTemplate) => void;
  onCancel: () => void;
};

export function CameraView({ initialFrame, timerSeconds = 5, onComplete, onCancel }: Props) {
  const { videoRef, isStreaming, facing, error, startCamera, switchCamera, stopCamera } = useCamera();
  const [selectedFrame, setSelectedFrame] = useState<FrameTemplate>(
    initialFrame ?? builtinFrames[0]
  );
  const [selectedTimer, setSelectedTimer] = useState<number>(timerSeconds);
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'shooting' | 'done'>('idle');
  const [countdown, setCountdown] = useState<number>(selectedTimer);
  const [shots, setShots] = useState<Photo[]>([]);
  const [currentShot, setCurrentShot] = useState(0);
  const [flash, setFlash] = useState(false);
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
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

  // UI용 Zoom In 연출 계산 (CP1300 해상도 1181x1748 기준)
  const targetCenterX = activeSlot ? activeSlot.x + activeSlot.w / 2 : FRAME_W / 2;
  const targetCenterY = activeSlot ? activeSlot.y + activeSlot.h / 2 : FRAME_H / 2;

  const rawScale = activeSlot ? Math.min(FRAME_W / activeSlot.w, FRAME_H / activeSlot.h) : 1;
  const frameScale = activeSlot ? rawScale * 0.75 : 1;

  const frameOffsetX = activeSlot ? ((FRAME_W / 2 - targetCenterX) / FRAME_W) * 100 * frameScale : 0;
  const frameOffsetY = activeSlot ? ((FRAME_H / 2 - targetCenterY) / FRAME_H) * 100 * frameScale : 0;

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

    if (zooming && activeSlot) {
      ctx.strokeStyle = '#FF3B30';
      ctx.lineWidth = 10;
      ctx.strokeRect(activeSlot.x, activeSlot.y, activeSlot.w, activeSlot.h);
    }
  }, [selectedFrame, overlayImg, zooming, activeSlot]);

  // [고정 비디오 - 프레임 절대좌표 1:1 정밀 캡처]
  const captureVisibleArea = useCallback((slot: typeof activeSlot) => {
    const video = videoRef.current;
    if (!video || !slot || !video.videoWidth || !video.videoHeight) return null;

    // 1. 슬롯 원래 크기의 오프스크린 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.width = slot.w;
    canvas.height = slot.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;

    // 2. object-cover로 1181:1748 스테이지에 맞춰진 비디오 원본의 가시 영역 계산
    const stageAspect = FRAME_W / FRAME_H;
    const videoAspect = vWidth / vHeight;

    let visibleVWidth = vWidth;
    let visibleVHeight = vHeight;
    let visibleVLeft = 0;
    let visibleVTop = 0;

    if (videoAspect > stageAspect) {
      // 비디오가 더 넓은 경우 (좌우 잘림)
      visibleVWidth = vHeight * stageAspect;
      visibleVLeft = (vWidth - visibleVWidth) / 2;
    } else {
      // 비디오가 더 길쭉한 경우 (상하 잘림)
      visibleVHeight = vWidth / stageAspect;
      visibleVTop = (vHeight - visibleVHeight) / 2;
    }

    // 3. 슬롯의 절대좌표(x, y, w, h)를 1181x1748 전체 비율상 위치로 정규화(0.0 ~ 1.0)
    const normX = slot.x / FRAME_W;
    const normY = slot.y / FRAME_H;
    const normW = slot.w / FRAME_W;
    const normH = slot.h / FRAME_H;

    // 4. 비디오 가시 영역 내의 실제 픽셀 좌표 매핑
    let sourceX = visibleVLeft + normX * visibleVWidth;
    let sourceY = visibleVTop + normY * visibleVHeight;
    let sourceWidth = normW * visibleVWidth;
    let sourceHeight = normH * visibleVHeight;

    // 5. 셀카(전면 카메라) 좌우 반전 처리
    if (facing === 'user') {
      sourceX = vWidth - sourceX - sourceWidth;
      ctx.translate(slot.w, 0);
      ctx.scale(-1, 1);
    }

    // 6. 정확한 원본 구역 크롭
    ctx.drawImage(
      video,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      sourceWidth,
      sourceHeight,
      0,
      0,
      slot.w,
      slot.h
    );

    return canvas.toDataURL('image/jpeg', 0.95);
  }, [facing, videoRef]);

  const runSequence = useCallback(async () => {
    const collected: Photo[] = [];

    for (let i = 0; i < TOTAL_SHOTS; i++) {
      setCurrentShot(i);
      setPhase('countdown');

      for (let c = selectedTimer; c > 0; c--) {
        setCountdown(c);
        await sleep(1000);
      }
      setCountdown(0);

      setPhase('shooting');
      const slot = selectedFrame.slots[slotIndexForShot(i)];
      const data = captureVisibleArea(slot);

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
  }, [captureVisibleArea, selectedFrame, selectedTimer]);

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
  const framesList = bundledFrames.length > 0 ? bundledFrames : builtinFrames;

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
        {/* CP1300 인쇄 비율(1181/1748) 적용 스테이지 */}
        <div 
          ref={stageRef}
          className="relative w-full max-w-sm aspect-[1181/1748] rounded-2xl overflow-hidden shadow-2xl bg-black"
        >
          {/* 고정된 카메라 비디오 스트림 */}
          <div className="absolute inset-0 camera-stage">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          </div>

          {/* 이동 및 Zoom In 연출용 프레임 오버레이 */}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-in-out"
            style={{
              transform: zooming
                ? `translate(${frameOffsetX}%, ${frameOffsetY}%) scale(${frameScale})`
                : 'none',
              transformOrigin: 'center center',
            }}
          >
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full" />
          </div>

          {flash && <div className="flash-overlay animate-flash" />}

          {/* 촬영 상태 표시 뱃지 */}
          {(phase === 'countdown' || phase === 'shooting') && (
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-sm px-3.5 py-1.5 rounded-full font-body z-10 flex items-center gap-2 border border-white/20 shadow-md">
              <span>
                칸 {activeSlotIndex + 1} · {activeTake + 1}/{SHOTS_PER_SLOT} · {currentShot + 1}/{TOTAL_SHOTS}
              </span>
              {phase === 'countdown' && countdown > 0 && (
                <>
                  <span className="w-px h-3.5 bg-white/40" />
                  <span 
                    key={countdown}
                    className="font-display text-amber-400 font-bold text-base animate-pulse"
                  >
                    {countdown}s
                  </span>
                </>
              )}
              {phase === 'shooting' && (
                <>
                  <span className="w-px h-3.5 bg-white/40" />
                  <span className="font-display text-emerald-400 font-bold text-xs animate-bounce">
                    찰칵!
                  </span>
                </>
              )}
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

        {/* 하단 사진 썸네일 스트립 */}
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

        {/* 대기 메뉴 */}
        {phase === 'idle' && (
          <div className="w-full max-w-sm flex flex-col gap-3">
            <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-brand-100">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Timer size={14} className="text-brand-500" /> 타이머
              </span>
              <div className="flex gap-1">
                {[5, 8, 10].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setSelectedTimer(sec)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedTimer === sec
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sec}초
                  </button>
                ))}
              </div>
            </div>

            {framesList.length > 1 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 text-center font-body">촬영할 프레임</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 items-center justify-center">
                  {framesList.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFrame(f)}
                      className={`flex-shrink-0 w-12 h-[71px] rounded-lg border-2 overflow-hidden transition-all ${
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
              </div>
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
                촬영 시작 ({selectedTimer}초)
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
