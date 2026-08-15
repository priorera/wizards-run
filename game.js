const canvas = document.getElementById("gameCanvas"); 
const ctx = canvas.getContext("2d"); 

// ==========================================
// 1. GAME STATE, COOKIES, & UI VARIABLES
// ==========================================
function setCookie(name, value, days) {
    localStorage.setItem(name, value);
}

function getCookie(name) {
    return localStorage.getItem(name);
}

let gameState = "MENU"; 
let gameMode = "campaign"; 
let endlessHighScore = parseInt(getCookie("wizardEndlessHighScore")) || 0;
let endlessEnemiesDefeated = 0;
let endlessEnemiesHighScore = parseInt(getCookie("wizardEndlessEnemiesHighScoreRecord")) || 0;
let bossesDefeated = 0;
let endlessBossesSpawned = 0;
let returnToPause = false;
let previousGameState = "PLAYING";

// Campaign Map Variables
let completedLevels = [];
let currentMapNode = "Wizard Training";
let mapKeysReleased = { left: true, right: true, up: true, down: true };
let currentBackground = null;

// ==========================================
// ASCII TILE DICTIONARY
// ==========================================
const TILE_MAP = {
    'W': { type: "spawn" },
    'G': { type: "goblin" },
    '$': { type: "shaman" },
    'R': { type: "rockThrower" },
    'S': { type: "platform", texture: "stone", gridW: 1, gridH: 1 },
    'E': { type: "platform", texture: "stone", gridW: 1, gridH: 1, isElevator: true },
	'Q': { type: "platform", texture: "sand", gridW: 1, gridH: 1 },
    'q': { type: "platform", texture: "sand", gridW: 1, gridH: 1, isElevator: true },
	'I': { type: "platform", texture: "ice", gridW: 1, gridH: 1 },
    'i': { type: "platform", texture: "ice", gridW: 1, gridH: 1, isElevator: true },
	'K': { type: "platform", texture: "grass", gridW: 1, gridH: 1 },
    'k': { type: "platform", texture: "grass", gridW: 1, gridH: 1, isElevator: true },
    'P': { type: "goal", gridW: 1, gridH: 2 },
    'O': { type: "orcBoss" },
    'j': { type: "powerup", powerupType: "jump" },
    'f': { type: "powerup", powerupType: "fire" },
    's': { type: "powerup", powerupType: "shield" },
    'h': { type: "powerup", powerupType: "health" },
    'r': { type: "powerup", powerupType: "deathray" },
    '^': { type: "spikes" },
    'D': { type: "disappearingPlatform", texture: "disappearing", gridW: 1, gridH: 1 },
    'd': { type: "disappearingPlatform", texture: "disappearing", gridW: 1, gridH: 1, isElevator: true },
    'b': { type: "powerup", powerupType: "boots" },
    't': { type: "powerup", powerupType: "freeze" },
    'a': { type: "powerup", powerupType: "familiar" },
    'm': { type: "powerup", powerupType: "magnet" },
    '*': { type: "powerup", powerupType: "stardust" },
    '!': { type: "powerup", powerupType: "shatter" },
    'N': { type: "necromancer" },
    'Z': { type: "shielded" }
};

// ==========================================
// LEVEL PARSER
// ==========================================
function parseLevelGrid(stringArray, bgImage) {
    let levelData = [];
    
    // Loop through the rows (y) and columns (x) of the text
    for (let y = 0; y < stringArray.length; y++) {
        for (let x = 0; x < stringArray[y].length; x++) {
            let char = stringArray[y][x];
            
            // Ignore empty space
            if (char === '.' || char === ' ') continue; 
            
            let asset = TILE_MAP[char];
            if (asset) {
                // Clone the object, attach its X and Y grid coordinates, and save it
                let assetClone = { ...asset, gridX: x, gridY: y };
                levelData.push(assetClone);
            }
        }
    }
    // Return the formatted data and the background image
    return { assets: levelData, bgImage: bgImage };
}

// ==========================================
// ASCII LEVEL DESIGNS
// ==========================================

// A base template for the levels you haven't built yet
const baseLevelTemplate = [
    "..................................................................................................................................................................................................................SSSSSSSSSS",
    "..................................................................................................................................................................................................................SSSSSSSSSS",
    "..................................................................................................................................................................................................................SSSSSSSSSS",
    "..................................................................................................................................................................................................................SSSSSSSSSS",
    "..................................................................................................................................................................................................................SSSSSSSSSS",
    "..................................................................................................................................................................................................................SSSSSSSSSS",
    ".............................................................................................................................................................................................................P....SSSSSSSSSS",
    "..W...............................................................................................................................................................................................................SSSSSSSSSS",
    "............................................................................................................................................................................................................SSS...SSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS"
];

// Helper function to dynamically change tiles in a template
function modifyTile(gridArray, x, y, newChar) {
    let newGrid = [...gridArray];
    let row = newGrid[y].split('');
    row[x] = newChar;
    newGrid[y] = row.join('');
    return newGrid;
}

// Automatically generates your dummy levels with the Goal moved to the end
function createPlaceholderLevel() {
    let lvl = modifyTile(baseLevelTemplate, 7, 7, '.'); // Remove base Goal
    lvl = modifyTile(lvl, 87, 6, 'P');                  // Move goal to end platform
    lvl = modifyTile(lvl, 86, 8, 'S');
    lvl = modifyTile(lvl, 87, 8, 'S');
    lvl = modifyTile(lvl, 88, 8, 'S');
    return lvl;
}

const wizardTrainingGrid = [
    "........................................................................................................................................................................................................SSSSSSSSSS",
    "........................................................................................................................................................................................................SSSSSSSSSS",
    "................................................................................G.G...........................j.............................................................................SSS.........SSSSSSSSSS",
    "......................S.........................................................SSSSSSSS...SSSS...............S...........SSS....SSSS......................................................SSSS.........SSSSSSSSSS",
    "..........................................................................................................................................................................................SSSSS.........SSSSSSSSSS",
    ".....................s..........................................h.............s...............h.......*...................................S..S..........SS..S............................SSSSSS.........SSSSSSSSSS",
    "................S...SSSSS.............SS......SS.........SS..................SSS..............S......SS....S..S..S.....S..........SS.....SS..SS........SSS..SS...........SSSS...........SSSSSSS....P....SSSSSSSSSS",
    "..W.........................SS........SS......SS.........SS.............................................................................SSS..SSS......SSSS..SSS.....SS..............SS.SSSSSSSS.........SSSSSSSSSS",
    "......................G.....SS........SSG.....SS...G.G...SS......................................G..G.......G......G.G.......G.G.G.G...SSSS..SSSS....SSSSS..SSSS....SS.........G.G..SSSSSSSSSSS...SSS...SSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SSSSSSSSSSSSSSS...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SSSSSSSSSSSSSSS...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS"
];

const theLightHouseGrid = [
    ".....................................................................................................................................................KKKKKKKKKK",
    ".....................................................................................................................................................KKKKKKKKKK",
    "..............................G.........KKKKKKK.............KKKK..........................................................................KK.........KKKKKKKKKK",
    "..........................KKKKK........................kkk................................................................................KK.........KKKKKKKKKK",
    ".........................................................................KKKKKK...........................G.............................KKKK.........KKKKKKKKKK",
    "...................................KKKKK...........................................kkk..............KKKKKKKK...................kkk......KKKK.........KKKKKKKKKK",
    "........................KKKKKKKK......................................KKK.................kkk...................KKKK..KKKK............KKKKKK....P....KKKKKKKKKK",
    "..W........................................................s..........................................................................KKKKKK.........KKKKKKKKKK",
    "..................KKKK..........KKK...........................................................KKKK............R..................G....KKKKKK...KKK...KKKKKKKKKK",
    "KKKKKKKKKKKKKKKK..................................KKKK.....KKKKK.KKKKK.......................................KKK.............KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKK.............................................................................................................KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK"
];

const theDesertPathwayGrid = [
    "........................................................................................................................................................................................................QQQQQQQQQQ",
    "............................h...........................................................................................................................................................................QQQQQQQQQQ",
    "............................QQQQ.......................j...........................b........................................s................................................................QQ.........QQQQQQQQQQ",
    ".....................................................QQQQQ...........QQQQ........QQQQQ......QQQQ............................QQQQ...........................................s.................QQ.........QQQQQQQQQQ",
    "........................Q..........................................................................................................................................QQQQQ...Q.............Q...QQ.........QQQQQQQQQQ",
    ".......................QQ.........Q....................s.G.......................................................................QQ..........................................................QQ.........QQQQQQQQQQ",
    "......................QQQ.........Q...........QQ.....QQQQQ..........Q.....QQ...QQQQ..QQQ..............QQ.................QQ......QQ......................Q......Q........Q.....QQ.......QQ...QQ....P....QQQQQQQQQQ",
    "..W............QQQ...QQQQ........QQQ..........QQ..........................QQ..........................QQ...........G.....QQ..QQ..QQ......................Q.....................QQ............QQ.........QQQQQQQQQQ",
    "...................GQQQQQ.......GQQQ......G.G.QQ...........G.G....G.G.G.G.QQ...........G.G.G.........GQQ.........GQQ...G.QQ..QQ..QQ.....G.............R..Q.......G.G....R.R....QQ.......G..R.QQ...QQQ...QQQQQQQQQQ",
    "QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ....QQQQQQQQQ...QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ...QQQQQQQQQQ..QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ",
    "QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ....QQQQQQQQQ...QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ...QQQQQQQQQQ..QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ"
];

const thePyramidGrid = [
    ".........................................................................................................................................................................................................QQQQQQQQQQ",
    ".........................................................................................................................................................................................................QQQQQQQQQQ",
    "..................................s.........................................................................................$.................................................................G..........QQQQQQQQQQ",
    ".............................QQQQQQ...................................................................................QQQQQQQQ...............................................................QQQ.........QQQQQQQQQQ",
    ".....................................................................................QQQ.................................................................QQQQQ..............QQQQ...........Q.QQQ.........QQQQQQQQQQ",
    ".................$..............................R...................QQQ..........$......................................$.................................................................QQ.QQQ.........QQQQQQQQQQ",
    "..............QQQQQ..........QQQQQQ...........QQQ......QQ.......QQ..QQQ.......QQQQQ......QQQ..........................QQQQQQQQ................s....QQQ..................s...............Q.QQ.QQQ....P....QQQQQQQQQQ",
    "..W..........QQQ.............................QQQQQ.....QQ......QQQ..QQQ............................................QQ............Q...........QQ.........................Q....QQ........QQ.QQ.QQQ.........QQQQQQQQQQ",
    "............QQQQ.......G................Z...QQQQQQ.....QQ.....QQQQ..QQQ..................................G.$.......QQ............Q......GGG................GG......G..G......QQ.......QQQ.QQ.QQQ...QQQ...QQQQQQQQQQ",
    "QQQQQQQQQQQQQQQQQQQQQQQQQQ...QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ..QQQQQQQQQQQQQQQQQQQQQQQQ....QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ..QQQQQQQQQQQQQQQ.......QQQQQQQQQQQQQQQQQQQ...QQ..QQQQQQQQ.QQ.QQQQQQQQQQQQQQQQQQQQQQ",
    "QQQQQQQQQQQQQQQQQQQQQQQQQQ...QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ..QQQQQQQQQQQQQQQQQQQQQQQQ....QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ..QQQQQQQQQQQQQQQ.......QQQQQQQQQQQQQQQQQQQ...QQ..QQQQQQQQ.QQ.QQQQQQQQQQQQQQQQQQQQQQ"
];

const theSphinxGrid = [
    ".......................................................................................................................................................................................................................QQQQQQQQQQ",
    ".......................................................................................................................................................................................................................QQQQQQQQQQ",
    ".......................................................................................................................................................................................................................QQQQQQQQQQ",
    "..............................................................................QQ......................m...........................................................Q...D...QQ..... .....................................QQQQQQQQQQ",
    "..............................................................................QQ...Q..................Q.........................................................aQQ.......QQ.......QQQQ................................QQQQQQQQQQ",
    "...................f......................Q.......................................QQQ.................Q........................................................QQQQ.......QQ...........................................QQQQQQQQQQ",
    "..................QQQ............Q........QQ......Q..............Q.....Q.......Z......................QQ...........QQ............Q...........Q.................QQQQ.......QQ...QQQ......QQQ.......................P....QQQQQQQQQQ",
    "..W........Q.....................Q................Q.............QQ.....QQ.....QQ.........Q..............................Q........QQ.........QQ........Q.......QQQQQ.......QQ..................................O........QQQQQQQQQQ",
    "...........Q..........G.G........Q..s.........G...Q.G......Z....QQ.....QQ...Z.QQ..Z......Q.G...Z..Z..Z..R.....$......Z..Q......G.QQ..D...D..QQ....G.Q.Q.G.Z.R.QQQQQ.......QQ.....................................QQQ...QQQQQQQQQQ",
    "QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ.....QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ...DDD...QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ...QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ",
    "QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ.....QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ.........QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ...QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ"
];

const theMushroomForestCrossingGrid = [
    "...........................................................................................................................................................................................KKKKKKKKKK",
    "...........................................................................................................................................................................................KKKKKKKKKK",
    "....................................s.......................................................G...................................................................................KK.........KKKKKKKKKK",
    "....................................KK...................................................KKKK.....................................s.................KKK.........................KK.........KKKKKKKKKK",
    ".........................................................................$..............KK....................................KKK.KK...............KK........................K..KK.........KKKKKKKKKK",
    "...................................KKK.....j............................KK.............KKKh..................................KK...................KKK..KK...................KK..KK.........KKKKKKKKKK",
    "................................KKKK.....KKK...........................KKK...........K.KKK..KKK..................r..........KKK..................KKKK....G.................KKK..KK....P....KKKKKKKKKK",
    "..W.............KK.........G.KKKKK....................................KKKK..........KK.KKK............KK...................KKKK.................KKKKK...KKK..............GKKKK..KK.........KKKKKKKKKK",
    "........................G.KKKKKK..................Z..................KKKKK........G....KKK.........G..KK...G......Z.....R.KKKKK...KKKKK........KKKKKK..........G.........KKKKK..KK...KKK...KKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKK..KKKKKKKKK......KK..KKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKK...KKKKKKKKKKKKKKKK...KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.......KK.KKKKKKKKKKKK......KKKKKKKKK...KKKKKKK..KKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKK..KKKKKKKKK......KK..KKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKK...KKKKKKKKKKKKKKKK...KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.......KK.KKKKKKKKKKKK......KKKKKKKKK...KKKKKKK..KKKKKKKKKKKKKKKKKKKKK"
];

const theMushroomForestCastleGrid = [
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKK.............KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK........K.......K.......KKKKKKK...................KKKKK...............KKKKKKKKKKKK",
    ".......................K.............KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK........K.......K.......KKKKKKK...................KKKKK...............KKKKKKKKKKKK",
    ".W.....................K.............KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..................................j..h..a.............................KKKKKKKKKKKK",
    ".......................K.............K...........K..........K......K......................................K..K..K.........................kk....KKKKKKKKKK",
    "KKK...........................s.........................................................................................................O.....P.KKKKKKKKKK",
    "KKKK.....................................G............R..........R.......................................f..s..r................................KKKKKKKKKK",
    "KKKKK..............G.....Z....R....KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..R..K...R..K....R..K...KKKKKKK..K..K..K...KKKK...KKKKKDDDDDDDDDDDDDDKKKKKKKKKKKKK",
    "KKKKKKKKKKKKK..KKKKKKKKKKK...KKK...KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK............KKKK...KKKKK..............KKKKKKKKKKKKK",
    "KKKKKKKKKKKKK..KKKKKKKKKKK...KKK...KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..............KKKKKKKKKKKKK"
];

