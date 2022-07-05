# @soundxyz/protocol

## 8.0.0

### Major Changes

- 81ec5bf: Make hardhat peer dependency (has to be manually installed alongside this package)

## 7.4.1

### Patch Changes

- d0be518: Rinkeby deployment dir fix

## 7.4.0

### Minor Changes

- 4b51e58: Bumps common to 3.6.0

## 7.3.0

### Minor Changes

- ee03e55: deploy:local with new artist seed contract addresss

### Patch Changes

- Updated dependencies [ee03e55]
  - @soundxyz/common@3.5.0

## 7.2.0

### Minor Changes

- f95de85: deploy:local script -> ARTIST_VERSION=5

## 7.1.0

### Minor Changes

- 30654a6: Bumps common package version

## 7.0.0

### Major Changes

- a3e56a6: Enables Sound to transfer ownership of Artist proxies

  - setOwnerOverride function
  - soundRecoveryAddress view function

- a3e56a6: Ensures tokenURI returns default URI if edition.baseURI is less than 4 chars long
- a3e56a6: - Removes initialize function on ArtistCreatorV2
  - Replaces ArtistV5 import with ArtistV5 function selector (signature hash)
- a3e56a6: Enables setting baseURI on per-edition basis

  - adds baseURI to Edition struct
  - Adds setEditionBaseURI
  - Adapts tokenURI to accomodate both types of baseURI

- a3e56a6: Edition idempotency

  - requires editionId to createEdition call

- a3e56a6: - Deprecating atArtistId in ArtistCreator.

  - Removing artistId arg in Artist initialization.
  - Changing metadata uri to use contractAddress instead of artistId.
  - Create2 idempotency using contract bytecode and sender address as salt.

  deeper explanation:
  https://www.notion.so/soundxyz/CreateArtist-Idempotency-ca6c7b3a18c34eb49ede944bb1bc41be

### Minor Changes

- 5fb2d13: Cleans up Artist/upgrades so tests are more isolated and avoiding global state

  - adds `deployArtistProxyPostUpgrade`
  - replaces global `artistPreUpgradeProxy` & `artistPostUpgradeProxy` with local copies

- d1df3a3: Test refactor

  - Uses setUpContract function for all tests
  - Removes deployArtistImplementation (not using it and probably won't ever need it)
  - Uses single createEdition function (returned from setUpContract)
  - Removes global scope and duplicate variables across test files
  - Generally makes test details more explicit

- f5d3c50: Replaces utils/Strings.sol with OpenZeppelin's Strings.sol
- a3e56a6: - Creates AccessManager.sol for role-based access control, which is a hybrid of OZ's
  OwnableUpgradeable.sol & AccessControl.sol
  - Replaces OwnableUpgradeable.sol with AccessManager.sol
- 3fa1ff3: Ancillary pre-artistv5 changes
- 7058b2c: Ignores old contracts from gas reports
- 0bc6917: Adds license line to ArtistCreatorProxy

## 6.1.0

### Minor Changes

- 1d66848: - createEdition helper
  - createSplit helper
- 47ae27f: Improving deployment helper functions
- 63438a9: - Moves the setup function from global config to helpers file and removes global config
  file. It's a more simple design and makes tests more explicitly atomic (ex: new ArtistCreator
  deployment for every test)
  - Removes running the tests against the Artist implementation. We never use the implementation
    contract directly in prod, so it makes no sense to be testing it. I kept the
    deployArtistImplementation helper for edge cases in which it might be needed.
- f97ac62: Restructures test directory

### Patch Changes

- fd44691: Additional typescript fix
- 66781ca: Fixes typescript warnings
- Updated dependencies [9f44b3a]
  - @soundxyz/common@3.2.0

## 6.0.0

### Major Changes

- a8d9f88: Updates protocol addresses object to use env as key

## 5.1.0

### Minor Changes

- 5a74507: Uses permissionedQuantity in local seed deploy script

### Patch Changes

- Updated dependencies [5a74507]
  - @soundxyz/common@3.1.0

## 5.0.0

### Major Changes

- ada177d: - Implements open editions
  - Adds ticketNumber requirement to signature to prevent multiple purchases

### Minor Changes

- ada177d: Sets correct EDITION_SIGNER
- ada177d: Emits ticket number from EditionPurchased event
- ada177d: Refactors Artist.sol tests

  - Creates Config class to make test dependencies clearer (no global scope)
  - Breaks tests out into separate files

- ada177d: Adds checkTicketNumbers view function

### Patch Changes

- Updated dependencies [ada177d]
- Updated dependencies [ada177d]
  - @soundxyz/common@3.0.0

## 4.2.0

### Minor Changes

