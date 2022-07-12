const { deploy, getAccount, setQuiet, expectToThrow, setMockupNow, getEndpoint } = require('@completium/completium-cli');
const { generateArchetypeId, pauseAndVerify, unpauseAndVerify, getArchetypeData, getFA2Balance, getQuartzOwner, getQuartzUri, getTokenId, checkFA2Balance, errors } = require('./utils');
const assert = require('assert');

setQuiet(true);

const mockup_mode = getEndpoint() === 'mockup'

// contracts
let whitelist_users;
let whitelist;
let archetype_ledger;
let archetype_balance;
let archetype;
let quartz;
let archetypeGettertester;
let simplevalidator;
let deadlinevalidator;
let fa2getbalanceof;

// accounts
const admin = getAccount(mockup_mode ? 'alice' : "quartz_admin");
const whitelister = getAccount(mockup_mode ? 'bob' : "quartz_whitelister");
const minter = getAccount(mockup_mode ? 'carl' : "quartz_minter");
const recipient0 = getAccount('bootstrap1');
const recipient1 = getAccount('bootstrap2');
const recipient2 = getAccount('bootstrap3');
const recipient3 = getAccount('bootstrap4');
const recipient4 = getAccount('bootstrap5');

const recipients = [recipient0, recipient1, recipient2, recipient3, recipient4];

// constants
const archetype1 = generateArchetypeId();
const archetype2 = generateArchetypeId();
const archetypeLimit = 7;

// tokens
let tokens;

// dates
const deadline = Math.floor((Date.now() / 1000) + 300);
const beforedeadline = Math.floor((Date.now() / 1000));
const afterdeadline = Math.floor((Date.now() / 1000) + 600);

// function
let checkBalance;
let getBalance;
let getOwner;

