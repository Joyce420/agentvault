import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import solc from 'solc';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,parseEther,id} from 'ethers';
const input={language:'Solidity',sources:{'AgentVault.sol':{content:readFileSync(new URL('../contracts/AgentVault.sol',import.meta.url),'utf8')}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));
assert.equal((output.errors||[]).filter(e=>e.severity==='error').length,0,JSON.stringify(output.errors));
const artifact=output.contracts['AgentVault.sol'].AgentVault;
test('real EVM enforces payment permissions and preserves rejected orders',async()=>{
 const rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'}});
 try{
 const provider=new BrowserProvider(rpc);provider.pollingInterval=20;
 const owner=await provider.getSigner(0),agent=await provider.getSigner(1),merchant=await provider.getSigner(2),stranger=await provider.getSigner(3);
 const ma=await merchant.getAddress();
 const vault=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,owner).deploy(await agent.getAddress(),parseEther('5'),parseEther('3'),{value:parseEther('8')});await vault.waitForDeployment();
 await (await vault.setMerchant(ma,true)).wait();
 const buy=vault.connect(agent),amount=parseEther('2');
 await assert.rejects(vault.connect(stranger).setMerchant.staticCall(await stranger.getAddress(),true));
 await assert.rejects(vault.connect(stranger).pay.staticCall(id('unauthorized'),ma,amount));
 await assert.rejects(buy.pay.staticCall(id('unknown'),await stranger.getAddress(),amount));
 await assert.rejects(buy.pay.staticCall(id('over'),ma,parseEther('4')));
 const before=BigInt(await rpc.request({method:'eth_getBalance',params:[ma,'latest']}));
 await (await buy.pay(id('first'),ma,amount)).wait();
 const after=BigInt(await rpc.request({method:'eth_getBalance',params:[ma,'latest']}));
 assert.equal(after-before,amount);assert.equal(await vault.spent(),amount);
 await assert.rejects(buy.pay.staticCall(id('first'),ma,amount));
 await (await buy.pay(id('second'),ma,amount)).wait();
 await assert.rejects(buy.pay.staticCall(id('total-over'),ma,amount));
 assert.equal(await vault.paidOrders(id('total-over')),false);
 assert.equal(await vault.spent(),parseEther('4'));
 await assert.rejects(vault.withdraw.staticCall(1n));
 await (await vault.setPaused(true)).wait();
 await assert.rejects(buy.pay.staticCall(id('paused'),ma,1n));
 await (await vault.withdraw(parseEther('4'))).wait();
 assert.equal(BigInt(await rpc.request({method:'eth_getBalance',params:[await vault.getAddress(),'latest']})),0n);
 }finally{await rpc.disconnect();}
});
