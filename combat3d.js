let scene, camera, renderer, animationId;
let playerSprite, playerConfig;
let enemies = [];
let projectiles = [];
let particles = [];
let gems = [];
let joystickManager;
let joystickVector = { x: 0, y: 0 };
let lastShootTime = 0;
let lastSpawnTime = 0;
let attackInterval = 400; // ms between attacks
let kills = 0;
let targetKills = 10;
let currentHP = 100;
let maxHP = 100;

// Player Stats
let currentLevel = 1;
let currentExp = 0;
let expToNext = 10;
let magnetRange = 5;
let playerMoveSpeed = 0.15;

// Dash state
let isDashing = false;
let dashTime = 0;
let dashCooldown = 0;
let dashDirection = new THREE.Vector3();

// Physics and Camera
let playerYVelocity = 0;
let isGrounded = true;
let currentCameraAngle = 0;

// Procedural Humanoid
function createHumanoid(colorHex, textureUrl) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8, metalness: 0.1 });
    
    let headMat = mat;
    if (textureUrl) {
        const tex = TEXTURE_LOADER.load(textureUrl);
        // Box geometry has 6 faces. We want the face on the front, color everywhere else.
        headMat = [
            mat, // rx
            mat, // lx
            mat, // ty
            mat, // by
            new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.8, metalness: 0.1 }), // pz - front face
            mat  // nz
        ];
    }
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(1, 1.5, 0.5);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 1.75;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Head
    const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 3.0; // on top of body
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);
    
    // Arms
    const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    
    // Left Arm Pivot
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.7, 2.3, 0); 
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.y = -0.5; // swing from top
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);
    
    // Right Arm Pivot
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.7, 2.3, 0);
    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.y = -0.5;
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);
    
    // Legs
    const legGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    
    // Left Leg Pivot
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.3, 1.0, 0);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.y = -0.5;
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    leftLegPivot.add(leftLeg);
    group.add(leftLegPivot);
    
    // Right Leg Pivot
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.3, 1.0, 0);
    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.y = -0.5;
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    rightLegPivot.add(rightLeg);
    group.add(rightLegPivot);
    
    // Animation state wrapper
    return {
        mesh: group,
        lArm: leftArmPivot,
        rArm: rightArmPivot,
        lLeg: leftLegPivot,
        rLeg: rightLegPivot,
        cycle: 0
    };
}

// Arena bounds
const MAP_SIZE = 40;

const TEXTURE_LOADER = new THREE.TextureLoader();
// Global materials to save memory
const ENEMY_MATS = {};
function getEnemyMaterial(url) {
    if (!ENEMY_MATS[url]) {
        const tex = TEXTURE_LOADER.load(url);
        ENEMY_MATS[url] = new THREE.SpriteMaterial({ map: tex, color: 0xffffff });
    }
    return ENEMY_MATS[url];
}

