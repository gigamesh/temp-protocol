import { constants, helpers } from '@soundxyz/common';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber, Contract, utils } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { ethers, waffle } from 'hardhat';

import {
  BASE_URI,
  createArtist,
  CreateEditionFn,
  createEditions,
  EDITION_ID,
  EXAMPLE_ARTIST_NAME,
  EXAMPLE_ARTIST_SYMBOL,
  getAccounts,
  getTokenId,
  setUpContract,
} from '../testHelpers';

import { currentSeconds, EMPTY_SIGNATURE } from '../../helpers';

const { baseURIs } = constants;

chai.use(solidity);

enum TimeType {
  START = 0,
  END = 1,
}

const { provider } = waffle;
const { getPresaleSignature } = helpers;
const chainId = 1337;

describe('Artist upgrades', () => {
  const upgradeArtistImplementation = async ({
    artistContractName,
    artistCreator,
    preUpgradeProxy,
  }: {
    artistContractName: string;
    artistCreator: Contract;
    preUpgradeProxy?: Contract;
  }) => {
    const { soundOwner, artist1: artistAccount } = await getAccounts();
    // Deploy new artist implementation
    const ArtistNewVersion = await ethers.getContractFactory(artistContractName);
    const artistNewImpl = await ArtistNewVersion.deploy();
    await artistNewImpl.deployed();

    // Upgrade beacon
    const beaconAddress = await artistCreator.beaconAddress();
    const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundOwner);
    const beaconTx = await beaconContract.upgradeTo(artistNewImpl.address);
    await beaconTx.wait();

    // If preUpgradeProxy is provided, return its upgraded instantiation
    if (preUpgradeProxy) {
      return await ethers.getContractAt(artistContractName, preUpgradeProxy.address, artistAccount);
    }
  };

  const deployArtistProxyPostUpgrade = async ({
    artistContractName,
    artistCreator,
  }: {
    artistContractName: string;
    artistCreator: Contract;
  }) => {
    const { artist1: artistAccount } = await getAccounts();
    // Deploy upgraded proxy
    const createArtistTx = await createArtist(
      artistCreator,
      artistAccount,
      EXAMPLE_ARTIST_NAME,
      EXAMPLE_ARTIST_SYMBOL,
      BASE_URI
    );
    const receipt = await createArtistTx.wait();
    const proxyAddress = receipt.events.find((e) => e.event === 'CreatedArtist').args.artistAddress;

    // Instantiate proxy
    return await ethers.getContractAt(artistContractName, proxyAddress, artistAccount);
  };

  //================== Artist.sol ==================/

  describe('Artist.sol -> ArtistV2.sol', () => {
    describe('Artist proxy deployed before upgrade', () => {
      it('existing storage data remains intact', async () => {
        const {
          artistContract: preUpgradeProxy,
          price,
          artistCreator,
        } = await setUpContract({
          artistContractName: 'Artist',
        });

        /// Purchase something before the upgrade to compare numSold
        const tx = await preUpgradeProxy.buyEdition(EDITION_ID, { value: price });
        await tx.wait();
        const preUpgradeEditionInfo = await preUpgradeProxy.editions(EDITION_ID);

        // Perform upgrade
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });

        const postUpgradeEditionInfo = await upgradedProxy.editions(EDITION_ID);

        expect(postUpgradeEditionInfo.numSold).to.equal(preUpgradeEditionInfo.numSold);
        expect(postUpgradeEditionInfo.quantity).to.equal(preUpgradeEditionInfo.quantity);
        expect(postUpgradeEditionInfo.startTime).to.equal(preUpgradeEditionInfo.startTime);
        expect(postUpgradeEditionInfo.endTime).to.equal(preUpgradeEditionInfo.endTime);
        expect(postUpgradeEditionInfo.royaltyBPS).to.equal(preUpgradeEditionInfo.royaltyBPS);
        expect(postUpgradeEditionInfo.price.toString()).to.equal(preUpgradeEditionInfo.price.toString());
        expect(postUpgradeEditionInfo.fundingRecipient).to.equal(preUpgradeEditionInfo.fundingRecipient);
      });

      it('storage includes new variables', async () => {
        const { artistContract: preUpgradeProxy, artistCreator } = await setUpContract({
          artistContractName: 'Artist',
        });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });
        expect(await upgradedProxy.PRESALE_TYPEHASH()).is.not.undefined;
      });

      it('returns correct royalty from royaltyInfo (fixes bug in v1)', async () => {
        const royaltyBPS = BigNumber.from(69);
        const saleAmount = utils.parseUnits('1.0', 'ether');

        const {
          artistContract: preUpgradeProxy,
          price,
          fundingRecipient,
          createEdition,
          artistCreator,
        } = await setUpContract({ editionCount: 0, artistContractName: 'Artist' });

        const edition1Tx = await createEdition({
          editionArgs: { royaltyBPS },
        });
        await edition1Tx.wait();

        const buy1Tx = await preUpgradeProxy.buyEdition(1, { value: price });
        await buy1Tx.wait();
        const buy2Tx = await preUpgradeProxy.buyEdition(1, { value: price });
        await buy2Tx.wait();

        // At this point, there are 2 tokens bought from edition 1.
        // Calling royaltyInfo(2) should return nothing because editionId 2 hasn't been created.
        const royaltyInfoPreUpgrade = await preUpgradeProxy.royaltyInfo(2, saleAmount);

        // Verify pre-upgrade royaltyInfo is null
        expect(royaltyInfoPreUpgrade.fundingRecipient).to.equal('0x0000000000000000000000000000000000000000');
        expect(royaltyInfoPreUpgrade.royaltyAmount).to.equal(BigNumber.from(0));

        // Perform upgrade
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });

        // Calling royaltyInfo(2) should return data because royaltyInfo is now fixed and tokenId 2 has been created.
        const royaltyInfoPostUpgrade = await upgradedProxy.royaltyInfo(2, saleAmount);

        // Verify post-upgrade royaltyInfo is correct
        const expectedRoyalty = saleAmount.mul(royaltyBPS).div(10_000);
        expect(royaltyInfoPostUpgrade.fundingRecipient).to.equal(fundingRecipient);
        expect(royaltyInfoPostUpgrade.royaltyAmount).to.equal(expectedRoyalty);
      });

      it('emits event from setStartTime', async () => {
        const {
          artistContract: preUpgradeProxy,
          artistCreator,
          artistAccount,
        } = await setUpContract({
          artistContractName: 'Artist',
        });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });
        await upgradedProxy.connect(artistAccount);
        await setStartTimeTest(upgradedProxy);
      });

      it('emits event from setEndTime', async () => {
        const {
          artistContract: preUpgradeProxy,
          artistCreator,
          artistAccount,
        } = await setUpContract({
          artistContractName: 'Artist',
        });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });
        await upgradedProxy.connect(artistAccount);
        await setEndTimeTest(upgradedProxy);
      });

      it('requires signature for presale purchases', async () => {
        const {
          artistContract: preUpgradeProxy,
          artistCreator,
          createEdition,
          price,
        } = await setUpContract({ skipCreateEditions: true, artistContractName: 'Artist' });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });
        await rejectPresalePurchaseTest({ artistContract: upgradedProxy, createEdition, price });
      });

      it('sells open sale NFTs', async () => {
        const {
          artistContract: preUpgradeProxy,
          artistCreator,
          price,
          createEdition,
        } = await setUpContract({ artistContractName: 'Artist' });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });
        await openSalePurchaseTest({ artistContract: upgradedProxy, createEdition, price });
      });

      it('sells NFTs of v1 editions after an upgrade', async () => {
        const {
          artistContract: preUpgradeProxy,
          price,
          artistCreator,
        } = await setUpContract({ artistContractName: 'Artist' });

        await preUpgradeProxy.buyEdition(EDITION_ID, { value: price });

        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV2',
          preUpgradeProxy,
          artistCreator,
        });

        const tx = await upgradedProxy.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });
        const receipt = await tx.wait();
        const totalSupply = await upgradedProxy.totalSupply();

        expect(receipt.status).to.equal(1);
        expect(totalSupply.toNumber()).to.equal(2);
      });
    });

    describe('Artist proxy deployed after upgrade', () => {
      it('returns correct royalty from royaltyInfo (fixes bug in v1)', async () => {
        const { fundingRecipient, price, createEdition, artistCreator, soundOwner } = await setUpContract({
          editionCount: 0,
          artistContractName: 'Artist',
        });
        await upgradeArtistImplementation({ artistContractName: 'ArtistV2', artistCreator });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistCreator, artistContractName: 'ArtistV2' });

        const edition1Royalty = BigNumber.from(69);
        const saleAmount = utils.parseUnits('1.0', 'ether');

        const permissionedQuantity = 1;
        const signerAddress = soundOwner.address;
        const editionTx = await createEdition({
          artistContract: postUpgradeProxy,
          editionArgs: {
            royaltyBPS: edition1Royalty,
            permissionedQuantity,
            signerAddress,
          },
        });
        await editionTx.wait();

        const signers = await ethers.getSigners();
        const buyer = signers[10];

        const signature = await getPresaleSignature({
          chainId,
          provider,
          editionId: EDITION_ID,
          privateKey: process.env.ADMIN_PRIVATE_KEY,
          contractAddress: postUpgradeProxy.address,
          buyerAddress: buyer.address,
        });

        const buy1Tx = await postUpgradeProxy.connect(buyer).buyEdition(1, signature, { value: price });
        await buy1Tx.wait();
        const buy2Tx = await postUpgradeProxy.connect(buyer).buyEdition(1, signature, { value: price });
        await buy2Tx.wait();

        const royaltyInfo = await postUpgradeProxy.royaltyInfo(2, saleAmount);

        const expectedRoyalty = saleAmount.mul(edition1Royalty).div(10_000);

        // If the upgrade didn't work, royaltyInfo(2) would return null values because only one edition was created.
        expect(royaltyInfo.fundingRecipient).to.equal(fundingRecipient);
        expect(royaltyInfo.royaltyAmount).to.equal(expectedRoyalty);
      });

      it('emits event from setStartTime', async () => {
        const { artistCreator, artistAccount } = await setUpContract({
          artistContractName: 'Artist',
        });
        await upgradeArtistImplementation({ artistContractName: 'ArtistV2', artistCreator });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV2', artistCreator });
        await postUpgradeProxy.connect(artistAccount);
        await setStartTimeTest(postUpgradeProxy);
      });

      it('emits event from setEndTime', async () => {
        const { artistCreator, artistAccount } = await setUpContract({
          artistContractName: 'Artist',
        });
        await upgradeArtistImplementation({ artistContractName: 'ArtistV2', artistCreator });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV2', artistCreator });
        await postUpgradeProxy.connect(artistAccount);
        await setEndTimeTest(postUpgradeProxy);
      });

      it('requires signature for presale purchases', async () => {
        const { artistCreator, price, createEdition } = await setUpContract({
          skipCreateEditions: true,
          artistContractName: 'Artist',
        });
        await upgradeArtistImplementation({ artistContractName: 'ArtistV2', artistCreator });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV2', artistCreator });
        await rejectPresalePurchaseTest({ artistContract: postUpgradeProxy, price, createEdition });
      });

      it('sells open sale NFTs', async () => {
        const { createEdition, price, artistCreator } = await setUpContract({
          artistContractName: 'Artist',
        });
        await upgradeArtistImplementation({ artistContractName: 'ArtistV2', artistCreator });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV2', artistCreator });
        await openSalePurchaseTest({ artistContract: postUpgradeProxy, createEdition, price });
      });
    });
  });

  describe('ArtistV2.sol -> ArtistV3.sol', () => {
    describe('Artist proxy deployed before upgrade', () => {
      it('returns expected tokenURI', async () => {
        const editionCount = 5;
        const {
          artistContract: preUpgradeProxy,
          price,
          artistCreator,
        } = await setUpContract({ editionCount, artistContractName: 'ArtistV2' });
        await tokenURITest({ artistContract: preUpgradeProxy, editionCount, price });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV3',
          preUpgradeProxy,
          artistCreator,
        });
        await tokenURITest({ artistContract: upgradedProxy, editionCount, price });
      });

      it('returns expected totalSupply', async () => {
        const editionCount = 5;
        const quantity = 10;
        const {
          artistContract: preUpgradeProxy,
          artistCreator,
          price,
          createEdition,
        } = await setUpContract({ editionCount, artistContractName: 'ArtistV2' });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV3',
          preUpgradeProxy,
          artistCreator,
        });
        await totalSupplyTest({ artistContract: upgradedProxy, editionCount, quantity, price, createEdition });
      });

      it('returns expected edition id from tokenToEdition', async () => {
        const editionCount = 5;
        const tokenQuantity = 10;
        const {
          artistContract: preUpgradeProxy,
          price,
          artistCreator,
        } = await setUpContract({ editionCount, artistContractName: 'Artist' });

        // Create and buy editions before upgrade
        for (let currentEditionId = 1; currentEditionId <= editionCount; currentEditionId++) {
          for (let tokenSerialNum = 1; tokenSerialNum <= tokenQuantity; tokenSerialNum++) {
            // Buy token of edition
            await preUpgradeProxy.buyEdition(currentEditionId, { value: price });
          }
        }

        // perform upgrade
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV3',
          artistCreator,
          preUpgradeProxy,
        });

        // Check data after upgrade
        let tokenId = 0;
        for (let currentEditionId = 1; currentEditionId <= editionCount; currentEditionId++) {
          for (let tokenSerialNum = 1; tokenSerialNum <= tokenQuantity; tokenSerialNum++) {
            tokenId++;

            const editionId = await upgradedProxy.tokenToEdition(tokenId);

            expect(editionId.toNumber()).to.equal(currentEditionId);
          }
        }
      });

      it('can withdraw ETH after upgrade', async () => {
        const {
          artistContract: preUpgradeProxy,
          price,
          fundingRecipient,
          artistCreator,
        } = await setUpContract({ artistContractName: 'Artist' });
        const initialBalance = await provider.getBalance(fundingRecipient);

        await preUpgradeProxy.buyEdition(EDITION_ID, { value: price });

        await upgradeArtistImplementation({ artistContractName: 'ArtistV3', artistCreator });

        await preUpgradeProxy.withdrawFunds(EDITION_ID);

        const postUpgradeBalance = await provider.getBalance(fundingRecipient);

        expect(initialBalance.add(price).toString()).to.equal(postUpgradeBalance.toString());
      });

      it('sends ETH to fundingRecipient from buy edition transactions after upgrade if fundingRecipient is not the owner', async () => {
        const { miscAccounts } = await getAccounts();
        const {
          artistContract: preUpgradeProxy,
          fundingRecipient,
          artistCreator,
        } = await setUpContract({
          artistContractName: 'Artist',
          fundingRecipient: miscAccounts[0].address,
        });
        const initialBalance = await provider.getBalance(fundingRecipient);

        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV3',
          preUpgradeProxy,
          artistCreator,
        });

        const price = parseUnits('42');

        await upgradedProxy.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });

        const postBuyBalance = await provider.getBalance(fundingRecipient);

        expect(initialBalance.add(price).toString()).to.equal(postBuyBalance.toString());
      });
    });

    describe('Artist proxy deployed after upgrade', () => {
      it('returns expected tokenURI', async () => {
        const editionCount = 5;
        const { artistCreator, price } = await setUpContract({ editionCount, artistContractName: 'ArtistV2' });
        await upgradeArtistImplementation({ artistContractName: 'ArtistV3', artistCreator });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV3', artistCreator });
        await tokenURITest({ artistContract: postUpgradeProxy, editionCount, isPostUpgradeProxy: true, price });
      });

      it('returns expected totalSupply', async () => {
        const editionCount = 5;
        const quantity = 10;
        const { artistCreator, createEdition, price } = await setUpContract({
          editionCount,
          artistContractName: 'ArtistV2',
        });
        await upgradeArtistImplementation({ artistContractName: 'ArtistV3', artistCreator });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV3', artistCreator });
        await totalSupplyTest({
          artistContract: postUpgradeProxy,
          editionCount,
          quantity,
          isPostUpgradeProxy: true,
          price,
          createEdition,
        });
      });

      it('returns expected edition id from tokenToEdition', async () => {
        const editionCount = 5;
        const tokenQuantity = 10;
        const { artistCreator, createEdition, price } = await setUpContract({ artistContractName: 'ArtistV2' });

        await upgradeArtistImplementation({ artistContractName: 'ArtistV3', artistCreator });

        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV3', artistCreator });

        await createEditions({ artistContract: postUpgradeProxy, editionCount, postUpgradeVersion: 3, createEdition });

        for (let currentEditionId = 1; currentEditionId <= editionCount; currentEditionId++) {
          for (let tokenSerialNum = 1; tokenSerialNum <= tokenQuantity; tokenSerialNum++) {
            // Buy token of edition
            await postUpgradeProxy.buyEdition(currentEditionId, EMPTY_SIGNATURE, { value: price });
            const tokenId = getTokenId(currentEditionId, tokenSerialNum);
            const editionId = await postUpgradeProxy.tokenToEdition(tokenId);
            expect(editionId.toNumber()).to.equal(currentEditionId);
          }
        }
      });
    });
  });

  describe('ArtistV3.sol -> ArtistV4.sol', () => {
    describe('Artist proxy deployed before upgrade', () => {
      it('can sell an edition before and after upgrade', async () => {
        const {
          artistContract: preUpgradeProxy,
          price,
          quantity,
          royaltyBPS,
          endTime,
          createEdition,
          artistCreator,
          soundOwner,
        } = await setUpContract({ artistContractName: 'Artist' });

        const signers = await ethers.getSigners();
        const buyer = signers[10];

        await preUpgradeProxy.buyEdition(EDITION_ID, { value: price });

        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV4',
          preUpgradeProxy,
          artistCreator,
        });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV4', artistCreator });

        const startTime = BigNumber.from(currentSeconds() + 999999);
        const permissionedQuantity = quantity;
        const signerAddress = soundOwner.address;
        const editionTx = await createEdition({
          artistContract: postUpgradeProxy,
          editionArgs: {
            price,
            quantity,
            royaltyBPS,
            startTime,
            endTime,
            permissionedQuantity,
            signerAddress,
          },
        });
        await editionTx.wait();

        const ticketNumber = '0';
        const signature = await getPresaleSignature({
          chainId,
          provider,
          editionId: EDITION_ID,
          privateKey: process.env.ADMIN_PRIVATE_KEY,
          contractAddress: postUpgradeProxy.address,
          buyerAddress: buyer.address,
          ticketNumber,
        });

        const tx = await upgradedProxy.buyEdition(EDITION_ID, signature, ticketNumber, { value: price });
        const receipt = await tx.wait();
        const editionInfo = await upgradedProxy.editions(EDITION_ID);

        expect(editionInfo.numSold).to.equal(2);
        expect(receipt.status).to.equal(1);
      });

      it('can create and sell an open edition after upgrade', async () => {
        const {
          artistContract: preUpgradeProxy,
          soundOwner,
          miscAccounts,
          fundingRecipient,
          price,
          royaltyBPS,
          endTime,
          createEdition,
          artistCreator,
        } = await setUpContract({ artistContractName: 'ArtistV3' });
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV4',
          preUpgradeProxy,
          artistCreator,
        });
        const postUpgradeProxy = await deployArtistProxyPostUpgrade({ artistContractName: 'ArtistV4', artistCreator });

        const startTime = BigNumber.from(currentSeconds() + 999999);
        const quantity = 5;
        const permissionedQuantity = quantity * 2;
        const signerAddress = soundOwner.address;
        const editionTx = await createEdition({
          artistContract: postUpgradeProxy,
          editionArgs: {
            fundingRecipient,
            price,
            quantity,
            royaltyBPS,
            startTime,
            endTime,
            permissionedQuantity,
            signerAddress,
          },
        });
        await editionTx.wait();

        for (let i = 1; i <= permissionedQuantity; i++) {
          const ticketNumber = i;
          const currentBuyer = miscAccounts[i];
          const signature = await getPresaleSignature({
            chainId,
            provider,
            editionId: EDITION_ID,
            privateKey: process.env.ADMIN_PRIVATE_KEY,
            contractAddress: postUpgradeProxy.address,
            buyerAddress: currentBuyer.address,
            ticketNumber: ticketNumber.toString(),
          });

          const tx = await upgradedProxy.buyEdition(EDITION_ID, signature, ticketNumber, { value: price });
          const receipt = await tx.wait();
          const editionInfo = await upgradedProxy.editions(EDITION_ID);

          expect(editionInfo.numSold).to.equal(i);
          expect(receipt.status).to.equal(1);
        }
      });
    });
  });

  describe('ArtistV4 -> ArtistV5', () => {
    describe('Artist proxy deployed before upgrade', () => {
      it('can set admins', async () => {
        const {
          artistContract: preUpgradeProxy,
          artistAccount,
          price,
          startTime,
          endTime,
          quantity,
          artistCreator,
          createEdition,
        } = await setUpContract({ artistContractName: 'ArtistV4' });
        const editionCount = 50;
        // Add some storage to the contract
        await createEditions({ artistContract: preUpgradeProxy, editionCount, createEdition });
        // Upgrade
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV5',
          preUpgradeProxy,
          artistCreator,
        });
        // Test admin functionality
        const role = ethers.utils.id('ADMIN');

        for (let i = 0; i < 100; i++) {
          const newAdmin = ethers.Wallet.fromMnemonic(process.env.MNEMONIC, `m/44'/60'/0'/0/${i}`);
          await upgradedProxy.connect(artistAccount).grantRole(role, newAdmin.address);

          const hasRole = await upgradedProxy.hasRole(role, newAdmin.address);

          await expect(hasRole).to.be.true;
        }

        // Ensure storage hasn't been corrupted
        for (let i = 0; i < editionCount; i++) {
          const editionInfo = await upgradedProxy.editions(i + 1);
          expect(editionInfo.price).to.equal(price);
          expect(editionInfo.numSold).to.equal(0);
          expect(editionInfo.permissionedQuantity).to.equal(0);
          expect(editionInfo.startTime).to.equal(startTime);
          expect(editionInfo.endTime).to.equal(endTime);
          expect(editionInfo.quantity).to.equal(quantity);
        }
      });

      it(`doesn't corrupt ownership after upgrade`, async () => {
        const { artistContract: preUpgradeProxy, artistCreator } = await setUpContract({
          artistContractName: 'ArtistV4',
        });
        const ownerBeforeUpgrade = await preUpgradeProxy.owner();

        // Upgrade
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'ArtistV5',
          preUpgradeProxy,
          artistCreator,
        });

        const ownerAfterUpgrade = await upgradedProxy.owner();

        await expect(ownerBeforeUpgrade).to.equal(ownerAfterUpgrade);
      });

      it(`doesn't have corrupted data after next upgrade`, async () => {
        const editionCount = 30;
        const {
          artistContract: preUpgradeProxy,
          artistCreator,
          price,
          startTime,
          endTime,
          quantity,
        } = await setUpContract({
          artistContractName: 'ArtistV5',
          editionCount,
        });

        // Upgrade
        const upgradedProxy = await upgradeArtistImplementation({
          artistContractName: 'TEST_ArtistV6',
          preUpgradeProxy,
          artistCreator,
        });

        // Ensure storage hasn't been corrupted
        const someNumber = 12345678;
        await upgradedProxy.setSomeNumber(someNumber);

        const expectedNumber = await upgradedProxy.someNumber();

        await expect(someNumber).to.equal(expectedNumber.toNumber());

        for (let i = 0; i < editionCount; i++) {
          const editionInfo = await upgradedProxy.editions(i + 1);
          expect(editionInfo.price).to.equal(price);
          expect(editionInfo.numSold).to.equal(0);
          expect(editionInfo.permissionedQuantity).to.equal(0);
          expect(editionInfo.startTime).to.equal(startTime);
          expect(editionInfo.endTime).to.equal(endTime);
          expect(editionInfo.quantity).to.equal(quantity);
        }
      });
    });
  });
});

