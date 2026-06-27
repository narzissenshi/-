window.GOMOKU_V3_PRESEARCH = [
  {
    name: "empty-black-center",
    player: 1,
    depth: 7,
    score: 100000000,
    stones: [],
    move: [7, 7, 100000000, 0],
    candidates: [
      [7, 7, 100000000, 0],
      [7, 8, 96, 0],
      [8, 7, 96, 0],
      [8, 8, 90, 0],
      [6, 7, 90, 0],
      [7, 6, 90, 0],
    ],
  },
  {
    name: "white-after-black-center",
    player: 2,
    depth: 5,
    score: 420,
    stones: [[1, 7, 7]],
    move: [7, 8, 420, 0],
    candidates: [
      [7, 8, 420, 0],
      [8, 7, 420, 0],
      [8, 8, 390, 0],
      [6, 8, 360, 0],
      [6, 7, 350, 0],
      [7, 6, 330, 0],
    ],
  },
  {
    name: "black-cross-after-white-adjacent",
    player: 1,
    depth: 5,
    score: 1220,
    stones: [
      [1, 7, 7],
      [2, 7, 8],
    ],
    move: [8, 7, 1220, 0],
    candidates: [
      [8, 7, 1220, 0],
      [6, 8, 1120, 0],
      [8, 8, 930, 0],
      [7, 6, 850, 0],
      [6, 7, 820, 0],
      [9, 7, 610, 0],
    ],
  },
  {
    name: "black-cross-after-white-diagonal",
    player: 1,
    depth: 5,
    score: 1180,
    stones: [
      [1, 7, 7],
      [2, 8, 8],
    ],
    move: [7, 8, 1180, 0],
    candidates: [
      [7, 8, 1180, 0],
      [8, 7, 1180, 0],
      [6, 6, 910, 0],
      [6, 8, 870, 0],
      [8, 6, 870, 0],
      [9, 9, 520, 0],
    ],
  },
  {
    name: "black-center-after-white-one-space",
    player: 1,
    depth: 5,
    score: 980,
    stones: [
      [1, 7, 7],
      [2, 7, 9],
    ],
    move: [7, 8, 980, 0],
    candidates: [
      [7, 8, 980, 0],
      [8, 8, 870, 0],
      [6, 8, 860, 0],
      [8, 7, 750, 0],
      [6, 7, 750, 0],
      [7, 6, 680, 0],
    ],
  },
  {
    name: "white-block-black-open-two",
    player: 2,
    depth: 4,
    score: 760,
    stones: [
      [1, 7, 7],
      [2, 7, 8],
      [1, 8, 7],
    ],
    move: [8, 8, 760, 0],
    candidates: [
      [8, 8, 760, 0],
      [6, 8, 690, 0],
      [8, 6, 680, 0],
      [6, 7, 620, 0],
      [7, 6, 600, 0],
      [9, 7, 420, 0],
    ],
  },
  {
    name: "white-answer-black-hane",
    player: 2,
    depth: 4,
    score: 640,
    stones: [
      [1, 7, 7],
      [2, 8, 8],
      [1, 7, 8],
    ],
    move: [8, 7, 640, 0],
    candidates: [
      [8, 7, 640, 0],
      [6, 8, 580, 0],
      [8, 9, 560, 0],
      [6, 7, 520, 0],
      [7, 6, 510, 0],
      [9, 8, 460, 0],
    ],
  },
  {
    name: "black-after-compact-four-stones",
    player: 1,
    depth: 4,
    score: 1560,
    stones: [
      [1, 7, 7],
      [2, 7, 8],
      [1, 8, 7],
      [2, 8, 8],
    ],
    move: [6, 7, 1560, 2],
    candidates: [
      [6, 7, 1560, 2],
      [7, 6, 1560, 2],
      [8, 6, 1480, 2],
      [6, 8, 1480, 2],
      [9, 7, 880, 0],
      [7, 9, 830, 0],
    ],
  },
];

window.GOMOKU_V3_PRESEARCH_MANIFEST = {
  "format": "packed-v2",
  "buckets": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10
  ],
  "directory": "presearch-books",
  "generatedAt": "2026-06-19T14:20:49.909Z",
  "generator": "heuristic-rank-v2",
  "engine": "v4-source-guard",
  "generatedEntries": 140001,
  "exactEntries": 259,
  "exactAttempts": 512,
  "generatedBytes": 31592517,
  "maxBucketBytes": 6911796,
  "maxPly": 10,
  "targetEntries": 140000,
  "analysisMode": "exact",
  "configHash": "h19pugow",
  "exactConfigHashes": [
    "hgucx2q"
  ],
  "ruleHash": "hl9di",
  "bucketBytes": [
    293,
    367,
    1045,
    12101,
    142979,
    1488637,
    4179477,
    5831877,
    6343508,
    6680437,
    6911796
  ],
  "bucketEntries": [
    {
      "bucket": 0,
      "entries": 1
    },
    {
      "bucket": 1,
      "entries": 1
    },
    {
      "bucket": 2,
      "entries": 5
    },
    {
      "bucket": 3,
      "entries": 70
    },
    {
      "bucket": 4,
      "entries": 776
    },
    {
      "bucket": 5,
      "entries": 7524
    },
    {
      "bucket": 6,
      "entries": 20142
    },
    {
      "bucket": 7,
      "entries": 26779
    },
    {
      "bucket": 8,
      "entries": 28086
    },
    {
      "bucket": 9,
      "entries": 28296
    },
    {
      "bucket": 10,
      "entries": 28321
    }
  ]
};
