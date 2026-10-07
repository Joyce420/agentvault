# AgentVault · 提交用简介

**一句话：**让 Agent 在 Avalanche 上申请付款，但不能越权。

AgentVault 是部署在 Avalanche Fuji C-Chain 的受控支付原型。资金所有者设定预算、单笔上限和允许收款的商户；Agent 提出付款请求，合约在转出测试 AVAX 前检查规则和订单是否已支付。网页提供可修改规则的免费模拟，以及连接钱包读取和操作真实 Fuji 合约的页面。

**为什么重要：**Agent 能发起购买请求时，资金所有者仍需要控制它最多花多少、每笔最多多少、可以付给谁，以及同一订单能否重复付款。

**技术路径：**用户任务 → 规则驱动 Agent 选择服务 → HTTP 402 风格报价 → AgentVault 合约预检查 → 用户钱包确认 Fuji 测试 AVAX 付款 → 服务端核验链上交易 → 返回服务结果。

**已实现：**本地可配置政策与四种放行/拦截测试；Fuji 合约的预算、单笔限额、商户白名单和订单防重放；钱包确认付款与交易链接；三种规则驱动任务的报价、验链和交付。

**边界：**Agent 按关键词选择服务，没有 AI 模型推理；天气为固定样例；完整 x402 facilitator、主网和生产级合约审计尚未完成。首页使用演示单位，不转真实资金；链上页使用 Fuji 测试 AVAX。

## 演示与证据

- [公开网站](https://agentvault-joyce420-demo.onrender.com/) · [Agent 购买](https://agentvault-joyce420-demo.onrender.com/agent.html) · [Fuji 链上页](https://agentvault-joyce420-demo.onrender.com/live.html)
- [GitHub 代码](https://github.com/Joyce420/agentvault) · [Fuji 合约](https://explorer-test.avax.network/c-chain/address/0x7fb5fcE5542dB70030d6d77788d3a46d2be9C27D) · [已成功的测试付款](https://explorer-test.avax.network/c-chain/tx/0x4197bfa96cbbcb9703b80c2754f00c95ec0d344792a9c7840e59c7d043c2eee1)

## 60 秒录屏顺序

1. **0–10 秒：首页。**说清「Owner 定规则、Agent 申请、合约执行」，指出首页是免费模拟。
2. **10–25 秒：模拟付款。**选保守政策并应用，点「模拟 Agent 申请支付」，展示放行和剩余预算减少。
3. **25–40 秒：规则拦截。**将单笔上限改为 1 并应用，重试金额 2，展示拦截且预算不变；指出 02/03/04 分别演示超额、商户越权和订单重放。
4. **40–50 秒：Agent 购买。**展示任务输入、服务报价、合约预检查、钱包确认和结果交付的路径；不要声称任意任务理解或完整 x402。
5. **50–60 秒：真实 Fuji 证据。**打开链上页或上述交易链接，展示真实合约及成功交易。

录屏前先打开公网网站，让 Render 免费实例完成唤醒；这不会改变链上状态。真实付款需测试钱包确认，录屏可直接使用已有的公开交易作为链上证据。
