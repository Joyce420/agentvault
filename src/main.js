import "./generated.css";

(function() {
  // 核心状态
  let vaultBalance = 10.00;
  let remainingBudget = 10.00;
  const perTxLimit = 3.00;
  let lastSuccessfulOrder = null;
  let isProcessing = false;
  let orderCounter = 2041;

  // DOM 元素引用
  const statVault = document.getElementById('stat-vault');
  const statBudget = document.getElementById('stat-budget');
  const cardBudget = document.getElementById('card-budget');
  const budgetBadge = document.getElementById('budget-badge');
  const wireStatusBadge = document.getElementById('wire-status-badge');
  const wireStatusDot = document.getElementById('wire-status-dot');
  const wireStatusText = document.getElementById('wire-status-text');

  const nodeAgent = document.getElementById('node-agent');
  const nodeAgentIntent = document.getElementById('node-agent-intent');
  const nodeGate = document.getElementById('node-gate');
  const gateBanner = document.getElementById('gate-banner');
  const gateIcon = document.getElementById('gate-icon');
  const nodeMerchant = document.getElementById('node-merchant');
  const merchantStatusBadge = document.getElementById('merchant-status-badge');

  const feedbackStrip = document.getElementById('feedback-strip');
  const feedbackIcon = document.getElementById('feedback-icon');
  const feedbackText = document.getElementById('feedback-text');
  const auditContainer = document.getElementById('audit-log-container');
  const vaultSafetySummary = document.getElementById('vault-safety-summary');

  const btnNormal = document.getElementById('btn-normal');
  const btnOvercap = document.getElementById('btn-overcap');
  const btnUnknown = document.getElementById('btn-unknown');
  const btnReplay = document.getElementById('btn-replay');
  const replayBadge = document.getElementById('replay-badge');
  const replayOrderTag = document.getElementById('replay-order-tag');
  const replayFooter = document.getElementById('replay-footer');
  const replayTargetText = document.getElementById('replay-target-text');
  const btnReset = document.getElementById('btn-reset');

  const allTestButtons = [btnNormal, btnOvercap, btnUnknown, btnReplay];

  // 刷新所有按钮禁用状态
  function updateButtonsState() {
    if (isProcessing) {
      allTestButtons.forEach(b => {
        b.disabled = true;
        b.classList.add('cursor-not-allowed', 'opacity-50');
      });
      btnReset.disabled = true;
      btnReset.classList.add('cursor-not-allowed', 'opacity-50');
      return;
    }

    btnReset.disabled = false;
    btnReset.classList.remove('cursor-not-allowed', 'opacity-50');

    btnNormal.disabled = false;
    btnNormal.classList.remove('cursor-not-allowed', 'opacity-50');

    btnOvercap.disabled = false;
    btnOvercap.classList.remove('cursor-not-allowed', 'opacity-50');

    btnUnknown.disabled = false;
    btnUnknown.classList.remove('cursor-not-allowed', 'opacity-50');

    // 重放订单按钮特殊判定
    if (lastSuccessfulOrder) {
      btnReplay.disabled = false;
      btnReplay.classList.remove('opacity-50', 'cursor-not-allowed');
      btnReplay.classList.add('hover:border-[#fb7185]', 'cursor-pointer');
      btnReplay.removeAttribute('title');
      if (replayBadge) {
        replayBadge.className = 'bg-[#fb7185]/15 text-[#fb7185] font-bold px-1.5 py-0.5 rounded border border-[#fb7185]/30';
      }
      if (replayOrderTag) {
        replayOrderTag.className = 'text-[#fb7185] font-bold';
        replayOrderTag.textContent = lastSuccessfulOrder;
      }
      if (replayTargetText) {
        replayTargetText.textContent = '重放 ' + lastSuccessfulOrder;
      }
    } else {
      btnReplay.disabled = true;
      btnReplay.classList.add('opacity-50', 'cursor-not-allowed');
      btnReplay.classList.remove('hover:border-[#fb7185]', 'cursor-pointer');
      btnReplay.title = '需先发起一笔成功的正常付款';
      if (replayBadge) {
        replayBadge.className = 'bg-slate-800 text-[#94a3b8] font-bold px-1.5 py-0.5 rounded border border-[#1f3a4d]';
      }
      if (replayOrderTag) {
        replayOrderTag.className = 'text-[#94a3b8] font-bold';
        replayOrderTag.textContent = '需先有成功订单';
      }
      if (replayTargetText) {
        replayTargetText.textContent = '无历史订单';
      }
    }
  }

  // 恢复管线到空闲就绪状态
  function resetPipelineToIdle() {
    wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#38bdf8]';
    wireStatusText.textContent = '等待付款请求';
    wireStatusText.className = 'text-[#38bdf8]';

    nodeAgent.className = 'md:col-span-3 bg-[#0f1f2d] border border-[#1f3a4d] p-3 rounded flex flex-col justify-between gap-1.5 transition-all';
    nodeAgentIntent.textContent = '空闲中';
    nodeAgentIntent.className = 'text-slate-200 font-semibold';

    nodeGate.className = 'md:col-span-6 bg-[#0f2438] border-2 border-[#38bdf8] p-3 rounded shadow-[0_0_18px_rgba(56,189,248,0.18)] flex flex-col justify-between gap-2 transition-all duration-300 relative';
    gateBanner.className = 'w-full py-1 px-2 rounded bg-[#0b1827] text-center font-mono text-[11px] font-bold text-[#38bdf8] border border-[#38bdf8]/40 tracking-wide';
    gateBanner.textContent = '等待付款请求';
    gateIcon.className = 'material-symbols-outlined text-[24px] text-[#38bdf8]';
    gateIcon.textContent = 'verified_user';

    nodeMerchant.className = 'md:col-span-3 bg-[#0f1f2d] border border-[#1f3a4d] p-3 rounded flex flex-col justify-between gap-1.5 transition-all';
    merchantStatusBadge.textContent = '等待中';
    merchantStatusBadge.className = 'text-[#94a3b8]';

    feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#1f3a4d] text-[#94a3b8] transition-all';
    feedbackIcon.className = 'material-symbols-outlined text-[16px] text-[#38bdf8]';
    feedbackIcon.textContent = 'info';
    feedbackText.textContent = '系统就绪：点击下方测试操作以检验智能合约防护规则';
  }

  // 渲染单笔审计卡片
  function renderAuditCard({ status, isSuccess, title, amount, merchant, orderId, errorCode, reason, fundSafetyNote }) {
    auditContainer.innerHTML = `
      <div class="p-3 bg-[#0f1f2d] border ${isSuccess ? 'border-[#4ade80]/60' : 'border-[#fb7185]/60'} rounded flex flex-col gap-2 transition-all">
        <div class="flex items-center justify-between pb-1.5 border-b border-[#1f3a4d]/60 font-mono">
          <div class="flex items-center gap-2">
            <span class="${isSuccess ? 'bg-[#4ade80]/15 text-[#4ade80] border-[#4ade80]/30' : 'bg-[#fb7185]/15 text-[#fb7185] border-[#fb7185]/30'} border font-bold px-2 py-0.5 rounded text-[11px]">
              ${status}
            </span>
            <span class="text-white font-bold text-xs">${title}</span>
          </div>
          <span class="text-[11px] ${isSuccess ? 'text-[#4ade80]' : 'text-[#fb7185]'} font-bold">
            ${amount}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-mono text-[#94a3b8]">
          <div>收款商户: <span class="text-slate-200 font-semibold">${merchant}</span></div>
          <div>订单编号: <span class="text-[#38bdf8] font-semibold">${orderId}</span></div>
          ${errorCode ? `<div class="col-span-2 text-[#fb7185] font-semibold">错误代码: <code>${errorCode}</code></div>` : ''}
          <div class="col-span-2 text-slate-300">判定结果: <span>${reason}</span></div>
        </div>

        <div class="pt-1.5 border-t border-[#1f3a4d]/60 flex items-center justify-between font-mono text-[11px]">
          <span class="${isSuccess ? 'text-[#4ade80]' : 'text-[#fb7185]'} font-semibold flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">${isSuccess ? 'verified' : 'shield'}</span>
            ${fundSafetyNote}
          </span>
          <span class="text-[#94a3b8]">LOCAL SIMULATION</span>
        </div>
      </div>
    `;
  }

  // 1. 正常付款
  btnNormal.addEventListener('click', () => {
    if (isProcessing) return;
    isProcessing = true;
    resetPipelineToIdle();
    updateButtonsState();

    const orderId = 'ord_#' + (orderCounter++);
    const amountVal = 2.00;
    const amountStr = amountVal.toFixed(2) + ' 测试额度';
    const merchant = 'weather.lab';

    // 状态进入处理中
    wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping';
    wireStatusText.textContent = '处理中: 合约正在核验...';
    wireStatusText.className = 'text-[#38bdf8] font-bold';

    nodeAgentIntent.textContent = `支付 ${amountStr}`;
    nodeAgentIntent.className = 'text-[#38bdf8] font-semibold';

    gateBanner.textContent = '正在核验单笔上限、商户白名单与订单唯一性...';
    gateBanner.className = 'w-full py-1 px-2 rounded bg-[#0b1827] text-center font-mono text-[11px] font-bold text-[#38bdf8] border border-[#38bdf8]/40 animate-pulse';

    feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#38bdf8] text-[#38bdf8] transition-all';
    feedbackIcon.textContent = 'sync';
    feedbackText.textContent = `执行中: Agent 提交意图 ${amountStr} 至 ${merchant}...`;

    setTimeout(() => {
      // 检查预算与金库余额
      if (remainingBudget >= amountVal && vaultBalance >= amountVal) {
        // 成功扣减
        vaultBalance = Math.max(0, vaultBalance - amountVal);
        remainingBudget = Math.max(0, remainingBudget - amountVal);
        statVault.textContent = vaultBalance.toFixed(2);
        statBudget.textContent = remainingBudget.toFixed(2);
        lastSuccessfulOrder = orderId;

        // 视觉响应：成功
        wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#4ade80]';
        wireStatusText.textContent = 'SETTLED 放款成功';
        wireStatusText.className = 'text-[#4ade80] font-bold';

        nodeGate.className = 'md:col-span-6 bg-[#0f2438] border-2 border-[#4ade80] p-3 rounded shadow-[0_0_20px_rgba(74,222,128,0.22)] flex flex-col justify-between gap-2 transition-all duration-300 relative';
        gateBanner.className = 'w-full py-1 px-2 rounded bg-[#0b1827] text-center font-mono text-[11px] font-bold text-[#4ade80] border border-[#4ade80]/50 tracking-wide';
        gateBanner.textContent = `规则通过: 金额 ${amountStr} ≤ 3.00，白名单合规`;
        gateIcon.className = 'material-symbols-outlined text-[24px] text-[#4ade80]';
        gateIcon.textContent = 'check_circle';

        nodeMerchant.className = 'md:col-span-3 bg-[#0f1f2d] border-2 border-[#4ade80] p-3 rounded flex flex-col justify-between gap-1.5 transition-all shadow-sm';
        merchantStatusBadge.textContent = `到账 +${amountStr}`;
        merchantStatusBadge.className = 'text-[#4ade80] font-bold';

        cardBudget.classList.add('border-[#4ade80]');
        setTimeout(() => cardBudget.classList.remove('border-[#4ade80]'), 600);

        feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#4ade80] text-[#4ade80] transition-all';
        feedbackIcon.textContent = 'check_circle';
        feedbackText.textContent = `SETTLED 付款成功: 已向 ${merchant} 放款 ${amountStr} (订单 ${orderId})`;

        vaultSafetySummary.textContent = `金库资金状态: 正常扣付 ${amountStr}，已安全受控放款`;

        renderAuditCard({
          status: 'SETTLED 付款成功',
          isSuccess: true,
          title: '正常付款放款',
          amount: `- ${amountStr}`,
          merchant: merchant,
          orderId: orderId,
          errorCode: null,
          reason: '符合合约预设规则，已放款',
          fundSafetyNote: '资金划转已完成，剩余预算已相应减少'
        });
      } else {
        // 预算或金库余额不足
        merchantStatusBadge.textContent = '未收到款项';
        merchantStatusBadge.className = 'text-[#fb7185]';
        wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#fb7185]';
        wireStatusText.textContent = 'REVERTED: 预算不足';
        wireStatusText.className = 'text-[#fb7185] font-bold';

        nodeGate.className = 'md:col-span-6 bg-[#0f2438] border-2 border-[#fb7185] p-3 rounded shadow-[0_0_20px_rgba(251,113,133,0.25)] flex flex-col justify-between gap-2 transition-all duration-300 relative';
        gateBanner.className = 'w-full py-1 px-2 rounded bg-[#fb7185]/20 text-center font-mono text-[11px] font-bold text-[#fb7185] border border-[#fb7185]/50 tracking-wide';
        gateBanner.textContent = '拦截: 剩余预算或金库余额不足';
        gateIcon.className = 'material-symbols-outlined text-[24px] text-[#fb7185]';
        gateIcon.textContent = 'block';

        feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#fb7185] text-[#fb7185] transition-all';
        feedbackIcon.textContent = 'report_problem';
        feedbackText.textContent = 'REVERTED: InsufficientBudget // 金库余额或剩余预算不足';

        vaultSafetySummary.textContent = '金库资金状态: 拒绝越权付款，金库资金安全未受损';

        renderAuditCard({
          status: 'REVERTED 付款被拒绝',
          isSuccess: false,
          title: '预算不足拦截',
          amount: amountStr,
          merchant: merchant,
          orderId: orderId,
          errorCode: 'REVERTED: InsufficientBudget',
          reason: '金库余额或剩余预算不足',
          fundSafetyNote: '本次付款未扣除金库资金'
        });
      }

      isProcessing = false;
      updateButtonsState();
    }, 400);
  });

  // 2. 超出限额 (Over Cap)
  btnOvercap.addEventListener('click', () => {
    if (isProcessing) return;
    isProcessing = true;
    resetPipelineToIdle();
    updateButtonsState();

    const orderId = 'ord_#' + (orderCounter++);
    const amountStr = '4.00 测试额度';
    const merchant = 'weather.lab';

    wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping';
    wireStatusText.textContent = '处理中: 合约正在核验...';
    wireStatusText.className = 'text-[#38bdf8] font-bold';

    nodeAgentIntent.textContent = `越权申请 4.00 额度`;
    nodeAgentIntent.className = 'text-[#fb7185] font-semibold';

    gateBanner.textContent = '正在核验单笔上限 (4.00 vs 3.00)...';
    gateBanner.className = 'w-full py-1 px-2 rounded bg-[#0b1827] text-center font-mono text-[11px] font-bold text-[#38bdf8] border border-[#38bdf8]/40 animate-pulse';

    feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#fb7185] text-[#fb7185] transition-all';
    feedbackIcon.textContent = 'warning';
    feedbackText.textContent = '检测到越权请求: 尝试支出 4.00 测试额度 (超过上限 3.00)...';

    setTimeout(() => {
      // 拒绝拦截
      wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#fb7185]';
      wireStatusText.textContent = 'REVERTED 付款被拒绝';
      wireStatusText.className = 'text-[#fb7185] font-bold';

      nodeGate.className = 'md:col-span-6 bg-[#0f2438] border-2 border-[#fb7185] p-3 rounded shadow-[0_0_20px_rgba(251,113,133,0.3)] flex flex-col justify-between gap-2 transition-all duration-300 relative';
      gateBanner.className = 'w-full py-1 px-2 rounded bg-[#fb7185]/20 text-center font-mono text-[11px] font-bold text-[#fb7185] border border-[#fb7185]/50 tracking-wide';
      gateBanner.textContent = '拦截: 4.00 > 3.00 单笔上限，合约直接回滚';
      gateIcon.className = 'material-symbols-outlined text-[24px] text-[#fb7185]';
      gateIcon.textContent = 'block';

      nodeMerchant.className = 'md:col-span-3 bg-[#0f1f2d] border border-[#1f3a4d] p-3 rounded flex flex-col justify-between gap-1.5 transition-all';
      merchantStatusBadge.textContent = '未收到款项';
      merchantStatusBadge.className = 'text-[#fb7185]';

      cardBudget.classList.add('border-[#fb7185]');
      setTimeout(() => cardBudget.classList.remove('border-[#fb7185]'), 600);

      feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#fb7185] text-[#fb7185] transition-all';
      feedbackIcon.textContent = 'shield';
      feedbackText.textContent = 'REVERTED: OverPerPaymentLimit // 本次付款未扣除金库资金';

      vaultSafetySummary.textContent = '金库资金状态: 触发超额回滚，本次付款未扣除金库资金';

      renderAuditCard({
        status: 'REVERTED 付款被拒绝',
        isSuccess: false,
        title: '超额回滚拦截',
        amount: amountStr,
        merchant: merchant,
        orderId: orderId,
        errorCode: 'REVERTED: OverPerPaymentLimit',
        reason: '单笔金额 4.00 超过所有者设定的硬顶限制 3.00',
        fundSafetyNote: '本次付款未扣除金库资金'
      });

      isProcessing = false;
      updateButtonsState();
    }, 400);
  });

  // 3. 非白名单商户 (Unknown Merchant)
  btnUnknown.addEventListener('click', () => {
    if (isProcessing) return;
    isProcessing = true;
    resetPipelineToIdle();
    updateButtonsState();

    const orderId = 'ord_#' + (orderCounter++);
    const amountStr = '1.50 测试额度';
    const targetMerchant = 'unverified.service';

    wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping';
    wireStatusText.textContent = '处理中: 合约正在核验...';
    wireStatusText.className = 'text-[#38bdf8] font-bold';

    nodeAgentIntent.textContent = `向未授权目标转账`;
    nodeAgentIntent.className = 'text-[#fb7185] font-semibold';

    gateBanner.textContent = '正在核验收款人白名单授权状态...';
    gateBanner.className = 'w-full py-1 px-2 rounded bg-[#0b1827] text-center font-mono text-[11px] font-bold text-[#38bdf8] border border-[#38bdf8]/40 animate-pulse';

    feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#fb7185] text-[#fb7185] transition-all';
    feedbackIcon.textContent = 'wrong_location';
    feedbackText.textContent = `越权转账企图: 目标 ${targetMerchant} 未在金库白名单中...`;

    setTimeout(() => {
      wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#fb7185]';
      wireStatusText.textContent = 'REVERTED 付款被拒绝';
      wireStatusText.className = 'text-[#fb7185] font-bold';

      nodeGate.className = 'md:col-span-6 bg-[#0f2438] border-2 border-[#fb7185] p-3 rounded shadow-[0_0_20px_rgba(251,113,133,0.3)] flex flex-col justify-between gap-2 transition-all duration-300 relative';
      gateBanner.className = 'w-full py-1 px-2 rounded bg-[#fb7185]/20 text-center font-mono text-[11px] font-bold text-[#fb7185] border border-[#fb7185]/50 tracking-wide';
      gateBanner.textContent = '拦截: 收款商户 unverified.service 不在白名单';
      gateIcon.className = 'material-symbols-outlined text-[24px] text-[#fb7185]';
      gateIcon.textContent = 'block';

      nodeMerchant.className = 'md:col-span-3 bg-[#0f1f2d] border border-[#1f3a4d] p-3 rounded flex flex-col justify-between gap-1.5 transition-all';
      merchantStatusBadge.textContent = '禁止放款';
      merchantStatusBadge.className = 'text-[#fb7185]';

      feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#fb7185] text-[#fb7185] transition-all';
      feedbackIcon.textContent = 'cancel';
      feedbackText.textContent = 'REVERTED: MerchantNotAllowed // 本次付款未扣除金库资金';

      vaultSafetySummary.textContent = '金库资金状态: 拦截非白名单商户，本次付款未扣除金库资金';

      renderAuditCard({
        status: 'REVERTED 付款被拒绝',
        isSuccess: false,
        title: '商户未授权拦截',
        amount: amountStr,
        merchant: targetMerchant,
        orderId: orderId,
        errorCode: 'REVERTED: MerchantNotAllowed',
        reason: '目标收款地址未包含在所有者配置的白名单映射表中',
        fundSafetyNote: '本次付款未扣除金库资金'
      });

      isProcessing = false;
      updateButtonsState();
    }, 400);
  });

  // 4. 重复订单 (Replay Order)
  btnReplay.addEventListener('click', () => {
    if (isProcessing || !lastSuccessfulOrder) return;
    isProcessing = true;
    resetPipelineToIdle();
    updateButtonsState();

    const replayOrderId = lastSuccessfulOrder;
    const amountStr = '2.00 测试额度';
    const merchant = 'weather.lab';

    wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping';
    wireStatusText.textContent = '处理中: 合约正在核验...';
    wireStatusText.className = 'text-[#38bdf8] font-bold';

    nodeAgentIntent.textContent = `重放订单 ${replayOrderId}`;
    nodeAgentIntent.className = 'text-[#fb7185] font-semibold';

    gateBanner.textContent = `正在核验订单 ${replayOrderId} 的模拟已支付记录...`;
    gateBanner.className = 'w-full py-1 px-2 rounded bg-[#0b1827] text-center font-mono text-[11px] font-bold text-[#38bdf8] border border-[#38bdf8]/40 animate-pulse';

    feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#fb7185] text-[#fb7185] transition-all';
    feedbackIcon.textContent = 'history_toggle_off';
    feedbackText.textContent = `重放攻击测试: Agent 试图使用已结清订单 ${replayOrderId} 再次请款...`;

    setTimeout(() => {
      wireStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-[#fb7185]';
      wireStatusText.textContent = 'REVERTED 付款被拒绝';
      wireStatusText.className = 'text-[#fb7185] font-bold';

      nodeGate.className = 'md:col-span-6 bg-[#0f2438] border-2 border-[#fb7185] p-3 rounded shadow-[0_0_20px_rgba(251,113,133,0.3)] flex flex-col justify-between gap-2 transition-all duration-300 relative';
      gateBanner.className = 'w-full py-1 px-2 rounded bg-[#fb7185]/20 text-center font-mono text-[11px] font-bold text-[#fb7185] border border-[#fb7185]/50 tracking-wide';
      gateBanner.textContent = `拦截: 订单 ${replayOrderId} 已在模拟记录中支付，禁止重复结算`;
      gateIcon.className = 'material-symbols-outlined text-[24px] text-[#fb7185]';
      gateIcon.textContent = 'lock';

      nodeMerchant.className = 'md:col-span-3 bg-[#0f1f2d] border border-[#1f3a4d] p-3 rounded flex flex-col justify-between gap-1.5 transition-all';
      merchantStatusBadge.textContent = '已拒绝重复入账';
      merchantStatusBadge.className = 'text-[#fb7185]';

      feedbackStrip.className = 'mt-2.5 px-3 py-1.5 rounded bg-[#07111d] flex items-center justify-between font-mono text-xs border border-[#fb7185] text-[#fb7185] transition-all';
      feedbackIcon.textContent = 'lock';
      feedbackText.textContent = 'REVERTED: OrderAlreadyPaid // 检测到已支付过的订单号，触发防重复支付保护';

      vaultSafetySummary.textContent = '金库资金状态: 成功防御重放攻击，本次付款未扣除金库资金';

      renderAuditCard({
        status: 'REVERTED 付款被拒绝',
        isSuccess: false,
        title: '防重放拦截',
        amount: amountStr,
        merchant: merchant,
        orderId: replayOrderId,
        errorCode: 'REVERTED: OrderAlreadyPaid',
        reason: '检测到已支付过的订单号，触发防重复支付保护',
        fundSafetyNote: '本次付款未扣除金库资金'
      });

      isProcessing = false;
      updateButtonsState();
    }, 400);
  });

  // 重置演示
  btnReset.addEventListener('click', () => {
    if (isProcessing) return;
    vaultBalance = 10.00;
    remainingBudget = 10.00;
    lastSuccessfulOrder = null;
    orderCounter = 2041;

    statVault.textContent = '10.00';
    statBudget.textContent = '10.00';
    budgetBadge.textContent = '模拟规则保护';

    resetPipelineToIdle();
    updateButtonsState();

    vaultSafetySummary.textContent = '金库资金状态: 完整受控';

    auditContainer.innerHTML = `
      <div class="p-3.5 bg-[#0f1f2d] border border-dashed border-[#1f3a4d] rounded text-center flex flex-col items-center justify-center gap-1.5" id="audit-empty-state">
        <span class="material-symbols-outlined text-[#38bdf8] text-[28px]">receipt_long</span>
        <div class="text-xs font-semibold text-slate-200">等待发起测试付款...</div>
        <div class="text-[11px] text-[#94a3b8] max-w-sm">
          点击左侧 4 个测试操作即可模拟智能合约的规则判定与安全拦截逻辑。
        </div>
      </div>
    `;

    feedbackText.textContent = '已重置演示状态：金库额度恢复为 10.00，随时可重新测试';
    feedbackIcon.textContent = 'restart_alt';
  });

  // 初始化设置
  updateButtonsState();
  resetPipelineToIdle();
})();
