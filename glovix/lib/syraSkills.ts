export type SyraSkill = {
    id: string;
    label: string;
    description: string;
    defaultEnabled: boolean;
    comingSoon?: boolean;
};

export const SYRA_SKILLS: SyraSkill[] = [
    {
        id: 'vercel-react-best-practices',
        label: 'Vercel React Best Practices',
        description: 'React patterns, hooks, and performance conventions from Vercel.',
        defaultEnabled: true,
    },
    {
        id: 'web-design-guidelines',
        label: 'Web Design Guidelines',
        description: 'Layout, typography, spacing, and accessible UI standards.',
        defaultEnabled: true,
    },
    {
        id: 'vercel-composition-patterns',
        label: 'Vercel Composition Patterns',
        description: 'Composable components, slots, and scalable UI architecture.',
        defaultEnabled: true,
    },
    {
        id: 'next-best-practices',
        label: 'Next Best Practices',
        description: 'Routing, data fetching, and App Router conventions where relevant.',
        defaultEnabled: true,
    },
    {
        id: 'vercel-react-view-transitions',
        label: 'Vercel React View Transitions',
        description: 'Smooth page and state transitions with the View Transitions API.',
        defaultEnabled: true,
    },
    {
        id: 'mcp',
        label: 'MCP',
        description: 'Model Context Protocol integrations for external tools.',
        defaultEnabled: false,
        comingSoon: true,
    },
];

const STORAGE_KEY = 'syra:active-skills';

export function getDefaultActiveSkillIds(): string[] {
    return SYRA_SKILLS.filter((s) => s.defaultEnabled && !s.comingSoon).map((s) => s.id);
}

export function loadActiveSkillIds(): string[] {
    if (typeof window === 'undefined') return getDefaultActiveSkillIds();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultActiveSkillIds();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return getDefaultActiveSkillIds();
        const allowed = new Set(SYRA_SKILLS.filter((s) => !s.comingSoon).map((s) => s.id));
        return parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id));
    } catch {
        return getDefaultActiveSkillIds();
    }
}

export function saveActiveSkillIds(ids: string[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch { /* ignore */ }
}

export function buildSkillsPrompt(activeSkillIds: string[]): string {
    const active = SYRA_SKILLS.filter((s) => activeSkillIds.includes(s.id) && !s.comingSoon);
    if (active.length === 0) return '';

    const lines = active.map((s) => `- **${s.label}** (${s.id}): ${s.description}`);
    return `## Active skills (follow these conventions)\n\n${lines.join('\n')}`;
}
