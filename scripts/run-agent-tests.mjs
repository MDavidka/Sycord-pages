#!/usr/bin/env node
/**
 * Test Runner Script for Autonomous Agent Verification
 */

import { runAllTests } from '../tests/agent-resilience.ts';

async function main() {
  const result = await runAllTests();
  if (!result.passed) {
    console.error(`\n❌ TEST SUITE FAILED: ${result.summary}`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL AUTOMATED TEST CASES PASSED SUCCESSFULLY!\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
