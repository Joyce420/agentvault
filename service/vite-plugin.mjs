import { createWeatherService } from './weather.mjs';

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function weatherServicePlugin() {
  const service = createWeatherService();
  const middleware = async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
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
  return {
    name: 'agentvault-weather-demo',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
