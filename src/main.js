import './generated.css';
import { PRESETS, validatePolicy, checkPayment } from './policy.js';

const $ = id => document.getElementById(id);
const money = value => value.toFixed(2);
let policy = validatePolicy(PRESETS.conservative);
let remaining = policy.budget;
let lastOrder = null;
let orderCount = 2041;
const paid = new Set();

function line(result, amount, merchant, orderId, reason) {
  const row = document.createElement('p');
  row.className = `font-mono text-xs break-all py-2 border-b border-[#1f3a4d] ${result === 'ALLOW' ? 'text-[#4ade80]' : result === 'REVERT' ? 'text-[#fb7185]' : 'text-[#38bdf8]'}`;
  row.textContent = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${result} ${amount} ${merchant} ${orderId} ${reason}`;
  if ($('audit-empty-state')) $('audit-empty-state').remove();
  $('audit-log-container').prepend(row);
}
function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}
function showFixedResult(message, allowed) {
  const result = $('fixed-result');
  result.textContent = message;
  result.className = `rounded border px-3 py-2 text-sm font-semibold ${allowed ? 'border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80]' : 'border-[#fb7185] bg-[#fb7185]/10 text-[#fb7185]'}`;
}
function render() {
  $('stat-vault').textContent = money(remaining);
  $('stat-budget').textContent = money(remaining);
  $('stat-limit').textContent = money(policy.perTx);
  $('current-merchants').textContent = policy.merchants.join(', ');
  $('gate-limit').textContent = `≤ ${money(policy.perTx)} 演示单位`;
  $('gate-merchants').textContent = `仅限白名单商户 (${policy.merchants.join(', ')})`;
  $('merchant-name').textContent = policy.merchants[0];
  const normal = Math.min(Math.round(policy.perTx * 60) / 100, remaining);
  const over = policy.perTx + 1;
  const unknown = Math.min(Math.round(policy.perTx * 50) / 100, remaining);
  document.querySelector('.vector-unknown-merchant').textContent = unknownMerchant();
  setText('#btn-normal .vector-amount', `${money(normal)} 单位`);
  setText('#btn-normal .vector-description', `金额 ${money(normal)}，当前白名单商户，预期放款`);
  setText('#btn-normal .vector-merchant', policy.merchants[0]);
  setText('#btn-overcap .vector-amount', `${money(over)} 单位`);
  setText('#btn-overcap .vector-description', `${money(over)} > ${money(policy.perTx)}，预期拦截`);
  setText('#btn-overcap .vector-comparison', `${money(over)} > ${money(policy.perTx)}`);
  setText('#btn-unknown .vector-amount', `${money(unknown)} 单位`);
  $('replay-order-tag').textContent = lastOrder?.orderId || '需先有成功订单';
  $('replay-target-text').textContent = lastOrder ? `重放 ${lastOrder.orderId}` : '无历史订单';
  $('btn-replay').disabled = false;
}
function run(amount, merchant, orderId, showNearButton = false) {
  if (!showNearButton) {
    $('fixed-result').className = 'hidden rounded border px-3 py-2 text-sm font-semibold';
    $('fixed-result').textContent = '';
  }
  const reason = checkPayment({ amount, merchant, orderId }, policy, remaining, paid);
  $('node-agent-intent').textContent = `${money(amount)} → ${merchant}`;
  $('gate-banner').textContent = reason ? `模拟拦截：${reason}` : '模拟规则检查通过';
  $('wire-status-text').textContent = reason ? 'REVERT · 模拟判定' : 'ALLOW · 模拟判定';
  $('merchant-status-badge').textContent = reason ? '未收到款项' : '模拟收款成功';
  $('feedback-text').textContent = reason ? `${reason}；没有扣除演示额度` : `通过当前模拟政策，扣除 ${money(amount)} 演示单位`;
  if (!reason) {
    remaining = Math.round((remaining - amount) * 100) / 100;
    paid.add(orderId);
    lastOrder = { amount, merchant, orderId };
  }
  if (showNearButton) showFixedResult(reason
    ? `模拟付款被拦截：${reason}。未扣额度，剩余 ${money(remaining)}。`
    : `模拟付款已允许：扣除 ${money(amount)}，剩余 ${money(remaining)}。`, !reason);
  line(reason ? 'REVERT' : 'ALLOW', money(amount), merchant, orderId, reason || '当前政策通过');
  render();
}
function nextOrder() { return `order_${orderCount++}`; }
function unknownMerchant() {
  let merchant = 'unverified.service';
  let suffix = 2;
  while (policy.merchants.includes(merchant)) merchant = `unverified-${suffix++}.service`;
  return merchant;
}
$('btn-normal').addEventListener('click', () => run(Math.min(Math.round(policy.perTx * 60) / 100, remaining), policy.merchants[0], nextOrder()));
$('btn-overcap').addEventListener('click', () => run(policy.perTx + 1, policy.merchants[0], nextOrder()));
$('btn-unknown').addEventListener('click', () => {
  const merchant = unknownMerchant();
  run(Math.min(Math.round(policy.perTx * 50) / 100, remaining), merchant, nextOrder());
});
$('btn-replay').addEventListener('click', () => {
  if (!lastOrder) return line('REVERT', '—', '—', '—', '需先有成功订单');
  run(lastOrder.amount, lastOrder.merchant, lastOrder.orderId);
});
$('btn-fixed').addEventListener('click', () => {
  const amount = Number($('fixed-amount').value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    showFixedResult('请输入大于零、最多两位小数的金额；未发起模拟付款。', false);
    return line('REVERT', '—', 'weather.lab', '—', '请输入大于零、最多两位小数的金额');
  }
  run(amount, 'weather.lab', nextOrder(), true);
});
function resetSession() {
  remaining = policy.budget;
  paid.clear(); lastOrder = null; orderCount = 2041;
  $('gate-banner').textContent = '等待付款请求';
  $('wire-status-text').textContent = '等待付款请求';
  $('node-agent-intent').textContent = '空闲中';
  $('merchant-status-badge').textContent = '等待中';
  $('feedback-text').textContent = '选择测试操作以检查当前模拟政策';
  $('fixed-result').className = 'hidden rounded border px-3 py-2 text-sm font-semibold';
  $('fixed-result').textContent = '';
  render();
}
$('btn-reset').addEventListener('click', () => { resetSession(); line('SESSION_RESET', '—', '—', '—', '模拟会话已重置'); });
function syncForm() {
  $('policy-budget').value = policy.budget;
  $('policy-limit').value = policy.perTx;
  $('policy-merchants').value = policy.merchants.join(', ');
}
for (const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click', () => {
  const selected = PRESETS[button.dataset.preset];
  $('policy-budget').value = selected.budget;
  $('policy-limit').value = selected.perTx;
  $('policy-merchants').value = selected.merchants.join(', ');
  $('policy-error').textContent = '预设已填入；点击“应用模拟政策”才会生效。';
});
$('apply-policy').addEventListener('click', () => {
  try {
    const next = validatePolicy({ budget: $('policy-budget').value, perTx: $('policy-limit').value, merchants: $('policy-merchants').value.split(',') });
    policy = next; resetSession();
    $('policy-error').textContent = '模拟政策已生效；不会修改 Fuji 合约。';
    line('POLICY_UPDATED', `budget=${money(policy.budget)}`, `perTx=${money(policy.perTx)}`, `merchants=${policy.merchants.join(',')}`, '模拟政策已更新');
  } catch (error) { $('policy-error').textContent = `未应用：${error.message}`; }
});
syncForm(); render();
