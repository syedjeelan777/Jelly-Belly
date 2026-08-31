/**
 * Level catalogue — 60 handcrafted levels across 6 worlds.
 * Levels are plain data; the engine reads them through buildState().
 * Validated at build time by scripts/verify-levels.ts (shape + solvability BFS).
 */
import type { LevelData, LevelIndex, WorldMeta } from '../engine/types';

export const WORLDS: WorldMeta[] = [
  { id: 1, name: 'First Squish', tagline: 'Move, push and find the exit.', accent: '#7fd4ff', icon: '🌱', intro: 'Every adventure starts with one small squish. Learn the ropes!' },
  { id: 2, name: 'Sticky Business', tagline: 'New jellies, sticky pulls and shared journeys.', accent: '#ff7b9c', icon: '🍓', intro: 'Things are getting clingy. Sticky jellies follow your every step!' },
  { id: 3, name: 'Bounce & Bend', tagline: 'Bouncy hops, elastic tethers, slippery slides.', accent: '#ffd166', icon: '🍋', intro: 'The jellies are getting springy. Bounce, stretch and slide!' },
  { id: 4, name: 'Jelly Machines', tagline: 'Doors, switches, plates, lasers and magnets.', accent: '#ff9de2', icon: '⚙️', intro: 'Time to make these jellies work. Chains, doors and machines await!' },
  { id: 5, name: 'Hazard Alley', tagline: 'Fire, spikes, lasers, crushers and deep water.', accent: '#ff6b57', icon: '🔥', intro: 'Careful now! This place bites back. Watch the lasers!' },
  { id: 6, name: 'The Squishverse', tagline: 'Everything combined. Prove your mastery.', accent: '#b9a7ff', icon: '💎', intro: 'The final gauntlet. Use every sticky trick you know!' },
];

const L = (
  id: string, world: number, index: number, name: string,
  map: string[], mechanics: string[], par: number, opts: Partial<LevelData> = {},
): LevelData => {
  const data: LevelData = { id, world, index, name, map, mechanics, par, ...opts };
  data.par = data.par ?? par;
  return data;
};

/* ------------------------------ WORLD 1 — LEARNING ------------------------------ */

const w1: LevelData[] = [
  L('w1-01', 1, 1, 'First Steps', [
    '#########',
    '#.......#',
    '#.P.....#',
    '#.......#',
    '#......G#',
    '#.......#',
    '#.......#',
    '#########',
  ], ['movement'], 9, { tip: 'Use WASD or the arrow keys to move. Touch players can use the D-pad!' }),

  L('w1-02', 1, 2, 'Round the Bend', [
    '###########',
    '#.........#',
    '#.P.......#',
    '#....#....#',
    '#....#....#',
    '#....#....#',
    '########G##',
  ], ['movement'], 12, { tip: 'Walls are solid. Find the way around!' }),

  L('w1-03', 1, 3, 'Little Push', [
    '###########',
    '#.........#',
    '#.P..J...G#',
    '#.........#',
    '###########',
  ], ['push'], 11, { tip: 'Walk into the jelly to push it. Push it out of the way!' }),

  L('w1-04', 1, 4, 'Jelly Taxi', [
    '###########',
    '#.........#',
    '#.P...J...#',
    '#.........#',
    '#.......g.#',
    '#.........#',
    '###########',
  ], ['push', 'goal'], 13, { tip: 'That glowing pad is a jelly goal. Push the jelly onto it!' }),

  L('w1-05', 1, 5, 'Exit Strategy', [
    '#############',
    '#....P......#',
    '#....J......#',
    '#....J......#',
    '#....J......#',
    '#...........G',
    '#############',
  ], ['push'], 16, { tip: 'Push the jelly line to the right — or squeeze around them.' }),

  L('w1-06', 1, 6, 'Two of a Kind', [
    '############',
    '#.P........#',
    '#..J..J....#',
    '#..........#',
    '#...g..g...#',
    '#..........#',
    '############',
  ], ['push', 'goal'], 17, { tip: 'Two jellies, two pads. Plan your pushes!' }),

  L('w1-07', 1, 7, 'The Corner', [
    '###########',
    '#.......P.#',
    '#..J......#',
    '#.........#',
    '#.....g#..#',
    '#.........#',
    '###########',
  ], ['push', 'goal'], 15, { tip: 'Use walls and corners to steer the jelly the way you want.' }),

  L('w1-08', 1, 8, 'Squeeze Play', [
    '#############',
    '#...........#',
    '#.J.....J...#',
    '#....#......#',
    '#.P....#....#',
    '#.....#....G#',
    '#...........#',
    '#############',
  ], ['push', 'goal'], 18, { tip: 'Mind the gaps! Some pushes work better from one side.' }),

  L('w1-09', 1, 9, 'The Long Way', [
    '##############',
    '#............#',
    '#.J..........#',
    '#...........G#',
    '#....#....#..#',
    '#.P..#....#..#',
    '#....#....#..#',
    '##############',
  ], ['push', 'navigation'], 20, { tip: 'You do not have to go straight. Explore!' }),

  L('w1-10', 1, 10, 'First Faucet', [
    '###########',
    '#.........#',
    '#.J...P...#',
    '#.........#',
    '#.........#',
    '#..g......#',
    '#.........#',
    '###########',
  ], ['push', 'goal', 'review'], 16, { tip: 'Everything you learned, in one room. Good luck!' }),
];

