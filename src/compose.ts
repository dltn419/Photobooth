import { FRAME_W, FRAME_H, type FrameTemplate, type Photo } from './types';

export function composeFinalImage(
  frame: FrameTemplate,
  photos: Record<string, Photo>,
  customFrameImage: HTMLImageElement | null,
  filterCss: string = 'none', // 4번째 인자로 필터 CSS 수신
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d')!;

  // White background (for JPG — no transparency)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);

  // Frame background color
  ctx.fillStyle = frame.bgColor;
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);

  // Draw each photo into its slot with the active filter
  for (const slot of frame.slots) {
    if (!slot.photoId) continue;
    const photo = photos[slot.photoId];
    if (!photo) continue;

    const img = new Image();
    img.src = photo.src;

    // 사진에만 필터 적용 후 restore로 상태 복구
    ctx.save();
    ctx.filter = filterCss;
    drawImageCover(ctx, img, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  }

  // 오버레이 및 장식 텍스트는 필터의 영향을 받지 않고 원본 상태 유지
  if (customFrameImage) {
    ctx.drawImage(customFrameImage, 0, 0, FRAME_W, FRAME_H);
  } else if (frame.decorations) {
    const isDark = isDarkColor(frame.bgColor);
    ctx.fillStyle = isDark ? '#ffffff' : '#333333';
    ctx.font = 'bold 42px "Gugi", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frame.decorations, FRAME_W / 2, FRAME_H - 80);
  }

  return canvas;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgRatio = img.width / img.height;
  const slotRatio = w / h;

  let sx = 0, sy = 0, sw = img.width, sh = img.height;

  if (imgRatio > slotRatio) {
    // Image is wider — crop sides
    sw = img.height * slotRatio;
    sx = (img.width - sw) / 2;
  } else {
    // Image is taller — crop top/bottom
    sh = img.width / slotRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export function canvasToJpgBlob(canvas: HTMLCanvasElement, quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      'image/jpeg',
      quality,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
