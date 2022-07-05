// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import './TestConfig.sol';
import '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol';

contract ArtistCreatorTest is TestConfig {
    event CreatedArtist(uint256 artistId, string name, string symbol, address indexed artistAddress);

    /***********************************
            Access Control Tests
    ***********************************/

    // Asserts owner() is correct
    function test_owner() public {
        assertEq(artistCreator.owner(), SOUND_ADMIN_ADDRESS);
    }

    // Transfers ownership to a new address
    function test_transferOwnership() public {
        address newOwner1 = address(0x1234567890123456789012345678901234567890);
        address newOwner2 = address(0x1234567890123456789012345678901234567891);

        vm.prank(SOUND_ADMIN_ADDRESS);
        artistCreator.transferOwnership(newOwner1);
        assertEq(artistCreator.owner(), newOwner1);

        // Sets msg.sender to given address
        vm.prank(newOwner1);

        artistCreator.transferOwnership(newOwner2);
        assertEq(artistCreator.owner(), newOwner2);
    }

    // Ensures only the owner can transfer ownership
    function testFail_transferOwnership() public {
        // Sets msg.sender to a new address
        address notTheOwner = address(0x1234567890123456789012345678901234567890);
        vm.prank(notTheOwner);

        artistCreator.transferOwnership(address(0));
    }

    // Asserts admin() is correct
    function test_admin() public {
        assertEq(artistCreator.admin(), SOUND_ADMIN_ADDRESS);
    }

    // Asserts setAdmin can set a new admin address
    function test_setAdmin() public {
        address newAdmin = address(0x1234567890123456789012345678901234567666);

        vm.prank(SOUND_ADMIN_ADDRESS);
        artistCreator.setAdmin(newAdmin);

        assertEq(artistCreator.admin(), newAdmin);
    }

    // Asserts setAdmin can't be called by non-admin
    function testFail_setAdmin() public {
        address notTheAdmin = address(0x1234567890123456789012345678901234567666);
        vm.prank(notTheAdmin);

        artistCreator.setAdmin(address(0));
    }

    /***********************************
            Artist Creation Tests
    ***********************************/

    // Deploys artist contracts with expected event data
    function test_createArtist() public {
        for (uint256 i = 1; i < 20; i++) {
            address fakeArtistAddr = vm.addr(i);

            bytes memory signature = getCreateArtistSignature(fakeArtistAddr);

            string memory artistName = string(abi.encodePacked('FakeArtist ', i));
            string memory artistSymbol = string(abi.encodePacked('ART', i));
            string memory baseURI = string(abi.encodePacked('http://example.com/artist/', i));

            // sets msg.sender to the fake artist wallet
            vm.startPrank(fakeArtistAddr);

            /*  This sets up the event test
                The first 3 params are for indexed variables, 4th is data
                we're only testing data (artistId, artistName, artistSymbol) because
                the test event can't be called after the contract call, but the contract
                call returns the artist proxy address we need to pass to the test event.
                https://t.me/foundry_support/10892
            */

            vm.expectEmit(false, false, false, true);

            emit CreatedArtist(0, artistName, artistSymbol, address(0));

            address artistProxyAddr = artistCreator.createArtist(signature, artistName, artistSymbol, baseURI);

            // asserts artist proxy address exists
            assert(artistProxyAddr != address(0));

            vm.stopPrank();
        }
    }

    // Prevents deployment if admin signature is invalid.
    function testFail_createArtist() public {
        for (uint256 i = 1; i < 20; i++) {
            address fakeArtistAddr = vm.addr(i);

            // Build auth signature
            // (equivalent to ethers.js wallet._signTypedData())
            bytes32 digest = keccak256(
                abi.encodePacked(
                    '\x19\x01',
                    artistCreator.DOMAIN_SEPARATOR(),
                    keccak256(abi.encode(artistCreator.MINTER_TYPEHASH(), fakeArtistAddr))
                )
            );
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(NULL_PRIV_KEY, digest);
            bytes memory signature = abi.encodePacked(r, s, v);

            string memory artistName = string(abi.encodePacked('FakeArtist ', i));
            string memory artistSymbol = string(abi.encodePacked('ART', i));
            string memory baseURI = string(abi.encodePacked('http://example.com/artist/', i));

            // sets msg.sender to the fake artist wallet
            vm.startPrank(fakeArtistAddr);

            artistCreator.createArtist(signature, artistName, artistSymbol, baseURI);

            vm.stopPrank();
        }
    }
}
