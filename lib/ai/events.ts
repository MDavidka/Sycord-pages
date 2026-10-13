export interface BaseEvent {
  stage: string;
  status?: "pending" | "running" | "done" | "error";
  title?: string;
  message?: string;
}

export function createSseStream(writer: WritableStreamDefaultWriter<Uint8Array>) {
  const encoder = new TextEncoder();
  return {
    async send(event: string, data: any) {
      try {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch (err) {
        console.error("SSE write error:", err);
      }
    },
    async close() {
      try {
        await writer.close();
      } catch (err) {
        console.error("SSE close error:", err);
      }
    }
  };
}