function init3DArena(config) {
    playerConfig = config;
    targetKills = 5 + (config.stageLvl * 5);
    kills = 0;
    maxHP = config.playerMaxHP;
    currentHP = maxHP;
    enemies = [];
    projectiles = [];
    particles = [];
    gems = [];
    
    currentLevel = 1;
    currentExp = 0;
    expToNext = 10;
    attackInterval = 400;
    dashCooldown = 0;
    magnetRange = 5 + (state.upgrades.luck * 0.5); // Luck slightly boosts base magnet
    playerMoveSpeed = 0.15;
    
    updateHUD();
    
    const container = document.getElementById('canvas-container');
    container.innerHTML = ''; // clear previous
    
    // Setup Three.js
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.02); // Light atmospheric perspective
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    // Over the shoulder angled down
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87CEEB); // Realistic Sky Blue
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Lighting - Daylight
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.4);
    scene.add(ambientLight);
    
    // Sun light
    const dirLight = new THREE.DirectionalLight(0xfff5b6, 1.2);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    
    // Shadow properties
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);
    
    // Generate a simple grid texture using data URL for a professional arena floor
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.fillStyle = '#1e293b'; // slate-800
    context.fillRect(0, 0, 512, 512);
    context.fillStyle = '#0f172a'; // slate-900
    context.fillRect(0, 0, 256, 256);
    context.fillRect(256, 256, 512, 512);
    
    const floorTex = new THREE.CanvasTexture(canvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(MAP_SIZE / 4, MAP_SIZE / 4);

    // Environment - Realistic Ground
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({ 
        map: floorTex,
        roughness: 0.9, 
        metalness: 0.1 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Grid Helper for spatial awareness
    const gridHelper = new THREE.GridHelper(MAP_SIZE, MAP_SIZE/4, 0x888888, 0x444444);
    gridHelper.position.y = 0.01; // Slightly above floor
    scene.add(gridHelper);
    
    // Enclosing Walls (Stone/Concrete color)
    const wallHeight = 4;
    const wallThick = 2;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 1.0, metalness: 0.0 }); // Slate-700
    
    // North wall
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(MAP_SIZE + wallThick*2, wallHeight, wallThick), wallMat);
    wallN.position.set(0, wallHeight/2, -MAP_SIZE/2 - wallThick/2);
    wallN.castShadow = true;
    wallN.receiveShadow = true;
    scene.add(wallN);
    
    // South Wall
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(MAP_SIZE + wallThick*2, wallHeight, wallThick), wallMat);
    wallS.position.set(0, wallHeight/2, MAP_SIZE/2 + wallThick/2);
    wallS.castShadow = true;
    wallS.receiveShadow = true;
    scene.add(wallS);
    
    // East wall
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, MAP_SIZE), wallMat);
    wallE.position.set(MAP_SIZE/2 + wallThick/2, wallHeight/2, 0);
    wallE.castShadow = true;
    wallE.receiveShadow = true;
    scene.add(wallE);
    
    // West wall
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, MAP_SIZE), wallMat);
    wallW.position.set(-MAP_SIZE/2 - wallThick/2, wallHeight/2, 0);
    wallW.castShadow = true;
    wallW.receiveShadow = true;
    scene.add(wallW);

    // Sky
    const skyGeo = new THREE.SphereGeometry(60, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x87CEEB,
        side: THREE.BackSide,
        transparent: true,
        opacity: 1
    });
    // Add simple gradient effect to sky
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Better Sun Visual
    const sunGeo = new THREE.CircleGeometry(5, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff5b6 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(20, 40, 20);
    sun.lookAt(0, 0, 0);
    scene.add(sun);
    
    // Add some random realistic props (wooden crates, stone pillars, iron barrels)
    for (let i=0; i<30; i++) {
        // Leave center relatively open for fighting
        let px = (Math.random()-0.5)*MAP_SIZE*0.9;
        let pz = (Math.random()-0.5)*MAP_SIZE*0.9;
        if (Math.abs(px) < 5 && Math.abs(pz) < 5) continue; 
        
        const type = Math.random();
        let geo, mat, yOffset;
        
        if (type < 0.4) {
            // Wooden Crate
            geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
            mat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1.0 });
            yOffset = 1.5/2;
        } else if (type < 0.7) {
            // Iron Barrel
            geo = new THREE.CylinderGeometry(0.6, 0.6, 1.8, 16);
            mat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.4 });
            yOffset = 1.8/2;
        } else {
            // Stone Pillar or Rock
            geo = new THREE.CylinderGeometry(1, 1.2, 3, 6); // Hexagonal rock
            mat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9, flatShading: true });
            yOffset = 3/2;
        }
        
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(px, yOffset, pz);
        // Random slight rotation for natural look
        mesh.rotation.y = Math.random() * Math.PI;
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
    
    // Player Model
    playerSprite = createHumanoid(0x2563eb, config.playerImg); // Blue player with player image on head
    playerSprite.mesh.position.set(0, 0, 0);
    scene.add(playerSprite.mesh);
    
    // Controls
    setupJoystick();
    
    // Handle resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start Loop
    lastShootTime = Date.now();
    lastSpawnTime = Date.now();
    animate();
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupJoystick() {
    if (joystickManager) joystickManager.destroy();
    
    const zone = document.getElementById('joystick-zone');
    zone.innerHTML = '';
    
    joystickManager = nipplejs.create({
        zone: zone,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100
    });
    
    joystickManager.on('move', (evt, data) => {
        // Nipplejs vectors are 1.0 magnitude.
        joystickVector.x = data.vector.x;
        joystickVector.y = data.vector.y; 
    });
    
    joystickManager.on('end', () => {
        joystickVector.x = 0;
        joystickVector.y = 0;
    });
    
    // Bind buttons
    const btnDash = document.getElementById('btn-dash');
    const btnAttack = document.getElementById('btn-attack');
    
    // Clear old listeners by replacing node
    const newBtnD = btnDash ? btnDash.cloneNode(true) : null;
    if (newBtnD) btnDash.parentNode.replaceChild(newBtnD, btnDash);
    
    const newBtnA = btnAttack ? btnAttack.cloneNode(true) : null;
    if (newBtnA) btnAttack.parentNode.replaceChild(newBtnA, btnAttack);
    
    const handleDash = (e) => {
        if(e) e.preventDefault();
        const now = Date.now();
        if (battleState.isActive && now - dashCooldown > 3000) { // 3s cooldown
            isDashing = true;
            dashTime = now;
            dashCooldown = now;
            
            // Default dash forward if not moving joystick
            if (joystickVector.x === 0 && joystickVector.y === 0) {
                dashDirection.set(Math.sin(currentCameraAngle), 0, Math.cos(currentCameraAngle));
            } else {
                // Dash in joystick direction
                // Need to calculate world direction of joystick based on camera angle
                const jx = joystickVector.x;
                const jy = -joystickVector.y; // invert y for nipplejs
                const len = Math.sqrt(jx*jx + jy*jy) || 1;
                const normX = jx/len;
                const normY = jy/len;
                
                // Rotate vector by current camera angle
                const worldX = normX * Math.cos(-currentCameraAngle) - normY * Math.sin(-currentCameraAngle);
                const worldZ = normX * Math.sin(-currentCameraAngle) + normY * Math.cos(-currentCameraAngle);
                
                dashDirection.set(worldX, 0, worldZ).normalize();
            }
            
            const overlay = document.getElementById('dash-cooldown-overlay');
            if (overlay) {
                overlay.style.display = 'block';
                overlay.style.height = '100%';
                let pct = 100;
                const interval = setInterval(() => {
                    pct -= (100 / 30); // over 3 seconds (30 * 100ms)
                    overlay.style.height = `${Math.max(0, pct)}%`;
                    if (pct <= 0) {
                        clearInterval(interval);
                        overlay.style.display = 'none';
                    }
                }, 100);
            }
            
            // Dash effect: slight FOV bump
            if (camera) camera.fov = 70;
            if (camera) camera.updateProjectionMatrix();
        }
    };
    
    const handleAttack = (e) => {
        if(e) e.preventDefault();
        const now = Date.now();
        if (battleState.isActive && now - lastShootTime > attackInterval && !isPaused) {
            performMeleeAttack();
            lastShootTime = now;
        }
    };
    
    if (newBtnD) {
        newBtnD.addEventListener('mousedown', handleDash);
        newBtnD.addEventListener('touchstart', handleDash, { passive: false });
    }
    
    if (newBtnA) {
        newBtnA.addEventListener('mousedown', handleAttack);
        newBtnA.addEventListener('touchstart', handleAttack, { passive: false });
    }
    
    // Keyboard support for desktop
    window.onkeydown = (e) => {
        if (!battleState.isActive || isPaused) return;
        if (e.code === 'Space') {
            handleDash(e);
        }
        if (e.code === 'KeyF' || e.code === 'Enter') {
            const now = Date.now();
            if (now - lastShootTime > 400) {
                performMeleeAttack();
                lastShootTime = now;
            }
        }
    };
}

