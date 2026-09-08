/// <reference types="vite/client" />

declare module 'virtual:bundled-frames' {
  export const bundledFrameFiles: { id: string; name: string; url: string }[];
}
