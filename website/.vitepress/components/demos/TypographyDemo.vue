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
  <div class="vmark-demo">
    <div class="vmark-demo__header">
      <h3 class="vmark-demo__title">Typography Controls</h3>
      <p class="vmark-demo__subtitle">Fine-tune fonts, sizes, and spacing for perfect readability</p>
    </div>

    <div class="vmark-controls">
      <div class="vmark-control">
        <label class="vmark-label">Latin Font</label>
        <select v-model="latinFont" class="vmark-select">
          <option v-for="font in latinFonts" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <div class="vmark-control">
        <label class="vmark-label">CJK Font</label>
        <select v-model="cjkFont" class="vmark-select">
          <option v-for="font in cjkFonts" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <div class="vmark-control">
        <label class="vmark-label">
          Font Size
          <span class="vmark-value">{{ fontSize }}px</span>
        </label>
        <input
          type="range"
          v-model.number="fontSize"
          min="14"
          max="24"
          step="1"
          class="vmark-slider"
        />
      </div>

      <div class="vmark-control">
        <label class="vmark-label">
          Line Height
          <span class="vmark-value">{{ lineHeight.toFixed(1) }}</span>
        </label>
        <input
          type="range"
          v-model.number="lineHeight"
          min="1.4"
          max="2.2"
          step="0.1"
          class="vmark-slider"
        />
      </div>

      <div class="vmark-control">
        <label class="vmark-label">
          Block Spacing
          <span class="vmark-value">{{ blockSpacing }} line{{ blockSpacing > 1 ? 's' : '' }}</span>
        </label>
        <input
          type="range"
          v-model.number="blockSpacing"
          min="1"
          max="3"
          step="0.5"
          class="vmark-slider"
        />
      </div>

      <div class="vmark-control">
        <label class="vmark-label">
          CJK Letter Spacing
          <span class="vmark-value">{{ cjkLetterSpacing === '0' ? 'Off' : cjkLetterSpacing + 'em' }}</span>
        </label>
        <select v-model="cjkLetterSpacing" class="vmark-select">
          <option value="0">Off</option>
          <option value="0.02">0.02em (Tight)</option>
          <option value="0.03">0.03em (Normal)</option>
          <option value="0.05">0.05em (Loose)</option>
          <option value="0.08">0.08em (Very Loose)</option>
        </select>
      </div>
    </div>

    <div
      class="preview"
      :style="{
        fontFamily: fontFamily,
        fontSize: fontSize + 'px',
        lineHeight: lineHeight,
      }"
    >
      <h2 class="preview__heading" :style="{ marginBottom: blockMargin }">
        {{ sampleText.heading }}
      </h2>
      <p class="preview__p" :style="{ marginBottom: blockMargin }">
        {{ sampleText.english }}
      </p>
      <p
        class="preview__p preview__p--cjk"
        :style="{
          marginBottom: blockMargin,
          letterSpacing: cjkLetterSpacing === '0' ? 'normal' : cjkLetterSpacing + 'em',
        }"
      >
        {{ sampleText.chinese }}
      </p>
      <p
        class="preview__p"
        :style="{ letterSpacing: cjkLetterSpacing === '0' ? 'normal' : cjkLetterSpacing + 'em' }"
      >
        {{ sampleText.mixed }}
      </p>
    </div>
  </div>
</template>

<style src="./vmark-ui.css"></style>
<style scoped>
.preview {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 24px;
}

.preview__heading {
  font-size: 1.4em;
  font-weight: 600;
  margin-top: 0;
  color: var(--text-color);
}

.preview__p {
  margin-top: 0;
  color: var(--text-color);
}

.preview__p:last-child {
  margin-bottom: 0;
}
</style>
