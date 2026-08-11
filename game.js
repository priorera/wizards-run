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
let currentLevel = 1; 
let unlockedLevels = parseInt(getCookie("wizardUnlocked")) || 1; 
let endlessHighScore = parseInt(getCookie("wizardEndlessHighScore")) || 0;
let endlessEnemiesDefeated = 0;
let endlessEnemiesHighScore = parseInt(getCookie("wizardEndlessEnemiesHighScoreRecord")) || 0;
let bossesDefeated = 0;
let endlessBossesSpawned = 0;
let returnToPause = false;

const MAX_LEVELS = 50; 
let lives = 5; 
let score = 0; 
let highestEndlessX = 0; 

// Dynamic World Variables
let tileSize; 
let mapWidth = 0; 
let mapHeight; 
let platformSpawnCounter = 0; // Tracks elevator spawns
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
// 2. ASSET SETUP
// ==========================================
const images = {
    wizard: new Image(), goblin: new Image(), rockThrowerGoblin: new Image(), stoneBrick: new Image(),
    goblinShaman: new Image(), portal: new Image(), orcBoss: new Image(), potionJump: new Image(),
    scrollFire: new Image(), amuletShield: new Image(), background: new Image(),
    healthPotion: new Image(), scrollDeathRay: new Image(), spikes: new Image(), 
    shieldGlow: new Image(), disappearingPlatform: new Image(),
    
    // NEW ASSETS
    wizardsBoots: new Image(), freezeTime: new Image(), arcaneFamiliar: new Image(),
    magnet: new Image(), stardust: new Image(), shatter: new Image(),
    necromancerGoblin: new Image(), shieldedGoblin: new Image()
};
images.wizard.src = "assets/wizard.png";
images.goblin.src = "assets/goblin.png";
images.goblinShaman.src = "assets/goblin_shaman.png";
images.rockThrowerGoblin.src = "assets/rock_thrower_goblin.png";
images.stoneBrick.src = "assets/stone_brick.png";
images.portal.src = "assets/portal.png";
images.orcBoss.src = "assets/orc_boss.png";
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
images.necromancerGoblin.src = "assets/necromancer_goblin.png";
images.shieldedGoblin.src = "assets/shielded_goblin.png";

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
    
    // Core Abilities
    hasFireball: false, 
    hasShield: false, 
    hasLevitation: false,
    deathRayUses: 0,
    fireCooldown: 0, 
    invincibilityTimer: 0,

    // New Passive Buffs
    hasShockwaveBoots: false,
    hasFamiliar: false,
    hasMagnet: false,
    hasShatter: false
};

const camera = { x: 0, y: 0 }; 
let enemyJumpPower;

let controlMap = {
    left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", 
    fire: "KeyZ", deathRay: "KeyX", blink: "KeyV", down: "ArrowDown", pause: "Escape"
};
const keys = { left: false, right: false, up: false, fire: false, down: false, jump: false }; 
let jumpKeyReleased = true;
let awaitingKeybind = null;

