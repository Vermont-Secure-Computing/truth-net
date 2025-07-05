/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/truth_network.json`.
 */
export type TruthNetwork = {
  "address": "FFL71XjBkjq5gce7EtpB7Wa5p8qnRNueLKSzM4tkEMoc",
  "metadata": {
    "name": "truthNetwork",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimReward",
      "discriminator": [
        149,
        95,
        181,
        242,
        94,
        90,
        158,
        162
      ],
      "accounts": [
        {
          "name": "voter",
          "writable": true,
          "signer": true,
          "relations": [
            "voterRecord"
          ]
        },
        {
          "name": "voterRecord",
          "writable": true
        },
        {
          "name": "question",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "question.asker",
                "account": "question"
              },
              {
                "kind": "account",
                "path": "question.id",
                "account": "question"
              }
            ]
          }
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "feeReceiver",
          "writable": true,
          "address": "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "txId",
          "type": "string"
        }
      ]
    },
    {
      "name": "commitVote",
      "discriminator": [
        134,
        97,
        90,
        126,
        91,
        66,
        16,
        26
      ],
      "accounts": [
        {
          "name": "question",
          "writable": true
        },
        {
          "name": "voterRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "voter"
              },
              {
                "kind": "account",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "userRecord",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "voter",
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
          "name": "commitment",
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
      "name": "createQuestion",
      "discriminator": [
        222,
        74,
        49,
        30,
        160,
        220,
        179,
        27
      ],
      "accounts": [
        {
          "name": "questionCounter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "asker"
              }
            ]
          }
        },
        {
          "name": "question",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "asker"
              },
              {
                "kind": "account",
                "path": "question_counter.count",
                "account": "questionCounter"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "asker",
          "writable": true,
          "signer": true,
          "relations": [
            "questionCounter"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "questionText",
          "type": "string"
        },
        {
          "name": "reward",
          "type": "u64"
        },
        {
          "name": "commitEndTime",
          "type": "i64"
        },
        {
          "name": "revealEndTime",
          "type": "i64"
        }
      ]
    },
    {
      "name": "createVoterRecord",
      "discriminator": [
        3,
        12,
        113,
        222,
        177,
        4,
        152,
        165
      ],
      "accounts": [
        {
          "name": "question",
          "writable": true
        },
        {
          "name": "voterRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "voter"
              },
              {
                "kind": "account",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "voter",
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
      "name": "deleteExpiredQuestion",
      "discriminator": [
        63,
        191,
        168,
        249,
        120,
        213,
        66,
        235
      ],
      "accounts": [
        {
          "name": "question",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "asker"
              },
              {
                "kind": "account",
                "path": "question.id",
                "account": "question"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "asker",
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
      "name": "deleteInvite",
      "discriminator": [
        233,
        190,
        128,
        59,
        23,
        30,
        144,
        78
      ],
      "accounts": [
        {
          "name": "invite",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  105,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "invite.invitee",
                "account": "invite"
              }
            ]
          }
        },
        {
          "name": "inviter",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "drainUnclaimedReward",
      "discriminator": [
        185,
        238,
        4,
        146,
        102,
        99,
        214,
        222
      ],
      "accounts": [
        {
          "name": "question",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "question.asker",
                "account": "question"
              },
              {
                "kind": "account",
                "path": "question.id",
                "account": "question"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "feeReceiver",
          "writable": true,
          "address": "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "finalizeVoting",
      "discriminator": [
        195,
        61,
        27,
        72,
        252,
        138,
        175,
        13
      ],
      "accounts": [
        {
          "name": "question",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "questionId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeCounter",
      "discriminator": [
        67,
        89,
        100,
        87,
        231,
        172,
        35,
        124
      ],
      "accounts": [
        {
          "name": "questionCounter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "asker"
              }
            ]
          }
        },
        {
          "name": "asker",
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
      "name": "initializeGlobalState",
      "discriminator": [
        232,
        254,
        209,
        244,
        123,
        89,
        154,
        207
      ],
      "accounts": [
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
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
      "name": "joinNetwork",
      "discriminator": [
        246,
        184,
        107,
        68,
        39,
        172,
        8,
        30
      ],
      "accounts": [
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "invite",
          "optional": true
        },
        {
          "name": "user",
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
      "name": "leaveNetwork",
      "discriminator": [
        95,
        180,
        37,
        177,
        111,
        193,
        20,
        19
      ],
      "accounts": [
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
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
      "name": "nominateInvitee",
      "discriminator": [
        84,
        248,
        9,
        36,
        106,
        135,
        159,
        234
      ],
      "accounts": [
        {
          "name": "invite",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  105,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "nominee"
              }
            ]
          }
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "inviter"
              }
            ]
          }
        },
        {
          "name": "inviter",
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
          "name": "nominee",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "reclaimCommitOrLoserRent",
      "discriminator": [
        218,
        246,
        190,
        77,
        197,
        21,
        178,
        159
      ],
      "accounts": [
        {
          "name": "voterRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "voter"
              },
              {
                "kind": "account",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "question",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "question.asker",
                "account": "question"
              },
              {
                "kind": "account",
                "path": "question.id",
                "account": "question"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "revealVote",
      "discriminator": [
        100,
        157,
        139,
        17,
        186,
        75,
        185,
        149
      ],
      "accounts": [
        {
          "name": "question",
          "writable": true
        },
        {
          "name": "voterRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "voter"
              },
              {
                "kind": "account",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "userRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "voter",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "password",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalState",
      "discriminator": [
        163,
        46,
        74,
        168,
        216,
        123,
        133,
        98
      ]
    },
    {
      "name": "invite",
      "discriminator": [
        230,
        17,
        253,
        74,
        50,
        78,
        85,
        101
      ]
    },
    {
      "name": "question",
      "discriminator": [
        111,
        22,
        150,
        220,
        181,
        122,
        118,
        127
      ]
    },
    {
      "name": "questionCounter",
      "discriminator": [
        91,
        17,
        149,
        190,
        211,
        154,
        240,
        18
      ]
    },
    {
      "name": "userRecord",
      "discriminator": [
        210,
        252,
        132,
        218,
        191,
        85,
        173,
        167
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    },
    {
      "name": "voterRecord",
      "discriminator": [
        178,
        96,
        138,
        116,
        143,
        202,
        115,
        33
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "votingEnded",
      "msg": "Voting period has ended."
    },
    {
      "code": 6001,
      "name": "votingStillActive",
      "msg": "Voting is still active."
    },
    {
      "code": 6002,
      "name": "alreadyFinalized",
      "msg": "Voting has already been finalized."
    },
    {
      "code": 6003,
      "name": "alreadyInitialized",
      "msg": "Question counter already exists."
    },
    {
      "code": 6004,
      "name": "alreadyVoted",
      "msg": "You have already voted on this question."
    },
    {
      "code": 6005,
      "name": "alreadyRevealed",
      "msg": "You have already revealed your vote."
    },
    {
      "code": 6006,
      "name": "invalidReveal",
      "msg": "Invalid voting reveal."
    },
    {
      "code": 6007,
      "name": "notJoined",
      "msg": "You have already left the network."
    },
    {
      "code": 6008,
      "name": "rentNotExpiredOrVotesExist",
      "msg": "Rent period has not expired or votes have been committed."
    },
    {
      "code": 6009,
      "name": "invalidTimeframe",
      "msg": "Invalid timeframe."
    },
    {
      "code": 6010,
      "name": "commitPhaseEnded",
      "msg": "Commit phase ended."
    },
    {
      "code": 6011,
      "name": "revealPhaseEnded",
      "msg": "Reveal phase ended."
    },
    {
      "code": 6012,
      "name": "notEligible",
      "msg": "You're not eligible"
    },
    {
      "code": 6013,
      "name": "alreadyClaimed",
      "msg": "Already claimed."
    },
    {
      "code": 6014,
      "name": "noEligibleVoters",
      "msg": "No eligible voters."
    },
    {
      "code": 6015,
      "name": "invalidVaultAccount",
      "msg": "Invalid vault account"
    },
    {
      "code": 6016,
      "name": "insufficientFunds",
      "msg": "Insufficient funds."
    },
    {
      "code": 6017,
      "name": "overflow",
      "msg": "overflow"
    },
    {
      "code": 6018,
      "name": "insufficientMajority",
      "msg": "Winning votes do not meet the required 51% majority."
    },
    {
      "code": 6019,
      "name": "questionIdMismatch",
      "msg": "Question ID mismatch."
    },
    {
      "code": 6020,
      "name": "notPartOfVoterList",
      "msg": "Not a part of the voters list."
    },
    {
      "code": 6021,
      "name": "remainingRewardExists",
      "msg": "Remaining reward exists, cannot delete."
    },
    {
      "code": 6022,
      "name": "questionTooShort",
      "msg": "Question must be at least 10 characters long."
    },
    {
      "code": 6023,
      "name": "rewardTooSmall",
      "msg": "Reward must be at least 0.05 SOL."
    },
    {
      "code": 6024,
      "name": "revealPhaseNotOver",
      "msg": "Reveal phase is not yet over."
    },
    {
      "code": 6025,
      "name": "cannotDrainReward",
      "msg": "Cannot drain: commits or reveals exist or phases not ended."
    },
    {
      "code": 6026,
      "name": "cannotDeleteQuestion",
      "msg": "Cannot delete: question still has active or unclaimed participation."
    },
    {
      "code": 6027,
      "name": "rentNotExpired",
      "msg": "Rent has not yet expired."
    },
    {
      "code": 6028,
      "name": "alreadyEligibleOrWinner",
      "msg": "You were already eligible for a reward or were a winner."
    },
    {
      "code": 6029,
      "name": "alreadyDrained",
      "msg": "Vault is already drained."
    },
    {
      "code": 6030,
      "name": "questionTooLong",
      "msg": "The question is too long."
    },
    {
      "code": 6031,
      "name": "rejoinedAfterCommit",
      "msg": "You rejoined after committing. You can't reveal this vote."
    },
    {
      "code": 6032,
      "name": "alreadyJoined",
      "msg": "This address has already joined the network."
    },
    {
      "code": 6033,
      "name": "notInvited",
      "msg": "You are not in the list of pending joiners."
    },
    {
      "code": 6034,
      "name": "invalidInviter",
      "msg": "Invalid invite address."
    },
    {
      "code": 6035,
      "name": "noInviteTokens",
      "msg": "You have no invite tokens remaining."
    },
    {
      "code": 6036,
      "name": "alreadyInvited",
      "msg": "This address has already invited."
    },
    {
      "code": 6037,
      "name": "inviteLimitReached",
      "msg": "Invite limit reached. Please wait for pending invites to be used."
    },
    {
      "code": 6038,
      "name": "actionInProgress",
      "msg": "Another action is already in progress."
    },
    {
      "code": 6039,
      "name": "invalidInvitee",
      "msg": "Invalid invitee address."
    }
  ],
  "types": [
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "truthProviderCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "invite",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "invitee",
            "type": "pubkey"
          },
          {
            "name": "inviter",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "question",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "asker",
            "type": "pubkey"
          },
          {
            "name": "questionKey",
            "type": "pubkey"
          },
          {
            "name": "vaultAddress",
            "type": "pubkey"
          },
          {
            "name": "questionText",
            "type": "string"
          },
          {
            "name": "option1",
            "type": "string"
          },
          {
            "name": "option2",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "commitEndTime",
            "type": "i64"
          },
          {
            "name": "revealEndTime",
            "type": "i64"
          },
          {
            "name": "votesOption1",
            "type": "u64"
          },
          {
            "name": "votesOption2",
            "type": "u64"
          },
          {
            "name": "finalized",
            "type": "bool"
          },
          {
            "name": "committedVoters",
            "type": "u64"
          },
          {
            "name": "revealedVotersCount",
            "type": "u64"
          },
          {
            "name": "eligibleVoters",
            "type": "u64"
          },
          {
            "name": "winningOption",
            "type": "u8"
          },
          {
            "name": "winningPercent",
            "type": "f64"
          },
          {
            "name": "rewardFeeTaken",
            "type": "bool"
          },
          {
            "name": "snapshotReward",
            "type": "u64"
          },
          {
            "name": "originalReward",
            "type": "u64"
          },
          {
            "name": "claimedRemainderCount",
            "type": "u64"
          },
          {
            "name": "snapshotTotalWeight",
            "type": "u64"
          },
          {
            "name": "totalDistributed",
            "type": "u64"
          },
          {
            "name": "claimedVotersCount",
            "type": "u64"
          },
          {
            "name": "claimedWeight",
            "type": "u64"
          },
          {
            "name": "voterRecordsCount",
            "type": "u64"
          },
          {
            "name": "voterRecordsClosed",
            "type": "u64"
          },
          {
            "name": "rewardDrained",
            "type": "bool"
          },
          {
            "name": "actionInProgress",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "questionCounter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asker",
            "type": "pubkey"
          },
          {
            "name": "count",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "reputation",
            "type": "u8"
          },
          {
            "name": "totalEarnings",
            "type": "u64"
          },
          {
            "name": "totalRevealedVotes",
            "type": "u64"
          },
          {
            "name": "totalCorrectVotes",
            "type": "u64"
          },
          {
            "name": "inviteCorrectVotes",
            "type": "u64"
          },
          {
            "name": "inviteTokens",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "An empty account for the vault.",
        "This account will only hold lamports and no other data."
      ],
      "type": {
        "kind": "struct",
        "fields": []
      }
    },
    {
      "name": "voterRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "question",
            "type": "pubkey"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "selectedOption",
            "type": "u8"
          },
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "revealed",
            "type": "bool"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "claimTxId",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "voteWeight",
            "type": "u64"
          },
          {
            "name": "userRecordJoinTime",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
