import re

with open('glovix/lib/systemPrompts.ts', 'r') as f:
    content = f.read()

# Fix the template literal escaping
content = content.replace(
    'If the file `\\.glovix/deep-memory.md`',
    'If the file \\`\\.glovix/deep-memory.md\\`'
)
content = content.replace(
    "`readFile('.glovix/deep-memory.md')`",
    "\\`readFile('.glovix/deep-memory.md')\\`"
)
content = content.replace(
    'If the file `\\.glovix/context.md`',
    'If the file \\`\\.glovix/context.md\\`'
)
content = content.replace(
    "`readFile('.glovix/context.md')`",
    "\\`readFile('.glovix/context.md')\\`"
)
content = content.replace(
    'Always update `\\.glovix/deep-memory.md`',
    'Always update \\`\\.glovix/deep-memory.md\\`'
)
content = content.replace(
    '`saveKnowledge`',
    '\\`saveKnowledge\\`'
)
content = content.replace(
    '`listKnowledge`',
    '\\`listKnowledge\\`'
)
content = content.replace(
    '`callKnowledge`',
    '\\`callKnowledge\\`'
)
content = content.replace(
    '`saveKnowledge({ title: "...", content: "..." })`',
    '\\`saveKnowledge({ title: "...", content: "..." })\\`'
)
content = content.replace(
    '`listKnowledge()`',
    '\\`listKnowledge()\\`'
)
content = content.replace(
    '`callKnowledge({ title: "..." })`',
    '\\`callKnowledge({ title: "..." })\\`'
)


with open('glovix/lib/systemPrompts.ts', 'w') as f:
    f.write(content)
