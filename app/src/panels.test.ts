import { expect, test } from 'vitest';
import { shadowKey } from './Panels';
test('a box-shadow is recognised whichever order the parts are printed in', () => {
  expect(shadowKey('0 14px 40px rgba(0,0,0,.4)')).toBe(shadowKey('rgba(0, 0, 0, 0.4) 0px 14px 40px 0px')); expect(shadowKey('0 6px 20px rgba(0,0,0,.25)')).toBe(shadowKey('rgba(0, 0, 0, 0.25) 0px 6px 20px 0px'));
  expect(shadowKey('none')).toBe('none'); expect(shadowKey('')).toBe('none'); expect(shadowKey('0 14px 40px rgba(0,0,0,.4)')).not.toBe(shadowKey('0 6px 20px rgba(0,0,0,.25)')); expect(shadowKey('0 14px 40px #000')).not.toBe(shadowKey('0 14px 40px rgba(0,0,0,.4)'));
});
