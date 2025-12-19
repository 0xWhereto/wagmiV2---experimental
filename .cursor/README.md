# Compound Engineering Rules for Cursor

This directory contains Cursor AI rules that replicate the functionality of the [Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin).

## Quick Start

The rules are automatically active when you use Cursor in this project.

### Workflow Commands

Use these keywords to trigger specific workflows:

| Command | Trigger Words | What It Does |
|---------|---------------|--------------|
| **Plan** | "plan", "design", "architect" | Creates structured implementation plans with acceptance criteria |
| **Work** | "work", "implement", "build", "code" | Systematic task execution with validation |
| **Review** | "review", "check", "audit" | Multi-dimensional code review (security, performance, architecture) |

## Rules Structure

```
.cursor/
├── rules/
│   ├── planning.mdc       # Planning workflow rules
│   ├── execution.mdc      # Implementation workflow rules
│   ├── review.mdc         # Code review workflow rules
│   ├── general.mdc        # General engineering principles
│   ├── solidity.mdc       # Solidity & smart contract rules
│   ├── frontend.mdc       # React/Next.js frontend rules
│   ├── typescript.mdc     # TypeScript best practices
│   ├── indexer.mdc        # Blockchain indexer rules
│   └── scripts.mdc        # Script/automation rules
├── README.md              # This file
└── USER_RULES_TEMPLATE.md # Global user rules to copy to Cursor settings
```

## How It Works

### 1. Planning Phase (`plan`)

When you ask to "plan" a feature:

1. **Codebase Research**: Analyzes existing patterns and conventions
2. **Structured Plan**: Creates detailed implementation plan with:
   - Feature summary and user story
   - Acceptance criteria
   - Technical approach
   - Task breakdown with complexity estimates
   - Risks and mitigations

### 2. Execution Phase (`work`)

When you ask to "implement" a feature:

1. **Context Gathering**: Reads and understands relevant files
2. **Systematic Implementation**: Follows atomic, testable changes
3. **Continuous Validation**: Checks for errors after each change
4. **Quality Gates**: Ensures code meets standards before completion

### 3. Review Phase (`review`)

When you ask to "review" code:

1. **Multi-Dimensional Analysis**:
   - 🔒 Security (vulnerabilities, access control)
   - ⚡ Performance (complexity, efficiency)
   - 🏛️ Architecture (SOLID, coupling, patterns)
   - 📝 Code Quality (readability, DRY)
   - 🧪 Testing (coverage, edge cases)
   - 🔧 Maintainability (docs, types)

2. **Prioritized Findings**:
   - 🔴 Critical issues (must fix)
   - 🟡 Warnings (should fix)
   - 🟢 Suggestions (nice to have)

## Applying to Other Projects

### Option 1: Copy Rules Directory

```bash
# Copy the entire .cursor directory to another project
cp -r .cursor /path/to/other/project/
```

### Option 2: Symlink (for multiple projects)

```bash
# Create a shared rules location
mkdir -p ~/.cursor-rules

# Copy rules there
cp -r .cursor/rules ~/.cursor-rules/compound-engineering

# Symlink in each project
ln -s ~/.cursor-rules/compound-engineering /path/to/project/.cursor/rules
```

### Option 3: Global User Rules

1. Open Cursor Settings (⌘ + ,)
2. Go to "Rules" section
3. Copy contents from `USER_RULES_TEMPLATE.md` into User Rules

## Customization

### Adding Project-Specific Rules

Create new `.mdc` files in `.cursor/rules/`:

```markdown
---
description: My custom rule
globs:
  - "src/custom/**/*.ts"
alwaysApply: false
---

# My Custom Rules

- Rule 1
- Rule 2
```

### Rule Frontmatter Options

| Option | Description |
|--------|-------------|
| `description` | Brief description of what the rule does |
| `globs` | File patterns this rule applies to |
| `alwaysApply` | `true` = always active, `false` = only when matching files are in context |

## Best Practices

1. **Start with Planning**: Always plan before implementing complex features
2. **Work Incrementally**: Make small, testable changes
3. **Review Regularly**: Use review phase before merging
4. **Customize Rules**: Add project-specific rules as needed
5. **Keep Rules Focused**: Each rule file should have a single purpose

## Credits

Inspired by the [Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin) by Every, Inc.

