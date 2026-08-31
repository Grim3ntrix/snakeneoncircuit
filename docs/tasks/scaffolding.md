# Scaffold Claude Code Project Instructions

You are working on a small vanilla web game project whose eventual goal is to produce an exceptionally polished and impressive retro Snake game.

For this task, **DO NOT build the game**.

Your task is only to establish the project's **Claude Code-specific instruction and agent-workflow foundation** so that future Claude Code sessions have clear, persistent guidance for producing high-quality work.

## Primary Objective

Design and scaffold the appropriate Claude Code project structure for this repository.

The project needs a strong persistent set of engineering, UX, visual-design, gameplay, and quality expectations centered around one overarching principle:

> **The final product should impress through polish, originality, responsiveness, and attention to detail—not merely satisfy functional requirements.**

However, do not blindly implement a structure I have predetermined.

**Think through the repository and Claude Code's conventions first.**

Determine:

* what should belong in `CLAUDE.md`
* whether a `.claude/` directory is actually useful at this stage
* whether additional Claude-specific files are justified
* what should remain ordinary project documentation instead of Claude configuration
* how to avoid duplicating instructions
* how to keep the setup maintainable as the project grows

Use your judgment.

---

# Scope

This task is ONLY about Claude Code-related project scaffolding and instructions.

Do NOT:

* build the Snake game
* create the game UI
* create Canvas code
* create gameplay systems
* create CSS for the game
* create application components
* create the statistics system
* install unnecessary dependencies
* modify unrelated project files
* create the actual game task specification
* invent implementation details that belong to the future game task

The resulting files should prepare Claude Code to work on the project later.

---

# First: Inspect the Repository

Before creating anything:

1. Inspect the repository structure.
2. Determine whether the project is empty, partially initialized, or already contains application code.
3. Identify any existing documentation.
4. Check whether a `CLAUDE.md` already exists.
5. Check whether `.claude/` already exists.
6. Check for existing agent instructions such as:

   * `AGENTS.md`
   * `README.md`
   * project-specific instruction files
   * configuration that may already influence Claude Code
7. Identify potential instruction conflicts or duplication.

Do not overwrite useful existing instructions without understanding them.

---

# Design the Instruction Hierarchy

Think carefully about the difference between:

### Persistent Claude instructions

Rules Claude Code should follow whenever it works on this repository.

### Project documentation

Information describing the project, architecture, requirements, decisions, or implementation.

### Task specifications

Concrete work that Claude should perform for a particular task.

### Claude-specific tooling/configuration

Optional Claude Code configuration that changes how Claude works with the repository.

Do not mix these responsibilities unnecessarily.

The resulting setup should have a clear hierarchy.

A future developer should be able to understand:

> "Where do I change Claude's permanent behavior?"

> "Where do I document the project?"

> "Where do I define an individual task?"

> "Where do Claude-specific configuration and extensions live?"

---

# CLAUDE.md Requirements

Create or improve the repository's root-level `CLAUDE.md` if appropriate.

It should establish **persistent working principles**, not contain the entire future game specification.

The rules should cover the important behaviors Claude should consistently follow while developing this project.

At minimum, reason about:

## Engineering Quality

* maintainable code
* appropriate architecture
* separation of concerns
* simplicity
* avoiding unnecessary abstractions
* avoiding unnecessary dependencies
* consistency
* defensive programming where appropriate
* clean naming
* predictable behavior

## Vanilla Web Constraint

The project is intended to remain lightweight and framework-free unless a future task explicitly establishes otherwise.

Prefer appropriate browser-native capabilities before introducing dependencies.

Do not introduce frameworks merely because they are familiar or convenient.

Do not overengineer a small project.

## Game Development Quality

Future implementation should prioritize:

* responsive controls
* deterministic gameplay
* consistent timing
* performance
* correct collision behavior
* predictable state transitions
* graceful handling of browser/mobile conditions

## UI/UX Quality