const theMushroomForestGrid = [
    ".......................................................................................................................................................................................................................KKKKKKKKKK",
    "........................................................................................................................Z..............................................................................................KKKKKKKKKK",
    ".....................................................................Z...........h..............................G..K...KKKKKKKKK............*....................h.....................................................KKKKKKKKKK",
    "........................m........G.................................KKKKK.....KKKKK......G......................KK...........................KK...KK.............KKK.....G....................................R.........KKKKKKKKKK",
    ".......................KKK......KK.......................G.....G.......................KK......................KK......................................................KK...................................KK.........KKKKKKKKKK",
    "....................G........G..KK.............G....s...KK....KK.................G.....KK......G..............KKKK........................KK.....................s.....KK......G......G...................KKKK.........KKKKKKKKKK",
    "..........KKK......KK...K...KK......G.G.......KK...KK...KK....KK....G...........KK...G.KK.....KK......KK..G.........G...............G...G.......KKK.......G.S...KKK....KK.....KK....GKK.....G..........GKKKKKK....P....KKKKKKKKKK",
    "..W................KK.......KK.....KKKK.......KK........KK.........KK.....KK....KK..KK.KK.....KK......KK.KK........KK..............KK..KK.............KK.KK.KK................KK...KKKK....KK.........KKKKKKKK.........KKKKKKKKKK",
    "...................KK.....G.KK.....KKKK....R..KK......Z.KK.........KK.....KK....KK..KK.KK...Z.KK......KK.KK........KK..............KK..KK............KKK.KK.KK.....Z.....G....KK...KKKK....KK.......KKKKKKKKKK...SSS...KKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK......KKKKKKKKKKKK.K.KKKKKKKK.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK......KKKKKKKKKKKK.K.KKKKKKKK.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK"
];

const theForestPathwayGrid = [
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "K..................................................KK..KKKKKK..KKKK......KKKK...............................................................................................KKKKKKKKKK",
    "K......................................b...........KK..KKKKKK..KKKK......KKKK...............................................................................................KKKKKKKKKK",
    "K.....................................KKKK.......KK........KK...K.....G...............h.....................................................................................KKKKKKKKKK",
    "K.....................................K..K.......KK........KK...K....KK..........KKKKKK..................................................kkk.......s........................KKKKKKKKKK",
    "K........s................h..........hK..K*......KK.......fKK...K.j..KK..GG......KKKKKK...................R..........................KK.......KKKKKK.............KK.........KKKKKKKKKK",
    "K........KKKKK......K.K...K.........KKK..KKK.....KKKK..KKKKKK...KKK..KK..KKKK.............................KK...........KK...........KKK........................KKKK....P....KKKKKKKKKK",
    "K.W.............G.K.K.K.K...K......................KK...............................................KK....KK....KK.....KK..........KKKK.................kkk..KKKKKK.........KKKKKKKKKK",
    "K..............GK.K.K.K.K.G.K.K..........GG.............G..G.G..................................G.GGKK....KK..G.KK.....KK.........KKKKK........G.............KKKKKK...KKK...KKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK...KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KK..KKKKKKKKKKKK.......KKKKKKKK.......KKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK...KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KK..KKKKKKKKKKKK.......KKKKKKKK.......KKKKKKKKKKKKKKKKKKKKKKKKK"
];

const theRiverCrossingGrid = [
    "...................................................................................................................................K........................................................KKKKKKKKKKKK",
    "...................................................................................................................................K........................................................KKKKKKKKKKKK",
    "...................................................................................................................................Ksh*......................................K.........G....KKKKKKKKKKKK",
    "...................................................................................t..................h............................KKKKKKKKK........................R.......KKKKK...KKKK.....PKKKKKKKKKK",
    "..................................................................................KKK.................K............rG.......................................KKK...KKK.........................KKKKKKKKKK",
    ".........................................K............................................................Kh...........KK...................................DDD.K.......K..........R............KKKKKKKKKKKK",
    ".................KKK............K........KK......K..............K......K.......G......................KK................K........KG.........GK........K.....K.......K.......KKKKK...KKKK...KKKKKKKKKKKKK",
    "..W........K...............f....K................K.............KK......KK.....KK.........K..............................K........KK.DD...DD.KK......K.K.....K.......K.....................KKKKKKKKKKKKKK",
    "...........K..j......G..........K..hhh.......$...K....R........KK..DD..KK...G.KK.R.Z.....K...$.G.G.G.R..................K.......GKK...DDD...KK....K.K.K.....K...h...K..Z.................KKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.........KKKKKKKKKKKKKKKKK.......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.........KKKKKKKKKKKKKKKKK.......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK"
];

const theCastleGatesGrid = [
    "......................................................................................................................................................................................................................SSSSSSSSSS",
    "......................................................................................................................................................................................................................SSSSSSSSSS",
    "..................................................................s.................................................s.................................................................................................SSSSSSSSSS",
    "............................................................SSSSSSSS...............................................SSSSSSSS...........................................................................................SSSSSSSSSS",
    "............................................................................................................................................................................................................SS........SSSSSSSSSS",
    "......................................................G..........R...................................................R.........G..........................................................................S...........SSSSSSSSSS",
    "..................................$..................SS.....SSSSSSSS...SS....................................SS....SSSSSSSS...SS.........................................G..............................S.........P...SSSSSSSSSS",
    "..W...............$...............S..................SS................SSS............$........S.............SS...............SS........................................SS.........................S..S...............SSSSSSSSSS",
    "..................S...........R...S..................SS.......R........SSSS...........S......R.S.............SS........R......SS.........G........R............R........SS.......R.......R.........S.............SSS..SSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SSSS..SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SS..SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS...........SSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SSSS..SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..SS..SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS...........SSSSSSSSSSSSSSSS"
];

const theGoblinKingsCastleGrid = [
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSS............SSSS.................................................................................................................................................................................SSSSSSSSSS",
    ".W.......................................G.......G........^....R.^..........h.........N.......s...........^....Z..........^......N......^....^^.....N...^.........................................................SSSSSSSSSS",
    ".......................................SSSSSSSSSSSSS.....SSSSSSSSSSS....SSSSSSSSSSSSSSSSSSSSSSS.......SS.SSS.SSSSSSSSSS..SSS..SSSSSSS..SSS..SSSSSSSSSSSSSSSS......................................................SSSSSSSSSS",
    "SSS.................G.................SSSSSSSSSSSSSS....................SSSSSSSSSSSSSSSSSSSSS.............S......SSSSSS.....................S................................................................O..P.SSSSSSSSSS",
    "SSSS...............EE...G...........tSSSSSSSSSSSSSSS....b...s..$..^.....SSSSSSSSSSSSSSSSSSSS.....^...............SSSSSS....^......G......^..S........G..........G......s!.....N......f...a.......$$...............SSSSSSSSSS",
    "SSSSS........m.........EE......s...SSSSSSSSSSSSSSSSS....SSSSSSSSSSSSS...SSSSSSSSSSSSSSSSSSS.....SSS..............SSSSSS...SSS..SSSSSSS..SSS.....SSSSSSSSSSSSSSSSSSS...SSS..SSSSSSSS..SS..SS..SSSSSSDDDDDDDDDDDDDSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSS...........SSSSS...............................................................SSS............................................SSSSSSSSSSSSSSSSSSSS...SSS..SSSSSSSS..SS..SS..SSSSSS.............SSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSS...........SSSSS........Z.^.....Z......^......Z...^.......Z.....^...G..........SSS^^.....R......Z......G.....G......G........SSSSSSSSSSSSSSSSSSSSS...SSS..SSSSSSSS..SS..SS..SSSSSS.............SSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSS...........SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS...S...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS.............SSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSS...........SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS...S...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS.............SSSSSSSSSSSS"
];

const theGrasslandsCrossingGrid = [
    "..................................................................................................................................................................................................................KKKKKKKKKK",
    "..................................................................................................................................................................................................................KKKKKKKKKK",
    "......................................................................................................................................................................................................DD..........KKKKKKKKKK",
    "........................................................................................................s.........................................................................................DD..............KKKKKKKKKK",
    "........................................................................................................a.........................................................................................................KKKKKKKKKK",
    ".................G....j....G.........G...b....G........G.......G.f........R..............R...........KDDDDDK....................................................................................DD................KKKKKKKKKK",
    "............KKKDDDDDDDDDDDDDDDDKDDDDDDDDDDDDDDDDKDDDDDDDDDDDDDDDDK....KDDDDDDDDDDK....KDDDDDDDDDDK...K.....K..............................G........................R..........r............R..................P...KKKKKKKKKK",
    "..W........KKKK................K................K................K....K..........K....K..........K...K.....K................KKK..KDDDDDDDDDDDDK.......G.......KDDDDDDDDK..DD..DD..DD..KDDDDDDDDK..................KKKKKKKKKK",
    "..........KKKKK................K................K................K....K..........K....K..........K...K.....K........G............K............K..KDDDDDDDDK...K........K..............K........K.............KKK..KKKKKKKKKK",
    "KKKKKKK.KKKKKKK................K................K................K....K..........K....K..........K...K.....K......KKKKKKKK.......K............K..K........K...K........K..............K........K............KKKKKKKKKKKKKKKK",
    "KKKKKKK.KKKKKKK................K................K................K....K..........K....K..........K...K.....K.......KKKKKK........K............K..K........K...K........K..............K........K............KKKKKKKKKKKKKKKK"
];

const theVolcanoIslandGrid = [
    ".........................................................................................................................................................SSSSSSSSSS",
    ".........................................................................................................................................................SSSSSSSSSS",
    ".......................................................SSSS...................b..........................................................................SSSSSSSSSS",
    "..............................DDD...............s..G.........................SSS................DDD.....SSSS............................DDD..............SSSSSSSSSS",
    "..........................G....................SSSSS........DDD...h...a...h......DDD....DDD.................SSS.....................DDD.....DDD..........SSSSSSSSSS",
    "......................SSSSSS.....DDD.............................SSS.SSS.SSS.............................................................................SSSSSSSSSS",
    "...................j.......................SSSS.......Z.......................................DDDSSS...........$............Z.Z.....................P....SSSSSSSSSS",
    "..W...............SSSSS.......................SSSSSSSSSS............................SSSS...............DDD.SSSSS.......SSSSSSSSSSSS......................SSSSSSSSSS",
    "................................h...SSSSSSS............................Z...........................................................................SSS...SSSSSSSSSS",
    "SSSSSSSSSSSSSSSS..............SSS................................SSSSSSSSSSSSSSSS...................................SSS.........................SSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS................................................................................................................................SSSSSSSSSSSSSSSSSSS"
];

const theVolcanoIslandCastleGrid = [
    "SSSSSSSSSSSSSSSS..................SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS............SSSSSS................SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS..................SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS............SSSSSS................SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    ".W.....................s..........SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS............SSSSSS................SSSSSSSSSSSSS..............SSSSSSSSSSSS",
    "..................................SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..................................SSSSSSSSSSSSS..............SSSSSSSSSSSS",
    "SSS...................SSS.........................................................................................................DDDDDD..EE...PSSSSSSSSSSSS",
    "SSSS...............R........R..................G.....G.....G.........Z...................................a...................................O..SSSSSSSSSSSS",
    "SSSSS.............SS.......SS....f...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS................EE.............s.....................................SSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS................SS..............................................SSSS..EE......SSSSSSS....S....S..SS..SSSSS..SS..SSDDDDDDDDDDDDDSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS................SS........R........R.........R..................SSSS..........SSSSSSS..h...h..S..SS..SSSSS..SS..SS.............SSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS................SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..........SSSSSSSSSSSSSSSSS..SS..SSSSSSSSSSSSS.............SSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS................SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..........SSSSSSSSSSSSSSSSS..SS..SSSSSSSSSSSSS.............SSSSSSSSSSSSS"
];

const theGrasslandsGrid = [
    ".................................................................................................................................................................................................................KKKKKKKKKK",
    "............................................................................*....................................................................................................................................KKKKKKKKKK",
    "............................................................................K....................................................................................................................................KKKKKKKKKK",
    ".................................................................................................................................................................................................................KKKKKKKKKK",
    "...........................................................s................h................................................h.........................................................................K.........KKKKKKKKKK",
    "............................................................................K...........................................................................................hh...........................KKK.........KKKKKKKKKK",
    "........................................................h..K.............................................................................................................$.........................KKKKK....P....KKKKKKKKKK",
    "..W........................................................K..............K...K..............................................K..........................................KK.......................KKKKKKK.........KKKKKKKKKK",
    ".................G......GGG......GGG......GG....K..........K.....G....GGG.K..GK............R..................G.......GGG....K.......G.....GGG.......GG..........GGG....KK....G...GGG......GGG.KKKKKKKKK...KKK...KKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK"
];

const theGrasslandsRuinsGrid = [
    "..............................................................................................................................................................................................................KKKKKKKKKK",
    "..............................................................................................................................................................................................................KKKKKKKKKK",
    ".........................h....................................h..h............................................................................................................................................KKKKKKKKKK",
    ".........................K....................................K..K.......................................................................KKKK.................................................................KKKKKKKKKK",
    "..............................................................................................................................................................................................................KKKKKKKKKK",
    ".........................s....................................h..h...................fh.....................^.............^..............s..t......................................................KK.........KKKKKKKKKK",
    "......................^..K....................................K..K..................KKKK........K..........KK............KK............KKKKKKKK........^.........................................KKKK....P....KKKKKKKKKK",
    "..W..................KK.........................................................................K..........KK............KK...........................KK.......................K...............KKKKKK.h.....r.KKKKKKKKKK",
    ".....................KK.....$........R.....R.....R.....R.....R.....R............................K........Z.KK......G.....KK.....Z....Z................KK....G..................K.....R.R.R...KKKKKKKK...SSS...KKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK....KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKKKKKKK...SSS..KKKKKKKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK....KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..KKKKKKKKKKKKKKKKKKKK...SSS..KKKKKKKK..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK"
];

const theTundraGrid = [
    ".........................................................................................................................................IIIIIIIIII",
    "...................r^^............R........s....h........................................................................................IIIIIIIIII",
    "...................IIIII........III....IIIII....iii...........h.......III..................................................hhh...........IIIIIIIIII",
    "..............................................................DDD.........s...Z..............j.............................iii...........IIIIIIIIII",
    "..........................^.ZZ.....................III.iii.........III....IIIII.iii........iii...........III.............................IIIIIIIIII",
    ".......................IIIIIII..............III.........................................h..............$.................................IIIIIIIIII",
    ".......................................Z..................DDD...........III.........III.iii.....iii..IIIII.............G............P....IIIIIIIIII",
    "..W.............a.^.................IIIIIII..........................................................................IIIII...............IIIIIIIIII",
    "................IIIII..............................................^Z.........................................G^...................III...IIIIIIIIII",
    "IIIIIIIIIIIIIII..................................................IIIII......................................IIIIIII......................IIIIIIIIII",
    "IIIIIIIIIIIIIII..........................................................................................................................IIIIIIIIII"
];

