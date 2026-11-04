import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Swift Canvas',
  tagline: 'Talk to your design. It talks back. Faster than you can say "make it pop".',
  favicon: 'img/favicon.svg',

  future: {v4: true},

  url: 'https://wsyeabsera.github.io',
  baseUrl: '/swift/',
  organizationName: 'wsyeabsera',
  projectName: 'swift',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  markdown: {
    mermaid: true,
    hooks: {onBrokenMarkdownLinks: 'throw'},
  },
  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {hashed: true, docsRouteBasePath: '/docs', indexBlog: false, highlightSearchTermsOnTargetPage: true},
    ],
  ],

  i18n: {defaultLocale: 'en', locales: ['en']},

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/wsyeabsera/swift/tree/main/website/',
        },
        blog: false,
        theme: {customCss: './src/css/custom.css'},
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.svg',
    colorMode: {defaultMode: 'dark', disableSwitch: false, respectPrefersColorScheme: true},
    zoom: {selector: '.markdown img, .zoomable', background: {light: 'rgba(255,255,255,.92)', dark: 'rgba(10,10,20,.92)'}},
    mermaid: {theme: {light: 'neutral', dark: 'dark'}},
    navbar: {
      title: 'Swift Canvas',
      logo: {alt: 'Swift Canvas', src: 'img/logo.svg'},
      items: [
        {type: 'docSidebar', sidebarId: 'main', position: 'left', label: 'The Guide'},
        {to: '/docs/cheat-sheet', label: 'Cheat sheet', position: 'left'},
        {to: '/docs/faq', label: 'FAQ', position: 'left'},
        {href: 'https://github.com/wsyeabsera/swift', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {label: 'What even is this?', to: '/docs/intro'},
            {label: 'Get it running', to: '/docs/getting-started'},
            {label: 'Say & Spark', to: '/docs/say'},
          ],
        },
        {
          title: 'Under the hood',
          items: [
            {label: 'How it fits together', to: '/docs/under-the-hood'},
            {label: 'Speed receipts', to: '/docs/speed'},
            {label: 'Roadmap', to: '/docs/roadmap'},
          ],
        },
        {title: 'Source', items: [{label: 'GitHub', href: 'https://github.com/wsyeabsera/swift'}]},
      ],
      copyright: `No pixels were harmed. Built with Docusaurus, caffeine and ${new Date().getFullYear()} opinions.`,
    },
    prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula, additionalLanguages: ['bash', 'rust', 'json']},
  } satisfies Preset.ThemeConfig,
};

export default config;
