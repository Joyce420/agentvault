import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, validatePolicy, checkPayment } from '../src/policy.js';

test('owner policy changes alter decisions without charging rejected orders', () => {
  const paid = new Set();
  const conservative = validatePolicy(PRESETS.conservative);
  assert.equal(checkPayment({ amount: 2, merchant: 'weather.lab', orderId: 'a' }, conservative, 10, paid), null);
  paid.add('a');
  assert.equal(checkPayment({ amount: 4, merchant: 'weather.lab', orderId: 'b' }, conservative, 8, paid), '超过单笔上限');
  assert.equal(checkPayment({ amount: 2, merchant: 'weather.lab', orderId: 'a' }, conservative, 8, paid), '订单已支付');
  const locked = validatePolicy(PRESETS.locked);
  assert.equal(checkPayment({ amount: 2, merchant: 'weather.lab', orderId: 'c' }, locked, 10, new Set()), '超过单笔上限');
  const other = validatePolicy({ budget: 10, perTx: 3, merchants: ['other.lab'] });
  assert.equal(checkPayment({ amount: 2, merchant: 'weather.lab', orderId: 'd' }, other, 10, new Set()), '商户未授权');
});

test('policy rejects invalid owner input', () => {
  for (const input of [
    { budget: 1, perTx: 2, merchants: ['weather.lab'] },
    { budget: 10, perTx: 3, merchants: [] },
    { budget: 'oops', perTx: 3, merchants: ['weather.lab'] },
    { budget: 0.001, perTx: 0.001, merchants: ['weather.lab'] },
  ]) assert.throws(() => validatePolicy(input));
});
