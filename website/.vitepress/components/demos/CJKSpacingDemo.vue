<script setup lang="ts">
import { ref } from 'vue'

const spacing = ref('0.03')

const spacingOptions = [
  { value: '0', label: 'Off', description: 'No extra spacing' },
  { value: '0.02', label: '0.02em', description: 'Tight - subtle' },
  { value: '0.03', label: '0.03em', description: 'Normal - balanced' },
  { value: '0.05', label: '0.05em', description: 'Loose - airy' },
  { value: '0.08', label: '0.08em', description: 'Very loose' },
]

const sampleTexts = [
  '中文排版的艺术在于细节。',
  '良好的字间距让阅读更加轻松自然。',
  '日本語の文字間隔も調整できます。',
  '한국어 텍스트도 지원됩니다.',
]
</script>

<template>
  <div class="spacing-demo">
    <div class="spacing-demo__header">
      <h3 class="spacing-demo__title">CJK Letter Spacing</h3>
      <p class="spacing-demo__subtitle">Fine-tune character spacing for CJK text</p>
    </div>

    <div class="spacing-demo__options">
      <button
        v-for="option in spacingOptions"
        :key="option.value"
        :class="['spacing-demo__btn', { 'spacing-demo__btn--active': spacing === option.value }]"
        @click="spacing = option.value"
      >
        <span class="spacing-demo__btn-label">{{ option.label }}</span>
        <span class="spacing-demo__btn-desc">{{ option.description }}</span>
      </button>
    </div>

    <div class="spacing-demo__preview">
      <p
        v-for="(text, index) in sampleTexts"
        :key="index"
        class="spacing-demo__text"
        :style="{ letterSpacing: spacing === '0' ? 'normal' : spacing + 'em' }"
      >
        {{ text }}
      </p>
    </div>

    <div class="spacing-demo__comparison">
      <div class="spacing-demo__compare-item">
        <div class="spacing-demo__compare-label">Without spacing</div>
        <div class="spacing-demo__compare-text" style="letter-spacing: normal">
          中文排版的艺术在于细节。
        </div>
      </div>
      <div class="spacing-demo__compare-item">
        <div class="spacing-demo__compare-label">With 0.05em spacing</div>
        <div class="spacing-demo__compare-text" style="letter-spacing: 0.05em">
          中文排版的艺术在于细节。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spacing-demo {
  --demo-bg: #f8f9fa;
  --demo-border: #e1e4e8;
  --demo-text: #24292e;
  --demo-text-secondary: #586069;
  --demo-accent: #0066cc;
  --demo-accent-bg: rgba(0, 102, 204, 0.1);
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

.dark .spacing-demo {
  --demo-bg: #1e2024;
  --demo-border: #3a3f46;
  --demo-text: #d6d9de;
  --demo-text-secondary: #9aa0a6;
  --demo-accent: #5aa8ff;
  --demo-accent-bg: rgba(90, 168, 255, 0.15);
}

.spacing-demo__header {
  margin-bottom: 20px;
}

.spacing-demo__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.spacing-demo__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--demo-text-secondary);
}

.spacing-demo__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.spacing-demo__btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 14px;
  font-family: var(--demo-font-sans);
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.spacing-demo__btn:hover {
  border-color: var(--demo-accent);
}

.spacing-demo__btn--active {
  background: var(--demo-accent);
  border-color: var(--demo-accent);
  color: white;
}

.spacing-demo__btn-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--demo-text);
}

.spacing-demo__btn--active .spacing-demo__btn-label {
  color: white;
}

.spacing-demo__btn-desc {
  font-size: 11px;
  color: var(--demo-text-secondary);
}

.spacing-demo__btn--active .spacing-demo__btn-desc {
  color: rgba(255, 255, 255, 0.8);
}

.spacing-demo__preview {
  background: white;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius);
  padding: 24px;
  margin-bottom: 20px;
}

.dark .spacing-demo__preview {
  background: #23262b;
}

.spacing-demo__text {
  margin: 0 0 12px 0;
  font-size: 20px;
  line-height: 1.8;
  color: #1a1a1a;
}

.dark .spacing-demo__text {
  color: #d6d9de;
}

.spacing-demo__text:last-child {
  margin-bottom: 0;
}

.spacing-demo__comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 540px) {
  .spacing-demo__comparison {
    grid-template-columns: 1fr;
  }
}

.spacing-demo__compare-item {
  padding: 16px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: var(--demo-radius);
}

.dark .spacing-demo__compare-item {
  background: rgba(255, 255, 255, 0.02);
}

.spacing-demo__compare-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--demo-text-secondary);
  margin-bottom: 8px;
}

.spacing-demo__compare-text {
  font-size: 18px;
  line-height: 1.6;
}
</style>
