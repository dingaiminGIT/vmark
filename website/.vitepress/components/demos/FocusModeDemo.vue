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
  <div class="vmark-demo">
    <p class="vmark-demo__subtitle">Click any paragraph to focus on it</p>

    <div class="controls">
      <label class="vmark-toggle">
        <input type="checkbox" v-model="focusEnabled" class="vmark-toggle__input" />
        <span>Enable Focus Mode</span>
      </label>
    </div>

    <div :class="['content', { 'content--focus': focusEnabled }]">
      <p
        v-for="(text, index) in paragraphs"
        :key="index"
        :class="['paragraph', { 'paragraph--focused': focusedIndex === index }]"
        @click="handleClick(index)"
      >
        {{ text }}
      </p>
    </div>

    <div class="vmark-hint">
      <span class="vmark-hint__icon">💡</span>
      <span>In VMark, focus automatically follows your cursor as you type.</span>
    </div>
  </div>
</template>

<style src="./vmark-ui.css"></style>
<style scoped>
.controls {
  margin-bottom: 16px;
}

.content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;
}

.paragraph {
  margin: 0 0 16px 0;
  padding: 8px 12px;
  font-size: 15px;
  line-height: 1.7;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color);
}

.paragraph:last-child {
  margin-bottom: 0;
}

.paragraph:hover {
  background: var(--hover-bg);
}

/* Focus mode styles - match VMark exactly */
.content--focus .paragraph {
  color: #c8c8c8;
}

.dark .content--focus .paragraph {
  color: #4a4f56;
}

.content--focus .paragraph--focused {
  color: var(--text-color);
  background: var(--accent-bg);
}
</style>