/* ------------------------------ WORLD 2 — STICKINESS ------------------------------ */

const w2: LevelData[] = [
  L('w2-01', 2, 1, 'Clingy', [
    '###########',
    '#.........#',
    '#.P..K....#',
    '#.........#',
    '#.......G.#',
    '#.........#',
    '###########',
  ], ['sticky'], 10, { tip: 'Sticky jellies follow you when you walk away. Pull it along!' }),

  L('w2-02', 2, 2, 'Sticky Chain', [
    '############',
    '#.P..K...G.#',
    '#..........#',
    '#..........#',
    '############',
  ], ['sticky'], 10, { tip: 'A sticky follower always lands exactly where you stood.' }),

  L('w2-03', 2, 3, 'Detour Duty', [
    '#############',
    '#.P.........#',
    '#..K........#',
    '#..........##',
    '#.G..#.K....#',
    '#....#.....g#',
    '#..........##',
    '#############',
  ], ['sticky', 'goal'], 27, { tip: 'Some jellies belong on pads. Walk in a loop and pull them into place.' }),

  L('w2-04', 2, 4, 'Sticky Service', [
    '###########',
    '#.P....K..#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.K......g#',
    '#......G..#',
    '###########',
  ], ['sticky', 'goal'], 26, { tip: 'Grab the first sticky, drop it on the pad, then fetch the second.' }),

  L('w2-05', 2, 5, 'Two Sticks', [
    '############',
    '#.P........#',
    '#.K..K.....#',
    '#..........#',
    '#..g..g....#',
    '#..........#',
    '############',
  ], ['sticky', 'goal'], 25, { tip: 'Pull one jelly at a time. Order matters!' }),

  L('w2-06', 2, 6, 'Snake Alley', [
    '##############',
    '#............#',
    '#.P..#..K....#',
    '#....#.......#',
    '#....#...G...#',
    '#....#.......#',
    '#.K..#.......#',
    '#....#.......#',
    '##############',
  ], ['sticky'], 26, { tip: 'Long sticky friends make long walks. Keep them coming!' }),

  L('w2-07', 2, 7, 'First Plate', [
    '##########',
    '#........#',
    '#.P..K...#',
    '#....O..D#',
    '#.K......#',
    '#........#',
    '#......G.#',
    '##########',
  ], ['plate', 'door', 'sticky'], 20, { tip: 'A jelly parked on a plate holds a door open. Any jelly works!' }),

  L('w2-08', 2, 8, 'Conveyor of Cling', [
    '##############',
    '#.P..........#',
    '#...........G#',
    '#.K..........#',
    '#..K....K....#',
    '#............#',
    '#..g........G#',
    '#............#',
    '##############',
  ], ['sticky', 'goal'], 34, { tip: 'Pull the jellies in sequence. Do not lose track of them!' }),

  L('w2-09', 2, 9, 'Sticky Maze', [
    '##############',
    '#............#',
    '#.P..#..K....#',
    '#....#.......#',
    '#..#.........#',
    '#..#..g....K.#',
    '#..#....#....#',
    '#..#....#..G.#',
    '#..#.........#',
    '##############',
  ], ['sticky', 'goal'], 30, { tip: 'Mazes are easier with a pocket jelly. Use its reach!' }),

  L('w2-10', 2, 10, 'Cling Together', [
    '###############',
    '#.............#',
    '#.P..K..K.....#',
    '#.............#',
    '#...g....g..G.#',
    '#.............#',
    '#.............#',
    '###############',
  ], ['sticky', 'goal'], 30, { tip: 'Two sticks, two pads, one hero. Step by step!' }),
];

