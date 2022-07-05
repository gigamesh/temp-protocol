// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import '../ArtistV5.sol';

contract MOCK_ArtistV5 is ArtistV5 {
    // Override that returns our 1st test address
    function soundRecoveryAddress() public pure override returns (address) {
        return 0x3aEc41183547F36F7E65Ed213ce34073bc93503E;
    }
}
