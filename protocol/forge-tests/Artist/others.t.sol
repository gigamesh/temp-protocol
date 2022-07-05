// setSignerAddress
// only allows owner to call function
// prevents attempt to set null address
// sets a new signer address for the edition
// emits event

// setPermissionedQuantity
// only allows owner to call function
// prevents attempt to set permissioned quantity when there is no signer address
// sets a new permissioned quantity for the edition
// emits event

// setBaseURI
// only allows owner to call function
// reverts on non-existent edition
// sets the edition baseURI
// continues to use default baseURI if edition.baseURI is equal to or less than 3 chars (ex: artist accidentally sets to empty spaces)
// emits event data

// totalSupply
// returns correct total supply

// contractURI returns expected URI

// royaltyInfo 
// returns no royalty info for non-existent token
// returns royalty info

// editionCount
// returns the correct number of editions
// returns the correct list of owners
// reverts when passed a nonexistent token

// checkTicketNumbers
// returns correct list of booleans corresponding to a given list of claimed or unclaimed ticket numbers

// setOwnerOverride
// Sound recovery address can transfer ownership of artist contract
// reverts if called by any address that isn't the owner (artist) or address returned from soundRecoveryAddress