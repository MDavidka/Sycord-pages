export type BuildIntent =
  | 'create_new_page'
  | 'create_new_component'
  | 'create_api_endpoint'
  | 'edit_existing_page'
  | 'edit_existing_component'
  | 'fix_bug'
  | 'refactor_code'
  | 'add_feature'
  | 'update_styles'
  | 'other';

export interface DetectedIntent {
  type: BuildIntent;
  confidence: number;
  targetFiles: string[];
  scope: 'small' | 'medium' | 'large';
  requiresPlan: boolean;
  keyPhrases: string[];
}

const intentPatterns: Record<BuildIntent, { keywords: string[]; scope: 'small' | 'medium' | 'large' }> = {
  create_new_page: {
    keywords: ['new page', 'create page', 'add page', 'build page'],
    scope: 'medium',
  },
  create_new_component: {
    keywords: ['new component', 'create component', 'add component', 'build component'],
    scope: 'small',
  },
  create_api_endpoint: {
    keywords: ['api endpoint', 'new api', 'add api', 'route handler'],
    scope: 'small',
  },
  edit_existing_page: {
    keywords: ['update page', 'edit page', 'modify page', 'change page'],
    scope: 'medium',
  },
  edit_existing_component: {
    keywords: ['update component', 'edit component', 'modify component', 'change component'],
    scope: 'small',
  },
  fix_bug: {
    keywords: ['fix', 'bug', 'error', 'broken', 'not working', 'issue'],
    scope: 'medium',
  },
  refactor_code: {
    keywords: ['refactor', 'clean up', 'improve code', 'optimize'],
    scope: 'medium',
  },
  add_feature: {
    keywords: ['add feature', 'new feature', 'feature request', 'implement'],
    scope: 'large',
  },
  update_styles: {
    keywords: ['style', 'color', 'design', 'css', 'tailwind', 'visual'],
    scope: 'small',
  },
  other: {
    keywords: [],
    scope: 'small',
  },
};

/**
 * Detect user intent from prompt
 */
export function detectIntent(prompt: string): DetectedIntent {
  const lowerPrompt = prompt.toLowerCase();
  const detectedIntents: { type: BuildIntent; score: number; keyPhrases: string[] }[] = [];

  for (const [intentType, { keywords }] of Object.entries(intentPatterns)) {
    let score = 0;
    const matchedPhrases: string[] = [];

    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        score += 1;
        matchedPhrases.push(keyword);
      }
    }

    if (score > 0) {
      detectedIntents.push({
        type: intentType as BuildIntent,
        score,
        keyPhrases: matchedPhrases,
      });
    }
  }

  // Sort by score descending
  detectedIntents.sort((a, b) => b.score - a.score);

  if (detectedIntents.length === 0) {
    return {
      type: 'other',
      confidence: 0.5,
      targetFiles: [],
      scope: 'small',
      requiresPlan: false,
      keyPhrases: [],
    };
  }

  const topIntent = detectedIntents[0];
  const confidence = Math.min(topIntent.score / 3, 1);
  const scope = intentPatterns[topIntent.type].scope;
  const requiresPlan = scope === 'large' || topIntent.type.includes('fix');

  return {
    type: topIntent.type,
    confidence,
    targetFiles: [],
    scope,
    requiresPlan,
    keyPhrases: topIntent.keyPhrases,
  };
}

/**
 * Determine if prompt requires AI planning before code generation
 */
export function shouldCreatePlan(intent: DetectedIntent, promptLength: number): boolean {
  // Always plan for large scope changes
  if (intent.scope === 'large') return true;

  // Plan for complex prompts
  if (promptLength > 200) return true;

  // Plan for bugs and refactoring
  if (intent.type === 'fix_bug' || intent.type === 'refactor_code') return true;

  // Plan if explicitly requested
  if (intent.requiresPlan) return true;

  return false;
}
