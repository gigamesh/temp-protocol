import '@nomiclabs/hardhat-ethers';

import {
  checkTicketNumbersTests,
  editionCountTests,
  ownersOfTokenIdsTests,
  setPermissionedQuantityTests,
  setSignerAddressTests,
  setOwnerOverrideTests,
  setBaseURITests,
} from './others';

describe('Artist proxy', () => {
  describe('setSignerAddress', () => {
    setSignerAddressTests();
  });

  describe('setPermissionedQuantity', () => {
    setPermissionedQuantityTests();
  });

  describe('setBaseURI', () => {
    setBaseURITests();
  });

  describe('editionCount', () => {
    editionCountTests();
  });

  describe('ownersOfTokenIds', () => {
    ownersOfTokenIdsTests();
  });

  describe('checkTicketNumbers', () => {
    checkTicketNumbersTests();
  });

  describe('setOwnerOverride', () => {
    setOwnerOverrideTests();
  });
});
