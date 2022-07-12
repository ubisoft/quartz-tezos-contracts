const { deploy, getAccount, setQuiet, expectToThrow, runGetter, getEndpoint } = require('@completium/completium-cli');
const { generateArchetypeId, pauseAndVerify, unpauseAndVerify, checkFA2Balance, getTokenId, errors } = require('./utils');
const assert = require('assert');

setQuiet(true);

const mockup_mode = getEndpoint() === 'mockup'

// contracts
let whitelist_users;
let whitelist;
let quartz;
let archetype_ledger;
let archetype_balance;
let archetype;
let fa2getbalanceof;
let simplevalidator;

// accounts
const admin = getAccount(mockup_mode ? 'alice' : "quartz_admin");
const whitelister = getAccount(mockup_mode ? 'bob' : "quartz_whitelister");
const minter = getAccount(mockup_mode ? 'carl' : "quartz_minter");
const recipient0 = getAccount(mockup_mode ? 'bootstrap1' : "quartz_recipient0");
const recipient1 = getAccount(mockup_mode ? 'bootstrap2' : "quartz_recipient1");
const recipient2 = getAccount(mockup_mode ? 'bootstrap3' : "quartz_recipient2");
const recipient3 = getAccount(mockup_mode ? 'bootstrap4' : "quartz_recipient3");
const recipient4 = getAccount(mockup_mode ? 'bootstrap5' : "quartz_recipient4");

const recipients = [recipient0, recipient1, recipient2, recipient3, recipient4];

// constants
const archetype1 = generateArchetypeId();
const archetype2 = generateArchetypeId();
const archetypeLimit = 25; // number of serial numbers
const archetypeMaxByOwner = 4;  // maximum number per user

// tokens
let tokens;

// function
let checkBalance;


