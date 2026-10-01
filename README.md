# AgentVault

让 Agent 在 Avalanche Fuji 上支付，但不能越权。

## 问题

Agent 一旦能付款，就可能超额、付给未授权商户，或重放同一订单。资金所有者应制定规则，Agent 不能修改规则。

## 方案

Owner 设定预算、单笔上限与商户白名单；Fuji 合约在付款前执行，并防止重复订单。Agent 只能提出付款请求，用户在钱包中确认交易；Agent 不持有私钥。首页提供可编辑政策的**本地模拟**。现有合约的预算与单笔上限在部署时确定，修改须部署新合约；Owner 可通过 `setMerchant` 更新链上白名单。首页修改不会改动链上合约。

## 为什么是 Avalanche

Fuji C-Chain 适合测试小额支付，具备快速确认和较低手续费。x402 解决「Agent 怎么付」，AgentVault 解决「Agent 付了也不能越权」：这是面向 x402 的 policy vault 原型，支付意图对齐 HTTP 402 / x402，**完整 x402 协议和 facilitator 尚未实现**。

## 本次黑客松完成

- 可配置的本地模拟政策与三个预设；四种动态付款向量及审计日志。
- Fuji 原生测试 AVAX 合约：预算、单笔上限、白名单、防重放；链上读写与钱包确认。
- 浏览器部署与商户授权；规则驱动 Agent 获取 HTTP 402 风格报价、由用户确认付款，服务端验链后交付固定样例或文本/JSON 处理结果。
- 已有 Fuji [部署合约](https://explorer-test.avax.network/c-chain/address/0x7fb5fcE5542dB70030d6d77788d3a46d2be9C27D)和[公开付款交易](https://explorer-test.avax.network/c-chain/tx/0x4197bfa96cbbcb9703b80c2754f00c95ec0d344792a9c7840e59c7d043c2eee1)。

## 明确没做

完整 x402 facilitator、AI 模型推理、生产级 owner/agent/merchant 三地址分离、通用规则语言、主网与合约审计。天气为固定样例，不是实时预报。服务端领取记录在内存中，重启后丢失。

## 快速演示

1. 打开 [Demo](https://agentvault-joyce420-demo.onrender.com/)，应用「保守」预设，点 01/02/03/04；04 需要先有一笔成功订单。
2. 将单笔上限改为 1 并应用，再用固定金额 2 向 `weather.lab` 付款，观察拦截；若将 `weather.lab` 移出白名单，同样的请求也会被拦截。
3. 打开 [Live](https://agentvault-joyce420-demo.onrender.com/live.html) 连接 Fuji 钱包，读取真实合约规则。链上成功付款需钱包确认；失败场景只做预检查，不会产生失败交易。
4. [Agent 购买页](https://agentvault-joyce420-demo.onrender.com/agent.html)可选择三种任务，获取报价；授权 Agent 钱包确认 Fuji 付款后领取服务结果。[Deploy](https://agentvault-joyce420-demo.onrender.com/deploy.html)可部署自己的合约。

## 链接

- [Demo](https://agentvault-joyce420-demo.onrender.com/) · [Live](https://agentvault-joyce420-demo.onrender.com/live.html) · [Deploy](https://agentvault-joyce420-demo.onrender.com/deploy.html) · [Agent](https://agentvault-joyce420-demo.onrender.com/agent.html)
- Fuji 合约：`0x7fb5fcE5542dB70030d6d77788d3a46d2be9C27D` · [Fuji 浏览器](https://explorer-test.avax.network/c-chain/address/0x7fb5fcE5542dB70030d6d77788d3a46d2be9C27D)

## 技术栈与启动

Solidity、ethers 6、Vite 6、原生 JavaScript、Tailwind CSS 3、Node.js HTTP 服务、Ganache 测试、Render、Avalanche Fuji C-Chain（Chain ID 43113）。

```bash
npm ci
npm test
npm run dev
```

生产构建：`npm run build && npm start`。可选环境变量：`PORT`、`FUJI_RPC_URL`、`SERVICE_VAULT`、`SERVICE_MERCHANT`、`NODE_ENV`。构建会生成合约 ABI 和样式；无需模型 API Key。

## 安全

私钥只留在用户钱包；Agent 不能读私钥。被拒链上请求先用 `staticCall` 预检查，避免无意义消耗测试 AVAX。合约未审计，请仅用 Fuji 测试资产。
