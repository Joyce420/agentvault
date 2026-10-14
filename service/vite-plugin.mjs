import { createWeatherService } from './weather.mjs';
import { randomBytes, createHash } from 'node:crypto';
import { parseTask, executeTask } from './tasks.mjs';

// The on-chain order commits to the complete task. Recovery needs no server secret
// or ephemeral disk, and changing content produces a different unpaid order.
function recoveryOrder(recovery, service) {
  if (recovery?.version !== 1 || !/^[a-f0-9]{64}$/.test(recovery.nonce || '')) throw new Error('订单恢复资料无效');
  const job = parseTask(recovery.task, recovery.content);
  const canonical = JSON.stringify(['agentvault-task-v1', 43113, service.vault.toLowerCase(), service.merchant.toLowerCase(), service.price, recovery.nonce, job]);
  return { order: `0x${createHash('sha256').update(canonical).digest('hex')}`, job };
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createWeatherMiddleware(service = createWeatherService()) {
  const jobs = new Map();
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/capabilities') {
      if (req.method !== 'GET') return send(res, 405, { error: '只支持 GET' });
      return send(res, 200, { vault: service.vault });
    }
    if (url.pathname === '/api/task') {
      if (req.method !== 'POST') return send(res, 405, { error: '只支持 POST' });
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk.toString();
          if (Buffer.byteLength(raw) > 65536) return send(res, 413, { error: '任务内容过长' });
        }
        const input = JSON.parse(raw);
        const now = Date.now();
        for (const [key, job] of jobs) if (job.expires < now) jobs.delete(key);
        if (input.tx) {
          let job = jobs.get(input.order);
          if (!job && input.recovery) {
            const restored = recoveryOrder(input.recovery, service);
            if (restored.order !== input.order) return send(res, 400, { code: 'INVALID_RECOVERY', error: '恢复资料与付款订单不匹配，请保留原始资料和交易凭证。' });
            job = { ...restored.job, recoverable: true };
          }
          if (!job) return send(res, 410, { code: 'ORDER_UNAVAILABLE', error: '旧版订单任务已丢失或过期，无法自动恢复。请保留交易凭证，不要再次付款；重复领取无法修复此订单。' });
          if (job.delivery) {
            if (job.tx !== input.tx) return send(res, 400, { error: '交易与已交付订单不一致。' });
            return send(res, 200, { data: job.delivery });
          }
          if (job.verifying) return send(res, 409, { error: '订单正在验证，请稍后重试领取，无需再次付款。' });
          job.verifying = true;
          try {
            const data = executeTask(job);
            await (job.recoverable ? service.verifyReceipt : service.report)(input.tx, input.order);
            job.tx = input.tx;
            job.delivery = data;
            return send(res, 200, { data });
          } finally { job.verifying = false; }
        }
        if (jobs.size >= 1000) return send(res, 503, { error: '服务繁忙，请稍后再试。' });
        const job = parseTask(input.task, input.content);
        const recovery = { version: 1, nonce: randomBytes(32).toString('hex'), task: input.task, content: input.content || '' };
        const { order: orderId } = recoveryOrder(recovery, service);
        jobs.set(orderId, { ...job, recoverable: true, expires: now + 60 * 60 * 1000 });
        return send(res, 402, { chainId: 43113, asset: 'AVAX', amountWei: service.price, vault: service.vault, merchant: service.merchant, orderId, recovery, description: job.description, task: job.task });
      } catch (error) { return send(res, 400, { error: error.message || '任务处理失败' }); }
    }
    if (url.pathname !== '/api/weather') return next();
    if (req.method !== 'GET') return send(res, 405, { error: '只支持 GET' });
    const txHash = url.searchParams.get('tx');
    const orderId = url.searchParams.get('order');
    if (!txHash || !orderId) {
      return send(res, 402, {
        error: 'Payment Required',
        chainId: 43113,
        asset: 'AVAX',
        amountWei: service.price,
        vault: service.vault,
        merchant: service.merchant,
        description: '上海天气样例数据',
      });
    }
    try { return send(res, 200, { data: await service.report(txHash, orderId) }); }
    catch (error) { return send(res, 403, { error: error.message || '付款凭证验证失败' }); }
  };
}

export function weatherServicePlugin() {
  const middleware = createWeatherMiddleware();
  return {
    name: 'agentvault-weather-demo',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
