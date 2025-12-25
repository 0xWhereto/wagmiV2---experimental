// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MIMToken
 * @notice MIM Stablecoin - 1:1 backed by sUSDC
 * @dev Only authorized minters (MIMMinter contract) can mint/burn
 */
contract MIMToken is ERC20, Ownable {
    /// @notice Mapping of addresses authorized to mint/burn
    mapping(address => bool) public minters;

    /// @notice Emitted when a minter is added or removed
    event MinterUpdated(address indexed minter, bool authorized);

    constructor() ERC20("MIM Stablecoin", "MIM") Ownable(msg.sender) {}

    /**
     * @notice Add or remove a minter
     * @param _minter Address to update
     * @param _authorized Whether the address is authorized to mint/burn
     */
    function setMinter(address _minter, bool _authorized) external onlyOwner {
        minters[_minter] = _authorized;
        emit MinterUpdated(_minter, _authorized);
    }

    /**
     * @notice Mint MIM tokens
     * @param _to Recipient address
     * @param _amount Amount to mint
     */
    function mint(address _to, uint256 _amount) external {
        require(minters[msg.sender], "Not authorized minter");
        _mint(_to, _amount);
    }

    /**
     * @notice Burn MIM tokens
     * @param _from Address to burn from
     * @param _amount Amount to burn
     */
    function burn(address _from, uint256 _amount) external {
        require(minters[msg.sender], "Not authorized minter");
        _burn(_from, _amount);
    }

    /**
     * @notice Burn MIM tokens from caller
     * @param _amount Amount to burn
     */
    function burnFrom(address _from, uint256 _amount) external {
        require(minters[msg.sender], "Not authorized minter");
        uint256 currentAllowance = allowance(_from, msg.sender);
        require(currentAllowance >= _amount, "Insufficient allowance");
        _approve(_from, msg.sender, currentAllowance - _amount);
        _burn(_from, _amount);
    }

    /**
     * @notice Returns the number of decimals (6 to match USDC)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}


