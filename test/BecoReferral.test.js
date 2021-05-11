const { expectRevert } = require('@openzeppelin/test-helpers');
const { assert } = require("chai");

const BecoReferral = artifacts.require('BecoReferral');

contract('BecoReferral', ([alice, bob, carol, referrer, operator, owner]) => {
    beforeEach(async () => {
        this.becoReferral = await BecoReferral.new({ from: owner });
        this.zeroAddress = '0x0000000000000000000000000000000000000000';
    });

    it('should allow operator and only owner to update operator', async () => {
        assert.equal((await this.becoReferral.operators(operator)).valueOf(), false);
        await expectRevert(this.becoReferral.recordReferral(alice, referrer, { from: operator }), 'Operator: caller is not the operator');

        await expectRevert(this.becoReferral.updateOperator(operator, true, { from: carol }), 'Ownable: caller is not the owner');
        await this.becoReferral.updateOperator(operator, true, { from: owner });
        assert.equal((await this.becoReferral.operators(operator)).valueOf(), true);

        await this.becoReferral.updateOperator(operator, false, { from: owner });
        assert.equal((await this.becoReferral.operators(operator)).valueOf(), false);
        await expectRevert(this.becoReferral.recordReferral(alice, referrer, { from: operator }), 'Operator: caller is not the operator');
    });

    it('record referral', async () => {
        assert.equal((await this.becoReferral.operators(operator)).valueOf(), false);
        await this.becoReferral.updateOperator(operator, true, { from: owner });
        assert.equal((await this.becoReferral.operators(operator)).valueOf(), true);

        await this.becoReferral.recordReferral(this.zeroAddress, referrer, { from: operator });
        await this.becoReferral.recordReferral(alice, this.zeroAddress, { from: operator });
        await this.becoReferral.recordReferral(this.zeroAddress, this.zeroAddress, { from: operator });
        await this.becoReferral.recordReferral(alice, alice, { from: operator });
        assert.equal((await this.becoReferral.getReferrer(alice)).valueOf(), this.zeroAddress);
        assert.equal((await this.becoReferral.referralsCount(referrer)).valueOf(), '0');

        await this.becoReferral.recordReferral(alice, referrer, { from: operator });
        assert.equal((await this.becoReferral.getReferrer(alice)).valueOf(), referrer);
        assert.equal((await this.becoReferral.referralsCount(referrer)).valueOf(), '1');

        assert.equal((await this.becoReferral.referralsCount(bob)).valueOf(), '0');
        await this.becoReferral.recordReferral(alice, bob, { from: operator });
        assert.equal((await this.becoReferral.referralsCount(bob)).valueOf(), '0');
        assert.equal((await this.becoReferral.getReferrer(alice)).valueOf(), referrer);

        await this.becoReferral.recordReferral(carol, referrer, { from: operator });
        assert.equal((await this.becoReferral.getReferrer(carol)).valueOf(), referrer);
        assert.equal((await this.becoReferral.referralsCount(referrer)).valueOf(), '2');
    });

    it('record referral commission', async () => {
        assert.equal((await this.becoReferral.totalReferralCommissions(referrer)).valueOf(), '0');

        await expectRevert(this.becoReferral.recordReferralCommission(referrer, 1, { from: operator }), 'Operator: caller is not the operator');
        await this.becoReferral.updateOperator(operator, true, { from: owner });
        assert.equal((await this.becoReferral.operators(operator)).valueOf(), true);

        await this.becoReferral.recordReferralCommission(referrer, 1, { from: operator });
        assert.equal((await this.becoReferral.totalReferralCommissions(referrer)).valueOf(), '1');

        await this.becoReferral.recordReferralCommission(referrer, 0, { from: operator });
        assert.equal((await this.becoReferral.totalReferralCommissions(referrer)).valueOf(), '1');

        await this.becoReferral.recordReferralCommission(referrer, 111, { from: operator });
        assert.equal((await this.becoReferral.totalReferralCommissions(referrer)).valueOf(), '112');

        await this.becoReferral.recordReferralCommission(this.zeroAddress, 100, { from: operator });
        assert.equal((await this.becoReferral.totalReferralCommissions(this.zeroAddress)).valueOf(), '0');
    });
});