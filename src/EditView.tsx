import { useRef, useState, useEffect, useCallback } from 'react';
import { Download, ArrowLeft, RotateCcw, Check, Sparkles } from 'lucide-react';
import { defaultSlots, bundledFrames } from './frames';
import { APP_TITLE, FRAME_W, FRAME_H, SLOT_COUNT, type FrameTemplate, type Photo } from './types';
import { composeFinalImage, canvasToJpgBlob, downloadBlob } from './compose';

// 필터 프리셋 정의 (핵심 4종, 뽀샤시에 피부 매끈화 효과 추가)
export type FilterType = 'normal' | 'grayscale' | 'warm' | 'vintage';

interface FilterOption {
  id: FilterType;
  name: string;
  cssFilter: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { id: 'normal', name: '원본', cssFilter: 'none' },
  { id: 'grayscale', name: '흑백', cssFilter: 'grayscale(100%)' },
  // 🔽 기존 blur(1px) 이상의 과도한 뭉개짐을 피하고, contrast를 96%로 살짝 낮춰 모공 음영을 누른 밸런스 값입니다.
  { id: 'warm', name: '뽀샤시', cssFilter: 'blur(0.4px) brightness(106%) contrast(96%) saturate(105%)' },
  { id: 'vintage', name: '빈티지', cssFilter: 'sepia(40%) contrast(110%) brightness(90%)' },
];

type Props = {
  photos: Photo[];
  initialFrame: FrameTemplate;
  onBack: () => void;
};

