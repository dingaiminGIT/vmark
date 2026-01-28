<script setup lang="ts">
import { ref } from 'vue'

const focusEnabled = ref(true)
const focusedIndex = ref(1)

const paragraphs = [
  'Focus Mode helps you concentrate on what matters most — the current paragraph you\'re writing.',
  'When enabled, VMark dims surrounding content while keeping your current paragraph fully visible and vibrant.',
  'This creates a natural visual hierarchy that reduces distractions and keeps your attention where it belongs.',
  'Combined with Typewriter Mode, your cursor stays centered on screen for a comfortable writing flow.',
]

function handleClick(index: number) {
  focusedIndex.value = index
}
</script>

<template>
  <div class="focus-demo">
    <div class="focus-demo__header">
      <h3 class="focus-demo__title">Focus Mode</h3>
      <p class="focus-demo__subtitle">Click any paragraph to focus on it</p>
    </div>

    <div class="focus-demo__controls">
      <label class="focus-demo__toggle">
        <input type="checkbox" v-model="focusEnabled" class="focus-demo__checkbox" />
        <span class="focus-demo__toggle-label">Enable Focus Mode</span>
      </label>
    </div>

    <div :class="['focus-demo__content', { 'focus-demo__content--enabled': focusEnabled }]">
      <p
        v-for="(text, index) in paragraphs"
        :key="index"
        :class="[
          'focus-demo__paragraph',
          { 'focus-demo__paragraph--focused': focusedIndex === index }
        ]"
        @click="handleClick(index)"
      >
        {{ text }}
      </p>
    </div>

    <div class="focus-demo__hint">
      <span class="focus-demo__hint-icon">💡</span>
      <span>In VMark, focus automatically follows your cursor as you type.</span>
    </div>
  </div>
</template>

<style scoped>
.focus-demo {
  --demo-bg: #f8f9fa;
  --demo-border: #e1e4e8;
  --demo-text: #24292e;
  --demo-text-secondary: #586069;
  --demo-text-blur: #c8c8c8;
  --demo-accent: #0066cc;
  --demo-radius: 8px;
  --demo-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  font-family: var(--demo-font-sans);
  background: var(--demo-bg);
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius);
  padding: 24px;
  margin: 24px 0;
  color: var(--demo-text);
}

.dark .focus-demo {
  --demo-bg: #1e2024;
  --demo-border: #3a3f46;
  --demo-text: #d6d9de;
  --demo-text-secondary: #9aa0a6;
  --demo-text-blur: #4a4f56;
}

.focus-demo__header {
  margin-bottom: 16px;
}

.focus-demo__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.focus-demo__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--demo-text-secondary);
}

.focus-demo__controls {
  margin-bottom: 16px;
}

.focus-demo__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.focus-demo__checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--demo-accent);
  cursor: pointer;
}

.focus-demo__toggle-label {
  font-size: 14px;
  font-weight: 500;
}

.focus-demo__content {
  background: white;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius);
  padding: 24px;
  color: #1a1a1a;
}

.dark .focus-demo__content {
  background: #23262b;
  color: #d6d9de;
}

.focus-demo__paragraph {
  margin: 0 0 16px 0;
  padding: 8px 12px;
  font-size: 16px;
  line-height: 1.7;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.focus-demo__paragraph:last-child {
  margin-bottom: 0;
}

.focus-demo__paragraph:hover {
  background: rgba(0, 0, 0, 0.02);
}

.dark .focus-demo__paragraph:hover {
  background: rgba(255, 255, 255, 0.02);
}

/* Focus mode enabled */
.focus-demo__content--enabled .focus-demo__paragraph {
  color: var(--demo-text-blur);
}

.dark .focus-demo__content--enabled .focus-demo__paragraph {
  color: #4a4f56;
}

.focus-demo__content--enabled .focus-demo__paragraph--focused {
  color: #1a1a1a;
  background: rgba(0, 102, 204, 0.05);
}

.dark .focus-demo__content--enabled .focus-demo__paragraph--focused {
  color: #d6d9de;
  background: rgba(90, 168, 255, 0.08);
}

.focus-demo__hint {
  margin-top: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--demo-radius);
  font-size: 13px;
  color: var(--demo-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.dark .focus-demo__hint {
  background: rgba(255, 255, 255, 0.03);
}

.focus-demo__hint-icon {
  font-size: 16px;
}
</style>