const theTundraCrossingGrid = [
    "........................................................................................................................................................IIIIIIIIII",
    "........................................................................................................................................................IIIIIIIIII",
    "..........................................Z..Z...............hh.........................................................................................IIIIIIIIII",
    ".............................R..........IIIIIII.............IIII...............Z........................................................................IIIIIIIIII",
    "...........................IIII.....$..................ii...................IIIIII....ii......ii.............Z.........t.....................II.........IIIIIIIIII",
    "...........................f.s.....IIIII................................N..............................IIIIIIII......G.....G.......ii......IIII.........IIIIIIIIII",
    "........................IIIIIIII......................................III..........................................IIII..IIII............IIIIII....P....IIIIIIIIII",
    "..W.................R............a.........................s.............................................................................IIIIII.........IIIIIIIIII",
    "..................IIII..........III...............................R..............................IIII...........hRh.................Z....IIIIII...III...IIIIIIIIII",
    "IIIIIIIIIIIIIIII..................................IIII.....IIIII.IIIII..........................................III.............IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
    "IIIIIIIIIIIIIIII................................................................................................................IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII"
];

const theTundraCastleGrid = [
    "................................................................................hhhhhhhhhhhhhhhhhhhh..............................................................................................................IIIIIIIIII",
    ".............................................................................NNNDDDDDDDDDDDDDDDDDDDD.......GGG....................................................................................................IIIIIIIIII",
    "......................................................................DDDDDDDDDD....................DDDDDDDDDD.......ZZZ..........................................................................................IIIIIIIIII",
    ".........................................................$$$DDDDDDDDDD........................................DDDDDDDDDD.......RRR................................................................................IIIIIIIIII",
    "...............................................RRRDDDDDDDDDD............................................................DDDDDDDDDD.......$$$......................................................................IIIIIIIIII",
    ".....................................ZZZDDDDDDDDDD................................................................................DDDDDDDDDD.......NNN............................................................IIIIIIIIII",
    "...........................GGGDDDDDDDDDD....................................................................................................DDDDDDDDDD.......................................................P....IIIIIIIIII",
    "..W.......jfshrbtam*!DDDDDDDDD........................................................................................................................DDDDDDDDDD.......................................O..........IIIIIIIIII",
    "..........DDDDDDDDDDD...........................................................................................................................................DDDDDDDDDD..................................III...IIIIIIIIII",
    "IIIIIIIIII................................................................................................................................................................IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
    "IIIIIIIIII................................................................................................................................................................IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII"
];

// ==========================================
// 2. ASSET SETUP
// ==========================================
const images = {
    wizard: new Image(), goblin: new Image(), rockThrowerGoblin: new Image(), stoneBrick: new Image(), icyPlatform: new Image(), dirtGrass: new Image(),
    goblinShaman: new Image(), portal: new Image(), orcBoss: new Image(), potionJump: new Image(),
    scrollFire: new Image(), amuletShield: new Image(), background: new Image(),
    healthPotion: new Image(), scrollDeathRay: new Image(), spikes: new Image(), 
    shieldGlow: new Image(), disappearingPlatform: new Image(), sandBrick: new Image(),
    wizardsBoots: new Image(), freezeTime: new Image(), arcaneFamiliar: new Image(),
    magnet: new Image(), stardust: new Image(), shatter: new Image(),
    necromancerGoblin: new Image(), shieldedGoblin: new Image(),
    
    // CAMPAIGN MAP ASSETS
    campaignMap: new Image(), levelStatusGray: new Image(), levelStatusBlue: new Image(),
    levelStatusGreen: new Image(), wizardMapIcon: new Image(),
	
    goblinMountain: new Image(), icyTundraBiome: new Image(), volcanoBiome: new Image(),
    mushroomForestBiome: new Image(), forestBiome: new Image(), grassyBiome: new Image(), desertBiome: new Image()
};
images.wizard.src = "assets/wizard_spritesheet_new.png";
images.goblin.src = "assets/goblin_spritesheet.png";
images.goblinShaman.src = "assets/goblin_shaman_spritesheet.png";
images.rockThrowerGoblin.src = "assets/rock_thrower_goblin_spritesheet.png";
images.stoneBrick.src = "assets/stone_brick.png";
images.sandBrick.src = "assets/sand_brick.png";
images.icyPlatform.src = "assets/icy_platform.png";
images.dirtGrass.src = "assets/dirt_grass.png";
images.portal.src = "assets/portal.png";
images.orcBoss.src = "assets/orc_boss_spritesheet.png";
images.potionJump.src = "assets/potion_jump.png";
images.scrollFire.src = "assets/scroll_fire.png";
images.amuletShield.src = "assets/amulet_shield.png";
images.background.src = "assets/background.png";
images.healthPotion.src = "assets/health_potion.png";
images.scrollDeathRay.src = "assets/scroll_deathray.png";
images.spikes.src = "assets/spikes.png";
images.shieldGlow.src = "assets/shield_glow.png";
images.disappearingPlatform.src = "assets/disappearing_platform.png";
images.wizardsBoots.src = "assets/wizards_boots.png";
images.freezeTime.src = "assets/freeze_time.png";
images.arcaneFamiliar.src = "assets/arcane_familiar.png";
images.magnet.src = "assets/magnets_how_do_they_work.png";
images.stardust.src = "assets/stardust.png";
images.shatter.src = "assets/shockwave_shatter.png";
images.necromancerGoblin.src = "assets/necromancer_goblin_spritesheet.png";
images.shieldedGoblin.src = "assets/shielded_goblin_spritesheet.png";

images.campaignMap.src = "assets/campaign_map.png";
images.levelStatusGray.src = "assets/level_status_gray.png";
images.levelStatusBlue.src = "assets/level_status_blue.png";
images.levelStatusGreen.src = "assets/level_status_green.png";
images.wizardMapIcon.src = "assets/wizard_for_map.png";

images.goblinMountain.src = "assets/goblin_mountain_background.png";
images.icyTundraBiome.src = "assets/icy_tundra_biome_background.png";
images.volcanoBiome.src = "assets/volcano_biome_background.png";
images.mushroomForestBiome.src = "assets/mushroom_forest_biome_background.png";
images.forestBiome.src = "assets/forest_biome_background.png";
images.grassyBiome.src = "assets/grassy_biome_background.png";
images.desertBiome.src = "assets/desert_biome_background.png";

const PLATFORM_STYLES = {
    stone: {image: images.stoneBrick, fallback: "#4a4a4a"},
    sand: {image: images.sandBrick, fallback: "#4a4a4a"},
	ice: {image: images.icyPlatform, fallback: "#4a4a4a"},
	grass: {image: images.dirtGrass, fallback: "#4a4a4a"},
    disappearing: {image: images.disappearingPlatform, fallback: "#4a4a4a"}
};

/////////////////////////////////////////////////////////////////////////////////
////////////////////////////////MAIN CAMPAIGN LEVELS/////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
// ==========================================
// CAMPAIGN LEVELS OBJECT
// ==========================================
const campaignLevels = {
    "Wizard Training": { x: 420, y: 452, left: "The Lighthouse", right: "The Forest Pathway", down: "The Mushroom Forest Crossing", levelData: parseLevelGrid(wizardTrainingGrid, images.background) },
    "The Lighthouse": { x: 128, y: 403, right: "Wizard Training", up: "The Desert Pathway", levelData: parseLevelGrid(theLightHouseGrid, images.grassyBiome) },
    "The Desert Pathway": { x: 324, y: 257, up: "The Pyramid", down: "The Lighthouse", left: "The Lighthouse", levelData: parseLevelGrid(theDesertPathwayGrid, images.desertBiome) },
    "The Pyramid": { x: 369, y: 173, left: "The Sphinx", down: "The Desert Pathway", levelData: parseLevelGrid(thePyramidGrid, images.desertBiome) },
    "The Sphinx": { x: 184, y: 175, right: "The Pyramid", levelData: parseLevelGrid(theSphinxGrid, images.desertBiome) },
    "The Mushroom Forest Crossing": { x: 328, y: 650, left: "The Mushroom Forest Castle", up: "Wizard Training", right: "The Mushroom Forest", levelData: parseLevelGrid(theMushroomForestCrossingGrid, images.mushroomForestBiome) },
    "The Mushroom Forest Castle": { x: 173, y: 680, right: "The Mushroom Forest Crossing", levelData: parseLevelGrid(theMushroomForestCastleGrid, images.mushroomForestBiome) },
    "The Mushroom Forest": { x: 447, y: 716, left: "The Mushroom Forest Crossing", right: "The River Crossing", levelData: parseLevelGrid(theMushroomForestGrid, images.mushroomForestBiome) },
    "The Forest Pathway": { x: 595, y: 517, left: "Wizard Training", right: "The River Crossing", levelData: parseLevelGrid(theForestPathwayGrid, images.forestBiome) },
    "The River Crossing": { x: 823, y: 560, up: "The Castle Gates", left: "The Forest Pathway", down: "The Mushroom Forest", right: "The Grasslands Crossing", levelData: parseLevelGrid(theRiverCrossingGrid, images.forestBiome) },
    "The Castle Gates": { x: 817, y: 387, up: "The Goblin King's Castle", down: "The River Crossing", levelData: parseLevelGrid(theCastleGatesGrid, images.goblinMountain) },
    "The Goblin King's Castle": { x: 817, y: 175, down: "The Castle Gates", levelData: parseLevelGrid(theGoblinKingsCastleGrid, images.goblinMountain) },
    "The Grasslands Crossing": { x: 998, y: 623, left: "The River Crossing", right: "The Volcano Island", up: "The Grasslands", levelData: parseLevelGrid(theGrasslandsCrossingGrid, images.grassyBiome) },
    "The Volcano Island": { x: 1284, y: 664, up: "The Volcano Island Castle", right: "The Volcano Island Castle", left: "The Grasslands Crossing", levelData: parseLevelGrid(theVolcanoIslandGrid, images.volcanoBiome) },
    "The Volcano Island Castle": { x: 1388, y: 562, down: "The Volcano Island", left: "The Volcano Island", levelData: parseLevelGrid(theVolcanoIslandCastleGrid, images.volcanoBiome) },
    "The Grasslands": { x: 1077, y: 509, down: "The Grasslands Crossing", up: "The Grasslands Ruins", levelData: parseLevelGrid(theGrasslandsGrid, images.grassyBiome) },
    "The Grasslands Ruins": { x: 1116, y: 385, down: "The Grasslands", right: "The Tundra", levelData: parseLevelGrid(theGrasslandsRuinsGrid, images.grassyBiome) },
    "The Tundra": { x: 1290, y: 347, left: "The Grasslands Ruins", down: "The Grasslands Ruins", right: "The Tundra Crossing", up: "The Tundra Crossing", levelData: parseLevelGrid(theTundraGrid, images.icyTundraBiome) },
    "The Tundra Crossing": { x: 1394, y: 260, up: "The Tundra Castle", down: "The Tundra", left: "The Tundra", levelData: parseLevelGrid(theTundraCrossingGrid, images.icyTundraBiome) },
    "The Tundra Castle": { x: 1304, y: 202, down: "The Tundra Crossing", right: "The Tundra Crossing", levelData: parseLevelGrid(theTundraCastleGrid, images.icyTundraBiome) }
};

let lives = 5; 
let score = 0; 
let highestEndlessX = 0; 

// Dynamic World Variables
let tileSize; 
let mapWidth = 0; 
let mapHeight; 
let platformSpawnCounter = 0; 
let globalFreezeTimer = 0; 
let familiarObj = { x: 0, y: 0, fireCooldown: 0 };

let lastTime = 0;
const FPS = 60;
const frameInterval = 1000 / FPS;

let platforms = []; 
let disappearingPlatforms = [];
let enemies = []; 
let powerups = []; 
let spikes = [];
let fireballs = []; 
let enemyFireballs = []; 
let particles = []; 
let activeDeathRays = [];
let goal = null; 
let spawnPoint = { x: 0, y: 0 }; 

let campaignPowerups = []; 

// ==========================================
// 3. PLAYER, CAMERA, & CONTROLS SETUP
// ==========================================
const player = {
    x: 0, y: 0, width: 30, height: 30, 
    vx: 0, vy: 0, 
    speed: 5, jumpPower: -13, gravity: 0.6, 
    grounded: false, 
    color: "#4169E1", 
    lastFacingDir: 1, 
    
    hasFireball: false, 
    hasShield: false, 
    hasLevitation: false,
    deathRayUses: 0,
    fireCooldown: 0, 
    invincibilityTimer: 0,
    hasShockwaveBoots: false,
    hasFamiliar: false,
    hasMagnet: false,
    hasShatter: false,

    // --- NEW SPRITE ANIMATION VARIABLES ---
    frameX: 0,          // Which frame of the flipbook we are currently showing
    maxFrames: 4,       // Total number of frames in your "wizard.png" sprite sheet (change this if your sheet has more/less)
    frameTimer: 0,      // A counter to track when to flip to the next page
    frameInterval: 4    // How many game ticks to wait before flipping the page (lower is faster)
};

const camera = { x: 0, y: 0 }; 
let enemyJumpPower;

let controlMap = {
    left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", down: "ArrowDown",
    fire: "KeyZ", deathRay: "KeyX", blink: "KeyV", pause: "Escape", enter: "Enter"
};
const keys = { left: false, right: false, up: false, fire: false, down: false, jump: false }; 
let jumpKeyReleased = true;
let awaitingKeybind = null;

// ==========================================
// VIEWPORT & GRID SIZING
// ==========================================
function hasCampaignUnlock(levelName) {
    return completedLevels.includes(levelName);
}

function updatePhysicsConstants() {
    player.gravity = tileSize * 0.010;
    player.speed = tileSize * 0.1; 
    
    let playerBaseJump = -Math.sqrt(2 * player.gravity * (3.5 * tileSize));
    let extraJump = -Math.sqrt(2 * player.gravity * (4.5 * tileSize));
    
    player.jumpPower = (hasCampaignUnlock("The Tundra Castle") || player.hasLevitation) ? extraJump : playerBaseJump;
    enemyJumpPower = -Math.sqrt(2 * player.gravity * (2.0 * tileSize)); 
}

function resizeCanvas() {
    let oldTileSize = tileSize;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    tileSize = canvas.width / 20; 
    mapHeight = canvas.height;
    
    let scale = oldTileSize ? (tileSize / oldTileSize) : 1;
    
    if (oldTileSize && scale !== 1) {
        player.x *= scale; player.y *= scale;
        player.width = tileSize * 0.75; player.height = tileSize * 0.75;
        spawnPoint.x *= scale; spawnPoint.y *= scale;
        familiarObj.x *= scale; familiarObj.y *= scale;
        
        platforms.forEach(p => { 
            p.x *= scale; p.y *= scale; p.width *= scale; p.height *= scale; 
            if(p.minY) p.minY *= scale; 
            if(p.maxY) p.maxY *= scale; 
        });
        disappearingPlatforms.forEach(p => { 
            p.x *= scale; p.y *= scale; p.width *= scale; p.height *= scale; 
            if(p.minY) p.minY *= scale; 
            if(p.maxY) p.maxY *= scale; 
        });
        spikes.forEach(s => { s.x *= scale; s.y *= scale; s.width *= scale; s.height *= scale; });
        enemies.forEach(e => { 
            e.x *= scale; e.y *= scale; 
            e.width = (e.type === "boss" ? 1.5 : 0.75) * tileSize; 
            e.height = (e.type === "boss" ? 1.5 : 0.75) * tileSize; 
            e.speed *= scale; e.vx = Math.sign(e.vx) * e.speed; 
        });
        powerups.forEach(p => { p.x *= scale; p.y *= scale; p.width = tileSize * 0.5; p.height = tileSize * 0.5; });
        fireballs.forEach(f => { f.x *= scale; f.y *= scale; f.vx *= scale; f.vy *= scale; f.width *= scale; f.height *= scale; });
        enemyFireballs.forEach(f => { f.x *= scale; f.y *= scale; f.vx *= scale; f.vy *= scale; f.width *= scale; f.height *= scale; });
        if (goal) { goal.x *= scale; goal.y *= scale; goal.width = tileSize; goal.height = tileSize * 2; }
        mapWidth *= scale;
        highestEndlessX *= scale;
    }
    
    updatePhysicsConstants();
}
window.addEventListener('resize', resizeCanvas);

