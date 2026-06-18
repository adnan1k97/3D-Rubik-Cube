// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CubeMaster {
    address payable public owner;
    uint256 public constant FEE = 0.000003 ether; // Roughly $0.01

    event ActionPaid(address indexed player, string action, uint256 amount);

    constructor() {
        owner = payable(msg.sender);
    }

    modifier paysFee() {
        require(msg.value >= FEE, "Insufficient fee: must pay $0.01 equivalent in ETH");
        _;
        // Forward the fee to the owner
        owner.transfer(msg.value);
    }

    // Call this before starting a campaign level
    function playLevel() external payable paysFee {
        emit ActionPaid(msg.sender, "PLAY_LEVEL", msg.value);
    }

    // Call this when resetting the cube in simulator mode
    function resetLevel() external payable paysFee {
        emit ActionPaid(msg.sender, "RESET_LEVEL", msg.value);
    }

    // Call this upon completing a level
    function completeLevel() external payable paysFee {
        emit ActionPaid(msg.sender, "COMPLETE_LEVEL", msg.value);
    }
}
