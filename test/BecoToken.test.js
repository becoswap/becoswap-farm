const { expectRevert } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

const BecoToken = artifacts.require('BecoToken');

contract('BECOToken', ([alice, bob, carol, operator, owner]) => {
    beforeEach(async () => {
        this.beco = await BecoToken.new({ from: owner });
        this.burnAddress = '0x000000000000000000000000000000000000dEaD';
        this.zeroAddress = '0x0000000000000000000000000000000000000000';
    });

    it('only operator', async () => {
        assert.equal((await this.beco.owner()), owner);
        assert.equal((await this.beco.operator()), owner);

        await expectRevert(this.beco.updateTransferTaxRate(500, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.beco.updateBurnRate(20, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.beco.updateSwapAndLiquifyEnabled(true, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.beco.updateBecoSwapRouter(operator, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.beco.updateMinAmountToLiquify(100, { from: operator }), 'operator: caller is not the operator');
        await expectRevert(this.beco.transferOperator(alice, { from: operator }), 'operator: caller is not the operator');
    });

    it('transfer operator', async () => {
        await expectRevert(this.beco.transferOperator(operator, { from: operator }), 'operator: caller is not the operator');
        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        await expectRevert(this.beco.transferOperator(this.zeroAddress, { from: operator }), 'BECO::transferOperator: new operator is the zero address');
    });

    it('update transfer tax rate', async () => {
        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        assert.equal((await this.beco.transferTaxRate()).toString(), '1000');
        assert.equal((await this.beco.burnRate()).toString(), '20');

        await this.beco.updateTransferTaxRate(0, { from: operator });
        assert.equal((await this.beco.transferTaxRate()).toString(), '0');
        await this.beco.updateTransferTaxRate(1000, { from: operator });
        assert.equal((await this.beco.transferTaxRate()).toString(), '1000');
        await expectRevert(this.beco.updateTransferTaxRate(1001, { from: operator }), 'BECO::updateTransferTaxRate: Transfer tax rate must not exceed the maximum rate.');

        await this.beco.updateBurnRate(0, { from: operator });
        assert.equal((await this.beco.burnRate()).toString(), '0');
        await this.beco.updateBurnRate(100, { from: operator });
        assert.equal((await this.beco.burnRate()).toString(), '100');
        await expectRevert(this.beco.updateBurnRate(101, { from: operator }), 'BECO::updateBurnRate: Burn rate must not exceed the maximum rate.');
    });

    it('transfer', async () => {
        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        await this.beco.mint(alice, 10000000, { from: owner }); // max transfer amount 25,000
        assert.equal((await this.beco.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');

        await this.beco.transfer(bob, 12345, { from: alice });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '9987655');
        assert.equal((await this.beco.balanceOf(bob)).toString(), '11111');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '246');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '988');

        await this.beco.approve(carol, 22345, { from: alice });
        await this.beco.transferFrom(alice, carol, 22345, { from: carol });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '9965310');
        assert.equal((await this.beco.balanceOf(carol)).toString(), '20111');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '692');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '2776');
    });

    it('transfer small amount', async () => {
        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        await this.beco.mint(alice, 10000000, { from: owner });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');

        await this.beco.transfer(bob, 5, { from: alice });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '9999995');
        assert.equal((await this.beco.balanceOf(bob)).toString(), '5');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');
    });

    it('transfer without transfer tax', async () => {
        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        assert.equal((await this.beco.transferTaxRate()).toString(), '1000');
        assert.equal((await this.beco.burnRate()).toString(), '20');

        await this.beco.updateTransferTaxRate(0, { from: operator });
        assert.equal((await this.beco.transferTaxRate()).toString(), '0');

        await this.beco.mint(alice, 10000000, { from: owner });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');

        await this.beco.transfer(bob, 10000, { from: alice });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '9990000');
        assert.equal((await this.beco.balanceOf(bob)).toString(), '10000');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');
    });

    it('transfer without burn', async () => {
        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        assert.equal((await this.beco.transferTaxRate()).toString(), '1000');
        assert.equal((await this.beco.burnRate()).toString(), '20');

        await this.beco.updateBurnRate(0, { from: operator });
        assert.equal((await this.beco.burnRate()).toString(), '0');

        await this.beco.mint(alice, 10000000, { from: owner });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');

        await this.beco.transfer(bob, 1234, { from: alice });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '9998766');
        assert.equal((await this.beco.balanceOf(bob)).toString(), '1111');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '123');
    });

    it('transfer all burn', async () => {
        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        assert.equal((await this.beco.transferTaxRate()).toString(), '1000');
        assert.equal((await this.beco.burnRate()).toString(), '20');

        await this.beco.updateBurnRate(100, { from: operator });
        assert.equal((await this.beco.burnRate()).toString(), '100');

        await this.beco.mint(alice, 10000000, { from: owner });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '10000000');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '0');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');

        await this.beco.transfer(bob, 1234, { from: alice });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '9998766');
        assert.equal((await this.beco.balanceOf(bob)).toString(), '1111');
        assert.equal((await this.beco.balanceOf(this.burnAddress)).toString(), '123');
        assert.equal((await this.beco.balanceOf(this.beco.address)).toString(), '0');
    });

    it('update SwapAndLiquifyEnabled', async () => {
        await expectRevert(this.beco.updateSwapAndLiquifyEnabled(true, { from: operator }), 'operator: caller is not the operator');
        assert.equal((await this.beco.swapAndLiquifyEnabled()), false);

        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        await this.beco.updateSwapAndLiquifyEnabled(true, { from: operator });
        assert.equal((await this.beco.swapAndLiquifyEnabled()), true);
    });

    it('update min amount to liquify', async () => {
        await expectRevert(this.beco.updateMinAmountToLiquify(100, { from: operator }), 'operator: caller is not the operator');
        assert.equal((await this.beco.minAmountToLiquify()).toString(), '500000000000000000000');

        await this.beco.transferOperator(operator, { from: owner });
        assert.equal((await this.beco.operator()), operator);

        await this.beco.updateMinAmountToLiquify(100, { from: operator });
        assert.equal((await this.beco.minAmountToLiquify()).toString(), '100');
    });
});