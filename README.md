# Quartz contracts

Tezos smart contracts for [Ubisoft Quartz](https://quartz.ubisoft.com) NFT written in [Archetype](https://archetype-lang.org/).

## Architecture
The Quartz NFT (also known as Digits) are non-fungible [FA2 tokens](https://tezos.b9lab.com/fa2). Token minting and transfer is supervised by a contract that guarantees the Quartz rules such as collection size, whitelisting and quotas.

Each Quartz item type is referred here as an archetype. An archetype is a collection where each item has the same properties except for the unique serial number, owner and history.

Each archetype is defined by its id, the quota per wallet, and a contract that is responsible for the minting conditions. As of today, the only minting conditions is the collection size limit which only validates that the serial number is within the bounds.

## Contracts

### Quartz FA2
This is the core Quartz NFT contract. It implements [TZIP-12 FA2 - Multi-Asset Interface](https://gitlab.com/tezos/tzip/-/blob/master/proposals/tzip-12/tzip-12.md), [TZIP-16 Contract Metadata](https://gitlab.com/tezos/tzip/-/blob/master/proposals/tzip-16/tzip-16.md) and [TZIP-17 Contract Permit Interface](https://gitlab.com/tezos/tzip/-/blob/master/proposals/tzip-17/tzip-17.md)

Additionally, transfers are subject to validation from the Archetype contract. For wallet and marketplace integration convenience, the following getter will indicate if a transfer is allowed: ```getter can_transfer(tokenid: nat, from_: address, to_: address): string```
See the contract doc for return codes.

* Quartz FA2 (```quartz.arl```): [```KT1TnVQhjxeNvLutGvzwZvYtC7vKRpwPWhc6```](https://better-call.dev/mainnet/KT1TnVQhjxeNvLutGvzwZvYtC7vKRpwPWhc6)

### Quartz Archetype
Application-specific logic is handled by this contract. It holds a reference to the FA2 contract, the whitelist, and the balance per archetype per user.
For modularity purposes, the balances and archetype definitions (ledger) are stored in two separate storage contracts.

* Quartz Archetype (```archetype.arl```): [```KT1XBtM8Ww34LQ2UfXRqAFrpZfWKbz7UR4Yd```](https://better-call.dev/mainnet/KT1XBtM8Ww34LQ2UfXRqAFrpZfWKbz7UR4Yd)
* Ledger storage (```archetype_ledger.arl```): [```KT1LiqMALXqwQDmP7GYXPCzCCrTzhNi1dFBw```](https://better-call.dev/mainnet/KT1LiqMALXqwQDmP7GYXPCzCCrTzhNi1dFBw)
* Balances storage (```archetype_balance.arl```): [```KT1TNfVYa6zBGVScPF235aFawb2nZPWyA58f```](https://better-call.dev/mainnet/KT1TNfVYa6zBGVScPF235aFawb2nZPWyA58f)

### Quartz Whitelist
The whitelist contract is a [TZIP-15 A2 Token Transferlist interface](https://tzip.tezosagora.org/proposal/tzip-15/) contract.
Two transferlists are configured:
* 0 is the main whitelist, users in the list can receive a Quartz NFT
* 1 is the blacklist, users in the list cannot receive Quartz NFT. However, they can still transfer their NFT to the transferlist 0

Quartz Whitelist (```whitelist.arl```): [```KT1LEF2WLUJ2QqViWKYjYanYymVJ8gyjQnte```](https://better-call.dev/mainnet/KT1LEF2WLUJ2QqViWKYjYanYymVJ8gyjQnte)
Users storage (```users_storage.arl```): [```KT1J8yKdznsYoWmj3CAHt1xhS9Kf1UQgYJy6```](https://better-call.dev/mainnet/KT1J8yKdznsYoWmj3CAHt1xhS9Kf1UQgYJy6)

### Quartz minting validator
This contract implements a simple interface to validate the minting of NFT. It was designed to allow alternate conditions on the mint process.
Today, the only implementation in use is the Standard Minting Validator (or Simple Minting validator) that only checks that the serial number limit is respected.

* Standard Minting Validator (```simpleMintingValidator.arl```): [```KT1ECj4TzBN1UQmevB6y89g8pQbHyvSBSBzU```](https://better-call.dev/mainnet/KT1ECj4TzBN1UQmevB6y89g8pQbHyvSBSBzU)

### Quartz minter
To enable primary market NFT sales, a minter contract processes feeless stablecoin (Lugh EURL) payments and mints a Quartz NFT in a single operation.

* Quartz minter (```minter.arl```): [```KT1GhLFb6N4FQVGV7hgyiU9JL8E3KULg8Hk9```](https://better-call.dev/mainnet/KT1GhLFb6N4FQVGV7hgyiU9JL8E3KULg8Hk9)

## Build, test, and deploy

Contracts are built using the [Completium](https://completium.com/) toolkit. The kit comes with a CLI that enables various tasks. 

Install [tezos-client](https://assets.tqtezos.com/docs/setup/1-tezos-client/).

Then, in the contract repository, install the NPM depedencies:
```console
npm install
```
Setup accounts and initialize mockup chain
```console
alias ccli="npx completium-cli"
ccli init
ccli generate account as quartz_admin
ccli generate account as quartz_minter
ccli generate account as quartz_whitelister
ccli generate account as quartz_user
mkdir -p ~/.completium/mockup # mockup folder is missing in some setups
ccli mockup init
```

Run unit tests
```console
npm test
```