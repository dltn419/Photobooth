import { bundledFrameFiles } from 'virtual:bundled-frames';
import { type FrameTemplate } from './types';

/** Visible frame window (top-left rectangle vertices). */
const HOLE_X = 65;
const HOLE_Y = 71;
const HOLE_W = 526 - 65; // 461
const HOLE_H = 761 - 71; // 690
const GAP = 22;
/** Photo extends past the frame hole so alignment error cannot leave a gap. */
const PHOTO_BLEED = 5;

function slotPos(col: number, row: number) {
  const holeX = HOLE_X + col * (HOLE_W + GAP);
  const holeY = HOLE_Y + row * (HOLE_H + GAP);
  return {
    x: holeX - PHOTO_BLEED,
    y: holeY - PHOTO_BLEED,
    w: HOLE_W + PHOTO_BLEED * 2,
    h: HOLE_H + PHOTO_BLEED * 2,
  };
}

export const defaultSlots = [
  { ...slotPos(0, 0), photoId: null },
  { ...slotPos(1, 0), photoId: null },
  { ...slotPos(0, 1), photoId: null },
  { ...slotPos(1, 1), photoId: null },
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
  bgColor: '#faf7f2',
});

export const builtinFrames = bundledFrames.length > 0 ? bundledFrames : [fallbackFrame];
