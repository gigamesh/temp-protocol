import { helpers as commonHelpers } from '@soundxyz/common';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import { BASE_URI, CHAIN_ID, EDITION_ID, getTokenId, NULL_TICKET_NUM, provider, setUpContract } from '../testHelpers';

import { currentSeconds, EMPTY_SIGNATURE, getRandomBN, getRandomInt, MAX_UINT32, NULL_ADDRESS } from '../../helpers';

chai.use(solidity);

const { getPresaleSignature } = commonHelpers;

export function setSignerAddressTests() {
  it('only allows owner to call function', async () => {
    const { artistContract, miscAccounts } = await setUpContract();

    const tx = artistContract.connect(miscAccounts[0]).setSignerAddress(EDITION_ID, NULL_ADDRESS);

    await expect(tx).to.be.revertedWith('unauthorized');
  });

  it('prevents attempt to set null address', async () => {
    const { artistContract, artistAccount } = await setUpContract();

    const tx = artistContract.connect(artistAccount).setSignerAddress(EDITION_ID, NULL_ADDRESS);

    await expect(tx).to.be.revertedWith('Signer address cannot be 0');
  });

  it('sets a new signer address for the edition', async () => {
    const { artistContract, artistAccount, miscAccounts } = await setUpContract();
    const newSigner = miscAccounts[0];

    const tx = await artistContract.connect(artistAccount).setSignerAddress(EDITION_ID, newSigner.address);
    await tx.wait();

    const editionInfo = await artistContract.editions(EDITION_ID);

    await expect(editionInfo.signerAddress).to.equal(newSigner.address);
  });

  it('emits event', async () => {
    const { artistContract, artistAccount, miscAccounts } = await setUpContract();
    const newSigner = miscAccounts[0];

    const tx = await artistContract.connect(artistAccount).setSignerAddress(EDITION_ID, newSigner.address);
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === 'SignerAddressSet');

    await expect(event.args.editionId).to.eq(EDITION_ID);
    await expect(event.args.signerAddress).to.eq(newSigner.address);
  });
}

export function setPermissionedQuantityTests() {
  it('only allows owner to call function', async () => {
    const { artistContract, miscAccounts } = await setUpContract();
    const notOwner = miscAccounts[0];

    const tx = artistContract.connect(notOwner).setPermissionedQuantity(EDITION_ID, 69);

    await expect(tx).to.be.revertedWith('unauthorized');
  });

  it('prevents attempt to set permissioned quantity when there is no signer address', async () => {
    const { artistContract, artistAccount } = await setUpContract({
      quantity: BigNumber.from(69),
      signerAddress: NULL_ADDRESS,
    });

    const tx = artistContract.connect(artistAccount).setPermissionedQuantity(EDITION_ID, 1);

    await expect(tx).to.be.revertedWith('Edition must have a signer');
  });

  it('sets a new permissioned quantity for the edition', async () => {
    const newPermissionedQuantity = 420;
    const { artistContract, artistAccount } = await setUpContract({
      quantity: BigNumber.from(420),
      permissionedQuantity: BigNumber.from(69),
    });

    const tx = await artistContract.connect(artistAccount).setPermissionedQuantity(EDITION_ID, newPermissionedQuantity);
    await tx.wait();

    const editionInfo = await artistContract.editions(EDITION_ID);

    await expect(editionInfo.permissionedQuantity.toString()).to.equal(newPermissionedQuantity.toString());
  });

  it('emits event', async () => {
    const newPermissionedQuantity = 420;
    const { artistContract, artistAccount } = await setUpContract({
      quantity: BigNumber.from(420),
      permissionedQuantity: BigNumber.from(69),
    });
    const tx = await artistContract.connect(artistAccount).setPermissionedQuantity(EDITION_ID, newPermissionedQuantity);
    const receipt = await tx.wait();

    const event = receipt.events.find((e) => e.event === 'PermissionedQuantitySet');

    await expect(event.args.editionId).to.equal(EDITION_ID);
    await expect(event.args.permissionedQuantity.toString()).to.equal(newPermissionedQuantity.toString());
  });
}