let isPaused = false;

function collectExp(amount) {
    currentExp += amount;
    if (typeof playSound === 'function') playSound('buy'); // using buy sound for pip
    
    if (currentExp >= expToNext) {
        currentExp -= expToNext; // carry over
        currentLevel++;
        expToNext = Math.floor(expToNext * 1.5);
        triggerLevelUp();
    }
    updateHUD();
}

function triggerLevelUp() {
    isPaused = true;
    const modal = document.getElementById('level-up-modal');
    const choicesContainer = document.getElementById('upgrade-choices');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    choicesContainer.innerHTML = '';
    if (typeof playSound === 'function') playSound('legendary');
    
    const possibleUpgrades = [
        { id: 'heal', name: 'Potion', desc: 'Heal 50% HP', icon: 'heart', color: 'red' },
        { id: 'maxhp', name: 'Vitality', desc: '+20 Max HP', icon: 'shield-plus', color: 'green' },
        { id: 'atk', name: 'Strength', desc: '+15% Damage', icon: 'swords', color: 'yellow' },
        { id: 'atk_spd', name: 'Alacrity', desc: '+20% Attack Speed', icon: 'zap', color: 'orange' },
        { id: 'spd', name: 'Agility', desc: '+10% Move Speed', icon: 'wind', color: 'blue' },
        { id: 'mag', name: 'Magnet', desc: '+30% Magnet Range', icon: 'magnet', color: 'purple' }
    ];
    
    // Pick 3 random
    const shuffled = possibleUpgrades.sort(() => 0.5 - Math.random());
    const choices = shuffled.slice(0, 3);
    
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = `w-full bg-gray-800 border-2 border-${choice.color}-500 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-700 hover:scale-[1.02] transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)]`;
        btn.innerHTML = `
            <div class="bg-${choice.color}-900/50 p-3 rounded-full border border-${choice.color}-400">
                <i data-lucide="${choice.icon}" class="w-8 h-8 text-${choice.color}-400"></i>
            </div>
            <div class="text-left flex-1">
                <div class="font-black text-white text-xl">${choice.name}</div>
                <div class="text-${choice.color}-300 text-sm font-bold">${choice.desc}</div>
            </div>
        `;
        btn.onclick = () => selectUpgrade(choice.id);
        choicesContainer.appendChild(btn);
    });
    
    lucide.createIcons();
}

