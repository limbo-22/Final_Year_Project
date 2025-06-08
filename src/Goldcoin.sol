// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title GameToken - Custom ERC-20 Token for Web3 Game
/// @notice This token can be used as in-game currency (e.g., Gold Coins)
contract GameToken is ERC20, Ownable {
    constructor(uint256 initialSupply ) ERC20("GameToken", "GTKN") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /// @notice Mint new tokens (only owner can call this)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burn tokens from an address (only owner)
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}