//================== REUSABLE TESTS ==================/

const setStartTimeTest = async (artistContract: Contract) => {
  const newTime = 1743324758;

  const tx = await artistContract.setStartTime(EDITION_ID, newTime);
  const receipt = await tx.wait();

  const { args } = artistContract.interface.parseLog(receipt.events[0]);
  expect(args.newTime).to.equal(newTime);
  expect(args.timeType).to.equal(TimeType.START);
};

const setEndTimeTest = async (artistContract: Contract) => {
  const newTime = 1843325072;

  const tx = await artistContract.setEndTime(EDITION_ID, newTime);
  const receipt = await tx.wait();

  const { args } = artistContract.interface.parseLog(receipt.events[0]);
  expect(args.newTime).to.equal(newTime);
  expect(args.timeType).to.equal(TimeType.END);
};

const rejectPresalePurchaseTest = async ({
  artistContract,
  createEdition,
  price,
}: {
  artistContract: Contract;
  createEdition: CreateEditionFn;
  price: number | BigNumber;
}) => {
  const startTime = BigNumber.from(Math.floor(Date.now() / 1000) + 999999);
  const permissionedQuantity = 1;

  const editionTx = await createEdition({
    artistContract,
    postUpgradeVersion: 2,
    editionArgs: {
      startTime,
      permissionedQuantity,
    },
  });
  await editionTx.wait();

  const tx = artistContract.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });

  await expect(tx).to.be.revertedWith('ECDSA: invalid signature');
};