// ==========================================
// 4. LEVEL GENERATOR & LOADERS
// ==========================================
function checkCollision(a, b) {
    const epsilon = 0.1; 
    return (a.x < b.x + b.width - epsilon && 
            a.x + a.width > b.x + epsilon && 
            a.y < b.y + b.height - epsilon && 
            a.y + a.height > b.y + epsilon); 
}

function isOccupied(x, y, w, h) {
    let rect = { x, y, width: w, height: h };
    for (let p of platforms) if (checkCollision(rect, p)) return true;
    for (let dp of disappearingPlatforms) if (dp.alpha > 0 && checkCollision(rect, dp)) return true;
    for (let s of spikes) if (checkCollision(rect, s)) return true;
    for (let e of enemies) if (checkCollision(rect, e)) return true;
    for (let pw of powerups) if (checkCollision(rect, pw)) return true;
    if (goal && checkCollision(rect, goal)) return true;
    return false;
}

function generateChunk(startGridX, difficulty, isBossChunk = false, isGoalChunk = false) {
    let spawnedChunkPowerups = [];
    let gridSpotsY = Math.floor(mapHeight / tileSize);
    let defaultGroundY = gridSpotsY - 2; 
    let currentGridX = startGridX;
    let currentGridY = defaultGroundY;
    
    let validPlatforms = platforms.filter(p => p.x >= 0);
    if (validPlatforms.length > 0) {
        let lastPlat = validPlatforms[validPlatforms.length - 1];
        currentGridY = Math.round(lastPlat.y / tileSize);
    }

    if (isBossChunk || isGoalChunk) {
        let platWGrids = 15;
        platforms.push({ x: currentGridX * tileSize, y: defaultGroundY * tileSize, width: platWGrids * tileSize, height: tileSize * 2, isElevator: false });
        if (isBossChunk) {
            let bossSize = tileSize * 1.5;
            let boss = { 
                x: (currentGridX + platWGrids - 2) * tileSize, y: defaultGroundY * tileSize - bossSize, 
                width: bossSize, height: bossSize, 
                vx: tileSize * 0.04, speed: tileSize * 0.04, hp: 5, 
                type: "boss", jumpPower: enemyJumpPower, fireCooldown: 0, grounded: false, vy: 0, dirChangeCooldown: 0,
                frameX: 0, maxFrames: 4, frameTimer: 0, frameInterval: 6
            }; 
            enemies.push(boss);
        }
        if (isGoalChunk) {
            goal = { x: (currentGridX + platWGrids - 3) * tileSize, y: defaultGroundY * tileSize - (tileSize * 2), width: tileSize, height: tileSize * 2, active: true }; 
        }
        return currentGridX + platWGrids;
    }

    let numPlatforms = Math.floor(Math.random() * 7) + 4; 
    let createdPlatforms = [];

    for (let i = 0; i < numPlatforms; i++) {
        let gapX = Math.floor(Math.random() * 3) + 1; 
        let gapY = Math.floor(Math.random() * 7) - 3; 
        
        let nextGridY = currentGridY + gapY;
        let minY = Math.floor(gridSpotsY * 0.3);
        let maxY = gridSpotsY - 2; 
        
        if (nextGridY < minY) nextGridY = minY;
        if (nextGridY > maxY) nextGridY = maxY;
        
        if (nextGridY - currentGridY > 3) nextGridY = currentGridY + 3;
        if (currentGridY - nextGridY > 3) nextGridY = currentGridY - 3;
        
        currentGridX += gapX;
        currentGridY = nextGridY;

        let isDisappearing = (!isBossChunk && !isGoalChunk && Math.random() < 0.35);
        let platWGrids = (Math.floor(Math.random() * 5) + 3); 

        let cpObj = { gridX: currentGridX, gridY: currentGridY, wGrids: platWGrids, hasPowerup: false, hasSpikes: false };

        if (Math.random() < 0.25) {
            let types = ["jump", "fire", "shield", "deathray", "health", "boots", "freeze", "familiar", "magnet", "stardust"]; 
            
            if (gameMode === "endless") types = types.filter(t => t !== "health");
            if (player.hasLevitation) types = types.filter(t => t !== "jump");
            if (player.hasFireball) types = types.filter(t => t !== "fire");
            if (player.hasShield) types = types.filter(t => t !== "shield");
            if (player.deathRayUses > 0) types = types.filter(t => t !== "deathray");
            if (player.hasShockwaveBoots) types = types.filter(t => t !== "boots");
            if (player.hasFamiliar) types = types.filter(t => t !== "familiar");
            if (player.hasMagnet) types = types.filter(t => t !== "magnet");
            if (player.hasShatter) types = types.filter(t => t !== "shatter");
            
            if (player.hasShield) types.push("shatter"); 
            types = types.filter(t => !spawnedChunkPowerups.includes(t));
            
            if (types.length > 0) {
                let type = types[Math.floor(Math.random() * types.length)];
                spawnedChunkPowerups.push(type);
                
                let pSize = tileSize * 0.75;
                let pwItem = { 
                    x: (currentGridX + platWGrids/2) * tileSize - pSize/2, 
                    y: (currentGridY - 1) * tileSize, width: pSize, height: pSize, type: type 
                }; 
                if (!isOccupied(pwItem.x, pwItem.y, pwItem.width, pwItem.height)) {
                    powerups.push(pwItem);
                    cpObj.hasPowerup = true;
                }
            }
        }

        if (isDisappearing) {
            platformSpawnCounter++;
            let baseMinY = Math.floor(gridSpotsY * 0.3) * tileSize;
            let baseMaxY = (gridSpotsY - 2) * tileSize;
            let basePhase = Math.random() * Math.PI * 2;

            for (let k = 0; k < platWGrids; k++) {
                disappearingPlatforms.push({
                    x: (currentGridX + k) * tileSize, y: currentGridY * tileSize,
                    width: tileSize, height: tileSize, triggered: false, disappearTimer: 90, 
                    alpha: 1.0, isElevator: false, minY: baseMinY, maxY: baseMaxY, phase: basePhase
                });
            }
            cpObj.plat = { x: currentGridX * tileSize, y: currentGridY * tileSize, width: platWGrids * tileSize, height: tileSize, isElevator: false, minY: baseMinY, maxY: baseMaxY, phase: basePhase };
        } else {
            platformSpawnCounter++;
            let plat = { 
                x: currentGridX * tileSize, y: currentGridY * tileSize, width: platWGrids * tileSize, height: tileSize,
                isElevator: (platformSpawnCounter % 2 === 0),
                minY: Math.floor(gridSpotsY * 0.3) * tileSize, maxY: (gridSpotsY - 2) * tileSize, phase: Math.random() * Math.PI * 2
            };
            platforms.push(plat);
            cpObj.plat = plat;
        }

        if (platWGrids >= 3 && !cpObj.hasPowerup && !isDisappearing) {
            let numSpikes = Math.min(4, 2);
            let availableIndices = [];
            for (let idx = 1; idx < platWGrids - 1; idx++) availableIndices.push(idx);
            
            let spikeIndices = [];
            while (spikeIndices.length < numSpikes && availableIndices.length > 0) {
                let randIndex = Math.floor(Math.random() * availableIndices.length);
                spikeIndices.push(availableIndices.splice(randIndex, 1)[0]);
            }

            if (spikeIndices.length > 0) cpObj.hasSpikes = true;

            for (let idx of spikeIndices) {
                let speedMult = 1 + (bossesDefeated * 0.15);
                let enemySize = tileSize * 0.75;
                let currentDistanceMeters = Math.floor(highestEndlessX / (tileSize / 4));
                
                let eligibleTypes = ["goblin"];
                if (currentDistanceMeters > 1000) eligibleTypes.push("rockThrower");
                if (currentDistanceMeters > 2000) eligibleTypes.push("shielded");
                if (currentDistanceMeters > 3000) eligibleTypes.push("shaman");
                if (currentDistanceMeters > 4000) eligibleTypes.push("necromancer");
                
                let enemyType = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];

                let goblinItem = { 
                    x: cpObj.plat.x + idx * tileSize, y: cpObj.plat.y - enemySize, 
                    width: enemySize, height: enemySize, vx: tileSize * 0.05 * speedMult, speed: tileSize * 0.05 * speedMult, hp: 1, 
                    type: enemyType, jumpPower: enemyJumpPower, grounded: false, vy: 0, dirChangeCooldown: 0, fireCooldown: 0,
                    frameX: 0, maxFrames: 4, frameTimer: 0, frameInterval: 6
                };
                if (!isOccupied(goblinItem.x, goblinItem.y, goblinItem.width, goblinItem.height)) enemies.push(goblinItem);
            }
        }
        createdPlatforms.push(cpObj);
        currentGridX += platWGrids;
    }

    let validSpikePlatforms = createdPlatforms.filter(cp => !cp.hasPowerup && cp.wGrids >= 3);
    for (let sIdx = 0; sIdx < 3 && validSpikePlatforms.length > 0; sIdx++) {
        let pIdx = Math.floor(Math.random() * validSpikePlatforms.length);
        let cp = validSpikePlatforms.splice(pIdx, 1)[0];
        
        let spikeW = tileSize * 0.5, spikeH = tileSize * 0.15;
        let randomIdx = Math.floor(Math.random() * (cp.wGrids - 2)) + 1;

        let sItem = { x: cp.plat.x + (randomIdx * tileSize) + (tileSize - spikeW) / 2, y: cp.plat.y - spikeH, width: spikeW, height: spikeH };
        if (!isOccupied(sItem.x, sItem.y, sItem.width, sItem.height)) spikes.push(sItem);
    }

    return currentGridX; 
}

function buildLevel() {
    platforms = []; disappearingPlatforms = []; enemies = []; powerups = []; spikes = []; fireballs = []; enemyFireballs = []; particles = []; activeDeathRays = []; goal = null; 
    platformSpawnCounter = 0;

    let gridSpotsY = Math.floor(mapHeight / tileSize);
    
    // We calculate a base path for the elevators to travel based on grid height
    let baseMinY = Math.floor(gridSpotsY * 0.3) * tileSize;
    let baseMaxY = (gridSpotsY - 2) * tileSize;
    
    if (gameMode === "campaign") { 
        let lData = campaignLevels[currentMapNode].levelData;
        currentBackground = lData.bgImage || images.background; 
        
        let maxGridX = 0;
        platforms.push({ x: -tileSize, y: -mapHeight, width: tileSize, height: mapHeight * 3, isElevator: false }); 
        
        // ==========================================
        // NEW CODE: SYNC ADJACENT ELEVATORS
        // ==========================================
        let elevators = lData.assets.filter(a => a.isElevator);
        let parent = {};
        elevators.forEach((_, i) => parent[i] = i);
        
        const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
        const union = (i, j) => {
            let rootI = find(i), rootJ = find(j);
            if (rootI !== rootJ) parent[rootI] = rootJ;
        };
        
        // Group elevators if they are within 1 grid space of each other (8-way adjacency)
        for (let i = 0; i < elevators.length; i++) {
            for (let j = i + 1; j < elevators.length; j++) {
                if (Math.abs(elevators[i].gridX - elevators[j].gridX) <= 1 && 
                    Math.abs(elevators[i].gridY - elevators[j].gridY) <= 1) {
                    union(i, j);
                }
            }
        }
        
        // Assign a single shared phase to each synchronized group
        let groupPhases = {};
        elevators.forEach((e, i) => {
            let root = find(i);
            if (groupPhases[root] === undefined) {
                groupPhases[root] = Math.random() * Math.PI * 2;
            }
            e.phase = groupPhases[root]; 
        });
        // ==========================================
        
        lData.assets.forEach(item => {
            let px = item.gridX * tileSize;
            let py = item.gridY * tileSize;
            if (item.gridX + (item.gridW || 1) > maxGridX) maxGridX = item.gridX + (item.gridW || 1);

            if (item.type === "platform") {
				platforms.push({ 
					x: px, y: py, width: item.gridW * tileSize, height: item.gridH * tileSize, 
					isElevator: item.isElevator || false,
					minY: item.isElevator ? baseMinY : undefined,
					maxY: item.isElevator ? baseMaxY : undefined,
					phase: item.isElevator ? item.phase : 0,
					texture: item.texture || "stone" // Defaults to stone if not defined
				});
			} else if (item.type === "goal") {
                goal = { x: px, y: py, width: item.gridW * tileSize, height: item.gridH * tileSize, active: true };
			} else if (item.type === "goblin" || item.type === "orcBoss" || item.type === "rockThrower" || item.type === "shaman" || item.type === "necromancer" || item.type === "shielded") {
                let enemySize = tileSize * (item.type === "orcBoss" ? 1.5 : 0.75);
                enemies.push({
                    x: px, y: py, width: enemySize, height: enemySize,
                    vx: tileSize * 0.05, speed: tileSize * 0.05, hp: item.type === "orcBoss" ? 5 : 1,
                    type: item.type === "orcBoss" ? "boss" : item.type,
                    jumpPower: enemyJumpPower, grounded: false, vy: 0, dirChangeCooldown: 0, fireCooldown: 0,
                    frameX: 0, maxFrames: 4, frameTimer: 0, frameInterval: 6
                });
            } else if (item.type === "powerup") {
                powerups.push({ x: px, y: py, width: tileSize * 0.75, height: tileSize * 0.75, type: item.powerupType });
            } else if (item.type === "spawn") {
                spawnPoint = { x: px, y: py };
            } else if (item.type === "spikes") {
                let spikeW = tileSize * 0.5;
                let spikeH = tileSize * 0.15;
                spikes.push({ x: px + (tileSize - spikeW)/2, y: py + tileSize - spikeH, width: spikeW, height: spikeH });
            } else if (item.type === "disappearingPlatform") {
                disappearingPlatforms.push({
                    x: px, y: py, width: (item.gridW || 1) * tileSize, height: (item.gridH || 1) * tileSize,
                    triggered: false, disappearTimer: 90, alpha: 1.0, 
                    isElevator: item.isElevator || false, 
                    minY: item.isElevator ? baseMinY : py, 
                    maxY: item.isElevator ? baseMaxY : py, 
                    // Pull the pre-calculated synchronized phase here
                    phase: item.isElevator ? item.phase : 0
                });
            }
        });
        
        mapWidth = Math.max(canvas.width, (maxGridX + 5) * tileSize);

    } else {
        currentBackground = images.background; 
        platforms.push({ x: 0, y: (gridSpotsY - 2) * tileSize, width: tileSize * 5, height: tileSize * 2, isElevator: false }); 
        platforms.push({ x: -tileSize, y: -mapHeight, width: tileSize, height: mapHeight * 3, isElevator: false }); 
        spawnPoint = { x: tileSize * 2, y: (gridSpotsY - 3) * tileSize };

        let currentGridX = 5; 
        currentGridX = generateChunk(currentGridX, 0.4); 
        currentGridX = generateChunk(currentGridX, 0.5); 
        mapWidth = currentGridX * tileSize; 
    }
}

