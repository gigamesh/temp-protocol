import { BigNumber, utils, Wallet } from 'ethers';

export const MAX_UINT32 = 4294967295;
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const EMPTY_SIGNATURE =
  '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export function getEtherscanLink(network: string, txHash: string) {
  return `https://${network !== 'mainnet' ? network + '.' : ''}etherscan.io/tx/${txHash}`;
}

export function currentSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function getRandomInt(min = 0, max = MAX_UINT32) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function getRandomBN(max?: number) {
  const rando = BigNumber.from(utils.randomBytes(4));
  if (max) {
    return rando.mod(max.toString());
  }
  return rando;
}
