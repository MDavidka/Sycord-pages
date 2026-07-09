import type { ContinueStateSnapshot } from './types';

export class ContinueAgentClient {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  async getState(): Promise<ContinueStateSnapshot> {
    const res = await fetch(this.url('/state'), { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Continue agent state failed (${res.status})`);
    }
    return res.json();
  }

  async sendMessage(message: string): Promise<void> {
    const res = await fetch(this.url('/message'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Continue agent message failed (${res.status}): ${body.slice(0, 200)}`);
    }
  }

  async approvePermission(requestId: string, approved: boolean): Promise<void> {
    const res = await fetch(this.url('/permission'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, approved }),
    });
    if (!res.ok) {
      throw new Error(`Continue permission failed (${res.status})`);
    }
  }

  async pause(): Promise<void> {
    await fetch(this.url('/pause'), { method: 'POST' });
  }
}

export function extractAssistantText(state: ContinueStateSnapshot): string {
  const history = state.session?.history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item?.message?.role === 'assistant') {
      const content = item.message.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content
          .map((part) => (typeof part === 'object' && part && 'text' in part ? String((part as { text?: string }).text ?? '') : ''))
          .join('');
      }
      return '';
    }
  }
  return '';
}
