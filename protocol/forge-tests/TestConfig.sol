// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import 'forge-std/Test.sol';
import '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol';
import {SplitMain} from '../contracts/splits/SplitMain.sol';
import '../contracts/ArtistCreatorProxy.sol';
import '../contracts/ArtistCreator.sol';
import '../contracts/ArtistCreatorV3.sol';
import '../contracts/ArtistV6.sol';

contract TestConfig is Test {
    struct KeyPair {
        address publicAddress;
        uint256 privateKey;
    }

    ArtistCreatorV3 artistCreator;
    ArtistV6 artistContract;

    uint256 constant TICKET_NUM_ZERO = 0;
    uint256 constant NULL_PRIV_KEY = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes constant EMPTY_SIGNATURE = bytes('');
    uint256 immutable ADMIN_PRIV_KEY;
    address immutable SOUND_ADMIN_ADDRESS;
    address immutable ARTIST1_ADDRESS;
    address immutable FUNDING_RECIPIENT;
    address[] BUYERS;

    // global values
    uint256 constant PERCENTAGE_SCALE = 1e6;

    // Artist contract creation vars
    string constant ARTIST_NAME = 'Fake Artist';
    string constant ARTIST_SYMBOL = 'FAKE';

    // default edition args
    uint256 constant PRICE = 100000000000000000; // 0.1 ether
    uint32 constant QUANTITY = 10;
    uint32 constant ROYALTY_BPS = 1000;
    uint32 constant START_TIME = 0;
    uint32 constant END_TIME = 2**32 - 1;
    uint32 constant PERMISSIONED_QUANTITY = 0;
    address immutable SIGNER_ADDRESS;
    uint256 constant EDITION_ID = 1;
    string constant BASE_URI = 'https://metadata.sound.xyz/';

    SplitMain splitMain;

    constructor() {
        // Private key for address 0x3aec41183547f36f7e65ed213ce34073bc93503e
        ADMIN_PRIV_KEY = 0x666;
        SOUND_ADMIN_ADDRESS = vm.addr(ADMIN_PRIV_KEY);
        ARTIST1_ADDRESS = vm.addr(0x7d94af0f2fc23136c0e52b4d4dfc5b2625323f7a33b376067d7c6cbef3103646);
        FUNDING_RECIPIENT = ARTIST1_ADDRESS;
        SIGNER_ADDRESS = SOUND_ADMIN_ADDRESS;

        // Create buyers & give each some ETH
        for (uint256 i = 1; i < 2000; i++) {
            BUYERS.push(vm.addr(i));
            deal(BUYERS[i - 1], 100 ether);
        }
    }

    // Returns a random address funded with ETH
    function getRandomAccount(uint256 num) public returns (address) {
        address addr = address(uint160(uint256(keccak256(abi.encodePacked(num)))));
        // Fund with some ETH
        vm.deal(addr, 10000000000000000000);

        return addr;
    }

    // Set up before each test
    function setUp() public {
        vm.startPrank(SOUND_ADMIN_ADDRESS);

        // Deploy proxy & V1 implementation
        address proxy = address(
            ArtistCreator(address(new ArtistCreatorProxy(address(new ArtistCreator()), address(0), bytes(''))))
        );

        // Initialize proxy
        ArtistCreator(proxy).initialize();

        // Deploy latest ArtistCreator implemenation
        address creatorImplementation = address(new ArtistCreatorV3());

        // Upgrade creator
        ArtistCreator(proxy).upgradeTo(creatorImplementation);

        // Store proxy
        artistCreator = ArtistCreatorV3(address(proxy));

        // Deploy latest Artist implementation
        address artistImplementation = address(new ArtistV6());

        // Get beacon for upgrade
        address beaconAddress = ArtistCreator(proxy).beaconAddress();
        UpgradeableBeacon beacon = UpgradeableBeacon(beaconAddress);

        // Upgrade to latest Artist implementation
        beacon.upgradeTo(artistImplementation);

        // Set the nonce forward so the splitMain address is deterministic
        vm.setNonce(SOUND_ADMIN_ADDRESS, 100);
        splitMain = new SplitMain();

        vm.stopPrank();

        // Get signature for artist proxy deployment
        bytes memory signature = getCreateArtistSignature(ARTIST1_ADDRESS);

        // Deploy artist proxy
        vm.prank(ARTIST1_ADDRESS);
        artistContract = ArtistV6(artistCreator.createArtist(signature, ARTIST_NAME, ARTIST_SYMBOL, BASE_URI));
    }

    // Creates auth signature needed for createArtist function
    // (equivalent to ethers.js wallet._signTypedData())
    function getCreateArtistSignature(address deployer) public returns (bytes memory signature) {
        // Build auth signature
        // (equivalent to ethers.js wallet._signTypedData())
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                artistCreator.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(artistCreator.MINTER_TYPEHASH(), deployer))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ADMIN_PRIV_KEY, digest);

        return abi.encodePacked(r, s, v);
    }

    // Creates signature needed for permissioned purchase
    function getPresaleSignature(
        ArtistV6 artistContract_,
        uint256 signerPrivateKey,
        address buyer,
        uint256 editionId,
        uint256 ticketNum
    ) public returns (bytes memory signature) {
        // Build auth signature
        // (equivalent to ethers.js wallet._signTypedData())
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                artistCreator.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        artistContract_.PERMISSIONED_SALE_TYPEHASH(),
                        address(artistContract_),
                        buyer,
                        editionId,
                        ticketNum
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function createEdition(uint32 quantity) public {
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
            ''
        );
    }

    // Accepts number of unique buyers, and an array of tokens per buyer
    // Loops over unique buyers, and each buys the next number of tokens in tokensPerBuyer in a round robin
    function createEditionAndBuyTokens(address[] memory uniqueBuyers, uint32[] memory tokensPerBuyer)
        public
        returns (uint32 tokenQuantity)
    {
        // Calculate total number of tokens to be purchased
        tokenQuantity = 0;
        for (uint256 i = 0; i < uniqueBuyers.length; i++) {
            tokenQuantity += tokensPerBuyer[i % tokensPerBuyer.length];
        }

        // Create edition
        createEdition(tokenQuantity);

        // Loop over buyers
        // For each buyer, purchase the next quantity in tokensPerBuyer
        for (uint256 i = 0; i < uniqueBuyers.length; i++) {
            address buyer = uniqueBuyers[i];
            uint256 tokensToBuy = tokensPerBuyer[i % tokensPerBuyer.length];
            for (uint256 j = 0; j < tokensToBuy; j++) {
                vm.prank(buyer);
                artistContract.buyEdition{value: PRICE}(EDITION_ID, EMPTY_SIGNATURE, 0);
            }
        }

        return tokenQuantity;
    }

    function getTokenId(uint256 editionId, uint256 tokenCount) public pure returns (uint256) {
        return (editionId << 128) | tokenCount;
    }
}