export function EditView({ photos, initialFrame, onBack }: Props) {
  const [frame, setFrame] = useState<FrameTemplate>(initialFrame);
  const [photoMap] = useState<Record<string, Photo>>(() => {
    const map: Record<string, Photo> = {};
    for (const p of photos) map[p.id] = p;
    return map;
  });
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('normal');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const activeFilterCss = FILTER_OPTIONS.find((f) => f.id === selectedFilter)?.cssFilter ?? 'none';

  const photosForSlot = (slotIndex: number) =>
    photos.filter((p) => p.slotIndex === slotIndex).sort((a, b) => a.takeIndex - b.takeIndex);

  const drawImageCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    const imgRatio = img.width / img.height;
    const slotRatio = w / h;
    let sx = 0,
      sy = 0,
      sw = img.width,
      sh = img.height;
    if (imgRatio > slotRatio) {
      sw = img.height * slotRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / slotRatio;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  };

  const drawPreview = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    ctx.fillStyle = frame.bgColor;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);

    for (const slot of frame.slots) {
      if (!slot.photoId) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
        continue;
      }
      const photo = photoMap[slot.photoId];
      if (!photo) continue;
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.filter = activeFilterCss;
        drawImageCover(ctx, img, slot.x, slot.y, slot.w, slot.h);
        ctx.restore();

        if (overlayImg) ctx.drawImage(overlayImg, 0, 0, FRAME_W, FRAME_H);
      };
      img.src = photo.src;
    }

    if (overlayImg) {
      ctx.drawImage(overlayImg, 0, 0, FRAME_W, FRAME_H);
    }
  }, [frame, photoMap, overlayImg, activeFilterCss]);

  useEffect(() => {
    const timer = setTimeout(drawPreview, 50);
    return () => clearTimeout(timer);
  }, [drawPreview]);

  useEffect(() => {
    if (!frame.overlayUrl) {
      setOverlayImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setOverlayImg(img);
    img.src = frame.overlayUrl;
  }, [frame.overlayUrl]);

  const assignSlot = (slotIndex: number, photoId: string) => {
    const newSlots = [...frame.slots];
    newSlots[slotIndex] = { ...newSlots[slotIndex], photoId };
    setFrame({ ...frame, slots: newSlots });
  };

  const handleSelectFrame = (newFrame: FrameTemplate) => {
    setFrame({
      ...newFrame,
      slots: newFrame.slots.map((slot, index) => ({
        ...slot,
        photoId: frame.slots[index]?.photoId ?? null,
      })),
    });
  };

  const handleReset = () => {
    setSelectedFilter('normal');
    setFrame({
      ...initialFrame,
      slots: defaultSlots.map((s, i) => ({
        ...s,
        photoId: photos.find((p) => p.slotIndex === i && p.takeIndex === 0)?.id ?? null,
      })),
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await preloadImages(photoMap, frame);
      const canvas = composeFinalImage(frame, photoMap, overlayImg, activeFilterCss);
      const blob = await canvasToJpgBlob(canvas, 0.95);
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadBlob(blob, `파천네컷_${date}.jpg`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('사진 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-brand-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-600 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">다시 촬영</span>
        </button>
        <h1 className="font-display text-lg text-brand-600">{APP_TITLE}</h1>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-gray-600 hover:text-brand-600 transition-colors"
        >
          <RotateCcw size={18} />
          <span className="text-sm">초기화</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 max-w-5xl mx-auto w-full">
        {/* CP1300 비율 (1181/1748) 미리보기 영역 */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-xs aspect-[1181/1748] rounded-2xl overflow-hidden shadow-2xl bg-white">
            <canvas ref={previewRef} className="w-full h-full" />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-display text-lg shadow-lg active:scale-95 transition-all w-full max-w-xs ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-brand-500 text-white hover:bg-brand-600'
            } disabled:opacity-70`}
          >
            {saved ? (
              <>
                <Check size={22} />
                저장 완료!
              </>
            ) : isSaving ? (
              '저장 중...'
            ) : (
              <>
                <Download size={22} />
                사진 저장하기
              </>
            )}
          </button>
        </div>

        <div className="w-full lg:w-80 flex flex-col gap-6">
          {/* 필터 선택바 */}
          <div>
            <div className="flex items-center gap-1.5 text-sm font-display text-gray-700 mb-2">
              <Sparkles size={16} className="text-brand-500" />
              <span>사진 필터</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all ${
                    selectedFilter === f.id
                      ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-300 scale-105'
                      : 'border-gray-200 hover:border-brand-300 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                    {photos[0] ? (
                      <img
                        src={photos[0].src}
                        alt={f.name}
                        className="w-full h-full object-cover"
                        style={{ filter: f.cssFilter }}
                      />
                    ) : (
                      <div
                        className="w-full h-full bg-gradient-to-tr from-rose-400 to-amber-300"
                        style={{ filter: f.cssFilter }}
                      />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-gray-700">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          {bundledFrames.length > 1 && (
            <div>
              <h3 className="font-display text-sm text-gray-700 mb-2">프레임 변경</h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {bundledFrames.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFrame(f)}
                    className={`flex-shrink-0 w-12 h-[71px] rounded-lg border-2 overflow-hidden transition-all ${
                      frame.id === f.id
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

          <div>
            <h3 className="font-display text-sm text-gray-700 mb-1">칸마다 사진 고르기</h3>
            <p className="text-xs text-gray-400 mb-3 font-body font-normal">각 칸에서 2장 중 1장을 선택하세요</p>
            <div className="flex flex-col gap-4">
              {Array.from({ length: SLOT_COUNT }).map((_, i) => {
                const chosen = frame.slots[i]?.photoId;
                return (
                  <div key={i}>
                    <p className="text-xs font-medium text-gray-600 mb-2">칸 {i + 1}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {photosForSlot(i).map((photo) => (
                        <button
                          key={photo.id}
                          onClick={() => assignSlot(i, photo.id)}
                          className={`relative aspect-[500/629] rounded-lg overflow-hidden border-2 transition-all ${
                            chosen === photo.id
                              ? 'border-brand-500 ring-2 ring-brand-300'
                              : 'border-gray-200 hover:border-brand-300'
                          }`}
                        >
                          <img
                            src={photo.src}
                            alt=""
                            className="w-full h-full object-cover"
                            style={{ filter: activeFilterCss }}
                          />
                          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {photo.takeIndex + 1}번째
                          </span>
                          {chosen === photo.id && (
                            <span className="absolute top-1 right-1 bg-brand-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                              사용
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function preloadImages(
  photoMap: Record<string, Photo>,
  frame: FrameTemplate
): Promise<void[]> {
  const promises: Promise<void>[] = [];
  for (const slot of frame.slots) {
    if (!slot.photoId) continue;
    const photo = photoMap[slot.photoId];
    if (!photo) continue;
    promises.push(
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = photo.src;
      })
    );
  }
  return Promise.all(promises);
}