Claude should treat visual design and interaction design as first-class engineering concerns.

Future work should prioritize:

* hierarchy
* readability
* spacing
* typography
* interaction feedback
* responsive behavior
* accessibility
* mobile usability
* consistency

## Visual Direction

The eventual game should have a deliberate visual identity rather than looking like:

* a tutorial project
* a generic Snake clone
* a generic cyberpunk template
* an AI-generated UI
* a collection of unrelated visual effects

The rules should encourage visual restraint and intentionality.

## The "Impress Me" Standard

This is especially important.

Establish a development mindset where:

> Functional does not automatically mean finished.

Claude should be expected to perform a dedicated refinement pass after functionality works.

That refinement should consider:

* visual polish
* interaction quality
* animation timing
* game feel
* responsive behavior
* accessibility
* performance
* consistency
* edge cases
* perceived quality

Claude should identify and remove things that feel:

* generic
* unfinished
* awkward
* excessive
* inconsistent
* placeholder-like
* unnecessarily complicated

Do not tell Claude to blindly add more effects.

The goal is **quality, not visual excess**.

---

# Autonomous Decision-Making

The instructions should encourage Claude Code to make reasonable independent decisions.

Claude should not repeatedly ask for approval for minor implementation details.

When several technically valid approaches exist:

1. understand the project constraints
2. evaluate maintainability
3. evaluate user experience
4. evaluate performance
5. choose the most appropriate solution
6. document significant architectural decisions when necessary

Only ask for clarification when the decision materially changes the project's requirements, architecture, or user-facing behavior.

---

# Verification Expectations

The persistent instructions should establish that Claude should verify its work.

Depending on what exists in the repository, Claude should use appropriate:

* linting
* formatting
* tests
* build checks
* browser/runtime verification
* responsive checks
* accessibility checks

Do not require tools that do not exist.

Claude should inspect available project scripts before assuming commands.

---

# Final Polish Rule

Establish a rule that before declaring a user-facing implementation complete, Claude should perform a final review.

The review should ask:

> Does this merely work, or does it feel finished?

And:

> If this were shown as a portfolio piece, would the result feel intentionally designed?

If not, Claude should refine it before declaring completion.

---

# Avoid Instruction Bloat

Do not create a huge collection of redundant instruction files.

Do not repeat the same rule in multiple locations.

Do not create files simply because they are possible.

Use the smallest structure that provides a strong foundation.

If `.claude/` is useful, use it appropriately.

If it is unnecessary at this stage, do not create meaningless configuration just to populate the directory.

If a future task would benefit from `.claude/` functionality, leave the project in a state where that can be added cleanly later.

---

# Repository Safety

Do not modify unrelated application files.

Do not remove existing project functionality.

Do not overwrite existing documentation without a reason.

Do not create fake configuration.

Do not invent unsupported Claude Code features.

Follow the actual conventions supported by the installed Claude Code environment.

---

# Output Requirements

After inspecting the repository and reasoning about the appropriate structure:

1. Create the necessary Claude Code-specific instruction/configuration files.
2. Keep them focused and maintainable.
3. Do not create the future game implementation.
4. Do not create the future game task specification.
5. Do not create unrelated project documentation.
6. Avoid unnecessary `.claude/` files.
7. Ensure there is a clear distinction between persistent instructions and future task-specific instructions.
8. Review the resulting files for duplication and contradictions.

Then report:

* what Claude-specific files you created or modified
* why each exists
* how the instruction hierarchy works
* anything intentionally left for future tasks
* any potential issue discovered in the existing repository

Do not merely report that the files were created.

Explain the reasoning behind the final structure briefly.

---

# Most Important Principle

Do not optimize this task for the number of files created.

Optimize it for creating a **clean, durable Claude Code development foundation** that will help future sessions produce a small game with an unusually high level of polish.

Think first.

Inspect the repository.

Choose the structure.

Then implement only the Claude-specific scaffolding.
