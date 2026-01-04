import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Pre-bundle heavy dependencies to speed up dev server startup
  optimizeDeps: {
    include: [
      // Milkdown and its dependencies
      "@milkdown/kit/core",
      "@milkdown/kit/preset/commonmark",
      "@milkdown/kit/preset/gfm",
      "@milkdown/kit/plugin/history",
      "@milkdown/kit/plugin/clipboard",
      "@milkdown/kit/plugin/listener",
      "@milkdown/kit/plugin/cursor",
      "@milkdown/kit/plugin/indent",
      "@milkdown/kit/plugin/trailing",
      "@milkdown/kit/prose/state",
      "@milkdown/kit/prose/view",
      "@milkdown/kit/prose/model",
      "@milkdown/kit/prose/transform",
      "@milkdown/kit/prose/commands",
      "@milkdown/kit/prose/keymap",
      "@milkdown/kit/prose/inputrules",
      "@milkdown/kit/utils",
      "@milkdown/react",
      "@milkdown/plugin-prism",
      // CodeMirror
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/commands",
      "@codemirror/lang-markdown",
      "@codemirror/language",
      "@codemirror/language-data",
      "@codemirror/autocomplete",
      "@codemirror/search",
      // Heavy utilities (mermaid is lazy-loaded, not included here)
      "katex",
      "refractor",
      // Tauri APIs
      "@tauri-apps/api/core",
      "@tauri-apps/api/event",
      "@tauri-apps/api/webviewWindow",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-fs",
      // React ecosystem
      "react",
      "react-dom",
      "react-router-dom",
      "zustand",
      "@tanstack/react-query",
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
