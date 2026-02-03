/**
 * WeasyPrint Compatibility Configuration
 *
 * Declarative rules for WeasyPrint limitations.
 * When WeasyPrint adds support for a feature, remove it here.
 */

/**
 * CSS features not supported by WeasyPrint.
 */
export const UNSUPPORTED_CSS = [
  "color-mix()",
  "mask-image",
  "-webkit-mask-image",
  "mask-size",
  "mask-repeat",
] as const;

/**
 * SVG features not supported by WeasyPrint.
 */
export const UNSUPPORTED_SVG = ["foreignObject"] as const;

/**
 * CSS variable to hardcoded value mapping.
 * Used to resolve CSS variables for PDF export.
 */
export const CSS_VARIABLE_VALUES: Record<string, string> = {
  // Alert colors
  "--alert-note": "#0969da",
  "--alert-tip": "#1a7f37",
  "--alert-important": "#8250df",
  "--alert-warning": "#9a6700",
  "--alert-caution": "#cf222e",

  // Theme colors (light mode)
  "--bg-color": "#eeeded",
  "--bg-primary": "#eeeded",
  "--bg-secondary": "#e5e4e4",
  "--bg-tertiary": "#f0f0f0",
  "--text-color": "#1a1a1a",
  "--text-primary": "#1a1a1a",
  "--text-secondary": "#666666",
  "--text-tertiary": "#999999",
  "--primary-color": "#0066cc",
  "--border-color": "#d5d4d4",
  "--code-bg-color": "#e5e4e4",
  "--code-text-color": "#1a1a1a",
  "--table-border-color": "#d5d4d4",
  "--meta-content-color": "#666666",
  "--strong-color": "rgb(63, 86, 99)",
  "--emphasis-color": "rgb(91, 4, 17)",
  "--highlight-bg": "#fff3a3",
  "--accent-bg": "rgba(0, 102, 204, 0.1)",

  // Spacing
  "--radius-sm": "4px",
  "--radius-md": "6px",
  "--radius-lg": "8px",
  "--editor-block-spacing": "1em",
  "--code-padding": "18px",
  "--code-line-height": "1.45",
  "--editor-line-height": "1.6",
  "--editor-line-height-px": "28.8px",
  "--cjk-letter-spacing": "0.05em",
  "--editor-width": "50em",
};

/**
 * Alert background colors (10% opacity).
 * Pre-computed because color-mix() isn't supported.
 */
export const ALERT_BACKGROUNDS: Record<string, string> = {
  note: "rgba(9, 105, 218, 0.1)",
  tip: "rgba(26, 127, 55, 0.1)",
  important: "rgba(130, 80, 223, 0.1)",
  warning: "rgba(154, 103, 0, 0.1)",
  caution: "rgba(207, 34, 46, 0.1)",
};

/**
 * Alert icons as pre-colored SVG data URIs.
 * mask-image requires dynamic coloring; background-image needs pre-colored SVG.
 */
export const ALERT_ICONS: Record<string, string> = {
  note: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%230969da'%3E%3Cpath d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E")`,
  tip: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%231a7f37'%3E%3Cpath d='M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z'/%3E%3C/svg%3E")`,
  important: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%238250df'%3E%3Cpath d='M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E")`,
  warning: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%239a6700'%3E%3Cpath d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E")`,
  caution: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23cf222e'%3E%3Cpath d='M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E")`,
};

/**
 * Details chevron as pre-colored SVG data URI.
 */
export const DETAILS_CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%236b7280'%3E%3Cpath d='M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z'/%3E%3C/svg%3E")`;
