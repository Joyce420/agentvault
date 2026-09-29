import './generated.css';
import { BrowserProvider, Contract, formatEther, getAddress, id } from 'ethers';
import artifact from './contract-artifact.json';

const FUJI_ID = '0xa869';
const explorer = 'https://explorer-test.avax.network/c-chain';
const $ = key => document.getElementById(key);
const buttons = [...document.querySelectorAll('.action')];
let provider;
let contract;
let signer;
let merchant;
let maxPayment;
let lastPaidOrder;
let busy = false;

const status = message => { $('status').textContent = message; };
const short = amount => `${Number(formatEther(amount)).toFixed(6)} 测试 AVAX`;
const errorText = error => error.reason || error.revert?.args?.[0] || error.shortMessage || error.message || '未知错误';
const setButtons = () => {
  for (const button of buttons) button.disabled = busy || !contract || (button.dataset.action === 'replay' && !lastPaidOrder);
};

async function readContract() {
  const address = await contract.getAddress();
  const [balance, budget, spent, limit] = await Promise.all([
    provider.getBalance(address), contract.budget(), contract.spent(), contract.perPaymentLimit(),
  ]);
  maxPayment = limit;
  $('balance').textContent = short(balance);
  $('budget').textContent = short(budget - spent);
  $('limit').textContent = short(limit);
  const allowed = await contract.merchants(merchant);
  $('merchant-note').textContent = `收款商户：${merchant} · ${allowed ? '已加入白名单' : '尚未加入白名单'}`;
  setButtons();
}

async function connect() {
  if (!window.ethereum) throw new Error('未检测到浏览器钱包，请用安装了 MetaMask 或 Core Wallet 的浏览器打开。');
  const address = getAddress($('address').value.trim());
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: FUJI_ID }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: FUJI_ID, chainName: 'Avalanche Fuji C-Chain', nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'], blockExplorerUrls: [explorer] }] });
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: FUJI_ID }] });
  }
  provider = new BrowserProvider(window.ethereum);
  if ((await provider.getNetwork()).chainId !== 43113n) throw new Error('钱包当前不是 Fuji 测试网。');
  if (await provider.getCode(address) === '0x') throw new Error('该地址在 Fuji 上没有合约。请先使用部署页面。');
  signer = await provider.getSigner();
  contract = new Contract(address, artifact.abi, signer);
  const owner = await contract.owner();
  const agent = await contract.agent();
  const account = await signer.getAddress();
  merchant = localStorage.getItem(`agentvault.fuji.merchant.${address.toLowerCase()}`) || account;
  $('wallet').textContent = `钱包 ${account} · 所有者 ${owner} · Agent ${agent}`;
  lastPaidOrder = localStorage.getItem(`agentvault.fuji.lastPaid.${address.toLowerCase()}`);
  await readContract();
  status(account.toLowerCase() === agent.toLowerCase() ? '已连接真实 Fuji 合约。' : '当前钱包不是授权 Agent，只能读取状态。付款会被合约拒绝。');
  window.ethereum.on?.('accountsChanged', () => location.reload());
  window.ethereum.on?.('chainChanged', () => location.reload());
}

function showTransaction(hash, orderId) {
  const result = $('receipt');
  result.replaceChildren();
  const a = document.createElement('a');
  a.href = `${explorer}/tx/${hash}`;
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.className = 'text-primary underline';
  a.textContent = `查看 Fuji 交易 ${hash}`;
  result.append(document.createTextNode(`订单 ${orderId} · `), a);
}

async function pay(action) {
  if (!contract || busy) return;
  busy = true; setButtons();
  $('receipt').replaceChildren();
  const address = await contract.getAddress();
  const amount = action === 'overcap' ? maxPayment + 1n : maxPayment / 2n;
  const target = action === 'unknown' ? '0x000000000000000000000000000000000000dead' : merchant;
  const orderId = action === 'replay' ? lastPaidOrder : id(`agentvault-${address}-${Date.now()}-${Math.random()}`);
  try {
    status(`正在让 Fuji 合约预检查：${action}……`);
    await contract.pay.staticCall(orderId, target, amount);
    if (action !== 'normal') {
      status('预检查意外通过。为避免误付款，未提交交易。');
      return;
    }
    status('规则检查通过。请在钱包中确认测试 AVAX 付款交易。');
    const tx = await contract.pay(orderId, target, amount);
    showTransaction(tx.hash, orderId);
    status('交易已发送，等待 Fuji 确认……');
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('交易在链上被拒绝。');
    lastPaidOrder = orderId;
    localStorage.setItem(`agentvault.fuji.lastPaid.${address.toLowerCase()}`, orderId);
    await readContract();
    status(`付款成功：${short(amount)}。可打开上面的区块浏览器链接查看真实交易。`);
  } catch (error) {
    if (action === 'normal') status(`付款未完成：${errorText(error)}`);
    else status(`合约预检查拒绝了${action === 'overcap' ? '超额付款' : action === 'unknown' ? '非白名单商户' : '重复订单'}：${errorText(error)}。未发送交易，也未扣除测试 AVAX。`);
    await readContract().catch(() => {});
  } finally {
    busy = false; setButtons();
  }
}

$('address').value = localStorage.getItem('agentvault.fuji.address') || '';
$('connect').addEventListener('click', async () => {
  try { await connect(); } catch (error) { status(`连接失败：${errorText(error)}`); }
});
for (const button of buttons) button.addEventListener('click', () => pay(button.dataset.action));
