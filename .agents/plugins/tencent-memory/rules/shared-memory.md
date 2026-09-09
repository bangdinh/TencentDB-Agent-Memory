# Shared Memory Rules

You have access to a shared memory system via MCP tools (tencent-memory).
All AI agents (Claude, Cursor, Antigravity, Cline) share the SAME memory.

## Wiki ID: wiki-9sr5qg3i

## AUTO-SAVE Rule:
When the user provides NEW information (names, numbers, facts, preferences, decisions, passwords, IDs, etc.),
you MUST automatically save it using the `wiki_write` tool:
- wiki_id: "wiki-9sr5qg3i"
- title: a short descriptive title
- content: the information in clear format

Examples of information to save:
- "Học sinh A có mã số 123" → save immediately
- "Project deadline là ngày 30/08" → save immediately
- "API key mới là xyz" → save immediately

## AUTO-SEARCH Rule:
When the user asks a question that might have been answered before or involves recalling information,
you MUST first search the shared memory using `wiki_search` tool:
- wiki_id: "wiki-9sr5qg3i"
- query: relevant search terms

Then combine memory results with your own knowledge to answer.

## IMPORTANT:
- Always use wiki_id: "wiki-9sr5qg3i"
- Save information proactively — don't ask "should I save this?"
- Search memory before saying "I don't know"
- This memory is shared across ALL agents — what you save, others can read
