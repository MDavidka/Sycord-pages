export function parseToolArguments(argsString: string): any[] {
    const cleanArgs = argsString.replace(/```json\n?|```/g, '').trim();
    const argsList: any[] = [];

    // 1. Try parsing as a single JSON object
    try {
        const parsed = JSON.parse(cleanArgs);
        return [parsed];
    } catch (e) {
        // Continue to other methods (this is normal if multiple JSONs)
    }

    // 2. Try parsing as multiple concatenated JSONs using brace counting
    let braceCount = 0;
    let startIndex = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < cleanArgs.length; i++) {
        const char = cleanArgs[i];

        if (inString) {
            if (char === '\\' && !escape) {
                escape = true;
            } else {
                if (char === '"' && !escape) {
                    inString = false;
                }
                escape = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            if (braceCount === 0) startIndex = i;
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
                const jsonStr = cleanArgs.substring(startIndex, i + 1);
                try {
                    argsList.push(JSON.parse(jsonStr));
                } catch (parseErr) {
                    console.error('Failed to parse extracted JSON chunk:', jsonStr);
                }
                startIndex = -1;
            }
        }
    }

    if (argsList.length > 0) {
        return argsList;
    }

    // 3. Fallback: Regex extraction for common patterns (createFile / write_file)
    // Match structure {"path": "...", "content": "..."} or reversed {"content": "...", "path": "..."}
    const pathContentRegex = /\{\s*"(?:path|filepath|file|filename)"\s*:\s*"([^"]+)"\s*,\s*"(?:content|contents|code)"\s*:\s*"([\s\S]*?)"\s*\}/g;
    let match;
    while ((match = pathContentRegex.exec(cleanArgs)) !== null) {
        try {
            argsList.push({
                path: match[1],
                content: match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            });
        } catch (e) {
            // ignore
        }
    }

    if (argsList.length === 0) {
        const contentPathRegex = /\{\s*"(?:content|contents|code)"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:path|filepath|file|filename)"\s*:\s*"([^"]+)"\s*\}/g;
        while ((match = contentPathRegex.exec(cleanArgs)) !== null) {
            try {
                argsList.push({
                    path: match[2],
                    content: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
                });
            } catch (e) {
                // ignore
            }
        }
    }

    return argsList;
}

/**
 * Removes "Summary:" and "Sources:" sections from AI responses
 */
export function cleanAIResponse(content: string): string {
    if (!content) return content;
    
    let cleaned = content;
    
    // Remove "Summary:" line and the text immediately after it (usually one line)
    cleaned = cleaned.replace(/Summary:\s*.+/gi, '');
    
    // Remove "Sources:" and everything after it
    cleaned = cleaned.replace(/Sources:[\s\S]*/gi, '');
    
    // Clean up multiple empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Clean up extra whitespace at start and end
    cleaned = cleaned.trim();
    
    return cleaned;
}
