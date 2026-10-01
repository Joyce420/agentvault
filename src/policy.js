export const PRESETS = {
  conservative: { budget: 10, perTx: 3, merchants: ['weather.lab'] },
  relaxed: { budget: 20, perTx: 8, merchants: ['weather.lab'] },
  locked: { budget: 10, perTx: 1, merchants: ['weather.lab'] },
};
export function validatePolicy(raw) {
  const budget = Number(raw.budget), perTx = Number(raw.perTx);
  if (!Number.isFinite(budget) || !Number.isFinite(perTx) || budget <= 0 || perTx <= 0 || Math.abs(budget * 100 - Math.round(budget * 100)) > 1e-7 || Math.abs(perTx * 100 - Math.round(perTx * 100)) > 1e-7) throw new Error('预算和单笔上限须为大于零、最多两位小数的有效数字');
  if (perTx > budget) throw new Error('单笔上限不能超过会话预算');
  const merchants = [...new Set(raw.merchants.map(x => x.trim()).filter(Boolean))];
  if (!merchants.length) throw new Error('白名单至少保留一位商户');
  if (merchants.some(x => !/^[a-zA-Z0-9.-]{1,64}$/.test(x))) throw new Error('商户名称只能使用字母、数字、点和连字符');
  return { budget, perTx, merchants };
}
export function checkPayment({ amount, merchant, orderId }, policy, remaining, paidOrders) {
  if (paidOrders.has(orderId)) return '订单已支付';
  if (!policy.merchants.includes(merchant)) return '商户未授权';
  if (amount > policy.perTx) return '超过单笔上限';
  if (amount <= 0 || amount > remaining) return '剩余预算不足';
  return null;
}