const openSalePurchaseTest = async ({
  artistContract,
  createEdition,
  price,
}: {
  artistContract: Contract;
  createEdition: CreateEditionFn;
  price: number | BigNumber;
}) => {
  const startTime = BigNumber.from(0);
  const permissionedQuantity = 0;
  const editionTx = await createEdition({
    artistContract,
    postUpgradeVersion: 2,
    editionArgs: {
      startTime,
      permissionedQuantity,
    },
  });
  await editionTx.wait();

  const tx = await artistContract.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });
  const receipt = await tx.wait();

  expect(receipt.status).to.equal(1);
};

const tokenURITest = async ({
  artistContract,
  editionCount,
  isPostUpgradeProxy,
  price,
}: {
  artistContract: Contract;
  editionCount: number;
  isPostUpgradeProxy?: boolean;
  price: number | BigNumber;
}) => {
  for (let editionId; editionId < editionCount; editionId++) {
    const tokenSerialNum = 1;

    // Buy token of edition
    await artistContract.buyEdition(editionId, EMPTY_SIGNATURE, { value: price });
    const tokenId = isPostUpgradeProxy ? getTokenId(EDITION_ID, tokenSerialNum) : tokenSerialNum;
    const tokenURI = await artistContract.tokenURI(tokenId);

    expect(tokenURI).to.equal(`${baseURIs.hardhat}${EDITION_ID}/${tokenSerialNum}`);
  }
};

const totalSupplyTest = async ({
  artistContract,
  editionCount,
  quantity,
  isPostUpgradeProxy,
  createEdition,
  price,
}: {
  artistContract: Contract;
  editionCount: number;
  quantity: number;
  isPostUpgradeProxy?: boolean;
  createEdition: CreateEditionFn;
  price: number | BigNumber;
}) => {
  if (isPostUpgradeProxy) {
    await createEditions({ artistContract, editionCount, postUpgradeVersion: 3, createEdition });
  }

  for (let editionId = 1; editionId <= editionCount; editionId++) {
    for (let tokenSerialNum = 1; tokenSerialNum <= quantity; tokenSerialNum++) {
      // Buy token of edition
      await artistContract.buyEdition(editionId, EMPTY_SIGNATURE, { value: price });
    }
  }
  const totalSupply = await artistContract.totalSupply();

  expect(totalSupply.toNumber()).to.equal(editionCount * quantity);
};
