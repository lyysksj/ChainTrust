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
          "name": "entry"
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
      "name": "addWalletMapping",
      "discriminator": [
        110,
        93,
        50,
        31,
        236,
        134,
        105,
        27
      ],
      "accounts": [
        {
          "name": "entry",
          "writable": true
        },
        {
          "name": "walletMapping",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  109,
                  97,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "targetWallet"
              },
              {
                "kind": "account",
                "path": "entry"
              }
            ]
          }
        },
        {
          "name": "targetWallet"
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
          "name": "walletRole",
          "type": "u8"
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
          "name": "isOfficial",
          "type": "bool"
        }
      ]
    },
    {
      "name": "claimEntry",
      "discriminator": [
        255,
        0,
        113,
        239,
        102,
        117,
        114,
        50
      ],
      "accounts": [
        {
          "name": "entry",
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
          "name": "signer",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createEntry",
      "discriminator": [
        248,
        207,
        142,
        242,
        66,
        162,
        150,
        16
      ],
      "accounts": [
        {
          "name": "entry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "entryId"
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
          "name": "primaryWallet",
          "docs": [
            "pass the System Program id as a sentinel when the user did not specify one."
          ]
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
          "name": "entryId",
          "type": {
            "array": [
              "u8",
              8
            ]
          }
        },
        {
          "name": "companyNameHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "projectNameHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "einHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "jurisdiction",
          "type": "string"
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
          "name": "entry",
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
                "path": "entry"
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
          "name": "entry",
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
                "path": "entry"
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
      "name": "companyEntry",
      "discriminator": [
        86,
        82,
        125,
        42,
        215,
        225,
        171,
        247
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
    },
    {
      "name": "walletMapping",
      "discriminator": [
        113,
        133,
        85,
        102,
        21,
        1,
        246,
        42
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
      "msg": "Invalid relation type"
    },
    {
      "code": 6007,
      "name": "invalidWalletRole",
      "msg": "Invalid wallet role"
    },
    {
      "code": 6008,
      "name": "alreadyClaimed",
      "msg": "Entry is already claimed"
    },
    {
      "code": 6009,
      "name": "notClaimed",
      "msg": "Entry is not claimed yet"
    },
    {
      "code": 6010,
      "name": "notOfficial",
      "msg": "Caller is not the official representative of this entry"
    },
    {
      "code": 6011,
      "name": "commentEntryMismatch",
      "msg": "Comment does not belong to this entry"
    },
    {
      "code": 6012,
      "name": "commentCountOverflow",
      "msg": "Comment count overflow"
    },
    {
      "code": 6013,
      "name": "parentEntryMismatch",
      "msg": "Parent comment belongs to a different entry"
    },
    {
      "code": 6014,
      "name": "maxReplyDepthExceeded",
      "msg": "Reply depth exceeds the maximum allowed nesting"
    },
    {
      "code": 6015,
      "name": "cannotRespondToReply",
      "msg": "Official response can only target a top-level review, not a reply"
    },
    {
      "code": 6016,
      "name": "likeCountOverflow",
      "msg": "Like count underflow / overflow"
    }
  ],
  "types": [
    {
      "name": "commentRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entry",
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
      "name": "companyEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entryId",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "createdBy",
            "type": "pubkey"
          },
          {
            "name": "companyNameHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "projectNameHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "einHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "jurisdiction",
            "type": "string"
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
            "name": "primaryWallet",
            "type": "pubkey"
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
            "name": "commentCount",
            "type": "u32"
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
    },
    {
      "name": "walletMapping",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "targetWallet",
            "type": "pubkey"
          },
          {
            "name": "entry",
            "type": "pubkey"
          },
          {
            "name": "walletRole",
            "type": "u8"
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
            "name": "addedBy",
            "type": "pubkey"
          },
          {
            "name": "isOfficial",
            "type": "bool"
          },
          {
            "name": "addedAt",
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
      "name": "entrySeed",
      "type": "bytes",
      "value": "[101, 110, 116, 114, 121]"
    },
    {
      "name": "likeSeed",
      "type": "bytes",
      "value": "[108, 105, 107, 101]"
    },
    {
      "name": "userSeed",
      "type": "bytes",
      "value": "[117, 115, 101, 114]"
    },
    {
      "name": "walletMapSeed",
      "type": "bytes",
      "value": "[119, 97, 108, 108, 101, 116, 95, 109, 97, 112]"
    }
  ]
};