// ==========================================
// VIEWPORT & GRID SIZING
// ==========================================
function updatePhysicsConstants() {
    player.gravity = tileSize * 0.010;
    player.speed = (unlockedLevels >= 10) ? tileSize * 0.1375 : tileSize * 0.1;
    
    let playerBaseJump = -Math.sqrt(2 * player.gravity * (3.5 * tileSize));
    let extraJump = -Math.sqrt(2 * player.gravity * (4.5 * tileSize));
    
    player.jumpPower = (unlockedLevels >= 40 || player.hasLevitation) ? extraJump : playerBaseJump;
    enemyJumpPower = -Math.sqrt(2 * player.gravity * (2.4 * tileSize)); 
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
            p.x *= scale; p.y *= scale; p.width *= scale; p.height = tileSize; 
            if(p.minY) p.minY *= scale; 
            if(p.maxY) p.maxY *= scale; 
        });
        disappearingPlatforms.forEach(p => { 
            p.x *= scale; p.y *= scale; p.width *= scale; p.height = tileSize; 
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
// 4. PROCEDURAL LEVEL GENERATOR
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
                type: "boss", jumpPower: enemyJumpPower, fireCooldown: 0, grounded: false, vy: 0, dirChangeCooldown: 0 
            }; 
            enemies.push(boss);
        }
        if (isGoalChunk) {
            goal = { x: (currentGridX + platWGrids - 3) * tileSize, y: defaultGroundY * tileSize - (tileSize * 2), width: tileSize, height: tileSize * 2, active: (gameMode === "campaign" && !((currentLevel % 5 === 0) || currentLevel === MAX_LEVELS)) }; 
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
            
            if (player.hasShield) types.push("shatter"); // Shatter needs Shield
            
            types = types.filter(t => !spawnedChunkPowerups.includes(t));
            
            if (types.length > 0) {
                let type = types[Math.floor(Math.random() * types.length)];
                spawnedChunkPowerups.push(type);
                
                let pSize = tileSize * 0.75;
                let pwItem = { 
                    x: (currentGridX + platWGrids/2) * tileSize - pSize/2, 
                    y: (currentGridY - 1) * tileSize, 
                    width: pSize, 
                    height: pSize, 
                    type: type 
                }; 
                if (!isOccupied(pwItem.x, pwItem.y, pwItem.width, pwItem.height)) {
                    powerups.push(pwItem);
                    cpObj.hasPowerup = true;
                }
            }
        }

        if (isDisappearing) {
            platformSpawnCounter++;
            let isDisappearingElevator = (platformSpawnCounter % 2 === 0);
            let baseMinY = Math.floor(gridSpotsY * 0.3) * tileSize;
            let baseMaxY = (gridSpotsY - 2) * tileSize;
            let basePhase = Math.random() * Math.PI * 2;

            for (let k = 0; k < platWGrids; k++) {
                let dp = {
                    x: (currentGridX + k) * tileSize,
                    y: currentGridY * tileSize,
                    width: tileSize,
                    height: tileSize,
                    triggered: false,
                    disappearTimer: 90, 
                    alpha: 1.0,
                    isElevator: false,
                    minY: baseMinY,
                    maxY: baseMaxY,
                    phase: basePhase
                };
                disappearingPlatforms.push(dp);
            }
            cpObj.plat = { x: currentGridX * tileSize, y: currentGridY * tileSize, width: platWGrids * tileSize, height: tileSize, isElevator: isDisappearingElevator, minY: baseMinY, maxY: baseMaxY, phase: basePhase };
        } else {
            platformSpawnCounter++;
            let plat = { 
                x: currentGridX * tileSize, 
                y: currentGridY * tileSize, 
                width: platWGrids * tileSize, 
                height: tileSize,
                isElevator: (platformSpawnCounter % 2 === 0),
                minY: Math.floor(gridSpotsY * 0.3) * tileSize,
                maxY: (gridSpotsY - 2) * tileSize,
                phase: Math.random() * Math.PI * 2
            };
            platforms.push(plat);
            cpObj.plat = plat;
        }

        if (platWGrids >= 3 && !cpObj.hasPowerup && !isDisappearing) {
            let numSpikes = Math.min(4, 2);
            let availableIndices = [];
            
            for (let idx = 1; idx < platWGrids - 1; idx++) {
                availableIndices.push(idx);
            }
            
            let spikeIndices = [];
            while (spikeIndices.length < numSpikes && availableIndices.length > 0) {
                let randIndex = Math.floor(Math.random() * availableIndices.length);
                spikeIndices.push(availableIndices.splice(randIndex, 1)[0]);
            }

            if (spikeIndices.length > 0) {
                cpObj.hasSpikes = true;
            }

            for (let idx of spikeIndices) {
                let speedMult = gameMode === "campaign" ? (1 + (currentLevel * 0.05)) : (1 + (bossesDefeated * 0.15));
                let enemySize = tileSize * 0.75;
                
                let currentDistanceMeters = Math.floor(highestEndlessX / (tileSize / 4));
                let c = currentLevel;
                let isCamp = gameMode === "campaign";
                let isEnd = gameMode === "endless";
                
                let eligibleTypes = ["goblin"];
                if ((isCamp && c > 10) || (isEnd && currentDistanceMeters > 1000)) eligibleTypes.push("rockThrower");
                if ((isCamp && c > 20) || (isEnd && currentDistanceMeters > 2000)) eligibleTypes.push("shielded");
                if ((isCamp && c > 30) || (isEnd && currentDistanceMeters > 3000)) eligibleTypes.push("shaman");
                if ((isCamp && c > 40) || (isEnd && currentDistanceMeters > 4000)) eligibleTypes.push("necromancer");
                
                let enemyType = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];

                let goblinItem = { 
                    x: cpObj.plat.x + idx * tileSize, 
                    y: cpObj.plat.y - enemySize, 
                    width: enemySize, 
                    height: enemySize, 
                    vx: tileSize * 0.05 * speedMult, 
                    speed: tileSize * 0.05 * speedMult, 
                    hp: 1, 
                    type: enemyType, 
                    jumpPower: enemyJumpPower, 
                    grounded: false, 
                    vy: 0, 
                    dirChangeCooldown: 0,
                    fireCooldown: 0 
                };
                if (!isOccupied(goblinItem.x, goblinItem.y, goblinItem.width, goblinItem.height)) {
                    enemies.push(goblinItem);
                }
            }
        }

        createdPlatforms.push(cpObj);
        currentGridX += platWGrids;
    }

    let validSpikePlatforms = createdPlatforms.filter(cp => !cp.hasPowerup && cp.wGrids >= 3);
    let numSpikesToSpawn = gameMode === "endless" ? 3 : Math.floor(numPlatforms * difficulty * 2);

    for (let sIdx = 0; sIdx < numSpikesToSpawn && validSpikePlatforms.length > 0; sIdx++) {
        let pIdx = Math.floor(Math.random() * validSpikePlatforms.length);
        let cp = validSpikePlatforms.splice(pIdx, 1)[0];
        
        let spikeW = tileSize * 0.5;
        let spikeH = tileSize * 0.15;
        let randomIdx = Math.floor(Math.random() * (cp.wGrids - 2)) + 1;

        let sItem = { 
            x: cp.plat.x + (randomIdx * tileSize) + (tileSize - spikeW) / 2, 
            y: cp.plat.y - spikeH, 
            width: spikeW, 
            height: spikeH 
        };
        
        if (!isOccupied(sItem.x, sItem.y, sItem.width, sItem.height)) {
            spikes.push(sItem);
        }
    }

    return currentGridX; 
}