export async function setBaseURITests() {
  it('only allows owner to call function', async () => {
    const { artistContract, miscAccounts } = await setUpContract({});

    const tx = artistContract.connect(miscAccounts[0]).setEditionBaseURI(EDITION_ID, 'https://example.com');

    await expect(tx).to.be.revertedWith('unauthorized');
  });

  it('reverts on non-existent edition', async () => {
    const { artistContract, artistAccount } = await setUpContract({ skipCreateEditions: true });

    const tx1 = artistContract.connect(artistAccount).setEditionBaseURI(EDITION_ID, 'https://example.com');
    const tx2 = artistContract.connect(artistAccount).setEditionBaseURI(42069, 'https://example.com');

    await expect(tx1).to.be.revertedWith('Nonexistent edition');
    await expect(tx2).to.be.revertedWith('Nonexistent edition');
  });

  it('sets the edition baseURI', async () => {
    const { artistContract, artistAccount, price } = await setUpContract();
    const newBaseURI = 'https://example.com/';

    await artistContract
      .connect(artistAccount)
      .buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, { value: price });

    const tokenId = getTokenId(EDITION_ID, 1);
    const originalTokenURI = await artistContract.tokenURI(tokenId);

    const tx = await artistContract.connect(artistAccount).setEditionBaseURI(EDITION_ID, newBaseURI);
    await tx.wait();

    const editionInfo = await artistContract.editions(EDITION_ID);
    const newTokenURI = await artistContract.tokenURI(tokenId);

    await expect(originalTokenURI).to.equal(`${BASE_URI}${artistContract.address.toLowerCase()}/${tokenId.toString()}`);
    await expect(editionInfo.baseURI).to.equal(newBaseURI);
    await expect(newTokenURI).to.equal(`${newBaseURI}${tokenId.toString()}/metadata.json`);
  });

  it('continues to use default baseURI if edition.baseURI is equal to or less than 3 chars (ex: artist accidentally sets to empty spaces)', async () => {
    const { artistContract, artistAccount, price } = await setUpContract();
    const newBaseURI = '   ';
    await artistContract
      .connect(artistAccount)
      .buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, { value: price });
    const tokenId = getTokenId(EDITION_ID, 1);
    const tx = await artistContract.connect(artistAccount).setEditionBaseURI(EDITION_ID, newBaseURI);
    await tx.wait();
    const newTokenURI = await artistContract.tokenURI(tokenId);
    await expect(newTokenURI).to.equal(`${BASE_URI}${artistContract.address.toLowerCase()}/${tokenId.toString()}`);
  });

  it('emits event data', async () => {
    const { artistContract, artistAccount, price } = await setUpContract();
    const newBaseURI = 'https://example.com/';

    await artistContract
      .connect(artistAccount)
      .buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, { value: price });

    const tx = await artistContract.connect(artistAccount).setEditionBaseURI(EDITION_ID, newBaseURI);
    const receipt = await tx.wait();

    const eventData = receipt.events.find((e) => e.event === 'BaseURISet').args;

    await expect(eventData.baseURI).to.be.equal(newBaseURI);
    await expect(eventData.editionId).to.be.equal(EDITION_ID);
  });
}

export async function editionCountTests() {
  it('returns the correct number of editions', async () => {
    const editionCount = 42;
    const { artistContract } = await setUpContract({ editionCount });

    const expectedCount = await artistContract.editionCount();

    await expect(editionCount).to.eq(expectedCount.toNumber());
  });
}