/* ------------------------------ WORLD 3 — DEFORMATION ------------------------------ */

const w3: LevelData[] = [
  L('w3-01', 3, 1, 'Boing!', [
    '###########',
    '#.........#',
    '#.P..B...G#',
    '#.........#',
    '###########',
  ], ['bouncy'], 11, { tip: 'Bouncy jellies hop two cells when pushed. Give them room!' }),

  L('w3-02', 3, 2, 'Bounce Route', [
    '##############',
    '#............#',
    '#.P..B.......#',
    '#....#.....#G#',
    '#....#..#B...#',
    '#....#.......#',
    '##############',
  ], ['bouncy'], 16, { tip: 'A bouncy can clear a wall if it has a free landing spot.' }),

  L('w3-03', 3, 3, 'Elastic Tether', [
    '###########',
    '#.........#',
    '#.P..E...G#',
    '#.........#',
    '###########',
  ], ['elastic'], 11, { tip: 'Elastic jellies stretch when you pull them — but not through walls!' }),

  L('w3-04', 3, 4, 'Tether Check', [
    '##############',
    '#.P..E..#....#',
    '#.....#..#...G',
    '#.....#..#...#',
    '#.........E..#',
    '#.....#..#...#',
    '##############',
  ], ['elastic'], 22, { tip: 'An elastic tether blocks you when it can not follow. Walk toward it to slacken!' }),

  L('w3-05', 3, 5, 'Slippery When Wet', [
    '############',
    '#.P..L....G#',
    '#..W.W.W...#',
    '#..........#',
    '############',
  ], ['slippery'], 12, { tip: 'Slippery jellies slide — and they slide very far. Control the stop point!' }),

  L('w3-06', 3, 6, 'Ice Slide Puzzle', [
    '############',
    '#..........#',
    '#.P.....L..#',
    '#..W..W..W.#',
    '#..........#',
    '#.......g..#',
    '#.......#..#',
    '#.........G#',
    '############',
  ], ['slippery', 'goal'], 18, { tip: 'The slide stops early if something blocks it. Wedge the slippery in place!' }),

  L('w3-07', 3, 7, 'Bouncy Bridge', [
    '#############',
    '#.P.B.......#',
    '#....B..g...#',
    '#..........G#',
    '#...........#',
    '#############',
  ], ['bouncy', 'goal'], 14, { tip: 'One hop lands on the pad — if you push from the right spot!' }),

  L('w3-08', 3, 8, 'Squish Factory', [
    '################',
    '#..............#',
    '#.P.J..J..J...G#',
    '#..H...........#',
    '#..............#',
    '#..H...........#',
    '#..............#',
    '################',
  ], ['heavy'], 18, { tip: 'Heavy jellies are steady and never burn. Work around them!' }),

  L('w3-09', 3, 9, 'Heavy Lifting', [
    '#############',
    '#.P.........#',
    '#..H....O..D#',
    '#.........#G#',
    '#..........##',
    '#############',
  ], ['heavy', 'plate', 'door'], 15, { tip: 'Park the heavy jelly on the plate to hold the door open.' }),

  L('w3-10', 3, 10, 'The Gauntlet', [
    '###############',
    '#.............#',
    '#.P..#.E......#',
    '#....#...#G...#',
    '#.L..#...#....#',
    '#....#...#....#',
    '#.B..#...#....#',
    '#....#...#....#',
    '###############',
  ], ['elastic', 'bouncy', 'slippery'], 26, { tip: 'Three friends, one exit. Stretch, hop and slide!' }),
];

