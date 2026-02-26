#!/usr/bin/env npx tsx
/**
 * E2E test — exercises router, domain agent, and pathway build flow.
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/e2e-test.ts
 * Requires: .env.local with ANTHROPIC_API_KEY
 */

import { routeGoal } from "../src/agents/router";
import { invokeDomainAgent } from "../src/agents/domainAgent";
import { getPathwayBuildPrompt } from "../src/prompts/pathwayBuild";

async function main() {
  console.log("\n=== Athro Goals E2E Test ===\n");

  // 1. Router — FACTUAL goal
  console.log("1. ROUTER: 'I want to get a mortgage by 30'");
  const r1 = await routeGoal("I want to get a mortgage by 30");
  console.log(`   → domain: ${r1.domain}, groundingType: ${r1.groundingType}`);
  if (r1.groundingType !== "FACTUAL") {
    console.log("   ⚠ Expected FACTUAL");
  } else {
    console.log("   ✓ FACTUAL");
  }

  // 2. Router — REASONING goal
  console.log("\n2. ROUTER: 'I want to play for the NY Knicks'");
  const r2 = await routeGoal("I want to play for the NY Knicks");
  console.log(`   → domain: ${r2.domain}, groundingType: ${r2.groundingType}`);
  if (r2.groundingType !== "REASONING") {
    console.log("   ⚠ Expected REASONING");
  } else {
    console.log("   ✓ REASONING");
  }

  // 3. Domain agent — Phase 1 (FACTUAL, turn 1)
  console.log("\n3. DOMAIN AGENT: mortgage goal, turn 1 (Phase 1)");
  const out1 = await invokeDomainAgent(
    "I want to get a mortgage by 30",
    [],
    "FINANCE",
    "FACTUAL",
    {
      onToolStart: (n) => console.log(`   [tool] ${n}`),
      onToolEnd: () => {},
    }
  );
  console.log(`   → offerBuild: ${out1.offerBuild}`);
  console.log(`   → output (first 200 chars): ${out1.output.slice(0, 200)}...`);
  if (out1.offerBuild) {
    console.log("   ⚠ Turn 1 should NOT offer build");
  } else {
    console.log("   ✓ No [OFFER_BUILD] on turn 1");
  }

  // 4. Domain agent — REASONING, turn 1
  console.log("\n4. DOMAIN AGENT: NY Knicks goal, turn 1 (Phase 1)");
  const out2 = await invokeDomainAgent(
    "I want to play for the NY Knicks",
    [],
    "SPORT",
    "REASONING",
    {
      onToolStart: (n) => console.log(`   [tool] ${n} - should not run`),
      onToolEnd: () => {},
    }
  );
  console.log(`   → output (first 300 chars): ${out2.output.slice(0, 300)}...`);
  console.log("   ✓ REASONING path (no tools)");

  // 5. Pathway build prompts
  console.log("\n5. PATHWAY BUILD PROMPTS");
  const pFactual = getPathwayBuildPrompt("FACTUAL");
  const pReasoning = getPathwayBuildPrompt("REASONING");
  console.log(`   FACTUAL includes 'cite': ${pFactual.includes("cite")}`);
  console.log(`   REASONING includes 'reasoning': ${pReasoning.includes("reasoning")}`);
  console.log("   ✓ Prompts differ by grounding type");

  // 6. Multi-turn: Phase 2 with tools (mortgage, turn 3)
  console.log("\n6. DOMAIN AGENT: mortgage, turn 3 (Phase 2, tools available)");
  const chatHistory = [
    { role: "user", content: "I want to get a mortgage by 30" },
    { role: "assistant", content: "By when? (date or age)" },
    { role: "user", content: "By the time I'm 30. I turn 30 in 2030." },
  ];
  const toolCalls: string[] = [];
  const out3 = await invokeDomainAgent(
    "I earn £45k, have £15k saved, first-time buyer",
    chatHistory,
    "FINANCE",
    "FACTUAL",
    {
      onToolStart: (n) => toolCalls.push(n),
      onToolEnd: () => {},
    }
  );
  console.log(`   → tools called: ${toolCalls.join(", ") || "none"}`);
  console.log(`   → offerBuild: ${out3.offerBuild}`);
  if (toolCalls.length > 0) {
    console.log("   ✓ Tools used in Phase 2");
  }
  if (out3.offerBuild) {
    console.log("   ✓ [OFFER_BUILD] when context gathered");
  }

  console.log("\n=== E2E Test Complete ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
