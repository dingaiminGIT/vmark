<script setup lang="ts">
import { ref, computed } from 'vue'
import { applyRules, defaultCJKSettings, type CJKFormattingSettings, type QuoteStyle } from './cjkFormatter'

const sampleTexts = [
  {
    label: 'CJK-Latin Spacing',
    input: '今天是2024年1月1日,我在北京.',
    description: 'Adds spaces between CJK and Latin characters, converts punctuation'
  },
  {
    label: 'Quote Conversion',
    input: '他说"这是一个\'测试\'文本".',
    description: 'Converts straight quotes to smart quotes or corner brackets'
  },
  {
    label: 'Dash Conversion',
    input: '中文--English--中文',
    description: 'Converts double hyphens to em-dashes with proper spacing'
  },
  {
    label: 'Fullwidth Normalization',
    input: '价格是$100,数量是１００个.',
    description: 'Normalizes fullwidth numbers and punctuation'
  },
  {
    label: 'Mixed Example',
    input: '我买了3个iPhone15,花了$999!!!',
    description: 'Combines multiple formatting rules'
  }
]

const selectedSample = ref(0)
const customInput = ref('')
const quoteStyle = ref<QuoteStyle>('curly')

const settings = computed<CJKFormattingSettings>(() => ({
  ...defaultCJKSettings,
  quoteStyle: quoteStyle.value
}))

const inputText = computed(() => {
  return customInput.value || sampleTexts[selectedSample.value].input
})

const outputText = computed(() => {
  return applyRules(inputText.value, settings.value)
})

const hasChanges = computed(() => inputText.value !== outputText.value)
</script>

<template>
  <div class="cjk-demo">
    <div class="cjk-demo__header">
      <h3 class="cjk-demo__title">CJK Formatting Demo</h3>
      <p class="cjk-demo__subtitle">See how VMark formats mixed CJK and Latin text</p>
    </div>

    <div class="cjk-demo__samples">
      <button
        v-for="(sample, index) in sampleTexts"
        :key="index"
        :class="['cjk-demo__sample-btn', { 'cjk-demo__sample-btn--active': selectedSample === index && !customInput }]"
        @click="selectedSample = index; customInput = ''"
      >
        {{ sample.label }}
      </button>
    </div>

    <div class="cjk-demo__description">
      {{ customInput ? 'Custom input' : sampleTexts[selectedSample].description }}
    </div>

    <div class="cjk-demo__options">
      <label class="cjk-demo__option">
        <span>Quote Style:</span>
        <select v-model="quoteStyle" class="cjk-demo__select">
          <option value="curly">Curly "" ''</option>
          <option value="corner">Corner 「」『』</option>
          <option value="guillemets">Guillemets «» ‹›</option>
        </select>
      </label>
    </div>

    <div class="cjk-demo__comparison">
      <div class="cjk-demo__panel">
        <div class="cjk-demo__label">Before</div>
        <textarea
          v-model="customInput"
          :placeholder="sampleTexts[selectedSample].input"
          class="cjk-demo__textarea"
          rows="3"
        />
      </div>
      <div class="cjk-demo__arrow">→</div>
      <div class="cjk-demo__panel">
        <div class="cjk-demo__label">
          After
          <span v-if="hasChanges" class="cjk-demo__changed">changed</span>
        </div>
        <div class="cjk-demo__output">{{ outputText }}</div>
      </div>
    </div>

    <div class="cjk-demo__diff" v-if="hasChanges">
      <div class="cjk-demo__diff-title">Changes Applied:</div>
      <div class="cjk-demo__diff-content">
        <span class="cjk-demo__diff-old">{{ inputText }}</span>
        <span class="cjk-demo__diff-new">{{ outputText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cjk-demo {
  --demo-bg: #f8f9fa;
  --demo-border: #e1e4e8;
  --demo-text: #24292e;
  --demo-text-secondary: #586069;
  --demo-accent: #0066cc;
  --demo-accent-bg: rgba(0, 102, 204, 0.1);
  --demo-success: #28a745;
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

.dark .cjk-demo {
  --demo-bg: #1e2024;
  --demo-border: #3a3f46;
  --demo-text: #d6d9de;
  --demo-text-secondary: #9aa0a6;
  --demo-accent: #5aa8ff;
  --demo-accent-bg: rgba(90, 168, 255, 0.15);
}

.cjk-demo__header {
  margin-bottom: 20px;
}

.cjk-demo__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.cjk-demo__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--demo-text-secondary);
}

.cjk-demo__samples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.cjk-demo__sample-btn {
  padding: 6px 12px;
  font-size: 13px;
  font-family: var(--demo-font-sans);
  border: 1px solid var(--demo-border);
  border-radius: 100px;
  background: transparent;
  color: var(--demo-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.cjk-demo__sample-btn:hover {
  border-color: var(--demo-accent);
  color: var(--demo-accent);
}

.cjk-demo__sample-btn--active {
  background: var(--demo-accent);
  border-color: var(--demo-accent);
  color: white;
}

.cjk-demo__description {
  font-size: 13px;
  color: var(--demo-text-secondary);
  margin-bottom: 16px;
  font-style: italic;
}

.cjk-demo__options {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.cjk-demo__option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.cjk-demo__select {
  padding: 4px 8px;
  font-size: 13px;
  font-family: var(--demo-font-sans);
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: white;
  color: var(--demo-text);
}

.dark .cjk-demo__select {
  background: #2a2e34;
}

.cjk-demo__comparison {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 640px) {
  .cjk-demo__comparison {
    grid-template-columns: 1fr;
  }
  .cjk-demo__arrow {
    transform: rotate(90deg);
    justify-self: center;
  }
}

.cjk-demo__panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cjk-demo__label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--demo-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cjk-demo__changed {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--demo-success);
  color: white;
  border-radius: 100px;
  text-transform: uppercase;
  font-weight: 600;
}

.cjk-demo__textarea {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  font-family: var(--demo-font-sans);
  line-height: 1.6;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius);
  background: white;
  color: var(--demo-text);
  resize: vertical;
}

.dark .cjk-demo__textarea {
  background: #2a2e34;
}

.cjk-demo__textarea:focus {
  outline: none;
  border-color: var(--demo-accent);
}

.cjk-demo__output {
  padding: 12px;
  font-size: 16px;
  line-height: 1.6;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius);
  background: var(--demo-accent-bg);
  min-height: 72px;
}

.cjk-demo__arrow {
  font-size: 24px;
  color: var(--demo-text-secondary);
  align-self: center;
  margin-top: 24px;
}

.cjk-demo__diff {
  margin-top: 20px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--demo-radius);
}

.dark .cjk-demo__diff {
  background: rgba(255, 255, 255, 0.03);
}

.cjk-demo__diff-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--demo-text-secondary);
}

.cjk-demo__diff-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: var(--demo-font-mono);
  font-size: 14px;
}

.cjk-demo__diff-old {
  text-decoration: line-through;
  color: #cb2431;
  opacity: 0.7;
}

.cjk-demo__diff-new {
  color: var(--demo-success);
}
</style>
