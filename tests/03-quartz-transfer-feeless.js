// SPDX-License-Identifier: Apache-2.0
// Copyright © 2021-2022 UBISOFT

const { deploy, getAccount, packTyped, setQuiet, blake2b, exprMichelineToJson, sign, getEndpoint, setEndpoint } = require('@completium/completium-cli');
const { generateArchetypeId, pauseAndVerify, unpauseAndVerify, checkFA2Balance, getTokenId, errors } = require('./utils');
const assert = require('assert');

setQuiet(true);

const mockup_mode = getEndpoint() === 'mockup'

// contracts
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
const archetype3 = generateArchetypeId();
const archetypeLimit = 25; // number of serial numbers
const archetypeMaxByOwner = 4;  // maximum number per user

// tokens
let tokens;
let minterTokens;

// function
let checkBalance;


describe("Deploy & init", async () => {
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
        whitelist: null,
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
  // it("Init Whitelist", async () => {
  //   await whitelist.updateTransferlist(
  //     {
  //       arg: { transferlistId: 0, u: [true, [1]] },
  //       as: whitelister.pkh
  //     });
  //   await whitelist.updateTransferlist(
  //     {
  //       arg: { transferlistId: 1, u: [true, [0, 1]] },
  //       as: whitelister.pkh
  //     });
  //   await whitelist.updateTransferlist(
  //     {
  //       arg: { transferlistId: 2, u: [false, []] },
  //       as: whitelister.pkh
  //     })
  //   await whitelist.updateUser({
  //     arg: {
  //       user: minter.pkh,
  //       transferlistId: 1
  //     },
  //     as: whitelister.pkh
  //   })
  //   await whitelist.updateUser({
  //     arg: {
  //       user: archetype.address,
  //       transferlistId: 1
  //     },
  //     as: whitelister.pkh
  //   })
  // });
  // it("Whitelist recipients", async () => {
  //   const arg = recipients.map((recipient, index) => {
  //     return [recipient.pkh, 0]
  //   });

  //   await whitelist.updateUsers({
  //     arg: [arg],
  //     as: whitelister.pkh
  //   })

  // });
  it("Mint tokens", async () => {
    await archetype.mint({
      arg: {
        account: recipient0.pkh,
        iarchetypeId: archetype1,
        iserialNumber: 1,
        tokenId: getTokenId(archetype1, 1),
      },
      as: minter.pkh
    });
  })
});


describe("Transfer feeless", async () => {
  it("Check transfer with 2 steps (TZIP 17)", async () => {
    const tokenid = getTokenId(archetype1, 1)
    const frompkh = recipient0.pkh;
    const topkh = recipient1.pkh;
    const amount = 1;

    const transferParamType = exprMichelineToJson("(list (pair (address %from_) (list %txs (pair (address %to_) (nat %token_id) (nat %amount)))))");
    const michelsonData = `{ Pair "${frompkh}" { Pair "${topkh}" (Pair ${tokenid} ${amount}) } }`;
    const transferParam = exprMichelineToJson(michelsonData);
    const pdata = packTyped(transferParam, transferParamType);
    const data = blake2b(pdata);

    const fa2Address = quartz.address;
    const chainid = "NetXynUjJNZm7wi"; // else hangzhou
    const permit_counter = 0;

    const permitDataType = exprMichelineToJson("(pair (pair address chain_id) (pair nat bytes))");
    const permitData = exprMichelineToJson(`(Pair (Pair "${fa2Address}" "${chainid}") (Pair ${permit_counter} 0x${data}))`);
    const tosign = packTyped(permitData, permitDataType);
    const signature = await sign(tosign, { as: recipient0.name });
    const sig = signature.prefixSig

    await quartz.permit({
      arg: {
        pk: recipient0.pubk,
        sig: sig,
        data: data,
      },
      as: recipient0.pkh
    })

    await quartz.transfer({
      arg: {
        txs: [[recipient0.pkh, [[recipient1.pkh, tokenid, 1]]]]
      },
      as: recipient2.pkh
    })
  });

  it("Check transfer gasless", async () => {
    const tokenid = getTokenId(archetype1, 1)
    const frompkh = recipient1.pkh;
    const topkh = recipient0.pkh;
    const amount = 1;

    const transferParamType = exprMichelineToJson("(list (pair (address %from_) (list %txs (pair (address %to_) (nat %token_id) (nat %amount)))))");
    const michelsonData = `{ Pair "${frompkh}" { Pair "${topkh}" (Pair ${tokenid} ${amount}) } }`;
    const transferParam = exprMichelineToJson(michelsonData);
    const pdata = packTyped(transferParam, transferParamType);
    const data = blake2b(pdata);

    const fa2Address = quartz.address;
    const counter = 0;

    const permitDataType = exprMichelineToJson("(pair address (pair nat bytes))");
    const permitData = exprMichelineToJson(`(Pair "${fa2Address}" (Pair ${counter} 0x${data}))`);
    const tosign = packTyped(permitData, permitDataType);
    const signature = await sign(tosign, { as: recipient1.name });
    const sig = signature.prefixSig

    await quartz.transfer_gasless({
      argMichelson: `{ Pair { Pair "${frompkh}" { Pair "${recipient0.pkh}" (Pair ${tokenid} ${amount}) } } (Pair "${recipient1.pubk}" "${sig}" )}`,
      as: recipient2.pkh
    })
  });
})

