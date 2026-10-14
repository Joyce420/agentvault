import './console.css';
import './purchase.css';
import { BrowserProvider, Contract, formatEther, getAddress } from 'ethers';
import artifact from './contract-artifact.json';

const $ = key => document.getElementById(key);
const explorer = 'https://explorer-test.avax.network/c-chain';
let context;
let purchasing = false;
let planning = false;
let pendingDelivery;
let receiving = false;

function step(message) {
  const item = document.createElement('li');
  item.textContent = message;
  if ($('steps').firstElementChild?.textContent === '等待任务。') $('steps').replaceChildren();
  $('steps').append(item);
  $('latest-step').textContent = message;
}

function reset() {
  $('steps').replaceChildren();
  $('receipt').textContent = '尚无付款交易';
  $('latest-step').textContent = '等待任务';
  $('result').textContent = '付款并通过链上验证后显示数据。';
  $('pay').disabled = true;
  $('result-summary').hidden = true;
  $('result-summary').replaceChildren();
  $('delivery-state').textContent = '尚未购买服务。';
  context = null;
  $('empty-delivery').hidden = false;
  $('result-heading').textContent = '服务交付';
  $('quote-price').textContent = '—';
  $('quote-limit').textContent = '—';
  $('quote-budget').textContent = '—';
  $('rule-status').textContent = '尚未检查';
  setStage(1, '◇ 等待任务');
}

async function ensureFuji() {
  if (!window.ethereum) throw new Error('未检测到 MetaMask 或 Core Wallet。');
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa869' }] });
  const provider = new BrowserProvider(window.ethereum);
  if ((await provider.getNetwork()).chainId !== 43113n) throw new Error('请切换到 Fuji 测试网。');
  return provider;
}

