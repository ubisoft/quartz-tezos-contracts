// SPDX-License-Identifier: Apache-2.0
// Copyright © 2021-2022 UBISOFT

const { deploy, originate, getAccount, setQuiet, getEndpoint, setEndpoint, sign, exprMichelineToJson, packTyped } = require('@completium/completium-cli');
const { generateArchetypeId, checkFA2Balance, getFA2Balance } = require('./utils');

setQuiet(true);

const mockup_mode = getEndpoint() === 'mockup'

// contracts
let lugh_fee_managers;
let lugh;
let quartz;
let archetype_ledger;
let archetype_balance;
let archetype;
let fa2getbalanceof;
let simplevalidator;
let quartzMinter;

// accounts
const admin = getAccount(mockup_mode ? 'alice' : "quartz_admin");
const minter = getAccount(mockup_mode ? 'bob' : "quartz_minter");
const payer = getAccount(mockup_mode ? 'carl' : "quartz_user");
const vault = getAccount(mockup_mode ? 'bootstrap1' : "quartz_vault");

// constants
const archetype1 = generateArchetypeId();
const serialNr = 1
const price = 500000

describe("Deploy & init", async () => {

  it("LUGH Fees manager", async () => {

    const administrator = admin.pkh;
    const gasFee = 0;
    const gaslessFee = 0;
    const storageFee = 140000;
    const threshold = 30000;

    const storage_init = `(Pair (Pair "${administrator}" ${gasFee}) (Pair ${gaslessFee} (Pair ${storageFee} ${threshold})))`;

    [lugh_fee_managers, _] = await originate('./tests/contracts/lugh/fees_manager.json', {
      init: storage_init,
      as: admin.pkh
    });

  });

  it("LUGH Fees manager", async () => {

    const administrator = admin.pkh;
    const all_tokens = 1;
    const default_expiry = 345600;
    const fees_faucet = admin.pkh;
    const fees_manager = lugh_fee_managers.address;
    const ledger = `{ Elt (Pair "${admin.pkh}" 0) (Pair 100000000000000 False) }`;
    const master_minted = `{ Elt 0 0 }`;
    const master_minter = admin.pkh;
    const max_expiry = 2678400;
    const metadata = `{ Elt "" 0x697066733a2f2f516d6366476468623555747a6d696b50546d51594e64526e586642596b4a443155657a4267616a733138796e554e }`;
    const minters = `{}`;
    const operators = `{}`;
    const owner = admin.pkh;
    const paused = 'False';
    const permits = `{}`;
    const rights_manager = `None`;
    const token_metadata = `{ Elt 0 (Pair 0 { \
      Elt "decimals" 0x36; \
      Elt "is_boolean_amount" 0x46616c7365; \
      Elt "is_transferable" 0x54727565; \
      Elt "name" 0x4c756768204575726f2070656767656420737461626c65636f696e; \
      Elt "should_prefer_symbol" 0x54727565; \
      Elt "symbol" 0x4555524c; \
      Elt "thumbnailUri" 0x697066733a2f2f516d63717359516e3870547851723350316459706759785161364751506d6f425453575138627075464575617165 } ) }`;
    const total_supply = `{ Elt 0 0 }`;
    const transfer_operation = 0;

    const storage_init =
      `(Pair \
      (Pair \
        (Pair \
          (Pair "${administrator}" ${all_tokens}) \
          (Pair ${default_expiry} "${fees_faucet}") \
        ) \
        (Pair \
          (Pair "${fees_manager}" ${ledger}) \
          (Pair ${master_minted} (Pair "${master_minter}" ${max_expiry})) \
        ) \
      ) \
      (Pair \
        (Pair \
          (Pair ${metadata} ${minters}) \
          (Pair ${operators} (Pair "${owner}" ${paused})) \
        ) \
        (Pair \
          (Pair ${permits} ${rights_manager}) \
          (Pair ${token_metadata} (Pair ${total_supply} ${transfer_operation})) \
        ) \
      ) \
    )`;

    [lugh, _] = await originate('./tests/contracts/lugh/eurl.json', {
      init: storage_init,
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
        admin: admin.pkh,
        archLedger: archetype_ledger.address
      },
      named: 'test_ubi_quartz',
      as: admin.pkh
    });
  });

  it("Archetype", async () => {
    [archetype, _] = await deploy('./contracts/archetype.arl', {
      parameters: {
        admin: admin.pkh,
        minter: minter.pkh,
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

  it("Get FA2 Balance of", async () => {
    [fa2getbalanceof, _] = await deploy('./tests/contracts/getFA2balance.arl');
    checkBalance = checkFA2Balance(fa2getbalanceof);
    getBalance = getFA2Balance(fa2getbalanceof);
  })

  it("Simple Minting Validator", async () => {
    [simplevalidator, _] = await deploy('./contracts/mintingvalidator/simpleMintingValidator.arl', {
      parameters: {
        admin: admin.pkh,
        minter: minter.pkh,
      },
      as: admin.pkh
    });
  });

  it("Quartz Minter", async () => {
    [quartzMinter, _] = await deploy("./contracts/minter.arl", {
      parameters: {
        admin: admin.pkh,
        minter: minter.pkh,
        archetype: archetype.address,
        stablecoin: lugh.address
      }
    });
  });

  it("Add minters", async () => {
    await archetype.grantRole({
      arg: {
        irole: "minter",
        iaddrs: [minter.pkh, quartzMinter.address],
      },
      as: admin.pkh
    });
    await simplevalidator.grantRole({
      arg: {
        irole: "minter",
        iaddrs: [minter.pkh, quartzMinter.address],
      },
      as: admin.pkh
    });
    await quartzMinter.grantRole({
      arg: {
        irole: "minter",
        iaddrs: [minter.pkh],
      },
      as: admin.pkh
    });
  });

  it("Register Archetype", async () => {
    await archetype.registerArchetype({
      arg: {
        id: archetype1,
        mintingValidator: simplevalidator.address,
        imaxBalanceAllowed: 4,
      },
      as: minter.pkh
    });
  });

  it("SetMintingLimit", async () => {
    await simplevalidator.setMintingLimit({
      arg: {
        id: archetype1,
        lim: 15
      },
      as: minter.pkh
    })
  });
});

describe("check mint with payment", async () => {

  it("Transfer LUGH to payer and quartz minter", async () => {
    await lugh.transfer({
      argMichelson: `{ Pair "${admin.pkh}" { Pair "${payer.pkh}" (Pair 0 10000000) }; Pair "${admin.pkh}" { Pair "${quartzMinter.address}" (Pair 0 10000000) } }`,
      as: admin.pkh
    })

  });

  it("Mint with payment", async () => {
    const counter = 0;

    const dataType = exprMichelineToJson("(pair address (pair nat (pair address (list (pair address (pair nat nat))))))");
    const data = exprMichelineToJson(`(Pair "${lugh.address}" (Pair ${counter} (Pair "${payer.pkh}" { Pair "${vault.pkh}" (Pair 0 ${price}) })))`);
    const tosign = packTyped(data, dataType);
    const signature = await sign(tosign, { as: payer.name });
    const sig = signature.prefixSig

    await quartzMinter.mintWithPayment({
      arg: {
        archetypeId: archetype1,
        serialNumber: serialNr,
        vault: vault.pkh,
        amount: price,
        pk: payer.pubk,
        sig: sig,
      },
      as: minter.pkh
    });
  });

})
