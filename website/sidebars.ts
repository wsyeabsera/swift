import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  main: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Make things',
      collapsed: false,
      items: ['canvas', 'say', 'spark'],
    },
    {
      type: 'category',
      label: 'Keep things',
      collapsed: false,
      items: ['projects', 'looks', 'history'],
    },
    {
      type: 'category',
      label: 'Check & ship',
      collapsed: false,
      items: ['check', 'ship', 'pulse'],
    },
    {
      type: 'category',
      label: 'Nerd corner',
      items: ['under-the-hood', 'speed', 'testing'],
    },
    'cheat-sheet',
    'roadmap',
    'faq',
  ],
};

export default sidebars;
