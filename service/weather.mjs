import { Contract, Interface, JsonRpcProvider, getAddress, parseEther } from 'ethers';

const ABI = [
  'event Paid(bytes32 indexed orderId, address indexed merchant, uint256 amount)',
  'function agent() view returns (address)',
  'function merchants(address) view returns (bool)',
];

export const PRICE = parseEther('0.001');
export const DEFAULT_VAULT = '0x7fb5fcE5542dB70030d6d77788d3a46d2be9C27D';
export const DEFAULT_MERCHANT = '0x1f3f82113b2d499f18336b2e59AB168A0b5a8B62';

const report = {
  city: 'Shanghai',
  outlook: '晴转多云',
  temperatureC: 24,
  advice: '适合户外活动，傍晚留意天气变化。',
  note: '黑客松演示用固定样例数据，并非实时天气预报。',
};

export function createWeatherService({
  rpcUrl = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  vaultAddress = process.env.SERVICE_VAULT || DEFAULT_VAULT,
  merchantAddress = process.env.SERVICE_MERCHANT || DEFAULT_MERCHANT,
  provider = new JsonRpcProvider(rpcUrl, 43113),
} = {}) {
  const vault = getAddress(vaultAddress);
  const merchant = getAddress(merchantAddress);
  const iface = new Interface(ABI);
  const redeemed = new Set();

  async function verifyPayment(txHash, orderId) {
    if (!/^0x[\da-fA-F]{64}$/.test(txHash || '') || !/^0x[\da-fA-F]{64}$/.test(orderId || '')) {
      throw new Error('交易哈希或订单编号格式无效');
    }
    if (redeemed.has(orderId.toLowerCase())) throw new Error('该订单已领取过服务');
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) throw new Error('交易尚未在 Fuji 成功确认');
    if (receipt.to?.toLowerCase() !== vault.toLowerCase()) throw new Error('付款目标不是指定保险箱');

    const contract = new Contract(vault, ABI, provider);
    const agent = await contract.agent();
    if (receipt.from.toLowerCase() !== agent.toLowerCase()) throw new Error('交易不是授权 Agent 发起的');
    if (!(await contract.merchants(merchant))) throw new Error('服务商不在白名单');
    const paid = receipt.logs.some(log => {
      if (log.address.toLowerCase() !== vault.toLowerCase()) return false;
      try {
        const parsed = iface.parseLog(log);
        return parsed?.name === 'Paid'
          && parsed.args.orderId.toLowerCase() === orderId.toLowerCase()
          && parsed.args.merchant.toLowerCase() === merchant.toLowerCase()
          && parsed.args.amount >= PRICE;
      } catch { return false; }
    });
    if (!paid) throw new Error('交易中没有匹配的服务付款记录');
    redeemed.add(orderId.toLowerCase());
    return report;
  }

  return { vault, merchant, price: PRICE.toString(), report: async (txHash, orderId) => verifyPayment(txHash, orderId) };
}