/* ------------------------------ WORLD 4 — MACHINES ------------------------------ */

const w4: LevelData[] = [
  L('w4-01', 4, 1, 'First Door', [
    '#############',
    '#.P........O#',
    '#......#...D#',
    '#......#....#',
    '#......#...G#',
    '#......#....#',
    '#############',
  ], ['plate', 'door'], 14, { tip: 'Stand on the plate — the door opens while you stand. Move fast!' }),

  L('w4-02', 4, 2, 'Hold the Door', [
    '#############',
    '#.P.........#',
    '#..........D#',
    '#.J.........#',
    '#.O........G#',
    '#...........#',
    '#############',
  ], ['plate', 'door'], 16, { tip: 'A jelly can hold a plate for you. Park it and run through!' }),

  L('w4-03', 4, 3, 'Toggle Switch', [
    '###########',
    '#.P..T#..G#',
    '#......D..#',
    '#......#..#',
    '#......#..#',
    '###########',
  ], ['toggle'], 12, { tip: 'Stepping on a toggle flips it. Toggled doors stay open until you touch the switch again.' }),

  L('w4-04', 4, 4, 'Two Doors', [
    '#############',
    '#.P.JO.D..T.#',
    '#...........D',
    '#...........G',
    '#############',
  ], ['plate', 'toggle'], 18, { tip: 'One door is held by a plate, the other by a toggle. Solve both!' }),

  L('w4-05', 4, 5, 'Crusher Crossing', [
    '##############',
    '#............#',
    '#............#',
    '#.P.........G#',
    '#............#',
    '#............#',
    '##############',
  ], ['crusher'], 12, {
    tip: 'Crushers move on a rhythm. Time your crossing!',
    objects: [{ type: 'crusher', x: 4, y: 1, axis: 'v', cells: 4, period: 4.8, phase: 0 }],
  }),

  L('w4-06', 4, 6, 'Maglev', [
    '############',
    '#.X........#',
    '#..........#',
    '#.P..M..J..#',
    '#..........#',
    '#.g......X.#',
    '#..........#',
    '############',
  ], ['magnet', 'goal'], 22, {
    tip: 'Magnets pin magnetic jellies inside their field. Route the normal jelly instead!',
    objects: [
      { type: 'magnet', x: 2, y: 1, cells: 4, id: 'm1' },
      { type: 'magnet', x: 10, y: 5, cells: 4, id: 'm2' },
    ],
  }),

  L('w4-07', 4, 7, 'Laser Gate', [
    '###########',
    '#.P.......#',
    '#....#....#',
    '#....Z....#',
    '#....#....#',
    '#........G#',
    '###########',
  ], ['laser'], 13, { tip: 'Lasers pulse on a cycle. Move through when they are off!' }),

  L('w4-08', 4, 8, 'Machine Room', [
    '################',
    '#.P....O....D..#',
    '#..J.......J...#',
    '#....Z....#....#',
    '#....#....#..g.#',
    '#.D..#....#....#',
    '#....#....#..G.#',
    '#.T..#....#....#',
    '################',
  ], ['laser', 'door', 'plate', 'toggle', 'goal'], 36, { tip: 'A full machine room. Open both gates and fill every pad!' }),

  L('w4-09', 4, 9, 'Heavy Traffic', [
    '##############',
    '#.P..H....O.D#',
    '#..........#G#',
    '#..H....H....#',
    '#..........#.#',
    '#..O....D....#',
    '#..........#.#',
    '##############',
  ], ['heavy', 'plate', 'door'], 30, { tip: 'Some plates only need weight. Heavy jellies are perfect plate weights!' }),

  L('w4-10', 4, 10, 'The Machine Gauntlet', [
    '##############',
    '#.P..........#',
    '#.J.O...T....#',
    '#...D...D..Z.#',
    '#..........G.#',
    '#....#....#..#',
    '#....#..H.#..#',
    '#....#....#..#',
    '##############',
  ], ['machine', 'review'], 34, { tip: 'Everything mechanical, one arena. Take your time!' }),

];

