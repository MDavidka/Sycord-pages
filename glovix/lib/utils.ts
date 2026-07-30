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

    // 3. Fallback: Regex extraction for common patterns (createFile)
    // This is a last resort for badly formatted JSON (e.g. unescaped newlines)
    // Match the structure {"path": "...", "content": "..."} roughly

    // This regex approach is tricky for multiple files because we need to pair them up.
    // A better regex might be to find the whole object block roughly.
    // Let's try to match the structure {"path": "...", "content": "..."} roughly

    const objectRegex = /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*\}/g;
    let match;
    while ((match = objectRegex.exec(cleanArgs)) !== null) {
        try {
            argsList.push({
                path: match[1],
                content: match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"')
            });
        } catch (e) {
            // ignore
        }
    }

    // If the simple regex didn't work (maybe keys are reversed or extra spaces), try individual matches
    // But individual matches are dangerous if order isn't guaranteed. 
    // Let's stick to the brace counter as primary. 
    // If brace counter failed, it means the JSON structure is broken (e.g. unescaped chars).

    // Let's try a more permissive regex for createFile specifically if we still have nothing
    if (argsList.length === 0) {
        // Try to find "path": "..." and "content": "..." in close proximity
        // This is hard to do reliably with regex for multiple files.
        // Let's rely on the user's report that "one file works".
        // If we have nothing, return empty array.
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