- ce5ab60: Sets permissionedQuantity to quantity
- bc03af4: Skips 0xSplits deployment if not on hardhat network

### Patch Changes

- ffda0ec: Updates hardhat tasks

## 4.1.0

### Minor Changes

- 29ad0bd: Makes hardhat task names camelCase and adds new tasks
- a67d2f2: Improves scripts

### Patch Changes

- Updated dependencies [bc53cb4]
  - @soundxyz/common@2.6.0

## 4.0.1

### Patch Changes

- f3126f6: Removes errant comments
- Updated dependencies [e704ce2]
  - @soundxyz/common@2.5.1

## 4.0.0

### Major Changes

- a3fd3c0: - Bitpacks editionId into top bits of tokenId
  - Deprecates atTokenId and in favor of bit-packed editionId with tokenId
  - Adds presale quantity and signature setters
  - Adds editionCount view function
  - Sends ETH directly to fundingRecipient during buyEdition call
- c04d8cc: Adds ownersOfTokenIds view function
- c6b99d0: Misc optimizations + changes "presale" to "permissioned"

## 3.6.0

### Minor Changes

- ebe83a3: Fixes creditSplits allocations and seed script
- e203bec: Adds edition to dummy editions

### Patch Changes

- Updated dependencies [ebe83a3]
- Updated dependencies [e203bec]
  - @soundxyz/common@2.5.0

## 3.5.0

### Minor Changes

- ae13e3d: Bumps common package version

### Patch Changes

- 3ae1024: Lock file update

## 3.4.1

### Patch Changes

- 62d59dd: Comments out mainnet in hardhat.config

## 3.4.0

### Minor Changes

- 8f52145: Updates @soundxyz/protocol common package dependency

## 3.3.1

### Patch Changes

- 9ada656: Upgrades common package to fix seed bug caused by new seedData

## 3.3.0

### Minor Changes

- c0279a3: Improves hardhat tasks
- 575fd17: - Updates 0xSplits contracts
  - Adds splitMain mainnet address and new rinkeby address
  - removes `protocol/src/deployments/rinkeby/SplitMain.json` - not needed

## 3.2.0

### Minor Changes

- c7e28ae: - Makes Oshi's first 3 editions use the creditSplit.splitAddress for fundingRecipient
  - Adds SOUND_ADMIN_PUBLIC_ADDRESS to common/src/constants

### Patch Changes

- Updated dependencies [c7e28ae]
  - @soundxyz/common@2.1.0

## 3.1.0

### Minor Changes

- 71c2e4d: Adds creditSplits & edition purchases

### Patch Changes

- Updated dependencies [71c2e4d]
  - @soundxyz/common@2.0.0

## 3.0.0

### Major Changes

- 3b4df3c: New 0xSplits function names

## 2.0.2

### Patch Changes

- 311eda9: Fixes local seed script so Artist gets upgraded to ArtistV2

## 2.0.1

### Patch Changes

- cedeba8: Remove unused dependencies
- Updated dependencies [cedeba8]
  - @soundxyz/common@1.3.1

## 2.0.0

### Major Changes

- 9fe323f: @soundxyz/common

  - adds getPresaleSignature helper function

  @soundxyz/protocol

  - adds natspec comments to contracts
  - fixes royaltyInfo bug
  - adds events to setStartTime and setEndTime
  - implements presale whitelisting via signatures in Artist.sol:
    - adds presaleQuantity & signerAddress to Edition struct
    - adds PRESALE_TYPEHASH constant to storage
    - adds getSigner function
    - makes changes to buyEdition for whitelisting functionality
    - makes changes & additions to tests

### Patch Changes

- Updated dependencies [9fe323f]
  - @soundxyz/common@1.3.0

## 1.4.0

### Minor Changes

- 6a7f07b: Adds creditSplit seed data & contract

### Patch Changes

- Updated dependencies [6a7f07b]
  - @soundxyz/common@1.1.0

## 1.3.1

### Patch Changes

- 1c57d7f: Set license as GPLv3
- Updated dependencies [1c57d7f]
  - @soundxyz/common@1.0.5

## 1.3.0

### Minor Changes

- fdc49ff: Adds 0xSplits contracts

## 1.2.3

### Patch Changes

- f673af1: Fix release
- Updated dependencies [7748c1a]
  - @soundxyz/common@1.0.3

## 1.0.5

### Patch Changes

- 08490af: Fix typechain .d.ts files

## 1.0.3

### Patch Changes

- e0cca98: change publish deployments target

  fixes race-conditions while importing

## 1.0.1

### Patch Changes

- 08bc665: Don't build json

## 1.0.0

### Major Changes

- 610e2f6: Release

### Patch Changes

- Updated dependencies [610e2f6]
  - @soundxyz/common@1.0.0