export async function ownersOfTokenIdsTests() {
  it('returns the correct list of owners', async () => {
    const editionQuantity = 10;
    const editionCount = 3;
    const { miscAccounts, artistContract, price } = await setUpContract({ editionCount, quantity: BigNumber.from(10) });

    const tokenIds = [];
    const expectedOwners = [];
    for (let editionId = 1; editionId <= editionCount; editionId++) {
      for (let ticketNumber = 0; ticketNumber < editionQuantity; ticketNumber++) {
        const currentBuyer = miscAccounts[ticketNumber % miscAccounts.length]; // loops over buyers
        await artistContract.connect(currentBuyer).buyEdition(editionId, EMPTY_SIGNATURE, ticketNumber, {
          value: price,
        });
        const numSold = ticketNumber + 1;
        const expectedTokenId = getTokenId(editionId, numSold);
        expectedOwners.push(currentBuyer.address);
        tokenIds.push(expectedTokenId);
      }
    }
    const actualOwners = await artistContract.ownersOfTokenIds(tokenIds);
    await expect(expectedOwners).to.deep.eq(actualOwners);
  });

  it('reverts when passed a nonexistent token', async () => {
    const { artistContract, price } = await setUpContract();
    const [_, buyer] = await ethers.getSigners();

    const tokenIds = [];
    const expectedOwners = [];
    await artistContract.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, 1, {
      value: price,
    });
    const expectedTokenId = getTokenId(EDITION_ID, 1);
    expectedOwners.push(buyer.address);
    tokenIds.push(expectedTokenId.add(69));

    const ownersResponse = artistContract.ownersOfTokenIds(tokenIds);
    await expect(ownersResponse).to.be.revertedWith('ERC721: owner query for nonexistent token');
  });
}

export function checkTicketNumbersTests() {
  it('returns correct list of booleans corresponding to a given list of claimed or unclaimed ticket numbers', async () => {
    const editionQuantity = 10;
    const { miscAccounts, artistContract, price } = await setUpContract({
      quantity: BigNumber.from(10),
      permissionedQuantity: BigNumber.from(MAX_UINT32),
      startTime: BigNumber.from(currentSeconds() + 9999),
    });

    const ticketNumbers = [];
    const expectedList = [];
    for (let ticketNumber = 0; ticketNumber < editionQuantity; ticketNumber++) {
      const currentBuyer = miscAccounts[ticketNumber % miscAccounts.length]; // loops over buyers
      const signature = await getPresaleSignature({
        chainId: CHAIN_ID,
        provider,
        editionId: EDITION_ID,
        ticketNumber: ticketNumber.toString(),
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artistContract.address,
        buyerAddress: currentBuyer.address,
      });
      await artistContract.connect(currentBuyer).buyEdition(EDITION_ID, signature, ticketNumber, {
        value: price,
      });
      // Pushes a used ticket number onto the list
      ticketNumbers.push(ticketNumber);
      expectedList.push(true);
      // Pushes an unused ticket number on to the list
      ticketNumbers.push(ticketNumber + getRandomInt(editionQuantity, 10000));
      expectedList.push(false);
    }
    const actualList = await artistContract.checkTicketNumbers(EDITION_ID, ticketNumbers);

    await expect(expectedList).to.deep.eq(actualList);
  });
}

export function setOwnerOverrideTests() {
  it(`Sound recovery address can transfer ownership of artist contract`, async () => {
    const { artistContract, soundOwner } = await setUpContract({ artistContractName: 'MOCK_ArtistV5' });

    await artistContract.connect(soundOwner).setOwnerOverride(soundOwner.address);
    const newOwner = await artistContract.owner();

    await expect(newOwner).to.eq(soundOwner.address);
  });

  it(`setOwnerOverride reverts if called by any address that isn't the owner (artist) or address returned from soundRecoveryAddress`, async () => {
    const { artistContract, miscAccounts } = await setUpContract({ artistContractName: 'MOCK_ArtistV5' });

    for (const account of miscAccounts) {
      const setOwnerOverride = artistContract.connect(account).setOwnerOverride(account.address);
      await expect(setOwnerOverride).to.be.revertedWith('unauthorized');
    }
  });
}