function buildLevel() {
    platforms = []; disappearingPlatforms = []; enemies = []; powerups = []; spikes = []; fireballs = []; enemyFireballs = []; particles = []; activeDeathRays = []; goal = null; 
    let gridSpotsY = Math.floor(mapHeight / tileSize);
    
    platforms.push({ x: 0, y: (gridSpotsY - 2) * tileSize, width: tileSize * 5, height: tileSize * 2, isElevator: false }); 
    platforms.push({ x: -tileSize, y: -mapHeight, width: tileSize, height: mapHeight * 3, isElevator: false }); 
    platformSpawnCounter = 0;

    let currentGridX = 5; 
    
    if (gameMode === "campaign") { 
        let numChunks = 2; 
        let difficulty = Math.min(0.2 + (currentLevel * 0.02), 0.8); 
        let isBossLevel = (currentLevel % 5 === 0) || currentLevel === MAX_LEVELS; 

        for (let i = 0; i < numChunks; i++) { 
            currentGridX = generateChunk(currentGridX, difficulty); 
        }

        if (isBossLevel) currentGridX = generateChunk(currentGridX, difficulty, true, false); 
        currentGridX = generateChunk(currentGridX, difficulty, false, true); 
        mapWidth = currentGridX * tileSize; 

        if (!isBossLevel && goal) goal.active = true;
    } else {
        currentGridX = generateChunk(currentGridX, 0.4); 
        currentGridX = generateChunk(currentGridX, 0.5); 
        mapWidth = currentGridX * tileSize; 
    }
}

