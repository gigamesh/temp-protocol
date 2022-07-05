import { helpers } from '@soundxyz/common';
import { BigNumber, Contract } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, upgrades, waffle } from 'hardhat';

import { SplitMain__factory } from '../typechain';
import { getRandomBN, MAX_UINT32 } from '../helpers';

import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
export type DeployArtistFn = typeof deployArtistProxy;

const { getAuthSignature } = helpers;
export const { provider } = waffle;

//========== Constants =========//

export const EXAMPLE_ARTIST_NAME = 'Alpha & Omega';
export const EXAMPLE_ARTIST_ID = 1;
export const EXAMPLE_ARTIST_SYMBOL = 'AOMEGA';
export const BASE_URI = `https://sound-staging.vercel.app/api/metadata/`;
export const INVALID_PRIVATE_KEY = '0xb73249a6bf495f81385ce91b84cc2eff129011fea429ba7f1827d73b06390208';
export const NULL_TICKET_NUM = '0x0';
export const CHAIN_ID = 1337;
export const EDITION_ID = 1;

//========= Types ==========//

type SplitInfo = {
  accounts: string[];
  percentAllocations: number[];
  distributorFee: number;
  controller: string;
};

export type EditionArgs = {
  fundingRecipient?: string;
  price?: number | BigNumber;
  quantity?: number | BigNumber;
  royaltyBPS?: number | BigNumber;
  startTime?: number | BigNumber;
  endTime?: number | BigNumber;
  permissionedQuantity?: number | BigNumber;
  signerAddress?: string;
  editionId?: number;
  baseURI?: string;
};

type CustomConfigArgs = EditionArgs & {
  editionCount?: number;
  skipCreateEditions?: boolean;
  artistContractName?: string;
  artistCreatorVersion?: number;
};

//========= Helpers ==========//

export async function getAccounts() {
  let soundOwner: SignerWithAddress;
  let artist1: SignerWithAddress;
  let artist2: SignerWithAddress;
  let artist3: SignerWithAddress;
  let miscAccounts: SignerWithAddress[];
  [soundOwner, artist1, artist2, artist3, ...miscAccounts] = await ethers.getSigners();
  return { soundOwner, artist1, artist2, artist3, miscAccounts };
}

export async function createArtist(
  artistCreator: Contract,
  signer: SignerWithAddress,
  artistName: string,
  symbol: string,
  baseURI: string
) {
  const chainId = (await provider.getNetwork()).chainId;

  // Get sound.xyz signature to approve artist creation
  const signature = await getAuthSignature({
    artistWalletAddr: signer.address,
    privateKey: process.env.ADMIN_PRIVATE_KEY,
    chainId,
    provider,
  });

  return artistCreator.connect(signer).createArtist(signature, artistName, symbol, baseURI);
}

export type CreateEditionFn = ({
  customDeployer,
  artistContract: customArtistContract,
  editionArgs,
  postUpgradeVersion,
}?: {
  customDeployer?: SignerWithAddress;
  artistContract?: Contract;
  editionArgs?: EditionArgs;
  postUpgradeVersion?: number;
}) => Promise<any>;

export async function deployArtistProxy({
  artistAccount,
  soundOwner,
  artistCreatorVersion = 2,
  artistContractName = 'ArtistV5',
}: {
  artistAccount: SignerWithAddress;
  soundOwner: SignerWithAddress;
  artistCreatorVersion?: number;
  artistContractName?: string;
}) {
  // Deploy ArtistCreator (deployProxy deploys *and* initializes ArtistCreator)
  const ArtistCreatorFactory = await ethers.getContractFactory('ArtistCreator');
  let artistCreator = await upgrades.deployProxy(ArtistCreatorFactory);
  await artistCreator.deployed();

  // Upgrade ArtistCreator if needed
  if (artistCreatorVersion > 1) {
    const ACUpgradeFactory = await ethers.getContractFactory(`ArtistCreatorV${artistCreatorVersion}`);
    artistCreator = await upgrades.upgradeProxy(artistCreator.address, ACUpgradeFactory);
  }

  // Deploy latest Artist implementation
  const Artist = await ethers.getContractFactory(artistContractName);
  const chainId = (await provider.getNetwork()).chainId;
  const artistImpl = await Artist.deploy();
  await artistImpl.deployed();

  // Upgrade beacon to point to latest implementation
  const beaconAddress = await artistCreator.beaconAddress();
  const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundOwner);
  const beaconTx = await beaconContract.upgradeTo(artistImpl.address);
  await beaconTx.wait();

  // Get sound.xyz signature to approve artist creation
  const signature = await getAuthSignature({
    artistWalletAddr: artistAccount.address,
    privateKey: process.env.ADMIN_PRIVATE_KEY,
    chainId,
    provider,
  });

  const tx = await artistCreator
    .connect(artistAccount)
    .createArtist(signature, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL, BASE_URI);
  const receipt = await tx.wait();
  const contractAddress = receipt.events.find((e) => e.event === 'CreatedArtist').args.artistAddress;

  const artistContract = await ethers.getContractAt(artistContractName, contractAddress);

  return { artistContract, artistCreator };
}

