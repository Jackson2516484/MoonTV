/* eslint-disable no-console */
// 极简 MQTT 3.1.1 over WebSocket 客户端（无依赖）
// 用于手机遥控电视：走公共 EMQX broker，无需账号、无需自建服务
// topic 规范：moontv/tv/{6位配对码}/cmd（手机→电视），moontv/tv/{code}/status（电视→手机）

export type MqttMessageHandler = (topic: string, payload: string) => void;

const MQTT_WS_URL = 'wss://broker.emqx.io:8084/mqtt';

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// MQTT 可变长度编码（Remaining Length）
function encodeRemainingLength(len: number): number[] {
  const out: number[] = [];
  do {
    let b = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) b |= 0x80;
    out.push(b);
  } while (len > 0);
  return out;
}

function concat(...parts: (number[] | Uint8Array | number)[]): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (typeof p === 'number') {
      bytes.push(p);
    } else {
      for (let j = 0; j < p.length; j++) bytes.push(p[j]);
    }
  }
  return new Uint8Array(bytes);
}

let packetId = 1;

export class MiniMqtt {
  private ws: WebSocket | null = null;
  private url: string;
  private clientId: string;
  private handlers = new Set<MqttMessageHandler>();
  private keepAliveTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private recvBuf = new Uint8Array(0);
  private connectedFlag = false;
  private manualClose = false;
  private pendingSubs: string[] = [];
  onConnect: (() => void) | null = null;

  constructor(url: string = MQTT_WS_URL) {
    this.url = url;
    this.clientId =
      'moontv_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
  }

  onMessage(handler: MqttMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  get connected(): boolean {
    return this.connectedFlag;
  }

  connect(): void {
    this.manualClose = false;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.manualClose) return;
    try {
      const ws = new WebSocket(this.url, ['mqtt']);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => {
        this.sendConnect();
      };
      ws.onmessage = (ev) => {
        this.feed(ev.data as ArrayBuffer);
      };
      ws.onclose = () => {
        this.handleClose();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // 忽略
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleClose(): void {
    this.connectedFlag = false;
    this.stopKeepAlive();
    if (!this.manualClose) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.manualClose || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, 3000);
  }

  close(): void {
    this.manualClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepAlive();
    try {
      this.ws?.send(new Uint8Array([0xe0, 0x00])); // DISCONNECT
      this.ws?.close();
    } catch {
      // 忽略
    }
    this.ws = null;
    this.connectedFlag = false;
  }

  subscribe(topic: string): void {
    if (!this.pendingSubs.includes(topic)) this.pendingSubs.push(topic);
    if (this.connectedFlag) this.sendSubscribe(topic);
  }

  publish(topic: string, payload: string): boolean {
    if (!this.connectedFlag || !this.ws) return false;
    try {
      const t = encodeUtf8(topic);
      const p = encodeUtf8(payload);
      const frame = concat(
        0x30,
        encodeRemainingLength(2 + t.length + p.length),
        ((): number[] => {
          const len = [(t.length >> 8) & 0xff, t.length & 0xff];
          return len;
        })(),
        t,
        p,
      );
      this.ws.send(frame);
      return true;
    } catch {
      return false;
    }
  }

  private sendConnect(): void {
    const cid = encodeUtf8(this.clientId);
    // Variable header: MQTT/4, clean session, keepalive 60
    const vh = new Uint8Array([0, 4, 0x4d, 0x51, 0x54, 0x54, 4, 0x02, 0, 60]);
    const payload = concat(
      [(cid.length >> 8) & 0xff, cid.length & 0xff],
      cid,
    );
    const frame = concat(0x10, encodeRemainingLength(vh.length + payload.length), vh, payload);
    try {
      this.ws?.send(frame);
    } catch {
      // 忽略
    }
  }

  private sendSubscribe(topic: string): void {
    const t = encodeUtf8(topic);
    const pid = packetId++ & 0xffff;
    const payload = concat(
      [(t.length >> 8) & 0xff, t.length & 0xff],
      t,
      [0x00], // QoS 0
    );
    const frame = concat(
      0x82,
      encodeRemainingLength(2 + payload.length),
      [(pid >> 8) & 0xff, pid & 0xff],
      payload,
    );
    try {
      this.ws?.send(frame);
    } catch {
      // 忽略
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = window.setInterval(() => {
      try {
        this.ws?.send(new Uint8Array([0xc0, 0x00])); // PINGREQ
      } catch {
        // 忽略
      }
    }, 30000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer !== null) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private feed(data: ArrayBuffer): void {
    const incoming = new Uint8Array(data);
    const merged = new Uint8Array(this.recvBuf.length + incoming.length);
    merged.set(this.recvBuf, 0);
    merged.set(incoming, this.recvBuf.length);
    this.recvBuf = merged;
    this.parseFrames();
  }

  private parseFrames(): void {
    for (;;) {
      if (this.recvBuf.length < 2) return;
      // 解析 Remaining Length
      let multiplier = 1;
      let remaining = 0;
      let pos = 1;
      let b: number;
      do {
        if (pos >= this.recvBuf.length) return;
        b = this.recvBuf[pos++];
        remaining += (b & 0x7f) * multiplier;
        multiplier *= 128;
        if (multiplier > 128 * 128 * 128) return; // 畸形
      } while ((b & 0x80) !== 0);
      const frameLen = pos + remaining;
      if (this.recvBuf.length < frameLen) return;
      const type = this.recvBuf[0] >> 4;
      const body = this.recvBuf.slice(pos, frameLen);
      this.recvBuf = this.recvBuf.slice(frameLen);
      this.handlePacket(type, body);
    }
  }

  private handlePacket(type: number, body: Uint8Array): void {
    if (type === 2) {
      // CONNACK
      if (body.length >= 2 && body[1] === 0) {
        this.connectedFlag = true;
        this.startKeepAlive();
        for (const topic of this.pendingSubs) this.sendSubscribe(topic);
        this.onConnect?.();
      }
      return;
    }
    if (type === 3) {
      // PUBLISH (QoS 0)
      if (body.length < 2) return;
      const topicLen = (body[0] << 8) | body[1];
      if (body.length < 2 + topicLen) return;
      const topic = new TextDecoder().decode(body.slice(2, 2 + topicLen));
      const payload = new TextDecoder().decode(body.slice(2 + topicLen));
      this.handlers.forEach((h) => {
        try {
          h(topic, payload);
        } catch {
          // 忽略
        }
      });
      return;
    }
    // PINGRESP(13) / SUBACK(9) 等忽略
  }
}

// 生成 6 位数字配对码
export function generatePairCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
