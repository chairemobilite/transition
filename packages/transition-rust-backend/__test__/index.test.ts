import { test, expect } from 'vitest'

import { sum } from '../index.js'

// Simple test to validate Rust binding
// TODO Update when we have an actual simple function to test
test('sum from native', () => {
  expect(sum(1, 2)).toBe(3)
})