/* ------------------------------ WORLD 5 — HAZARDS ------------------------------ */

const w5: LevelData[] = [
  L('w5-01', 5, 1, "Don't Burn", [
    '###########',
    '#.P...F..G#',
    '#.........#',
    '###########',
  ], ['fire'], 11, { tip: 'Fire destroys jellies and singes heroes. Walk around it!' }),

  L('w5-02', 5, 2, 'Firefighter Jelly', [
    '############',
    '#.P..H....G#',
    '#..F...F...#',
    '#..........#',
    '#..........#',
    '############',
  ], ['fire', 'heavy'], 14, { tip: 'Heavy jellies are fireproof. They are steady, and they never burn!' }),

  L('w5-03', 5, 3, 'Spike Lane', [
    '##############',
    '#.P..........#',
    '#..^..^..^...#',
    '#...........G#',
    '#....#...#...#',
    '##############',
  ], ['spikes'], 15, { tip: 'Spikes are sharp. Use the gaps!' }),

  L('w5-04', 5, 4, 'Laser Dance', [
    '#############',
    '#.P..Z...Z..G',
    '#...........#',
    '#..Z....Z...#',
    '#..........##',
    '#...........#',
    '#############',
  ], ['laser'], 14, { tip: 'Lasers pulse on a shared rhythm. Watch the cycle and weave!' }),

  L('w5-05', 5, 5, 'Deep Water', [
    '##############',
    '#.P..........#',
    '#WLg#........#',
    '#...........W#',
    '#............#',
    '#.........G..#',
    '##############',
  ], ['water'], 18, { tip: 'Water makes pushes slippery. Wet jellies slide further!' }),

  L('w5-06', 5, 6, 'Crusher Gauntlet', [
    '###############',
    '#.P...........#',
    '#...........G.#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############',
  ], ['crusher'], 13, {
    tip: 'Crushers crush anything they hit. Wait for the gap!',
    objects: [{ type: 'crusher', x: 4, y: 1, axis: 'v', cells: 4, period: 6, phase: 0 }],
  }),

  L('w5-07', 5, 7, 'Fire and Gold', [
    '############',
    '#.P........#',
    '#..F..F....#',
    '#....J.....#',
    '#......g...#',
    '#..........#',
    '############',
  ], ['fire', 'goal'], 22, { tip: 'Push the jelly around the fire pit — carefully!' }),

  L('w5-08', 5, 8, 'Timing Trap', [
    '##############',
    '#.P....T#...DG',
    '#....Z.......#',
    '#..Z.....Z...#',
    '#............#',
    '##############',
  ], ['laser', 'toggle'], 18, { tip: 'Toggle the gate, then time the beams. Flip once, walk safe!' }),

  L('w5-09', 5, 9, 'Hazard Mix', [
    '##############',
    '#.P..........#',
    '#.F..J...^...G',
    '#......W.....#',
    '#..^....Z....#',
    '#............#',
    '#......g.....#',
    '##############',
  ], ['hazard', 'goal'], 34, { tip: 'Every hazard in one pit. Stay frosty!' }),

  L('w5-10', 5, 10, 'The Fire Maze', [
    '##############',
    '#.P..........#',
    '#.F..F.......#',
    '#....J.......#',
    '#....#...g..G#',
    '#....#.......#',
    '#.F..#...F...#',
    '#........^...#',
    '##############',
  ], ['hazard', 'maze'], 38, { tip: 'The maze of fire. Steady hands and a very careful push!' }),
];

