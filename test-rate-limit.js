/**
 * Test script for rate limiting
 * Run with: node test-rate-limit.js
 */

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function testRateLimit(endpoint, data, maxRequests, windowSeconds) {
  console.log(`\n=== Testing ${endpoint} ===`);
  console.log(`Expected limit: ${maxRequests} requests per ${windowSeconds} seconds\n`);

  const results = [];

  // Send requests rapidly
  for (let i = 1; i <= maxRequests + 2; i++) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const endTime = Date.now();
      const duration = endTime - startTime;

      const status = response.status;
      const result = await response.json().catch(() => ({}));

      results.push({ request: i, status, duration, result });

      if (status === 429) {
        console.log(`❌ Request #${i}: Rate limited (429) - ${result.message || 'Too many requests'}`);
      } else if (status >= 400) {
        console.log(`⚠️  Request #${i}: Error (${status}) - ${result.error || result.message || 'Unknown error'}`);
      } else {
        console.log(`✅ Request #${i}: Success (${status}) - ${duration}ms`);
      }

      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`💥 Request #${i}: Failed - ${error.message}`);
      results.push({ request: i, error: error.message });
    }
  }

  // Summary
  const successful = results.filter(r => r.status && r.status < 400).length;
  const rateLimited = results.filter(r => r.status === 429).length;
  const errors = results.filter(r => r.status && r.status >= 400 && r.status !== 429).length;

  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Rate limited: ${rateLimited}`);
  console.log(`  ⚠️  Other errors: ${errors}`);
  console.log(`  Expected behavior: ${maxRequests} successful, ${results.length - maxRequests} rate limited`);

  if (successful === maxRequests && rateLimited === results.length - maxRequests) {
    console.log(`  ✅ PASS - Rate limiting works correctly!`);
  } else {
    console.log(`  ⚠️  UNEXPECTED - Rate limiting behavior differs from expected`);
  }

  return results;
}

async function runTests() {
  console.log('🧪 Rate Limiting Test Suite');
  console.log('============================');
  console.log(`Testing against: ${API_BASE}`);

  // Test data
  const testFingerprint = `test-${Date.now()}`;

  try {
    // Test 1: TTS (lightest endpoint, 30/min)
    await testRateLimit(
      '/api/tts',
      { text: 'Hello world', language: 'English', fingerprintHash: testFingerprint },
      30,
      60
    );

    // Wait a bit before next test
    console.log('\n⏳ Waiting 2 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Generate Question (5/min)
    await testRateLimit(
      '/api/generate-question',
      {
        topicName: 'Test Topic',
        targetLang: 'English',
        nativeLang: 'Chinese',
        level: 'medium',
        fingerprintHash: testFingerprint
      },
      5,
      60
    );

    console.log('\n✅ All tests completed!');
    console.log('\n💡 Note: Some endpoints require authentication or valid data, so you may see errors.');
    console.log('   The important thing is that rate limiting (429 errors) happens at the right threshold.');

  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
  }
}

// Run tests
runTests().catch(console.error);
