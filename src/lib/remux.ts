/* eslint-disable no-console */
// MPEG-TS → fMP4 转封装（只换容器、不重新编码，速度快、画质无损）
// 基于 mux.js Transmuxer：输入 TS 分片/流，输出可直接保存为 .mp4 的 fMP4 数据。

import muxjs from 'mux.js';

/** 嗅探：是否为 MP4/fMP4 数据（ftyp box） */
export function isMp4Data(data: Uint8Array | ArrayBuffer): boolean {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (b.length < 12) return false;
  return (
    b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70
  ); // 'ftyp'
}

/** 嗅探：是否为 MPEG-TS 数据（0x47 同步字节，188 字节包） */
export function isTsData(data: Uint8Array | ArrayBuffer): boolean {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (b.length < 188) return false;
  if (b[0] !== 0x47) return false;
  // 再校验第二个包头，降低误判
  return b[188] === 0x47 || b.length < 376;
}

function toU8(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * TS → MP4 流式转封装器。
 * 用法：不断 push(tsChunk)，转出的 mp4 数据通过 onData 回调增量给出；
 * 全部推完后调用 flush()，再用 toBlob() 拿到完整文件。
 */
export class TsToMp4Converter {
  private transmuxer: InstanceType<typeof muxjs.mp4.Transmuxer>;
  private initSegment: Uint8Array | null = null;
  private chunks: Uint8Array[] = [];
  private producedBytes = 0;

  /** 增量输出回调（chunk 为 mp4 数据，isInit 表示是否为文件头） */
  onData: ((chunk: Uint8Array, isInit: boolean) => void) | null = null;

  constructor() {
    this.transmuxer = new muxjs.mp4.Transmuxer({
      keepOriginalTimestamps: false,
    });
    this.transmuxer.on('data', (segment) => {
      try {
        if (
          segment.initSegment &&
          !this.initSegment
        ) {
          const init = toU8(segment.initSegment);
          if (init.byteLength > 0) {
            this.initSegment = init;
            this.chunks.push(init);
            this.producedBytes += init.byteLength;
            if (this.onData) this.onData(init, true);
          }
        }
        if (segment.data) {
          const d = toU8(segment.data);
          if (d.byteLength > 0) {
            this.chunks.push(d);
            this.producedBytes += d.byteLength;
            if (this.onData) this.onData(d, false);
          }
        }
      } catch (err) {
        console.warn('转封装输出处理失败:', err);
      }
    });
  }

  push(data: Uint8Array | ArrayBuffer): void {
    const u8 = toU8(data);
    if (u8.length === 0) return;
    this.transmuxer.push(u8);
  }

  flush(): void {
    try {
      this.transmuxer.flush();
    } catch (err) {
      console.warn('转封装 flush 失败:', err);
    }
  }

  /** 已产出的 mp4 字节数 */
  get bytes(): number {
    return this.producedBytes;
  }

  /** 是否产出过任何数据（用于判断流是否可转封装） */
  get hasOutput(): boolean {
    return this.producedBytes > 0;
  }

  /** 合并为完整 mp4 文件 Blob */
  toBlob(): Blob {
    const out = new Uint8Array(this.producedBytes);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return new Blob([out.buffer as ArrayBuffer], { type: 'video/mp4' });
  }
}
