import './generated.css';
import { BrowserProvider, Contract, formatEther, getAddress, id } from 'ethers';
import artifact from './contract-artifact.json';

const $ = key => document.getElementById(key);
const explorer = 'https://explorer-test.avax.network/c-chain';
let context;

function step(message) {
  const item = document.createElement('li');
  item.textContent = message;
  if ($('steps').firstElementChild?.textContent === '等待任务。') $('steps').replaceChildren();
  $('steps').append(item);
}

function reset() {
  $('steps').replaceChildren();
  $('receipt').replaceChildren();
  $('result').textContent = '付款并通过链上验证后显示数据。';
  $('pay').disabled = true;
  context = null;
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
  reset();
  $('plan').disabled = true;
  try {
    const vault = getAddress($('address').value.trim());
    step('Agent 请求天气服务。');
    const response = await fetch('/api/weather', { cache: 'no-store' });
    const quote = await response.json();
    if (response.status !== 402 || quote.chainId !== 43113 || quote.asset !== 'AVAX') throw new Error('服务没有返回支持的 Fuji 测试付款要求。');
    if (getAddress(quote.vault) !== vault) throw new Error('服务指定的保险箱与你输入的不一致。');
    const merchant = getAddress(quote.merchant);
    const amount = BigInt(quote.amountWei);
    step(`服务要求 ${formatEther(amount)} 测试 AVAX，收款地址 ${merchant}。`);
    const provider = await ensureFuji();
    if (await provider.getCode(vault) === '0x') throw new Error('该地址在 Fuji 上没有合约。');
    const signer = await provider.getSigner();
    const contract = new Contract(vault, artifact.abi, signer);
    const account = await signer.getAddress();
    if ((await contract.agent()).toLowerCase() !== account.toLowerCase()) throw new Error('当前钱包不是合约授权 Agent。');
    if (!(await contract.merchants(merchant))) throw new Error('服务商不在合约白名单。');
    const remaining = (await contract.budget()) - (await contract.spent());
    if (amount > (await contract.perPaymentLimit()) || amount > remaining || amount > (await provider.getBalance(vault))) {
      throw new Error('价格超出单笔上限、剩余预算或金库余额。');
    }
    const orderId = id(`weather-${vault}-${Date.now()}-${crypto.randomUUID()}`);
    await contract.pay.staticCall(orderId, merchant, amount);
    step(`合约预检查通过，剩余预算 ${formatEther(remaining)} 测试 AVAX。等待你在钱包中确认付款。`);
    context = { contract, orderId, merchant, amount, vault, account };
    $('pay').disabled = false;
  } catch (error) { step(`停止购买：${error.shortMessage || error.message}`); }
  finally { $('plan').disabled = false; }
}

async function pay() {
  if (!context) return;
  $('pay').disabled = true;
  const { contract, orderId, merchant, amount, account } = context;
  try {
    if ((await contract.runner.getAddress()).toLowerCase() !== account.toLowerCase()) throw new Error('钱包账号已变更，请重新检查请求。');
    const tx = await contract.pay(orderId, merchant, amount);
    step(`已发送付款交易 ${tx.hash}，等待 Fuji 确认。`);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('付款交易未成功。');
    const a = document.createElement('a');
    a.href = `${explorer}/tx/${tx.hash}`;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.className = 'text-primary underline';
    a.textContent = '查看 Fuji 付款交易';
    $('receipt').replaceChildren(a);
    step('付款成功。Agent 将交易证明交给服务端核验。');
    const response = await fetch(`/api/weather?tx=${encodeURIComponent(tx.hash)}&order=${encodeURIComponent(orderId)}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(`付款已成功，但服务端未交付：${body.error || response.status}`);
    $('result').textContent = JSON.stringify(body.data, null, 2);
    step('服务端验证了 Paid 事件、收款商户、金额和订单编号，已交付数据。');
  } catch (error) { step(error.shortMessage || error.message); }
  finally { context = null; }
}

$('address').value = localStorage.getItem('agentvault.fuji.address') || '';
$('plan').addEventListener('click', plan);
$('pay').addEventListener('click', pay);
window.ethereum?.on?.('accountsChanged', () => { reset(); step('钱包账号已变更，请重新检查购买请求。'); });
window.ethereum?.on?.('chainChanged', () => { reset(); step('网络已变更，请重新检查购买请求。'); });