/* ------------------------------ WORLD 6 — ADVANCED ------------------------------ */

const w6: LevelData[] = [
  L('w6-01', 6, 1, 'The Grand Training', [
    '################',
    '#.P..K..J......#',
    '#....g....g....#',
    '#..E...........#',
    '#....D....O....#',
    '#.B....G.......#',
    '#..............#',
    '################',
  ], ['all'], 40, { tip: 'Use every jelly you know. Fill the pads, then dash to the exit!' }),

  L('w6-02', 6, 2, 'Magnet Maze', [
    '############',
    '#..X.......#',
    '#..X...M...#',
    '#.P....J...#',
    '#.....g....#',
    '#..X.......#',
    '#..X.......#',
    '############',
  ], ['magnet', 'goal'], 24, {
    tip: 'Magnet fields pin magnetic jellies. Route the normal jelly around!',
    objects: [
      { type: 'magnet', x: 3, y: 1, cells: 4, id: 'm1' },
      { type: 'magnet', x: 3, y: 6, cells: 3, id: 'm2' },
    ],
  }),

  L('w6-03', 6, 3, 'Switchboard', [
    '###############',
    '#.P...T..J....#',
    '#....D....D...#',
    '#.W...W...W...#',
    '#....T....O...#',
    '#...........G.#',
    '#....J........#',
    '###############',
  ], ['toggle', 'water'], 36, { tip: 'Chain the switches, soak the slides, reach the exit!' }),

  L('w6-04', 6, 4, 'The Sticky Gauntlet', [
    '################',
    '#.P..K..K..K...#',
    '#.......#......#',
    '#..D...#..Z....#',
    '#......#.......#',
    '#......#..g....#',
    '#......#.......#',
    '#......#...G...#',
    '################',
  ], ['sticky', 'laser', 'goal'], 46, { tip: 'Three sticky friends, one laser, one pad. Stick together!' }),

  L('w6-05', 6, 5, 'Bounce Room', [
    '############',
    '#.P..B....G#',
    '#....#.....#',
    '#..B.......#',
    '#....#.....#',
    '#..B.......#',
    '#....#.....#',
    '############',
  ], ['bouncy'], 28, { tip: 'Hop, hop, hop. Bouncy jellies love open rooms!' }),

  L('w6-06', 6, 6, 'Machine Mayhem', [
    '###############',
    '#.P...O....D..#',
    '#.J.........#G#',
    '#...Z...Z...#.#',
    '#...D...T.....#',
    '#....J....g...#',
    '#.....#.......#',
    '#.....#..H....#',
    '###############',
  ], ['machine', 'hazard'], 42, { tip: 'Machines and hazards, working together. Nice.' }),

  L('w6-07', 6, 7, 'The Slippery Slope', [
    '##############',
    '#.P.....g....#',
    '#.W.W.W.W.W..#',
    '#.......L....#',
    '#.W.W.W.W.W..#',
    '#............#',
    '#............#',
    '#.........G..#',
    '##############',
  ], ['slippery', 'water', 'goal'], 32, { tip: 'Slides can be a tool if you plan the wedge points.' }),

  L('w6-08', 6, 8, 'Twin Gates', [
    '##############',
    '#.P....O.....#',
    '#.....D......#',
    '#.J....T.....#',
    '#.....D......#',
    '#.....G......#',
    '#....J.......#',
    '##############',
  ], ['plate', 'toggle', 'goal'], 30, { tip: 'Two gates need two keys: weight and a switch. Do not mix them up!' }),

  L('w6-09', 6, 9, 'The Long Haul', [
    '################',
    '#.P...K....J...#',
    '#....#....#....#',
    '#.O..#.Z..#..g.#',
    '#....#....#....#',
    '#.D..#....#..D.#',
    '#....#.E..#....#',
    '#.........G....#',
    '#....^.....^...#',
    '################',
  ], ['mastery'], 54, { tip: 'The final puzzle room. Every skill counts!' }),

  L('w6-10', 6, 10, 'STICKYVERSE', [
    '################',
    '#.P....K....H..#',
    '#....#....#....#',
    '#.D..#.Z..#..O.#',
    '#....#....#....#',
    '#.T..#........D#',
    '#.W..#.g....#..#',
    '#.W..#.....#.G.#',
    '#.W..#.B....#..#',
    '#.W......J.....#',
    '################',
  ], ['finale'], 62, { tip: 'Welcome to the heart of the STICKYVERSE. Show them how it is done!' }),
];

