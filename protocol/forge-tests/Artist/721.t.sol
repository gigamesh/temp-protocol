// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import '@openzeppelin/contracts/utils/Strings.sol';
import {IERC2981Upgradeable} from '@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol';
import '../TestConfig.sol';

// Sanity checks for 721 functionality

contract Artist_deployment is TestConfig {
    /***********************************
        Misc 721 tests
    ***********************************/

    // Deploys contract with basic attributes
    function test_deploysArtist() public {
        string memory name = artistContract.name();
        string memory symbol = artistContract.symbol();

        assertEq(name, ARTIST_NAME);
        assertEq(symbol, ARTIST_SYMBOL);
    }

    // Supports EIP-2981 royalty standard
    function test_2981RoyaltySupport() public view {
        assert(artistContract.supportsInterface(type(IERC2981Upgradeable).interfaceId));
    }

    // ownerOf reverts if called for non-existent tokens
    function test_ownerOfRevertsForNonExistentTokens(uint256 tokenId) public {
        vm.expectRevert(bytes('ERC721: owner query for nonexistent token'));
        artistContract.ownerOf(tokenId);
    }

    // tokenURI reverts if called for non-existent tokens
    function test_tokenURIRevertsForNonExistentTokens(uint256 tokenId) public {
        vm.expectRevert(bytes('ERC721Metadata: URI query for nonexistent token'));
        artistContract.tokenURI(tokenId);
    }

    // balanceOf returns 0 for addresses without a balance
    function test_balanceOf() public {
        for (uint256 i = 0; i < BUYERS.length; i++) {
            uint256 balance = artistContract.balanceOf(BUYERS[i]);

            assertEq(balance, 0);
        }
    }

    // totalSupply returns correct supply
    function test_totalSupply() public {
        uint32[] memory tokensPerBuyer = new uint32[](1);
        tokensPerBuyer[0] = 1;

        // Create edition & buy some tokens
        uint32 numSold = createEditionAndBuyTokens(BUYERS, tokensPerBuyer);

        assertEq(artistContract.totalSupply(), numSold);
    }

    /***********************************
        Approval functionality tests
    ***********************************/

    // Can approve an address to control a tokenID and getApprove returns the receiver address
    function test_approve() public {
        uint32[] memory tokensPerBuyer = new uint32[](1);
        tokensPerBuyer[0] = 1;

        // Create edition & buy some tokens
        createEditionAndBuyTokens(BUYERS, tokensPerBuyer);

        address approvee = vm.addr(12345);

        // Approve the approvee for the first token
        uint256 tokenId = (EDITION_ID << 128) | 1;
        vm.prank(BUYERS[0]);
        artistContract.approve(approvee, tokenId);

        assertEq(artistContract.getApproved(tokenId), approvee);
    }

    // transferFrom reverts when not approved
    function test_transferFromRevertsIfNotApproved() public {
        uint32[] memory tokensPerBuyer = new uint32[](1);
        tokensPerBuyer[0] = 1;

        // Create edition & buy some tokens
        createEditionAndBuyTokens(BUYERS, tokensPerBuyer);

        address attacker = vm.addr(666);
        uint256 tokenId = (EDITION_ID << 128) | 1;

        // Set up revert test
        vm.expectRevert(bytes('ERC721: transfer caller is not owner nor approved'));

        // Attempt a transfer from the wrong address
        vm.prank(attacker);
        artistContract.transferFrom(BUYERS[0], attacker, tokenId);
    }

    // transferFrom transfers when approved
    function test_transferFromSuccessIfApproved() public {
        uint32[] memory tokensPerBuyer = new uint32[](1);
        tokensPerBuyer[0] = 1;

        // Create edition & buy some tokens
        createEditionAndBuyTokens(BUYERS, tokensPerBuyer);

        address receiver = vm.addr(789);

        // Approve the receiver
        uint256 tokenId = (EDITION_ID << 128) | 1;
        vm.prank(BUYERS[0]);
        artistContract.approve(receiver, tokenId);

        // Receiver transfers from buyer to the receiver's own address
        vm.prank(receiver);
        artistContract.transferFrom(BUYERS[0], receiver, tokenId);

        assertEq(artistContract.ownerOf(tokenId), receiver);
    }

    /***********************************
        Extended 721 functionality tests
    ***********************************/

    // contractURI returns contractURI
    // https://docs.opensea.io/docs/contract-level-metadata
    function test_contractURI() public {
        string memory artistContractAddrAsString = Strings.toHexString(uint256(uint160(address(artistContract))), 20);

        assertEq(artistContract.contractURI(), string.concat(BASE_URI, artistContractAddrAsString, '/storefront'));
    }

    // royaltyInfo returns no royalty info for non-existent token
    function test_royaltyInfoNonExistentToken() public {
        uint256 tokenId = (EDITION_ID << 128) | 1;

        (address fundingRecipient, uint256 amount) = artistContract.royaltyInfo(tokenId, 1e18);

        assertEq(amount, 0);
        assertEq(fundingRecipient, address(0));
    }

    // royaltyInfo returns royalty info for a token after it is purchased
    function test_royaltyInfoSuccess() public {
        uint256 tokenId = (EDITION_ID << 128) | 1;
        uint32[] memory tokensPerBuyer = new uint32[](1);
        tokensPerBuyer[0] = 1;

        // Create edition & buy some tokens
        createEditionAndBuyTokens(BUYERS, tokensPerBuyer);
        (address fundingRecipient, uint256 amount) = artistContract.royaltyInfo(tokenId, 1e18);

        assertEq(amount, 1e17); // 1/10th of 1e18 (which is 1 ETH in wei)
        assertEq(fundingRecipient, FUNDING_RECIPIENT);
    }
}