setMockupNow(beforedeadline);

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
  it("Archetype Balance", async () => {
    [archetype_balance, _] = await deploy('./contracts/archetype_balance.arl', {
      parameters: {
        admin: admin.pkh,
      },
      named: 'test_ubi_archbalance',
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
    await whitelist.addWhitelister({
      arg: {
        v: whitelister.pkh
      },
      as: whitelister.pkh
    });
    await whitelist.updateUser({
      arg: {
        user: quartz.address,
        transferlistId: 0
      },
      as: whitelister.pkh
    });
    await whitelist.updateUser({
      arg: {
        user: minter.pkh,
        transferlistId: 1
      },
      as: whitelister.pkh
    })
    await whitelist.updateUser({
      arg: {
        user: archetype.address,
        transferlistId: 1
      },
      as: whitelister.pkh
    })
  });
  it("Archetype Getter Tester", async () => {
    [archetypeGettertester, _] = await deploy('./tests/contracts/archetypeGetterTester.arl', {
      parameters: {
        quartz: quartz.address,
      },
      as: admin.pkh
    });
    getOwner = getQuartzOwner(archetypeGettertester);
    getUri = getQuartzUri(archetypeGettertester);
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
  it("Deadline Minting Validator", async () => {
    [deadlinevalidator, _] = await deploy('./contracts/mintingvalidator/deadlineMintingValidator.arl', {
      parameters: {
        admin: admin.pkh,
        minter: minter.pkh,
      },
      as: admin.pkh
    });
  });
  it("Get Balance of", async () => {
    [fa2getbalanceof, _] = await deploy('./tests/contracts/getFA2balance.arl',
      { as: admin.pkh });
    checkBalance = checkFA2Balance(fa2getbalanceof);
    getBalance = getFA2Balance(fa2getbalanceof);
  });
  it("Add minters", async () => {
    await archetype.grantRole({
      arg: {
        irole: "minter",
        iaddrs: [minter.pkh],
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
    await deadlinevalidator.grantRole({
      arg: {
        irole: "minter",
        iaddrs: [minter.pkh],
      },
      as: admin.pkh
    });
  });
});

describe("Archetype", async () => {
  it("Should be pausable by an admin", async () => {
    let qstorage = await archetype.getStorage();
    assert(qstorage.paused == false, "archetype should not be paused");

    // Calling pause without ADMIN role
    assert(admin.pkh !== recipient0.pkh);
    await expectToThrow(async () => {
      await archetype.pause({ as: recipient0.pkh })
    }, errors.INVALID_CALLER)

    await pauseAndVerify(archetype, admin);
  });
  it("Should be un-pausable by an admin", async () => {

    // Calling unpause without ADMIN role
    assert(admin.pkh !== recipient0.pkh);
    await expectToThrow(async () => {
      await archetype.unpause({ as: recipient0.pkh })
    }, errors.INVALID_CALLER)

    // Calling unpause with ADMIN role
    await unpauseAndVerify(archetype, admin);
  });
  it("Should not be able to register an archetype if not minter", async () => {
    assert(admin.pkh !== minter.pkh);
    await expectToThrow(async () => {
      await archetype.registerArchetype({
        arg: {
          id: archetype1,
          mintingValidator: simplevalidator.address,
          imaxBalanceAllowed: 4,
        },
        as: admin.pkh
      });
    }, errors.CALLER_NOT_MINTER)
  });
  it("Minter should not be able to register an archetype when contract is paused", async function () {
    await pauseAndVerify(archetype, admin);

    await expectToThrow(async () => {
      await archetype.registerArchetype({
        arg: {
          id: archetype1,
          mintingValidator: simplevalidator.address,
          imaxBalanceAllowed: 4,
        },
        as: minter.pkh
      });
    }, errors.CONTRACT_PAUSED);

    await unpauseAndVerify(archetype, admin);
  });
  it("Minter should be able to register an archetype when contract is not paused", async function () {
    await archetype.registerArchetype({
      arg: {
        id: archetype1,
        mintingValidator: simplevalidator.address,
        imaxBalanceAllowed: 4,
      },
      as: minter.pkh
    });

    // Check the ArchetypeRegistered event
    let data = await getArchetypeData(archetype_ledger, archetype1);
    assert(data.archValidator == simplevalidator.address);
    assert(data.maxBalanceAllowed.toNumber() == 4)

  });
  it("Should not be able to mint if recipient is not whitelisted", async function () {
    await expectToThrow(async () => {
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype1,
          iserialNumber: 1
        },
        as: minter.pkh
      })
    }, errors.WHITELIST_TO_RESTRICTED)
  });
  it("Recipients can be whitelisted", async function () {
    //
    const arg = recipients.map((recipient, index) => {
      return [recipient.pkh, 0]
    });

    await whitelist.updateUsers({
      arg: [arg],
      as: whitelister.pkh
    })
  });
  it("Should not be able to mint if the simple minting limit is not set yet", async function () {
    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype1, 1);
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype1,
          iserialNumber: 1,
          tokenId: tokenId
        },
        as: minter.pkh
      })
    }, errors.SERIAL_NUMBER_OUT_OF_BOUNDS)
  });
  it("Should not be able to set the simple minting limits if not a minter", async function () {
    assert(admin.pkh !== minter.pkh);
    await expectToThrow(async () => {
      await simplevalidator.setMintingLimit({
        arg: {
          id: archetype1,
          lim: archetypeLimit
        },
        as: admin.pkh
      })
    }, errors.CALLER_NOT_MINTER)
  });
  it("Should be able to set the simple minting limits", async function () {
    await simplevalidator.setMintingLimit({
      arg: {
        id: archetype1,
        lim: archetypeLimit
      },
      as: minter.pkh
    })
  });
  it("Minter should not be able to register an existing archetype", async function () {
    await expectToThrow(async () => {
      await archetype.registerArchetype({
        arg: {
          id: archetype1,
          mintingValidator: simplevalidator.address,
          imaxBalanceAllowed: 4,
        },
        as: minter.pkh
      });
    }, errors.ARCHETYPE_ALREADY_REGISTERED)
  });
  it("Minter should not be able to set the limits again", async function () {
    await expectToThrow(async () => {
      await simplevalidator.setMintingLimit({
        arg: {
          id: archetype1,
          lim: archetypeLimit
        },
        as: minter.pkh
      })
    }, errors.MINTING_LIMIT_ALREADY_SET)
  });
  it("Should not be able to mint tokens with serial out of archetype limits", async function () {
    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype1, 0);
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype1,
          iserialNumber: 0,
          tokenId: tokenId
        },
        as: minter.pkh
      })
    }, errors.SERIAL_NUMBER_OUT_OF_BOUNDS)
    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype1, archetypeLimit + 1);
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype1,
          iserialNumber: archetypeLimit + 1,
          tokenId: tokenId
        },
        as: minter.pkh
      })
    }, errors.SERIAL_NUMBER_OUT_OF_BOUNDS)
  });

  it("Should not be able to mint when contract is paused", async function () {
    await pauseAndVerify(archetype, admin);

    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype1, 1);
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype1,
          iserialNumber: 1,
          tokenId: tokenId
        },
        as: minter.pkh
      })
    }, errors.CONTRACT_PAUSED)

    await unpauseAndVerify(archetype, admin);
  });
  it("Minter should be able to mint", async function () {
    tokens = new Map();
    for (let index = 0; index < recipients.length; ++index) {
      const recipient = recipients[index];

      // Mint a token
      const serialNr = index + 1

      const tokenId = getTokenId(archetype1, serialNr);

      await archetype.mint({
        arg: {
          account: recipient.pkh,
          iarchetypeId: archetype1,
          iserialNumber: serialNr,
          tokenId: tokenId
        },
        as: minter.pkh
      });

      await checkBalance(quartz, recipient.pkh, tokenId, 1);

      tokens.set(serialNr, tokenId);
    }
    assert(tokens.size == recipients.length);
  });
  it("Should not be able to mint twice the same serial number", async function () {
    for (let [serial, _] of tokens) {

      const id = getTokenId(archetype1, serial)
      const owner = await getOwner(id);
      const balance = await getBalance(quartz, owner, id);
      const recipient = recipients[serial - 1];

      // Try to re-mint the token
      await expectToThrow(async () => {
        await archetype.mint({
          arg: {
            account: recipient.pkh,
            iarchetypeId: archetype1,
            iserialNumber: serial,
            tokenId: id
          },
          as: minter.pkh
        })
      }, errors.KEY_EXISTS_LEDGER)

      // Check that balance and owner is unchanged
      const owner_after = await getOwner(id);
      const balance_after = await getBalance(quartz, owner, id);
      assert(owner_after == owner);
      assert(balance_after == balance);
    }
  });
  it("Minter should be able to receive an arbitrary amount of tokens within the archetype limits", async function () {
    // Get the last serial number used
    let currentSerialNumber = Array.from(tokens.keys()).pop() + 1;
    minterTokens = new Map();

    // Mint all tokens left until limit
    for (; currentSerialNumber <= archetypeLimit; currentSerialNumber++) {
      const tokenId = getTokenId(archetype1, currentSerialNumber);

      await archetype.mint({
        arg: {
          account: minter.pkh,
          iarchetypeId: archetype1,
          iserialNumber: currentSerialNumber,
          tokenId: tokenId
        },
        as: minter.pkh
      })

      await checkBalance(quartz, minter.pkh, tokenId, 1);

      // Update the tokens Map
      minterTokens.set(currentSerialNumber, tokenId);
      const owner = await getOwner(tokenId);
      assert(owner == minter.pkh)
    }
    assert(tokens.size + minterTokens.size == archetypeLimit);
  });
  it("Minter should be able to transfer the tokens to any whitelisted recipient", async function () {
    // take the last serial number of Map tokens + 1 for the first serial number consumed by the minter address
    const minterTokenSerial = tokens.size + 1;

    const from = minter.pkh;
    const to = recipient1.pkh;
    const tokenId = minterTokens.get(minterTokenSerial);
    const amount = 1;

    const balance_before_from = await getBalance(quartz, from, tokenId);
    const balance_before_to = await getBalance(quartz, to, tokenId);

    await quartz.transfer({
      arg: {
        txs: [[from, [[to, tokenId, amount]]]]
      },
      as: minter.pkh
    });

    // Check balance after transfer
    const balance_after_from = await getBalance(quartz, from, tokenId);
    const balance_after_to = await getBalance(quartz, to, tokenId);
    assert(balance_after_from - balance_before_from == -amount);
    assert(balance_after_to - balance_before_to == amount);
  });

  it("Only the minter is allowed to mint", async function () {
    assert(minter.pkh !== recipient0.pkh);
    const currentSerialNumber = 1
    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype1, currentSerialNumber);
      await archetype.mint({
        arg: {
          account: minter.pkh,
          iarchetypeId: archetype1,
          iserialNumber: currentSerialNumber,
          tokenId: tokenId
        },
        as: recipient0.pkh
      })
    }, errors.CALLER_NOT_MINTER)
  })
  it("Only the minter is allowed to set archetypes", async function () {
    assert(minter.pkh !== recipient0.pkh);
    await expectToThrow(async () => {
      await archetype.registerArchetype({
        arg: {
          id: generateArchetypeId(),
          mintingValidator: simplevalidator.address,
          imaxBalanceAllowed: 4,
        },
        as: recipient0.pkh
      });
    }, errors.CALLER_NOT_MINTER)
  })
});

