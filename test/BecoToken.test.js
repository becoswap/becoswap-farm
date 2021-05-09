const { assert } = require("chai");

const BecoToken = artifacts.require('BecoToken');

contract('BecoToken', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.beco = await BecoToken.new({ from: minter });
    });


    it('mint', async () => {
        await this.beco.mint(alice, 1000, { from: minter });
        assert.equal((await this.beco.balanceOf(alice)).toString(), '1000');
    })
});
