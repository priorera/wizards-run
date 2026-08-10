        const canvas = document.getElementById("gameCanvas"); 
        const ctx = canvas.getContext("2d"); 

        // ==========================================
        // 1. GAME STATE, COOKIES, & UI VARIABLES
        // ==========================================
        function setCookie(name, value, days) {
            let expires = "";
            if (days) {
                let date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/";
        }
        function getCookie(name) {
            let nameEQ = name + "=";
            let ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) == ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
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

        const MAX_LEVELS = 50; 
        let lives = 3; 
        let score = 0; 
        let highestEndlessX = 0; 

        // Dynamic World Variables
        let tileSize; 
        let mapWidth = 0; 
        let mapHeight; 
		
		// --- NEW VARIABLES FOR FPS CAPPING ---
		let lastTime = 0;
		const FPS = 60;
		const frameInterval = 1000 / FPS;
		// -------------------------------------

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
            wizard: new Image(), goblin: new Image(), stoneBrick: new Image(),
            portal: new Image(), orcBoss: new Image(), potionJump: new Image(),
            scrollFire: new Image(), amuletShield: new Image(), background: new Image(),
            healthPotion: new Image(), scrollDeathRay: new Image(),
            spikes: new Image(), shieldGlow: new Image(), disappearingPlatform: new Image()
        };
        images.wizard.src = "assets/wizard.png";
        images.goblin.src = "assets/goblin.png";
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
            invincibilityTimer: 0 
        };

        const camera = { x: 0, y: 0 }; 

        let enemyJumpPower;

        let controlMap = {
            left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", 
            fire: "KeyZ", deathRay: "KeyX", blink: "ArrowDown", pause: "Escape"
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
                
                platforms.forEach(p => { p.x *= scale; p.y *= scale; p.width *= scale; p.height = tileSize; });
                disappearingPlatforms.forEach(p => { p.x *= scale; p.y *= scale; p.width *= scale; p.height = tileSize; });
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
			// A small buffer to ignore floating-point rounding errors
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
                platforms.push({ x: currentGridX * tileSize, y: defaultGroundY * tileSize, width: platWGrids * tileSize, height: tileSize * 2 });
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

            let numPlatforms = Math.floor(Math.random() * 7) + 4; // 4 to 10 platforms at a time
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
                let platWGrids = isDisappearing ? (Math.floor(Math.random() * 5) + 3) : (Math.floor(Math.random() * 5) + 3); 

                let cpObj = { gridX: currentGridX, gridY: currentGridY, wGrids: platWGrids, hasPowerup: false, hasSpikes: false };

                // Powerups directly on platforms (since question blocks are removed)
                if (Math.random() < 0.25) {
                    let types = ["jump", "fire", "shield", "deathray", "health"]; 
                    
                    // Filter out health potions during endless mode
                    if (gameMode === "endless") types = types.filter(t => t !== "health");

                    if (player.hasLevitation) types = types.filter(t => t !== "jump");
                    if (player.hasFireball) types = types.filter(t => t !== "fire");
                    if (player.hasShield) types = types.filter(t => t !== "shield");
                    if (player.deathRayUses > 0) types = types.filter(t => t !== "deathray");
					
                    types = types.filter(t => !spawnedChunkPowerups.includes(t));
                    
                    // If types is empty (e.g. all powerups active/spawned), fallback safely
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
                    for (let k = 0; k < platWGrids; k++) {
                        let dp = {
                            x: (currentGridX + k) * tileSize,
                            y: currentGridY * tileSize,
                            width: tileSize,
                            height: tileSize,
                            triggered: false,
                            disappearTimer: 90, // Increased by 50% from 60
                            alpha: 1.0
                        };
                        disappearingPlatforms.push(dp);
                    }
                    cpObj.plat = { x: currentGridX * tileSize, y: currentGridY * tileSize, width: platWGrids * tileSize, height: tileSize };
                } else {
                    let plat = { 
                        x: currentGridX * tileSize, 
                        y: currentGridY * tileSize, 
                        width: platWGrids * tileSize, 
                        height: tileSize
                    };
                    platforms.push(plat);
                    cpObj.plat = plat;
                }

                // Add Spikes
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

					// REPLACE THE SPIKE CREATION LOOP WITH GOBLINS:
					for (let idx of spikeIndices) {
						let speedMult = gameMode === "campaign" ? (1 + (currentLevel * 0.05)) : (1 + (bossesDefeated * 0.15));
						let enemySize = tileSize * 0.75;
						let goblinItem = { 
							x: cpObj.plat.x + idx * tileSize, 
							y: cpObj.plat.y - enemySize, 
							width: enemySize, 
							height: enemySize, 
							vx: tileSize * 0.05 * speedMult, 
							speed: tileSize * 0.05 * speedMult, 
							hp: 1, 
							type: "goblin", 
							jumpPower: enemyJumpPower, 
							grounded: false, 
							vy: 0, 
							dirChangeCooldown: 0 
						};
						if (!isOccupied(goblinItem.x, goblinItem.y, goblinItem.width, goblinItem.height)) {
							enemies.push(goblinItem);
						}
					}
                }

                createdPlatforms.push(cpObj);
                currentGridX += platWGrids;
            }

			// REPLACE THE GOBLIN SPAWNING LOOP WITH SPIKES:
			let validSpikePlatforms = createdPlatforms.filter(cp => !cp.hasPowerup && cp.wGrids >= 3);
			let numSpikesToSpawn = gameMode === "endless" ? 3 : Math.floor(numPlatforms * difficulty * 2);

			for (let sIdx = 0; sIdx < numSpikesToSpawn && validSpikePlatforms.length > 0; sIdx++) {
				let pIdx = Math.floor(Math.random() * validSpikePlatforms.length);
				let cp = validSpikePlatforms.splice(pIdx, 1)[0];
				
				let spikeW = tileSize * 0.5;
				let spikeH = tileSize * 0.15;
				
				// Randomly select a tile index along the platform width, avoiding the outer edges
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
            
            platforms.push({ x: 0, y: (gridSpotsY - 2) * tileSize, width: tileSize * 5, height: tileSize * 2 }); 
            platforms.push({ x: -tileSize, y: -mapHeight, width: tileSize, height: mapHeight * 3 }); 

            let currentGridX = 5; 
            
            if (gameMode === "campaign") { 
                let numChunks = 3 + Math.floor(currentLevel / 5); 
                let difficulty = Math.min(0.2 + (currentLevel * 0.02), 0.8); 
                let isBossLevel = (currentLevel % 5 === 0) || currentLevel === MAX_LEVELS; 

                for (let i = 0; i < numChunks; i++) { 
                    currentGridX = generateChunk(currentGridX, difficulty); 
                }

                if (isBossLevel) currentGridX = generateChunk(currentGridX, difficulty, true, false); 
                currentGridX = generateChunk(currentGridX, difficulty, false, true); 
                mapWidth = currentGridX * tileSize; 

                if (!isBossLevel && goal) {
                    goal.active = true;
                }
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
            
            disappearingPlatforms.forEach(dp => {
                dp.triggered = false;
                dp.disappearTimer = 90;
                dp.alpha = 1.0;
            });
            
            if (gameMode === "campaign") {
                player.hasFireball = campaignPowerups.includes("fire");
                player.hasShield = campaignPowerups.includes("shield");
                player.hasLevitation = campaignPowerups.includes("jump");
                
                let dr = campaignPowerups.find(p => p.startsWith("deathray:"));
                player.deathRayUses = dr ? parseInt(dr.split(":")[1]) : 0;
            } else {
                player.hasFireball = false; 
                player.hasShield = false; 
                player.hasLevitation = false;
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

            for (let i = 1; i <= 10; i++) {
                let testX = player.x + i * tileSize * player.lastFacingDir;
                let hitWall = platforms.some(p => testX + player.width > p.x && testX < p.x + p.width && player.y + player.height > p.y && player.y < p.y + p.height);
                let hitEnemy = enemies.some(e => testX + player.width > e.x && testX < e.x + e.width && player.y + player.height > e.y && player.y < e.y + e.height);
                let isPit = false;
                
                if (player.grounded) {
                    let hasFloor = platforms.some(p => testX + player.width > p.x && testX < p.x + p.width && player.y + player.height <= p.y && p.y - (player.y + player.height) < tileSize);
                    if (!hasFloor) isPit = true;
                }

                if (hitWall || hitEnemy || isPit) {
                    hitIdx = i; break;
                }
            }

            if (hitIdx < 10) {
                let safeIdx = Math.max(0, hitIdx - 3);
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
                    buildLevel(); // Resets all enemies, powerups, and platform states for campaign
                    resetPlayer(); 
                }
            }
        }

        function saveCampaignPowerups() {
            campaignPowerups = [];
            if (player.hasLevitation) campaignPowerups.push("jump");
            if (player.hasFireball) campaignPowerups.push("fire");
            if (player.hasShield) campaignPowerups.push("shield");
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

			// --- NEW FRAME CAPPING LOGIC ---
			// If update() is called manually (without requestAnimationFrame), generate a timestamp
			if (!timestamp) timestamp = performance.now();
			
			let deltaTime = timestamp - lastTime;

			// If it hasn't been long enough since the last frame, skip this loop
			if (deltaTime < frameInterval) {
				requestAnimationFrame(update);
				return;
			}

			// Update the lastTime, keeping any leftover time so it stays smooth
			lastTime = timestamp - (deltaTime % frameInterval);

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
                
                // Target next boss interval based on how many we've SPAWNED, not defeated
                let targetBossMeters = (endlessBossesSpawned + 1) * 500;
                
                if (currentDistanceMeters >= targetBossMeters && player.x > mapWidth - (tileSize * 30)) {
                    isBossChunk = true;
                    endlessBossesSpawned++; // Increment instantly so it only spawns once!
                }

                if (player.x > mapWidth - (tileSize * 30)) { 
                    let diff = Math.min(0.3 + (bossesDefeated * 0.05), 0.9); 
                    let currentGridX = Math.round(mapWidth / tileSize);
                    mapWidth = generateChunk(currentGridX, diff, isBossChunk) * tileSize; 
                }
            }

            if (player.fireCooldown > 0) player.fireCooldown--; 
            if (player.invincibilityTimer > 0) player.invincibilityTimer--; 

			// Player Shooting 
            if (keys.fire && player.hasFireball && player.fireCooldown <= 0) { 
                let dir = player.lastFacingDir;
                let fSize = unlockedLevels >= 20 ? tileSize * 0.5 : tileSize * 0.25;
                let vShot = tileSize * 0.2;
                
                // Spawn cleanly in front of the player and vertically centered
                let spawnX = player.x + (player.width / 2) + (dir > 0 ? player.width * 0.5 : -player.width * 0.5 - fSize);
                let spawnY = player.y + (player.height / 2) - (fSize / 2);

                fireballs.push({ x: spawnX, y: spawnY, vx: vShot * dir, vy: 0, width: fSize, height: fSize, freeze: false }); 
                
                if (unlockedLevels >= 30) {
                    let diagV = vShot * 0.707;
                    let icicleSize = tileSize * 0.25;
                    let iSpawnX = player.x + (player.width / 2) + (dir > 0 ? player.width * 0.5 : -player.width * 0.5 - icicleSize);
                    let iSpawnY = player.y + (player.height / 2) - (icicleSize / 2);

                    fireballs.push({ x: iSpawnX, y: iSpawnY, vx: diagV * dir, vy: -diagV, width: icicleSize, height: icicleSize, freeze: true });
                    fireballs.push({ x: iSpawnX, y: iSpawnY, vx: diagV * dir, vy: diagV, width: icicleSize, height: icicleSize, freeze: true });
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

            // Player Platform Collisions (X)
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

            // Player Platform Collisions (Y)
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
                        if (!dp.triggered) {
                            dp.triggered = true;
                        }
                    } else if (player.vy < 0) {
                        player.y = dp.y + dp.height;
                        player.vy = 0;
                    }
                }
            }

            // Disappearing Platforms Timer Update (90 frames now)
            for (let dp of disappearingPlatforms) {
                if (dp.triggered) {
                    dp.disappearTimer--;
                    dp.alpha = Math.max(0, dp.disappearTimer / 90);
                }
            }

            // Spikes Collisions
            for (let s of spikes) {
                if (checkCollision(player, s) && player.invincibilityTimer <= 0) {
                    if (player.hasShield) {
                        player.hasShield = false;
                        player.invincibilityTimer = 60;
                        createParticles(player.x, player.y, "#FFD700", 20);
                    } else {
                        handlePlayerDeath();
						requestAnimationFrame(update);
						return;
                    }
                }
            }

            // Projectiles (Player)
            for (let i = fireballs.length - 1; i >= 0; i--) { 
                let f = fireballs[i]; 
                f.x += f.vx; f.y += f.vy; 
                createParticles(f.x + f.width / 2, f.y + f.height / 2 + 5, f.freeze ? "#00FFFF" : "#FFA500", 1);
                
                let hit = false; 
                for (let p of platforms) if (checkCollision(f, p)) hit = true; 
                for (let dp of disappearingPlatforms) if (dp.alpha > 0 && checkCollision(f, dp)) hit = true;
                
                for (let j = enemies.length - 1; j >= 0; j--) { 
                    let e = enemies[j]; 
                    if (checkCollision(f, e)) { 
                        hit = true; 
                        e.hp--; 
                        
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
                if (hit || Math.abs(f.x - camera.x) > (tileSize * 50)) fireballs.splice(i, 1); 
            }

            // Enemy Fireballs
            for (let i = enemyFireballs.length - 1; i >= 0; i--) {
                let f = enemyFireballs[i];
                f.x += f.vx; f.y += f.vy;
                createParticles(f.x + f.width / 2, f.y + f.height / 2 + 5, "#FF0000", 1);
                
                let hit = false;
                for (let p of platforms) if (checkCollision(f, p)) hit = true;
                for (let dp of disappearingPlatforms) if (dp.alpha > 0 && checkCollision(f, dp)) hit = true;
                
                if (checkCollision(f, player) && player.invincibilityTimer <= 0) {
                    hit = true;
                    if (player.hasShield) {
                        player.hasShield = false;
                        player.invincibilityTimer = 60;
                        createParticles(player.x, player.y, "#FFD700", 20);
                    } else {
                        handlePlayerDeath();
						requestAnimationFrame(update);
						return;
                    }
                }
                if (hit || Math.abs(f.x - camera.x) > (tileSize * 50)) enemyFireballs.splice(i, 1);
            }

			// Enemies AI
            let bossAlive = false;
            let stompedThisFrame = false; // Track if a stomp occurred this frame

            for (let i = enemies.length - 1; i >= 0; i--) { 
                let e = enemies[i]; 
                if (e.type === "boss") bossAlive = true;

                if (e.dirChangeCooldown === undefined) e.dirChangeCooldown = 0;
                if (e.dirChangeCooldown > 0) e.dirChangeCooldown--;

                if (e.frozenTimer > 0) {
                    e.frozenTimer--;
                    continue; 
                }

                for (let s of spikes) {
                    if (checkCollision(e, s)) {
                        setEnemyVx(e, -e.vx);
                    }
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
					if (player.grounded && checkCollision(player, bossPlatformBox)) {
						e.aggro = true;
					}
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
                            e.fireCooldown = 90 - Math.min(60, (currentLevel || bossesDefeated)); 
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
                                e.vy = e.jumpPower; 
                                e.grounded = false;
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
                                e.y = p.y - e.height; 
                                e.vy = 0; 
                                e.grounded = true; 
                            } else if (e.vy < 0) { 
                                e.y = p.y + p.height; 
                                e.vy = 0; 
                            }
                        }
                        if (aheadX > p.x - 2 && aheadX < p.x + p.width + 2 && e.y + e.height <= p.y && p.y - (e.y + e.height) < tileSize) {
							hasFloorUnderneath = true;
						}
                    }

                    if (e.grounded && !hasFloorUnderneath) {
                        e.x -= e.vx; 
                        setEnemyVx(e, -e.vx);
                    }
                }

                // Enemy & Boss Collision with Player
                if (checkCollision(player, e)) { 
                    if (e.type === "boss") {
                        if ((player.vy > 0 || stompedThisFrame) && player.y + player.height <= e.y + e.height * 0.65) { 
                            e.hp--; 
                            if (!stompedThisFrame) {
                                player.vy = player.jumpPower; 
                                stompedThisFrame = true;
                            }
                            createParticles(e.x, e.y, "#FF0000", 15); 
                            player.invincibilityTimer = 10;
                            if (e.hp <= 0) { 
                                enemies.splice(i, 1); 
                                score += 500; 
                                if (goal) goal.active = true;
                                bossesDefeated++;
                            }
                        } else if (player.invincibilityTimer <= 0) {
                            if (player.hasShield) { 
                                player.hasShield = false; 
                                player.invincibilityTimer = 60; 
                                createParticles(player.x, player.y, "#FFD700", 20); 
                            } else {
                                handlePlayerDeath(); 
								requestAnimationFrame(update);
								return;
                            }
                        }
                    } else {
                        // Regular Enemy collision
                        if ((player.vy > 0 || stompedThisFrame) && player.y < e.y + e.height / 2) { 
                            e.hp--; 
                            if (!stompedThisFrame) {
                                player.vy = player.jumpPower * 0.7; 
                                stompedThisFrame = true;
                            }
                            createParticles(e.x, e.y, "#FF0000", 10); 
                            if (e.hp <= 0) { 
                                enemies.splice(i, 1); 
                                score += 50; 
                                if (gameMode === "endless") {
                                    endlessEnemiesDefeated++;
                                    if (endlessEnemiesDefeated > endlessEnemiesHighScore) {
                                        endlessEnemiesHighScore = endlessEnemiesDefeated;
                                        setCookie("wizardEndlessEnemiesHighScoreRecord", endlessEnemiesHighScore, 365);
                                    }
                                }
                            }
                        } else if (player.invincibilityTimer <= 0) {
                            if (player.hasShield) { 
                                player.hasShield = false; 
                                player.invincibilityTimer = 60; 
                                createParticles(player.x, player.y, "#FFD700", 20); 
                            } else {
                                handlePlayerDeath(); 
								requestAnimationFrame(update);
								return;
                            }
                        }
                    }
                }
            }

			if (gameMode === "endless" && bossAlive && player.x > mapWidth - (tileSize * 25)) {
                // Let player move freely past the boss chunk once spawned instead of locking them
            }
            // Powerups
            for (let i = powerups.length - 1; i >= 0; i--) { 
                if (checkCollision(player, powerups[i])) { 
                    let type = powerups[i].type; 
                    powerups.splice(i, 1); 
                    score += 25; 
                    
                    if (type === "jump") { 
                        if (!player.hasLevitation) {
                            player.hasLevitation = true;
                            updatePhysicsConstants();
                        }
                    } else if (type === "fire") { 
                        player.hasFireball = true; 
                    } else if (type === "shield") { 
                        player.hasShield = true; 
                    } else if (type === "deathray") {
                        player.deathRayUses = 3;
                    } else if (type === "health") {
                        lives++;
                    }
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

            // Goal
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
                    drawW = canvas.width;
                    drawH = canvas.width / bgRatio;
                } else {
                    drawW = canvas.height * bgRatio;
                    drawH = canvas.height;
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

            // Death Rays
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

            // Platforms
            for (let p of platforms) { 
                for(let w = 0; w < p.width; w += tileSize) {
                    let drawW = Math.min(tileSize, p.width - w);
                    for(let h = 0; h < p.height; h += tileSize) {
                        let drawH = Math.min(tileSize, p.height - h);
                        if (images.stoneBrick.complete && images.stoneBrick.width > 0) {
                            ctx.drawImage(images.stoneBrick, 0, 0, drawW, drawH, p.x + w, p.y + h, drawW, drawH);
                        } else {
                            ctx.fillStyle = "#4a4a4a"; 
                            ctx.fillRect(p.x + w, p.y + h, drawW, drawH);
                        }
                    }
                }
            }

            // Disappearing Platforms
            for (let dp of disappearingPlatforms) {
                if (dp.alpha <= 0) continue; 
                ctx.save();
                ctx.globalAlpha = dp.alpha;
                if (images.disappearingPlatform.complete && images.disappearingPlatform.width > 0) {
                    ctx.drawImage(images.disappearingPlatform, dp.x, dp.y, dp.width, dp.height);
                } else {
                    ctx.fillStyle = "#8a2be2"; 
                    ctx.fillRect(dp.x, dp.y, dp.width, dp.height);
                }
                ctx.restore();
            }

            // Spikes
            for (let s of spikes) {
                if (images.spikes.complete && images.spikes.width > 0) {
                    ctx.drawImage(images.spikes, s.x, s.y, s.width, s.height);
                } else {
                    ctx.fillStyle = "#8a8a8a";
                    ctx.fillRect(s.x, s.y, s.width, s.height);
                }
            }

            if (goal && goal.active) { 
                if (images.portal.complete && images.portal.width > 0) {
                    ctx.drawImage(images.portal, goal.x, goal.y, goal.width, goal.height);
                } else {
                    ctx.fillStyle = "#8A2BE2"; 
                    ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
                }
            }

            // Powerups
            for (let p of powerups) { 
                let offset = Math.sin(Date.now() / 200) * (tileSize * 0.075); 
                let img = images.healthPotion;
                if (p.type === "jump") img = images.potionJump;
                else if (p.type === "fire") img = images.scrollFire;
                else if (p.type === "shield") img = images.amuletShield;
                else if (p.type === "deathray") img = images.scrollDeathRay;
                
                if (img.complete && img.width > 0) {
                    ctx.drawImage(img, p.x, p.y + offset, p.width, p.height);
                } else {
                    ctx.fillStyle = p.type === "health" ? "#ff0000" : "#FFD700"; 
                    ctx.fillRect(p.x, p.y + offset, p.width, p.height);
                }
            }

            // Enemies
            for (let e of enemies) { 
                let img = e.type === "boss" ? images.orcBoss : images.goblin;
                if (e.frozenTimer > 0) ctx.filter = "sepia(100%) hue-rotate(180deg)"; 

                if (img.complete && img.width > 0) {
                    ctx.save();
                    if (e.vx > 0) { 
                        ctx.translate(e.x + e.width, e.y);
                        ctx.scale(-1, 1);
                        ctx.drawImage(img, 0, 0, e.width, e.height);
                    } else {
                        ctx.drawImage(img, e.x, e.y, e.width, e.height);
                    }
                    ctx.restore();
                } else {
                    ctx.fillStyle = e.type === "boss" ? "#006400" : "#32CD32"; 
                    ctx.fillRect(e.x, e.y, e.width, e.height); 
                }
                ctx.filter = "none";
            }

			// Fireballs
			for (let f of fireballs) { 
				ctx.fillStyle = f.freeze ? "#00FFFF" : "#FF4500"; 
				ctx.beginPath(); 
				ctx.arc(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, 0, Math.PI*2); 
				ctx.fill(); 
			}
			for (let f of enemyFireballs) { 
				ctx.fillStyle = "#FF0000"; 
				ctx.beginPath(); 
				ctx.arc(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, 0, Math.PI*2); 
				ctx.fill(); 
			}

            // Particles
            for (let p of particles) { 
                ctx.fillStyle = p.color; 
                ctx.globalAlpha = p.life / 30; 
                let pSize = tileSize * 0.1;
                ctx.fillRect(p.x, p.y, pSize, pSize); 
                ctx.globalAlpha = 1.0; 
            }

            // Player
            if (player.invincibilityTimer % 10 < 5) { 
                if (images.wizard.complete && images.wizard.width > 0) {
                    ctx.save();
                    if (player.lastFacingDir === -1) {
                        ctx.translate(player.x + player.width, player.y);
                        ctx.scale(-1, 1);
                        ctx.drawImage(images.wizard, 0, 0, player.width, player.height);
                    } else {
                        ctx.drawImage(images.wizard, player.x, player.y, player.width, player.height);
                    }
                    ctx.restore();
                } else {
                    ctx.fillStyle = player.color;  
                    ctx.fillRect(player.x, player.y, player.width, player.height); 
                }
                
                if (player.hasShield) { 
                    if (images.shieldGlow.complete && images.shieldGlow.width > 0) {
                        let glowSize = player.width * 1.8;
                        ctx.drawImage(images.shieldGlow, player.x + (player.width - glowSize)/2, player.y + (player.height - glowSize)/2, glowSize, glowSize);
                    } else {
                        ctx.strokeStyle = "#FFD700"; 
                        ctx.lineWidth = Math.max(1, tileSize * 0.075); 
                        ctx.beginPath(); 
                        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width, 0, Math.PI*2); 
                        ctx.stroke(); 
                    }
                }
            }

            ctx.restore(); 

            // ==========================================
            // 9. HUD 
            // ==========================================
            ctx.fillStyle = "#ffd700"; 
            ctx.font = "bold 24px Palatino Linotype, serif"; 
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            
            ctx.fillText(`Lives: ${gameMode === 'endless' ? '∞' : lives}`, 20, 30); 
            ctx.fillText(`Score: ${score}`, 20, 60); 
            
            if (gameMode === "campaign") { 
                ctx.fillText(`Level: ${currentLevel}`, canvas.width - 150, 30); 
            } else {
                ctx.fillText(`Distance: ${Math.floor(highestEndlessX / (tileSize/4))}m`, canvas.width - 320, 30); 
                ctx.fillText(`High Score: ${Math.floor(endlessHighScore / (tileSize/4))}m`, canvas.width - 320, 60); 
                ctx.fillText(`Enemies Defeated: ${endlessEnemiesDefeated} (Record: ${endlessEnemiesHighScore})`, canvas.width - 480, 90); 
            }

			let activePowers = [];
            if (player.hasLevitation) activePowers.push({ img: images.potionJump, text: `Levitation Active` });
            if (player.hasFireball) activePowers.push({ img: images.scrollFire, text: `Fireball Ready (${controlMap.fire})` });
            if (player.deathRayUses > 0) activePowers.push({ img: images.scrollDeathRay, text: `Death Ray Uses: ${player.deathRayUses} (${controlMap.deathRay})` });
            if (unlockedLevels >= 50) activePowers.push({ img: null, text: `🌀 Blink Ready (${controlMap.blink})` }); // Keep emoji or add an icon if available

            let iconSize = 24;
            let spacing = 30;

            for (let i = 0; i < activePowers.length; i++) {
                let yPos = canvas.height - 30 - (i * spacing);
                let xPos = 20;

                // Draw the PNG logo if available and loaded, otherwise skip layout shift
                let powerObj = activePowers[i];
                if (powerObj.img && powerObj.img.complete && powerObj.img.width > 0) {
                    ctx.drawImage(powerObj.img, xPos, yPos - 20, iconSize, iconSize);
                    ctx.fillText(powerObj.text, xPos + iconSize + 10, yPos);
                } else {
                    ctx.fillText(powerObj.text, xPos, yPos);
                }
            }
            
            ctx.shadowBlur = 0;
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

        function showPowerups() {
            hideAllScreens();
            document.getElementById("powerups-screen").classList.remove("hidden");
            const list = document.getElementById("powerup-list");
            
            const powers = [
                { lvl: 10, title: "10% Movement Speed", desc: "Increases the player movement speed by 10% permanently." },
                { lvl: 20, title: "Large Fireballs", desc: "Doubles the size of the player's fireballs permanently." },
                { lvl: 30, title: "Unlock Icicles", desc: "Shoots two icicles at 45 degree angles that freeze enemies for 1s." },
                { lvl: 40, title: "33% Jump Height", desc: "Increases the player base jump height by 33% permanently." },
                { lvl: 50, title: "Unlock Blink", desc: "Instantly teleport safely forward 10 squares." }
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
        }

        function renderControlsMenu() {
            const list = document.getElementById("controls-list");
            list.innerHTML = "";
            
            const labels = {
                left: "Move Left", right: "Move Right", jump: "Jump", 
                fire: "Cast Fireball", deathRay: "Use Death Ray", 
                blink: "Blink", pause: "Pause Game"
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

        function showControls() {
            hideAllScreens();
            document.getElementById("controls-screen").classList.remove("hidden");
            awaitingKeybind = null;
            renderControlsMenu();
        }

        function startGame(mode, forceNew = false) {
            gameMode = mode; 
            gameState = "PLAYING"; 
            hideAllScreens(); 
            lives = 3; 
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
                    campaignPowerups = [];
                } else {
                    currentLevel = unlockedLevels;
                }
            }

            buildLevel(); 
            resetPlayer(); 
            update(); 
        }

        resizeCanvas();
        showMainMenu();
