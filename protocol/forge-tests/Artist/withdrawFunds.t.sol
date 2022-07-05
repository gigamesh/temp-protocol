// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import './../TestConfig.sol';

contract Artist_withdrawFunds is TestConfig {
    // Transfers edition funds to the fundingRecipient
    function test_withdrawFunds() public {
        uint32[] memory tokensPerBuyer = new uint32[](1);
        tokensPerBuyer[0] = 1;

        // Create an edition & buy some tokens
        createEditionAndBuyTokens(BUYERS, tokensPerBuyer);

        uint256 originalBalance = FUNDING_RECIPIENT.balance;

        // Withdraw funds
        artistContract.withdrawFunds(EDITION_ID);

        // Assert balance has been incremented
        uint256 newBalance = FUNDING_RECIPIENT.balance;
        uint256 expectedBalance = originalBalance + BUYERS.length * PRICE;

        assertEq(newBalance, expectedBalance);
    }
}
