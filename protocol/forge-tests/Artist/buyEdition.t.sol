// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/utils/Strings.sol";
import {IERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "../TestConfig.sol";

contract Artist_buyEdition is TestConfig {
    event EditionPurchased(
        uint256 indexed editionId,
        uint256 indexed tokenId,
        uint32 numSold,
        address indexed buyer,
        uint256 ticketNumber
    );

    // Test reverts with "Edition does not exist" when expected.
    function test_buyEditionRevertsForNonExistingEdition() public {
        vm.expectRevert(bytes("Edition does not exist"));
        vm.prank(BUYERS[0]);
        artistContract.buyEdition{value: PRICE}(
            69420,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts with "This edition is already sold out" when expected.
    function test_buyEditionRevertsForSoldOutEdition() public {
        uint32 quantity = 2;
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        vm.prank(BUYERS[0]);

        for (uint256 i; i < quantity; ++i) {
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                EMPTY_SIGNATURE,
                TICKET_NUM_ZERO
            );
        }

        // Note: this error ends with a period `.`, which is inconsistent.
        vm.expectRevert(bytes("This edition is already sold out."));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if there are no permissioned tokens and open auction hasn't started.
    function test_buyEditionRevertsForNoPermissionedTokensBeforeAuction()
        public
    {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 permissionedQuantity = 0;
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            QUANTITY,
            ROYALTY_BPS,
            startTime,
            END_TIME,
            permissionedQuantity,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        vm.prank(BUYERS[0]);

        vm.expectRevert(
            bytes("No permissioned tokens available & open auction not started")
        );
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if permissioned quantity is sold out and open auction hasn't started.
    function test_buyEditionRevertsForSoldOutPermissionedTokensBeforeAuction()
        public
    {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1;

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
            ""
        );

        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );

        vm.expectRevert(
            bytes("No permissioned tokens available & open auction not started")
        );
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }

    // Test disallows purchase if no permissioned exists and quantity remains .
    function test_buyEditionRevertsForNoPermissionedAndQuantityRemainsBeforeAuction()
        public
    {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 1;
        uint32 permissionedQuantity = 0;

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
            ""
        );

        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        vm.expectRevert(
            bytes("No permissioned tokens available & open auction not started")
        );
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if ticket number exceeds maximum.
    function test_buyEditionRevertsForTicketNumberAboveMaximum() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 permissionedQuantity = type(uint32).max;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            QUANTITY,
            ROYALTY_BPS,
            startTime,
            END_TIME,
            permissionedQuantity,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        uint256 ticketNumber = uint256(permissionedQuantity) + 1;
        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            ticketNumber
        );

        vm.prank(BUYERS[0]);

        vm.expectRevert(bytes("Ticket number exceeds max"));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            ticketNumber
        );
    }

    // Test reverts with "Auction has ended" when expected.
    function test_buyEditionRevertsAfterAuction() public {
        uint32 startTime = uint32(block.timestamp);
        uint32 endTime = startTime + 1;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            QUANTITY,
            ROYALTY_BPS,
            startTime,
            endTime,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        vm.prank(BUYERS[0]);
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );

        vm.warp(endTime);
        vm.expectRevert(bytes("Auction has ended"));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if signature is null.
    function test_buyEditionRevertsForEmptySignature() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 permissionedQuantity = 1;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            QUANTITY,
            ROYALTY_BPS,
            startTime,
            END_TIME,
            permissionedQuantity,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        vm.prank(BUYERS[0]);

        vm.expectRevert(bytes("ECDSA: invalid signature length"));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if signature is for the wrong artist contract.
    function test_buyEditionRevertsForWrongArtistContract() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1;

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
            ""
        );

        // Get the signature with a wrong artistContract address.
        bytes memory createArtistSignature = getCreateArtistSignature(
            SOUND_ADMIN_ADDRESS
        );
        vm.prank(SOUND_ADMIN_ADDRESS);
        ArtistV6 wrongArtistContract = ArtistV6(
            artistCreator.createArtist(
                createArtistSignature,
                ARTIST_NAME,
                ARTIST_SYMBOL,
                BASE_URI
            )
        );
        bytes memory signature = getPresaleSignature(
            wrongArtistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        vm.expectRevert(bytes("Invalid signer"));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if signature is signed by wrong address.
    function test_buyEditionRevertsForWrongSignatureAddress() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1;

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
            ""
        );

        uint256 wrongPrivateKey = 0x12345;
        bytes memory signature = getPresaleSignature(
            artistContract,
            wrongPrivateKey,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        vm.expectRevert(bytes("Invalid signer"));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if signature is for the wrong edition during permissioned sale.
    function test_buyEditionRevertsForWrongSignatureEditionId() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1;

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
            ""
        );

        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID + 1,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        vm.expectRevert(bytes("Invalid signer"));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }

    // Test reverts if buyer attempts to reuse ticket.
    function test_buyEditionRevertsForReusedTicket() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 2;
        uint32 permissionedQuantity = 2;

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
            ""
        );

        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );

        vm.expectRevert(bytes("Invalid ticket number or NFT already claimed"));
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }

    // Test enables range editions: signed purchases can exceed quantity prior to the public sale start time.
    function test_buyEditionSignedPurchasesCanExceedQuantity() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1000;

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
            ""
        );
        // Test some purchases in order
        for (uint256 i; i < quantity * 2; ++i) {
            uint256 ticketNumber = i;
            uint256 buyerIndex = i % BUYERS.length;
            bytes memory signature = getPresaleSignature(
                artistContract,
                ADMIN_PRIV_KEY,
                BUYERS[buyerIndex],
                EDITION_ID,
                ticketNumber
            );
            vm.prank(BUYERS[buyerIndex]);
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                signature,
                ticketNumber
            );
        }
        // test a couple purchases out of order in the higher end of the presale quantity
        for (uint256 i; i < quantity * 2; ++i) {
            uint256 ticketNumber = permissionedQuantity - i;
            uint256 buyerIndex = i % BUYERS.length;
            bytes memory signature = getPresaleSignature(
                artistContract,
                ADMIN_PRIV_KEY,
                BUYERS[buyerIndex],
                EDITION_ID,
                ticketNumber
            );
            vm.prank(BUYERS[buyerIndex]);
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                signature,
                ticketNumber
            );
        }
    }

    // Test doesn't require signature if public sale has started, permissioned hasn't sold out,
    // and its not a fully whitelisted sale `(permissionedQuantity < quantity)`.
    function test_buyEditionNoSignaturePurchaseIfNoPermissionedSoldOut()
        public
    {
        uint32 startTime = uint32(block.timestamp);
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1;

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
            ""
        );

        vm.prank(BUYERS[0]);

        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );
    }

    // Test creates an event log for the purchase.
    function test_buyEditionCreatesLog() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1;

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
            ""
        );

        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        uint32 tokenCount = 1;
        uint256 tokenId = getTokenId(EDITION_ID, tokenCount);

        vm.expectEmit(true, true, true, true);
        emit EditionPurchased(
            EDITION_ID,
            tokenId,
            tokenCount,
            BUYERS[0],
            TICKET_NUM_ZERO
        );
        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }

    // Test updates the number sold for the editions.
    function test_buyEditionUpdatesNumberSold() public {
        uint32 quantity = 3;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        for (uint256 i; i < quantity; ++i) {
            vm.prank(BUYERS[i]);
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                EMPTY_SIGNATURE,
                TICKET_NUM_ZERO
            );
            (, , uint32 numSold, , , , , , , ) = artistContract.editions(
                EDITION_ID
            );
            assertEq(numSold, uint32(i + 1));
        }
    }

    // Test `ownerOf` returns the correct owner.
    function test_buyEditionOwnerOf() public {
        uint32 quantity = 3;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        for (uint256 i; i < quantity; ++i) {
            vm.prank(BUYERS[i]);
            uint256 tokenId = getTokenId(EDITION_ID, uint32(i + 1));
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                EMPTY_SIGNATURE,
                TICKET_NUM_ZERO
            );
            address owner = artistContract.ownerOf(tokenId);
            assertEq(BUYERS[i], owner);
        }
    }

    // Test increments the balance of the artist contract.
    function test_buyEditionIncrementsContractBalance() public {
        uint32 quantity = 3;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        uint256 expectedBalance = 0;

        for (uint256 i; i < quantity; ++i) {
            vm.prank(BUYERS[i]);
            expectedBalance += PRICE;
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                EMPTY_SIGNATURE,
                TICKET_NUM_ZERO
            );
            assertEq(address(artistContract).balance, expectedBalance);
        }
    }

    // Test sends funds directly to `fundingRecipient` if not assigned to artist's wallet.
    function test_buyEditionIncrementsRecipientBalance() public {
        uint32 quantity = 3;
        // using custom fundingRecipient because the default `fundingRecipient` is the artist's wallet.
        address fundingRecipient = SOUND_ADMIN_ADDRESS;
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(fundingRecipient),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        uint256 expectedBalance = fundingRecipient.balance;

        for (uint256 i; i < quantity; ++i) {
            vm.prank(BUYERS[i]);
            expectedBalance += PRICE;
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                EMPTY_SIGNATURE,
                TICKET_NUM_ZERO
            );
            assertEq(fundingRecipient.balance, expectedBalance);
        }
    }

    // Test `tokenURI` returns expected string.
    function test_buyEditionTokenURI() public {
        uint32 quantity = 3;
        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            PERMISSIONED_QUANTITY,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            BASE_URI
        );

        for (uint256 i; i < quantity; ++i) {
            vm.prank(BUYERS[i]);
            uint256 tokenId = getTokenId(EDITION_ID, i + 1);
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                EMPTY_SIGNATURE,
                TICKET_NUM_ZERO
            );
            assertEq(
                string.concat(
                    BASE_URI,
                    Strings.toString(tokenId),
                    "/metadata.json"
                ),
                artistContract.tokenURI(tokenId)
            );
        }
    }

    // Test allows purchase during permissioned sale.
    function test_buyEditionPermissionedPurchaseBeforeAuction() public {
        uint32 startTime = uint32(block.timestamp) + 1;
        uint32 quantity = 10;
        uint32 permissionedQuantity = 10;

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
            ""
        );

        for (uint256 i; i < quantity; ++i) {
            uint256 ticketNumber = i + 1;
            uint256 buyerIndex = i % BUYERS.length;
            bytes memory signature = getPresaleSignature(
                artistContract,
                ADMIN_PRIV_KEY,
                BUYERS[buyerIndex],
                EDITION_ID,
                ticketNumber
            );
            vm.prank(BUYERS[buyerIndex]);
            artistContract.buyEdition{value: PRICE}(
                EDITION_ID,
                signature,
                ticketNumber
            );
        }
    }

    // Test signature is ignored during the auction.
    function test_buyEditionSignatureIgnored() public {
        uint32 quantity = 2;
        uint32 permissionedQuantity = 2;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            permissionedQuantity,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );

        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            EMPTY_SIGNATURE,
            TICKET_NUM_ZERO
        );
    }

    // Test allows purchase if permissioned is sold out but quantity remains.
    function test_buyEditionPurchaseIfQuantitySoldOutButPermissionedRemains()
        public
    {
        uint32 quantity = 2;
        uint32 permissionedQuantity = 1;

        vm.prank(ARTIST1_ADDRESS);
        artistContract.createEdition(
            payable(FUNDING_RECIPIENT),
            PRICE,
            quantity,
            ROYALTY_BPS,
            START_TIME,
            END_TIME,
            permissionedQuantity,
            SOUND_ADMIN_ADDRESS,
            EDITION_ID,
            ""
        );

        bytes memory signature = getPresaleSignature(
            artistContract,
            ADMIN_PRIV_KEY,
            BUYERS[0],
            EDITION_ID,
            TICKET_NUM_ZERO
        );

        vm.prank(BUYERS[0]);

        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );

        artistContract.buyEdition{value: PRICE}(
            EDITION_ID,
            signature,
            TICKET_NUM_ZERO
        );
    }
}
