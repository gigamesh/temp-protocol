import Artist from './artifacts/contracts/Artist.sol/Artist.json';
import hardhat_ArtistCreator from './deployments/localhost/ArtistCreator.json';
import hardhat_SplitMain from './deployments/localhost/SplitMain.json';
import mainnet_ArtistCreator from './deployments/mainnet/ArtistCreator.json';
import rinkeby_ArtistCreator from './deployments/rinkeby/ArtistCreator.json';

// Same address on all networks
const SPLIT_MAIN = '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE';

export const addresses = {
  // hardhat
  development: {
    artistCreator: hardhat_ArtistCreator.address,
    splitMain: hardhat_SplitMain.address,
  },
  // rinkeby
  preview: {
    artistCreator: rinkeby_ArtistCreator.address,
    splitMain: SPLIT_MAIN,
  },
  // rinkeby
  staging: {
    artistCreator: rinkeby_ArtistCreator.address,
    splitMain: SPLIT_MAIN,
  },
  // mainnet
  production: {
    artistCreator: mainnet_ArtistCreator.address,
    splitMain: SPLIT_MAIN,
  },
} as const;

export const abis = {
  ArtistCreator: rinkeby_ArtistCreator.abi,
  Artist: Artist.abi,
} as const;
