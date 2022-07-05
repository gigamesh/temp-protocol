// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import '../TestConfig.sol';

contract Artist_endToEnd is TestConfig {
    // Buys during public sale and transfers edition funds to the fundingRecipient
    function test_buyEditionAndWithdrawFunds() public {
        uint32 quantity = 10;
        createEdition(quantity);

        uint256 artistWalletInitBalance = FUNDING_RECIPIENT.balance;
        uint256 artistContractInitBalance = address(artistContract).balance;

        for (uint256 i = 1; i <= quantity; i++) {
            uint256 revenue = PRICE * i;
            uint256 ticketNumber = i;
            vm.prank(BUYERS[i]);
            artistContract.buyEdition{value: PRICE}(EDITION_ID, EMPTY_SIGNATURE, ticketNumber);
            assertEq(address(artistContract).balance, revenue + artistContractInitBalance);
        }

        vm.prank(SOUND_ADMIN_ADDRESS);
        artistContract.withdrawFunds(EDITION_ID);

        uint256 totalRevenue = PRICE * quantity;

        // All the funds are withdrawn
        assertEq(address(artistContract).balance, 0);
        assertEq(FUNDING_RECIPIENT.balance, artistWalletInitBalance + totalRevenue);
    }

    // Allows purchase during permissioned sale beyond quantity and reverts additional purchases after public sale start time
    function test_buyEditionPermissionedBeyondQuantityAndRevertsForSoldOutEdition() public {
        uint32 quantity = 1;
        uint32 permissionedQuantity = quantity + 1;
        uint32 secondsUntilStart = 100;
        uint32 startTime = uint32(block.timestamp) + secondsUntilStart;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            startTime,
            END_TIME,
            permissionedQuantity,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ''
        );

        uint256 artistContractInitBalance = address(artistContract).balance;

        for (uint256 i = 1; i <= permissionedQuantity; i++) {
            uint256 revenue = PRICE * i;
            uint256 ticketNumber = i;
            bytes memory signature = getPresaleSignature(
                artistContract,
                ADMIN_PRIV_KEY,
                BUYERS[i],
                EDITION_ID,
                ticketNumber
            );

            vm.prank(BUYERS[i]);
            artistContract.buyEdition{value: PRICE}(EDITION_ID, signature, ticketNumber);

            assertEq(address(artistContract).balance, revenue + artistContractInitBalance);
        }

        // Jump to after the startTime
        vm.warp(startTime + 100);

        address finalBuyer = BUYERS[permissionedQuantity + 1];
        uint256 finalTicketNum = permissionedQuantity + 1;
        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            finalBuyer,
            EDITION_ID,
            finalTicketNum
        );

        vm.prank(finalBuyer);
        vm.expectRevert(bytes('This edition is already sold out.'));
        artistContract.buyEdition{value: PRICE}(EDITION_ID, signature, finalTicketNum);
    }

    // Allows purchase during permissioned sale and after public sale if quantity hasn't been reached
    function test_buyEditionPermissionedAndAfterIfPermissionedSoldOutButQuantityRemains() public {
        uint32 quantity = 10;
        uint32 permissionedQuantity = quantity;
        uint32 secondsUntilStart = 100;
        uint32 startTime = uint32(block.timestamp) + secondsUntilStart;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            startTime,
            END_TIME,
            permissionedQuantity,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ''
        );

        uint256 artistContractInitBalance = address(artistContract).balance;

        for (uint256 i = 1; i <= permissionedQuantity - 1; i++) {
            uint256 revenue = PRICE * i;
            uint256 ticketNumber = i;
            bytes memory signature = getPresaleSignature(
                artistContract,
                ADMIN_PRIV_KEY,
                BUYERS[i],
                EDITION_ID,
                ticketNumber
            );

            vm.prank(BUYERS[i]);
            artistContract.buyEdition{value: PRICE}(EDITION_ID, signature, ticketNumber);

            assertEq(address(artistContract).balance, revenue + artistContractInitBalance);
        }

        // Jump to after the startTime
        vm.warp(startTime + 100);

        address finalBuyer = BUYERS[permissionedQuantity + 1];
        uint256 finalTicketNum = permissionedQuantity + 1;
        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            finalBuyer,
            EDITION_ID,
            finalTicketNum
        );

        (, , uint32 numSold, , , , , , , ) = artistContract.editions(EDITION_ID);
        assertEq(numSold, quantity - 1);

        vm.prank(finalBuyer);
        artistContract.buyEdition{value: PRICE}(EDITION_ID, signature, finalTicketNum);
    }
}
