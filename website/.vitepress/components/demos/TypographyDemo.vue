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

// Match VMark's Settings dialog options exactly
const fontSizeOptions = [
  { value: '14', label: '14px' },
  { value: '16', label: '16px' },
  { value: '18', label: '18px' },
  { value: '20', label: '20px' },
  { value: '22', label: '22px' },
]

const lineHeightOptions = [
  { value: '1.4', label: '1.4 (Compact)' },
  { value: '1.6', label: '1.6 (Normal)' },
  { value: '1.8', label: '1.8 (Relaxed)' },
  { value: '2.0', label: '2.0 (Spacious)' },
  { value: '2.2', label: '2.2 (Extra)' },
]

const blockSpacingOptions = [
  { value: '0.5', label: '0.5× (Tight)' },
  { value: '1', label: '1× (Normal)' },
  { value: '1.5', label: '1.5× (Relaxed)' },
  { value: '2', label: '2× (Spacious)' },
]

const cjkLetterSpacingOptions = [
  { value: '0', label: 'Off' },
  { value: '0.02', label: '0.02em (Subtle)' },
  { value: '0.03', label: '0.03em (Light)' },
  { value: '0.05', label: '0.05em (Normal)' },
  { value: '0.08', label: '0.08em (Wide)' },
]

const latinFont = ref(latinFonts[1].value)
const cjkFont = ref(cjkFonts[0].value)
const fontSize = ref('18')
const lineHeight = ref('1.8')
const blockSpacing = ref('1')
const cjkLetterSpacing = ref('0')
const coloredEmphasis = ref(true)

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
  const lh = parseFloat(lineHeight.value)
  const bs = parseFloat(blockSpacing.value)
  return `${lh * (bs - 1) + 1}em`
})

// CJK letter-spacing CSS variable (matches VMark's algorithm)
const cjkSpacingStyle = computed(() => {
  return cjkLetterSpacing.value === '0' ? '0' : `${cjkLetterSpacing.value}em`
})
</script>

<template>
  <div class="vmark-demo">
    <p class="vmark-demo__subtitle">Fine-tune fonts, sizes, and spacing for perfect readability</p>

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
        <label class="vmark-label">Font Size</label>
        <select v-model="fontSize" class="vmark-select">
          <option v-for="opt in fontSizeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="vmark-control">
        <label class="vmark-label">Line Height</label>
        <select v-model="lineHeight" class="vmark-select">
          <option v-for="opt in lineHeightOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="vmark-control">
        <label class="vmark-label">Block Spacing</label>
        <select v-model="blockSpacing" class="vmark-select">
          <option v-for="opt in blockSpacingOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="vmark-control">
        <label class="vmark-label">CJK Letter Spacing</label>
        <select v-model="cjkLetterSpacing" class="vmark-select">
          <option v-for="opt in cjkLetterSpacingOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="vmark-control vmark-control--toggle">
        <label class="vmark-toggle">
          <input type="checkbox" v-model="coloredEmphasis" class="vmark-toggle__input" />
          <span>Color bold/italic</span>
        </label>
      </div>
    </div>

    <!-- CSS variable controls CJK-only spacing (matches VMark's algorithm) -->
    <div
      :class="['preview', { 'preview--colored': coloredEmphasis }]"
      :style="{
        fontFamily: fontFamily,
        fontSize: fontSize + 'px',
        lineHeight: parseFloat(lineHeight),
        '--cjk-spacing': cjkSpacingStyle,
      }"
    >
      <h2 class="preview__heading" :style="{ marginBottom: blockMargin }">
        The Art of Typography
      </h2>
      <p class="preview__p" :style="{ marginBottom: blockMargin }">
        Good typography is <strong>invisible</strong> — it lets readers focus on <em>content</em>, not formatting. The right combination of font, size, and spacing creates a seamless reading experience.
      </p>
      <!-- Pure CJK paragraph: all characters get spacing -->
      <p class="preview__p" :style="{ marginBottom: blockMargin }">
        <span class="cjk">优秀的排版是</span><strong class="cjk">无形的</strong><span class="cjk">——</span><span class="cjk">它让读者专注于</span><mark class="cjk">内容</mark><span class="cjk">而非格式。字体、字号和间距的恰当组合，能够创造出流畅的阅读体验。</span>
      </p>
      <!-- Mixed paragraph: only CJK runs get spacing, Latin stays normal -->
      <p class="preview__p">
        VMark supports <strong>mixed CJK and Latin</strong> text with automatic spacing. Whether you write in English, <span class="cjk">中文</span>, <span class="cjk">日本語</span>, or <span class="cjk">한국어</span> — typography <em>just works</em>.
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

/* CJK letter-spacing: only CJK characters, not Latin (matches VMark's algorithm) */
.preview .cjk {
  letter-spacing: var(--cjk-spacing, 0);
}

/* Colored emphasis */
.preview--colored strong {
  color: var(--strong-color);
}

.preview--colored em {
  color: var(--emphasis-color);
}

.preview mark {
  background: var(--highlight-bg, #fff3a3);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}

/* Toggle alignment */
.vmark-control--toggle {
  display: flex;
  align-items: flex-end;
  padding-bottom: 4px;
}
</style>
