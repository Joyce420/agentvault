import './console.css';
import { PRESETS, validatePolicy, checkPayment } from './policy.js';
const $ = id => document.getElementById(id);
const money = value => value.toFixed(2);
let policy = validatePolicy(PRESETS.conservative), remaining = policy.budget, lastOrder = null, orderCount = 2041;
const paid = new Set();
function render() {
  $('stat-budget').textContent = money(remaining);
  $('stat-limit').textContent = money(policy.perTx);
  $('stat-spent').textContent = money(policy.budget - remaining);
  $('total-budget').textContent = money(policy.budget);
  $('paid-count').textContent = paid.size;
  $('budget-progress').max = policy.budget;
  $('budget-progress').value = remaining;
  $('normal-hint').textContent = remaining > 0 ? `${money(normalAmount())} → ${policy.merchants[0]}` : '预算已用完，请重置';
  $('over-hint').textContent = `原因：超过单笔上限 ${money(policy.perTx)}`;
  $('replay-hint').textContent = lastOrder ? '原因：订单已支付' : '需先完成一笔模拟付款';
}
function log(allowed, message, detail = '') {
  const time = new Date().toLocaleTimeString('zh-CN', {hour12:false});
  $('latest-event').textContent = `${time} · ${message}`;
  $('audit-log').querySelector('.empty')?.remove();
  const row = document.createElement('p');
  row.className = allowed === null ? '' : allowed ? 'allow' : 'deny';
  row.textContent = `${time} · ${message}${detail ? ` · ${detail}` : ''}`;
  $('audit-log').prepend(row);
  while ($('audit-log').children.length > 50) $('audit-log').lastElementChild.remove();
}
function select(name) {
  for (const button of document.querySelectorAll('[data-case]')) button.setAttribute('aria-pressed', String(button.dataset.case === name));
}
function decision(state, title, detail) {
  $('pipeline').dataset.state = state;
  $('decision-icon').textContent = state === 'allow' ? '✓' : state === 'deny' ? '✕' : '◇';
  $('decision-title').textContent = title;
  $('decision-detail').textContent = detail;
  $('outbound-symbol').textContent = state === 'deny' ? '⊘' : '→';
}
function ruleStates(values = {}) {
  for (const name of ['merchant','limit','budget','order']) {
    const element = $(`rule-${name}`), result = values[name];
    element.className = result === undefined ? '' : result ? 'pass' : 'fail';
    element.querySelector('b').textContent = result === undefined ? '—' : result ? '✓' : '✕';
  }
}
function run(amount, merchant, orderId) {
  const reason = checkPayment({amount,merchant,orderId}, policy, remaining, paid);
  ruleStates({merchant:policy.merchants.includes(merchant),limit:amount <= policy.perTx,budget:amount > 0 && amount <= remaining,order:!paid.has(orderId)});
  $('request-amount').textContent = money(amount);
  $('request-merchant').textContent = merchant;
  $('merchant-name').textContent = merchant;
  if (!reason) { remaining = Math.round((remaining - amount)*100)/100; paid.add(orderId); lastOrder = {amount,merchant,orderId}; }
  const description = reason === '超过单笔上限' ? `${money(amount)} 超过单笔上限 ${money(policy.perTx)}` : reason;
  decision(reason ? 'deny' : 'allow', reason ? `模拟拦截：${description}` : `模拟放行：${money(amount)} 模拟额度`, reason ? `命中规则：${description} · 未扣模拟额度 · 剩余 ${money(remaining)}` : `四项规则均通过 · 已扣模拟额度 ${money(amount)} · 剩余 ${money(remaining)}`);
  $('merchant-status').textContent = reason ? '未执行' : '模拟收款成功';
  log(!reason, reason ? `模拟拦截：${description}` : `模拟放行：${money(amount)}`, `${merchant} · ${orderId} · 剩余 ${money(remaining)}`);
  const selected = document.querySelector('[data-case][aria-pressed="true"] .expect');
  if (selected) { selected.textContent = reason ? '✕ 模拟拦截' : '✓ 模拟放行'; selected.className = `expect ${reason ? 'deny' : 'allow'}`; }
  render();
}
const normalAmount = () => Math.min(Math.round(policy.perTx * 60)/100, remaining);
const nextOrder = () => `order_${orderCount++}`;
function unknownMerchant() { let name='unverified.service', i=2; while(policy.merchants.includes(name)) name=`unverified-${i++}.service`; return name; }
$('btn-normal').addEventListener('click',()=>{select('normal');run(normalAmount(),policy.merchants[0],nextOrder());});
$('btn-overcap').addEventListener('click',()=>{select('overcap');run(policy.perTx+1,policy.merchants[0],nextOrder());});
$('btn-unknown').addEventListener('click',()=>{select('unknown');run(Math.min(Math.round(policy.perTx*50)/100,remaining),unknownMerchant(),nextOrder());});
$('btn-replay').addEventListener('click',()=>{
  select('replay');
  if(lastOrder) return run(lastOrder.amount,lastOrder.merchant,lastOrder.orderId);
  $('btn-replay').querySelector('.expect').textContent = '待测试：需成功订单';
  ruleStates(); $('request-amount').textContent='—'; $('request-merchant').textContent='尚无成功订单'; $('merchant-status').textContent='未执行';
  decision('idle','还没有可重放的订单','请先点击「正常付款」，再测试重复订单。未扣款。');
  log(false,'未发起请求：需先有成功订单');
});
function reset() {
  remaining=policy.budget; paid.clear();lastOrder=null;orderCount=2041;
  for (const button of document.querySelectorAll('[data-case]')) { const badge = button.querySelector('.expect'); const normal = button.dataset.case === 'normal'; badge.textContent = normal ? '预期放行' : '预期拦截'; badge.className = `expect ${normal ? 'allow' : 'deny'}`; }
  select('');ruleStates();decision('idle','等待付款请求','先试正常付款，再看看规则如何拦截。');
  $('request-amount').textContent='—';$('request-merchant').textContent='选择下方场景开始';$('merchant-name').textContent=policy.merchants[0];$('merchant-status').textContent='等待中';
  render();
}
$('btn-reset').addEventListener('click',()=>{reset();log(null,'会话已重置');});
for(const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click',()=>{
  const p=PRESETS[button.dataset.preset];$('policy-budget').value=p.budget;$('policy-limit').value=p.perTx;$('policy-merchants').value=p.merchants.join(', ');
  $('policy-error').className='';$('policy-error').textContent='预设已填入，点击“应用规则”后生效。';
});
$('policy-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {
    policy=validatePolicy({budget:$('policy-budget').value,perTx:$('policy-limit').value,merchants:$('policy-merchants').value.split(',')});
    reset();$('policy-error').className='';$('policy-error').textContent='模拟规则已生效，会话已重置。不会修改 Fuji 链上合约。';
    log(null,'规则已更新',`预算 ${money(policy.budget)} · 上限 ${money(policy.perTx)} · 商户 ${policy.merchants.join(', ')}`);
  }catch(error){$('policy-error').className='error';$('policy-error').textContent=`未应用：${error.message}`;}
});
$('fixed-form').addEventListener('submit',event=>{
  event.preventDefault();const amount=Number($('fixed-amount').value);select('');
  if(!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>1e-7){decision('idle','请输入有效金额','金额须大于零且最多两位小数，未发起请求。');return;}
  run(amount,'weather.lab',nextOrder());
});
reset();