function resetPlayer() {
    player.width = tileSize * 0.75;
    player.height = tileSize * 0.75;
    player.x = spawnPoint.x; 
    player.y = spawnPoint.y; 
    player.vx = 0; player.vy = 0; 
    
    familiarObj.x = spawnPoint.x;
    familiarObj.y = spawnPoint.y;
    globalFreezeTimer = 0;
    
    disappearingPlatforms.forEach(dp => {
        dp.triggered = false; dp.disappearTimer = 90; dp.alpha = 1.0;
    });
    
    if (gameMode === "campaign") {
        player.hasFireball = campaignPowerups.includes("fire");
        player.hasShield = campaignPowerups.includes("shield");
        player.hasLevitation = campaignPowerups.includes("jump");
        player.hasShockwaveBoots = campaignPowerups.includes("boots");
        player.hasFamiliar = campaignPowerups.includes("familiar");
        player.hasMagnet = campaignPowerups.includes("magnet");
        player.hasShatter = campaignPowerups.includes("shatter");
        
        let dr = campaignPowerups.find(p => p.startsWith("deathray:"));
        player.deathRayUses = dr ? parseInt(dr.split(":")[1]) : 0;
    } else {
        player.hasFireball = false; 
        player.hasShield = false; 
        player.hasLevitation = false;
        player.hasShockwaveBoots = false;
        player.hasFamiliar = false;
        player.hasMagnet = false;
        player.hasShatter = false;
        player.deathRayUses = 0;
    }
    
    updatePhysicsConstants();
    player.invincibilityTimer = 120; 
    player.lastFacingDir = 1; 
}

// ==========================================
// 5. INPUT CONTROLS & MAP NAVIGATION
// ==========================================
window.addEventListener("keydown", (e) => {
    if (awaitingKeybind) {
        controlMap[awaitingKeybind] = e.code;
        awaitingKeybind = null;
        renderControlsMenu();
        return;
    }

	if (e.code === controlMap.pause) {
        const powerupsScreen = document.getElementById("powerups-screen");
        const controlsScreen = document.getElementById("controls-screen");
        
        // If either sub-menu is visible, go backward instead of toggling pause
        if (!powerupsScreen.classList.contains("hidden") || !controlsScreen.classList.contains("hidden")) {
            goBackFromSubmenu();
            return;
        }

        // Normal pause toggle behavior
        if (gameState === "PLAYING" || gameState === "PAUSED" || gameState === "CAMPAIGN_MAP") {
            togglePause();
            return;
        }
    }

    if (gameState === "CAMPAIGN_MAP") {
        let node = campaignLevels[currentMapNode];
        
        if (e.code === controlMap.left && mapKeysReleased.left && node.left && getLevelStatus(node.left) !== "gray") {
            currentMapNode = node.left; mapKeysReleased.left = false;
        } else if (e.code === controlMap.right && mapKeysReleased.right && node.right && getLevelStatus(node.right) !== "gray") {
            currentMapNode = node.right; mapKeysReleased.right = false;
        } else if (e.code === controlMap.jump && mapKeysReleased.up && node.up && getLevelStatus(node.up) !== "gray") {
            currentMapNode = node.up; mapKeysReleased.up = false;
        } else if (e.code === controlMap.down && mapKeysReleased.down && node.down && getLevelStatus(node.down) !== "gray") {
            currentMapNode = node.down; mapKeysReleased.down = false;
        }
        
        if (e.code === controlMap.enter) {
            startLevel(currentMapNode);
        }
        return;
    }

    if (gameState !== "PLAYING") return; 
    
    if (e.code === controlMap.left) keys.left = true; 
    if (e.code === controlMap.right) keys.right = true; 
    if (e.code === controlMap.down) keys.down = true; 
    
    if (e.code === controlMap.jump) {
        keys.jump = true;
        if (jumpKeyReleased && player.grounded) { 
            player.vy = player.jumpPower; 
            player.grounded = false; 
            jumpKeyReleased = false; 
        }
    }
    if (e.code === controlMap.fire) keys.fire = true; 
    
    if (e.code === controlMap.blink && hasCampaignUnlock("The Mushroom Forest Castle")) {
        doBlink();
    }
    if (e.code === controlMap.deathRay) {
        fireDeathRay();
    }
});

window.addEventListener("keyup", (e) => {
    if (e.code === controlMap.left) { keys.left = false; mapKeysReleased.left = true; }
    if (e.code === controlMap.right) { keys.right = false; mapKeysReleased.right = true; }
    if (e.code === controlMap.fire) keys.fire = false; 
    if (e.code === controlMap.down) { keys.down = false; mapKeysReleased.down = true; }
    if (e.code === controlMap.jump) {
        keys.jump = false;
        jumpKeyReleased = true;
        mapKeysReleased.up = true;
    }
});

function togglePause() {
    if (gameState === "PLAYING" || gameState === "CAMPAIGN_MAP") {
        previousGameState = gameState;
        gameState = "PAUSED";
        hideAllScreens(); // Ensure all other screens are hidden
        document.getElementById("pause-menu").classList.remove("hidden");
    } else if (gameState === "PAUSED") {
        resumeGame();
    }
}

function resumeGame() {
    hideAllScreens(); // Hide the pause menu (and any other lingering screens)
    gameState = previousGameState;
    requestAnimationFrame(update); // This handles restarting the loop for both states
}

// ==========================================
// 6. SPECIAL ABILITIES LOGIC
// ==========================================
function doBlink() {
    let maxDist = 10 * tileSize; 
    let hitIdx = 10;
    let activeDisappearing = disappearingPlatforms.filter(dp => dp.alpha > 0);
    let allPlats = platforms.concat(activeDisappearing);

    for (let i = 1; i <= 10; i++) {
        let testX = player.x + i * tileSize * player.lastFacingDir;
        let hitWall = allPlats.some(p => testX + player.width > p.x && testX < p.x + p.width && player.y + player.height > p.y && player.y < p.y + p.height);
        let hitEnemy = enemies.some(e => testX + player.width > e.x && testX < e.x + e.width && player.y + player.height > e.y && player.y < e.y + e.height);
        let isPit = false;
        
        if (player.grounded) {
            let hasFloor = allPlats.some(p => testX + player.width > p.x && testX < p.x + p.width && player.y + player.height <= p.y && p.y - (player.y + player.height) < tileSize);
            if (!hasFloor) isPit = true;
        }

        if (hitWall || hitEnemy || isPit) {
            hitIdx = i; break;
        }
    }

    if (hitIdx < 10) {
        let safeIdx = Math.max(0, hitIdx - 1);
        player.x += safeIdx * tileSize * player.lastFacingDir;
    } else {
        player.x += maxDist * player.lastFacingDir;
    }
    createParticles(player.x, player.y, "#8A2BE2", 30);
}

function fireDeathRay() {
    if (player.deathRayUses > 0) {
        player.deathRayUses--;
        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            if (e.x > camera.x && e.x < camera.x + canvas.width && e.y > camera.y && e.y < camera.y + canvas.height) {
                activeDeathRays.push({ x1: player.x + player.width/2, y1: player.y + player.height/2, x2: e.x + e.width/2, y2: e.y + e.height/2, life: 15 });
                e.hp = 0;
                createParticles(e.x, e.y, "#00FFFF", 20);
                enemies.splice(i, 1);
                score += (e.type === "boss" ? 500 : 50);
                if (gameMode === "endless" && e.type !== "boss") {
                    endlessEnemiesDefeated++;
                    if (endlessEnemiesDefeated > endlessEnemiesHighScore) {
                        endlessEnemiesHighScore = endlessEnemiesDefeated;
                        setCookie("wizardEndlessEnemiesHighScoreRecord", endlessEnemiesHighScore, 365);
                    }
                }
                if (e.type === "boss") {
                    if (goal) goal.active = true;
                    bossesDefeated++;
                }
            }
        }
    }
}

function breakShield() {
    player.hasShield = false;
    player.invincibilityTimer = 60;
    createParticles(player.x, player.y, "#FFD700", 20);
    
    if (player.hasShatter) {
        player.hasShatter = false;
        enemyFireballs.length = 0;
        for (let e of enemies) {
            let dx = e.x - player.x;
            let dy = e.y - player.y;
            let dist = Math.hypot(dx, dy) || 1;
            let pushForce = tileSize * 0.5;
            e.vx = (dx / dist) * pushForce;
            e.vy = (dy / dist) * pushForce - tileSize * 0.1;
            e.grounded = false;
        }
        createParticles(player.x, player.y, "#ffffff", 50);
    }
}

// ==========================================
// 7. GAME LOGIC & COLLISION
// ==========================================
function getLevelStatus(levelName) {
    if (completedLevels.includes(levelName)) return "green";

    if (levelName === "The Castle Gates" || levelName === "The Goblin King's Castle") {
        let total = Object.keys(campaignLevels).length;
        if (completedLevels.length < total - 2) return "gray";
    }

    if (levelName === "Wizard Training") return "blue";

    for (let comp of completedLevels) {
        let node = campaignLevels[comp];
        if (node.up === levelName || node.down === levelName || node.left === levelName || node.right === levelName) {
            return "blue";
        }
    }
    return "gray";
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) { 
        particles.push({
            x: x, y: y, 
            vx: (Math.random() - 0.5) * (tileSize * 0.15), vy: (Math.random() - 0.5) * (tileSize * 0.15), 
            life: 30, color: color 
        });
    }
}

function handlePlayerDeath() {
    createParticles(player.x, player.y, player.color, 30); 
    enemyFireballs = [];
    
    if (gameMode === "endless") {
        score = 0; highestEndlessX = 0; bossesDefeated = 0;
        endlessBossesSpawned = 0; endlessEnemiesDefeated = 0;
        buildLevel(); resetPlayer();
    } else {
        lives--; 
        if (gameMode === "campaign") {
			campaignPowerups = [];
            saveCampaignState(); // Save reduced lives count to localStorage
        }
        if (lives <= 0) { 
            gameState = "GAME_OVER"; 
            document.getElementById("go-title").innerText = "You Died"; 
            document.getElementById("go-stats").innerText = `Score: ${score} \n You were lost in the realm...`; 
            document.getElementById("game-over").classList.remove("hidden"); 
        } else {
            buildLevel(); resetPlayer(); 
        }
    }
}

function saveCampaignState() {
    setCookie("wizardCompletedLevels", JSON.stringify(completedLevels), 365);
    setCookie("wizardCurrentNode", currentMapNode, 365);
    setCookie("wizardLives", lives, 365);
    setCookie("wizardCampaignPowerups", JSON.stringify(campaignPowerups), 365);
}

function saveCampaignPowerups() {
    campaignPowerups = [];
    if (player.hasLevitation) campaignPowerups.push("jump");
    if (player.hasFireball) campaignPowerups.push("fire");
    if (player.hasShield) campaignPowerups.push("shield");
    if (player.hasShockwaveBoots) campaignPowerups.push("boots");
    if (player.hasFamiliar) campaignPowerups.push("familiar");
    if (player.hasMagnet) campaignPowerups.push("magnet");
    if (player.hasShatter) campaignPowerups.push("shatter");
    if (player.deathRayUses > 0) campaignPowerups.push(`deathray:${player.deathRayUses}`);
    
    saveCampaignState(); // Automatically sync lives and state when powerups update
}

function setEnemyVx(e, newVx) {
    if (e.dirChangeCooldown === undefined) e.dirChangeCooldown = 0;
    if (Math.sign(newVx) !== Math.sign(e.vx) && e.vx !== 0 && newVx !== 0) {
        if (e.dirChangeCooldown <= 0) {
            e.vx = newVx; e.dirChangeCooldown = 30; 
        }
    } else { e.vx = newVx; }
}

