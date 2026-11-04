import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

export type CardItem = {emoji: string; title: string; to: string; children: ReactNode};

/** A grid of linked feature cards. Used on the home page and the guide intro. */
export default function Cards({items}: {items: CardItem[]}): ReactNode {
  return (
    <div className={styles.grid}>
      {items.map((c) => (
        <Link key={c.to} to={c.to} className={styles.card}>
          <span className={styles.emoji} aria-hidden="true">{c.emoji}</span>
          <h3>{c.title}</h3>
          <p>{c.children}</p>
        </Link>
      ))}
    </div>
  );
}
