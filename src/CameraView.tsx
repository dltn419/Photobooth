// src/CameraView.tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, Check, X, AlertCircle, CameraOff, Timer, Sparkles } from 'lucide-react';
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

// 보정 필터 옵션 정의
const PHOTO_FILTERS = [
  { id: 'none', name: '원본', css: 'none' },
  { id: 'bright', name: '뽀샤시', css: 'brightness(1.08) contrast(1.05) saturate(1.1)' },
  { id: 'vintage', name: '빈티지', css: 'sepia(0.25) contrast(0.95) saturate(0.85) brightness(1.02)' },
  { id: 'bw', name: '흑백', css: 'grayscale(1) contrast(1.15) brightness(1.05)' },
] as const;

type FilterId = typeof PHOTO_FILTERS[number]['id'];

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
  const [selectedFilter, setSelectedFilter] = useState<FilterId>('bright'); // 기본값: 뽀샤시
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

  const currentFilterCss = PHOTO_FILTERS.find((f) => f.id === selectedFilter)?.css ?? 'none';

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

  // 프레임 이동 및 줌 스케일 계산
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

  // [필터 보정 적용 정밀 캡처]
  const captureVisibleArea = useCallback((slot: typeof activeSlot) => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !slot || !stage || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = slot.w;
    canvas.height = slot.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const stageRect = stage.getBoundingClientRect();

    const offsetXPx = ((FRAME_W / 2 - targetCenterX) / FRAME_W) * stageRect.width * frameScale;
    const offsetYPx = ((FRAME_H / 2 - targetCenterY) / FRAME_H) * stageRect.height * frameScale;

    const slotCenterXInStage = (targetCenterX / FRAME_W) * stageRect.width;
    const slotCenterYInStage = (targetCenterY / FRAME_H) * stageRect.height;

    const stageCenterX = stageRect.left + stageRect.width / 2;
    const stageCenterY = stageRect.top + stageRect.height / 2;

    const slotCenterXOnScreen = stageCenterX + (slotCenterXInStage - stageRect.width / 2) * frameScale + offsetXPx;
    const slotCenterYOnScreen = stageCenterY + (slotCenterYInStage - stageRect.height / 2) * frameScale + offsetYPx;

    const boxWidthOnScreen = (slot.w / FRAME_W) * stageRect.width * frameScale;
    const boxHeightOnScreen = (slot.h / FRAME_H) * stageRect.height * frameScale;

    const boxLeftOnScreen = slotCenterXOnScreen - boxWidthOnScreen / 2;
    const boxTopOnScreen = slotCenterYOnScreen - boxHeightOnScreen / 2;

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    const videoAspect = vWidth / vHeight;
    const stageAspect = stageRect.width / stageRect.height;

    let renderVWidth = vWidth;
    let renderVHeight = vHeight;
    let cropX = 0;
    let cropY = 0;

    if (videoAspect > stageAspect) {
      renderVWidth = vHeight * stageAspect;
      cropX = (vWidth - renderVWidth) / 2;
    } else {
      renderVHeight = vWidth / stageAspect;
      cropY = (vHeight - renderVHeight) / 2;
    }

    const normX = (boxLeftOnScreen - stageRect.left) / stageRect.width;
    const normY = (boxTopOnScreen - stageRect.top) / stageRect.height;
    const normW = boxWidthOnScreen / stageRect.width;
    const normH = boxHeightOnScreen / stageRect.height;

    let sourceX = cropX + normX * renderVWidth;
    let sourceY = cropY + normY * renderVHeight;
    let sourceWidth = normW * renderVWidth;
    let sourceHeight = normH * renderVHeight;

    // 캔버스 필터 적용 (보정 효과)
    ctx.filter = currentFilterCss;

    // 셀카 좌우 반전 처리
    if (facing === 'user') {
      sourceX = vWidth - sourceX - sourceWidth;
      ctx.translate(slot.w, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      video,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      Math.min(sourceWidth, vWidth - sourceX),
      Math.min(sourceHeight, vHeight - sourceY),
      0,
      0,
      slot.w,
      slot.h
    );

    return canvas.toDataURL('image/jpeg', 0.95);
  }, [facing, frameScale, targetCenterX, targetCenterY, videoRef, currentFilterCss]);

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
        {/* 라이브 비디오 및 스테이지 */}
        <div 
          ref={stageRef}
          className="relative w-full max-w-sm aspect-[1181/1748] rounded-2xl overflow-hidden shadow-2xl bg-black"
        >
          <div className="absolute inset-0 camera-stage">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transition-[filter] duration-300"
              style={{
                transform: facing === 'user' ? 'scaleX(-1)' : 'none',
                filter: currentFilterCss, // 라이브 프리뷰 화면에도 선택한 보정 효과 즉시 적용
              }}
            />
          </div>

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

          {/* 좌측 상단 샷 정보 뱃지 */}
          {(phase === 'countdown' || phase === 'shooting') && (
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-body z-10 flex items-center gap-1.5 border border-white/20 shadow-md">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>
                칸 {activeSlotIndex + 1} · {activeTake + 1}/{SHOTS_PER_SLOT} · {currentShot + 1}/{TOTAL_SHOTS}
              </span>
            </div>
          )}

          {/* 상단 중앙 대형 카운트다운 애니메이션 */}
          {phase === 'countdown' && countdown > 0 && (
            <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none z-20">
              <div
                key={countdown}
                className="animate-in zoom-in-50 fade-in duration-300 ease-out bg-black/40 backdrop-blur-md px-6 py-1 rounded-full border border-white/20 shadow-2xl flex items-center justify-center"
              >
                <span className="font-display text-7xl md:text-8xl text-amber-400 font-extrabold tracking-tight drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                  {countdown}
                </span>
              </div>
            </div>
          )}

          {/* 상단 중앙 찰칵! 연출 */}
          {phase === 'shooting' && (
            <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-none z-20">
              <div className="animate-in zoom-in-75 fade-in duration-200 ease-out bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-2xl">
                <span className="font-display text-5xl text-emerald-400 font-extrabold drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                  찰칵!
                </span>
              </div>
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

        {/* 하단 썸네일 */}
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

        {/* 타이머 / 필터 / 프레임 선택 옵션 */}
        {phase === 'idle' && (
          <div className="w-full max-w-sm flex flex-col gap-2.5">
            {/* 타이머 선택 */}
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

            {/* 보정 필터 선택 (새로 추가됨) */}
            <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-brand-100">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Sparkles size={14} className="text-brand-500" /> 필터 보정
              </span>
              <div className="flex gap-1">
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedFilter === f.id
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 프레임 선택 */}
            {framesList.length > 1 && (
              <div className="mt-1">
                <p className="text-xs text-gray-500 mb-1 text-center font-body">촬영할 프레임</p>
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
