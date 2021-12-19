const { isMockup, getValueFromBigMap, exprMichelineToJson, packTyped, packTypedAll, blake2b, getAddress, sign, taquitoExecuteSchema, keccak } = require('@completium/completium-cli');
const assert = require('assert');

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

let cpt = 0;
exports.generateArchetypeId = () => {
  // return ethers.utils.hexZeroPad(randomBytes(32))
  return ++cpt;
}

exports.pauseAndVerify = async (c, a) => {
  await c.pause({ as: a.pkh });
  let storage = await c.getStorage();
  assert(storage.paused == true, "contract should be paused");
}

exports.unpauseAndVerify = async (c, a) => {
  await c.unpause({ as: a.pkh });
  let storage = await c.getStorage();
  assert(storage.paused == false, "contract should not be paused");
}

exports.getArchetypeData = async (c, key) => {
  let storage = await c.getStorage();
  if (isMockup()) {
    const bmid = storage.archetypeLedger;
    const jval = await getValueFromBigMap(bmid, { int: key }, { prim: "nat" });
    const tval = exprMichelineToJson("(pair (address %archValidator) (pair (option %maxBalanceAllowed nat) (list %royalties (pair (address %partAccount) (nat %partValue)))))");

    const r = taquitoExecuteSchema(jval, tval);
    return r;
  } else {
    return await storage.archetypeLedger.get(key);
  }
}

const mkPairs = l => {
  if (l.length == 1) {
    return l[0];
  } else
    return {
      prim: 'Pair',
      args: [
        l[0],
        mkPairs(l.slice(1, l.length))
      ]
    }
}

exports.mkPairs = args => mkPairs(args)


exports.initUsds = (owner, minter, pauser) => {
  return {
    "prim": "Pair",
    "args": [
      {
        "prim": "Pair",
        "args": [
          {
            "prim": "Pair",
            "args": [
              {
                "prim": "Pair",
                "args": [
                  {
                    "int": "300000"
                  },
                  []
                ]
              },
              [],
              []
            ]
          },
          {
            "prim": "Pair",
            "args": [
              [],
              {
                "prim": "False"
              }
            ]
          },
          {
            "int": "0"
          },
          []
        ]
      },
      {
        "prim": "Pair",
        "args": [
          {
            "prim": "Pair",
            "args": [
              {
                "prim": "Pair",
                "args": [
                  {
                    "string": minter
                  },
                  {
                    "string": owner
                  }
                ]
              },
              {
                "string": pauser
              },
              {
                "prim": "None"
              }
            ]
          },
          {
            "int": "79971450000"
          }
        ]
      },
      {
        "prim": "None"
      }
    ]
  }
}

exports.getFA2Balance = (gbfa2) => {
  return async (fa2, o, t) => {
    await gbfa2.execBalanceof({ arg: { fa2: fa2.address, owner: o, tokenid: t } });
    const storage = await gbfa2.getStorage();
    return storage.toNumber();
  }
}

exports.getQuartzOwner = (archetypeGettertester) => {
  return async (id) => {
    await archetypeGettertester.execGetOwner({ arg: { tokenid: id } });
    let storage = await archetypeGettertester.getStorage();
    return storage.res_owner;
  }
}

exports.getQuartzUri = (archetypeGettertester) => {
  return async (id) => {
    await archetypeGettertester.execUri({ arg: { tokenid: id } });
    let storage = await archetypeGettertester.getStorage();
    return storage.res_uri;
  }
}

exports.checkFA2Balance = (gbfa2) => {
  return async (fa2, o, t, v) => {
    await gbfa2.execBalanceof({ arg: { fa2: fa2.address, owner: o, tokenid: t } });
    const storage = await gbfa2.getStorage();
    const res = storage.toNumber();
    if (res !== v) {
      throw new Error("Invalid balance of: expected " + v + ", got " + res);
    }
  }
}

// const transferParamType = exprMichelineToJson("(list (pair (address %from_) (list %txs (pair (address %to_) (nat %token_id) (nat %amount)))))");
// const permitDataType = exprMichelineToJson("(pair (pair address chain_id) (pair nat bytes))");

