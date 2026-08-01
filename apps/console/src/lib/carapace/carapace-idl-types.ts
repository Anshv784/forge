/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/carapace.json`.
 */
export type Carapace = {
  "address": "GuZ6yoSDkTcYh2PKAeoDdb51ZhP9i7pRhL6MGrZXST8L",
  "metadata": {
    "name": "carapace",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "On-chain enforced spending guardrails and human-approval gate for autonomous ZeroClaw agent wallets"
  },
  "instructions": [
    {
      "name": "addAllowlistEntry",
      "discriminator": [
        59,
        108,
        25,
        164,
        197,
        177,
        166,
        249
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy"
        },
        {
          "name": "allowlistEntry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "arg",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "destination",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "approveIntent",
      "discriminator": [
        213,
        94,
        174,
        15,
        36,
        50,
        145,
        18
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy"
        },
        {
          "name": "intent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "intent.nonce",
                "account": "intent"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "closeIntent",
      "discriminator": [
        112,
        245,
        154,
        249,
        57,
        126,
        54,
        122
      ],
      "accounts": [
        {
          "name": "policy"
        },
        {
          "name": "intent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "intent.nonce",
                "account": "intent"
              }
            ]
          }
        },
        {
          "name": "payer",
          "docs": [
            "used only as the rent-refund destination."
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "denyIntent",
      "discriminator": [
        46,
        228,
        193,
        169,
        123,
        95,
        8,
        211
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy"
        },
        {
          "name": "intent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "intent.nonce",
                "account": "intent"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "depositSol",
      "discriminator": [
        108,
        81,
        78,
        117,
        125,
        155,
        56,
        200
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "policy"
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositSpl",
      "discriminator": [
        224,
        0,
        198,
        175,
        198,
        47,
        105,
        204
      ],
      "accounts": [
        {
          "name": "depositor",
          "signer": true
        },
        {
          "name": "policy"
        },
        {
          "name": "splMint",
          "relations": [
            "policy"
          ]
        },
        {
          "name": "depositorTokenAccount",
          "writable": true
        },
        {
          "name": "tokenVaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  118,
                  45,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "tokenVaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "splMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "executeTransferSol",
      "discriminator": [
        39,
        236,
        8,
        21,
        147,
        246,
        127,
        155
      ],
      "accounts": [
        {
          "name": "delegate",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "destination",
          "docs": [
            "`allowlist_entry`'s seeds below, not by any check on this account."
          ],
          "writable": true
        },
        {
          "name": "allowlistEntry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "intent",
          "docs": [
            "Required (and validated against `policy`, `amount`, and",
            "`destination`) whenever `amount >= policy.approval_threshold_lamports`.",
            "To omit it, the client must pass this program's own address as a",
            "`None` sentinel per Anchor's `Option<Account>` convention."
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "executeTransferSpl",
      "discriminator": [
        190,
        46,
        226,
        209,
        109,
        254,
        225,
        187
      ],
      "accounts": [
        {
          "name": "delegate",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true
        },
        {
          "name": "splMint",
          "relations": [
            "policy"
          ]
        },
        {
          "name": "tokenVaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  118,
                  45,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "tokenVaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "splMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "destinationTokenAccount",
          "writable": true
        },
        {
          "name": "allowlistEntry",
          "docs": [
            "The allow-list tracks *wallets* (the token account's owner), not",
            "specific token accounts, since token accounts can be closed/recreated",
            "but the human/entity behind them is what the policy actually cares",
            "about restricting."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "destinationTokenAccount.owner",
                "account": "tokenAccount"
              }
            ]
          }
        },
        {
          "name": "intent",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "expireIntent",
      "discriminator": [
        45,
        84,
        232,
        199,
        147,
        164,
        53,
        97
      ],
      "accounts": [
        {
          "name": "policy"
        },
        {
          "name": "intent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "intent.nonce",
                "account": "intent"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializePolicy",
      "discriminator": [
        9,
        186,
        86,
        225,
        129,
        162,
        231,
        56
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "params.agentIndex"
              }
            ]
          }
        },
        {
          "name": "solVault",
          "docs": [
            "`system_program::transfer` CPIs signed via its own seeds; a",
            "never-assigned address is implicitly System-Program-owned, so no",
            "`init` is needed here."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "tokenVaultAuthority",
          "docs": [
            "data or lamports of its own, exists only to be a CPI signer."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  118,
                  45,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "splMint"
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "tokenVaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "splMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initPolicyParams"
            }
          }
        }
      ]
    },
    {
      "name": "proposeIntent",
      "discriminator": [
        235,
        187,
        3,
        3,
        160,
        187,
        162,
        226
      ],
      "accounts": [
        {
          "name": "delegate",
          "writable": true,
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true
        },
        {
          "name": "intent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "policy.nextIntentNonce",
                "account": "policy"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "proposeIntentParams"
            }
          }
        }
      ]
    },
    {
      "name": "removeAllowlistEntry",
      "discriminator": [
        90,
        45,
        105,
        22,
        131,
        188,
        49,
        94
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy"
        },
        {
          "name": "allowlistEntry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              },
              {
                "kind": "account",
                "path": "allowlistEntry.destination",
                "account": "allowlistEntry"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "rotateDelegate",
      "discriminator": [
        192,
        232,
        42,
        163,
        243,
        113,
        124,
        136
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newDelegate",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateLimits",
      "discriminator": [
        89,
        37,
        137,
        60,
        75,
        70,
        48,
        194
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateLimitsParams"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawSol",
      "discriminator": [
        145,
        131,
        74,
        136,
        65,
        137,
        42,
        38
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy"
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "destination",
          "docs": [
            "signing the withdrawal, so no further constraint is needed."
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawSpl",
      "discriminator": [
        181,
        154,
        94,
        86,
        62,
        115,
        6,
        186
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy"
        },
        {
          "name": "splMint",
          "relations": [
            "policy"
          ]
        },
        {
          "name": "tokenVaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  118,
                  45,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "policy"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "tokenVaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "splMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "destinationTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "allowlistEntry",
      "discriminator": [
        42,
        59,
        88,
        1,
        124,
        138,
        92,
        236
      ]
    },
    {
      "name": "intent",
      "discriminator": [
        247,
        162,
        35,
        165,
        254,
        111,
        129,
        109
      ]
    },
    {
      "name": "policy",
      "discriminator": [
        222,
        135,
        7,
        163,
        235,
        177,
        33,
        68
      ]
    }
  ],
  "events": [
    {
      "name": "allowlistEntryAdded",
      "discriminator": [
        189,
        3,
        10,
        207,
        223,
        123,
        193,
        20
      ]
    },
    {
      "name": "allowlistEntryRemoved",
      "discriminator": [
        62,
        82,
        249,
        76,
        179,
        253,
        95,
        61
      ]
    },
    {
      "name": "delegateRotated",
      "discriminator": [
        37,
        42,
        13,
        79,
        51,
        70,
        26,
        62
      ]
    },
    {
      "name": "deposited",
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ]
    },
    {
      "name": "intentApproved",
      "discriminator": [
        144,
        44,
        75,
        93,
        58,
        151,
        160,
        172
      ]
    },
    {
      "name": "intentClosed",
      "discriminator": [
        127,
        229,
        67,
        202,
        91,
        56,
        164,
        0
      ]
    },
    {
      "name": "intentDenied",
      "discriminator": [
        20,
        164,
        63,
        128,
        200,
        3,
        99,
        140
      ]
    },
    {
      "name": "intentExpiredEvent",
      "discriminator": [
        36,
        241,
        26,
        20,
        54,
        25,
        17,
        74
      ]
    },
    {
      "name": "intentProposed",
      "discriminator": [
        249,
        245,
        19,
        13,
        26,
        73,
        164,
        131
      ]
    },
    {
      "name": "limitsUpdated",
      "discriminator": [
        160,
        131,
        108,
        76,
        91,
        80,
        118,
        137
      ]
    },
    {
      "name": "pausedSet",
      "discriminator": [
        171,
        125,
        127,
        156,
        233,
        81,
        68,
        66
      ]
    },
    {
      "name": "policyInitialized",
      "discriminator": [
        102,
        184,
        59,
        178,
        235,
        69,
        251,
        181
      ]
    },
    {
      "name": "transferExecuted",
      "discriminator": [
        8,
        128,
        224,
        132,
        112,
        216,
        192,
        35
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "perTxCapExceeded",
      "msg": "Per-transaction spend cap exceeded"
    },
    {
      "code": 6001,
      "name": "dailyCapExceeded",
      "msg": "Daily spend cap exceeded"
    },
    {
      "code": 6002,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6003,
      "name": "approvalRequired",
      "msg": "This amount requires an approved Intent before it can execute"
    },
    {
      "code": 6004,
      "name": "intentMismatch",
      "msg": "The provided Intent does not match the action being executed"
    },
    {
      "code": 6005,
      "name": "intentNotPending",
      "msg": "Intent is not in Pending status"
    },
    {
      "code": 6006,
      "name": "intentNotApproved",
      "msg": "Intent is not in Approved status"
    },
    {
      "code": 6007,
      "name": "intentExpired",
      "msg": "Intent has expired"
    },
    {
      "code": 6008,
      "name": "intentNotExpired",
      "msg": "Intent has not yet expired"
    },
    {
      "code": 6009,
      "name": "intentStillPending",
      "msg": "Intent is still Pending and cannot be closed"
    },
    {
      "code": 6010,
      "name": "targetNotAllowlisted",
      "msg": "Destination is not on the policy allow-list"
    },
    {
      "code": 6011,
      "name": "policyPaused",
      "msg": "Policy is paused"
    },
    {
      "code": 6012,
      "name": "reentrancyLocked",
      "msg": "Reentrant call into a locked policy"
    },
    {
      "code": 6013,
      "name": "unauthorizedDelegate",
      "msg": "Signer is not the policy delegate"
    },
    {
      "code": 6014,
      "name": "unauthorizedOwner",
      "msg": "Signer is not the policy owner"
    },
    {
      "code": 6015,
      "name": "policyExpired",
      "msg": "Policy has expired"
    },
    {
      "code": 6016,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6017,
      "name": "ttlTooLong",
      "msg": "Requested TTL exceeds the maximum allowed intent lifetime"
    },
    {
      "code": 6018,
      "name": "payerMismatch",
      "msg": "Rent payer does not match the intent's stored payer"
    },
    {
      "code": 6019,
      "name": "mintMismatch",
      "msg": "Mint does not match this policy's configured SPL token"
    },
    {
      "code": 6020,
      "name": "delegateUnchanged",
      "msg": "New delegate must differ from the current delegate"
    }
  ],
  "types": [
    {
      "name": "allowlistEntry",
      "docs": [
        "One allow-listed destination for a policy's delegate-initiated transfers.",
        "Existence of this PDA is the allow-list check; there is no on/off flag."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "allowlistEntryAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "allowlistEntryRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "assetKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "sol"
          },
          {
            "name": "spl"
          }
        ]
      }
    },
    {
      "name": "delegateRotated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "oldDelegate",
            "type": "pubkey"
          },
          {
            "name": "newDelegate",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "deposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "asset",
            "type": {
              "defined": {
                "name": "assetKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "initPolicyParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentIndex",
            "type": "u16"
          },
          {
            "name": "delegate",
            "type": "pubkey"
          },
          {
            "name": "maxPerTxLamports",
            "type": "u64"
          },
          {
            "name": "maxDailyLamports",
            "type": "u64"
          },
          {
            "name": "approvalThresholdLamports",
            "type": "u64"
          },
          {
            "name": "maxPerTxSpl",
            "type": "u64"
          },
          {
            "name": "maxDailySpl",
            "type": "u64"
          },
          {
            "name": "approvalThresholdSpl",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "docs": [
              "Unix timestamp after which the policy can no longer propose or",
              "execute anything (owner can still withdraw). 0 = never expires."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "intent",
      "docs": [
        "A specific, human-approvable proposed action. `execute_transfer` checks",
        "every field below against the transfer it is about to perform — matching",
        "only on \"an approved intent exists somewhere\" would let a delegate get a",
        "small amount approved and then execute a much larger one."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "asset",
            "type": {
              "defined": {
                "name": "assetKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "actionHash",
            "docs": [
              "Hash of a human-readable description of the action (kept off-chain /",
              "in program logs via `emit!`, not stored in full on-chain, to keep",
              "this account small and cheap to rent)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "intentStatus"
              }
            }
          },
          {
            "name": "payer",
            "docs": [
              "Whoever paid to create this account — refunded on `close_intent`,",
              "never an arbitrary caller-supplied destination."
            ],
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "decidedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "intentApproved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "intent",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "intentClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "intent",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "intentDenied",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "intent",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "intentExpiredEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "intent",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "intentProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "intent",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "asset",
            "type": {
              "defined": {
                "name": "assetKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "actionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "intentStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "approved"
          },
          {
            "name": "denied"
          },
          {
            "name": "expired"
          },
          {
            "name": "executed"
          }
        ]
      }
    },
    {
      "name": "limitsUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "maxPerTxLamports",
            "type": "u64"
          },
          {
            "name": "maxDailyLamports",
            "type": "u64"
          },
          {
            "name": "maxPerTxSpl",
            "type": "u64"
          },
          {
            "name": "maxDailySpl",
            "type": "u64"
          },
          {
            "name": "approvalThresholdLamports",
            "type": "u64"
          },
          {
            "name": "approvalThresholdSpl",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pausedSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "policy",
      "docs": [
        "The trust boundary for one autonomous agent's wallet.",
        "",
        "Funds never sit in a key the `delegate` independently controls — they sit",
        "in `SolVault`/the SPL vault ATA, both PDAs whose only way to move is",
        "through this program's own instruction logic (see `instructions::execute`).",
        "The `delegate` can only ever *ask* this program to move funds; whether",
        "that ask succeeds is entirely determined by the checks below."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The human (or Squads multisig, in a future extension) who controls",
              "this policy. Only this key can change limits, pause, rotate the",
              "delegate, approve/deny Intents, or withdraw."
            ],
            "type": "pubkey"
          },
          {
            "name": "delegate",
            "docs": [
              "The agent's own ephemeral session pubkey. Can request transfers and",
              "propose Intents, but can never independently move funds outside of",
              "what `execute_transfer` allows."
            ],
            "type": "pubkey"
          },
          {
            "name": "splMint",
            "docs": [
              "The single SPL mint this policy tracks a vault + caps for."
            ],
            "type": "pubkey"
          },
          {
            "name": "agentIndex",
            "docs": [
              "Lets one owner run multiple independent agents, each with its own",
              "Policy PDA (seeds include this index)."
            ],
            "type": "u16"
          },
          {
            "name": "solVaultBump",
            "type": "u8"
          },
          {
            "name": "tokenVaultAuthorityBump",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "maxPerTxLamports",
            "type": "u64"
          },
          {
            "name": "maxDailyLamports",
            "type": "u64"
          },
          {
            "name": "spentTodayLamports",
            "type": "u64"
          },
          {
            "name": "maxPerTxSpl",
            "type": "u64"
          },
          {
            "name": "maxDailySpl",
            "type": "u64"
          },
          {
            "name": "spentTodaySpl",
            "type": "u64"
          },
          {
            "name": "windowStartTs",
            "docs": [
              "Shared fixed-reset window for both asset classes. Not a true sliding",
              "window — see docs/SECURITY.md."
            ],
            "type": "i64"
          },
          {
            "name": "approvalThresholdLamports",
            "docs": [
              "Transfers at or above this amount require an `Approved` Intent.",
              "Set to 0 to require approval on every transfer of that asset; set to",
              "`u64::MAX` to never require approval (delegate is fully autonomous up",
              "to the per-tx/daily caps)."
            ],
            "type": "u64"
          },
          {
            "name": "approvalThresholdSpl",
            "type": "u64"
          },
          {
            "name": "nextIntentNonce",
            "docs": [
              "Monotonic counter used to derive collision-free Intent PDAs."
            ],
            "type": "u64"
          },
          {
            "name": "totalExecutedCount",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "docs": [
              "0 means the policy never expires."
            ],
            "type": "i64"
          },
          {
            "name": "paused",
            "docs": [
              "Owner-controlled kill switch. When true, the delegate cannot execute",
              "or propose anything; the owner can still withdraw."
            ],
            "type": "bool"
          },
          {
            "name": "reentrancyLock",
            "docs": [
              "Defense-in-depth against reentrancy into `execute_*`. The Solana",
              "runtime already rejects A->B->A CPI reentrancy, so this is a belt",
              "against future runtime changes and instruction-ordering bugs, not the",
              "primary guarantee."
            ],
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "policyInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "delegate",
            "type": "pubkey"
          },
          {
            "name": "splMint",
            "type": "pubkey"
          },
          {
            "name": "agentIndex",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "proposeIntentParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": {
              "defined": {
                "name": "assetKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "destination",
            "docs": [
              "Wallet the funds would go to (for SPL, the token account's *owner*,",
              "not the token account address itself)."
            ],
            "type": "pubkey"
          },
          {
            "name": "actionHash",
            "docs": [
              "Hash of an off-chain, human-readable description of the action (e.g.",
              "sha256 of \"pay invoice #42 to Acme for 12 USDC\"). Kept as a hash",
              "on-chain to keep this account small; the full text travels via the",
              "dashboard/Blink UI and is bound to the execution by this hash."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ttlSeconds",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "transferExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "asset",
            "type": {
              "defined": {
                "name": "assetKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "intent",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "spentToday",
            "type": "u64"
          },
          {
            "name": "totalExecutedCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "updateLimitsParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxPerTxLamports",
            "type": "u64"
          },
          {
            "name": "maxDailyLamports",
            "type": "u64"
          },
          {
            "name": "approvalThresholdLamports",
            "type": "u64"
          },
          {
            "name": "maxPerTxSpl",
            "type": "u64"
          },
          {
            "name": "maxDailySpl",
            "type": "u64"
          },
          {
            "name": "approvalThresholdSpl",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "asset",
            "type": {
              "defined": {
                "name": "assetKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "destination",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
