# COPY-TEMPLATE

> Every string the user sees on screen. No placeholders. Every state of every element.

---

## [Screen Name]

| Element | State | Copy |
|---------|-------|------|
| [Element name] | [idle/hover/active/disabled/loading/error/empty] | [Exact text] |
| [Element name] | [state] | [Exact text] |

## [Dialog/Sheet Name]

| Element | State | Copy |
|---------|-------|------|
| [Title] | idle | [Exact text] |
| [Button label] | idle | [Exact text] |
| [Button label] | disabled | [Exact text] |
| [Button label] | loading | [Exact text] |
| [Error message] | validation | [Exact text] |
| [Error message] | network | [Exact text] |

## System Messages

| Context | Copy |
|---------|------|
| [When does this appear?] | [Exact text — "You sent $1.00"] |
| [When does this appear?] | [Exact text — "{sender} sent you ${amount}"] |

## Edge Cases

| Context | Copy |
|---------|------|
| [Very long name] | [How to truncate? Max chars? Ellipsis?] |
| [Zero amount] | [What does the user see?] |
| [Maximum value] | [What does the user see?] |

## Rules

- Every string is exact. No "something like."
- Variables use `{variableName}` format.
- Don't invent strings in code. They must match this file.
- If a string changes, update this file first, then code.
