import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import solc from 'solc';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, id, parseEther } from 'ethers';
import { createWeatherService, PRICE } from '../service/weather.mjs';

const source = readFileSync(new URL('../contracts/AgentVault.sol', import.meta.url), 'utf8');
const input = { language: 'Solidity', sources: { 'AgentVault.sol': { content: source } }, settings: { evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
const artifact = compiled.contracts['AgentVault.sol'].AgentVault;

test('service delivers only after a matching confirmed vault payment and rejects replay', async () => {
  const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' } });
  try {
    const provider = new BrowserProvider(rpc);
    const owner = await provider.getSigner(0);
    const agent = await provider.getSigner(1);
    const merchant = await provider.getSigner(2);
    const merchantAddress = await merchant.getAddress();
    const vault = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, owner)
      .deploy(await agent.getAddress(), parseEther('0.02'), parseEther('0.005'), { value: parseEther('0.02') });
    await vault.waitForDeployment();
    await (await vault.setMerchant(merchantAddress, true)).wait();
    const vaultAddress = await vault.getAddress();
    const service = createWeatherService({ provider, vaultAddress, merchantAddress });
    const orderId = id('weather-service-test');
    const tx = await vault.connect(agent).pay(orderId, merchantAddress, PRICE);
    await tx.wait();
    await assert.rejects(service.report(tx.hash, id('different-order')), /匹配的服务付款记录/);
    const data = await service.report(tx.hash, orderId);
    assert.equal(data.city, 'Shanghai');
    await assert.rejects(service.report(tx.hash, orderId), /已领取过服务/);
  } finally { await rpc.disconnect(); }
});
