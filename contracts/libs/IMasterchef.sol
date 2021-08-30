// SPDX-License-Identifier: MIT

pragma solidity >=0.6.6;

interface IMasterchef {
    function pendingBeco(uint256 _pid, address _user)
        external
        view
        returns (uint256);

    function deposit(
        uint256 _pid,
        uint256 _amount,
        address _referrer
    ) external;

    function withdraw(uint256 _pid, uint256 _amount) external;

    function emergencyWithdraw(uint256 _pid) external;

    function userInfo(uint256, address)
        external
        view
        returns (uint256, uint256);
}