function update(timestamp) {
    if (gameState === "CAMPAIGN_MAP" || gameState === "PLAYING") {
        if (!timestamp) timestamp = performance.now();
        let deltaTime = timestamp - lastTime;
        if (deltaTime < frameInterval) {
            requestAnimationFrame(update);
            return;
        }
        lastTime = timestamp - (deltaTime % frameInterval);

        if (gameState === "CAMPAIGN_MAP") {
            drawMap();
            requestAnimationFrame(update);
            return;
        }
    }

    if (gameState !== "PLAYING") return; 

    if (globalFreezeTimer > 0) globalFreezeTimer--;

    if (gameMode === "endless") { 
        if (player.x > highestEndlessX) {
            highestEndlessX = player.x; 
            if (highestEndlessX > endlessHighScore) {
                endlessHighScore = Math.floor(highestEndlessX);
                setCookie("wizardEndlessHighScore", endlessHighScore, 365);
            }
        }
        score = Math.floor(highestEndlessX / (tileSize / 4)); 

        let currentDistanceMeters = Math.floor(highestEndlessX / (tileSize / 4));
        let isBossChunk = false;
        
        let targetBossMeters = (endlessBossesSpawned + 1) * 500;
        if (currentDistanceMeters >= targetBossMeters && player.x > mapWidth - (tileSize * 30)) {
            isBossChunk = true; endlessBossesSpawned++; 
        }

        if (player.x > mapWidth - (tileSize * 30)) { 
            let diff = Math.min(0.3 + (bossesDefeated * 0.05), 0.9); 
            let currentGridX = Math.round(mapWidth / tileSize);
            mapWidth = generateChunk(currentGridX, diff, isBossChunk) * tileSize; 
        }
    }

    if (player.fireCooldown > 0) player.fireCooldown--; 
    if (player.invincibilityTimer > 0) player.invincibilityTimer--; 

    let movedEntities = new Set();
    
    let allElevators = platforms.concat(disappearingPlatforms.filter(dp => dp.isElevator));
    for (let p of allElevators) {
        if (p.isElevator && (p.alpha === undefined || p.alpha > 0)) {
            let oldY = p.y;
            let range = (p.maxY - p.minY) / 2;
            let mid = p.minY + range;
            p.y = mid + Math.sin(Date.now() / 1500 + p.phase) * range;
            let dy = p.y - oldY;
            
            let checkEntity = (ent) => {
                if (!movedEntities.has(ent) && ent.x + ent.width > p.x && ent.x < p.x + p.width && Math.abs((ent.y + ent.height) - oldY) <= 2) {
                    ent.y += dy;
                    movedEntities.add(ent); 
                    if (ent === player) ent.grounded = true;
                }
            };
            checkEntity(player); enemies.forEach(checkEntity); powerups.forEach(checkEntity); spikes.forEach(checkEntity);
        }
    }

    if (keys.fire && player.hasFireball && player.fireCooldown <= 0) { 
        let dir = player.lastFacingDir;
        let fSize = hasCampaignUnlock("The Sphinx") ? tileSize * 0.5 : tileSize * 0.25;
        let vShot = tileSize * 0.2;
        let spawnX = player.x + (player.width / 2) + (dir > 0 ? player.width * 0.5 : -player.width * 0.5 - fSize);
        let spawnY = player.y + (player.height / 2) - (fSize / 2);

        fireballs.push({ x: spawnX, y: spawnY, vx: vShot * dir, vy: 0, width: fSize, height: fSize, freeze: false, isFamiliarShot: false }); 
        
        if (hasCampaignUnlock("The Volcano Island Castle")) {
            let diagV = vShot * 0.707;
            let icicleSize = tileSize * 0.25;
            let iSpawnX = player.x + (player.width / 2) + (dir > 0 ? player.width * 0.5 : -player.width * 0.5 - icicleSize);
            let iSpawnY = player.y + (player.height / 2) - (icicleSize / 2);

            fireballs.push({ x: iSpawnX, y: iSpawnY, vx: diagV * dir, vy: -diagV, width: icicleSize, height: icicleSize, freeze: true, isFamiliarShot: false });
            fireballs.push({ x: iSpawnX, y: iSpawnY, vx: diagV * dir, vy: diagV, width: icicleSize, height: icicleSize, freeze: true, isFamiliarShot: false });
        }
        player.fireCooldown = 20; 
    }

    // --- SPRITE ANIMATION UPDATE LOGIC ---
    if (keys.left) { 
        player.vx = -player.speed; 
        player.lastFacingDir = -1; 
        
        player.frameTimer++;
        if (player.frameTimer > player.frameInterval) {
            player.frameX = (player.frameX + 1) % player.maxFrames;
            player.frameTimer = 0;
        }
    } 
    else if (keys.right) { 
        player.vx = player.speed; 
        player.lastFacingDir = 1; 
        
        player.frameTimer++;
        if (player.frameTimer > player.frameInterval) {
            player.frameX = (player.frameX + 1) % player.maxFrames;
            player.frameTimer = 0;
        }
    } 
    else { 
        player.vx = 0; 
        
        // Reset to standing still when keys are released
        player.frameX = 0;
        player.frameTimer = 0;
    } 
    // -------------------------------------

    player.vy += player.gravity; 

    if (player.hasLevitation && keys.jump && player.vy > 0) {
        player.vy -= player.gravity * 0.75;
        if (player.vy < 0.3) player.vy = 0.3;
    }

    player.x += player.vx; 
    for (let p of platforms) { 
        if (checkCollision(player, p)) { 
            if (player.vx > 0) player.x = p.x - player.width; 
            else if (player.vx < 0) player.x = p.x + p.width; 
            player.vx = 0; 
        }
    }
    for (let dp of disappearingPlatforms) {
        if (dp.alpha > 0 && checkCollision(player, dp)) {
            if (player.vx > 0) player.x = dp.x - player.width;
            else if (player.vx < 0) player.x = dp.x + dp.width;
            player.vx = 0;
        }
    }

    let wasGrounded = player.grounded;
    player.y += player.vy; 
    player.grounded = false; 

    for (let p of platforms) { 
        if (checkCollision(player, p)) { 
            if (player.vy > 0) { 
                player.y = p.y - player.height; player.vy = 0; player.grounded = true; 
            } else if (player.vy < 0) { 
                player.y = p.y + p.height; player.vy = 0; 
            }
        }
    }
    for (let dp of disappearingPlatforms) {
        if (dp.alpha > 0 && checkCollision(player, dp)) {
            if (player.vy > 0) {
                player.y = dp.y - player.height; player.vy = 0; player.grounded = true;
                if (!dp.triggered) dp.triggered = true;
            } else if (player.vy < 0) {
                player.y = dp.y + dp.height; player.vy = 0;
            }
        }
    }

    if (!wasGrounded && player.grounded && player.hasShockwaveBoots && keys.down) {
        for (let e of enemies) {
            let dist = Math.abs(e.x - player.x);
            if (dist < tileSize * 8 && Math.abs(e.y - player.y) < tileSize * 4) {
                e.vx = (e.x > player.x ? 1 : -1) * tileSize * 0.4;
                e.vy = -tileSize * 0.2;
                e.grounded = false;
            }
        }
        createParticles(player.x + player.width/2, player.y + player.height, "#8B4513", 30);
    }

    for (let dp of disappearingPlatforms) {
        if (dp.triggered) {
            dp.disappearTimer--;
            dp.alpha = Math.max(0, dp.disappearTimer / 90);
        }
    }

    for (let s of spikes) {
        if (checkCollision(player, s) && player.invincibilityTimer <= 0) {
            if (player.hasShield) { breakShield(); } 
            else { handlePlayerDeath(); requestAnimationFrame(update); return; }
        }
    }

    if (player.hasFamiliar) {
        let targetX = player.x - player.lastFacingDir * tileSize * 0.8;
        let targetY = player.y - tileSize * 0.5;
        familiarObj.x += (targetX - familiarObj.x) * 0.1;
        familiarObj.y += (targetY - familiarObj.y) * 0.1;
        
        if (familiarObj.fireCooldown <= 0) {
            let nearest = null; let minDist = 15 * tileSize;
            for (let e of enemies) {
                let d = Math.hypot(e.x - familiarObj.x, e.y - familiarObj.y);
                if (d < minDist && e.x > camera.x && e.x < camera.x + canvas.width) { minDist = d; nearest = e; }
            }
            if (nearest) {
                let dx = nearest.x - familiarObj.x;
                let dy = nearest.y - familiarObj.y;
                let dist = Math.hypot(dx, dy);
                fireballs.push({
                    x: familiarObj.x, y: familiarObj.y,
                    vx: (dx/dist)*tileSize*0.2, vy: (dy/dist)*tileSize*0.2,
                    width: tileSize*0.25, height: tileSize*0.25,
                    freeze: false, isFamiliarShot: true
                });
                familiarObj.fireCooldown = 60;
            }
        } else { familiarObj.fireCooldown--; }
    }

    if (player.hasMagnet) {
        for (let pw of powerups) {
            let dx = player.x + player.width/2 - (pw.x + pw.width/2);
            let dy = player.y + player.height/2 - (pw.y + pw.height/2);
            let dist = Math.hypot(dx, dy);
            if (dist < 8 * tileSize) {
                pw.x += (dx / dist) * tileSize * 0.15; pw.y += (dy / dist) * tileSize * 0.15;
            }
        }
    }

    for (let i = fireballs.length - 1; i >= 0; i--) { 
        let f = fireballs[i]; 
        f.x += f.vx; f.y += f.vy; 
        createParticles(f.x + f.width / 2, f.y + f.height / 2, f.freeze || f.isFamiliarShot ? "#00FFFF" : "#FFA500", 1);
        
        let hit = false; 
        for (let p of platforms) if (checkCollision(f, p)) hit = true; 
        for (let dp of disappearingPlatforms) if (dp.alpha > 0 && checkCollision(f, dp)) hit = true;
        
        for (let j = enemies.length - 1; j >= 0; j--) { 
            let e = enemies[j]; 
            if (checkCollision(f, e)) { 
                hit = true; 
                if (e.type === "shielded") {
                    createParticles(f.x, f.y, "#aaaaaa", 10);
                } else {
                    e.hp -= (f.isFamiliarShot ? 0.5 : 1); 
                    if (f.freeze) e.frozenTimer = 60; 
                    createParticles(e.x, e.y, "#FF0000", 10); 
                    
                    if (e.hp <= 0) { 
                        enemies.splice(j, 1); 
                        score += (e.type === "boss" ? 500 : 50); 
                        if (gameMode === "endless" && e.type !== "boss") {
                            endlessEnemiesDefeated++;
                            if (endlessEnemiesDefeated > endlessEnemiesHighScore) {
                                endlessEnemiesHighScore = endlessEnemiesDefeated;
                                setCookie("wizardEndlessEnemiesHighScoreRecord", endlessEnemiesHighScore, 365);
                            }
                        }
                        if (e.type === "boss") {
                            if (goal) goal.active = true;
                            bossesDefeated++;
                        }
                    }
                }
            }
        }
        if (hit || Math.abs(f.x - camera.x) > (tileSize * 50)) fireballs.splice(i, 1); 
    }

    for (let i = enemyFireballs.length - 1; i >= 0; i--) {
        let f = enemyFireballs[i];
        if (!f) break;
        if (globalFreezeTimer <= 0) {
            if (f.isRock) f.vy += player.gravity;
            f.x += f.vx; f.y += f.vy;
        }
        createParticles(f.x + f.width / 2, f.y + f.height / 2 + 5, f.isRock ? "#808080" : "#FF0000", 1);
        
        let hit = false;
        for (let p of platforms) if (checkCollision(f, p)) hit = true;
        for (let dp of disappearingPlatforms) if (dp.alpha > 0 && checkCollision(f, dp)) hit = true;
        
        if (checkCollision(f, player) && player.invincibilityTimer <= 0) {
            hit = true;
            if (player.hasShield) { breakShield(); } 
            else { handlePlayerDeath(); requestAnimationFrame(update); return; }
        }
        if (hit || Math.abs(f.x - camera.x) > (tileSize * 50)) enemyFireballs.splice(i, 1);
    }

	let stompedThisFrame = false;
    for (let i = enemies.length - 1; i >= 0; i--) { 
        let e = enemies[i]; 

        if (e.dirChangeCooldown === undefined) e.dirChangeCooldown = 0;
        if (e.dirChangeCooldown > 0) e.dirChangeCooldown--;
        if (e.frozenTimer > 0) e.frozenTimer--;

        // --- ENEMY ANIMATION UPDATE ---
        if (e.vx !== 0) {
            e.frameTimer++;
            if (e.frameTimer > e.frameInterval) {
                e.frameX = (e.frameX + 1) % e.maxFrames;
                e.frameTimer = 0;
            }
        } else {
            e.frameX = 0;
            e.frameTimer = 0;
        }
        // ------------------------------

        if (globalFreezeTimer <= 0) {
            for (let s of spikes) if (checkCollision(e, s)) setEnemyVx(e, -e.vx);
            for (let j = 0; j < enemies.length; j++) {
                if (i !== j && checkCollision(e, enemies[j])) {
                    setEnemyVx(e, -e.vx); setEnemyVx(enemies[j], -enemies[j].vx);
                }
            }

            let dist = player.x - e.x;
            if (e.type === "boss") {
                let bossPlatformBox = { x: e.x - tileSize * 10, y: e.y, width: tileSize * 20, height: tileSize * 2 };
                if (player.grounded && checkCollision(player, bossPlatformBox)) e.aggro = true;
            } else {
                if (Math.abs(dist) < (tileSize * 25) && Math.abs(player.y - e.y) < (tileSize * 20)) e.aggro = true;
            }
            
            if (e.aggro) {
                let targetVx = (dist > 0) ? e.speed : -e.speed;
                setEnemyVx(e, targetVx);

                if (e.type === "boss") {
                    if (e.fireCooldown <= 0) {
                        let dirX = (dist > 0) ? 1 : -1;
                        let ebSize = tileSize * 0.375;
                        enemyFireballs.push({ x: e.x + (e.width / 2) + (dirX > 0 ? e.width * 0.5 : -e.width * 0.5 - ebSize), y: e.y + (e.height / 2) - (ebSize / 2), vx: tileSize * 0.15 * dirX, vy: 0, width: ebSize, height: ebSize });
                        let bossDifficulty = gameMode === "campaign" ? completedLevels.length : bossesDefeated;
                        e.fireCooldown = 90 - Math.min(60, bossDifficulty); 
                    } else { e.fireCooldown--; }
                    if (e.grounded) {
                        if (player.y < e.y - tileSize || Math.random() < 0.03) {
                            e.vy = e.jumpPower; e.grounded = false;
                        }
                    }
                }
                if (e.type === "rockThrower") {
                    if (e.fireCooldown <= 0) {
                        let dirX = (dist > 0) ? 1 : -1;
                        let rockSize = tileSize * 0.25;
                        enemyFireballs.push({ x: e.x + (e.width / 2) + (dirX > 0 ? e.width * 0.5 : -e.width * 0.5 - rockSize), y: e.y + (e.height / 2) - (rockSize / 2), vx: tileSize * 0.10 * dirX, vy: -tileSize * 0.22, width: rockSize, height: rockSize, isRock: true });
                        e.fireCooldown = 180; 
                    } else { e.fireCooldown--; }
                }
                if (e.type === "shaman" || e.type === "necromancer") {
                    if (e.fireCooldown <= 0) {
                        if (e.type === "shaman") {
                            let dirX = (dist > 0) ? 1 : -1;
                            let fSize = tileSize * 0.25;
                            enemyFireballs.push({ x: e.x + (e.width/2) + (dirX > 0 ? e.width*0.5 : -e.width*0.5 - fSize), y: e.y + (e.height/2) - (fSize/2), vx: tileSize * 0.10 * dirX, vy: 0, width: fSize, height: fSize, isRock: false });
                            e.fireCooldown = 180; 
						} else if (e.type === "necromancer") {
                            let goblinSize = tileSize * 0.75;
                            enemies.push({ x: e.x, y: e.y - goblinSize, width: goblinSize, height: goblinSize, vx: tileSize * 0.05 * (dist > 0 ? 1 : -1), speed: tileSize * 0.05, hp: 1, type: "goblin", jumpPower: enemyJumpPower, grounded: false, vy: 0, dirChangeCooldown: 0, fireCooldown: 0, frameX: 0, maxFrames: 4, frameTimer: 0, frameInterval: 6 });
                            e.fireCooldown = 300; 
                        }
                    } else { e.fireCooldown--; }
                }

                e.vy = e.vy === undefined ? 0 : e.vy + player.gravity;
                e.x += e.vx;

                let activeDisappearing = disappearingPlatforms.filter(dp => dp.alpha > 0);
                let allPlats = platforms.concat(activeDisappearing);

                for (let p of allPlats) { 
                    if (checkCollision(e, p)) { 
                        if (e.vx > 0) e.x = p.x - e.width; 
                        else if (e.vx < 0) e.x = p.x + p.width; 
                        if (e.grounded) { e.vy = e.jumpPower; e.grounded = false; }
                    }
                }

                e.y += e.vy; e.grounded = false;
                let hasFloorUnderneath = false;
                let aheadX = e.x + (e.vx > 0 ? e.width + (tileSize * 0.25) : 0);

                for (let p of allPlats) { 
                    if (checkCollision(e, p)) { 
                        if (e.vy > 0) { e.y = p.y - e.height; e.vy = 0; e.grounded = true; } 
                        else if (e.vy < 0) { e.y = p.y + p.height; e.vy = 0; }
                    }
                    if (aheadX > p.x - 2 && aheadX < p.x + p.width + 2 && e.y + e.height <= p.y && p.y - (e.y + e.height) < tileSize) {
                        hasFloorUnderneath = true;
                    }
                }

                if (e.grounded && !hasFloorUnderneath && e.type !== "boss") {
                    e.x -= e.vx; setEnemyVx(e, -e.vx);
                }
            }
        } else {
            e.vy = e.vy === undefined ? 0 : e.vy + player.gravity;
            e.y += e.vy; e.grounded = false;
            let activeDisappearing = disappearingPlatforms.filter(dp => dp.alpha > 0);
            let allPlats = platforms.concat(activeDisappearing);
            for (let p of allPlats) { 
                if (checkCollision(e, p)) { 
                    if (e.vy > 0) { e.y = p.y - e.height; e.vy = 0; e.grounded = true; } 
                    else if (e.vy < 0) { e.y = p.y + p.height; e.vy = 0; }
                }
            }
        }

        if (checkCollision(player, e)) { 
            let hitY = (player.vy > 0 || stompedThisFrame) && player.y + player.height <= e.y + e.height * (e.type === "boss" ? 0.65 : 0.5);
            if (hitY) { 
                e.hp--; 
                if (!stompedThisFrame) {
                    player.vy = player.jumpPower * (e.type === "boss" ? 1.0 : 0.7); 
                    stompedThisFrame = true;
                }
                createParticles(e.x, e.y, "#FF0000", 15); 
                if (e.type === "boss") player.invincibilityTimer = 10;
                
                if (e.hp <= 0) { 
                    enemies.splice(i, 1); 
                    score += (e.type === "boss" ? 500 : 50); 
                    if (gameMode === "endless" && e.type !== "boss") {
                        endlessEnemiesDefeated++;
                        if (endlessEnemiesDefeated > endlessEnemiesHighScore) setCookie("wizardEndlessEnemiesHighScoreRecord", endlessEnemiesDefeated, 365);
                    }
                    if (e.type === "boss") {
                        if (goal) goal.active = true;
                        bossesDefeated++;
                    }
                }
            } else if (player.invincibilityTimer <= 0) {
                if (player.hasShield) { breakShield(); } 
                else { handlePlayerDeath(); requestAnimationFrame(update); return; }
            }
        }
    }

    for (let i = powerups.length - 1; i >= 0; i--) { 
        if (checkCollision(player, powerups[i])) { 
            let type = powerups[i].type; 
            powerups.splice(i, 1); 
            score += 25; 
            
            if (type === "jump") { if (!player.hasLevitation) { player.hasLevitation = true; updatePhysicsConstants(); } } 
            else if (type === "fire") { player.hasFireball = true; } 
            else if (type === "shield") { player.hasShield = true; } 
            else if (type === "deathray") { player.deathRayUses = 3; } 
            else if (type === "health") { 
                lives++; 
                if (gameMode === "campaign") saveCampaignState();
            }
            else if (type === "boots") { player.hasShockwaveBoots = true; }
            else if (type === "freeze") { globalFreezeTimer = 600; }
            else if (type === "familiar") { player.hasFamiliar = true; }
            else if (type === "magnet") { player.hasMagnet = true; }
            else if (type === "stardust") { player.invincibilityTimer = 600; }
            else if (type === "shatter") { player.hasShatter = true; }

            if (gameMode === "campaign") {
                saveCampaignPowerups();
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) { 
        let p = particles[i]; 
        p.x += p.vx; p.y += p.vy; 
        p.life--; 
        if (p.life <= 0) particles.splice(i, 1); 
    }

    for (let i = activeDeathRays.length - 1; i >= 0; i--) {
        activeDeathRays[i].life--;
        if (activeDeathRays[i].life <= 0) activeDeathRays.splice(i, 1);
    }

    if (goal && goal.active && checkCollision(player, goal)) { 
        if (gameMode === "campaign") {
            if (!completedLevels.includes(currentMapNode)) completedLevels.push(currentMapNode);
            saveCampaignPowerups();
            saveCampaignState();
            score += 1000; 

            let totalLevels = Object.keys(campaignLevels).length;
            if (currentMapNode === "The Goblin King's Castle") {
                gameState = "GAME_OVER"; 
                document.getElementById("go-title").innerText = "Campaign Complete!"; 
                document.getElementById("go-stats").innerText = `You have saved the kingdom from the evil Goblin King!`; 
                document.getElementById("game-over").classList.remove("hidden");
            } else {
                gameState = "LEVEL_COMPLETE";
                document.getElementById("lc-title").innerText = "Level Completed!";
                document.getElementById("lc-stats").innerText = `Successfully completed ${currentMapNode}!`;
                document.getElementById("level-completed").classList.remove("hidden");
            }
        }
    }

    if (player.y > mapHeight + (tileSize * 5)) {
        handlePlayerDeath(); 
        requestAnimationFrame(update); return;
    }

    camera.x = player.x + (player.width / 2) - (canvas.width / 2); 
    camera.y = player.y + (player.height / 2) - (canvas.height / 2); 
    
    if (gameMode === "campaign") { 
        camera.x = Math.max(0, Math.min(camera.x, mapWidth - canvas.width)); 
    } else {
        camera.x = Math.max(0, camera.x); 
    }
    camera.y = Math.max(0, Math.min(camera.y, mapHeight - canvas.height)); 

    draw(); 
    requestAnimationFrame(update); 
}

// ==========================================
// 8. DRAWING & GRAPHICS
// ==========================================
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    let mapBaseW = images.campaignMap.width > 0 ? images.campaignMap.width : 1564;
    let mapBaseH = images.campaignMap.height > 0 ? images.campaignMap.height : 799;
    let mapRatio = mapBaseW / mapBaseH;
    let canvasRatio = canvas.width / canvas.height;
    let drawW, drawH, offsetX = 0, offsetY = 0;

    if (canvasRatio > mapRatio) {
        drawW = canvas.width;
        drawH = canvas.width / mapRatio;
        offsetY = (canvas.height - drawH) / 2;
    } else {
        drawW = canvas.height * mapRatio;
        drawH = canvas.height;
        offsetX = (canvas.width - drawW) / 2;
    }

    // Calculate the scale factor of the map relative to its base dimensions
    let mapScale = drawW / mapBaseW;

    if (images.campaignMap.complete && images.campaignMap.width > 0) {
        ctx.drawImage(images.campaignMap, offsetX, offsetY, drawW, drawH);
    } else {
        ctx.fillStyle = "#222"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw level status markers scaled to the map
    for (let name in campaignLevels) {
        let node = campaignLevels[name];
        let status = getLevelStatus(name);
        let img = null;

        if (status === "gray") img = images.levelStatusGray;
        else if (status === "blue") img = images.levelStatusBlue;
        else if (status === "green") img = images.levelStatusGreen;

        let screenX = offsetX + (node.x / mapBaseW) * drawW;
        let screenY = offsetY + (node.y / mapBaseH) * drawH;

        if (img && img.complete && img.width > 0) {
            let w = img.width * mapScale;
            let h = img.height * mapScale;
            ctx.drawImage(img, screenX - w / 2, screenY - h / 2, w, h); 
        } else {
            // Fallback rectangle scaling
            let w = 43 * mapScale;
            let h = 31 * mapScale;
            ctx.fillStyle = status;
            ctx.fillRect(screenX - w / 2, screenY - h / 2, w, h);
        }
    }

    // Draw wizard map icon scaled to the map as well
    let cNode = campaignLevels[currentMapNode];
    let cScreenX = offsetX + (cNode.x / mapBaseW) * drawW;
    let cScreenY = offsetY + (cNode.y / mapBaseH) * drawH;

    if (images.wizardMapIcon.complete && images.wizardMapIcon.width > 0) {
        let w = images.wizardMapIcon.width * mapScale;
        let h = images.wizardMapIcon.height * mapScale;
        ctx.drawImage(images.wizardMapIcon, cScreenX - w / 2, cScreenY - h / 2, w, h); 
    } else {
        let w = 41 * mapScale;
        let h = 53 * mapScale;
        ctx.fillStyle = "#fff";
        ctx.fillRect(cScreenX - w / 2, cScreenY - h / 2, w, h);
    }

    // HUD overlay text
	// Dynamically scale font size based on canvas width (e.g., ~1.2% of width, with a minimum size)
    let dynamicFontSize = Math.max(14, Math.floor(canvas.width * 0.012));
    ctx.font = `bold ${dynamicFontSize}px Palatino Linotype, serif`; 
    ctx.textBaseline = "middle";

    let hudHeight = dynamicFontSize * 2.5;
    let padding = dynamicFontSize * 0.8;

    // HUD background box
    ctx.fillStyle = "rgba(15, 5, 25, 0.9)";
    ctx.fillRect(0, canvas.height - hudHeight, canvas.width, hudHeight);
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, canvas.height - hudHeight, canvas.width, hudHeight);

    ctx.fillStyle = "#ffd700";
    ctx.fillText(`Current Level: ${currentMapNode}`, padding, canvas.height - (hudHeight / 2));
    
    // Scale positioning for instruction text and lives counter proportionally
    let instructionsText = `Use direction keys to travel. Press ${controlMap.enter} to start level.`;
    let instructionsWidth = ctx.measureText(instructionsText).width;
    
    ctx.fillText(instructionsText, canvas.width - instructionsWidth - (padding * 4), canvas.height - (hudHeight / 2));
    ctx.fillText(`Lives: ${lives}`, canvas.width / 2 - 40, canvas.height - (hudHeight / 2));
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    
    let bgToDraw = currentBackground || images.background;
    if (bgToDraw.complete && bgToDraw.width > 0) {
        let bgRatio = bgToDraw.width / bgToDraw.height;
        let canvasRatio = canvas.width / canvas.height;
        let drawW, drawH;
        
        if (canvasRatio > bgRatio) {
            drawW = canvas.width; drawH = canvas.width / bgRatio;
        } else {
            drawW = canvas.height * bgRatio; drawH = canvas.height;
        }
        let xOffset = (camera.x * 0.3) % drawW; 
        ctx.drawImage(bgToDraw, -xOffset, 0, drawW, drawH);
        ctx.drawImage(bgToDraw, drawW - xOffset, 0, drawW, drawH);
    } else {
        ctx.fillStyle = "#100b2b"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.save(); 
    ctx.translate(-camera.x, -camera.y); 

    for (let ray of activeDeathRays) {
        ctx.strokeStyle = "#00FFFF";
        ctx.lineWidth = Math.random() * 4 + (tileSize * 0.05);
        ctx.beginPath();
        ctx.moveTo(ray.x1, ray.y1);
        let midX = (ray.x1 + ray.x2) / 2 + (Math.random() * tileSize - (tileSize * 0.5));
        let midY = (ray.y1 + ray.y2) / 2 + (Math.random() * tileSize - (tileSize * 0.5));
        ctx.lineTo(midX, midY);
        ctx.lineTo(ray.x2, ray.y2);
        ctx.stroke();
    }

	for (let p of platforms) { 
		// Dynamically grab the style; fallback to "stone" if the texture key is invalid/missing
		let style = PLATFORM_STYLES[p.texture] || PLATFORM_STYLES.stone;

		for (let w = 0; w < p.width; w += tileSize) {
			let drawW = Math.min(tileSize, p.width - w);
			for (let h = 0; h < p.height; h += tileSize) {
				let drawH = Math.min(tileSize, p.height - h);
				
				if (style.image && style.image.complete && style.image.width > 0) {
					ctx.drawImage(style.image, p.x + w, p.y + h, drawW, drawH);
				} else {
					ctx.fillStyle = style.fallback; 
					ctx.fillRect(p.x + w, p.y + h, drawW, drawH);
				}
			}
		}
	}

    for (let dp of disappearingPlatforms) {
        if (dp.alpha <= 0) continue; 
        ctx.save(); ctx.globalAlpha = dp.alpha;
        if (images.disappearingPlatform.complete && images.disappearingPlatform.width > 0) {
            ctx.drawImage(images.disappearingPlatform, dp.x, dp.y, dp.width, dp.height);
        } else {
            ctx.fillStyle = "#8a2be2"; ctx.fillRect(dp.x, dp.y, dp.width, dp.height);
        }
        ctx.restore();
    }

    for (let s of spikes) {
        if (images.spikes.complete && images.spikes.width > 0) {
            ctx.drawImage(images.spikes, s.x, s.y, s.width, s.height);
        } else {
            ctx.fillStyle = "#8a8a8a"; ctx.fillRect(s.x, s.y, s.width, s.height);
        }
    }

    if (goal && goal.active) { 
        if (images.portal.complete && images.portal.width > 0) {
            ctx.drawImage(images.portal, goal.x, goal.y, goal.width, goal.height);
        } else {
            ctx.fillStyle = "#8A2BE2"; ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
        }
    }

    for (let p of powerups) { 
        let offset = Math.sin(Date.now() / 200) * (tileSize * 0.075); 
        let img = images.healthPotion;
        if (p.type === "jump") img = images.potionJump;
        else if (p.type === "fire") img = images.scrollFire;
        else if (p.type === "shield") img = images.amuletShield;
        else if (p.type === "deathray") img = images.scrollDeathRay;
        else if (p.type === "boots") img = images.wizardsBoots;
        else if (p.type === "freeze") img = images.freezeTime;
        else if (p.type === "familiar") img = images.arcaneFamiliar;
        else if (p.type === "magnet") img = images.magnet;
        else if (p.type === "stardust") img = images.stardust;
        else if (p.type === "shatter") img = images.shatter;
        
        if (img.complete && img.width > 0) {
            ctx.drawImage(img, p.x, p.y + offset, p.width, p.height);
        } else {
            ctx.fillStyle = p.type === "health" ? "#ff0000" : "#FFD700"; 
            ctx.fillRect(p.x, p.y + offset, p.width, p.height);
        }
    }

	for (let e of enemies) { 
        let img = images.goblin;
        if (e.type === "boss") img = images.orcBoss;
        else if (e.type === "rockThrower") img = images.rockThrowerGoblin; 
        else if (e.type === "shaman") img = images.goblinShaman; 
        else if (e.type === "necromancer") img = images.necromancerGoblin;
        else if (e.type === "shielded") img = images.shieldedGoblin;
        
        if (e.frozenTimer > 0 || globalFreezeTimer > 0) ctx.filter = "sepia(100%) hue-rotate(180deg)"; 

        if (img.complete && img.width > 0) {
            ctx.save();
            let spriteWidth = img.width / e.maxFrames;
            let spriteHeight = img.height;

            if (e.vx > 0) { 
                ctx.translate(e.x + e.width, e.y); ctx.scale(-1, 1);
                ctx.drawImage(img, e.frameX * spriteWidth, 0, spriteWidth, spriteHeight, 0, 0, e.width, e.height);
            } else { 
                ctx.drawImage(img, e.frameX * spriteWidth, 0, spriteWidth, spriteHeight, e.x, e.y, e.width, e.height); 
            }
            ctx.restore();
        } else {
            ctx.fillStyle = e.type === "boss" ? "#006400" : (e.type === "rockThrower" ? "#556B2F" : (e.type === "shaman" || e.type === "necromancer" ? "#FF4500" : (e.type === "shielded" ? "#aaaaaa" : "#32CD32"))); 
            ctx.fillRect(e.x, e.y, e.width, e.height); 
        }
        ctx.filter = "none";
    }

    if (player.hasFamiliar && images.arcaneFamiliar.complete) {
        ctx.save();
        if (player.lastFacingDir === -1) {
            ctx.translate(familiarObj.x + tileSize * 0.6, familiarObj.y); ctx.scale(-1, 1);
            ctx.drawImage(images.arcaneFamiliar, 0, 0, tileSize * 0.6, tileSize * 0.6);
        } else {
            ctx.drawImage(images.arcaneFamiliar, familiarObj.x, familiarObj.y, tileSize * 0.6, tileSize * 0.6);
        }
        ctx.restore();
    }

    for (let f of fireballs) { 
        ctx.fillStyle = f.freeze || f.isFamiliarShot ? "#00FFFF" : "#FF4500"; 
        ctx.beginPath(); ctx.arc(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, 0, Math.PI*2); ctx.fill(); 
    }
    for (let f of enemyFireballs) { 
        ctx.fillStyle = f.isRock ? "#808080" : "#FF0000"; 
        ctx.beginPath(); ctx.arc(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, 0, Math.PI*2); ctx.fill(); 
    }

    for (let p of particles) { 
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 30; 
        let pSize = tileSize * 0.1; ctx.fillRect(p.x, p.y, pSize, pSize); ctx.globalAlpha = 1.0; 
    }

    if (player.invincibilityTimer % 10 < 5) { 
        if (images.wizard.complete && images.wizard.width > 0) {
            ctx.save();

            // --- SPRITE CROP MATH ---
            let spriteWidth = images.wizard.width / player.maxFrames;
            let spriteHeight = images.wizard.height;

            if (player.lastFacingDir === -1) {
                ctx.translate(player.x + player.width, player.y); ctx.scale(-1, 1);
                
                // Draw just the current frame, flipped
                ctx.drawImage(images.wizard, player.frameX * spriteWidth, 0, spriteWidth, spriteHeight, 0, 0, player.width, player.height);
            } else {
                // Draw just the current frame, normal
                ctx.drawImage(images.wizard, player.frameX * spriteWidth, 0, spriteWidth, spriteHeight, player.x, player.y, player.width, player.height);
            }
            // ------------------------

            ctx.restore();
        } else {
            ctx.fillStyle = player.color;  ctx.fillRect(player.x, player.y, player.width, player.height); 
        }
        
        if (player.hasShield) { 
            if (images.shieldGlow.complete && images.shieldGlow.width > 0) {
                let glowSize = player.width * 1.8;
                ctx.drawImage(images.shieldGlow, player.x + (player.width - glowSize)/2, player.y + (player.height - glowSize)/2, glowSize, glowSize);
            } else {
                ctx.strokeStyle = "#FFD700"; ctx.lineWidth = Math.max(1, tileSize * 0.075); 
                ctx.beginPath(); ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width, 0, Math.PI*2); ctx.stroke(); 
            }
        }
    }
    ctx.restore(); 

    ctx.font = "bold 24px Palatino Linotype, serif"; 
    ctx.textBaseline = "top";
    
    let uiFill = "rgba(15, 5, 25, 0.9)";
    let uiStroke = "#ffd700";
    ctx.lineWidth = 2;

    ctx.fillStyle = uiFill; ctx.fillRect(10, 10, 160, 75);
    ctx.strokeStyle = uiStroke; ctx.strokeRect(10, 10, 160, 75);
    
    ctx.fillStyle = "#ffd700"; 
    ctx.fillText(`Lives: ${gameMode === 'endless' ? '∞' : lives}`, 20, 20); 
    ctx.fillText(`Score: ${score}`, 20, 50); 
    
    let campaignText = `Level: ${currentMapNode}`;
    let endlessText = `Distance: ${Math.floor(highestEndlessX / (tileSize/4))}m`;
    let rightTextW = ctx.measureText(gameMode === "campaign" ? campaignText : endlessText).width;
    let rightW = gameMode === "campaign" ? Math.max(220, rightTextW + 30) : 420;
    let rightH = gameMode === "campaign" ? 45 : 105;
    let rightX = canvas.width - rightW - 10;
    
    ctx.fillStyle = uiFill; ctx.fillRect(rightX, 10, rightW, rightH);
    ctx.strokeStyle = uiStroke; ctx.strokeRect(rightX, 10, rightW, rightH);
    
    ctx.fillStyle = "#ffd700";
    if (gameMode === "campaign") { 
        ctx.fillText(campaignText, rightX + 10, 20); 
    } else {
        ctx.fillText(endlessText, rightX + 10, 20); 
        ctx.fillText(`High Score: ${Math.floor(endlessHighScore / (tileSize/4))}m`, rightX + 10, 50); 
        ctx.fillText(`Enemies: ${endlessEnemiesDefeated} (Record: ${endlessEnemiesHighScore})`, rightX + 10, 80); 
    }

    let activePowers = [];
    if (player.hasLevitation) activePowers.push({ img: images.potionJump, text: `Levitation Active` });
    if (player.hasFireball) activePowers.push({ img: images.scrollFire, text: `Fireball Ready (${controlMap.fire})` });
    if (player.deathRayUses > 0) activePowers.push({ img: images.scrollDeathRay, text: `Death Ray: ${player.deathRayUses} (${controlMap.deathRay})` });
    if (hasCampaignUnlock("The Mushroom Forest Castle")) activePowers.push({ img: null, text: `🌀 Blink Ready (${controlMap.blink})` });
    
    if (player.hasShockwaveBoots) activePowers.push({ img: images.wizardsBoots, text: `Shockwave Boots (Hold ${controlMap.down})` });
    if (globalFreezeTimer > 0) activePowers.push({ img: images.freezeTime, text: `Time Frozen (${Math.ceil(globalFreezeTimer/60)}s)` });
    if (player.hasFamiliar) activePowers.push({ img: images.arcaneFamiliar, text: `Arcane Familiar` });
    if (player.hasMagnet) activePowers.push({ img: images.magnet, text: `Magnet` });
    if (player.invincibilityTimer > 60) activePowers.push({ img: images.stardust, text: `Invincible! (${Math.ceil(player.invincibilityTimer/60)}s)` });
    if (player.hasShatter) activePowers.push({ img: images.shatter, text: `Shatter Ready` });

    if (activePowers.length > 0) {
        let iconSize = 24; let spacing = 30; let maxTextWidth = 350;
        
        for (let powerObj of activePowers) {
            let textW = ctx.measureText(powerObj.text).width;
            let totalW = powerObj.img && powerObj.img.complete && powerObj.img.width > 0 ? textW + iconSize + 30 : textW + 20;
            if (totalW > maxTextWidth) maxTextWidth = totalW;
        }

        let pBoxW = maxTextWidth + 30; let pBoxH = (activePowers.length * spacing) + 20;
        let pBoxY = canvas.height - pBoxH - 10;
        
        ctx.fillStyle = uiFill; ctx.fillRect(10, pBoxY, pBoxW, pBoxH);
        ctx.strokeStyle = uiStroke; ctx.strokeRect(10, pBoxY, pBoxW, pBoxH);
        
        ctx.fillStyle = "#ffd700";
        for (let i = 0; i < activePowers.length; i++) {
            let yPos = pBoxY + 15 + (i * spacing);
            let powerObj = activePowers[i];
            if (powerObj.img && powerObj.img.complete && powerObj.img.width > 0) {
                ctx.drawImage(powerObj.img, 20, yPos - 5, iconSize, iconSize); ctx.fillText(powerObj.text, 20 + iconSize + 10, yPos);
            } else {
                ctx.fillText(powerObj.text, 20, yPos);
            }
        }
    }
}

// ==========================================
// 10. MENUS & UI 
// ==========================================
function hideAllScreens() {
    document.querySelectorAll(".screen").forEach(el => el.classList.add("hidden")); 
}

function showMainMenu() {
    gameState = "MENU"; 
    hideAllScreens(); 
    document.getElementById("main-menu").classList.remove("hidden"); 
}

function switchPowerupTab(tabName) {
    const campaignTab = document.getElementById("campaign-powerups-tab");
    const gameplayTab = document.getElementById("gameplay-powerups-tab");
    const menagerieTab = document.getElementById("menagerie-tab");
    const buttons = document.querySelectorAll(".powerup-tabs button");

    buttons.forEach(btn => btn.classList.remove("active"));
    campaignTab.classList.add("hidden"); gameplayTab.classList.add("hidden"); menagerieTab.classList.add("hidden");

    if (tabName === "campaign") { campaignTab.classList.remove("hidden"); buttons[0].classList.add("active"); }
    else if (tabName === "gameplay") { gameplayTab.classList.remove("hidden"); buttons[1].classList.add("active"); }
    else if (tabName === "menagerie") { menagerieTab.classList.remove("hidden"); buttons[2].classList.add("active"); }
}

function showPowerups(fromPause = false) {
    returnToPause = fromPause;
    hideAllScreens();
    document.getElementById("powerups-screen").classList.remove("hidden");
    
    switchPowerupTab('campaign');
    const list = document.getElementById("powerup-list");
    
    const powers = [
        { loc: "The Sphinx", title: "Large Fireballs", desc: "Doubles the size of the Wizard's Fireballs permanently." },
        { loc: "The Volcano Island Castle", title: "Icicles", desc: "Shoots two icicles at 45 degree angles when shooting a Fireball." },
        { loc: "The Tundra Castle", title: "Extra Jump Height", desc: "Increases the Wizard's base jump height permanently." },
        { loc: "The Mushroom Forest Castle", title: "Blink", desc: `Instantly teleports the Wizard safely forward 10 squares.` }
    ];

    list.innerHTML = "";
    powers.forEach(p => {
        let isUnlocked = hasCampaignUnlock(p.loc);
        let div = document.createElement("div");
        div.className = "powerup-item" + (isUnlocked ? "" : " locked");
        div.innerHTML = `<h3>${p.loc}: ${p.title} ${isUnlocked ? "✅" : "🔒"}</h3>
                         <p>${p.desc}</p>
                         <small>${isUnlocked ? "Unlocked!" : "Complete " + p.loc + " to earn."}</small>`;
        list.appendChild(div);
    });

    const gameplayList = document.getElementById("gameplay-powerup-list");
    gameplayList.innerHTML = "";

    const gameplayPowers = [
        { imgs: ["assets/potion_jump.png"], desc: `Levitation: When the Levitation wings are picked up, the Wizard gains the ability to jump higher. The Wizard also gains the ability to \"slow fall\" if they hold the ${controlMap.jump} button.` },
        { imgs: ["assets/amulet_shield.png", "assets/shield_glow.png"], desc: "Amulet: When the Amulet is picked up, a protective Shield is placed around the Wizard that protects the Wizard from one hit of damage from either a trap or an enemy." },
        { imgs: ["assets/scroll_fire.png"], desc: "Fireball: When the Scroll is picked up, the Wizard gains the Fireball spell." },
        { imgs: ["assets/scroll_deathray.png"], desc: "Death Ray: When the Death Ray is picked up, the Wizard gains up to three charges of the Death Ray spell. The Death Ray instantly kills any enemies visible to the Wizard." },
        { imgs: ["assets/health_potion.png"], desc: "Health Potion: +1 Life" },
        { imgs: ["assets/wizards_boots.png"], desc: `Shockwave Boots: Magical boots that allow the Wizard to push back nearby enemies when landing. Holding the ${controlMap.down} key while landing unleashes the shockwave.` },
        { imgs: ["assets/freeze_time.png"], desc: "Freeze Time: Freezes all enemies and enemy projectiles for 10 seconds." },
        { imgs: ["assets/arcane_familiar.png"], desc: "Arcane Familiar: An Arcane Familiar joins the Wizard, firing projectiles at enemies." },
        { imgs: ["assets/magnets_how_do_they_work.png"], desc: "Magnetic: Continuously draws all powerup items within a large radius directly towards the Wizard's location, automatically pulling in and gaining the powerup." },
        { imgs: ["assets/stardust.png"], desc: "Stardust: Grants invincibility for 10 seconds." },
        { imgs: ["assets/shockwave_shatter.png"], desc: "Shatter: When the Wizard's shield breaks from damage, it causes a shockwave that destroys all projectiles on screen and pushes all enemies on screen backwards away from the Wizard." }
    ];

    gameplayPowers.forEach(gp => {
        let itemDiv = document.createElement("div");
        itemDiv.className = "gameplay-powerup-item";
        let iconsHtml = `<div class="icon-container">`;
        gp.imgs.forEach(imgSrc => { iconsHtml += `<img src="${imgSrc}" alt="Powerup Icon">`; });
        iconsHtml += `</div>`;
        itemDiv.innerHTML = `${iconsHtml}<p>${gp.desc}</p>`;
        gameplayList.appendChild(itemDiv);
    });

    const menagerieList = document.getElementById("menagerie-list");
    menagerieList.innerHTML = "";

    const enemiesData = [
        { img: "assets/goblin.png", title: "Goblin", desc: "A standard foot soldier that patrols platforms. Can be defeated by jumping on its head or using spells." },
        { img: "assets/rock_thrower_goblin.png", title: "Rock Thrower", desc: "A ranged goblin that hurls heavy stones toward the wizard from a distance." },
        { img: "assets/shielded_goblin.png", title: "Shielded Goblin", desc: "Equipped with a sturdy defense shield that completely blocks incoming fireball and projectile attacks." },
        { img: "assets/goblin_shaman.png", title: "Goblin Shaman", desc: "A magical spellcaster that fires hazardous magic projectiles at the Wizard." },
        { img: "assets/necromancer_goblin.png", title: "Necromancer", desc: "A dark sorcerer that periodically summons fresh goblin reinforcements." },
        { img: "assets/orc_boss.png", title: "Orc Boss", desc: "A mean orc boss that can jump and shoot fireballs. Think fast!" }
    ];

    enemiesData.forEach(enemy => {
        let itemDiv = document.createElement("div");
        itemDiv.className = "gameplay-powerup-item";
        let iconsHtml = `<div class="icon-container"><img src="${enemy.img}" alt="${enemy.title}"></div>`;
        itemDiv.innerHTML = `${iconsHtml}<div><h3 style="margin: 0 0 5px 0; color: #ff8c00;">${enemy.title}</h3><p>${enemy.desc}</p></div>`;
        menagerieList.appendChild(itemDiv);
    });
}

function renderControlsMenu() {
    const list = document.getElementById("controls-list");
    list.innerHTML = "";
    
    const labels = {
        left: "Move Left", right: "Move Right", jump: "Jump", 
        fire: "Cast Fireball", deathRay: "Use Death Ray", 
        blink: "Blink", down: "Stomp/Shockwave", enter: "Map Enter Level", pause: "Pause Game"
    };

    for (let key in controlMap) {
        let row = document.createElement("div");
        row.className = "control-row";
        
        let label = document.createElement("span");
        label.innerText = labels[key] + ": ";
        
        let btn = document.createElement("button");
        btn.innerText = awaitingKeybind === key ? "Press any key..." : controlMap[key];
        btn.onclick = () => { awaitingKeybind = key; renderControlsMenu(); };

        row.appendChild(label); row.appendChild(btn); list.appendChild(row);
    }
}

function showControls(fromPause = false) {
    returnToPause = fromPause; hideAllScreens();
    document.getElementById("controls-screen").classList.remove("hidden");
    awaitingKeybind = null; renderControlsMenu();
}

function goBackFromSubmenu() {
    hideAllScreens();
    if (returnToPause) {
        document.getElementById("pause-menu").classList.remove("hidden");
        gameState = "PAUSED";
    } else {
        showMainMenu();
    }
}

function startGame(mode, forceNew = false) {
    gameMode = mode; 
    hideAllScreens(); 
    score = 0; 
    highestEndlessX = 0; bossesDefeated = 0; endlessEnemiesDefeated = 0;
    
    if (mode === "endless") { 
        lives = 5;
        campaignPowerups = []; endlessBossesSpawned = 0;
        gameState = "PLAYING"; 
        buildLevel(); 
        resetPlayer(); 
    } else {
        if (forceNew) {
            completedLevels = [];
            currentMapNode = "Wizard Training";
            lives = 5;
            campaignPowerups = [];
            saveCampaignState();
        } else {
            let savedMap = getCookie("wizardCompletedLevels");
            completedLevels = savedMap ? JSON.parse(savedMap) : [];
            currentMapNode = getCookie("wizardCurrentNode") || "Wizard Training";
            
            let savedLives = getCookie("wizardLives");
            lives = savedLives !== null ? parseInt(savedLives) : 5;
            
            let savedPowerups = getCookie("wizardCampaignPowerups");
            campaignPowerups = savedPowerups ? JSON.parse(savedPowerups) : [];
        }
        gameState = "CAMPAIGN_MAP";
    }
	
	if (lives <= 0) {
		lives = 5;
	}
	
    update(); 
}

function startLevel(levelName) {
    gameState = "PLAYING";
    buildLevel();
    resetPlayer();
}

resizeCanvas();
showMainMenu();
