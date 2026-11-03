import { expect, test } from 'vitest';
import { nudge } from './nudge';
const abs = { position: 'absolute', left: '115px', top: '86px' };
test('arrows move by 1, shift by 10, on the right axis', () => { expect(nudge(abs, 'ArrowRight', false)).toEqual({ prop: 'left', value: '116px' }); expect(nudge(abs, 'ArrowLeft', true)).toEqual({ prop: 'left', value: '105px' }); expect(nudge(abs, 'ArrowUp', false)).toEqual({ prop: 'top', value: '85px' }); expect(nudge(abs, 'ArrowDown', true)).toEqual({ prop: 'top', value: '96px' }); });
test('without pixel left/top the element translates instead; other keys are left alone', () => { expect(nudge({ position: 'static', left: '0px', top: '0px' }, 'ArrowUp', false)).toEqual({ prop: 'translate', value: '0px -1px' }); expect(nudge({ position: 'absolute', left: 'auto', top: '1px' }, 'ArrowLeft', false)).toEqual({ prop: 'translate', value: '-1px 0px' }); expect(nudge({ position: 'absolute', left: '5%', top: '1px' }, 'ArrowLeft', false)).toEqual({ prop: 'translate', value: '-1px 0px' }); expect(nudge(abs, 'a', false)).toBeNull(); });
test('negative and fractional positions work', () => { expect(nudge({ position: 'fixed', left: '-3px', top: '0.5px' }, 'ArrowLeft', true)).toEqual({ prop: 'left', value: '-13px' }); expect(nudge({ position: 'relative', left: '1.25px', top: '0.5px' }, 'ArrowDown', false)).toEqual({ prop: 'top', value: '1.5px' }); });
import { movedPos, startPos } from './nudge';
test('drag start needs a positioned element with pixel offsets', () => { expect(startPos({ position: 'absolute', left: '115px', top: '86px' })).toEqual({ left: 115, top: 86 }); expect(startPos({ position: 'static', left: '1px', top: '1px' })).toBeNull(); expect(startPos({ position: 'absolute', left: 'auto', top: '1px' })).toBeNull(); expect(startPos({})).toBeNull(); });
test('moved positions are whole pixels and follow the drag', () => { expect(movedPos({ left: 10, top: 20 }, 5.4, -3.6)).toEqual({ left: '15px', top: '16px' }); expect(movedPos({ left: 0, top: 0 }, -10, 0)).toEqual({ left: '-10px', top: '0px' }); });
import { resizedSize } from './nudge';
test('resize follows the drag, in whole pixels, with a 4 px floor', () => { expect(resizedSize({ w: 100, h: 50 }, 20.4, -10.2)).toEqual({ width: '120px', height: '40px' }); expect(resizedSize({ w: 20, h: 20 }, -100, -100)).toEqual({ width: '4px', height: '4px' }); });
import { moveEdits, moveStart, startTranslate } from './nudge';
test('static elements move with translate: layout untouched, offsets accumulate', () => {
  expect(nudge({ position: 'static', left: 'auto', top: 'auto', translate: 'none' }, 'ArrowRight', true)).toEqual({ prop: 'translate', value: '10px 0px' });
  expect(nudge({ position: 'static', translate: '10px 4px' }, 'ArrowUp', false)).toEqual({ prop: 'translate', value: '10px 3px' });
  expect(startTranslate({ translate: '7px' })).toEqual({ x: 7, y: 0 }); expect(startTranslate({ translate: '5% 2%' })).toBeNull(); expect(startTranslate({})).toEqual({ x: 0, y: 0 });
  expect(nudge({ position: 'static', translate: '5% 2%' }, 'ArrowUp', false)).toBeNull(); // not in pixels: left alone
});
test('drag picks left/top when the element has them, else translate', () => {
  const a = moveStart({ position: 'absolute', left: '10px', top: '20px', translate: 'none' })!; expect(moveEdits(a, 5, -4)).toEqual([{ prop: 'left', value: '15px' }, { prop: 'top', value: '16px' }]);
  const b = moveStart({ position: 'static', left: 'auto', top: 'auto', translate: '3px 3px' })!; expect(moveEdits(b, 2.4, 1)).toEqual([{ prop: 'translate', value: '5px 4px' }]);
});