function selectUpgrade(id) {
    if (id === 'heal') {
        currentHP = Math.min(maxHP, currentHP + (maxHP * 0.5));
    } else if (id === 'maxhp') {
        maxHP += 20;
        currentHP += 20;
    } else if (id === 'atk') {
        playerConfig.playerATK = Math.floor(playerConfig.playerATK * 1.15);
    } else if (id === 'atk_spd') {
        attackInterval = Math.max(100, attackInterval * 0.8);
    } else if (id === 'spd') {
        playerMoveSpeed *= 1.1;
    } else if (id === 'mag') {
        magnetRange *= 1.3;
    }
    
    updateHUD();
    document.getElementById('level-up-modal').classList.add('hidden');
    document.getElementById('level-up-modal').classList.remove('flex');
    isPaused = false;
    
    if (typeof playSound === 'function') playSound('buy');
}


function updateHUD() {
    document.getElementById('wave-kills').textContent = kills;
    document.getElementById('wave-target').textContent = targetKills;
    
    const hpPct = Math.max(0, (currentHP / maxHP) * 100);
    const hpBar = document.getElementById('player-hp-bar');
    if (hpBar) hpBar.style.width = `${hpPct}%`;
    const hpText = document.getElementById('player-hp-text');
    if (hpText) hpText.textContent = `${Math.ceil(currentHP)}/${Math.ceil(maxHP)}`;
    
    if (hpBar) {
        if (hpPct < 30) hpBar.className = "h-full bg-gradient-to-r from-red-600 to-red-400 w-full transition-all";
        else if (hpPct < 60) hpBar.className = "h-full bg-gradient-to-r from-yellow-500 to-yellow-400 w-full transition-all";
        else hpBar.className = "h-full bg-gradient-to-r from-green-500 to-green-400 w-full transition-all";
    }
    
    // EXP
    const expPct = Math.max(0, Math.min(100, (currentExp / expToNext) * 100));
    const expBar = document.getElementById('player-exp-bar');
    if (expBar) expBar.style.width = `${expPct}%`;
    const lvlText = document.getElementById('player-lvl-text');
    if (lvlText) lvlText.textContent = `LVL ${currentLevel}`;
}

