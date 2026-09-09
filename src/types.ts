export type Photo = {
  id: string;
  src: string;
  slotIndex: number;
  takeIndex: number;
};

export type FrameSlot = {
  x: number;
  y: number;
  w: number;
  h: number;
  photoId: string | null;
};

export type FrameTemplate = {
  id: string;
  name: string;
  bgColor: string;
  slots: FrameSlot[];
  overlayUrl?: string;
  decorations?: string;
};

export const APP_TITLE = '파천 네컷';
export const FRAME_W = 1181;
export const FRAME_H = 1748;
export const SLOT_COUNT = 4;
export const SHOTS_PER_SLOT = 2;
export const TOTAL_SHOTS = SLOT_COUNT * SHOTS_PER_SLOT;
export const COUNTDOWN_SECONDS = 5;
export const SHOT_DELAY_MS = 1000;

export function slotIndexForShot(shotIndex: number) {
  return Math.floor(shotIndex / SHOTS_PER_SLOT);
}

export function takeIndexForShot(shotIndex: number) {
  return shotIndex % SHOTS_PER_SLOT;
}
