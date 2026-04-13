const { describe, it } = require('node:test');
const assert = require('node:assert');

const { logger, createChildLogger, trace, debug, info, warn, error } = require('../../lib/logger');

describe('Logger', () => {
  it('should export logger instance', () => {
    assert.ok(logger, 'logger should be defined');
    assert.strictEqual(typeof logger.info, 'function');
    assert.strictEqual(typeof logger.error, 'function');
    assert.strictEqual(typeof logger.warn, 'function');
  });

  it('should export log level functions', () => {
    assert.strictEqual(typeof trace, 'function');
    assert.strictEqual(typeof debug, 'function');
    assert.strictEqual(typeof info, 'function');
    assert.strictEqual(typeof warn, 'function');
    assert.strictEqual(typeof error, 'function');
  });

  it('should create child logger with context', () => {
    const child = createChildLogger({ requestId: 'test-123' });
    assert.ok(child, 'child logger should be defined');
    assert.strictEqual(typeof child.info, 'function');
  });

  it('should log without throwing', () => {
    assert.doesNotThrow(() => {
      info({ msg: 'test info log' });
      debug({ msg: 'test debug log' });
      warn({ msg: 'test warn log' });
      error({ msg: 'test error log' });
    });
  });
});