// exports.mkTransferPermit = async (from, to, amount, tokenid, permit_counter) => {
//   const michelsonData = `{ Pair "${from.pkh}" { Pair "${to.pkh}" (Pair ${tokenid} ${amount}) } }`;
//   const transferParam = exprMichelineToJson(michelsonData);
//   const permit = packTyped(transferParam, transferParamType);
//   const hashPermit = blake2b(permit);
//   const fa2Address = getAddress('fa2-feeless-wrapper');
//   const chainid = isMockup() ? "NetXynUjJNZm7wi" : "NetXz969SFaFn8k"; // else granada
//   const permitData = exprMichelineToJson(`(Pair (Pair "${fa2Address}" "${chainid}") (Pair ${permit_counter} 0x${hashPermit}))`);
//   const tosign = packTyped(permitData, permitDataType);
//   const signature = await sign(tosign, { as: from.name });
//   return { hash: hashPermit, sig: signature };
// }

// const tokenIdType = {
//   prim: 'pair',
//   args: [
//     { prim: 'nat' },
//     { prim: 'nat' }
//   ]
// }

exports.getTokenId = (archetypeid, serial) => {
  return archetypeid * 100_000 + serial
}

exports.errors = {
  ADMIN_CANDIDATE_NOT_SET: '"ADMIN_CANDIDATE_NOT_SET"',
  ARCHETYPE_ALREADY_REGISTERED: '"ARCHETYPE_ALREADY_REGISTERED"',
  ARCHETYPE_NOT_REGISTERED: '"ARCHETYPE_NOT_REGISTERED"',
  ARCHETYPE_NOT_SET: '"ARCHETYPE_NOT_SET"',
  ARCHETYPE_QUOTA_REACHED: '"ARCHETYPE_QUOTA_REACHED"',
  ARCHLEDGER_NOT_SET: '"ARCHLEDGER_NOT_SET"',
  ARCHOWNER_NOT_SET: '"ARCHOWNER_NOT_SET"',
  BAD_SIGNATURE: '"BAD_SIGNATURE"',
  BAD_TOKEN_ID: '"BAD_TOKEN_ID"',
  CALLER_NOT_ADMIN_CANDIDATE: '"CALLER_NOT_ADMIN_CANDIDATE"',
  CALLER_NOT_MINTER: '"CALLER_NOT_MINTER"',
  CALLER_NOT_OWNER: '"CALLER_NOT_OWNER"',
  CANNOT_DECREASE_MAX_BALANCE: '"CANNOT_DECREASE_MAX_BALANCE"',
  CANNOT_UPDATE_NONE_VALUE: '"CANNOT_UPDATE_NONE_VALUE"',
  CONTRACT_NOT_PAUSED: '"CONTRACT_NOT_PAUSED"',
  CONTRACT_PAUSED: '"CONTRACT_PAUSED"',
  DEADLINE_ALREADY_SET: '"DEADLINE_ALREADY_SET"',
  DEADLINE_REACHED: '"DEADLINE_REACHED"',
  EXPIRED_PERMIT: '"EXPIRED_PERMIT"',
  EXPIRY_TOO_BIG: '"EXPIRY_TOO_BIG"',
  FA2_INSUFFICIENT_BALANCE: '"FA2_INSUFFICIENT_BALANCE"',
  FA2_INVALID_AMOUNT: '"FA2_INVALID_AMOUNT"',
  FA2_NOT_OPERATOR: '"FA2_NOT_OPERATOR"',
  FA2_TOKEN_UNDEFINED: '"FA2_TOKEN_UNDEFINED"',
  GET_ARCHETYPE_ID_FAILED: '"GET_ARCHETYPE_ID_FAILED"',
  INTERNAL_ERROR: '"INTERNAL_ERROR"',
  INVALID_CALLER: '"InvalidCaller"',
  INVALID_AMOUNT: '"INVALID_AMOUNT"',
  MINTING_LIMIT_ALREADY_SET: '"MINTING_LIMIT_ALREADY_SET"',
  MISSIGNED: '"MISSIGNED"',
  PERMIT_NOT_FOUND: '"PERMIT_NOT_FOUND"',
  PERMIT_USER_NOT_FOUND: '"PERMIT_USER_NOT_FOUND"',
  SERIAL_NUMBER_OUT_OF_BOUNDS: '"SERIAL_NUMBER_OUT_OF_BOUNDS"',
  SIGNER_NOT_FROM: '"SIGNER_NOT_FROM"',
  USER_NOT_FOUND_FOR_PERMIT: '"USER_NOT_FOUND_FOR_PERMIT"',
  WHITELIST_ERROR: '"WHITELIST_ERROR"',
  WHITELIST_TO_RESTRICTED: '"TO_RESTRICTED"',
  WHITELIST_TO_NOT_ALLOWED: '"TO_NOT_ALLOWED"',
  KEY_EXISTS_LEDGER: '(Pair "KeyExists" "ledger")'
}
