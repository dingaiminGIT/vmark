# AI Genies

AI Genies are prompt templates that transform your text using AI. Select text, invoke a genie, and review the suggested changes — all without leaving the editor.

## Quick Start

1. Configure an AI provider in **Settings > Integrations** (see [AI Providers](/guide/ai-providers))
2. Select some text in the editor
3. Press `Mod + Y` to open the genie picker
4. Choose a genie or type a freeform prompt
5. Review the inline suggestion — accept or reject

## The Genie Picker

Press `Mod + Y` (or menu **Tools > AI Genies**) to open a spotlight-style overlay.

**Search** — Type to filter genies by name, description, or category.

**Quick Chips** — When the scope is "selection", one-click buttons appear for common actions (Polish, Condense, Grammar, Rephrase).

**Freeform** — Type any instruction in the bottom field and press Enter to use it as a one-off prompt. Your text is appended after the instruction automatically.

**Scope cycling** — Press `Tab` to cycle through scopes: selection → block → document → all.

The picker closes after selecting a genie, and the AI begins generating.

## Built-in Genies

VMark ships with 13 genies across four categories:

### Editing

| Genie | Description | Scope |
|-------|-------------|-------|
| Polish | Improve clarity and flow | Selection |
| Condense | Make text more concise | Selection |
| Fix Grammar | Fix grammar and spelling | Selection |
| Simplify | Use simpler language | Selection |

### Creative

| Genie | Description | Scope |
|-------|-------------|-------|
| Expand | Develop idea into fuller prose | Selection |
| Rephrase | Say the same thing differently | Selection |
| Vivid | Add sensory details and imagery | Selection |
| Continue | Continue writing from here | Block |

### Structure

| Genie | Description | Scope |
|-------|-------------|-------|
| Summarize | Summarize the document | Document |
| Outline | Generate an outline | Document |
| Headline | Suggest title options | Document |

### Tools

| Genie | Description | Scope |
|-------|-------------|-------|
| Translate | Translate to English | Selection |
| Rewrite in English | Rewrite text in English | Selection |

## Scope

Each genie operates on one of three scopes:

- **Selection** — The highlighted text. If nothing is selected, falls back to the current block.
- **Block** — The paragraph or block element at the cursor position.
- **Document** — The entire document content.

The scope determines what text is extracted and passed to the AI as `{{content}}`.

## Reviewing Suggestions

After a genie runs, the suggestion appears inline:

- **Replace** — Original text with strikethrough, new text in green
- **Insert** — New text shown in green after the source block
- **Delete** — Original text with strikethrough

Each suggestion has accept (checkmark) and reject (X) buttons.

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Accept suggestion | `Enter` |
| Reject suggestion | `Escape` |
| Next suggestion | `Tab` |
| Previous suggestion | `Shift + Tab` |
| Accept all | `Mod + Shift + Enter` |
| Reject all | `Mod + Shift + Escape` |

## Running Indicator

While AI is generating, a bouncing sparkle icon appears in the status bar. The status bar briefly shows even if hidden, so you always know when AI is working.

---

## Writing Custom Genies

You can create your own genies. Each genie is a single Markdown file with YAML frontmatter and a prompt template.

### Where Genies Live

Genies are stored in your application data directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/com.vmark.app/genies/` |
| Windows | `%APPDATA%\com.vmark.app\genies\` |
| Linux | `~/.local/share/com.vmark.app/genies/` |

Open this folder from menu **Tools > Open Genies Folder**.

### Directory Structure

Subdirectories become **categories** in the picker. You can organize genies however you like:

```
genies/
├── editing/
│   ├── polish.md
│   ├── condense.md
│   └── fix-grammar.md
├── creative/
│   ├── expand.md
│   └── rephrase.md
├── academic/          ← your custom category
│   ├── cite.md
│   └── abstract.md
└── my-workflows/      ← another custom category
    └── blog-intro.md
```

### File Format

Every genie file has two parts: **frontmatter** (metadata) and **template** (the prompt).

```markdown
---
name: polish
description: Improve clarity and flow
scope: selection
category: editing
---

You are an expert editor. Improve the clarity, flow, and conciseness
of the following text while preserving the author's voice and intent.

Return only the improved text — no explanations.

{{content}}
```

### Frontmatter Fields

| Field | Required | Values | Default |
|-------|----------|--------|---------|
| `name` | Yes | Any string | File name (without `.md`) |
| `description` | No | Short description shown in picker | Empty |
| `scope` | No | `selection`, `block`, `document` | `selection` |
| `category` | No | Category name for grouping | Subdirectory name |
| `action` | No | `replace`, `insert` | `replace` |
| `model` | No | Model identifier to override provider default | Provider default |

### The `{{content}}` Placeholder

The `{{content}}` placeholder is the core of every genie. When a genie runs, VMark:

1. **Extracts text** based on the scope (selected text, current block, or full document)
2. **Replaces** every `{{content}}` in your template with the extracted text
3. **Sends** the filled prompt to the active AI provider
4. **Streams** the response back as an inline suggestion

For example, with this template:

```markdown
Translate the following text into French.

{{content}}
```

If the user selects "Hello, how are you?", the AI receives:

```
Translate the following text into French.

