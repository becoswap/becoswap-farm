// SPDX-License-Identifier: MIT

pragma solidity >=0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakeNFTEarnBeco.sol";

contract StakeNFTEarnBecoFactory is Ownable {
    event StakeNFTEarnBecoCreated(address indexed master);

    constructor() public {}

    function create(
        string calldata _name,
        string calldata _symbol,
        address _masterChef,
        uint256 _poolId,
        address _erc721,
        address _getStakingPower,
        bool _isMintPowerTokenEveryTimes
    ) external onlyOwner returns (address) {
        StakeNFTEarnBeco master = new StakeNFTEarnBeco(
            _name,
            _symbol,
            _masterChef,
            _poolId,
            _erc721,
            _getStakingPower,
            _isMintPowerTokenEveryTimes
        );
        Ownable(address(master)).transferOwnership(_msgSender());
        emit StakeNFTEarnBecoCreated(address(master));
        return address(master);
    }
}