// shifts edition id to the left by 128 bits and adds the token id in the bottom bits
export function getTokenId(editionId: number | string, numSold: number | string) {
  const shiftFactor = BigNumber.from(1).mul(2).pow(128);
  return BigNumber.from(editionId).mul(shiftFactor).add(numSold);
}

export async function createSplit({ splitMainAddress, splitInfo }: { splitMainAddress; splitInfo: SplitInfo }) {
  const { accounts, percentAllocations, distributorFee, controller } = splitInfo;

  const splitMain = await SplitMain__factory.connect(splitMainAddress, provider);
  const tx = await splitMain.createSplit(accounts, percentAllocations, distributorFee, controller);

  const receipt = await tx.wait();
  const splitAddress = receipt.events.find((e) => e.event === 'CreateSplit').args.split;

  if (!splitAddress) {
    throw new Error('Split address not found in event logs');
  }

  return splitAddress;
}

export async function setUpContract({
  artistContractName = 'ArtistV5',
  artistCreatorVersion = 1,
  editionCount = 1,
  skipCreateEditions,
  ...customConfig
}: CustomConfigArgs = {}) {
  const artistVersion = Number(artistContractName[artistContractName.length - 1]);

  // ArtistV5 set up
  if (artistVersion >= 5) {
    artistCreatorVersion = 2;
  }

  const { soundOwner, artist1: artistAccount, miscAccounts } = await getAccounts();

  const { artistContract, artistCreator } = await deployArtistProxy({
    artistAccount,
    soundOwner,
    artistContractName,
    artistCreatorVersion,
  });

  const price = customConfig.price || parseEther('0.1');
  const quantity = customConfig.quantity || getRandomBN();
  const royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
  const startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
  const endTime = customConfig.endTime || BigNumber.from(MAX_UINT32);
  const fundingRecipient = customConfig.fundingRecipient || artistAccount.address;
  const permissionedQuantity = customConfig.permissionedQuantity || BigNumber.from(0);
  const signerAddress = customConfig.signerAddress || soundOwner.address;
  const editionId = customConfig.editionId || EDITION_ID;
  const baseURI = customConfig.baseURI || '';

  async function createEdition({
    customDeployer,
    artistContract: customArtistContract,
    editionArgs,
    postUpgradeVersion,
  }:
    | {
        customDeployer?: SignerWithAddress;
        artistContract?: Contract;
        editionArgs?: EditionArgs;
        postUpgradeVersion?: number;
      }
    | undefined = {}) {
    const deployer = customDeployer || artistAccount;

    const args: EditionArgs = {
      fundingRecipient,
      price,
      quantity,
      royaltyBPS,
      startTime,
      endTime,
    };
    const version = postUpgradeVersion || artistVersion;
    if (version >= 2) {
      args.permissionedQuantity = permissionedQuantity;
      args.signerAddress = signerAddress;
    }
    if (version >= 5) {
      args.editionId = editionId;
      args.baseURI = baseURI;
    }

    // Merge default args with custom ones passed in for each test
    const mergedArgs = {
      ...args,
      ...editionArgs,
    };
    const editionArgsArray = Object.values(mergedArgs);

    const contract = customArtistContract || artistContract;

    return await contract.connect(deployer).createEdition(...editionArgsArray);
  }

  let eventData;

  if (!skipCreateEditions) {
    for (let editionId = 1; editionId <= editionCount; editionId++) {
      // Only pass editionId if we're on ArtistV5 or greater
      const editionArgs = artistVersion >= 5 ? { editionId } : {};

      const createEditionTx = await createEdition({ editionArgs });

      const editionReceipt = await createEditionTx.wait();
      const contractEvent = artistContract.interface.parseLog(editionReceipt.events[0]);

      // note: if editionCount > 1, this will be the last event emitted
      eventData = contractEvent.args;
    }
  }

  return {
    artistContract,
    artistCreator,
    fundingRecipient,
    price: price instanceof BigNumber ? price : BigNumber.from(price),
    quantity: quantity instanceof BigNumber ? quantity : BigNumber.from(quantity),
    royaltyBPS: royaltyBPS instanceof BigNumber ? royaltyBPS : BigNumber.from(royaltyBPS),
    startTime: startTime instanceof BigNumber ? startTime : BigNumber.from(startTime),
    endTime: endTime instanceof BigNumber ? endTime : BigNumber.from(endTime),
    permissionedQuantity:
      permissionedQuantity instanceof BigNumber ? permissionedQuantity : BigNumber.from(permissionedQuantity),
    signerAddress,
    soundOwner,
    artistAccount,
    miscAccounts,
    eventData,
    createEdition,
  };
}

export const createEditions = async ({
  artistContract,
  editionCount,
  postUpgradeVersion,
  createEdition,
}: {
  artistContract: Contract;
  editionCount: number;
  postUpgradeVersion?: number;
  createEdition: CreateEditionFn;
}) => {
  for (let editionId = 1; editionId <= editionCount; editionId++) {
    await createEdition({
      artistContract,
      editionArgs: postUpgradeVersion >= 5 ? { editionId } : {},
      postUpgradeVersion,
    });
  }
};