describe("Deadline minting", function () {
  it("Register archetype 2", async function () {
    await archetype.registerArchetype({
      arg: {
        id: archetype2,
        mintingValidator: deadlinevalidator.address,
        imaxBalanceAllowed: 4,
      },
      as: minter.pkh
    });
  });
  it("Should not be able to mint if the deadline is not set yet", async function () {
    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype2, 1);
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype2,
          iserialNumber: 1,
          tokenId: tokenId
        },
        as: minter.pkh
      })
    }, errors.DEADLINE_REACHED)
  })

  it("Should not be able to set the deadline if not the minter", async function () {
    await expectToThrow(async () => {
      await deadlinevalidator.setDeadline({
        arg: {
          id: archetype2,
          v: "2021-12-25"
        },
        as: admin.pkh
      })
    }, errors.CALLER_NOT_MINTER)
  })

  it("Should be able to set the deadline", async function () {
    // Set the deadline to 5 minutes
    await deadlinevalidator.setDeadline({
      arg: {
        id: archetype2,
        v: deadline
      },
      as: minter.pkh
    })
  })

  it("Should be able to mint before the deadline", async function () {
    setMockupNow(beforedeadline);
    const tokenId = getTokenId(archetype2, 1);
    await archetype.mint({
      arg: {
        account: recipient0.pkh,
        iarchetypeId: archetype2,
        iserialNumber: 1,
        tokenId: tokenId
      },
      as: minter.pkh
    })

    // Check token
    //const events = (await (await tx).wait()).events
    //const tokenId = ethers.utils.solidityKeccak256(["uint256", "uint256"], [archetype2, 1])
    //await validateTransfer(quartz, events[1], ethers.constants.AddressZero, recipients[0].address, tokenId)
  })

  it("Should not be able to mint an invalid serial number", async function () {
    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype2, 0);
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype2,
          iserialNumber: 0,
          tokenId: tokenId
        },
        as: minter.pkh
      })
    }, errors.SERIAL_NUMBER_OUT_OF_BOUNDS)
  })

  it("Should not be able to mint after the deadline", async () => {
    setMockupNow(afterdeadline);
    await expectToThrow(async () => {
      const tokenId = getTokenId(archetype2, 2);
      await archetype.mint({
        arg: {
          account: recipient0.pkh,
          iarchetypeId: archetype2,
          iserialNumber: 2,
          tokenId: tokenId
        },
        as: minter.pkh
      })
    }, errors.DEADLINE_REACHED);
  })
  it("Should not be able to set the deadline again", async () => {
    await expectToThrow(async () => {
      await deadlinevalidator.setDeadline({
        arg: {
          id: archetype2,
          v: deadline
        },
        as: minter.pkh
      })
    }, errors.DEADLINE_ALREADY_SET)
  })
  it("The whitelist cannot be updated by a non-admin", async function () {
    assert(admin.pkh !== whitelister.pkh);
    await expectToThrow(async () => {
      await archetype.setWhitelist({
        arg: {
          iwhitelist: whitelist.address,
        },
        as: whitelister.pkh
      })
    }, errors.INVALID_CALLER)
  })
  it("TheWhitelist can be updated when contract is paused", async function () {
    await pauseAndVerify(quartz, admin);

    await archetype.setWhitelist({
      arg: {
        iwhitelist: whitelist.address,
      },
      as: admin.pkh
    })

    await unpauseAndVerify(quartz, admin);
  });
  it("TheWhitelist can be updated when contract is not paused", async function () {
    await archetype.setWhitelist({
      arg: {
        iwhitelist: whitelist.address,
      },
      as: admin.pkh
    })
  });
})
