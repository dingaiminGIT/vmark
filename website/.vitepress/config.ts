import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'VMark',
  description: 'A local-first Markdown editor with dual editing modes',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#4a6fa5' }],
    ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
  ],

  appearance: false, // We use our own theme switcher

  themeConfig: {

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Download', link: '/download' },
      { text: 'Guide', link: '/guide/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/' },
            { text: 'Features', link: '/guide/features' },
            { text: 'Keyboard Shortcuts', link: '/guide/shortcuts' },
            { text: 'CJK Formatting', link: '/guide/cjk-formatting' },
          ]
        }
      ]
    },

    footer: {
      copyright: 'Copyright © 2026 VMark'
    },

    search: {
      provider: 'local'
    }
  }
})
