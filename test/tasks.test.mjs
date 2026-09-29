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
  const api = createWeatherMiddleware({ price: '100', vault: 'vault', merchant: 'merchant', report: async () => { if (!verified) throw new Error('未付款'); } });
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
  assert.equal((await request({ tx: 'confirmed', order })).status, 400);
});
