import { bundledFrameFiles } from 'virtual:bundled-frames';
import { FRAME_W, FRAME_H, type FrameTemplate } from './types';

/** 
 * CP1300 (1181 × 1748) 해상도 기준 세로 4컷 좌표 설정
 * - HOLE_X: 좌우 여백 (50px)
 * - HOLE_W: 각 사진 슬롯 너비 (1081px)
 * - HOLE_H: 각 사진 슬롯 높이 (350px)
 * - START_Y: 첫 번째 사진의 시작 Y 좌표 (120px)
 * - GAP: 사진 간격 (30px)
 */
const HOLE_X = 50;
const HOLE_W = FRAME_W - HOLE_X * 2; // 1081px
const HOLE_H = 350;
const START_Y = 120;
const GAP = 30;
const PHOTO_BLEED = 4; // 오차 방지 여백

function slotPos(index: number) {
  const holeY = START_Y + index * (HOLE_H + GAP);
  return {
    x: HOLE_X - PHOTO_BLEED,
    y: holeY - PHOTO_BLEED,
    w: HOLE_W + PHOTO_BLEED * 2,
    h: HOLE_H + PHOTO_BLEED * 2,
  };
}

export const defaultSlots = [
  { ...slotPos(0), photoId: null },
  { ...slotPos(1), photoId: null },
  { ...slotPos(2), photoId: null },
  { ...slotPos(3), photoId: null },
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
