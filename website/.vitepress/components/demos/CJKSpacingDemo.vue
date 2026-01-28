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
  <div class="vmark-demo">
    <p class="vmark-demo__subtitle">Fine-tune character spacing for CJK text</p>

    <div class="options">
      <button
        v-for="option in spacingOptions"
        :key="option.value"
        :class="['option-btn', { 'active': spacing === option.value }]"
        @click="spacing = option.value"
      >
        <span class="option-btn__label">{{ option.label }}</span>
        <span class="option-btn__desc">{{ option.description }}</span>
      </button>
    </div>

    <div class="preview">
      <p
        v-for="(text, index) in sampleTexts"
        :key="index"
        class="preview__text"
        :style="{ letterSpacing: spacing === '0' ? 'normal' : spacing + 'em' }"
      >
        {{ text }}
      </p>
    </div>

    <div class="vmark-grid vmark-grid--2">
      <div class="compare">
        <div class="compare__label">Without spacing</div>
        <div class="compare__text" style="letter-spacing: normal">
          中文排版的艺术在于细节。
        </div>
      </div>
      <div class="compare">
        <div class="compare__label">With 0.05em spacing</div>
        <div class="compare__text" style="letter-spacing: 0.05em">
          中文排版的艺术在于细节。
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./vmark-ui.css"></style>
<style scoped>
.options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 14px;
  font-family: var(--font-sans);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.option-btn:hover {
  border-color: var(--accent-primary);
}

.option-btn.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--contrast-text);
}

.option-btn__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
}

.option-btn.active .option-btn__label {
  color: var(--contrast-text);
}

.option-btn__desc {
  font-size: 11px;
  color: var(--text-secondary);
}

.option-btn.active .option-btn__desc {
  color: rgba(255, 255, 255, 0.8);
}

.preview {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 20px;
}

.preview__text {
  margin: 0 0 12px 0;
  font-size: 18px;
  line-height: 1.8;
  color: var(--text-color);
}

.preview__text:last-child {
  margin-bottom: 0;
}

.compare {
  padding: 16px;
  background: var(--subtle-bg);
  border-radius: var(--radius-md);
}

.compare__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.compare__text {
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-color);
}
</style>
