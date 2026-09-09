import { bundledFrameFiles } from 'virtual:bundled-frames';
import { type FrameTemplate, type Slot } from './types';

/**
 * CP1300 (1181 × 1748) 해상도 기준 원본 슬롯 고정 좌표
 * - Slot 1: x=69, y=65, w=500, h=629
 * - Slot 2: x=608, y=65, w=500, h=629
 * - Slot 3: x=69, y=711, w=500, h=629
 * - Slot 4: x=608, y=711, w=500, h=629
 */
export const defaultSlots: Slot[] = [
  { x: 69, y: 65, w: 500, h: 629, photoId: null },   // Slot 1 (좌측 상단)
  { x: 608, y: 65, w: 500, h: 629, photoId: null },  // Slot 2 (우측 상단)
  { x: 69, y: 711, w: 500, h: 629, photoId: null },  // Slot 3 (좌측 하단)
  { x: 608, y: 711, w: 500, h: 629, photoId: null }, // Slot 4 (우측 하단)
];

function withSlots(partial: Omit<FrameTemplate, 'slots'>): FrameTemplate {
  return {
    ...partial,
    slots: defaultSlots.map((s) => ({ ...s, photoId: null })),
  };
}

/** PNG/WebP dropped into public/frames — 촬영 전 목록에 자동 반영됩니다. */
export const bundledFrames: FrameTemplate[] = bundledFrameFiles.map((f) =>
  withSlots({
    id: f.id,
    name: f.name,
    bgColor: '#ffffff',
    overlayUrl: f.url,
  }),
);

export const fallbackFrame: FrameTemplate = withSlots({
  id: 'fallback',
  name: '기본',
  bgColor: '#ffffff',
});

export const builtinFrames = bundledFrames.length > 0 ? bundledFrames : [fallbackFrame];
