import assert from "node:assert/strict"
import { describe, test } from "node:test"

import type { SkillCatalogEntry } from "../../bridge/types"
import { compactSkillInvocationText, extractSkillInvocationName, findSkillInvocationMatch, isWrappedSkillInvocationOutput, matchSkillInvocationContent, matchSkillInvocationText, normalizeSkillText } from "./skill-invocation"

const WRAPPED_OUTPUT = `
<skill_content name="using-superpowers">
# Skill: using-superpowers

# Using Skills

Always check the skill list first.

Base directory for this skill: file:///tmp/skills/using-superpowers
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>

</skill_files>
</skill_content>
`

const ARTICLE_WRITING_SKILL: SkillCatalogEntry[] = [{
  name: "article-writing",
  content: `# Article Writing

Write long-form content that sounds like a real person or brand, not generic AI output.
`,
}]

const BRAINSTORMING_SKILL: SkillCatalogEntry[] = [{
  name: "brainstorming",
  content: `# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it.
</HARD-GATE>

## Checklist

You MUST create a task for each of these items and complete them in order:

1. **Explore project context** - check files, docs, recent commits
2. **Ask clarifying questions** - one at a time
3. **Present design** - in sections scaled to their complexity
`,
}]

describe("extractSkillInvocationName", () => {
  test("extracts the name from wrapped HyperCode skill output", () => {
    assert.equal(extractSkillInvocationName(WRAPPED_OUTPUT), "using-superpowers")
  })

  test("falls back to the heading when wrapper metadata is missing", () => {
    assert.equal(extractSkillInvocationName("# Skill: test-skill\n\nBody"), "test-skill")
  })

  test("falls back to the provided name when output is empty", () => {
    assert.equal(extractSkillInvocationName("", "using-superpowers"), "using-superpowers")
  })
})

describe("matchSkillInvocationText", () => {
  test("matches wrapped skill text with trailing remainder", () => {
    assert.deepEqual(matchSkillInvocationText(`${WRAPPED_OUTPUT}\n缁х画鎵ц`), {
      name: "using-superpowers",
      remainder: "缁х画鎵ц",
    })
  })

  test("ignores non-skill text", () => {
    assert.equal(matchSkillInvocationText("hello"), undefined)
  })
})

describe("matchSkillInvocationContent", () => {
  test("matches exact skill content from the catalog", () => {
    assert.deepEqual(matchSkillInvocationContent(ARTICLE_WRITING_SKILL[0]!.content, ARTICLE_WRITING_SKILL), {
      name: "article-writing",
      remainder: "",
    })
  })

  test("matches exact skill content with trailing remainder", () => {
    assert.deepEqual(matchSkillInvocationContent(`${ARTICLE_WRITING_SKILL[0]!.content}\n缁х画鎵ц`, ARTICLE_WRITING_SKILL), {
      name: "article-writing",
      remainder: "缁х画鎵ц",
    })
  })

  test("matches brainstorming skill content from the catalog", () => {
    assert.deepEqual(matchSkillInvocationContent(`${BRAINSTORMING_SKILL[0]!.content}\n缁х画璁捐`, BRAINSTORMING_SKILL), {
      name: "brainstorming",
      remainder: "缁х画璁捐",
    })
  })
})

describe("findSkillInvocationMatch", () => {
  test("prefers the wrapped format before catalog matching", () => {
    assert.deepEqual(findSkillInvocationMatch(WRAPPED_OUTPUT, ARTICLE_WRITING_SKILL), {
      name: "using-superpowers",
      remainder: "",
    })
  })
})

describe("isWrappedSkillInvocationOutput", () => {
  test("recognizes wrapped skill output", () => {
    assert.equal(isWrappedSkillInvocationOutput(WRAPPED_OUTPUT), true)
  })

  test("ignores plain text output", () => {
    assert.equal(isWrappedSkillInvocationOutput("hello"), false)
  })
})

describe("normalizeSkillText", () => {
  test("normalizes line endings and trims surrounding whitespace", () => {
    assert.equal(normalizeSkillText(" \r\n# Skill: test-skill\r\n"), "# Skill: test-skill")
  })
})

describe("compactSkillInvocationText", () => {
  test("rewrites wrapped skill text to a slash command", () => {
    assert.equal(compactSkillInvocationText(WRAPPED_OUTPUT), "/using-superpowers ")
  })

  test("rewrites wrapped skill text with trailing remainder", () => {
    assert.equal(compactSkillInvocationText(`${WRAPPED_OUTPUT}\n缁х画鎵ц`), "/using-superpowers\n\n缁х画鎵ц")
  })

  test("rewrites exact matched skill content to a slash command", () => {
    assert.equal(compactSkillInvocationText(ARTICLE_WRITING_SKILL[0]!.content, ARTICLE_WRITING_SKILL), "/article-writing ")
  })

  test("rewrites brainstorming skill content to a slash command", () => {
    assert.equal(compactSkillInvocationText(BRAINSTORMING_SKILL[0]!.content, BRAINSTORMING_SKILL), "/brainstorming ")
  })
})
