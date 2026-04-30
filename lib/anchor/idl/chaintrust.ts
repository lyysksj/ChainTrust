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
          "name": "wallet"
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
          "name": "officerProof"
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "entityId"
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
          "name": "entityId",
          "type": {
            "array": [
              "u8",
              8
            ]
          }
        },
        {
          "name": "legalNameHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "registryIdHash",
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
      "name": "invalidRelationshipKind",
      "msg": "Invalid relationship kind"
    },
    {
      "code": 6010,
      "name": "invalidValidityWindow",
      "msg": "Invalid validity window — valid_until must be 0 or greater than valid_from"
    },
    {
      "code": 6011,
      "name": "projectEntityMismatch",
      "msg": "Project does not belong to the given Entity"
    },
    {
      "code": 6012,
      "name": "issuerAuthorityMismatch",
      "msg": "Issuer authority does not match signer"
    },
    {
      "code": 6013,
      "name": "alreadyRevoked",
      "msg": "Relationship has already been revoked"
    },
    {
      "code": 6014,
      "name": "alreadyClaimed",
      "msg": "Entity is already claimed"
    },
    {
      "code": 6015,
      "name": "notClaimed",
      "msg": "Entity is not claimed yet"
    },
    {
      "code": 6016,
      "name": "notOfficial",
      "msg": "Caller is not the official representative of this entity"
    },
    {
      "code": 6017,
      "name": "commentEntityMismatch",
      "msg": "Comment does not belong to this entity"
    },
    {
      "code": 6018,
      "name": "commentCountOverflow",
      "msg": "Comment count overflow"
    },
    {
      "code": 6019,
      "name": "projectCountOverflow",
      "msg": "Project count overflow"
    },
    {
      "code": 6020,
      "name": "relationshipCountOverflow",
      "msg": "Relationship count overflow"
    },
    {
      "code": 6021,
      "name": "parentEntityMismatch",
      "msg": "Parent comment belongs to a different entity"
    },
    {
      "code": 6022,
      "name": "maxReplyDepthExceeded",
      "msg": "Reply depth exceeds the maximum allowed nesting"
    },
    {
      "code": 6023,
      "name": "cannotRespondToReply",
      "msg": "Official response can only target a top-level comment, not a reply"
    },
    {
      "code": 6024,
      "name": "likeCountOverflow",
      "msg": "Like count underflow / overflow"
    },
    {
      "code": 6025,
      "name": "selfRegistrationRequiresTierThree",
      "msg": "Self-registration is restricted to Tier 3"
    },
    {
      "code": 6026,
      "name": "invalidTierReviewTarget",
      "msg": "Only Tier 1 or Tier 2 can be requested through review"
    },
    {
      "code": 6027,
      "name": "unauthorizedRegistryAdmin",
      "msg": "The connected wallet is not the registry admin"
    },
    {
      "code": 6028,
      "name": "tierRequestAlreadyPending",
      "msg": "A pending tier request already exists for this issuer and target tier"
    },
    {
      "code": 6029,
      "name": "tierRequestNotPending",
      "msg": "Tier request is no longer pending"
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
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entityId",
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
            "name": "legalNameHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "registryIdHash",
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
    },
    {
      "name": "humanProof",
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
      "name": "nullifierRecord",
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
    }
  ],
  "constants": [
    {
      "name": "commentSeed",
      "type": "bytes",
      "value": "[99, 111, 109, 109, 101, 110, 116]"
    },
    {
      "name": "entitySeed",
      "type": "bytes",
      "value": "[101, 110, 116, 105, 116, 121]"
    },
    {
      "name": "issuerSeed",
      "type": "bytes",
      "value": "[105, 115, 115, 117, 101, 114]"
    },
    {
      "name": "likeSeed",
      "type": "bytes",
      "value": "[108, 105, 107, 101]"
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
    },
    {
      "name": "humanproofSeed",
      "type": "bytes",
      "value": "[104, 117, 109, 97, 110, 112, 114, 111, 111, 102]"
    },
    {
      "name": "nullifierSeed",
      "type": "bytes",
      "value": "[110, 117, 108, 108, 105, 102, 105, 101, 114]"
    }
  ]
};
