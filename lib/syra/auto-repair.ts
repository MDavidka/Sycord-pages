import { ValidationDiagnostic, ValidationResult } from './validator';

export interface RepairOperation {
  id: string;
  diagnostic: ValidationDiagnostic;
  originalCode: string;
  repairedCode: string;
  confidence: number;
  applied: boolean;
}

export interface RepairResult {
  success: boolean;
  passes: number;
  maxPasses: number;
  operations: RepairOperation[];
  finalCode: string;
  validationResult: ValidationResult;
}

const MAX_REPAIR_PASSES = 3;

/**
 * Attempt to auto-repair code based on validation diagnostics
 */
export function autoRepairCode(
  code: string,
  validationResult: ValidationResult,
  maxPasses: number = MAX_REPAIR_PASSES,
): RepairResult {
  let currentCode = code;
  let passNumber = 0;
  const operations: RepairOperation[] = [];

  while (passNumber < maxPasses && !validationResult.isValid) {
    const repairOperations = applyRepairs(currentCode, validationResult.diagnostics);

    if (repairOperations.length === 0) {
      break; // No repairs could be applied
    }

    for (const op of repairOperations) {
      currentCode = op.repairedCode;
      operations.push({ ...op, applied: true });
    }

    passNumber++;

    // Re-validate (in production, would call validator)
    const stillHasErrors = validationResult.diagnostics.some(d => d.severity === 'error');
    if (!stillHasErrors) {
      validationResult.isValid = true;
    }
  }

  return {
    success: validationResult.isValid,
    passes: passNumber,
    maxPasses,
    operations,
    finalCode: currentCode,
    validationResult,
  };
}

/**
 * Apply repairs for specific diagnostic codes
 */
function applyRepairs(code: string, diagnostics: ValidationDiagnostic[]): RepairOperation[] {
  const operations: RepairOperation[] = [];

  for (const diagnostic of diagnostics) {
    let repaired: RepairOperation | null = null;

    switch (diagnostic.code) {
      case 'SYNTAX_BRACE_MISMATCH':
        repaired = repairBraceMismatch(code, diagnostic);
        break;
      case 'SYNTAX_STRING_MISMATCH':
        repaired = repairStringMismatch(code, diagnostic);
        break;
      case 'IMPORT_EXPLICIT_JS_EXT':
        repaired = repairImportExtension(code, diagnostic);
        break;
      case 'REACT_IMPORT_MISSING':
        repaired = repairMissingReactImport(code, diagnostic);
        break;
      case 'A11Y_IMG_ALT':
        repaired = repairMissingAltText(code, diagnostic);
        break;
      case 'A11Y_BUTTON_LABEL':
        repaired = repairButtonLabel(code, diagnostic);
        break;
      case 'ASYNC_NO_ERROR_HANDLING':
        repaired = repairAsyncErrorHandling(code, diagnostic);
        break;
    }

    if (repaired) {
      operations.push(repaired);
      code = repaired.repairedCode;
    }
  }

  return operations;
}

/**
 * Repair brace mismatch
 */
function repairBraceMismatch(code: string, diagnostic: ValidationDiagnostic): RepairOperation | null {
  const braceCount = (code.match(/\{/g) || []).length;
  const closeCount = (code.match(/\}/g) || []).length;

  if (braceCount > closeCount) {
    // Add missing closing braces
    const repaired = code + '\n' + '}'.repeat(braceCount - closeCount);
    return {
      id: `repair_${Date.now()}`,
      diagnostic,
      originalCode: code,
      repairedCode: repaired,
      confidence: 0.7,
      applied: false,
    };
  }

  return null;
}

/**
 * Repair string mismatch
 */