describe("Deploy & init", async () => {
  it("Whitelist users storage", async () => {
    [whitelist_users, _] = await deploy('./whitelist-smart-contract-archetype/contract/users_storage.arl', {
      parameters: {
        admin: whitelister.pkh
      },
      named: 'test_ubi_whitelist_users',
      as: admin.pkh
    });
  });
  it("Whitelist", async () => {
    [whitelist, _] = await deploy('./whitelist-smart-contract-archetype/contract/whitelist.arl', {
      parameters: {
        admin: whitelister.pkh,
        users: whitelist_users.address,
      },
      named: 'test_ubi_whitelist',
      as: admin.pkh
    });
  });
  it("Archetype Ledger", async () => {
    [archetype_ledger, _] = await deploy('./contracts/archetype_ledger.arl', {
      parameters: {
        admin: admin.pkh,
      },
      named: 'test_ubi_archledger',
      as: admin.pkh
    });
  });
  it("Archetype Owner", async () => {
    [archetype_balance, _] = await deploy('./contracts/archetype_balance.arl', {
      parameters: {
        admin: admin.pkh,
      },
      named: 'test_ubi_archowner',
      as: admin.pkh
    });
  });
  it("Quartz", async () => {
    [quartz, _] = await deploy('./contracts/quartz.arl', {
      parameters: {
        admin: admin.pkh
      },
      named: 'test_ubi_quartz',
      as: admin.pkh
    });
  });
  it("Archetype", async () => {
    [archetype, _] = await deploy('./contracts/archetype.arl', {
      parameters: {
        admin: admin.pkh,
        whitelist: whitelist.address,
        quartz: quartz.address,
        archetype_ledger: archetype_ledger.address,
        archetype_balance: archetype_balance.address
      },
      named: 'test_ubi_archetype',
      as: admin.pkh
    });
  });
  it("Link Archetype Ledger contract", async () => {
    await archetype_ledger.setArchetype({
      arg: {
        a: archetype.address
      },
      as: admin.pkh
    })
  });
  it("Link Archetype Owner contract", async () => {
    await archetype_balance.setArchetype({
      arg: {
        a: archetype.address
      },
      as: admin.pkh
    })
  });
  it("Link Quartz contract", async () => {
    await quartz.set_archetype({
      arg: {
        v: archetype.address
      },
      as: admin.pkh
    })
  });
  it("Get Balance of", async () => {
    [fa2getbalanceof, _] = await deploy('./tests/contracts/getFA2balance.arl',
      { as: admin.pkh });
    checkBalance = checkFA2Balance(fa2getbalanceof);
  });
  it("Simple Minting Validator", async () => {
    [simplevalidator, _] = await deploy('./contracts/mintingvalidator/simpleMintingValidator.arl', {
      parameters: {
        admin: admin.pkh,
        minter: minter.pkh,
      },
      as: admin.pkh
    });
  });
  it("Add minters", async () => {
    await archetype.grantRole({
      arg: {
        irole: "minter",
        iaddrs: [minter.pkh,]
      },
      as: admin.pkh
    });
    await simplevalidator.grantRole({
      arg: {
        irole: "minter",
        iaddrs: [minter.pkh],
      },
      as: admin.pkh
    });
  });
  it("Set Minting Limit", async () => {
    await simplevalidator.setMintingLimit({
      arg: {
        id: archetype1,
        lim: archetypeLimit
      },
      as: minter.pkh
    })
  });
  it("Register Archetype", async () => {
    await archetype.registerArchetype({
      arg: {
        id: archetype1,
        mintingValidator: simplevalidator.address,
        imaxBalanceAllowed: archetypeMaxByOwner,
      },
      as: minter.pkh
    });
  });
  it("Link storage with whitelist constract", async () => {
    await whitelist_users.add_whitelister({
      arg: {
        new_whitelister: whitelist.address
      },
      as: whitelister.pkh
    })
  })
  it("Init Whitelist", async () => {
    await whitelist.updateTransferlist({
      arg: {
        transferlistId: 0,
        u: [true, [0]]
      },
      as: whitelister.pkh
    });
    await whitelist.updateTransferlist({
      arg: {
        transferlistId: 1,
        u: [true, [0]]
      },
      as: whitelister.pkh
    });
    await whitelist.updateUser({
      arg: {
        user: archetype.address,
        transferlistId: 0
      },
      as: whitelister.pkh
    })
  });
  it("Whitelist recipients", async () => {
    const arg = recipients.map((recipient, index) => {
      return [recipient.pkh, 0]
    });

    await whitelist.updateUsers({
      arg: [arg],
      as: whitelister.pkh
    })
  });
  it("Mint tokens", async () => {
    tokens = new Map();
    for (let index = 0; index < recipients.length; ++index) {
      const recipient = recipients[index];
      const serialNr = index + 1;
      const tokenId = getTokenId(archetype1, serialNr);
      await archetype.mint({
        arg: {
          account: recipient.pkh,
          iarchetypeId: archetype1,
          iserialNumber: serialNr,
          tokenId: tokenId,
        },
        as: minter.pkh
      });
      tokens.set(serialNr, tokenId);
    }
    assert(tokens.size == recipients.length);
  })
});
describe("Transfer validation", async () => {
  it("Non-existent tokens should not be transferrable", async () => {
    await expectToThrow(async () => {
      await quartz.transfer({
        arg: {
          txs: [[recipient0.pkh, [[recipient1.pkh, 666, 1]]]]
        },
        as: recipient0.pkh
      })
    }, errors.FA2_TOKEN_UNDEFINED)
  });
  it("Tokens should not be transferrable if not called by the owner", async () => {
    await expectToThrow(async () => {
      await quartz.transfer({
        arg: {
          txs: [[recipient0.pkh, [[recipient1.pkh, tokens.get(2), 1]]]]
        },
        as: recipient0.pkh
      })
    }, errors.FA2_INSUFFICIENT_BALANCE)
  });
  it("Tokens should not be transferrable if the amount is not 1", async function () {
    await expectToThrow(async () => {
      await quartz.transfer({
        arg: {
          txs: [[recipient0.pkh, [[recipient1.pkh, tokens.get(1), 2]]]]
        },
        as: recipient0.pkh
      })
    }, errors.INVALID_AMOUNT)
  });
  it("Tokens should not be transferable when contract is paused", async function () {
    await pauseAndVerify(quartz, admin);

    await expectToThrow(async () => {
      await quartz.transfer({
        arg: {
          txs: [[recipient1.pkh, [[recipient3.pkh, tokens.get(2), 1]]]]
        },
        as: recipient1.pkh
      })
    }, errors.CONTRACT_PAUSED)

    await unpauseAndVerify(quartz, admin);
  });
  it("Tokens should be transferrable to whitelisted address when contract is not paused", async function () {
    await checkBalance(quartz, recipient1.pkh, tokens.get(2), 1);
    await checkBalance(quartz, recipient3.pkh, tokens.get(2), 0);
    await checkBalance(quartz, recipient2.pkh, tokens.get(3), 1);
    await checkBalance(quartz, recipient3.pkh, tokens.get(3), 0);
    await quartz.transfer({
      arg: {
        txs: [[recipient1.pkh, [[recipient3.pkh, tokens.get(2), 1]]]]
      },
      as: recipient1.pkh
    });
    await checkBalance(quartz, recipient3.pkh, tokens.get(2), 1);
    await checkBalance(quartz, recipient1.pkh, tokens.get(2), 0);
    await quartz.transfer({
      arg: {
        txs: [[recipient2.pkh, [[recipient3.pkh, tokens.get(3), 1]]]]
      },
      as: recipient2.pkh
    });
    await checkBalance(quartz, recipient3.pkh, tokens.get(3), 1);
    await checkBalance(quartz, recipient2.pkh, tokens.get(3), 0);
    await quartz.transfer({
      arg: {
        txs: [[recipient3.pkh, [[recipient1.pkh, tokens.get(2), 1]]]]
      },
      as: recipient3.pkh
    });
    await checkBalance(quartz, recipient1.pkh, tokens.get(2), 1);
    await checkBalance(quartz, recipient3.pkh, tokens.get(2), 0);
    await quartz.transfer({
      arg: {
        txs: [[recipient3.pkh, [[recipient2.pkh, tokens.get(3), 1]]]]
      },
      as: recipient3.pkh
    });
    await checkBalance(quartz, recipient2.pkh, tokens.get(3), 1);
    await checkBalance(quartz, recipient3.pkh, tokens.get(3), 0);
  });
  it("The quota should be respected", async function () {

    // recipient4 should have 1 token
    await quartz.transfer({
      arg: {
        txs: [[recipient0.pkh, [[recipient4.pkh, tokens.get(1), 1]]]]
      },
      as: recipient0.pkh
    })
    // we should be able to transfer 2 more (see archetypeMaxByOwner = 3)
    await quartz.transfer({
      arg: {
        txs: [[recipient1.pkh, [[recipient4.pkh, tokens.get(2), 1]]]]
      },
      as: recipient1.pkh
    });
    await quartz.transfer({
      arg: {
        txs: [[recipient2.pkh, [[recipient4.pkh, tokens.get(3), 1]]]]
      },
      as: recipient2.pkh
    });
    // we should not be able to transfer one more because of QUOTA
    await expectToThrow(async () => {
      await quartz.transfer({
        arg: {
          txs: [[recipient3.pkh, [[recipient4.pkh, tokens.get(4), 1]]]]
        },
        as: recipient3.pkh
      });
    }, errors.ARCHETYPE_QUOTA_REACHED)
  });
  it("The other archetype should not be affected by this quota", async () => {
    // register the archetype 2
    await archetype.registerArchetype({
      arg: {
        id: archetype2,
        mintingValidator: simplevalidator.address,
        imaxBalanceAllowed: archetypeLimit,
      },
      as: minter.pkh
    });
    await simplevalidator.setMintingLimit({
      arg: {
        id: archetype2,
        lim: archetypeMaxByOwner
      },
      as: minter.pkh
    });
    // mint 1 token on recipient 4
    const tokenId21 = getTokenId(archetype2, 1);
    await archetype.mint({
      arg: {
        account: recipient4.pkh,
        iarchetypeId: archetype2,
        iserialNumber: 1,
        tokenId: tokenId21
      },
      as: minter.pkh
    });
    // mint another token and transfer it to recipient 4
    const tokenId22 = getTokenId(archetype2, 2);
    await archetype.mint({
      arg: {
        account: recipient1.pkh,
        iarchetypeId: archetype2,
        iserialNumber: 2,
        tokenId: tokenId22
      },
      as: minter.pkh
    });
    await quartz.transfer({
      arg: {
        txs: [[recipient1.pkh, [[recipient4.pkh, tokenId22, 1]]]]
      },
      as: recipient1.pkh
    })
  });
  it("Address can be removed from the whitelist", async () => {
    await whitelist.updateUser({
      arg: {
        user: recipient1.pkh,
        transferlistId: 1
      },
      as: whitelister.pkh
    });
    await whitelist.updateUser({
      arg: {
        user: recipient2.pkh,
        transferlistId: 1
      },
      as: whitelister.pkh
    });
    await whitelist.updateUser({
      arg: {
        user: recipient3.pkh,
        transferlistId: 1
      },
      as: whitelister.pkh
    })
  });
  it("Tokens should not be transferrable if recipient is removed from the whitelist", async () => {
    await expectToThrow(async () => {
      await quartz.transfer({
        arg: {
          txs: [[recipient4.pkh, [[recipient2.pkh, tokens.get(2), 1]]]]
        },
        as: recipient4.pkh
      })
    }, errors.WHITELIST_TO_NOT_ALLOWED);
    await expectToThrow(async () => {
      await quartz.transfer({
        arg: {
          txs: [[recipient4.pkh, [[recipient3.pkh, tokens.get(3), 1]]]]
        },
        as: recipient4.pkh
      })
    }, errors.WHITELIST_TO_NOT_ALLOWED)
    // check recipients that are still whitelisted:
    await quartz.transfer({
      arg: {
        txs: [[recipient3.pkh, [[recipient0.pkh, tokens.get(4), 1]]]]
      },
      as: recipient3.pkh
    })
  });
  it("The whitelist can be disabled", async function () {
    await archetype.setWhitelist({
      argMichelson: "None",
      as: admin.pkh
    })
  });
  it("Tokens should be transferrable after the whitelist is disabled", async function () {
    await quartz.transfer({
      arg: {
        txs: [[recipient0.pkh, [[recipient2.pkh, tokens.get(4), 1]]]]
      },
      as: recipient0.pkh
    })
  })
  it("Check updateMaxBalanceAllowed", async function () {
    await archetype.updateMaxBalanceAllowed({
      arg: {
        archid: archetype1,
        v: null
      },
      as: admin.pkh
    })
  });

  it("Check can_transfer", async function () {
    const tokenId = tokens.get(1);
    const from = recipient0.pkh;
    const to = recipient1.pkh;

    const output = await runGetter("can_transfer", quartz.address, {
      argMichelson: `(Pair ${tokenId} (Pair "${from}" "${to}"))`,
      as: minter.pkh
    });

    assert(output == '"USER_NOT_FOUND_FOR_PERMIT"', 'must be "USER_NOT_FOUND_FOR_PERMIT"');
  })
})
