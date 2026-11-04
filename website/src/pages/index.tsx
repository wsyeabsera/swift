import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Cards from '@site/src/components/Cards';
import styles from './index.module.css';

export default function Home(): ReactNode {
  return (
    <Layout title="Swift Canvas docs" description="Funny, honest docs for Swift Canvas, the AI-native design tool that runs on your local Claude Code login.">
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <Heading as="h1">Design by talking.<br />Docs by not boring you.</Heading>
          <p>
            Swift Canvas is a desktop design tool where you select a thing, press <kbd>⌘K</kbd>, say what you want,
            and it changes in about a second. This guide explains every feature like a friend would. A friend with jokes.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/intro">Start here 🚀</Link>
            <Link className="button button--secondary button--lg" to="/docs/getting-started">Just run it</Link>
          </div>
        </div>
        <img className={`${styles.heroImg} zoomable`} src={useBaseUrl('/img/hero.svg')} alt="A canvas with three design frames, a Say bar and a speech bubble" />
      </header>
      <main className="container margin-vert--lg">
        <Cards
          items={[
            {emoji: '🎨', title: 'The canvas', to: '/docs/canvas', children: 'Pan, zoom, drag, nudge, undo. Frames are tiny sandboxed websites. Nothing escapes.'},
            {emoji: '🗣️', title: 'Say', to: '/docs/say', children: 'Type what you want. Simple stuff is instant and free. Hard stuff goes to Claude.'},
            {emoji: '✨', title: 'Spark ×4', to: '/docs/spark', children: 'Four directions at once. Keep the good one. Pretend the others never happened.'},
            {emoji: '📦', title: 'Projects & brand', to: '/docs/projects', children: 'Point it at a repo and it learns your colours. It even gets them right.'},
            {emoji: '🔍', title: 'Check', to: '/docs/check', children: 'A free instant critic for contrast, clipped text and tiny tap targets.'},
            {emoji: '🚢', title: 'Ship', to: '/docs/ship', children: 'Export HTML, or commit straight to a fresh branch in your repo.'},
          ]}
        />
      </main>
    </Layout>
  );
}
