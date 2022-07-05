// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import '@openzeppelin/contracts/utils/Strings.sol';
import {IERC2981Upgradeable} from '@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol';
import '../TestConfig.sol';

contract Artist_createEdition is TestConfig {
    event EditionCreated(
        uint256 indexed editionId,
        address fundingRecipient,
        uint256 price,
        uint32 quantity,
        uint32 royaltyBPS,
        uint32 startTime,
        uint32 endTime,
        uint32 permissionedQuantity,
        address signerAddress
    );

    // Test if the `EditionCreated` event is emitted with the correct arguments.
    // The fuzz test will also test that `permissionedQuantity` is allowed to be
    // greater than `quantity`.
    function test_createEditionEmitsLog(
        uint8 editionCount,
        address payable fundingRecipient,
        uint256 price,
        uint32 quantity,
        uint32 royaltyBPS,
        uint32 permissionedQuantity,
        uint32 startTime,
        uint32 endTime,
        address signerAddress
    ) public {
        vm.assume(editionCount < 3); // Restrict to a small number for faster testing.
        vm.assume(quantity > 0);
        vm.assume(endTime > startTime);
        vm.assume(fundingRecipient != address(0));
        if (permissionedQuantity > 0) {
            vm.assume(signerAddress != address(0));
        }

        for (uint256 i; i < editionCount; ++i) {
            uint256 editionId = i + 1;
            vm.prank(ARTIST1_ADDRESS);
            vm.expectEmit(true, false, false, true);
            emit EditionCreated(
                editionId,
                fundingRecipient,
                price,
                quantity,
                royaltyBPS,
                startTime,
                endTime,
                permissionedQuantity,
                signerAddress
            );
            artistContract.createEdition(
                fundingRecipient,
                price,
                quantity,
                royaltyBPS,
                startTime,
                endTime,
                permissionedQuantity,
                signerAddress,
                editionId,
                ''
            );
        }
    }

    // Test 'editions(tokenId)' returns correct info.
    function test_createEditionGetEdition(
        uint8 editionCount,
        address payable fundingRecipient,
        uint256 price,
        uint32 quantity,
        uint32 royaltyBPS,
        uint32 permissionedQuantity,
        uint32 startTime,
        uint32 endTime,
        address signerAddress,
        string memory baseURI
    ) public {
        vm.assume(editionCount < 3); // Restrict to a small number for faster testing.
        vm.assume(quantity > 0);
        vm.assume(endTime > startTime);
        if (permissionedQuantity > 0) {
            vm.assume(signerAddress != address(0));
        }

        for (uint256 i; i < editionCount; ++i) {
            uint256 editionId = i + 1;
            vm.prank(ARTIST1_ADDRESS);
            artistContract.createEdition(
                fundingRecipient,
                price,
                quantity,
                royaltyBPS,
                startTime,
                endTime,
                permissionedQuantity,
                signerAddress,
                editionId,
                baseURI
            );

            (
                address payable fundingRecipient_,
                uint256 price_,
                uint32 numSold_,
                uint32 quantity_,
                uint32 royaltyBPS_,
                uint32 startTime_,
                uint32 endTime_,
                uint32 permissionedQuantity_,
                address signerAddress_,
                string memory baseURI_
            ) = artistContract.editions(editionId);

            assertEq(fundingRecipient_, fundingRecipient_);
            assertEq(price_, price_);
            assertEq(numSold_, numSold_);
            assertEq(quantity_, quantity_);
            assertEq(royaltyBPS_, royaltyBPS_);
            assertEq(startTime_, startTime_);
            assertEq(endTime_, endTime_);
            assertEq(permissionedQuantity_, permissionedQuantity_);
            assertEq(signerAddress_, signerAddress_);
            assertEq(baseURI_, baseURI);
        }
    }

    // Test reverts if called by an unauthorized address.
    function test_createEditionRevertsForUnauthorizedCaller() public {
        vm.expectRevert(bytes('unauthorized'));
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            1,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ''
        );
    }

    // Test reverts if `quantity` is 0.
    function test_createEditionRevertsForZeroQuantity() public {
        vm.expectRevert(bytes('Must set quantity'));
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            0,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ''
        );
    }

    // Test reverts if no `fundingRecipient` is given.
    function test_createEditionRevertsForZeroAddressFundingReceipient() public {
        vm.expectRevert(bytes('Must set fundingRecipient'));
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(address(0)),
            PRICE,
            1,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ''
        );
    }

    // Test reverts if end time exceeds start time.
    function test_createEditionRevertsForEndTimeExceedsStartTime(uint32 startTime, uint32 endTime) public {
        vm.assume(!(endTime > startTime));
        vm.expectRevert(bytes('End time must be greater than start time'));
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            1,
            ROYALTY_BPS,
            startTime,
            endTime,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ''
        );
    }

    // Test reverts if `signerAddress` is the zero address if `permissionedQuantity` is non-zero.
    function test_createEditionRevertsForZeroAddressSignerForNonZeroPermissionedQuantity(
        uint32 quantity,
        uint32 permissionedQuantity
    ) public {
        vm.assume(quantity > 0);
        vm.assume(permissionedQuantity > 0);
        vm.expectRevert(bytes('Signer address cannot be 0'));
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            1,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            permissionedQuantity,
            address(0),
            EDITION_ID,
            ''
        );
    }

    // Test reverts if `editionId` is incorrect.
    function test_createEditionRevertsForIncorrectEditionId(uint32 editionId) public {
        vm.assume(editionId != EDITION_ID);
        vm.expectRevert(bytes('Wrong edition ID'));
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            1,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            editionId,
            ''
        );
    }
}
