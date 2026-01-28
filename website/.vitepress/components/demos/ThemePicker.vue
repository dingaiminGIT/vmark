<script setup lang="ts">
import { ref, computed } from 'vue'

type ThemeId = 'white' | 'paper' | 'mint' | 'sepia' | 'night'

interface ThemeColors {
  background: string
  foreground: string
  link: string
  secondary: string
  border: string
  strong: string
  emphasis: string
}

const themes: Record<ThemeId, ThemeColors> = {
  white: {
    background: '#FFFFFF',
    foreground: '#1a1a1a',
    link: '#0066cc',
    secondary: '#f8f8f8',
    border: '#eeeeee',
    strong: '#3f5663',
    emphasis: '#5b0411',
  },
  paper: {
    background: '#EEEDED',
    foreground: '#1a1a1a',
    link: '#0066cc',
    secondary: '#e5e4e4',
    border: '#d5d4d4',
    strong: '#3f5663',
    emphasis: '#5b0411',
  },
  mint: {
    background: '#CCE6D0',
    foreground: '#2d3a35',
    link: '#1a6b4a',
    secondary: '#b8d9bd',
    border: '#a8c9ad',
    strong: '#1a5c4a',
    emphasis: '#6b4423',
  },
  sepia: {
    background: '#F9F0DB',
    foreground: '#5c4b37',
    link: '#8b4513',
    secondary: '#f0e5cc',
    border: '#e0d5bc',
    strong: '#4a3728',
    emphasis: '#8b3a2f',
  },
  night: {
    background: '#23262b',
    foreground: '#d6d9de',
    link: '#5aa8ff',
    secondary: '#2a2e34',
    border: '#3a3f46',
    strong: '#6cb6ff',
    emphasis: '#d19a66',
  },
}

const themeLabels: Record<ThemeId, string> = {
  white: 'White',
  paper: 'Paper',
  mint: 'Mint',
  sepia: 'Sepia',
  night: 'Night',
}

const selectedTheme = ref<ThemeId>('paper')
const currentTheme = computed(() => themes[selectedTheme.value])
const isDark = computed(() => selectedTheme.value === 'night')

const sampleText = `# Welcome to VMark

Write beautiful **markdown** with *style*.

This is a [link](#) to somewhere interesting.

> A blockquote for emphasis.

The quick brown fox jumps over the lazy dog.`
</script>

<template>
  <div class="theme-demo">
    <div class="theme-demo__header">
      <h3 class="theme-demo__title">Theme Preview</h3>
      <p class="theme-demo__subtitle">Five hand-crafted themes for comfortable writing</p>
    </div>

    <div class="theme-demo__picker">
      <button
        v-for="(_, themeId) in themes"
        :key="themeId"
        :class="['theme-demo__btn', { 'theme-demo__btn--active': selectedTheme === themeId }]"
        :style="{
          '--swatch-bg': themes[themeId].background,
          '--swatch-border': themes[themeId].border,
        }"
        @click="selectedTheme = themeId as ThemeId"
      >
        <span class="theme-demo__swatch"></span>
        <span class="theme-demo__name">{{ themeLabels[themeId] }}</span>
      </button>
    </div>

    <div
      class="theme-demo__preview"
      :style="{
        '--preview-bg': currentTheme.background,
        '--preview-fg': currentTheme.foreground,
        '--preview-link': currentTheme.link,
        '--preview-secondary': currentTheme.secondary,
        '--preview-border': currentTheme.border,
        '--preview-strong': currentTheme.strong,
        '--preview-emphasis': currentTheme.emphasis,
      }"
      :class="{ 'theme-demo__preview--dark': isDark }"
    >
      <div class="theme-demo__content">
        <h1 class="theme-demo__h1">Welcome to VMark</h1>
        <p class="theme-demo__p">
          Write beautiful <strong>markdown</strong> with <em>style</em>.
        </p>
        <p class="theme-demo__p">
          This is a <a href="#" class="theme-demo__link">link</a> to somewhere interesting.
        </p>
        <blockquote class="theme-demo__blockquote">
          A blockquote for emphasis.
        </blockquote>
        <p class="theme-demo__p">
          The quick brown fox jumps over the lazy dog.
        </p>
      </div>
    </div>

    <div class="theme-demo__colors">
      <div class="theme-demo__color" v-for="(color, name) in currentTheme" :key="name">
        <span
          class="theme-demo__color-swatch"
          :style="{ background: color }"
        ></span>
        <span class="theme-demo__color-name">{{ name }}</span>
        <span class="theme-demo__color-value">{{ color }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-demo {
  --demo-bg: #f8f9fa;
  --demo-border: #e1e4e8;
  --demo-text: #24292e;
  --demo-text-secondary: #586069;
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

.dark .theme-demo {
  --demo-bg: #1e2024;
  --demo-border: #3a3f46;
  --demo-text: #d6d9de;
  --demo-text-secondary: #9aa0a6;
}

.theme-demo__header {
  margin-bottom: 20px;
}

.theme-demo__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.theme-demo__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--demo-text-secondary);
}

.theme-demo__picker {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.theme-demo__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-family: var(--demo-font-sans);
  border: 2px solid var(--demo-border);
  border-radius: 100px;
  background: transparent;
  color: var(--demo-text);
  cursor: pointer;
  transition: all 0.15s;
}

.theme-demo__btn:hover {
  border-color: var(--demo-accent);
}

.theme-demo__btn--active {
  border-color: var(--demo-accent);
  background: rgba(0, 102, 204, 0.1);
}

.theme-demo__swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--swatch-bg);
  border: 1px solid var(--swatch-border);
}

.theme-demo__name {
  font-weight: 500;
}

.theme-demo__preview {
  background: var(--preview-bg);
  color: var(--preview-fg);
  border-radius: var(--demo-radius);
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid var(--preview-border);
  transition: all 0.2s;
}

.theme-demo__content {
  max-width: 600px;
}

.theme-demo__h1 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--preview-fg);
}

.theme-demo__p {
  margin: 0 0 12px 0;
  font-size: 16px;
  line-height: 1.6;
}

.theme-demo__p strong {
  color: var(--preview-strong);
  font-weight: 600;
}

.theme-demo__p em {
  color: var(--preview-emphasis);
  font-style: italic;
}

.theme-demo__link {
  color: var(--preview-link);
  text-decoration: none;
}

.theme-demo__link:hover {
  text-decoration: underline;
}

.theme-demo__blockquote {
  margin: 16px 0;
  padding: 12px 16px;
  border-left: 4px solid var(--preview-border);
  background: var(--preview-secondary);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  color: var(--preview-fg);
  opacity: 0.9;
}

.theme-demo__colors {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.theme-demo__color {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.theme-demo__color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--demo-border);
  flex-shrink: 0;
}

.theme-demo__color-name {
  font-weight: 500;
  text-transform: capitalize;
}

.theme-demo__color-value {
  font-family: ui-monospace, monospace;
  color: var(--demo-text-secondary);
  font-size: 11px;
}
</style>
