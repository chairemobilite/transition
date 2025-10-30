# .cursor Directory

This directory contains configuration files for **Cursor IDE**, an AI-powered code editor. These files help AI assistants understand the project context and follow project-specific guidelines when providing code suggestions and assistance.

## Purpose

The `.cursor` directory serves as a way to provide persistent context to AI assistants working in this codebase. When you use Cursor's AI features (Composer, Chat, Autocomplete), the AI can reference these rules to better understand:

- Project architecture and structure
- Technology stack and dependencies
- Coding conventions and style guidelines
- Common patterns and workflows
- Best practices specific to this project

## Contents

### `rules/project-rule.mdc`

This file contains the **Transition Project - AI Context Guide**, which is automatically applied to all AI interactions in this workspace.

The rule is marked with `alwaysApply: true`, meaning it's automatically included in the context for every AI interaction, ensuring consistent understanding of the project.

## How It Works

1. **Automatic Application**: The `project-rule.mdc` file is automatically loaded by Cursor when you work in this workspace
2. **Context for AI**: When you ask questions or request code changes, the AI uses information from this file to provide more accurate, project-specific responses
3. **Persistent Knowledge**: Instead of explaining the project structure every time, the AI already "knows" about the codebase

## Updating the Rules

To update or modify the project rules:

1. Edit `rules/project-rule.mdc` directly
2. The changes will be automatically picked up by Cursor
3. Consider updating this README if you add new rule files or change the structure

## Related Documentation

- Main project README: `/README.md`
- Feature-specific AI guides: `/docs/AI_README_*.md`
- Contributing guide: `/CONTRIBUTING.md`

---

**Note**: This directory is specific to Cursor IDE. Other IDEs or AI assistants may use different configuration methods. It is the responsability of cursor users to update this file after changes in the repo.
