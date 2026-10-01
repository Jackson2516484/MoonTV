declare module 'mux.js' {
  interface Mp4Segment {
    type: 'video' | 'audio' | 'combined';
    data: Uint8Array | ArrayBuffer;
    initSegment?: Uint8Array | ArrayBuffer;
    captions?: unknown[];
    captionStreams?: Record<string, boolean>;
  }

  class Transmuxer {
    constructor(options?: { keepOriginalTimestamps?: boolean });
    push(data: Uint8Array): void;
    flush(): void;
    on(event: 'data', handler: (segment: Mp4Segment) => void): void;
    on(event: 'done', handler: () => void): void;
    off(event: string, handler?: (...args: unknown[]) => void): void;
  }

  const muxjs: {
    mp4: {
      Transmuxer: typeof Transmuxer;
    };
  };
  export default muxjs;
}