function spawnEnemy() {
    if (enemies.length > 20) return; // limit
    
    // Choose random enemy rarity/type based on stage
    let maxWeightAllowed = 6000;
    if (playerConfig.stageLvl > 5) maxWeightAllowed = 2000;
    if (playerConfig.stageLvl > 15) maxWeightAllowed = 1000;
    
    // Only access global objects if defined in app.js
    if (typeof RARITIES === 'undefined' || typeof CHARACTERS === 'undefined') return;
    
    const validPool = Object.values(RARITIES).filter(r => r.weight >= maxWeightAllowed);
    const rarity = validPool[Math.floor(Math.random() * validPool.length)];
    const charPool = CHARACTERS.filter(c => c.rarity === rarity.name);
    if(charPool.length === 0) return;
    const char = charPool[Math.floor(Math.random() * charPool.length)];
    
    // Rarity mult
    const mult = Math.floor(6000 / rarity.weight) * (1 + (playerConfig.stageLvl * 0.1));
    const hp = Math.floor(20 * mult);
    const atk = Math.floor(2 * mult); // lower attack per hit because real time
    const speed = 0.05 + (Math.random() * 0.05);
    
    const imgUrl = getImageUrl(char.name, rarity.name); // global function
    
    // Custom Colors by Rarity
    let colorObj = 0xffffff;
    if (rarity.name === 'Common') colorObj = 0x888888;
    else if (rarity.name === 'Rare') colorObj = 0x3b82f6;
    else if (rarity.name === 'Epic') colorObj = 0xa855f7;
    else if (rarity.name === 'Legendary') colorObj = 0xeab308;
    else if (rarity.name === 'Mythic') colorObj = 0xf43f5e;
    else if (rarity.name === 'Secret') colorObj = 0x14b8a6;
    else if (rarity.name === 'Brainrot') colorObj = 0xd946ef;
    else if (rarity.name === 'Forbidden') colorObj = 0x000000;
    else if (rarity.name === 'Sahur Tier') colorObj = 0xffffff;
    
    const sprite = createHumanoid(colorObj, imgUrl);
    
    // Size scaling based on rarity
    const scale = 1 + (mult * 0.2);
    sprite.mesh.scale.set(scale, scale, scale);
    
    // Spawn at random edge of map
    const angle = Math.random() * Math.PI * 2;
    const radius = 20; 
    sprite.mesh.position.set(
        playerSprite.mesh.position.x + Math.cos(angle) * radius,
        0,
        playerSprite.mesh.position.z + Math.sin(angle) * radius
    );
    
    scene.add(sprite.mesh);
    
    enemies.push({
        mesh: sprite,
        hp: hp,
        atk: atk,
        speed: speed,
        lastHitTime: 0,
        charId: char.id
    });
}

