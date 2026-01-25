<script setup lang="ts">
// Alpha badge for VMark site title
</script>

<template>
  <span class="alpha-badge" title="Alpha Release - Features may change">
    alpha
  </span>
</template>

<style scoped>
.alpha-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  padding: 1px 7px 2px;
  font-size: 10px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  border-radius: 4px;
  background: linear-gradient(135deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  color: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  cursor: help;
  user-select: none;
  vertical-align: middle;
  position: relative;
  top: -1px;
}

/* Night theme adjustment - dark text on bright background */
[data-vmark-theme="night"] .alpha-badge,
.dark .alpha-badge {
  color: #1a1a1a;
}
</style>
