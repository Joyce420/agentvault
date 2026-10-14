import './console.css';
import './deployment.css';
import { BrowserProvider, ContractFactory, getAddress, parseEther } from 'ethers';
import artifact from './contract-artifact.json';

const FUJI = { chainId: '0xa869', chainName: 'Avalanche Fuji C-Chain', nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'], blockExplorerUrls: ['https://explorer-test.avax.network/c-chain'] };
const explorer = 'https://explorer-test.avax.network/c-chain';
const $ = id => document.getElementById(id);
let signer;
let connectedAddress;
let listeningForWalletChanges = false;
let deploying = false;
const setStatus = message => { $('status').textContent = message; };
const link = (label, url) => {
  const a = document.createElement('a');
  a.href = url; a.textContent = label; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'text-primary underline';
  return a;
};

async function connect() {
  if (!window.ethereum) throw new Error('没有检测到浏览器钱包。请用安装了 MetaMask 或 Core Wallet 的浏览器打开本页面。');
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: FUJI.chainId }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [FUJI] });
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: FUJI.chainId }] });
  }
  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (network.chainId !== 43113n) throw new Error('钱包当前不是 Avalanche Fuji（Chain ID 43113）。');
  signer = await provider.getSigner();
  connectedAddress = await signer.getAddress();
  if (!listeningForWalletChanges) {
    window.ethereum.on?.('accountsChanged', () => location.reload());
    window.ethereum.on?.('chainChanged', () => location.reload());
    listeningForWalletChanges = true;
  }
  $('wallet').textContent = connectedAddress;
  updatePreview();
  setStage(2);
  setStatus('已连接 Fuji。请检查金额和商户地址后点击部署。');
}

async function deploy() {
  if (!signer) throw new Error('请先连接钱包。');
  const budget = $('budget').value.trim();
  const limit = $('limit').value.trim();
  const budgetWei = parseEther(budget);
  const limitWei = parseEther(limit);
  if (budgetWei <= 0n || limitWei <= 0n || limitWei > budgetWei) throw new Error('预算和单笔上限必须大于零，且单笔上限不能超过预算。');
  const merchant = getAddress($('merchant').value.trim() || connectedAddress);
  const provider = signer.provider;
  const network = await provider.getNetwork();
  if (network.chainId !== 43113n) throw new Error('请先将钱包切回 Fuji 测试网。');
  const balance = await provider.getBalance(connectedAddress);
  if (balance <= budgetWei) throw new Error('钱包测试 AVAX 不足。请先从官方水龙头领取，余额须高于存款额以支付手续费。');

  deploying = true;
  setStage(3);
  for (const key of ['budget', 'limit', 'merchant']) $(key).disabled = true;
  $('deploy').disabled = true;
  $('connect').disabled = true;
  $('result').replaceChildren();
  try {
    setStatus('请在钱包里确认第 1 笔交易：部署合约并存入测试 AVAX。');
    const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await factory.deploy(connectedAddress, budgetWei, limitWei, { value: budgetWei });
    const deploymentTx = contract.deploymentTransaction();
    $('result').append(link('查看部署交易', `${explorer}/tx/${deploymentTx.hash}`));
    setStatus('部署交易已发出，等待确认……');
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    $('result').append(document.createElement('br'), link(`合约地址：${contractAddress}`, `${explorer}/address/${contractAddress}`));
    localStorage.setItem('agentvault.fuji.address', contractAddress);
    localStorage.setItem(`agentvault.fuji.merchant.${contractAddress.toLowerCase()}`, merchant);
    setStatus('合约已部署。请在钱包里确认第 2 笔交易：允许测试商户收款。');
    const tx = await contract.setMerchant(merchant, true);
    $('result').append(document.createElement('br'), link('查看商户授权交易', `${explorer}/tx/${tx.hash}`));
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('商户授权未成功，请在链上测试页重试授权。');
    setStage(4);
    $('result').append(document.createElement('br'), link('打开链上付款演示', '/live.html'));
    setStatus('完成！请保存上面的合约地址，发给协作开发的朋友。当前主页仍是模拟演示。');
  } finally {
    deploying = false;
    for (const key of ['budget', 'limit', 'merchant']) $(key).disabled = false;
    updatePreview();
    $('connect').disabled = false;
  }
}

$('connect').addEventListener('click', async () => {
  try { await connect(); } catch (error) { setStatus(`连接失败：${error.shortMessage || error.message}`); }
});
$('deploy').addEventListener('click', async () => {
  try { await deploy(); } catch (error) { setStatus(`未完成：${error.shortMessage || error.message}`); }
});

function setStage(stage) {
  for (const item of document.querySelectorAll('[data-stage]')) {
    const n = Number(item.dataset.stage);
    item.classList.toggle('active', n === stage);
    item.classList.toggle('done', n < stage);
    if (n === stage) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
}
function updatePreview() {
  const budget = $('budget').value.trim();
  const limit = $('limit').value.trim();
  $('preview-budget').textContent = budget || '—';
  $('preview-limit').textContent = limit || '—';
  $('deposit-amount').textContent = budget || '—';
  const merchant = $('merchant').value.trim();
  $('preview-merchant').textContent = merchant ? `${merchant.slice(0, 8)}…${merchant.slice(-6)}` : connectedAddress ? '1 个商户（当前钱包）' : '当前钱包（待连接）';
  let error = '';
  try {
    const b = parseEther(budget), l = parseEther(limit);
    if (b <= 0n || l <= 0n || l > b) error = '预算和上限须大于零，单笔上限不能超过总预算。';
    if (merchant) getAddress(merchant);
  } catch { error = '请填写有效金额和商户钱包地址。'; }
  $('validation').textContent = error;
  $('deploy').disabled = !signer || deploying || !!error;
}
for (const key of ['budget', 'limit', 'merchant']) $(key).addEventListener('input', updatePreview);
updatePreview();
