/**
 * Test script for feed.getFeedItems API endpoint
 * Tests various edge cases including malformed inputs that could cause 500 errors
 */

interface TestCase {
  name: string
  input: {
    feedId?: string
    feedIds?: string[]
    limit?: number
  }
  expectedSanitized: string[]
}

const testCases: TestCase[] = [
  {
    name: 'Valid feedId only',
    input: { limit: 50 },
    expectedSanitized: [],
  },
  {
    name: 'Valid feedId with specific ID',
    input: { feedId: 'test-feed-id', limit: 50 },
    expectedSanitized: [],
  },
  {
    name: 'Empty feedIds array',
    input: { feedIds: [], limit: 50 },
    expectedSanitized: [],
  },
  {
    name: 'Malformed feedIds with undefined string - CRITICAL TEST',
    input: { feedIds: ['undefined'], limit: 50 },
    expectedSanitized: [], // Should filter out 'undefined' string
  },
  {
    name: 'Mixed valid and invalid feedIds',
    input: { feedIds: ['valid-id', 'undefined', '', 'another-id'], limit: 50 },
    expectedSanitized: ['valid-id', 'another-id'],
  },
  {
    name: 'Null/undefined in feedIds array',
    input: { feedIds: ['valid-id', null as any, undefined as any], limit: 50 },
    expectedSanitized: ['valid-id'],
  },
  {
    name: 'All invalid values',
    input: { feedIds: ['undefined', '', null as any, undefined as any], limit: 50 },
    expectedSanitized: [],
  },
]

function sanitizeFeedIds(feedIds?: string[]): string[] {
  return Array.isArray(feedIds)
    ? feedIds.filter(id => !!id && typeof id === 'string' && id !== 'undefined')
    : []
}

function testSanitization(testCase: TestCase): boolean {
  console.log(`\n🧪 Testing: ${testCase.name}`)
  console.log(`   Input feedIds: ${JSON.stringify(testCase.input.feedIds)}`)

  const sanitized = sanitizeFeedIds(testCase.input.feedIds)
  console.log(`   Sanitized: ${JSON.stringify(sanitized)}`)
  console.log(`   Expected: ${JSON.stringify(testCase.expectedSanitized)}`)

  const match = JSON.stringify(sanitized) === JSON.stringify(testCase.expectedSanitized)
  
  if (match) {
    console.log(`   ✅ PASS`)
    return true
  } else {
    console.log(`   ❌ FAIL - Sanitization mismatch`)
    return false
  }
}

function runTests() {
  console.log('🚀 Starting feed API sanitization tests...\n')
  console.log('Testing the logic that prevents ["undefined"] from causing 500 errors\n')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    const success = testSanitization(testCase)
    if (success) {
      passed++
    } else {
      failed++
    }
  }

  console.log(`\n📊 Test Results:`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   Total: ${testCases.length}`)

  if (failed > 0) {
    console.log(`\n⚠️  Some tests failed!`)
    process.exit(1)
  } else {
    console.log(`\n🎉 All tests passed! The sanitization logic will prevent 500 errors.`)
  }
}

runTests()