function repairStringMismatch(code: string, diagnostic: ValidationDiagnostic): RepairOperation | null {
  // Count quote types
  const singleQuotes = (code.match(/'/g) || []).length;
  const doubleQuotes = (code.match(/"/g) || []).length;
  const backticks = (code.match(/`/g) || []).length;

  if (singleQuotes % 2 !== 0 && doubleQuotes % 2 === 0) {
    // Missing single quote
    const repaired = code + "'";
    return {
      id: `repair_${Date.now()}`,
      diagnostic,
      originalCode: code,
      repairedCode: repaired,
      confidence: 0.5,
      applied: false,
    };
  }

  return null;
}

/**
 * Repair explicit .js extension in imports
 */
function repairImportExtension(code: string, diagnostic: ValidationDiagnostic): RepairOperation | null {
  const repaired = code.replace(/from\s+['"]([^'"]+)\.js['"]/, "from '$1'");

  if (repaired !== code) {
    return {
      id: `repair_${Date.now()}`,
      diagnostic,
      originalCode: code,
      repairedCode: repaired,
      confidence: 0.95,
      applied: false,
    };
  }

  return null;
}

/**
 * Repair missing React import
 */
function repairMissingReactImport(code: string, diagnostic: ValidationDiagnostic): RepairOperation | null {
  if (code.includes('use client')) {
    // Next.js client component, React import not needed
    return null;
  }

  const repaired = "import React from 'react';\n\n" + code;

  return {
    id: `repair_${Date.now()}`,
    diagnostic,
    originalCode: code,
    repairedCode: repaired,
    confidence: 0.9,
    applied: false,
  };
}

/**
 * Repair missing alt text on images
 */
function repairMissingAltText(code: string, diagnostic: ValidationDiagnostic): RepairOperation | null {
  const repaired = code.replace(/<img([^>]*?)>/g, (match, attrs) => {
    if (attrs.includes('alt=')) return match;

    // Extract src to create a reasonable alt text
    const srcMatch = attrs.match(/src=["']([^"']+)["']/);
    let altText = 'Image';
    if (srcMatch) {
      altText = srcMatch[1]
        .split('/').pop()
        ?.split('.')[0]
        ?.replace(/[-_]/g, ' ')
        ?.trim() || 'Image';
    }

    return `<img${attrs} alt="${altText}">`;
  });

  if (repaired !== code) {
    return {
      id: `repair_${Date.now()}`,
      diagnostic,
      originalCode: code,
      repairedCode: repaired,
      confidence: 0.8,
      applied: false,
    };
  }

  return null;
}

/**
 * Repair button without label
 */
function repairButtonLabel(code: string, diagnostic: ValidationDiagnostic): RepairOperation | null {
  const repaired = code.replace(/<button([^>]*)>\s*<\/button>/g, (match, attrs) => {
    if (attrs.includes('aria-label') || attrs.includes('title')) {
      return match;
    }

    return `<button${attrs} aria-label="Button">Button</button>`;
  });

  if (repaired !== code) {
    return {
      id: `repair_${Date.now()}`,
      diagnostic,
      originalCode: code,
      repairedCode: repaired,
      confidence: 0.7,
      applied: false,
    };
  }

  return null;
}

/**
 * Repair async function without error handling
 */
function repairAsyncErrorHandling(code: string, diagnostic: ValidationDiagnostic): RepairOperation | null {
  // Find async function and wrap body in try/catch if not already present
  const asyncRegex = /(async\s+function\s+\w+[^{]*\{)([\s\S]*?)(^})/m;
  const match = code.match(asyncRegex);

  if (match && !match[2].includes('try')) {
    const repaired = code.replace(
      asyncRegex,
      `$1\n  try {\n$2  } catch (error) {\n    console.error('Error:', error);\n  }\n$3`,
    );

    return {
      id: `repair_${Date.now()}`,
      diagnostic,
      originalCode: code,
      repairedCode: repaired,
      confidence: 0.6,
      applied: false,
    };
  }

  return null;
}

/**
 * Create repair summary for UI display
 */
export function createRepairSummary(result: RepairResult): string {
  if (result.operations.length === 0) {
    return 'No repairs were needed.';
  }

  let summary = `Applied ${result.operations.length} repair${result.operations.length === 1 ? '' : 's'} in ${result.passes} pass${result.passes === 1 ? '' : 'es'}:\n`;

  for (const op of result.operations) {
    summary += `- ${op.diagnostic.code}: ${op.diagnostic.message}\n`;
  }

  if (result.success) {
    summary += `\nResult: All issues fixed! ✓`;
  } else {
    summary += `\nResult: Some issues remain (requires manual review)`;
  }

  return summary;
}
