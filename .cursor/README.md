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

This file contains the **Transition Project - AI Context Guide**, which is automatically applied to all AI interactions in this workspace. It includes:

- **Project Overview**: Purpose, website, repository information
- **Architecture**: Monorepo structure, package breakdown
- **Technology Stack**: Backend (Node.js, Express), Frontend (React, Redux), Database (PostgreSQL/PostGIS), etc.
- **Key Concepts**: Scenarios, transit objects hierarchy, data sources, routing engines
- **Database Schema**: Core and transit tables
- **API Architecture**: REST API and Socket.IO routes
- **Development Workflow**: Build commands, testing, code style
- **Common Tasks**: Patterns for adding tables, endpoints, components
- **Important Patterns**: Type safety, GeoJSON format, UUIDs, i18n

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

## Benefits

- **Better Code Suggestions**: AI understands your project's architecture and patterns
- **Consistent Responses**: All AI interactions have the same context about the project
- **Faster Development**: Less time explaining context, more time coding
- **Project-Specific Help**: AI can reference actual files and patterns from your codebase

## Related Documentation

- Main project README: `/README.md`
- Feature-specific AI guides: `/docs/AI_README_*.md`
- Contributing guide: `/CONTRIBUTING.md`

---

**Note**: This directory is specific to Cursor IDE. Other IDEs or AI assistants may use different configuration methods. It is the responsability of cursor users to update this file after changes in the repo.