export function getAllLevels(): LevelData[] {
  return [...w1, ...w2, ...w3, ...w4, ...w5, ...w6];
}

export const LEVELS: LevelData[] = getAllLevels();

export function getLevelById(id: string): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getLevel(world: number, index: number): LevelData | undefined {
  return LEVELS.find((l) => l.world === world && l.index === index);
}

export function getNextLevel(level: LevelData): LevelData | undefined {
  return getLevel(level.world, level.index + 1) ?? getLevel(level.world + 1, 1);
}

export function levelsForWorld(world: number): LevelData[] {
  return LEVELS.filter((l) => l.world === world);
}

export function buildLevelIndexes(): LevelIndex[] {
  return LEVELS.map((l) => ({ id: l.id, world: l.world, index: l.index, name: l.name, par: l.par, mechanics: l.mechanics }));
}

export function totalLevelCount(): number {
  return LEVELS.length;
}

/** Tile legend used by the HUD hint bar and editor palette. */
export const TILE_LEGEND: Record<string, { name: string; ch: string; color: string }> = {
  '#': { name: 'Wall', ch: '#', color: '#6b6394' },
  '.': { name: 'Empty', ch: '.', color: '#3a2f56' },
  P: { name: 'Player start', ch: 'P', color: '#ffd166' },
  G: { name: 'Exit', ch: 'G', color: '#7dffb2' },
  g: { name: 'Jelly pad', ch: 'g', color: '#7dffb2' },
  W: { name: 'Water', ch: 'W', color: '#4fc3f7' },
  F: { name: 'Fire', ch: 'F', color: '#ff6b57' },
  '^': { name: 'Spikes', ch: '^', color: '#b0bec5' },
  Z: { name: 'Laser emitter', ch: 'Z', color: '#ff5252' },
  D: { name: 'Door', ch: 'D', color: '#b9a7ff' },
  O: { name: 'Pressure plate', ch: 'O', color: '#ffd166' },
  T: { name: 'Toggle switch', ch: 'T', color: '#ff9de2' },
  X: { name: 'Magnet', ch: 'X', color: '#ff9de2' },
  J: { name: 'Jelly', ch: 'J', color: '#7fd4ff' },
  K: { name: 'Sticky jelly', ch: 'K', color: '#ff7b9c' },
  B: { name: 'Bouncy jelly', ch: 'B', color: '#ffd166' },
  H: { name: 'Heavy jelly', ch: 'H', color: '#b9a7ff' },
  E: { name: 'Elastic jelly', ch: 'E', color: '#7dffb2' },
  L: { name: 'Slippery jelly', ch: 'L', color: '#b0e7ff' },
  M: { name: 'Magnetic jelly', ch: 'M', color: '#ff9de2' },
};
