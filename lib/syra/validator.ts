export interface ValidationDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: {
    file?: string;
    line?: number;
  };
  suggestedFix?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  diagnostics: ValidationDiagnostic[];
  summary: string;
  canAutoRepair: boolean;
}

/**
 * Validate generated code against multiple criteria
 */
export function validateCode(
  code: string,
  fileName: string,
  context?: {
    imports: string[];
    targetFramework?: string;
  },
): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];

  // Check syntax
  diagnosticsSyntax(code, fileName, diagnostics);

  // Check imports
  diagnosticsImports(code, diagnostics, context?.imports || []);

  // Check TypeScript/React patterns
  diagnosticsPatterns(code, fileName, diagnostics, context?.targetFramework);

  // Check styling consistency
  diagnosticsStyles(code, diagnostics);

  // Check accessibility
  diagnosticsAccessibility(code, diagnostics);

  // Calculate score
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 5);

  const canAutoRepair = diagnostics
    .filter(d => d.severity === 'error')
    .every(d => d.suggestedFix !== undefined);

  return {
    isValid: errors === 0,
    score,
    diagnostics,
    summary: `${errors} errors, ${warnings} warnings`,
    canAutoRepair,
  };
}

/**
 * Check for syntax errors
 */
function diagnosticsSyntax(code: string, fileName: string, diagnostics: ValidationDiagnostic[]): void {
  const isTsx = fileName.endsWith('.tsx') || fileName.endsWith('.ts');

  if (isTsx) {
    // Check for unmatched braces
    const braces = { '{': 0, '[': 0, '(': 0 };
    const closes = { '}': 0, ']': 0, ')': 0 };

    for (const char of code) {
      if (char === '{') braces['{']++;
      if (char === '}') closes['}']++;
      if (char === '[') braces['[']++;
      if (char === ']') closes[']']++;
      if (char === '(') braces['(']++;
      if (char === ')') closes[')']++;
    }

    if (braces['{'] !== closes['}']) {
      diagnostics.push({
        severity: 'error',
        code: 'SYNTAX_BRACE_MISMATCH',
        message: 'Unmatched braces detected',
        suggestedFix: 'Check for missing { or }',
      });
    }
  }

  // Check for incomplete strings
  const stringRegex = /(['"`])(.*?)\1/g;
  const unmatchedQuotes = (code.match(/['"`]/g) || []).length % 2;
  if (unmatchedQuotes !== 0) {
    diagnostics.push({
      severity: 'error',
      code: 'SYNTAX_STRING_MISMATCH',
      message: 'Unmatched quote detected',
      suggestedFix: 'Check for unclosed strings',
    });
  }
}

/**
 * Check for import issues
 */
function diagnosticsImports(code: string, diagnostics: ValidationDiagnostic[], knownImports: string[]): void {
  const importRegex = /import\s+(?:.*?from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];

    // Check for relative imports that might be broken
    if (importPath.startsWith('.') && importPath.endsWith('.js')) {
      diagnostics.push({
        severity: 'warning',
        code: 'IMPORT_EXPLICIT_JS_EXT',
        message: `Avoid explicit .js extension in relative imports: ${importPath}`,
        suggestedFix: `Use '${importPath.replace('.js', '')}' instead`,
      });
    }

    // Check for unused imports (simplified)
    if (knownImports.length > 0 && !knownImports.includes(importPath)) {
      diagnostics.push({
        severity: 'info',
        code: 'IMPORT_UNKNOWN',
        message: `Import path not in known project files: ${importPath}`,
      });
    }
  }
}

/**
 * Check for React/TypeScript pattern issues
 */
function diagnosticsPatterns(
  code: string,
  fileName: string,
  diagnostics: ValidationDiagnostic[],
  framework?: string,
): void {
  // Check for missing React import in JSX files
  if ((fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) && code.includes('<')) {
    if (!code.includes("import React") && !code.includes('use client') && !code.includes("import {")) {
      diagnostics.push({
        severity: 'warning',
        code: 'REACT_IMPORT_MISSING',
        message: 'JSX detected but no React import',
        suggestedFix: "Add 'import React from \"react\";' at the top",
      });
    }
  }

  // Check for console.log in production code
  if (code.match(/console\.(log|error|warn)\(/g)) {
    diagnostics.push({
      severity: 'info',
      code: 'CONSOLE_STATEMENT',
      message: 'Console statements detected',
      suggestedFix: 'Consider removing console statements for production code',
    });
  }

  // Check for missing error handling in async functions
  if (code.includes('async ') && !code.includes('try') && !code.includes('.catch')) {
    diagnostics.push({
      severity: 'warning',
      code: 'ASYNC_NO_ERROR_HANDLING',
      message: 'Async function without error handling',
      suggestedFix: 'Add try/catch or .catch() to handle errors',
    });
  }
}

/**
 * Check styling consistency
 */
function diagnosticsStyles(code: string, diagnostics: ValidationDiagnostic[]): void {
  // Check for inline styles (discouraged)
  if (code.match(/style\s*=\s*\{/g)) {
    const count = (code.match(/style\s*=\s*\{/g) || []).length;
    diagnostics.push({
      severity: 'info',
      code: 'INLINE_STYLES',
      message: `${count} inline styles detected`,
      suggestedFix: 'Consider using Tailwind classes or CSS modules instead',
    });
  }

  // Check for class name conflicts
  if (code.match(/className\s*=\s*['"]/g)) {
    diagnostics.push({
      severity: 'info',
      code: 'CLASSNAME_PRESENT',
      message: 'Class names detected - ensure they follow project conventions',
    });
  }
}

/**
 * Check accessibility
 */
function diagnosticsAccessibility(code: string, diagnostics: ValidationDiagnostic[]): void {
  // Check for missing alt text on images
  const imgRegex = /<img[^>]*>/g;
  let match;

  while ((match = imgRegex.exec(code)) !== null) {
    if (!match[0].includes('alt=')) {
      diagnostics.push({
        severity: 'error',
        code: 'A11Y_IMG_ALT',
        message: 'Image missing alt text',
        location: { line: code.substring(0, match.index).split('\n').length },
        suggestedFix: 'Add alt attribute to image tag',
      });
    }
  }

  // Check for missing button labels
  const buttonRegex = /<button[^>]*>[^<]*<\/button>/g;
  while ((match = buttonRegex.exec(code)) !== null) {
    if (match[0].match(/>[\s]*</)) {
      diagnostics.push({
        severity: 'warning',
        code: 'A11Y_BUTTON_LABEL',
        message: 'Button with no visible text or aria-label',
        suggestedFix: 'Add text content or aria-label attribute',
      });
    }
  }
}

/**
 * Generate a detailed diagnostic report
 */
export function generateDiagnosticReport(result: ValidationResult): string {
  let report = `Validation Report\n`;
  report += `================\n`;
  report += `Status: ${result.isValid ? 'VALID' : 'INVALID'}\n`;
  report += `Score: ${result.score}/100\n`;
  report += `Summary: ${result.summary}\n`;
  report += `Can Auto-Repair: ${result.canAutoRepair ? 'Yes' : 'No'}\n\n`;

  report += `Diagnostics:\n`;
  if (result.diagnostics.length === 0) {
    report += `No issues found.\n`;
  } else {
    for (const diag of result.diagnostics) {
      const severity = diag.severity.toUpperCase();
      report += `\n[${severity}] ${diag.code}\n`;
      report += `  Message: ${diag.message}\n`;
      if (diag.suggestedFix) {
        report += `  Fix: ${diag.suggestedFix}\n`;
      }
      if (diag.location?.file) {
        report += `  Location: ${diag.location.file}:${diag.location.line || 'unknown'}\n`;
      }
    }
  }

  return report;
}
