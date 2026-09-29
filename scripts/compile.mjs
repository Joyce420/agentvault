import { readFile, writeFile } from 'node:fs/promises';
import solc from 'solc';

const source = await readFile(new URL('../contracts/AgentVault.sol', import.meta.url), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'AgentVault.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter(error => error.severity === 'error') ?? [];
if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'));
const contract = output.contracts['AgentVault.sol'].AgentVault;
await writeFile(new URL('../src/contract-artifact.json', import.meta.url), JSON.stringify({
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
}));
console.log('AgentVault contract compiled');
