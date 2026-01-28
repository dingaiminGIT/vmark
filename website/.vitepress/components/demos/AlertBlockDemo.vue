<script setup lang="ts">
const alerts = [
  {
    type: 'note',
    title: 'Note',
    content: 'Useful information that users should know, even when skimming content.',
    color: '#0969da',
    darkColor: '#58a6ff',
  },
  {
    type: 'tip',
    title: 'Tip',
    content: 'Helpful advice for doing things better or more easily.',
    color: '#1a7f37',
    darkColor: '#3fb950',
  },
  {
    type: 'important',
    title: 'Important',
    content: 'Key information users need to know to achieve their goal.',
    color: '#8250df',
    darkColor: '#a371f7',
  },
  {
    type: 'warning',
    title: 'Warning',
    content: 'Urgent info that needs immediate user attention to avoid problems.',
    color: '#9a6700',
    darkColor: '#d29922',
  },
  {
    type: 'caution',
    title: 'Caution',
    content: 'Advises about risks or negative outcomes of certain actions.',
    color: '#cf222e',
    darkColor: '#f85149',
  },
]

// SVG icons for each alert type
const icons: Record<string, string> = {
  note: `<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>`,
  tip: `<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>`,
  important: `<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>`,
  warning: `<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>`,
  caution: `<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>`,
}
</script>

<template>
  <div class="alert-demo">
    <div class="alert-demo__header">
      <h3 class="alert-demo__title">Alert Blocks</h3>
      <p class="alert-demo__subtitle">GitHub-style callouts for notes, tips, warnings, and more</p>
    </div>

    <div class="alert-demo__grid">
      <div
        v-for="alert in alerts"
        :key="alert.type"
        :class="['alert-demo__block', `alert-demo__block--${alert.type}`]"
        :style="{
          '--alert-color': alert.color,
          '--alert-color-dark': alert.darkColor,
        }"
      >
        <div class="alert-demo__block-header">
          <span class="alert-demo__icon" v-html="icons[alert.type]"></span>
          <span class="alert-demo__block-title">{{ alert.title }}</span>
        </div>
        <p class="alert-demo__block-content">{{ alert.content }}</p>
      </div>
    </div>

    <div class="alert-demo__syntax">
      <div class="alert-demo__syntax-title">Markdown Syntax</div>
      <pre class="alert-demo__code">&gt; [!NOTE]
&gt; Your note content here.

&gt; [!TIP]
&gt; Helpful advice here.

&gt; [!IMPORTANT]
&gt; Key information here.

&gt; [!WARNING]
&gt; Urgent info here.

&gt; [!CAUTION]
&gt; Risk advisory here.</pre>
    </div>
  </div>
</template>

<style scoped>
.alert-demo {
  --demo-bg: #f8f9fa;
  --demo-border: #e1e4e8;
  --demo-text: #24292e;
  --demo-text-secondary: #586069;
  --demo-radius: 8px;
  --demo-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --demo-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;

  font-family: var(--demo-font-sans);
  background: var(--demo-bg);
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius);
  padding: 24px;
  margin: 24px 0;
  color: var(--demo-text);
}

.dark .alert-demo {
  --demo-bg: #1e2024;
  --demo-border: #3a3f46;
  --demo-text: #d6d9de;
  --demo-text-secondary: #9aa0a6;
}

.alert-demo__header {
  margin-bottom: 20px;
}

.alert-demo__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.alert-demo__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--demo-text-secondary);
}

.alert-demo__grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.alert-demo__block {
  padding: 12px 16px;
  border-left: 4px solid var(--alert-color);
  border-radius: 0 6px 6px 0;
  background: color-mix(in srgb, var(--alert-color) 8%, transparent);
}

.dark .alert-demo__block {
  --alert-color: var(--alert-color-dark);
  background: color-mix(in srgb, var(--alert-color-dark) 12%, transparent);
}

.alert-demo__block-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.alert-demo__icon {
  color: var(--alert-color);
  display: flex;
  align-items: center;
}

.dark .alert-demo__icon {
  color: var(--alert-color-dark);
}

.alert-demo__block-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--alert-color);
}

.dark .alert-demo__block-title {
  color: var(--alert-color-dark);
}

.alert-demo__block-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.alert-demo__syntax {
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--demo-radius);
  padding: 16px;
}

.dark .alert-demo__syntax {
  background: rgba(255, 255, 255, 0.03);
}

.alert-demo__syntax-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--demo-text-secondary);
}

.alert-demo__code {
  margin: 0;
  font-family: var(--demo-font-mono);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--demo-text);
}
</style>
