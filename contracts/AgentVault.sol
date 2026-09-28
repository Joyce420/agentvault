// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Prototype using native test assets. Not audited; no x402 integration.
contract AgentVault {
    address public immutable owner;
    address public agent;
    uint256 public immutable budget;
    uint256 public immutable perPaymentLimit;
    uint256 public spent;
    bool public paused;
    bool private entered;
    mapping(address => bool) public merchants;
    mapping(bytes32 => bool) public paidOrders;
    event Paid(bytes32 indexed orderId, address indexed merchant, uint256 amount);
    event MerchantUpdated(address indexed merchant, bool allowed);
    event Paused(bool value);
    event Withdrawn(uint256 amount);

    constructor(address operator, uint256 totalBudget, uint256 paymentLimit) payable {
        require(operator != address(0) && totalBudget > 0 && paymentLimit > 0 && paymentLimit <= totalBudget, "Invalid configuration");
        owner = msg.sender; agent = operator; budget = totalBudget; perPaymentLimit = paymentLimit;
    }
    modifier onlyOwner() { require(msg.sender == owner, "Owner only"); _; }
    modifier nonReentrant() { require(!entered, "Reentrant"); entered = true; _; entered = false; }
    receive() external payable {}
    function setMerchant(address merchant, bool allowed) external onlyOwner {
        require(merchant != address(0) && merchant != address(this), "Invalid merchant");
        merchants[merchant] = allowed; emit MerchantUpdated(merchant, allowed);
    }
    function setPaused(bool value) external onlyOwner { paused = value; emit Paused(value); }
    function pay(bytes32 orderId, address payable merchant, uint256 amount) external nonReentrant {
        require(msg.sender == agent, "Agent only");
        require(!paused, "Paused");
        require(merchants[merchant], "Merchant not allowed");
        require(orderId != bytes32(0) && !paidOrders[orderId], "Invalid or paid order");
        require(amount > 0 && amount <= perPaymentLimit, "Per-payment limit");
        require(amount <= budget - spent, "Budget exceeded");
        require(amount <= address(this).balance, "Insufficient funds");
        paidOrders[orderId] = true; spent += amount;
        (bool ok,) = merchant.call{value: amount}(""); require(ok, "Transfer failed");
        emit Paid(orderId, merchant, amount);
    }
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(paused, "Pause first");
        (bool ok,) = payable(owner).call{value: amount}(""); require(ok, "Transfer failed");
        emit Withdrawn(amount);
    }
}
