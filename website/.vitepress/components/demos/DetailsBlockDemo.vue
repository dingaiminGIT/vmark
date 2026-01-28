<script setup lang="ts">
import { ref } from 'vue'

const examples = [
  {
    summary: 'Click to expand this section',
    content: 'This is the hidden content that appears when you click. You can put any markdown content here — paragraphs, lists, code blocks, even nested details.',
  },
  {
    summary: 'FAQ: How do I install VMark?',
    content: 'Download the latest release from our download page, then drag VMark to your Applications folder. Launch it and start writing!',
  },
  {
    summary: 'Advanced Configuration Options',
    content: 'VMark stores settings in ~/.vmark/settings.json. You can manually edit this file for advanced configuration, but most users won\'t need to.',
  },
]

const openStates = ref([true, false, false])

function toggle(index: number) {
  openStates.value[index] = !openStates.value[index]
}
</script>

<template>
  <div class="vmark-demo">
    <div class="vmark-demo__header">
      <h3 class="vmark-demo__title">Collapsible Blocks</h3>
      <p class="vmark-demo__subtitle">Expandable sections for FAQs, spoilers, and optional content</p>
    </div>

    <div class="examples">
      <details
        v-for="(example, index) in examples"
        :key="index"
        class="details"
        :open="openStates[index]"
      >
        <summary class="details__summary" @click.prevent="toggle(index)">
          <span class="details__arrow">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="details__text">{{ example.summary }}</span>
        </summary>
        <div class="details__content">
          {{ example.content }}
        </div>
      </details>
    </div>

    <div class="nested">
      <div class="nested__title">Nested Example</div>
      <details class="details" open>
        <summary class="details__summary">
          <span class="details__arrow">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="details__text">Parent Section</span>
        </summary>
        <div class="details__content">
          <p>This section contains nested collapsible content:</p>
          <details class="details details--nested">
            <summary class="details__summary">
              <span class="details__arrow">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="details__text">Child Section A</span>
            </summary>
            <div class="details__content">
              Content for the first nested section.
            </div>
          </details>
          <details class="details details--nested">
            <summary class="details__summary">
              <span class="details__arrow">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="details__text">Child Section B</span>
            </summary>
            <div class="details__content">
              Content for the second nested section.
            </div>
          </details>
        </div>
      </details>
    </div>

    <div class="syntax">
      <div class="syntax__title">Markdown Syntax</div>
      <pre class="vmark-code">&lt;details&gt;
&lt;summary&gt;Click to expand&lt;/summary&gt;

Your hidden content here.
Supports **markdown** formatting.

&lt;/details&gt;</pre>
    </div>
  </div>
</template>

<style src="./vmark-ui.css"></style>
<style scoped>
.examples {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.details {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.details--nested {
  margin-top: 12px;
  background: var(--subtle-bg);
}

.details__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
  font-size: 14px;
  list-style: none;
  transition: background 0.15s;
  color: var(--text-color);
}

.details__summary::-webkit-details-marker {
  display: none;
}

.details__summary:hover {
  background: var(--hover-bg);
}

.details__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.details[open] > .details__summary .details__arrow {
  transform: rotate(90deg);
}

.details__text {
  flex: 1;
}

.details__content {
  padding: 0 16px 16px 40px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.details__content p {
  margin: 0 0 8px 0;
}

.details__content p:last-child {
  margin-bottom: 0;
}

.nested {
  margin-bottom: 24px;
}

.nested__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.syntax {
  background: var(--subtle-bg);
  border-radius: var(--radius-md);
  padding: 16px;
}

.syntax__title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-secondary);
}
</style>