function performMeleeAttack() {
    if (typeof playSound === 'function') playSound('hit');
    
    const geo = new THREE.BoxGeometry(3, 0.5, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const slash = new THREE.Mesh(geo, mat);
    
    const reach = 2.0;
    const forwardX = -Math.sin(currentCameraAngle);
    const forwardZ = -Math.cos(currentCameraAngle);
    
    slash.position.x = playerSprite.mesh.position.x + forwardX * reach;
    slash.position.y = playerSprite.mesh.position.y + 1;
    slash.position.z = playerSprite.mesh.position.z + forwardZ * reach;
    slash.rotation.y = -currentCameraAngle;
    
    // Force a swing animation on the player arm
    playerSprite.rArm.rotation.x = -Math.PI/2;
    
    scene.add(slash);
    projectiles.push({
        mesh: slash,
        dir: new THREE.Vector3(forwardX, 0, forwardZ),
        speed: 0.1,
        life: 10
    });
    
    const hitboxRadius = 2.5;
    for (let j = enemies.length - 1; j >= 0; j--) {
        const en = enemies[j];
        if (slash.position.distanceTo(en.mesh.mesh.position) < hitboxRadius) {
            const variance = 0.8 + (Math.random() * 0.4); 
            const dmg = Math.floor(playerConfig.playerATK * variance);
            
            en.hp -= dmg;
            showDamageText(en.mesh.mesh.position, dmg);
            
            if (en.hp <= 0) {
                createExplosion(en.mesh.mesh.position);
                dropGem(en.mesh.mesh.position);
                scene.remove(en.mesh.mesh);
                
                if (typeof state !== 'undefined' && en.charId) {
                    state.inventory[en.charId] = (state.inventory[en.charId] || 0) + 1;
                    if (typeof saveState === 'function') saveState();
                }
                
                enemies.splice(j, 1);
                if (typeof playSound === 'function') playSound('die');
                
                kills++;
                updateHUD();
                
                if (kills >= targetKills) {
                    playerConfig.onVictory();
                    return;
                }
            }
        }
    }
}

function dropGem(pos) {
    const geo = new THREE.OctahedronGeometry(0.3);
    const mat = new THREE.MeshStandardMaterial({ 
        color: 0x06b6d4, // cyan-500
        emissive: 0x0891b2,
        emissiveIntensity: 0.5,
        roughness: 0.2, 
        metalness: 0.8 
    });
    const gem = new THREE.Mesh(geo, mat);
    gem.position.copy(pos);
    gem.position.y = 0.5;
    
    // Add point light to gem
    const light = new THREE.PointLight(0x06b6d4, 0.5, 3);
    gem.add(light);
    
    scene.add(gem);
    
    gems.push({
        mesh: gem,
        velocity: new THREE.Vector3((Math.random()-0.5)*0.2, Math.random()*0.3, (Math.random()-0.5)*0.2)
    });
}

function createExplosion(pos) {
    for (let i=0; i<10; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            Math.random() * 0.4,
            (Math.random() - 0.5) * 0.4
        );
        
        scene.add(mesh);
        particles.push({ mesh, velocity, life: 30 });
    }
}

