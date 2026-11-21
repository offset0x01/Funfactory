#!/usr/bin/env python3
"""A tiny fake MQTT broker over WebSockets, for testing online play with no internet.

Multiplayer games find each other through public MQTT brokers (see "NET" in
templates/game-multi/index.html). Tests point the game at this broker instead by setting
window.NET_TEST_CONFIG = { brokers: ['ws://127.0.0.1:<port>'], ice: [] } before the page loads.

It speaks just enough MQTT 3.1.1 for that: CONNECT, SUBSCRIBE, PUBLISH (QoS 0), PINGREQ and
DISCONNECT, and passes every PUBLISH to every client subscribed to that exact topic. Standard
library only. It also counts what it saw (`stats`) so tests can check the game behaved.

    from fake_mqtt_broker import FakeBroker
    with FakeBroker() as broker:
        url = broker.url          # ws://127.0.0.1:<port>
        ...
        broker.stats              # {'connects': 2, 'publishes': 9, 'topics': {...}, 'payloads': [...]}
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import struct
import threading

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def _mqtt_len(n: int) -> bytes:
    out = bytearray()
    while True:
        d, n = n % 128, n // 128
        out.append(d | (128 if n else 0))
        if not n:
            return bytes(out)


def _mqtt_str(s: str) -> bytes:
    b = s.encode()
    return struct.pack(">H", len(b)) + b


class FakeBroker:
    def __init__(self, host: str = "127.0.0.1", port: int = 0):
        self.host, self.port = host, port
        self.subs: dict[str, set] = {}
        self.stats = {"connects": 0, "publishes": 0, "topics": set(), "payloads": []}
        self._loop = asyncio.new_event_loop()
        self._ready = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    @property
    def url(self) -> str:
        return f"ws://{self.host}:{self.port}"

    # --- lifecycle ---------------------------------------------------------
    def __enter__(self):
        self._thread.start()
        self._ready.wait(5)
        return self

    def __exit__(self, *exc):
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(3)

    def _run(self):
        asyncio.set_event_loop(self._loop)
        server = self._loop.run_until_complete(asyncio.start_server(self._client, self.host, self.port))
        self.port = server.sockets[0].getsockname()[1]
        self._ready.set()
        self._loop.run_forever()

    # --- WebSocket ---------------------------------------------------------
    async def _client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            head = (await reader.readuntil(b"\r\n\r\n")).decode("latin-1")
            headers = {k.strip().lower(): v.strip() for k, _, v in (line.partition(":") for line in head.split("\r\n")[1:]) if k}
            accept = base64.b64encode(hashlib.sha1((headers["sec-websocket-key"] + WS_GUID).encode()).digest()).decode()
            proto = "Sec-WebSocket-Protocol: mqtt\r\n" if "mqtt" in headers.get("sec-websocket-protocol", "") else ""
            writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                          f"Sec-WebSocket-Accept: {accept}\r\n{proto}\r\n").encode())
            await writer.drain()
            buf = b""
            while True:
                op, data = await self._read_frame(reader)
                if op == 8:          # close
                    break
                if op == 9:          # ping
                    self._send_frame(writer, data, op=10)
                    continue
                buf += data
                buf = self._mqtt(buf, writer)
        except (asyncio.IncompleteReadError, ConnectionError, KeyError):
            pass
        finally:
            for subs in self.subs.values():
                subs.discard(writer)
            writer.close()

    @staticmethod
    async def _read_frame(reader):
        b1, b2 = await reader.readexactly(2)
        n = b2 & 127
        if n == 126:
            n = struct.unpack(">H", await reader.readexactly(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", await reader.readexactly(8))[0]
        mask = await reader.readexactly(4) if b2 & 128 else b"\0\0\0\0"
        data = bytearray(await reader.readexactly(n))
        for i in range(n):
            data[i] ^= mask[i % 4]
        return b1 & 15, bytes(data)

    @staticmethod
    def _send_frame(writer, data: bytes, op: int = 2):
        n = len(data)
        head = bytes([0x80 | op]) + (bytes([n]) if n < 126 else bytes([126]) + struct.pack(">H", n) if n < 65536 else bytes([127]) + struct.pack(">Q", n))
        writer.write(head + data)

    # --- MQTT --------------------------------------------------------------
    def _mqtt(self, buf: bytes, writer) -> bytes:
        while len(buf) >= 2:
            n, mul, i = 0, 1, 1
            while True:
                if i >= len(buf):
                    return buf
                d = buf[i]; i += 1
                n += (d & 127) * mul; mul *= 128
                if not d & 128:
                    break
            if len(buf) < i + n:
                return buf
            first, body, buf = buf[0], buf[i:i + n], buf[i + n:]
            kind = first >> 4
            if kind == 1:            # CONNECT -> CONNACK accepted
                self.stats["connects"] += 1
                self._send_frame(writer, bytes([0x20, 2, 0, 0]))
            elif kind == 8:          # SUBSCRIBE -> SUBACK
                pid, j, granted = body[:2], 2, bytearray()
                while j < len(body):
                    tl = struct.unpack(">H", body[j:j + 2])[0]
                    topic = body[j + 2:j + 2 + tl].decode()
                    self.subs.setdefault(topic, set()).add(writer)
                    granted.append(0); j += 2 + tl + 1
                self._send_frame(writer, bytes([0x90]) + _mqtt_len(2 + len(granted)) + pid + bytes(granted))
            elif kind == 3:          # PUBLISH -> everyone subscribed to the topic
                tl = struct.unpack(">H", body[:2])[0]
                topic = body[2:2 + tl].decode()
                payload = body[2 + tl + (2 if (first >> 1) & 3 else 0):]
                self.stats["publishes"] += 1
                self.stats["topics"].add(topic)
                self.stats["payloads"].append(payload.decode(errors="replace"))
                pkt = _mqtt_str(topic) + payload
                for w in list(self.subs.get(topic, ())):
                    self._send_frame(w, bytes([0x30]) + _mqtt_len(len(pkt)) + pkt)
            elif kind == 12:         # PINGREQ -> PINGRESP
                self._send_frame(writer, bytes([0xD0, 0]))
            elif kind == 14:         # DISCONNECT
                raise ConnectionError
        return buf


if __name__ == "__main__":
    import time
    with FakeBroker(port=18830) as b:
        print("fake MQTT broker on", b.url, "(Ctrl+C to stop)")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
