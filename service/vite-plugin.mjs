import { createWeatherService } from './weather.mjs';
import { randomBytes } from 'node:crypto';
import { parseTask, executeTask } from './tasks.mjs';

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createWeatherMiddleware(service = createWeatherService()) {
  const jobs = new Map();
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
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
          const job = jobs.get(input.order);
          if (!job) return send(res, 400, { error: '任务不存在或已过期，请勿再次付款，保留交易凭证。' });
          await service.report(input.tx, input.order);
          jobs.delete(input.order);
          return send(res, 200, { data: executeTask(job) });
        }
        const job = parseTask(input.task, input.content);
        if (jobs.size >= 1000) return send(res, 503, { error: '服务繁忙，请稍后再试。' });
        const orderId = `0x${randomBytes(32).toString('hex')}`;
        jobs.set(orderId, { ...job, expires: now + 60 * 60 * 1000 });
        return send(res, 402, { chainId: 43113, asset: 'AVAX', amountWei: service.price, vault: service.vault, merchant: service.merchant, orderId, description: job.description, task: job.task });
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