function showDamageText(pos, dmg) {
    const container = document.getElementById('damage-container');
    const el = document.createElement('div');
    el.textContent = `-${dmg}`;
    el.className = 'absolute font-black text-2xl text-yellow-300 drop-shadow-[0_0_5px_rgba(234,179,8,1)] pointer-events-none text-shadow animate-damage z-50';
    
    // Convert 3D pos to 2D
    const vector = pos.clone();
    vector.project(camera);
    
    const x = (vector.x *  .5 + .5) * window.innerWidth;
    const y = (vector.y * -.5 + .5) * window.innerHeight;
    
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function screenShake() {
    const app = document.getElementById('battle-screen');
    app.classList.add('animate-shake-hard');
    setTimeout(() => app.classList.remove('animate-shake-hard'), 200);
}

function animate() {
    if (!battleState.isActive) return;
    animationId = requestAnimationFrame(animate);
    
    if (isPaused) return;
    
    const now = Date.now();
    
    // --- 1. Move Player & Physics ---
    let actualMoveSpeed = playerMoveSpeed;
    
    // Dash Logic
    if (isDashing) {
        if (now - dashTime < 200) { // 200ms dash duration
            actualMoveSpeed *= 4; // Much faster
            if (camera && camera.fov > 60) {
                camera.fov -= 0.5;
                camera.updateProjectionMatrix();
            }
        } else {
            isDashing = false;
            // Restore FOV smoothly is handled below
        }
    }
    
    if (!isDashing && camera && camera.fov < 60) {
        camera.fov += 0.5;
        camera.updateProjectionMatrix();
    } else if (!isDashing && camera && camera.fov > 60) {
        camera.fov -= 0.5;
        camera.updateProjectionMatrix();
    }

    let isMoving = false;
    
    // Apply gravity
    playerYVelocity -= 0.02;
    playerSprite.mesh.position.y += playerYVelocity;
    
    if (playerSprite.mesh.position.y <= 0) { // 0 is ground level for 3D model pivots
        playerSprite.mesh.position.y = 0;
        playerYVelocity = 0;
        isGrounded = true;
    } else {
        isGrounded = false;
    }

    if (isDashing) {
        // Force movement in dash direction
        playerSprite.mesh.position.addScaledVector(dashDirection, actualMoveSpeed);
        
        // Dash trail particles
        if (Math.random() > 0.3) {
            createDashParticle(playerSprite.mesh.position, dashDirection);
        }

        // Rotate player to face dash direction
        currentCameraAngle = Math.atan2(dashDirection.x, dashDirection.z);
        playerSprite.mesh.rotation.y = currentCameraAngle;
        isMoving = true;
    } else if (joystickVector.x !== 0 || joystickVector.y !== 0) {
        // Left/Right joystick rotates the character
        currentCameraAngle -= joystickVector.x * 0.05;
        playerSprite.mesh.rotation.y = currentCameraAngle;
        
        // Up/Down joystick moves forward/backward relative to facing direction
        const moveZ = joystickVector.y * actualMoveSpeed;
        
        playerSprite.mesh.position.x += Math.sin(currentCameraAngle) * moveZ;
        playerSprite.mesh.position.z += Math.cos(currentCameraAngle) * moveZ;
        
        isMoving = true;
    }
    
    // Player Animation
    if (isMoving) {
        playerSprite.cycle += 0.2;
        playerSprite.lLeg.rotation.x = Math.sin(playerSprite.cycle) * 0.8;
        playerSprite.rLeg.rotation.x = -Math.sin(playerSprite.cycle) * 0.8;
        // Don't override arm if currently attacking
        if (playerSprite.rArm.rotation.x > -1) {
            playerSprite.lArm.rotation.x = -Math.sin(playerSprite.cycle) * 0.8;
            playerSprite.rArm.rotation.x = Math.sin(playerSprite.cycle) * 0.8;
        }
    } else {
        // Idle recovery
        playerSprite.lLeg.rotation.x *= 0.8;
        playerSprite.rLeg.rotation.x *= 0.8;
        if (playerSprite.rArm.rotation.x > -1) {
            playerSprite.lArm.rotation.x *= 0.8;
            playerSprite.rArm.rotation.x *= 0.8;
        }
        // Breathing
        playerSprite.cycle += 0.05;
        playerSprite.mesh.position.y += Math.sin(playerSprite.cycle) * 0.01;
    }
    
    // Attack arm recovery
    if (playerSprite.rArm.rotation.x < -0.1) {
        playerSprite.rArm.rotation.x += 0.2; 
    }
    
    // --- 2. Camera Follow (True 3rd Person POV) ---
    // Position camera tightly behind and offset to the right (Fortnite Style)
    const camDist = 5.0;
    const camHeight = 2.8;
    const rightOffset = 1.2;
    
    // The camera should always be behind the player's back
    const backAngle = currentCameraAngle + Math.PI; 
    const rightAngle = currentCameraAngle - Math.PI / 2;
    
    // Smooth camera lag calculation
    const targetCamX = playerSprite.mesh.position.x + Math.sin(backAngle) * camDist + Math.sin(rightAngle) * rightOffset;
    const targetCamZ = playerSprite.mesh.position.z + Math.cos(backAngle) * camDist + Math.cos(rightAngle) * rightOffset;
    const targetCamY = playerSprite.mesh.position.y + camHeight;
    
    // Lerp camera for smoothness
    camera.position.x += (targetCamX - camera.position.x) * 0.2;
    camera.position.z += (targetCamZ - camera.position.z) * 0.2;
    camera.position.y += (targetCamY - camera.position.y) * 0.2;
    
    // Look far ahead to offset the player to the left of the screen
    const lookDist = 20;
    const lookX = playerSprite.mesh.position.x + Math.sin(currentCameraAngle) * lookDist;
    const lookZ = playerSprite.mesh.position.z + Math.cos(currentCameraAngle) * lookDist;
    
    const lookTarget = new THREE.Vector3(lookX, playerSprite.mesh.position.y + 2.5, lookZ);
    camera.lookAt(lookTarget);
    
    // --- 3. Spawn Enemies ---
    if (now - lastSpawnTime > 1500) {
        spawnEnemy();
        lastSpawnTime = now;
    }
    
    // --- 4. Enemy Logic ---
    let nearestEnemy = null;
    let nearestDist = Infinity;
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        
        // Move towards player
        const dir = new THREE.Vector3().subVectors(playerSprite.mesh.position, en.mesh.mesh.position);
        const dist = dir.length();
        dir.normalize();
        
        en.mesh.mesh.position.addScaledVector(dir, en.speed);
        en.mesh.mesh.rotation.y = Math.atan2(dir.x, dir.z); // look at player
        
        // NPC Walk Animation
        en.mesh.cycle += en.speed * 2;
        en.mesh.lLeg.rotation.x = Math.sin(en.mesh.cycle) * 0.8;
        en.mesh.rLeg.rotation.x = -Math.sin(en.mesh.cycle) * 0.8;
        
        if (now - en.lastHitTime > 500) {
            en.mesh.lArm.rotation.x = -Math.sin(en.mesh.cycle) * 0.8;
            en.mesh.rArm.rotation.x = Math.sin(en.mesh.cycle) * 0.8;
        } else {
            // attack anim
            en.mesh.rArm.rotation.x = -Math.PI/2;
        }
        
        // Find nearest for shooting
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = en;
        }
        
        // Melee collision - player is invincible while dashing
        if (dist < 1.5 && !isDashing) {
            if (now - en.lastHitTime > 1000) { // attack cooldown
                currentHP -= en.atk;
                en.lastHitTime = now;
                updateHUD();
                screenShake();
                
                // Show damage text on player
                const screenPos = playerSprite.mesh.position.clone();
                screenPos.y += 2;
                showDamageText(screenPos, en.atk);
                
                if (currentHP <= 0) {
                    playerConfig.onDefeat();
                    return;
                }
            }
        }
    }
    
    // --- 5. Melee Visuals ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.mesh.position.addScaledVector(p.dir, p.speed);
        if (p.mesh.material) p.mesh.material.opacity -= 0.08;
        p.life--;
        
        if (p.life <= 0) {
            scene.remove(p.mesh);
            projectiles.splice(i, 1);
        }
    }
    
    // --- 6. Particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.add(p.velocity);
        if (p.onUpdate) p.onUpdate(p);
        else p.velocity.y -= 0.02; // default gravity if no custom update
        p.life--;
        
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
    
    // --- 7. EXP Gems ---
    for (let i = gems.length - 1; i >= 0; i--) {
        const gem = gems[i];
        
        // physics
        gem.mesh.position.add(gem.velocity);
        if (gem.mesh.position.y > 0.5) {
            gem.velocity.y -= 0.02; // gravity
        } else {
            gem.mesh.position.y = 0.5;
            gem.velocity.x *= 0.8;
            gem.velocity.z *= 0.8;
            gem.velocity.y = 0;
        }
        gem.mesh.rotation.y += 0.05;
        gem.mesh.rotation.z += 0.02;
        
        // magnet
        const distToPlayer = gem.mesh.position.distanceTo(playerSprite.mesh.position);
        if (distToPlayer < magnetRange) {
            const dir = new THREE.Vector3().subVectors(playerSprite.mesh.position, gem.mesh.position).normalize();
            // speed up as it gets closer
            const pullStrength = 0.1 + (magnetRange - distToPlayer) * 0.05;
            gem.mesh.position.addScaledVector(dir, pullStrength);
        }
        
        // collect
        if (distToPlayer < 1.0) {
            scene.remove(gem.mesh);
            gems.splice(i, 1);
            collectExp(1);
        }
    }
    
    renderer.render(scene, camera);
}

function cleanup3DArena() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onWindowResize);
    
    if (joystickManager) {
        joystickManager.destroy();
        joystickManager = null;
    }
    
    // Clear dom
    const container = document.getElementById('canvas-container');
    container.innerHTML = '';
}

function createDashParticle(pos, dir) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.6 });
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.y += 1;
    
    // Slow drift opposite to dash
    const velocity = new THREE.Vector3().copy(dir).multiplyScalar(-0.05);
    velocity.y += (Math.random()-0.5) * 0.05;
    
    scene.add(mesh);
    particles.push({ 
        mesh, 
        velocity, 
        life: 15,
        onUpdate: (p) => {
            p.mesh.material.opacity -= 0.04;
            p.mesh.scale.multiplyScalar(0.9);
        }
    });
}