function resetPlayer() {
    let gridSpotsY = Math.floor(mapHeight / tileSize);
    spawnPoint = { x: tileSize * 2, y: (gridSpotsY - 3) * tileSize };
    
    player.width = tileSize * 0.75;
    player.height = tileSize * 0.75;
    player.x = spawnPoint.x; 
    player.y = spawnPoint.y; 
    player.vx = 0; player.vy = 0; 
    
    familiarObj.x = spawnPoint.x;
    familiarObj.y = spawnPoint.y;
    globalFreezeTimer = 0;
    
    disappearingPlatforms.forEach(dp => {
        dp.triggered = false;
        dp.disappearTimer = 90;
        dp.alpha = 1.0;
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
// 5. INPUT CONTROLS & MENU LOGIC
// ==========================================
window.addEventListener("keydown", (e) => {
    if (awaitingKeybind) {
        controlMap[awaitingKeybind] = e.code;
        awaitingKeybind = null;
        renderControlsMenu();
        return;
    }

    if (e.code === controlMap.pause && (gameState === "PLAYING" || gameState === "PAUSED")) {
        togglePause();
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
    
    if (e.code === controlMap.blink && unlockedLevels >= 50) {
        doBlink();
    }
    if (e.code === controlMap.deathRay) {
        fireDeathRay();
    }
});

window.addEventListener("keyup", (e) => {
    if (e.code === controlMap.left) keys.left = false; 
    if (e.code === controlMap.right) keys.right = false; 
    if (e.code === controlMap.fire) keys.fire = false; 
    if (e.code === controlMap.down) keys.down = false; 
    if (e.code === controlMap.jump) {
        keys.jump = false;
        jumpKeyReleased = true;
    }
});

function togglePause() {
    if (gameState === "PLAYING") {
        gameState = "PAUSED";
        document.getElementById("pause-menu").classList.remove("hidden");
    } else if (gameState === "PAUSED") {
        resumeGame();
    }
}

function resumeGame() {
    gameState = "PLAYING";
    document.getElementById("pause-menu").classList.add("hidden");
    requestAnimationFrame(update);
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
        enemyFireballs = []; 
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
        score = 0;
        highestEndlessX = 0;
        bossesDefeated = 0;
        endlessBossesSpawned = 0;
        endlessEnemiesDefeated = 0;
        buildLevel();
        resetPlayer();
    } else {
        lives--; 
        if (lives <= 0) { 
            gameState = "GAME_OVER"; 
            document.getElementById("go-title").innerText = "You Died"; 
            document.getElementById("go-stats").innerText = `Score: ${score} \n Level Reached: ${currentLevel}`; 
            document.getElementById("game-over").classList.remove("hidden"); 
        } else {
            buildLevel(); 
            resetPlayer(); 
        }
    }
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
}

function setEnemyVx(e, newVx) {
    if (e.dirChangeCooldown === undefined) e.dirChangeCooldown = 0;
    if (Math.sign(newVx) !== Math.sign(e.vx) && e.vx !== 0 && newVx !== 0) {
        if (e.dirChangeCooldown <= 0) {
            e.vx = newVx;
            e.dirChangeCooldown = 30; 
        }
    } else {
        e.vx = newVx;
    }
}

function update(timestamp) {
    if (gameState !== "PLAYING") return; 

    if (!timestamp) timestamp = performance.now();
    let deltaTime = timestamp - lastTime;
    if (deltaTime < frameInterval) {
        requestAnimationFrame(update);
        return;
    }
    lastTime = timestamp - (deltaTime % frameInterval);

    // Global Freeze Timer
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
            isBossChunk = true;
            endlessBossesSpawned++; 
        }

        if (player.x > mapWidth - (tileSize * 30)) { 
            let diff = Math.min(0.3 + (bossesDefeated * 0.05), 0.9); 
            let currentGridX = Math.round(mapWidth / tileSize);
            mapWidth = generateChunk(currentGridX, diff, isBossChunk) * tileSize; 
        }
    }

    if (player.fireCooldown > 0) player.fireCooldown--; 
    if (player.invincibilityTimer > 0) player.invincibilityTimer--; 

    // Elevators & Moving Platforms Update (Runs before player physics to safely move standing entities)
    let allElevators = platforms.concat(disappearingPlatforms.filter(dp => dp.isElevator));
    for (let p of allElevators) {
        if (p.isElevator && (p.alpha === undefined || p.alpha > 0)) {
            let oldY = p.y;
            let range = (p.maxY - p.minY) / 2;
            let mid = p.minY + range;
            p.y = mid + Math.sin(Date.now() / 1500 + p.phase) * range;
            let dy = p.y - oldY;
            
            let checkEntity = (ent) => {
                if (ent.x + ent.width > p.x && ent.x < p.x + p.width && Math.abs((ent.y + ent.height) - oldY) <= 2) {
                    ent.y += dy;
                    if (ent === player) ent.grounded = true;
                }
            };
            checkEntity(player);
            enemies.forEach(checkEntity);
            powerups.forEach(checkEntity);
            spikes.forEach(checkEntity);
        }
    }

    // Player Shooting 
    if (keys.fire && player.hasFireball && player.fireCooldown <= 0) { 
        let dir = player.lastFacingDir;
        let fSize = unlockedLevels >= 20 ? tileSize * 0.5 : tileSize * 0.25;
        let vShot = tileSize * 0.2;
        let spawnX = player.x + (player.width / 2) + (dir > 0 ? player.width * 0.5 : -player.width * 0.5 - fSize);
        let spawnY = player.y + (player.height / 2) - (fSize / 2);

        fireballs.push({ x: spawnX, y: spawnY, vx: vShot * dir, vy: 0, width: fSize, height: fSize, freeze: false, isFamiliarShot: false }); 
        
        if (unlockedLevels >= 30) {
            let diagV = vShot * 0.707;
            let icicleSize = tileSize * 0.25;
            let iSpawnX = player.x + (player.width / 2) + (dir > 0 ? player.width * 0.5 : -player.width * 0.5 - icicleSize);
            let iSpawnY = player.y + (player.height / 2) - (icicleSize / 2);

            fireballs.push({ x: iSpawnX, y: iSpawnY, vx: diagV * dir, vy: -diagV, width: icicleSize, height: icicleSize, freeze: true, isFamiliarShot: false });
            fireballs.push({ x: iSpawnX, y: iSpawnY, vx: diagV * dir, vy: diagV, width: icicleSize, height: icicleSize, freeze: true, isFamiliarShot: false });
        }
        player.fireCooldown = 20; 
    }

    // Player Movement 
    if (keys.left) { player.vx = -player.speed; player.lastFacingDir = -1; } 
    else if (keys.right) { player.vx = player.speed; player.lastFacingDir = 1; } 
    else player.vx = 0; 

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
                player.y = p.y - player.height; 
                player.vy = 0; 
                player.grounded = true; 
            } else if (player.vy < 0) { 
                player.y = p.y + p.height; 
                player.vy = 0; 
            }
        }
    }
    for (let dp of disappearingPlatforms) {
        if (dp.alpha > 0 && checkCollision(player, dp)) {
            if (player.vy > 0) {
                player.y = dp.y - player.height;
                player.vy = 0;
                player.grounded = true;
                if (!dp.triggered) dp.triggered = true;
            } else if (player.vy < 0) {
                player.y = dp.y + dp.height;
                player.vy = 0;
            }
        }
    }

    // Shockwave Boots Logic
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
            if (player.hasShield) {
                breakShield();
				if (enemyFireballs.length === 0) break;
            } else {
                handlePlayerDeath();
                requestAnimationFrame(update);
                return;
            }
        }
    }

    // Familiar Logic
    if (player.hasFamiliar) {
        let targetX = player.x - player.lastFacingDir * tileSize * 0.8;
        let targetY = player.y - tileSize * 0.5;
        familiarObj.x += (targetX - familiarObj.x) * 0.1;
        familiarObj.y += (targetY - familiarObj.y) * 0.1;
        
        if (familiarObj.fireCooldown <= 0) {
            let nearest = null;
            let minDist = 15 * tileSize;
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
        } else {
            familiarObj.fireCooldown--;
        }
    }

    // Magnet Logic
    if (player.hasMagnet) {
        for (let pw of powerups) {
            let dx = player.x + player.width/2 - (pw.x + pw.width/2);
            let dy = player.y + player.height/2 - (pw.y + pw.height/2);
            let dist = Math.hypot(dx, dy);
            if (dist < 8 * tileSize) {
                pw.x += (dx / dist) * tileSize * 0.15;
                pw.y += (dy / dist) * tileSize * 0.15;
            }
        }
    }

    // Projectiles (Player)
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

    // Enemy Fireballs
    for (let i = enemyFireballs.length - 1; i >= 0; i--) {
        let f = enemyFireballs[i];
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
            if (player.hasShield) {
                breakShield();
            } else {
                handlePlayerDeath();
                requestAnimationFrame(update);
                return;
            }
        }
        if (hit || Math.abs(f.x - camera.x) > (tileSize * 50)) enemyFireballs.splice(i, 1);
    }

    // Enemies AI & Physics
    let bossAlive = false;
    let stompedThisFrame = false;

    for (let i = enemies.length - 1; i >= 0; i--) { 
        let e = enemies[i]; 
        if (e.type === "boss") bossAlive = true;

        if (e.dirChangeCooldown === undefined) e.dirChangeCooldown = 0;
        if (e.dirChangeCooldown > 0) e.dirChangeCooldown--;

        if (e.frozenTimer > 0) e.frozenTimer--;

        if (globalFreezeTimer <= 0) {
            for (let s of spikes) {
                if (checkCollision(e, s)) setEnemyVx(e, -e.vx);
            }

            for (let j = 0; j < enemies.length; j++) {
                if (i !== j) {
                    let otherE = enemies[j];
                    if (checkCollision(e, otherE)) {
                        setEnemyVx(e, -e.vx);
                        setEnemyVx(otherE, -otherE.vx);
                    }
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
                        let ebSpawnX = e.x + (e.width / 2) + (dirX > 0 ? e.width * 0.5 : -e.width * 0.5 - ebSize);
                        let ebSpawnY = e.y + (e.height / 2) - (ebSize / 2);
                        enemyFireballs.push({ x: ebSpawnX, y: ebSpawnY, vx: tileSize * 0.15 * dirX, vy: 0, width: ebSize, height: ebSize });
                        let bossDifficulty = gameMode === "campaign" ? currentLevel : bossesDefeated;
                        e.fireCooldown = 90 - Math.min(60, bossDifficulty); 
                    } else {
                        e.fireCooldown--;
                    }
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
                        let rSpawnX = e.x + (e.width / 2) + (dirX > 0 ? e.width * 0.5 : -e.width * 0.5 - rockSize);
                        let rSpawnY = e.y + (e.height / 2) - (rockSize / 2);
                        enemyFireballs.push({ 
                            x: rSpawnX, y: rSpawnY, 
                            vx: tileSize * 0.10 * dirX, vy: -tileSize * 0.22, 
                            width: rockSize, height: rockSize, isRock: true
                        });
                        e.fireCooldown = 180; 
                    } else { e.fireCooldown--; }
                }
                
                if (e.type === "shaman" || e.type === "necromancer") {
                    if (e.fireCooldown <= 0) {
                        if (e.type === "shaman") {
                            let dirX = (dist > 0) ? 1 : -1;
                            let fSize = tileSize * 0.25;
                            enemyFireballs.push({ 
                                x: e.x + (e.width/2) + (dirX > 0 ? e.width*0.5 : -e.width*0.5 - fSize), 
                                y: e.y + (e.height/2) - (fSize/2), 
                                vx: tileSize * 0.10 * dirX, vy: 0, width: fSize, height: fSize, isRock: false
                            });
                            e.fireCooldown = 180; 
                        } else if (e.type === "necromancer") {
                            let goblinSize = tileSize * 0.75;
                            let goblinItem = { 
                                x: e.x, y: e.y - goblinSize, width: goblinSize, height: goblinSize, 
                                vx: tileSize * 0.05 * (dist > 0 ? 1 : -1), speed: tileSize * 0.05, 
                                hp: 1, type: "goblin", jumpPower: enemyJumpPower, grounded: false, vy: 0, dirChangeCooldown: 0, fireCooldown: 0 
                            };
                            enemies.push(goblinItem);
                            e.fireCooldown = 300; 
                        }
                    } else {
                        e.fireCooldown--;
                    }
                }

                e.vy = e.vy === undefined ? 0 : e.vy + player.gravity;
                e.x += e.vx;

                let activeDisappearing = disappearingPlatforms.filter(dp => dp.alpha > 0);
                let allPlats = platforms.concat(activeDisappearing);

                for (let p of allPlats) { 
                    if (checkCollision(e, p)) { 
                        if (e.vx > 0) e.x = p.x - e.width; 
                        else if (e.vx < 0) e.x = p.x + p.width; 
                        if (e.grounded) {
                            e.vy = e.jumpPower; e.grounded = false;
                        }
                    }
                }

                e.y += e.vy;
                e.grounded = false;
                let hasFloorUnderneath = false;
                let aheadX = e.x + (e.vx > 0 ? e.width + (tileSize * 0.25) : -(tileSize * 0.25));

                for (let p of allPlats) { 
                    if (checkCollision(e, p)) { 
                        if (e.vy > 0) { 
                            e.y = p.y - e.height; e.vy = 0; e.grounded = true; 
                        } else if (e.vy < 0) { 
                            e.y = p.y + p.height; e.vy = 0; 
                        }
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
            // When globally frozen, still apply gravity and platform collision
            e.vy = e.vy === undefined ? 0 : e.vy + player.gravity;
            e.y += e.vy;
            e.grounded = false;
            let activeDisappearing = disappearingPlatforms.filter(dp => dp.alpha > 0);
            let allPlats = platforms.concat(activeDisappearing);

            for (let p of allPlats) { 
                if (checkCollision(e, p)) { 
                    if (e.vy > 0) { 
                        e.y = p.y - e.height; e.vy = 0; e.grounded = true; 
                    } else if (e.vy < 0) { 
                        e.y = p.y + p.height; e.vy = 0; 
                    }
                }
            }
        }

        // Enemy & Boss Collision with Player (Always Active)
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
                if (player.hasShield) { 
                    breakShield();
                } else {
                    handlePlayerDeath(); 
                    requestAnimationFrame(update);
                    return;
                }
            }
        }
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) { 
        if (checkCollision(player, powerups[i])) { 
            let type = powerups[i].type; 
            powerups.splice(i, 1); 
            score += 25; 
            
            if (type === "jump") { 
                if (!player.hasLevitation) { player.hasLevitation = true; updatePhysicsConstants(); }
            } else if (type === "fire") { player.hasFireball = true; } 
            else if (type === "shield") { player.hasShield = true; } 
            else if (type === "deathray") { player.deathRayUses = 3; } 
            else if (type === "health") { lives++; }
            else if (type === "boots") { player.hasShockwaveBoots = true; }
            else if (type === "freeze") { globalFreezeTimer = 600; }
            else if (type === "familiar") { player.hasFamiliar = true; }
            else if (type === "magnet") { player.hasMagnet = true; }
            else if (type === "stardust") { player.invincibilityTimer = 600; }
            else if (type === "shatter") { player.hasShatter = true; }
        }
    }

    // Particles & Effects
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
            if (currentLevel < MAX_LEVELS) { 
                saveCampaignPowerups();
                currentLevel++; 
                if (currentLevel > unlockedLevels) { 
                    unlockedLevels = currentLevel; 
                    setCookie("wizardUnlocked", unlockedLevels, 365); 
                }
                score += 1000; 
                buildLevel(); 
                resetPlayer(); 
            } else {
                gameState = "GAME_OVER"; 
                document.getElementById("go-title").innerText = "Campaign Complete!"; 
                document.getElementById("go-stats").innerText = `Final Score: ${score} \n You are the Archmage!`; 
                document.getElementById("game-over").classList.remove("hidden"); 
            }
        }
    }

    if (player.y > mapHeight + (tileSize * 5)) {
        handlePlayerDeath(); 
        requestAnimationFrame(update);
        return;
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
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    
    if (images.background.complete && images.background.width > 0) {
        let bgRatio = images.background.width / images.background.height;
        let canvasRatio = canvas.width / canvas.height;
        let drawW, drawH;
        
        if (canvasRatio > bgRatio) {
            drawW = canvas.width; drawH = canvas.width / bgRatio;
        } else {
            drawW = canvas.height * bgRatio; drawH = canvas.height;
        }
        let xOffset = (camera.x * 0.3) % drawW; 
        ctx.drawImage(images.background, -xOffset, 0, drawW, drawH);
        ctx.drawImage(images.background, drawW - xOffset, 0, drawW, drawH);
    } else {
        ctx.fillStyle = "#100b2b";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        for(let w = 0; w < p.width; w += tileSize) {
            let drawW = Math.min(tileSize, p.width - w);
            for(let h = 0; h < p.height; h += tileSize) {
                let drawH = Math.min(tileSize, p.height - h);
                if (images.stoneBrick.complete && images.stoneBrick.width > 0) {
                    ctx.drawImage(images.stoneBrick, p.x + w, p.y + h, drawW, drawH);
                } else {
                    ctx.fillStyle = "#4a4a4a"; ctx.fillRect(p.x + w, p.y + h, drawW, drawH);
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
            if (e.vx > 0) { 
                ctx.translate(e.x + e.width, e.y); ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, e.width, e.height);
            } else {
                ctx.drawImage(img, e.x, e.y, e.width, e.height);
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
            ctx.translate(familiarObj.x + tileSize * 0.6, familiarObj.y);
            ctx.scale(-1, 1);
            ctx.drawImage(images.arcaneFamiliar, 0, 0, tileSize * 0.6, tileSize * 0.6);
        } else {
            ctx.drawImage(images.arcaneFamiliar, familiarObj.x, familiarObj.y, tileSize * 0.6, tileSize * 0.6);
        }
        ctx.restore();
    }

    for (let f of fireballs) { 
        ctx.fillStyle = f.freeze || f.isFamiliarShot ? "#00FFFF" : "#FF4500"; 
        ctx.beginPath(); 
        ctx.arc(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, 0, Math.PI*2); 
        ctx.fill(); 
    }
    for (let f of enemyFireballs) { 
        ctx.fillStyle = f.isRock ? "#808080" : "#FF0000"; 
        ctx.beginPath(); 
        ctx.arc(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, 0, Math.PI*2); 
        ctx.fill(); 
    }

    for (let p of particles) { 
        ctx.fillStyle = p.color; 
        ctx.globalAlpha = p.life / 30; 
        let pSize = tileSize * 0.1;
        ctx.fillRect(p.x, p.y, pSize, pSize); 
        ctx.globalAlpha = 1.0; 
    }

    if (player.invincibilityTimer % 10 < 5) { 
        if (images.wizard.complete && images.wizard.width > 0) {
            ctx.save();
            if (player.lastFacingDir === -1) {
                ctx.translate(player.x + player.width, player.y); ctx.scale(-1, 1);
                ctx.drawImage(images.wizard, 0, 0, player.width, player.height);
            } else {
                ctx.drawImage(images.wizard, player.x, player.y, player.width, player.height);
            }
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

    // ==========================================
    // 9. HUD 
    // ==========================================
    ctx.font = "bold 24px Palatino Linotype, serif"; 
    ctx.textBaseline = "top";
    
    // Draw Dark Purple Background Boxes
    let uiFill = "rgba(15, 5, 25, 0.9)";
    let uiStroke = "#ffd700";
    ctx.lineWidth = 2;

    // Top Left Box
    ctx.fillStyle = uiFill;
    ctx.fillRect(10, 10, 160, 75);
    ctx.strokeStyle = uiStroke;
    ctx.strokeRect(10, 10, 160, 75);
    
    ctx.fillStyle = "#ffd700"; 
    ctx.fillText(`Lives: ${gameMode === 'endless' ? '∞' : lives}`, 20, 20); 
    ctx.fillText(`Score: ${score}`, 20, 50); 
    
    // Top Right Box
    let rightW = gameMode === "campaign" ? 140 : 420;
    let rightH = gameMode === "campaign" ? 45 : 105;
    let rightX = canvas.width - rightW - 10;
    
    ctx.fillStyle = uiFill;
    ctx.fillRect(rightX, 10, rightW, rightH);
    ctx.strokeStyle = uiStroke;
    ctx.strokeRect(rightX, 10, rightW, rightH);
    
    ctx.fillStyle = "#ffd700";
    if (gameMode === "campaign") { 
        ctx.fillText(`Level: ${currentLevel}`, rightX + 10, 20); 
    } else {
        ctx.fillText(`Distance: ${Math.floor(highestEndlessX / (tileSize/4))}m`, rightX + 10, 20); 
        ctx.fillText(`High Score: ${Math.floor(endlessHighScore / (tileSize/4))}m`, rightX + 10, 50); 
        ctx.fillText(`Enemies: ${endlessEnemiesDefeated} (Record: ${endlessEnemiesHighScore})`, rightX + 10, 80); 
    }

    // Active Powers Box (Dynamically Sized)
    let activePowers = [];
    if (player.hasLevitation) activePowers.push({ img: images.potionJump, text: `Levitation Active` });
    if (player.hasFireball) activePowers.push({ img: images.scrollFire, text: `Fireball Ready (${controlMap.fire})` });
    if (player.deathRayUses > 0) activePowers.push({ img: images.scrollDeathRay, text: `Death Ray: ${player.deathRayUses} (${controlMap.deathRay})` });
    if (unlockedLevels >= 50) activePowers.push({ img: null, text: `🌀 Blink Ready (${controlMap.blink})` });
    
    if (player.hasShockwaveBoots) activePowers.push({ img: images.wizardsBoots, text: `Shockwave Boots (Hold ${controlMap.down})` });
    if (globalFreezeTimer > 0) activePowers.push({ img: images.freezeTime, text: `Time Frozen (${Math.ceil(globalFreezeTimer/60)}s)` });
    if (player.hasFamiliar) activePowers.push({ img: images.arcaneFamiliar, text: `Arcane Familiar` });
    if (player.hasMagnet) activePowers.push({ img: images.magnet, text: `Magnet` });
    if (player.invincibilityTimer > 60) activePowers.push({ img: images.stardust, text: `Invincible! (${Math.ceil(player.invincibilityTimer/60)}s)` });
    if (player.hasShatter) activePowers.push({ img: images.shatter, text: `Shatter Ready` });

    if (activePowers.length > 0) {
        let iconSize = 24;
        let spacing = 30;
        let maxTextWidth = 350;
        
        for (let powerObj of activePowers) {
            let textW = ctx.measureText(powerObj.text).width;
            let totalW = powerObj.img && powerObj.img.complete && powerObj.img.width > 0 ? textW + iconSize + 30 : textW + 20;
            if (totalW > maxTextWidth) maxTextWidth = totalW;
        }

        let pBoxW = maxTextWidth + 30;
        let pBoxH = (activePowers.length * spacing) + 20;
        let pBoxY = canvas.height - pBoxH - 10;
        
        ctx.fillStyle = uiFill;
        ctx.fillRect(10, pBoxY, pBoxW, pBoxH);
        ctx.strokeStyle = uiStroke;
        ctx.strokeRect(10, pBoxY, pBoxW, pBoxH);
        
        ctx.fillStyle = "#ffd700";
        for (let i = 0; i < activePowers.length; i++) {
            let yPos = pBoxY + 15 + (i * spacing);
            let powerObj = activePowers[i];
            if (powerObj.img && powerObj.img.complete && powerObj.img.width > 0) {
                ctx.drawImage(powerObj.img, 20, yPos - 5, iconSize, iconSize);
                ctx.fillText(powerObj.text, 20 + iconSize + 10, yPos);
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

    campaignTab.classList.add("hidden");
    gameplayTab.classList.add("hidden");
    menagerieTab.classList.add("hidden");

    if (tabName === "campaign") {
        campaignTab.classList.remove("hidden");
        buttons[0].classList.add("active");
    } else if (tabName === "gameplay") {
        gameplayTab.classList.remove("hidden");
        buttons[1].classList.add("active");
    } else if (tabName === "menagerie") {
        menagerieTab.classList.remove("hidden");
        buttons[2].classList.add("active");
    }
}

function showPowerups(fromPause = false) {
    returnToPause = fromPause;
    hideAllScreens();
    document.getElementById("powerups-screen").classList.remove("hidden");
    
    switchPowerupTab('campaign');
    const list = document.getElementById("powerup-list");
    
    const powers = [
        { lvl: 10, title: "10% Movement Speed", desc: "Increases the player movement speed by 10% permanently." },
        { lvl: 20, title: "Large Fireballs", desc: "Doubles the size of the player's fireballs permanently." },
        { lvl: 30, title: "Unlock Icicles", desc: "Shoots two icicles at 45 degree angles that freeze enemies for 1s." },
        { lvl: 40, title: "33% Jump Height", desc: "Increases the player base jump height by 33% permanently." },
        { lvl: 50, title: "Unlock Blink", desc: `Instantly teleport safely forward 10 squares.` }
    ];

    list.innerHTML = "";
    powers.forEach(p => {
        let isUnlocked = unlockedLevels >= p.lvl;
        let div = document.createElement("div");
        div.className = "powerup-item" + (isUnlocked ? "" : " locked");
        div.innerHTML = `<h3>Level ${p.lvl}: ${p.title} ${isUnlocked ? "✅" : "🔒"}</h3>
                         <p>${p.desc}</p>
                         <small>${isUnlocked ? "Unlocked!" : "Reach Campaign Level " + p.lvl + " to earn."}</small>`;
        list.appendChild(div);
    });

    const gameplayList = document.getElementById("gameplay-powerup-list");
    gameplayList.innerHTML = "";

    const gameplayPowers = [
        { imgs: ["assets/potion_jump.png"], desc: "Levitation: When the Levitation wings are picked up, the wizard gains the ability to jump higher. The wizard also gains the ability to \"slow fall\" if they hold down the jump button after they jump." },
        { imgs: ["assets/amulet_shield.png", "assets/shield_glow.png"], desc: "Amulet: When the amulet is picked up, a protective shield is placed around the wizard that protects the wizard from one hit of damage from either a trap or an enemy." },
        { imgs: ["assets/scroll_fire.png"], desc: "Fireball: When the Fire Scroll is picked up, the wizard gains the ability to shoot a Fireball to attack enemies." },
        { imgs: ["assets/scroll_deathray.png"], desc: "Death Ray: When the Death Ray is picked up, the wizard gains up to three charges of the Death Ray spell. The Death Ray instantly kills any enemies visible to the player." },
        { imgs: ["assets/health_potion.png"], desc: "Health Potion: +1 Life" },
        { imgs: ["assets/wizards_boots.png"], desc: `Shockwave Boots: Magical boots that allow the player to push back nearby enemies when landing. Holding the ${controlMap.down} key while landing unleashes the shockwave.` },
        { imgs: ["assets/freeze_time.png"], desc: "Freeze Time: Freezes all enemies and enemy projectiles for 10 seconds." },
        { imgs: ["assets/arcane_familiar.png"], desc: "Arcane Familiar: An Arcane Familiar joins you, firing projectiles at enemies." },
        { imgs: ["assets/magnets_how_do_they_work.png"], desc: "Magnetic: Continuously draws all powerup items within a large radius directly towards the player's location, automatically pulling in and gaining the powerup." },
        { imgs: ["assets/stardust.png"], desc: "Stardust: Grants invulnerability for 10 seconds." },
        { imgs: ["assets/shockwave_shatter.png"], desc: "Shatter: When the wizard's shield breaks from damage, it causes a shockwave that destroys all projectiles on screen and pushes all enemies on screen backwards away from the player (sometimes to their death!). Requires Amulet to spawn." }
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
	// --- ADD MENAGERIE LIST POPULATION HERE ---
    const menagerieList = document.getElementById("menagerie-list");
    menagerieList.innerHTML = "";

    const enemiesData = [
        { img: "assets/goblin.png", title: "Goblin", desc: "A standard foot soldier that patrols platforms, reversing direction at edges or walls. Can be defeated by jumping on its head or using spells." },
        { img: "assets/rock_thrower_goblin.png", title: "Rock Thrower", desc: "A ranged goblin that hurls heavy stones toward the player from a distance." },
        { img: "assets/shielded_goblin.png", title: "Shielded Goblin", desc: "Equipped with a sturdy defense shield that completely blocks incoming fireball and projectile attacks." },
        { img: "assets/goblin_shaman.png", title: "Goblin Shaman", desc: "A magical spellcaster that fires hazardous magic projectiles at the wizard." },
        { img: "assets/necromancer_goblin.png", title: "Necromancer", desc: "A dark sorcerer that periodically summons fresh goblin reinforcements onto the battlefield." },
        { img: "assets/orc_boss.png", title: "Orc Boss", desc: "A mean orc boss that can jump and shoot fireballs.  Think fast!" }
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
        blink: "Blink", down: "Stomp/Shockwave", pause: "Pause Game"
    };

    for (let key in controlMap) {
        let row = document.createElement("div");
        row.className = "control-row";
        
        let label = document.createElement("span");
        label.innerText = labels[key] + ": ";
        
        let btn = document.createElement("button");
        btn.innerText = awaitingKeybind === key ? "Press any key..." : controlMap[key];
        btn.onclick = () => {
            awaitingKeybind = key;
            renderControlsMenu();
        };

        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
    }
}

function showControls(fromPause = false) {
    returnToPause = fromPause;
    hideAllScreens();
    document.getElementById("controls-screen").classList.remove("hidden");
    awaitingKeybind = null;
    renderControlsMenu();
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
    gameState = "PLAYING"; 
    hideAllScreens(); 
    lives = 5; 
    score = 0; 
    highestEndlessX = 0; 
    bossesDefeated = 0;
    endlessEnemiesDefeated = 0;
    
    if (mode === "endless") { 
        currentLevel = "Endless"; 
        campaignPowerups = [];
        endlessBossesSpawned = 0;
    } else {
        if (forceNew) {
            currentLevel = 1;
            unlockedLevels = 1;
            setCookie("wizardUnlocked", 1, 365);
            campaignPowerups = [];
        } else {
            let savedLevel = parseInt(getCookie("wizardUnlocked"));
            unlockedLevels = !isNaN(savedLevel) ? savedLevel : 1;
            currentLevel = unlockedLevels;
        }
    }

    buildLevel(); 
    resetPlayer(); 
    update(); 
}

resizeCanvas();
showMainMenu();
