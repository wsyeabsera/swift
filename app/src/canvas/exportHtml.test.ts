import { expect, test } from 'vitest';
import { exportDoc, exportName } from './exportHtml';
test('export wraps the markup and escapes the title', () => { const d = exportDoc('A "<b>" & co', '<div id="tv">x</div>'); expect(d.startsWith('<!doctype html>')).toBe(true); expect(d).toContain('<title>A &quot;&lt;b&gt;&quot; &amp; co</title>'); expect(d).toContain('<div id="tv">x</div>'); });
test('file names are safe and never empty', () => { expect(exportName('TV · Idle 1920×1080')).toBe('tv-idle-1920-1080.html'); expect(exportName('../../etc/passwd')).toBe('etc-passwd.html'); expect(exportName('···')).toBe('frame.html'); expect(exportName('x'.repeat(90)).length).toBe(55); });
