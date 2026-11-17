// Bounded ClamD INSTREAM transport. No app environment, credentials or file I/O.
import { createConnection } from "node:net";
import { once } from "node:events";
/** @param {Uint8Array} bytes @param {{host:string,port:number,timeoutMs:number}} options */
export async function clamavScan(bytes, { host, port, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port }),
      controller = new AbortController();
    let settled = false,
      sent = false,
      received = Buffer.alloc(0);
    const timer = setTimeout(() => finish(), timeoutMs);
    function finish(verdict) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      controller.abort();
      socket.destroy();
      if (verdict) resolve(verdict);
      else reject(new Error("CLAMAV_UNAVAILABLE"));
    }
    socket.on("error", () => finish());
    socket.on("close", () => {
      if (!settled) finish();
    });
    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length > 2048) return finish();
      if (!received.includes(0)) return;
      const response = received.toString("utf8");
      if (response === "stream: OK\0" && sent) finish("clean");
      else if (/^stream: [^\0\r\n]+ FOUND\0$/.test(response))
        finish("infected");
      else finish();
    });
    socket.once("connect", () => {
      void (async () => {
        async function write(chunk) {
          if (settled) throw new Error("CLOSED");
          if (!socket.write(chunk))
            await once(socket, "drain", { signal: controller.signal });
        }
        await write(Buffer.from("zINSTREAM\0"));
        for (let at = 0; at < bytes.length; at += 65536) {
          const data = bytes.subarray(at, at + 65536),
            size = Buffer.alloc(4);
          size.writeUInt32BE(data.length);
          await write(size);
          await write(data);
        }
        await write(Buffer.alloc(4));
        sent = true;
      })().catch(() => finish());
    });
  });
}
