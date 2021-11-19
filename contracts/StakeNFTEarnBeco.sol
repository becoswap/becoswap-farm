// SPDX-License-Identifier: MIT

pragma solidity >=0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./libs/IGetStakingPower.sol";
import "./libs/IMasterchef.sol";

contract StakeNFTEarnBeco is
    ERC20,
    Ownable,
    ERC721Holder,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Address for address;
    using EnumerableSet for EnumerableSet.UintSet;

    // Info of each user.
    struct UserInfo {
        uint256 stakingPower;
        uint256 rewardDebt;
    }

    uint256 poolId;
    uint256 accBecoPerShare; // Accumulated Becos per share, times 1e12. See below.
    uint256 public constant accBecoPerShareMultiple = 1E20;
    uint256 public lastRewardBlock;
    // total has stake to MasterChef stakingPower
    uint256 public totalStakingPower;
    IERC721 public immutable erc721;
    address public constant beco = 0x64c8B3628EAF34AEfeFc3Cf6C9017Fd20611717c;
    IMasterchef public immutable masterChef;
    IGetStakingPower public immutable getStakingPowerProxy;
    bool public immutable isMintPowerTokenEveryTimes;
    mapping(uint256 => bool) private _mintPowers;
    mapping(address => UserInfo) private _userInfoMap;
    mapping(address => EnumerableSet.UintSet) private _stakingTokens;

    event Harvest(address indexed user, uint256 amount);
    event Stake(address indexed user, uint256 indexed tokenId, uint256 amount);
    event Unstake(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount
    );
    event EmergencyUnstake(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount
    );
    event EmergencyUnstakeAllFromBeco(address indexed user, uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        address _masterChef,
        uint256 _poolId,
        address _erc721,
        address _getStakingPower,
        bool _isMintPowerTokenEveryTimes
    ) public ERC20(_name, _symbol) {
        masterChef = IMasterchef(_masterChef);
        erc721 = IERC721(_erc721);
        getStakingPowerProxy = IGetStakingPower(_getStakingPower);
        isMintPowerTokenEveryTimes = _isMintPowerTokenEveryTimes;
        poolId = _poolId;
    }

    function getStakingPower(uint256 _tokenId) public view returns (uint256) {
        return getStakingPowerProxy.getStakingPower(address(erc721), _tokenId);
    }

    function setPoolId(uint256 _poolId) external onlyOwner whenNotPaused {
        require(poolId == 0, "cannot set pool");
        poolId = _poolId;
    }

    // View function to see pending Becos on frontend.
    function pendingBeco(address _user) external view returns (uint256) {
        UserInfo memory userInfo = _userInfoMap[_user];
        uint256 _accBecoPerShare = accBecoPerShare;
        if (totalStakingPower != 0) {
            uint256 totalPendingBeco = masterChef.pendingBeco(
                poolId,
                address(this)
            );
            _accBecoPerShare = _accBecoPerShare.add(
                totalPendingBeco.mul(accBecoPerShareMultiple).div(
                    totalStakingPower
                )
            );
        }
        return
            userInfo
                .stakingPower
                .mul(_accBecoPerShare)
                .div(accBecoPerShareMultiple)
                .sub(userInfo.rewardDebt);
    }

    function updateStaking() public {
        if (block.number <= lastRewardBlock) {
            return;
        }
        if (totalStakingPower == 0) {
            lastRewardBlock = block.number;
            return;
        }
        (, uint256 lastRewardDebt) = masterChef.userInfo(poolId, address(this));
        masterChef.deposit(poolId, 0, address(0x0));
        (, uint256 newRewardDebt) = masterChef.userInfo(poolId, address(this));
        accBecoPerShare = accBecoPerShare.add(
            newRewardDebt.sub(lastRewardDebt).mul(accBecoPerShareMultiple).div(
                totalStakingPower
            )
        );
        lastRewardBlock = block.number;
    }

    function _harvest(UserInfo storage userInfo) internal {
        updateStaking();
        if (userInfo.stakingPower != 0) {
            uint256 pending = userInfo
                .stakingPower
                .mul(accBecoPerShare)
                .div(accBecoPerShareMultiple)
                .sub(userInfo.rewardDebt);
            if (pending != 0) {
                safeBecoTransfer(_msgSender(), pending);
                emit Harvest(_msgSender(), pending);
            }
        }
    }

    function harvest() external {
        UserInfo storage userInfo = _userInfoMap[_msgSender()];
        _harvest(userInfo);
        userInfo.rewardDebt = userInfo.stakingPower.mul(accBecoPerShare).div(
            accBecoPerShareMultiple
        );
    }

    function stake(uint256 _tokenId) public nonReentrant whenNotPaused {
        UserInfo storage userInfo = _userInfoMap[_msgSender()];
        _harvest(userInfo);
        uint256 stakingPower = getStakingPower(_tokenId);
        if (isMintPowerTokenEveryTimes || !_mintPowers[_tokenId]) {
            _mint(address(this), stakingPower);
            _mintPowers[_tokenId] = true;
        }

        erc721.safeTransferFrom(_msgSender(), address(this), _tokenId);
        userInfo.stakingPower = userInfo.stakingPower.add(stakingPower);
        _stakingTokens[_msgSender()].add(_tokenId);
        _approveToMasterIfNecessary(stakingPower);
        masterChef.deposit(poolId, stakingPower, address(0x0));
        totalStakingPower = totalStakingPower.add(stakingPower);
        userInfo.rewardDebt = userInfo.stakingPower.mul(accBecoPerShare).div(
            accBecoPerShareMultiple
        );
        emit Stake(_msgSender(), _tokenId, stakingPower);
    }

    function batchStake(uint256[] calldata _tokenIds) external whenNotPaused {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            stake(_tokenIds[i]);
        }
    }

    function unstake(uint256 _tokenId) public nonReentrant {
        require(
            _stakingTokens[_msgSender()].contains(_tokenId),
            "UNSTAKE FORBIDDEN"
        );
        UserInfo storage userInfo = _userInfoMap[_msgSender()];
        _harvest(userInfo);
        uint256 stakingPower = getStakingPower(_tokenId);
        userInfo.stakingPower = userInfo.stakingPower.sub(stakingPower);
        _stakingTokens[_msgSender()].remove(_tokenId);
        erc721.safeTransferFrom(address(this), _msgSender(), _tokenId);
        masterChef.withdraw(poolId, stakingPower);
        totalStakingPower = totalStakingPower.sub(stakingPower);
        userInfo.rewardDebt = userInfo.stakingPower.mul(accBecoPerShare).div(
            accBecoPerShareMultiple
        );
        if (isMintPowerTokenEveryTimes) {
            _burn(address(this), stakingPower);
        }
        emit Unstake(_msgSender(), _tokenId, stakingPower);
    }

    function batchUnstake(uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            unstake(_tokenIds[i]);
        }
    }

    function unstakeAll() external {
        EnumerableSet.UintSet storage stakingTokens = _stakingTokens[
            _msgSender()
        ];
        uint256 length = stakingTokens.length();
        for (uint256 i = 0; i < length; ++i) {
            unstake(stakingTokens.at(0));
        }
    }

    function _approveToMasterIfNecessary(uint256 amount) internal {
        uint256 currentAllowance = allowance(
            address(this),
            address(masterChef)
        );
        if (currentAllowance < amount) {
            _approve(
                address(this),
                address(masterChef),
                2**256 - 1 - currentAllowance
            );
        }
    }

    function pauseStake() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpauseStake() external onlyOwner whenPaused {
        _unpause();
    }

    function emergencyUnstake(uint256 _tokenId) external nonReentrant {
        require(
            _stakingTokens[_msgSender()].contains(_tokenId),
            "EMERGENCY UNSTAKE FORBIDDEN"
        );
        UserInfo storage userInfo = _userInfoMap[_msgSender()];
        uint256 stakingPower = getStakingPower(_tokenId);
        userInfo.stakingPower = userInfo.stakingPower.sub(stakingPower);
        _stakingTokens[_msgSender()].remove(_tokenId);
        erc721.safeTransferFrom(address(this), _msgSender(), _tokenId);
        totalStakingPower = totalStakingPower.sub(stakingPower);
        userInfo.rewardDebt = userInfo.stakingPower.mul(accBecoPerShare).div(
            accBecoPerShareMultiple
        );
        emit EmergencyUnstake(_msgSender(), _tokenId, stakingPower);
    }

    function emergencyUnstakeAllFromBeco()
        external
        nonReentrant
        onlyOwner
        whenPaused
    {
        masterChef.emergencyWithdraw(poolId);
    }

    function safeBecoTransfer(address _to, uint256 _amount) internal {
        uint256 bal = IERC20(beco).balanceOf(address(this));
        if (_amount > bal) {
            IERC20(beco).transfer(_to, bal);
        } else {
            IERC20(beco).transfer(_to, _amount);
        }
    }

    function getUserInfo(address user)
        public
        view
        returns (
            uint256,
            uint256,
            uint256[] memory
        )
    {
        UserInfo memory userInfo = _userInfoMap[user];
        uint256[] memory tokenIds = new uint256[](
            _stakingTokens[user].length()
        );
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            tokenIds[i] = _stakingTokens[user].at(i);
        }
        return (userInfo.stakingPower, userInfo.rewardDebt, tokenIds);
    }
}
