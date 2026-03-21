import { describe, expect, it } from 'vitest';
import { add } from '../src/index';

describe('shared add()', () => {
  it('adds two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});

