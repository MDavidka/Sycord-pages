export interface FileUpdate {
    path: string;
    content: string;
}

export function parseResponse(response: string): FileUpdate[] {
    const files: FileUpdate[] = [];
    const regex = /```(\w+)?\s*(?:filename="([^"]+)"|([^\n]+))\n([\s\S]*?)```/g;

    let match;
    while ((match = regex.exec(response)) !== null) {
        const filename = match[2] || match[3]?.trim();
        const content = match[4];

        if (filename && content) {
            files.push({ path: filename, content });
        }
    }

    return files;
}
