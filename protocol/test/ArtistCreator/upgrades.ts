import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { ethers, upgrades } from 'hardhat';

import { setUpContract, createArtist, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL, BASE_URI } from '../testHelpers';

chai.use(solidity);

describe('ArtistCreator upgrades', () => {
  describe('ArtistCreator.sol', async () => {
    it('prevents attackers from upgrading Artist beacon', async () => {
      const { miscAccounts, artistCreator } = await setUpContract();
      // Deploy v2 implementation
      const ArtistV2 = await ethers.getContractFactory('ArtistV2');
      const artistV2Impl = await ArtistV2.deploy();
      await artistV2Impl.deployed();
      for (const attacker of miscAccounts) {
        // upgrade beacon
        const beaconAddress = await artistCreator.beaconAddress();
        const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, attacker);
        const beaconTx = beaconContract.upgradeTo(artistV2Impl.address);
        expect(beaconTx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('can upgrade after current version', async () => {
      const { artistCreator } = await setUpContract();

      // Upgrade to V2
      const ArtistCreatorV2 = await ethers.getContractFactory('ArtistCreatorV2');
      const artistCreatorV2 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV2);
      await artistCreatorV2.deployed();

      const beaconAddress = await artistCreatorV2.beaconAddress();

      // Upgrade to V3
      const ArtistCreatorUpgradeTest = await ethers.getContractFactory('ArtistCreatorUpgradeTest');
      const artistCreatorUpgrade = await upgrades.upgradeProxy(artistCreatorV2.address, ArtistCreatorUpgradeTest);
      await artistCreatorUpgrade.deployed();

      const postUpgradeBeaconAddress = await artistCreatorUpgrade.beaconAddress();

      const markOfTheBeast = await artistCreatorUpgrade.markOfTheBeast();
      expect(markOfTheBeast).to.equal(666);
      expect(postUpgradeBeaconAddress).to.equal(beaconAddress);
    });

    it('assert beacon address has not been changed post-upgrade', async () => {
      const { artistCreator } = await setUpContract();
      const beaconAddress = await artistCreator.beaconAddress();

      const ArtistCreatorV2 = await ethers.getContractFactory('ArtistCreatorV2');
      const artistCreatorV2 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV2);

      const postUpgradeBeaconAddress = await artistCreatorV2.beaconAddress();

      expect(beaconAddress).to.equal(postUpgradeBeaconAddress);
    });

    it('assert beacon address has not been changed post-upgrade', async () => {
      const { artistCreator } = await setUpContract();
      const beaconAddress = await artistCreator.beaconAddress();

      const ArtistCreatorV2 = await ethers.getContractFactory('ArtistCreatorV2');
      const artistCreatorV2 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV2);

      const postUpgradeBeaconAddress = await artistCreatorV2.beaconAddress();

      expect(beaconAddress).to.equal(postUpgradeBeaconAddress);
    });

    it('prevents attacker from upgrading', async () => {
      const { artistCreator, miscAccounts } = await setUpContract();

      // deploy v2 ArtistCreator
      const ArtistCreator = await ethers.getContractFactory('ArtistCreator');
      const artistCreatorV2 = await ArtistCreator.deploy();
      await artistCreatorV2.deployed();

      const artistCreatorV1 = await ethers.getContractAt('ArtistCreator', artistCreator.address, miscAccounts[0]);
      const tx = artistCreatorV1.upgradeTo(artistCreatorV2.address);

      expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('can create artists after upgrading to ArtistCreatorV2 and ArtistV5', async () => {
      // Deploy ArtistCreatorV1 & specify ArtistV4
      const { artistCreator, miscAccounts, soundOwner } = await setUpContract({
        artistCreatorVersion: 1,
        artistContractName: 'ArtistV4',
      });

      // Upgrade ArtistCreator
      const ArtistCreatorV2 = await ethers.getContractFactory('ArtistCreatorV2');
      const artistCreatorV2 = await ArtistCreatorV2.deploy();

      await artistCreatorV2.deployed();
      await artistCreator.upgradeTo(artistCreatorV2.address);
      const upgradedCreator = await ethers.getContractAt('ArtistCreatorV2', artistCreator.address);

      const kanyeWest = miscAccounts[0];

      // creating artist without upgrading to artistv5 fails
      const createPreUpgradeArtistTx = createArtist(
        upgradedCreator,
        kanyeWest,
        EXAMPLE_ARTIST_NAME,
        EXAMPLE_ARTIST_SYMBOL,
        BASE_URI
      );

      await expect(createPreUpgradeArtistTx).to.be.reverted;

      // Deploy ArtistV5 implementation
      const Artist = await ethers.getContractFactory('ArtistV5');
      const artistImpl = await Artist.deploy();
      await artistImpl.deployed();

      // Upgrade beacon to point to ArtistV5 implementation
      const beaconAddress = await artistCreator.beaconAddress();
      const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundOwner);
      const beaconTx = await beaconContract.upgradeTo(artistImpl.address);
      await beaconTx.wait();

      // Create createArtistv5Tx succeeds
      const createArtistv5Tx = createArtist(
        upgradedCreator,
        kanyeWest,
        EXAMPLE_ARTIST_NAME,
        EXAMPLE_ARTIST_SYMBOL,
        BASE_URI
      );

      await expect(createArtistv5Tx).not.to.be.reverted;
    });
  });
});
