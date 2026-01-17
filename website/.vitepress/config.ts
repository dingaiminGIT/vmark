import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'VMark',
  description: 'A local-first Markdown editor with dual editing modes',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
  ],

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Download', link: '/download' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Changelog', link: '/changelog' },
      {
        text: 'GitHub',
        link: 'https://github.com/xiaolai/vmark'
      }
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

    socialLinks: [
      { icon: 'github', link: 'https://github.com/xiaolai/vmark' },
      { icon: 'x', link: 'https://x.com/xiaolai' }
    ],

    footer: {
      message: 'Created by <a href="https://x.com/xiaolai" target="_blank">@xiaolai</a> · <a href="https://lixiaolai.com" target="_blank">lixiaolai.com</a>',
      copyright: 'Copyright © 2026-present VMark'
    },

    search: {
      provider: 'local'
    }
  }
})