Hello, how are you?
```

The AI responds with "Bonjour, comment allez-vous ?" and it appears as an inline suggestion replacing the selected text.

### The `action` Field

By default, genies **replace** the source text with the AI output. Set `action: insert` to **append** the output after the source block instead.

Use `replace` for: editing, rephrasing, translating, grammar fixes — anything that transforms the original text.

Use `insert` for: continuing writing, generating summaries below content, adding commentary — anything that adds new text without removing the original.

**Example — insert action:**

```markdown
---
name: continue
description: Continue writing from here
scope: block
action: insert
---

Continue writing naturally from where the following text leaves off.
Match the author's voice, style, and tone. Write 2-3 paragraphs.

Do not repeat or summarize the existing text — just continue it.

{{content}}
```

### The `model` Field

Override the default model for a specific genie. Useful when you want a cheaper model for simple tasks or a more powerful one for complex tasks.

```markdown
---
name: quick-fix
description: Quick grammar fix (uses fast model)
scope: selection
model: claude-haiku-4-5-20251001
---

Fix grammar and spelling errors. Return only the corrected text.

{{content}}
```

The model identifier must match what your active provider accepts.

## Writing Effective Prompts

### Be Specific About Output Format

Tell the AI exactly what to return. Without this, models tend to add explanations, headers, or commentary.

```markdown
<!-- Good -->
Return only the improved text — no explanations.

<!-- Bad — AI may wrap output in quotes, add "Here's the improved version:", etc. -->
Improve this text.
```

### Set a Role

Give the AI a persona to anchor its behavior.

```markdown
<!-- Good -->
You are an expert technical editor who specializes in API documentation.

<!-- Okay but less focused -->
Edit the following text.
```

### Constrain the Scope

Tell the AI what NOT to change. This prevents over-editing.

```markdown
<!-- Good -->
Fix grammar and spelling errors only.
Do not change the meaning, style, or tone.
Do not restructure sentences.

<!-- Bad — gives the AI too much freedom -->
Fix this text.
```

### Use Markdown in Prompts

You can use Markdown formatting in your prompt templates. This helps when you want the AI to produce structured output.

```markdown
---
name: pros-cons
description: Generate a pros/cons analysis
scope: selection
action: insert
---

Analyze the following text and produce a brief pros/cons list.

Format as:

**Pros:**
- point 1
- point 2

**Cons:**
- point 1
- point 2

{{content}}
```

### Keep Prompts Focused

One genie, one job. Don't combine multiple tasks into a single genie — create separate genies instead.

```markdown
<!-- Good — one clear job -->
---
name: active-voice
description: Convert to active voice
scope: selection
---

Rewrite the following text using active voice.
Do not change the meaning.
Return only the rewritten text.

{{content}}
```

## Example Custom Genies

### Academic — Write an Abstract

```markdown
---
name: abstract
description: Generate an academic abstract
scope: document
action: insert
---

Read the following paper and write a concise academic abstract
(150-250 words). Follow standard structure: background, methods,
results, conclusion.

{{content}}
```

### Blog — Generate a Hook

```markdown
---
name: blog-hook
description: Write an engaging opening paragraph
scope: document
action: insert
---

Read the following draft and write a compelling opening paragraph
that hooks the reader. Use a question, surprising fact, or vivid
scene. Keep it under 3 sentences.

{{content}}
```

### Code — Explain Code Block

```markdown
---
name: explain-code
description: Add a plain-English explanation above code
scope: selection
action: insert
---

Read the following code and write a brief plain-English explanation
of what it does. Use 1-2 sentences. Do not include the code itself
in your response.

{{content}}
```

### Email — Make Professional

```markdown
---
name: professional-tone
description: Rewrite in professional tone
scope: selection
---

Rewrite the following text in a professional, business-appropriate tone.
Keep the same meaning and key points. Remove casual language,
slang, and filler words.

Return only the rewritten text — no explanations.

{{content}}
```

### Translation — To Simplified Chinese

```markdown
---
name: to-chinese
description: Translate to Simplified Chinese
scope: selection
---

Translate the following text into Simplified Chinese.
Preserve the original meaning, tone, and formatting.
Use natural, idiomatic Chinese — not word-for-word translation.

Return only the translated text — no explanations.

{{content}}
```

### Review — Fact Check

```markdown
---
name: fact-check
description: Flag claims that need verification
scope: selection
action: insert
---

Read the following text and list any factual claims that should be
verified. For each claim, note why it might need checking (e.g.,
specific numbers, dates, statistics, or strong assertions).

Format as a bullet list. If everything looks solid, say
"No claims flagged for verification."

{{content}}
```

## Limitations

- Genies only work in **WYSIWYG mode**. In source mode, a toast notification explains this.
- One genie can run at a time. If AI is already generating, the picker won't start another.
- The `{{content}}` placeholder is replaced literally — it doesn't support conditionals or loops.
- Very large documents may hit provider token limits when using `scope: document`.

## Troubleshooting

**"No AI provider available"** — Open Settings > Integrations and configure a provider. See [AI Providers](/guide/ai-providers).

**Genie not appearing in picker** — Check that the file has a `.md` extension, valid frontmatter with `---` fences, and is in the genies directory (not a subdirectory deeper than one level).

**AI returns garbage or errors** — Verify your API key is correct and the model name is valid for your provider. Check the terminal/console for error details.

**Suggestion doesn't match expectations** — Refine your prompt. Add constraints ("return only the text", "do not explain"), set a role, or narrow the scope.

## See Also

- [AI Providers](/guide/ai-providers) — Configure CLI or REST API providers
- [Keyboard Shortcuts](/guide/shortcuts) — Full shortcut reference
- [MCP Tools](/guide/mcp-tools) — External AI integration via MCP
