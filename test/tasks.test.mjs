import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { parseTask, executeTask } from '../service/tasks.mjs';
import { createWeatherMiddleware } from '../service/vite-plugin.mjs';

test('tasks reject unsupported requests and process user content', () => {
  assert.throws(() => parseTask('写一篇小说'), /暂不支持/);
  assert.throws(() => parseTask('查询北京天气'), /上海/);
  assert.throws(() => parseTask('统计字数'), /粘贴/);
  assert.equal(executeTask(parseTask('统计文本字数', '你好 A')).charactersWithoutWhitespace, 3);
  assert.equal(executeTask(parseTask('检查 JSON', '{"ok":true}')).valid, true);
  assert.equal(executeTask(parseTask('检查 JSON', '{bad}')).valid, false);
});

test('task quote binds content to an order and does not deliver on failed verification', async () => {
  let verified = false;
  const api = createWeatherMiddleware({ price: '100', vault: 'vault', merchant: 'merchant', verifyReceipt: async () => { if (!verified) throw new Error('未付款'); } });
  async function request(body) {
    const req = Readable.from([JSON.stringify(body)]); req.url = '/api/task'; req.method = 'POST';
    let status, data;
    const res = { writeHead(value) { status = value; }, end(value) { data = JSON.parse(value); } };
    await api(req, res, () => assert.fail('API was skipped'));
    return { status, data };
  }
  const quote = await request({ task: '统计文本字数', content: 'abc' });
  assert.equal(quote.status, 402);
  const order = quote.data.orderId;
  assert.equal((await request({ tx: 'bad', order })).status, 400);
  verified = true;
  const result = await request({ tx: 'confirmed', order, content: 'changed content' });
  assert.equal(result.data.data.characters, 3);
  assert.equal((await request({ tx: 'confirmed', order })).data.data.characters, 3);
  assert.equal((await request({ tx: 'other', order })).status, 400);
});

async function call(api, body) {
  const req = Readable.from([JSON.stringify(body)]); req.url = '/api/task'; req.method = 'POST';
  let status, data;
  await api(req, { writeHead(v) { status = v; }, end(v) { data = JSON.parse(v); } }, () => assert.fail());
  return { status, data };
}

test('paid task survives server restart and cache expiry without allowing content substitution', async () => {
  let paidOrder;
  const service = { price: '100', vault: 'vault', merchant: 'merchant', verifyReceipt: async (tx, order) => {
    if (tx !== 'confirmed' || order !== paidOrder) throw new Error('未付款');
  } };
  const original = createWeatherMiddleware(service);
  const quote = (await call(original, { task: '统计文本字数', content: '你好 abc' })).data;
  paidOrder = quote.orderId;
  const body = { tx: 'confirmed', order: paidOrder, recovery: quote.recovery };
  const restarted = createWeatherMiddleware(service);
  assert.equal((await call(restarted, { ...body, tx: 'unpaid' })).status, 400);
  assert.equal((await call(restarted, { ...body, recovery: { ...quote.recovery, content: 'changed' } })).status, 400);
  assert.equal((await call(restarted, body)).data.data.characters, 6);
  assert.equal((await call(restarted, body)).data.data.characters, 6);
  const now = Date.now;
  try {
    Date.now = () => now() + 7200000;
    assert.equal((await call(original, body)).data.data.characters, 6);
  } finally { Date.now = now; }
  const lost = await call(restarted, { tx: 'confirmed', order: 'old-order' });
  assert.equal(lost.status, 410);
  assert.equal(lost.data.code, 'ORDER_UNAVAILABLE');
});
