# Cursor User Rules Template

Copy these rules to your Cursor Settings → Rules (User Rules) to apply them globally across all projects.

---

## How to Apply

1. Open Cursor
2. Go to **Settings** (⌘ + ,)
3. Search for "Rules" or navigate to **General → Rules for AI**
4. Paste the rules below into the **User Rules** text area

---

## Recommended User Rules

```
## Communication Style

- Be concise and direct. Cut the fluff.
- Answer first, explain later only if needed.
- Use casual, brief communication.
- Focus on code and actionable explanations.

## Engineering Workflow

When I say "plan" or "design":
- Research the codebase first
- Create a structured implementation plan
- Break down into atomic tasks
- Identify acceptance criteria
- Note risks and dependencies

When I say "work" or "implement":
- Follow the plan systematically
- Make incremental, testable changes
- Validate after each change
- Match existing code patterns exactly
- Handle errors and edge cases

When I say "review" or "audit":
- Analyze from multiple perspectives: security, performance, architecture
- Rate each dimension
- Prioritize: critical issues → warnings → suggestions
- Be specific with line numbers and fixes

## Code Quality

- Never use `any` in TypeScript without explicit reason
- Always handle error cases
- Match existing code style exactly
- Write self-documenting code
- Prefer composition over inheritance
- Keep functions small and focused

## General Preferences

- Read files before proposing changes
- Only change what's necessary
- Don't over-engineer or add unnecessary abstractions
- Use the simplest solution that works
- Consider performance implications
- Test edge cases

## What NOT to do

- Don't add features beyond what was asked
- Don't refactor unrelated code
- Don't add error handling for impossible scenarios
- Don't create helpers for one-time operations
- Don't skip reading existing code
- Don't leave debug code or console.logs
```

---

## Optional: Extended Rules

Add these if you want more specific behaviors:

```
## Git Practices

- Suggest conventional commit messages (feat:, fix:, refactor:, etc.)
- Prefer atomic commits
- Note when changes might need a migration

## Documentation

- Focus on WHY, not WHAT
- Document complex business logic
- Keep comments close to code

## Testing

- Suggest tests for new functionality
- Cover happy paths and error cases
- Test edge cases and boundaries
```

---

## Per-Project Customization

For project-specific rules, create files in `.cursor/rules/` with the `.mdc` extension.

Example structure:
```
.cursor/
└── rules/
    ├── planning.mdc      # Planning workflow
    ├── execution.mdc     # Implementation workflow
    ├── review.mdc        # Code review workflow
    ├── general.mdc       # General principles
    ├── solidity.mdc      # Solidity-specific
    ├── frontend.mdc      # Frontend-specific
    └── typescript.mdc    # TypeScript-specific
```

Each `.mdc` file uses frontmatter to define when it applies:

```markdown
---
description: Rule description
globs:
  - "**/*.sol"           # Apply to Solidity files
alwaysApply: false       # Only when matching files are in context
---

# Rule content here
```

