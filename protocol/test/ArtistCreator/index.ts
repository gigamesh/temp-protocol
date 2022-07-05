import { helpers } from '@soundxyz/common';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers, upgrades, waffle } from 'hardhat';

import { BASE_URI, createArtist, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL } from '../testHelpers';

import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const { getAuthSignature } = helpers;
const { provider } = waffle;

describe('ArtistCreator.sol (and subsequent versions)', () => {
  let artistCreator: Contract;
  let soundOwner: SignerWithAddress;

  const setUp = async () => {
    soundOwner = (await ethers.getSigners())[0];

    // Deploy ArtistCreator v1 (deployProxy also initializes the proxy)
    const ArtistCreator = await ethers.getContractFactory('ArtistCreator');
    artistCreator = await upgrades.deployProxy(ArtistCreator, { kind: 'uups' });
    await artistCreator.deployed();

    // Upgrade to latest ArtistCreator version
    const ArtistCreatorV2Factory = await ethers.getContractFactory('ArtistCreatorV2');
    artistCreator = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV2Factory);

    // Deploy latest Artist implementation
    const Artist = await ethers.getContractFactory('ArtistV5');
    const artistImpl = await Artist.deploy();
    await artistImpl.deployed();

    // Upgrade beacon to point to latest Artist implementation
    const beaconAddress = await artistCreator.beaconAddress();
    const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundOwner);
    const beaconTx = await beaconContract.upgradeTo(artistImpl.address);
    await beaconTx.wait();
  };

  it('deploys', async () => {
    await setUp();
    const deployedByteCode = await provider.getCode(artistCreator.address);
    expect(deployedByteCode).to.not.be.null;
  });

  describe('ownership', () => {
    it('returns expected owner', async () => {
      expect(await artistCreator.owner()).to.equal(soundOwner.address);
    });

    it('transfers to a new owner', async () => {
      const [_, owner1, owner2, owner3] = await ethers.getSigners();

      await artistCreator.transferOwnership(owner1.address);
      expect(await artistCreator.owner()).to.equal(owner1.address);

      await artistCreator.connect(owner1).transferOwnership(owner2.address);
      expect(await artistCreator.owner()).to.equal(owner2.address);

      await artistCreator.connect(owner2).transferOwnership(owner3.address);
      expect(await artistCreator.owner()).to.equal(owner3.address);
    });

    it(`'allows owner to set admin`, async () => {
      await setUp();
      const [_, admin1] = await ethers.getSigners();

      await artistCreator.setAdmin(admin1.address);
      expect(await artistCreator.admin()).to.equal(admin1.address);
    });

    it(`'allows admin to set admin`, async () => {
      await setUp();
      const [_, admin1, admin2] = await ethers.getSigners();

      await artistCreator.setAdmin(admin1.address);
      await artistCreator.connect(admin1).setAdmin(admin2.address);
      expect(await artistCreator.admin()).to.equal(admin2.address);
    });

    it(`'prevents non-owner or non-admin from setting admin`, async () => {
      await setUp();
      const [_, attacker1, attacker2] = await ethers.getSigners();

      const tx1 = artistCreator.connect(attacker1).setAdmin(attacker1.address);
      expect(tx1).to.be.revertedWith('invalid authorization');

      const tx2 = artistCreator.connect(attacker2).setAdmin(attacker2.address);
      expect(tx2).to.be.revertedWith('invalid authorization');
    });
  });

  describe('createArtist', () => {
    it('deploys artist contracts with expected event data', async () => {
      await setUp();
      const artistEOAs = await ethers.getSigners();
      for (let i = 1; i < 10; i++) {
        const tx = await createArtist(
          artistCreator,
          artistEOAs[i],
          EXAMPLE_ARTIST_NAME + i,
          EXAMPLE_ARTIST_SYMBOL + i,
          BASE_URI
        );
        const receipt = await tx.wait();
        const eventData = receipt.events.find((e) => e.event === 'CreatedArtist');

        expect(eventData.args.name).to.equal(EXAMPLE_ARTIST_NAME + i);
      }
    });

    it(`prevents deployment if admin signature is invalid`, async () => {
      await setUp();
      const artistEOAs = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      for (let i = 0; i < 10; i++) {
        const artistEOA = artistEOAs[i];
        const signature = await getAuthSignature({
          artistWalletAddr: `0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000`,
          privateKey: process.env.ADMIN_PRIVATE_KEY,
          chainId,
          provider,
        });

        const tx = artistCreator
          .connect(artistEOA)
          .createArtist(signature, EXAMPLE_ARTIST_NAME + i, EXAMPLE_ARTIST_SYMBOL + i, BASE_URI);

        await expect(tx).to.be.revertedWith('invalid authorization signature');
      }
    });

    it(`prevents deployment of a proxy with the same args`, async () => {
      await setUp();
      const artistEOAs = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      const artistEOA = artistEOAs[0];
      const signature = await getAuthSignature({
        artistWalletAddr: artistEOA.address,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        chainId,
        provider,
      });

      // Create proxy
      const tx1 = artistCreator
        .connect(artistEOA)
        .createArtist(signature, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL, BASE_URI);

      await expect(tx1).not.to.be.reverted;

      // Try to create proxy with same args
      const tx2 = artistCreator
        .connect(artistEOA)
        .createArtist(signature, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL, BASE_URI);

      await expect(tx2).to.be.reverted;

      // Create proxy with diff args
      const tx3 = artistCreator
        .connect(artistEOA)
        .createArtist(signature, EXAMPLE_ARTIST_NAME, 'unique symbol arg', BASE_URI);

      await expect(tx3).not.to.be.reverted;
    });
  });
});
