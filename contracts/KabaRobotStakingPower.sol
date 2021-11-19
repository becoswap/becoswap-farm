// SPDX-License-Identifier: MIT

pragma solidity >=0.6.6;

import "./libs/IGetStakingPower.sol";

interface IRobotNFT {
    function getRobotInfo(uint256 _tokenId)
        external
        view
        returns (
            bool isActive,
            bool isCrafted,
            uint8 cardId,
            uint256[] memory stats,
            uint256[] memory skinBase,
            uint8 level
        );
}

contract KabaRobotStakingPower is IGetStakingPower {
    constructor() public {}

    function getStakingPower(address _erc721, uint256 _tokenId)
        external
        view
        override
        returns (uint256)
    {
        (, , uint8 cardId) = IRobotNFT(_erc721).getRobotInfo(
            _tokenId
        );
        return cardId * level;
    }
}
