<script setup lang="ts">
import { ref, computed } from 'vue'

const latinFonts = [
  { value: 'system', label: 'System Default' },
  { value: 'Charter, Georgia, serif', label: 'Charter' },
  { value: 'Palatino, "Palatino Linotype", serif', label: 'Palatino' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Athelas", Georgia, serif', label: 'Athelas' },
  { value: '"Literata", Georgia, serif', label: 'Literata' },
]

const cjkFonts = [
  { value: 'system', label: 'System Default' },
  { value: '"PingFang SC", "Microsoft YaHei", sans-serif', label: 'PingFang SC' },
  { value: '"Songti SC", "SimSun", serif', label: 'Songti (宋体)' },
  { value: '"Kaiti SC", "KaiTi", serif', label: 'Kaiti (楷体)' },
  { value: '"Noto Serif CJK SC", serif', label: 'Noto Serif CJK' },
  { value: '"Source Han Sans SC", sans-serif', label: 'Source Han Sans' },
]

const latinFont = ref(latinFonts[1].value)
const cjkFont = ref(cjkFonts[0].value)
const fontSize = ref(18)
const lineHeight = ref(1.8)
const blockSpacing = ref(1)
const cjkLetterSpacing = ref('0')

const fontFamily = computed(() => {
  const latin = latinFont.value === 'system'
    ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : latinFont.value
  const cjk = cjkFont.value === 'system'
    ? '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    : cjkFont.value
  return `${latin}, ${cjk}`
})

const blockMargin = computed(() => {
  return `${lineHeight.value * (blockSpacing.value - 1) + 1}em`
})

const sampleText = {
  heading: 'Typography Settings',
  english: 'The quick brown fox jumps over the lazy dog. Good typography makes reading effortless.',
  chinese: '中文排版需要特别关注字体、行高和字间距。良好的排版让阅读变得轻松愉悦。',
  mixed: 'VMark 支持混合 CJK 和 Latin 文字排版，自动处理间距。',
}
</script>

<template>
  <div class="typo-demo">
    <div class="typo-demo__header">
      <h3 class="typo-demo__title">Typography Controls</h3>
      <p class="typo-demo__subtitle">Fine-tune fonts, sizes, and spacing for perfect readability</p>
    </div>

    <div class="typo-demo__controls">
      <div class="typo-demo__control">
        <label class="typo-demo__label">Latin Font</label>
        <select v-model="latinFont" class="typo-demo__select">
          <option v-for="font in latinFonts" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <div class="typo-demo__control">
        <label class="typo-demo__label">CJK Font</label>
        <select v-model="cjkFont" class="typo-demo__select">
          <option v-for="font in cjkFonts" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <div class="typo-demo__control">
        <label class="typo-demo__label">
          Font Size
          <span class="typo-demo__value">{{ fontSize }}px</span>
        </label>
        <input
          type="range"
          v-model.number="fontSize"
          min="14"
          max="24"
          step="1"
          class="typo-demo__slider"
        />
      </div>

      <div class="typo-demo__control">
        <label class="typo-demo__label">
          Line Height
          <span class="typo-demo__value">{{ lineHeight.toFixed(1) }}</span>
        </label>
        <input
          type="range"
          v-model.number="lineHeight"
          min="1.4"
          max="2.2"
          step="0.1"
          class="typo-demo__slider"
        />
      </div>

      <div class="typo-demo__control">
        <label class="typo-demo__label">
          Block Spacing
          <span class="typo-demo__value">{{ blockSpacing }} line{{ blockSpacing > 1 ? 's' : '' }}</span>
        </label>
        <input
          type="range"
          v-model.number="blockSpacing"
          min="1"
          max="3"
          step="0.5"
          class="typo-demo__slider"
        />
      </div>

      <div class="typo-demo__control">
        <label class="typo-demo__label">
          CJK Letter Spacing
          <span class="typo-demo__value">{{ cjkLetterSpacing === '0' ? 'Off' : cjkLetterSpacing + 'em' }}</span>
        </label>
        <select v-model="cjkLetterSpacing" class="typo-demo__select">
          <option value="0">Off</option>
          <option value="0.02">0.02em (Tight)</option>
          <option value="0.03">0.03em (Normal)</option>
          <option value="0.05">0.05em (Loose)</option>
          <option value="0.08">0.08em (Very Loose)</option>
        </select>
      </div>
    </div>

    <div
      class="typo-demo__preview"
      :style="{
        fontFamily: fontFamily,
        fontSize: fontSize + 'px',
        lineHeight: lineHeight,
      }"
    >
      <h2
        class="typo-demo__preview-heading"
        :style="{ marginBottom: blockMargin }"
      >
        {{ sampleText.heading }}
      </h2>
      <p
        class="typo-demo__preview-p"
        :style="{ marginBottom: blockMargin }"
      >
        {{ sampleText.english }}
      </p>
      <p
        class="typo-demo__preview-p typo-demo__preview-p--cjk"
        :style="{
          marginBottom: blockMargin,
          letterSpacing: cjkLetterSpacing === '0' ? 'normal' : cjkLetterSpacing + 'em',
        }"
      >
        {{ sampleText.chinese }}
      </p>
      <p
        class="typo-demo__preview-p"
        :style="{ letterSpacing: cjkLetterSpacing === '0' ? 'normal' : cjkLetterSpacing + 'em' }"
      >
        {{ sampleText.mixed }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.typo-demo {
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

.dark .typo-demo {
  --demo-bg: #1e2024;
  --demo-border: #3a3f46;
  --demo-text: #d6d9de;
  --demo-text-secondary: #9aa0a6;
}

.typo-demo__header {
  margin-bottom: 20px;
}

.typo-demo__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.typo-demo__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--demo-text-secondary);
}

.typo-demo__controls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.typo-demo__control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.typo-demo__label {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.typo-demo__value {
  font-weight: 400;
  color: var(--demo-text-secondary);
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.typo-demo__select {
  padding: 8px 12px;
  font-size: 14px;
  font-family: var(--demo-font-sans);
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: white;
  color: var(--demo-text);
  cursor: pointer;
}

.dark .typo-demo__select {
  background: #2a2e34;
}

.typo-demo__select:focus {
  outline: none;
  border-color: var(--demo-accent);
}

.typo-demo__slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--demo-border);
  appearance: none;
  cursor: pointer;
}

.typo-demo__slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--demo-accent);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.typo-demo__slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--demo-accent);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.typo-demo__preview {
  background: white;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius);
  padding: 24px;
  color: #1a1a1a;
}

.dark .typo-demo__preview {
  background: #23262b;
  color: #d6d9de;
}

.typo-demo__preview-heading {
  font-size: 1.5em;
  font-weight: 600;
  margin-top: 0;
}

.typo-demo__preview-p {
  margin-top: 0;
}

.typo-demo__preview-p:last-child {
  margin-bottom: 0;
}
</style>
