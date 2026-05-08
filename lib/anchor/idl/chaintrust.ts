/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/chaintrust.json`.
 */
export type Chaintrust = {
  "address": "HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt",
  "metadata": {
    "name": "chaintrust",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "ChainTrust on-chain company identity and reputation layer"
  },
  "instructions": [
    {
      "name": "addOfficialResponse",
      "discriminator": [
        172,
        231,
        96,
        108,
        195,
        4,
        178,
        254
      ],
      "accounts": [
        {
          "name": "entity"
        },
        {
          "name": "comment",
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "officialResponseUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "attestHumanProof",
      "discriminator": [
        42,
        137,
        228,
        60,
        16,
        64,
        36,
        184
      ],
      "accounts": [
        {
          "name": "registryConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "humanProof",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  117,
                  109,
                  97,
                  110,
                  112,
                  114,
                  111,
                  111,
                  102
                ]
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "nullifierRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "nullifierHash"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "wallet",
          "docs": [
            "the account itself is never deserialized."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nullifierHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "attestRelationship",
      "discriminator": [
        62,
        74,
        169,
        243,
        79,
        129,
        157,
        109
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "issuer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "relationship",
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": "u8"
        },
        {
          "name": "targetRef",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "evidenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "evidenceUri",
          "type": "string"
        },
        {
          "name": "validFrom",
          "type": "i64"
        },
        {
          "name": "validUntil",
          "type": "i64"
        }
      ]
    },
    {
      "name": "claimEntity",
      "discriminator": [
        152,
        31,
        227,
        45,
        93,
        249,
        219,
        87
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "claimerProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "officerProof",
          "docs": [
            "Proof: a non-revoked Relationship of kind HAS_OFFICER pointing this",
            "signer at this entity, signed by an issuer with tier T1 or T2.",
            "Fix for the first-come-first-claim attack: the chain itself now",
            "witnesses that someone outside the claimer trusted them as an officer."
          ]
        },
        {
          "name": "officerIssuer"
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createEntity",
      "discriminator": [
        231,
        148,
        76,
        9,
        52,
        190,
        122,
        31
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "primaryIdClaim",
          "docs": [
            "IdClaim for the primary identifier. Anchor `init` here is what",
            "enforces \"one (country, id_type, id_value) → at most one Entity\"",
            "at the network level. A second filer attempting the same tuple gets",
            "`account already in use`."
          ],
          "writable": true
        },
        {
          "name": "creatorProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "country",
          "type": "string"
        },
        {
          "name": "idType",
          "type": "string"
        },
        {
          "name": "idValue",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "createProject",
      "discriminator": [
        148,
        219,
        181,
        42,
        221,
        114,
        145,
        190
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "entity"
              },
              {
                "kind": "arg",
                "path": "projectId"
              }
            ]
          }
        },
        {
          "name": "creatorProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "projectId",
          "type": {
            "array": [
              "u8",
              8
            ]
          }
        },
        {
          "name": "nameHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "domainHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeRegistryConfig",
      "discriminator": [
        184,
        229,
        7,
        64,
        182,
        13,
        240,
        46
      ],
      "accounts": [
        {
          "name": "registryConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "adminAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "likeComment",
      "discriminator": [
        129,
        249,
        45,
        219,
        85,
        221,
        49,
        38
      ],
      "accounts": [
        {
          "name": "comment",
          "writable": true
        },
        {
          "name": "likeRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "comment"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "likerProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "registerAdditionalId",
      "discriminator": [
        240,
        224,
        95,
        94,
        39,
        10,
        248,
        125
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "idClaim",
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "country",
          "type": "string"
        },
        {
          "name": "idType",
          "type": "string"
        },
        {
          "name": "idValue",
          "type": "string"
        }
      ]
    },
    {
      "name": "registerIssuer",
      "discriminator": [
        145,
        117,
        52,
        59,
        189,
        27,
        127,
        18
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "userProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": "u8"
        },
        {
          "name": "trustTier",
          "type": "u8"
        },
        {
          "name": "nameHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "registerUser",
      "discriminator": [
        2,
        241,
        150,
        223,
        99,
        214,
        116,
        97
      ],
      "accounts": [
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "humanProof",
          "docs": [
            "Proof-of-personhood gate. Must be created by the registry admin via",
            "`attest_human_proof` before this user can register, and must be bound",
            "to this exact wallet."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  117,
                  109,
                  97,
                  110,
                  112,
                  114,
                  111,
                  111,
                  102
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "username",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "requestIssuerTier",
      "discriminator": [
        32,
        120,
        182,
        232,
        136,
        254,
        225,
        229
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "tierRequest",
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "requestedTier",
          "type": "u8"
        },
        {
          "name": "noteHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "noteUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "reviewIssuerTier",
      "discriminator": [
        171,
        93,
        156,
        210,
        17,
        218,
        160,
        22
      ],
      "accounts": [
        {
          "name": "registryConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "issuer",
          "writable": true
        },
        {
          "name": "tierRequest",
          "writable": true
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "requestedTier",
          "type": "u8"
        },
        {
          "name": "approve",
          "type": "bool"
        }
      ]
    },
    {
      "name": "revokeRelationship",
      "discriminator": [
        32,
        212,
        32,
        93,
        29,
        52,
        193,
        7
      ],
      "accounts": [
        {
          "name": "relationship",
          "writable": true
        },
        {
          "name": "issuer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "submitComment",
      "discriminator": [
        112,
        46,
        212,
        28,
        214,
        107,
        241,
        118
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "comment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "entity"
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "commentIndex"
              }
            ]
          }
        },
        {
          "name": "commenterProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commentIndex",
          "type": "u32"
        },
        {
          "name": "relationType",
          "type": "u8"
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "evidenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "contentUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "submitReply",
      "discriminator": [
        160,
        122,
        237,
        211,
        113,
        230,
        144,
        227
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "parentComment"
        },
        {
          "name": "comment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "entity"
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "commentIndex"
              }
            ]
          }
        },
        {
          "name": "commenterProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commentIndex",
          "type": "u32"
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "evidenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "contentUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "unlikeComment",
      "discriminator": [
        132,
        141,
        113,
        33,
        31,
        153,
        29,
        27
      ],
      "accounts": [
        {
          "name": "comment",
          "writable": true
        },
        {
          "name": "likeRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "comment"
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateEntityMetadataUri",
      "discriminator": [
        133,
        141,
        209,
        63,
        190,
        68,
        38,
        48
      ],
      "accounts": [
        {
          "name": "entity",
          "writable": true
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateRegistryAdmin",
      "discriminator": [
        117,
        216,
        24,
        14,
        25,
        46,
        33,
        40
      ],
      "accounts": [
        {
          "name": "registryConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAdminAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateUserMetadataUri",
      "discriminator": [
        188,
        193,
        175,
        250,
        84,
        169,
        180,
        211
      ],
      "accounts": [
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "commentRecord",
      "discriminator": [
        152,
        52,
        102,
        146,
        208,
        29,
        42,
        101
      ]
    },
    {
      "name": "entity",
      "discriminator": [
        46,
        157,
        161,
        161,
        254,
        46,
        79,
        24
      ]
    },
    {
      "name": "humanProof",
      "discriminator": [
        225,
        188,
        237,
        208,
        200,
        82,
        85,
        45
      ]
    },
    {
      "name": "idClaim",
      "discriminator": [
        141,
        48,
        225,
        101,
        70,
        35,
        207,
        69
      ]
    },
    {
      "name": "issuer",
      "discriminator": [
        216,
        19,
        83,
        230,
        108,
        53,
        80,
        14
      ]
    },
    {
      "name": "issuerTierRequest",
      "discriminator": [
        199,
        247,
        190,
        20,
        212,
        195,
        245,
        161
      ]
    },
    {
      "name": "likeRecord",
      "discriminator": [
        179,
        237,
        53,
        5,
        91,
        236,
        161,
        50
      ]
    },
    {
      "name": "nullifierRecord",
      "discriminator": [
        56,
        18,
        57,
        175,
        69,
        202,
        189,
        70
      ]
    },
    {
      "name": "project",
      "discriminator": [
        205,
        168,
        189,
        202,
        181,
        247,
        142,
        19
      ]
    },
    {
      "name": "registryConfig",
      "discriminator": [
        23,
        118,
        10,
        246,
        173,
        231,
        243,
        156
      ]
    },
    {
      "name": "relationship",
      "discriminator": [
        89,
        169,
        213,
        122,
        174,
        249,
        5,
        251
      ]
    },
    {
      "name": "userProfile",
      "discriminator": [
        32,
        37,
        119,
        205,
        179,
        180,
        13,
        194
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidUsername",
      "msg": "Username is empty or exceeds max length"
    },
    {
      "code": 6001,
      "name": "invalidMetadataUri",
      "msg": "Metadata URI exceeds max length"
    },
    {
      "code": 6002,
      "name": "invalidJurisdiction",
      "msg": "Jurisdiction is empty or exceeds max length"
    },
    {
      "code": 6003,
      "name": "invalidContentUri",
      "msg": "Content URI exceeds max length"
    },
    {
      "code": 6004,
      "name": "invalidEvidenceUri",
      "msg": "Evidence URI exceeds max length"
    },
    {
      "code": 6005,
      "name": "invalidOfficialResponseUri",
      "msg": "Official response URI exceeds max length"
    },
    {
      "code": 6006,
      "name": "invalidRelationType",
      "msg": "Invalid comment relation type"
    },
    {
      "code": 6007,
      "name": "invalidIssuerKind",
      "msg": "Invalid issuer kind"
    },
    {
      "code": 6008,
      "name": "invalidIssuerTier",
      "msg": "Invalid issuer tier"
    },
    {
      "code": 6009,
      "name": "selfRegistrationRequiresTierThree",
      "msg": "Self-registration is restricted to Tier 3"
    },
    {
      "code": 6010,
      "name": "invalidTierReviewTarget",
      "msg": "Only Tier 1 or Tier 2 can be requested through review"
    },
    {
      "code": 6011,
      "name": "unauthorizedRegistryAdmin",
      "msg": "The connected wallet is not the registry admin"
    },
    {
      "code": 6012,
      "name": "tierRequestAlreadyPending",
      "msg": "A pending tier request already exists for this issuer and target tier"
    },
    {
      "code": 6013,
      "name": "tierRequestNotPending",
      "msg": "Tier request is no longer pending"
    },
    {
      "code": 6014,
      "name": "invalidRelationshipKind",
      "msg": "Invalid relationship kind"
    },
    {
      "code": 6015,
      "name": "invalidValidityWindow",
      "msg": "Invalid validity window — valid_until must be 0 or greater than valid_from"
    },
    {
      "code": 6016,
      "name": "projectEntityMismatch",
      "msg": "Project does not belong to the given Entity"
    },
    {
      "code": 6017,
      "name": "issuerAuthorityMismatch",
      "msg": "Issuer authority does not match signer"
    },
    {
      "code": 6018,
      "name": "alreadyRevoked",
      "msg": "Relationship has already been revoked"
    },
    {
      "code": 6019,
      "name": "alreadyClaimed",
      "msg": "Entity is already claimed"
    },
    {
      "code": 6020,
      "name": "notClaimed",
      "msg": "Entity is not claimed yet"
    },
    {
      "code": 6021,
      "name": "notOfficial",
      "msg": "Caller is not the official representative of this entity"
    },
    {
      "code": 6022,
      "name": "commentEntityMismatch",
      "msg": "Comment does not belong to this entity"
    },
    {
      "code": 6023,
      "name": "commentCountOverflow",
      "msg": "Comment count overflow"
    },
    {
      "code": 6024,
      "name": "projectCountOverflow",
      "msg": "Project count overflow"
    },
    {
      "code": 6025,
      "name": "relationshipCountOverflow",
      "msg": "Relationship count overflow"
    },
    {
      "code": 6026,
      "name": "parentEntityMismatch",
      "msg": "Parent comment belongs to a different entity"
    },
    {
      "code": 6027,
      "name": "maxReplyDepthExceeded",
      "msg": "Reply depth exceeds the maximum allowed nesting"
    },
    {
      "code": 6028,
      "name": "cannotRespondToReply",
      "msg": "Official response can only target a top-level comment, not a reply"
    },
    {
      "code": 6029,
      "name": "likeCountOverflow",
      "msg": "Like count underflow / overflow"
    },
    {
      "code": 6030,
      "name": "unauthorizedBootstrapAdmin",
      "msg": "Bootstrap admin pubkey does not match the hardcoded constant"
    },
    {
      "code": 6031,
      "name": "officerProofEntityMismatch",
      "msg": "Officer proof entity does not match the entity being claimed"
    },
    {
      "code": 6032,
      "name": "officerProofWrongKind",
      "msg": "Officer proof must be of kind HAS_OFFICER"
    },
    {
      "code": 6033,
      "name": "officerProofTargetMismatch",
      "msg": "Officer proof target does not match the claimer wallet"
    },
    {
      "code": 6034,
      "name": "officerProofRevoked",
      "msg": "Officer proof has been revoked"
    },
    {
      "code": 6035,
      "name": "officerProofIssuerMismatch",
      "msg": "Officer proof issuer account does not match issuer recorded on the proof"
    },
    {
      "code": 6036,
      "name": "officerProofTierTooLow",
      "msg": "Officer proof issuer tier is below the required claim threshold (T1/T2 only)"
    },
    {
      "code": 6037,
      "name": "targetAccountRequired",
      "msg": "This relationship kind requires a target account to be passed in remaining_accounts"
    },
    {
      "code": 6038,
      "name": "targetRefAccountMismatch",
      "msg": "Target account pubkey does not match target_ref"
    },
    {
      "code": 6039,
      "name": "officialResponseAlreadyExists",
      "msg": "Official response has already been published for this comment"
    },
    {
      "code": 6040,
      "name": "humanProofMissing",
      "msg": "HumanProof PDA missing — wallet has not passed the proof-of-personhood gate"
    },
    {
      "code": 6041,
      "name": "humanProofWalletMismatch",
      "msg": "HumanProof wallet field does not match signer"
    },
    {
      "code": 6042,
      "name": "invalidIdCountry",
      "msg": "Identifier country is empty or exceeds max length"
    },
    {
      "code": 6043,
      "name": "invalidIdType",
      "msg": "Identifier type is empty or exceeds max length"
    },
    {
      "code": 6044,
      "name": "invalidIdValue",
      "msg": "Identifier value is empty or exceeds max length"
    },
    {
      "code": 6045,
      "name": "tooManyIdentifiers",
      "msg": "Identifier count exceeds the per-entity maximum"
    },
    {
      "code": 6046,
      "name": "idClaimEntityMismatch",
      "msg": "IdClaim does not point at this entity"
    },
    {
      "code": 6047,
      "name": "notCreator",
      "msg": "Caller is not the creator of this entity"
    }
  ],
  "types": [
    {
      "name": "commentRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entity",
            "type": "pubkey"
          },
          {
            "name": "commenter",
            "type": "pubkey"
          },
          {
            "name": "commentIndex",
            "type": "u32"
          },
          {
            "name": "relationType",
            "type": "u8"
          },
          {
            "name": "parentComment",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "depth",
            "type": "u8"
          },
          {
            "name": "likeCount",
            "type": "u32"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "evidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentUri",
            "type": "string"
          },
          {
            "name": "officialResponseUri",
            "type": "string"
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "officialResponseAt",
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
      "name": "entity",
      "docs": [
        "Entity — the on-chain identity anchor for a real-world legal entity.",
        "",
        "`entity_id` is **deterministically derived** from the primary identifier",
        "(country | id_type | normalized id_value), not random. This means:",
        "- The CT-Number is a 1:1 encoding of `entity_id` (no truncation, no",
        "dead bytes), which is itself a stable function of (country, id_type,",
        "id_value). The same primary identifier always produces the same CT.",
        "- Anchor's `init` constraint on `[ENTITY_SEED, &entity_id]` is what",
        "enforces global uniqueness for the primary identifier.",
        "- Legal name and other descriptive fields live in IPFS metadata (mutable",
        "by `official_wallet` post-claim) so a company rename does NOT change",
        "the CT-Number.",
        "",
        "The previous `legal_name_hash` / `registry_id_hash` fields have been",
        "removed. They were a privacy theater (legal name was already plaintext on",
        "IPFS; registry IDs have a search space small enough to brute-force). The",
        "authoritative copies of those values now live in the public IPFS metadata."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entityId",
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          },
          {
            "name": "createdBy",
            "type": "pubkey"
          },
          {
            "name": "jurisdiction",
            "type": "string"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "isClaimed",
            "type": "bool"
          },
          {
            "name": "officialWallet",
            "type": "pubkey"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "projectCount",
            "type": "u32"
          },
          {
            "name": "relationshipCount",
            "type": "u32"
          },
          {
            "name": "commentCount",
            "type": "u32"
          },
          {
            "name": "identifierCount",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "claimedAt",
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
      "name": "humanProof",
      "docs": [
        "Anti-sybil gate: existence of this PDA at seed `[\"humanproof\", wallet]`",
        "proves that `wallet` has been bound (server-side) to a unique World ID",
        "nullifier through the registry admin. `register_user` requires it."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "verifiedAt",
            "type": "i64"
          },
          {
            "name": "attestedBy",
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
      "name": "idClaim",
      "docs": [
        "IdClaim — global unique reservation for a single (country, id_type,",
        "id_value) tuple, pointing back at the Entity that owns it.",
        "",
        "One Entity may have multiple identifiers (e.g. a US company with both",
        "EIN and SEC CIK). Each identifier gets its own IdClaim PDA. The PDA seed",
        "hashes the normalized inputs so:",
        "- Anchor's `init` enforces global uniqueness for that identifier.",
        "- Third parties can compute the PDA address from public inputs and",
        "resolve `(country, id_type, id_value) → Entity` in O(1).",
        "",
        "The account stores only the entity pointer and a creation timestamp; the",
        "human-readable identifiers live in the Entity's IPFS metadata."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entity",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
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
      "name": "issuer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "trustTier",
            "type": "u8"
          },
          {
            "name": "nameHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "registeredAt",
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
      "name": "issuerTierRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "requester",
            "type": "pubkey"
          },
          {
            "name": "requestedTier",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "noteHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "noteUri",
            "type": "string"
          },
          {
            "name": "requestedAt",
            "type": "i64"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          },
          {
            "name": "reviewedBy",
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
      "name": "likeRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "comment",
            "type": "pubkey"
          },
          {
            "name": "liker",
            "type": "pubkey"
          },
          {
            "name": "likedAt",
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
      "name": "nullifierRecord",
      "docs": [
        "Companion record indexed by nullifier_hash so the admin can refuse to",
        "re-bind the same World ID to a second wallet without a full table scan.",
        "Seed: `[\"nullifier\", nullifier_hash]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "verifiedAt",
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
      "name": "project",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "projectId",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "entity",
            "type": "pubkey"
          },
          {
            "name": "createdBy",
            "type": "pubkey"
          },
          {
            "name": "nameHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "domainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "createdAt",
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
      "name": "registryConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "adminAuthority",
            "type": "pubkey"
          },
          {
            "name": "initializedAt",
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
      "name": "relationship",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entity",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "targetRef",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "attestorAuthority",
            "type": "pubkey"
          },
          {
            "name": "evidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "evidenceUri",
            "type": "string"
          },
          {
            "name": "validFrom",
            "type": "i64"
          },
          {
            "name": "validUntil",
            "type": "i64"
          },
          {
            "name": "revokedAt",
            "type": "i64"
          },
          {
            "name": "createdAt",
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
      "name": "userProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "username",
            "type": "string"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "commentSeed",
      "type": "bytes",
      "value": "[99, 111, 109, 109, 101, 110, 116]"
    },
    {
      "name": "configSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "entitySeed",
      "type": "bytes",
      "value": "[101, 110, 116, 105, 116, 121]"
    },
    {
      "name": "humanproofSeed",
      "type": "bytes",
      "value": "[104, 117, 109, 97, 110, 112, 114, 111, 111, 102]"
    },
    {
      "name": "idClaimSeed",
      "type": "bytes",
      "value": "[105, 100, 45, 99, 108, 97, 105, 109]"
    },
    {
      "name": "issuerSeed",
      "type": "bytes",
      "value": "[105, 115, 115, 117, 101, 114]"
    },
    {
      "name": "issuerTierRequestSeed",
      "type": "bytes",
      "value": "[105, 115, 115, 117, 101, 114, 95, 116, 105, 101, 114, 95, 114, 101, 113, 117, 101, 115, 116]"
    },
    {
      "name": "likeSeed",
      "type": "bytes",
      "value": "[108, 105, 107, 101]"
    },
    {
      "name": "nullifierSeed",
      "type": "bytes",
      "value": "[110, 117, 108, 108, 105, 102, 105, 101, 114]"
    },
    {
      "name": "projectSeed",
      "type": "bytes",
      "value": "[112, 114, 111, 106, 101, 99, 116]"
    },
    {
      "name": "relSeed",
      "type": "bytes",
      "value": "[114, 101, 108]"
    },
    {
      "name": "userSeed",
      "type": "bytes",
      "value": "[117, 115, 101, 114]"
    }
  ]
};