async function plan() {
  if (planning || purchasing || pendingDelivery) return;
  planning = true;
  reset();
  setStage(2, '◷ 正在检查');
  $('plan').disabled = true;
  for (const key of ['task', 'content']) $(key).disabled = true;
  try {
    step(`收到用户任务：${$('task').value.trim() || '未填写'}`);
    const vault = getAddress($('address').value.trim());
    step('Agent 根据任务匹配实用工具。');
    const response = await fetch('/api/task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: $('task').value, content: $('content').value }) });
    const quote = await response.json();
    if (response.status !== 402) throw new Error(quote.error || '任务无法处理。');
    $('quote').textContent = `任务：${quote.task} · 服务：${quote.description} · 报价：${formatEther(BigInt(quote.amountWei))} 测试 AVAX`;
    if (response.status !== 402 || quote.chainId !== 43113 || quote.asset !== 'AVAX') throw new Error('服务没有返回支持的 Fuji 测试付款要求。');
    if (getAddress(quote.vault) !== vault) throw new Error('服务指定的保险箱与你输入的不一致。');
    const merchant = getAddress(quote.merchant);
    const amount = BigInt(quote.amountWei);
    $('quote-price').textContent = formatEther(amount);
    step(`服务要求 ${formatEther(amount)} 测试 AVAX，收款地址 ${merchant}。`);
    const provider = await ensureFuji();
    if (await provider.getCode(vault) === '0x') throw new Error('该地址在 Fuji 上没有合约。');
    const signer = await provider.getSigner();
    const contract = new Contract(vault, artifact.abi, signer);
    const account = await signer.getAddress();
    if ((await contract.agent()).toLowerCase() !== account.toLowerCase()) throw new Error('当前钱包不是合约授权 Agent。');
    if (!(await contract.merchants(merchant))) throw new Error('服务商不在合约白名单。');
    const remaining = (await contract.budget()) - (await contract.spent());
    const limit = await contract.perPaymentLimit();
    $('quote-limit').textContent = `${formatEther(limit)} 测试 AVAX`;
    $('quote-budget').textContent = `${formatEther(remaining)} 测试 AVAX`;
    if (amount > limit || amount > remaining || amount > (await provider.getBalance(vault))) {
      throw new Error('价格超出单笔上限、剩余预算或金库余额。');
    }
    const orderId = quote.orderId;
    await contract.pay.staticCall(orderId, merchant, amount);
    step(`AgentVault 合约规则预检查通过：商户在白名单内，价格未超过单笔上限及剩余预算 ${formatEther(remaining)} 测试 AVAX。等待你在钱包中确认付款。`);
    context = { contract, orderId, merchant, amount, vault, account, recovery: quote.recovery };
    $('pay').disabled = false;
    $('rule-status').textContent = '✓ 预检查通过';
    setStage(3, '◇ 等待钱包确认');
  } catch (error) { $('rule-status').textContent = '未通过 / 未完成'; setStage(2, '检查未完成', true); step(`已停止，未发起付款交易：${error.shortMessage || error.message}`); }
  finally { planning = false; $('plan').disabled = false; for (const key of ['task', 'content']) $(key).disabled = false; }
}

async function pay() {
  if (!context || purchasing) return;
  purchasing = true;
  setStage(3, '◷ 等待钱包确认');
  $('plan').disabled = true;
  for (const key of ['task', 'content']) $(key).disabled = true;
  $('pay').disabled = true;
  const { contract, orderId, merchant, amount, account, recovery } = context;
  try {
    if ((await contract.runner.getAddress()).toLowerCase() !== account.toLowerCase()) throw new Error('钱包账号已变更，请重新检查请求。');
    // Refuse to send a payment unless recovery data can be saved first.
    localStorage.setItem('agentvault.pendingDelivery', JSON.stringify({ order: orderId, recovery }));
    const tx = await contract.pay(orderId, merchant, amount);
    pendingDelivery = { tx: tx.hash, order: orderId, recovery };
    try { localStorage.setItem('agentvault.pendingDelivery', JSON.stringify(pendingDelivery)); } catch { step('浏览器未能保存交易号，请保留当前页面和交易凭证。'); }
    showReceipt(tx.hash);
    setStage(3, '◷ 交易已发送，等待确认');
    $('retry').hidden = false;
    step(`已发送付款交易 ${tx.hash}，等待 Fuji 确认。`);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('付款交易未成功。');
    step('付款成功。Agent 将交易证明交给服务端核验。');
    await receiveResult();
  } catch (error) { setStage(3, pendingDelivery ? '交易状态待核验' : '付款未完成', true); step(error.shortMessage || error.message); }
  finally { context = null; purchasing = false; $('plan').disabled = Boolean(pendingDelivery); for (const key of ['task', 'content']) $(key).disabled = false; }
}

$('address').value = '0x7fb5fcE5542dB70030d6d77788d3a46d2be9C27D';
$('plan').addEventListener('click', plan);
$('pay').addEventListener('click', pay);
window.ethereum?.on?.('accountsChanged', () => { if (purchasing || pendingDelivery) return; reset(); step('钱包账号已变更，请重新检查购买请求。'); });
window.ethereum?.on?.('chainChanged', () => { if (planning || purchasing || pendingDelivery) return; reset(); step('网络已变更，请重新检查购买请求。'); });

for (const key of ['task', 'content']) $(key).addEventListener('input', () => { if (pendingDelivery) return; reset(); $('quote').textContent = '任务已修改，请重新检查服务与报价。'; });
for (const button of document.querySelectorAll('.sample')) button.addEventListener('click', () => {
  if (planning || purchasing || pendingDelivery) return;
  const samples = {
    weather: ['查询上海天气', ''],
    text: ['统计文本字数', 'AgentVault 让 Agent 支付，但不能越权。'],
    json: ['检查 JSON 是否合法', '{"project":"AgentVault","network":"Fuji"}'],
  };
  for (const sample of document.querySelectorAll('.sample')) sample.setAttribute('aria-pressed', String(sample === button));
  [$('task').value, $('content').value] = samples[button.dataset.sample];
  reset();
  $('quote').textContent = '样例已填入。点击“① 获取报价并检查规则”继续。';
});

function renderResult(data) {
  $('result').textContent = JSON.stringify(data, null, 2);
  const container = $('result-summary');
  container.replaceChildren(); container.hidden = false;
  $('empty-delivery').hidden = true;
  container.className = typeof data.characters === 'number' ? 'result-metrics' : 'result-text';
  $('result-heading').textContent = typeof data.characters === 'number' ? '文本统计结果' : typeof data.valid === 'boolean' ? 'JSON 检查结果' : '天气样例';
  const add = (label, value) => {
    const row = document.createElement('p');
    if (typeof value === 'number') {
      const title = document.createElement('span'); title.textContent = label.replace('：', '');
      const number = document.createElement('strong'); number.textContent = value;
      row.append(title, number);
    } else { row.textContent = `${label}${value}`; }
    container.append(row);
  };
  if (typeof data.characters === 'number') {
    add('总字符数：', data.characters);
    add('不含空白字符：', data.charactersWithoutWhitespace);
    add('行数：', data.lines);
  } else if (typeof data.valid === 'boolean') {
    add('检查结果：', data.valid ? 'JSON 格式正确' : 'JSON 格式有误');
    add('', data.valid ? data.formatted : data.message);
  } else { add('上海天气样例：', `${data.outlook}，${data.temperatureC}°C`); add('', data.note); }
}
fetch('/api/capabilities').then(response => response.json()).then(data => {
  if (!planning && !purchasing) $('address').value = getAddress(data.vault);
}).catch(() => {});

async function receiveResult() {
  if (!pendingDelivery || receiving) return;
  receiving = true; $('retry').disabled = true;
  try {
    const response = await fetch('/api/task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pendingDelivery) });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error || '暂时无法领取结果'), { terminal: ['ORDER_UNAVAILABLE', 'INVALID_RECOVERY'].includes(body.code) });
    renderResult(body.data);
    setStage(4, '✓ 已交付');
    $('delivery-state').textContent = '付款已确认 · 验链通过 · 结果已交付';
    step('服务端已核验付款事件、商户、金额和订单，返回服务结果。');
    try { localStorage.removeItem('agentvault.pendingDelivery'); sessionStorage.removeItem('agentvault.pendingDelivery'); } catch {}
    pendingDelivery = null; $('retry').hidden = true; $('plan').disabled = false;
  } catch (error) {
    setStage(3, '结果尚未领取', true);
    $('delivery-state').textContent = `结果尚未领取：${error.message}${error.terminal ? '' : ' 可重试领取，不要再次付款。'}`;
    $('retry').hidden = Boolean(error.terminal);
    step($('delivery-state').textContent);
  } finally { receiving = false; $('retry').disabled = false; }
}
$('retry').addEventListener('click', receiveResult);

function showReceipt(hash) {
  const a = document.createElement('a');
  a.href = `${explorer}/tx/${hash}`;
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.className = 'text-primary underline'; a.textContent = '查看 Fuji 付款交易';
  $('receipt').replaceChildren(a);
}
try {
  const saved = JSON.parse(localStorage.getItem('agentvault.pendingDelivery') || sessionStorage.getItem('agentvault.pendingDelivery'));
  if (/^0x[0-9a-f]{64}$/i.test(saved?.tx) && /^0x[0-9a-f]{64}$/i.test(saved?.order)) {
    setStage(3, '发现待领取交易');
    pendingDelivery = saved; $('retry').hidden = false; $('plan').disabled = true;
    showReceipt(saved.tx);
    if (saved.recovery) { $('task').value = saved.recovery.task; $('content').value = saved.recovery.content; }
    $('delivery-state').textContent = '发现尚未领取结果的交易，请先重试领取，不要重复付款。';
  }
} catch {}

function setStage(stage, label, error = false) {
  for (const item of document.querySelectorAll('[data-stage]')) {
    const n = Number(item.dataset.stage);
    item.className = n < stage ? 'done' : n === stage ? 'active' : '';
    if (n === stage) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
  }
  $('delivery-badge').textContent = label;
  $('delivery-badge').className = `delivery-badge ${error ? 'issue' : stage === 4 ? 'complete' : ''}`;
}
