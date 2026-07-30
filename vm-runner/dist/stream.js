function now() {
    return new Date().toISOString();
}
function write(reply, event, data) {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify({ ...data, timestamp: now() })}\n\n`);
}
export function createSseReply(reply) {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    return {
        stage(stage, status, message) {
            write(reply, "stage", { type: "stage", stage, status, message, timestamp: now() });
        },
        log(source, line) {
            write(reply, "log", { type: "log", source, line, timestamp: now() });
        },
        result(data) {
            write(reply, "result", { type: "result", success: true, ...data, timestamp: now() });
        },
        error(data) {
            write(reply, "error", { type: "error", ...data, timestamp: now() });
        },
    };
}
