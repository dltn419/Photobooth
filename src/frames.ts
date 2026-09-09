import { bundledFrameFiles } from 'virtual:bundled-frames';
import { type FrameTemplate, type Slot } from './types';

/**
 * CP1300 (1181 × 1748) 해상도 기준 2×2 정밀 고정 좌표 설정
 * - 각 사진 영역: 너비 510px, 높이 740px
 * - 오차 방지여백(PHOTO_BLEED): 프레임 구멍 외곽으로 사진이 살짝 비치도록 5px 오버랩
 */
const BLEED = 5;

export const defaultSlots: Slot[] = [
  // 1. 좌측 상단 (Col 0, Row 0)
  {
    x: 60 - BLEED,
    y: 70 - BLEED,
    w: 510 + BLEED * 2,
    h: 740 + BLEED * 2,
    photoId: null,
  },
  // 2. 우측 상단 (Col 1, Row 0)
  {
    x: 611 - BLEED,
    y: 70 - BLEED,
    w: 510 + BLEED * 2,
    h: 740 + BLEED * 2,
    photoId: null,
  },
  // 3. 좌측 하단 (Col 0, Row 1)
  {
    x: 60 - BLEED,
    y: 850 - BLEED,
    w: 510 + BLEED * 2,
    h: 740 + BLEED * 2,
    photoId: null,
  },
  // 4. 우측 하단 (Col 1, Row 1)
  {
    x: 611 - BLEED,
    y: 850 - BLEED,
    w: 510 + BLEED * 2,
    h: 740 + BLEED * 2,
    photoId: null,
  },
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
