// Configuration
const SCREENS = {
    MENU: 'menu-screen',
    SUMMON: 'summon-screen',
    SHOP: 'shop-screen',
    COLLECTION: 'collection-screen',
    SETTINGS: 'settings-screen',
    BATTLE: 'battle-screen'
};

const RARITIES = {
    Common: { name: 'Common', weight: 6000, coins: 1, class: 'Common' },
    Rare: { name: 'Rare', weight: 2000, coins: 3, class: 'Rare' },
    Epic: { name: 'Epic', weight: 1000, coins: 5, class: 'Epic' },
    Legendary: { name: 'Legendary', weight: 500, coins: 10, class: 'Legendary' },
    Mythic: { name: 'Mythic', weight: 300, coins: 20, class: 'Mythic' },
    Secret: { name: 'Secret', weight: 100, coins: 50, class: 'Secret' },
    Brainrot: { name: 'Brainrot', weight: 80, coins: 75, class: 'Brainrot' },
    Forbidden: { name: 'Forbidden', weight: 15, coins: 150, class: 'Forbidden' },
    Sahur: { name: 'Sahur Tier', weight: 5, coins: 500, class: 'Sahur' }
};

const CHARACTERS = [
    { id: '1', name: 'Sticko Lungo', rarity: 'Common' },
    { id: '2', name: 'Teapotino Bruno', rarity: 'Common' },
    { id: '3', name: 'Ballerina Cappuccina', rarity: 'Common' },
    { id: '4', name: 'Treebeardo Mossini', rarity: 'Common' },
    { id: '5', name: 'Orange Flexino', rarity: 'Common' },
    { id: '6', name: 'Pigeon Bombardino', rarity: 'Common' },
    { id: '7', name: 'Elephanto Sandalino', rarity: 'Common' },
    { id: '8', name: 'Banano Chimpini', rarity: 'Common' },
    { id: '9', name: 'Tire Froggo', rarity: 'Common' },
    { id: '10', name: 'Watermeloni Bootini', rarity: 'Common' },
    { id: '11', name: 'Toro Discotto', rarity: 'Common' },
    { id: '12', name: 'Wifi Skeletoni', rarity: 'Common' },
    { id: '13', name: 'Sharko Sneakerino', rarity: 'Rare' },
    { id: '14', name: 'Ninja Coffee Ronin', rarity: 'Rare' },
    { id: '15', name: 'Crocodilo Jetto', rarity: 'Rare' },
    { id: '16', name: 'Crab Chefino', rarity: 'Rare' },
    { id: '17', name: 'Pigeon Tankini', rarity: 'Rare' },
    { id: '18', name: 'Fish Catto', rarity: 'Rare' },
    { id: '19', name: 'Madam Espresso', rarity: 'Epic' },
    { id: '20', name: 'Spaghetti Reaperino', rarity: 'Epic' },
    { id: '21', name: 'Ravioli Titanio', rarity: 'Epic' },
    { id: '22', name: 'Mozzarella Dragonio', rarity: 'Legendary' },
    { id: '23', name: 'Gelato Ghostino', rarity: 'Legendary' },
    { id: '24', name: 'Pizza Phantomino', rarity: 'Legendary' },
    { id: '25', name: 'Cappuccino Assassino', rarity: 'Mythic' },
    { id: '26', name: 'Bombardino Crocodilo', rarity: 'Mythic' },
    { id: '27', name: 'Tralalero Tralala', rarity: 'Secret' },
    { id: '28', name: 'Brr Brr Patapim', rarity: 'Brainrot' },
    { id: '29', name: 'Il Mostro Proibito', rarity: 'Forbidden' },
    { id: '30', name: 'Tung Tung Tung Sahur', rarity: 'Sahur' }
];

const UPGRADE_COSTS = {
    luck: (lvl) => Math.floor(50 * Math.pow(1.5, lvl)),
    coins: (lvl) => Math.floor(100 * Math.pow(1.6, lvl))
};

// Global State
let currentScreen = SCREENS.BATTLE;
let isSummoning = false;
let totalWeight = 0;

let state = {
    coins: 0,
    totalSummons: 0,
    inventory: {}, // charId: count
    soundOn: true,
    upgrades: { luck: 0, coins: 0 },
    battleStage: 1
};

// Battle State
let battleState = {
    selectedChar: null,
    isActive: false
};

// BATTLE SYSTEM 3D INTERFACE
function getRarityMultiplier(rarityName) {
    const r = RARITIES[rarityName] || RARITIES.Common;
    return Math.floor(6000 / r.weight); 
}

function initBattleSetup() {
    document.getElementById('battle-stage-lvl').textContent = state.battleStage;
    document.getElementById('battle-setup').classList.remove('hidden');
    document.getElementById('battle-results').classList.add('hidden');
    document.getElementById('battle-combat-ui').classList.add('hidden');
    document.getElementById('canvas-container').classList.add('hidden');
    
    battleState.selectedChar = null;
    renderBattleSetup();
}

function pickBattleCharacter(charId) {
    battleState.selectedChar = charId;
    renderBattleSetup();
}

function renderBattleSetup() {
    const grid = document.getElementById('battle-roster-grid');
    grid.innerHTML = '';
    
    const unlocked = CHARACTERS.filter(c => state.inventory[c.id] > 0);
    unlocked.sort((a,b) => getRarityMultiplier(b.rarity) - getRarityMultiplier(a.rarity));

    unlocked.forEach(char => {
        const charData = RARITIES[char.rarity];
        const imgUrl = getImageUrl(char.name, charData.name);
        
        const isSelected = battleState.selectedChar === char.id;
        const mult = getRarityMultiplier(char.rarity);
        
        const el = document.createElement('div');
        el.className = `p-1 rounded bg-gray-800 border-2 cursor-pointer hover:bg-gray-700 transition-colors ${isSelected ? 'border-red-500 shadow-[0_0_10px_#ef4444_inset] scale-95' : `border-${charData.class}`}`;
        el.onclick = () => { if(!isSelected) pickBattleCharacter(char.id); };
        
        el.innerHTML = `
            <div class="w-full aspect-square bg-gray-900 flex items-center justify-center overflow-hidden rounded relative pointer-events-none">
                <img src="${imgUrl}" class="w-full h-full object-cover">
                <div class="absolute bottom-0 right-1 text-[8px] font-black text-white drop-shadow-[0_1px_1px_#000]">Lv${mult}</div>
            </div>
        `;
        grid.appendChild(el);
    });

    if (unlocked.length === 0) {
        grid.innerHTML = '<div class="col-span-4 text-center text-gray-500 text-sm mt-4">Summon first!</div>';
    }

    // Render Main Slot
    const slotEl = document.getElementById('slot-0');
    if (battleState.selectedChar) {
        const char = CHARACTERS.find(c => c.id === battleState.selectedChar);
        const charData = RARITIES[char.rarity];
        const imgUrl = getImageUrl(char.name, charData.name);
        slotEl.innerHTML = `<img src="${imgUrl}" class="w-full h-full object-cover p-2">`;
        document.getElementById('btn-start-battle').classList.remove('opacity-50', 'pointer-events-none');
    } else {
        slotEl.innerHTML = `<i data-lucide="user" class="text-gray-500 mb-1 w-8 h-8"></i><span class="text-xs text-gray-500 font-bold">SELECT</span>`;
        document.getElementById('btn-start-battle').classList.add('opacity-50', 'pointer-events-none');
    }
    
    lucide.createIcons();
}

function start3DBattle() {
    if (!battleState.selectedChar || typeof init3DArena !== 'function') return;
    
    document.getElementById('battle-setup').classList.add('hidden');
    document.getElementById('battle-combat-ui').classList.remove('hidden');
    document.getElementById('battle-combat-ui').classList.add('flex');
    document.getElementById('canvas-container').classList.remove('hidden');
    
    battleState.isActive = true;
    
    // Pass config to the 3D engine
    const char = CHARACTERS.find(c => c.id === battleState.selectedChar);
    const rarity = RARITIES[char.rarity];
    const mult = getRarityMultiplier(char.rarity);
    const imgUrl = getImageUrl(char.name, rarity.name);
    
    init3DArena({
        playerImg: imgUrl,
        playerATK: Math.floor(10 * mult),
        playerMaxHP: Math.floor(100 * mult),
        stageLvl: state.battleStage,
        onVictory: () => showBattleResults(true),
        onDefeat: () => showBattleResults(false)
    });
}

// Audio System
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!state.soundOn) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        
        if (type === 'summon') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'rare') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'legendary') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.5);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'sahur') {
            // heavy bass drop
            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 2);
            gainNode.gain.setValueAtTime(1, now); // LOUD
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2);
            osc.start(now);
            osc.stop(now + 2);
        } else if (type === 'buy') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(900, now + 0.1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'hit') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'die') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
            gainNode.gain.setValueAtTime(0.4, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (e) { console.error("Audio error", e); }
}

function speak(text, rarity) {
    if (!state.soundOn || !('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    let msg = new SpeechSynthesisUtterance(text);
    
    if (rarity === 'Sahur' || rarity === 'Forbidden') {
        msg.pitch = 0.1;
        msg.rate = 0.6;
        msg.volume = 1.0;
    } else if (rarity === 'Brainrot' || rarity === 'Secret') {
        msg.pitch = 2;
        msg.rate = 1.8;
        msg.volume = 0.8;
    } else {
        msg.pitch = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
        msg.rate = 1.2;
        msg.volume = 0.6;
    }
    window.speechSynthesis.speak(msg);
}

// Logic Methods
function calcWeights() {
    totalWeight = 0;
    Object.values(RARITIES).forEach(r => {
        let w = r.weight;
        // Luck upgrade math
        if (r.name !== 'Common') {
            w = Math.floor(w * (1 + (state.upgrades.luck * 0.2)));
        } else {
             w = Math.floor(w * Math.max(0.1, (1 - (state.upgrades.luck * 0.05))));
        }
        r.currentWeight = w;
        totalWeight += w;
    });
}

function getRandomCharacter() {
    calcWeights();
    let roll = Math.random() * totalWeight;
    let selectedRarity = null;
    let currentSum = 0;
    
    for (const key in RARITIES) {
        currentSum += RARITIES[key].currentWeight;
        if (roll <= currentSum) {
            selectedRarity = RARITIES[key];
            break;
        }
    }
    
    if (!selectedRarity) selectedRarity = RARITIES.Common;
    
    const pool = CHARACTERS.filter(c => c.rarity === selectedRarity.name);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return { char: chosen, rarityData: selectedRarity };
}

function getImageUrl(charName, rarityName) {
    const encoded = encodeURIComponent(charName);
    if (rarityName === 'Legendary' || rarityName === 'Mythic') {
         return `https://robohash.org/${encoded}?set=set1&size=250x250`; 
    } else if (rarityName === 'Secret' || rarityName === 'Forbidden' || rarityName === 'Sahur Tier') {
         return `https://robohash.org/${encoded}?set=set3&size=250x250&bgset=bg2`; 
    }
    return `https://robohash.org/${encoded}?set=set2&size=250x250&bgset=bg1`;
}

// Interacting
async function doSummon() {
    if (isSummoning) return;
    isSummoning = true;
    
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const uiImgCont = document.getElementById('spawn-image-container');
    const uiImg = document.getElementById('spawn-image');
    const uiName = document.getElementById('spawn-name');
    const uiRarity = document.getElementById('spawn-rarity');
    const uiCoins = document.getElementById('spawn-coins');
    const fxLayer = document.getElementById('fx-layer');
    const fxText = document.getElementById('fx-text');
    const app = document.getElementById('app');
    
    // Reset UI
    uiImgCont.style.opacity = '0';
    uiImgCont.style.transform = 'scale(0.5)';
    uiRarity.style.opacity = '0';
    uiCoins.style.opacity = '0';
    uiCoins.style.transform = 'translateY(16px)';
    uiName.textContent = 'SUMMONING...';
    uiName.className = 'text-3xl font-black text-center text-pink-500 animate-pulse';
    
    const { char, rarityData } = getRandomCharacter();
    const imgUrl = getImageUrl(char.name, rarityData.name);
    uiImg.src = imgUrl; // Start loading
    
    playSound('summon');
    app.classList.add('animate-shake-hard');
    
    await new Promise(r => setTimeout(r, 400)); // suspense wait
    app.classList.remove('animate-shake-hard');
    
    speak(char.name, rarityData.name);
    
    // Rarity Visual FX
    if (rarityData.name === 'Rare') {
        app.classList.add('animate-flash');
        setTimeout(() => app.classList.remove('animate-flash'), 200);
        playSound('rare');
    } else if (rarityData.name === 'Epic' || rarityData.name === 'Legendary') {
        app.classList.add('animate-flash');
        setTimeout(() => app.classList.remove('animate-flash'), 400);
        app.classList.add('animate-shake');
        setTimeout(() => app.classList.remove('animate-shake'), 400);
        playSound('legendary');
    } else if (rarityData.name === 'Mythic' || rarityData.name === 'Secret' || rarityData.name === 'Brainrot') {
        app.classList.add('animate-glitch');
        setTimeout(() => app.classList.remove('animate-glitch'), 800);
        fxLayer.style.opacity = '1';
        fxLayer.style.backgroundColor = 'rgba(236, 72, 153, 0.5)'; // pink
        setTimeout(() => { fxLayer.style.opacity = '0'; }, 800);
        playSound('legendary');
    } else if (rarityData.name === 'Forbidden' || rarityData.name === 'Sahur Tier') {
        fxLayer.style.opacity = '1';
        fxLayer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        fxText.style.display = 'block';
        fxText.textContent = rarityData.name.toUpperCase() + ' DETECTED!';
        fxText.className = `text-4xl md:text-6xl font-meme font-black text-center whitespace-nowrap text-${rarityData.class} animate-shake-hard`;
        playSound('sahur');
        await new Promise(r => setTimeout(r, 2000));
        fxLayer.style.opacity = '0';
        fxText.style.display = 'none';
        fxLayer.style.backgroundColor = 'transparent';
    }
    
    // Reveal character
    uiImgCont.className = `absolute inset-0 flex items-center justify-center transition-all duration-300 drop-shadow-2xl opacity-100 scale-100`;
    uiName.textContent = char.name;
    uiName.className = `text-3xl font-black text-center drop-shadow-md text-${rarityData.class}`;
    
    uiRarity.textContent = rarityData.name.toUpperCase();
    uiRarity.className = `text-xl font-black font-meme tracking-widest mt-1 text-${rarityData.class}`;
    uiRarity.style.opacity = '1';
    
    let coinGain = rarityData.coins;
    coinGain = Math.floor(coinGain * (1 + (state.upgrades.coins * 0.20)));
    
    uiCoins.textContent = `+${coinGain} 🪙`;
    uiCoins.style.opacity = '1';
    uiCoins.style.transform = 'translateY(0)';
    
    // Mutate state
    state.coins += coinGain;
    state.totalSummons++;
    state.inventory[char.id] = (state.inventory[char.id] || 0) + 1;
    
    saveState();
    updateTopbar();
    
    setTimeout(() => { isSummoning = false; }, 300);
}

function buyUpgrade(type) {
    const cost = UPGRADE_COSTS[type](state.upgrades[type]);
    if (state.coins >= cost) {
        state.coins -= cost;
        state.upgrades[type]++;
        playSound('buy');
        saveState();
        renderShop();
        updateTopbar();
    }
}

// Rendering UI
function navigate(screen) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screen).classList.remove('hidden');
    currentScreen = screen;
    
    if (screen === SCREENS.COLLECTION) renderCollection();
    if (screen === SCREENS.SHOP) renderShop();
    if (screen === SCREENS.BATTLE) initBattleSetup();
    
    updateTopbar();
}


function showBattleResults(isWin) {
    battleState.isActive = false;
    
    // Cleanup 3D engine if needed
    if (typeof cleanup3DArena === 'function') cleanup3DArena();
    
    document.getElementById('battle-combat-ui').classList.add('hidden');
    document.getElementById('battle-combat-ui').classList.remove('flex');
    document.getElementById('canvas-container').classList.add('hidden');
    
    const modal = document.getElementById('battle-results');
    const title = document.getElementById('battle-result-title');
    const desc = document.getElementById('battle-result-desc');
    const rewardsBox = document.getElementById('battle-rewards-box');
    const coinTxt = document.getElementById('battle-reward-coins');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    if (isWin) {
        title.textContent = 'STAGE CLEARED';
        title.className = `text-4xl sm:text-6xl font-black font-meme text-center mb-4 text-green-400 drop-shadow-[0_0_20px_#4ade80] transform transition-all duration-500`;
        desc.textContent = `You dominated Wave ${state.battleStage}!`;
        
        let reward = Math.floor(150 * Math.pow(1.3, state.battleStage));
        reward = Math.floor(reward * (1 + (state.upgrades.coins * 0.1)));
        
        coinTxt.textContent = reward;
        rewardsBox.classList.remove('hidden');
        
        state.coins += reward;
        state.battleStage++;
        saveState();
        playSound('rare');
    } else {
        title.textContent = 'WRECKED';
        title.className = `text-6xl font-black font-meme text-center mb-4 text-red-600 drop-shadow-[0_0_20px_#ef4444] transform transition-all duration-500`;
        desc.textContent = `Your Brainrot was fully scrubbed on Wave ${state.battleStage}...`;
        rewardsBox.classList.add('hidden');
        playSound('die');
    }
    
    updateTopbar();
    
    requestAnimationFrame(() => {
        title.classList.remove('scale-150', 'opacity-0');
        title.classList.add('scale-100', 'opacity-100');
        rewardsBox.classList.remove('translate-y-10', 'opacity-0');
        document.getElementById('battle-continue-btn').classList.remove('translate-y-10', 'opacity-0');
    });
}

function endBattle() {
    const modal = document.getElementById('battle-results');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    
    // Reset modal anims
    const title = document.getElementById('battle-result-title');
    title.classList.add('scale-150', 'opacity-0');
    title.classList.remove('scale-100', 'opacity-100');
    
    // Return to setup
    initBattleSetup();
}

function renderCollection() {
    const grid = document.getElementById('collection-grid');
    grid.innerHTML = '';
    
    let unlockedCount = 0;
    
    CHARACTERS.forEach(char => {
        const charData = RARITIES[char.rarity] || RARITIES.Common;
        const count = state.inventory[char.id] || 0;
        if (count > 0) unlockedCount++;
        
        const isUnlocked = count > 0;
        const imgUrl = getImageUrl(char.name, charData.name);

        const box = document.createElement('div');
        box.className = `flex flex-col items-center p-2 rounded-2xl border-2 transition-all ${isUnlocked ? `border-${charData.class} bg-gray-800` : 'border-dashed border-gray-700 bg-gray-900/50 opacity-60'}`;
        
        if (isUnlocked && charData.name !== 'Common') {
            box.classList.add(`glow-${charData.class}`);
        }
        
        box.innerHTML = `
            <div class="w-20 h-20 mb-2 rounded-full overflow-hidden bg-gray-950 flex flex-col justify-center items-center relative shadow-inner border border-white/5">
                ${isUnlocked ? `<img src="${imgUrl}" class="w-full h-full object-cover">` : `<i data-lucide="lock" class="text-gray-700 w-8 h-8"></i>`}
            </div>
            <div class="text-[10px] sm:text-xs font-bold text-center ${isUnlocked ? `text-${charData.class}` : 'text-gray-500'} leading-tight line-clamp-2 h-8 w-full">
                ${isUnlocked ? char.name : '???'}
            </div>
            <div class="text-[9px] mt-1 font-meme px-2 py-0.5 rounded-full ${isUnlocked ? `bg-${charData.class}/10 text-${charData.class} border border-${charData.class}/30` : 'bg-gray-800 text-gray-500'}">
                ${isUnlocked ? charData.name.toUpperCase() : 'LOCKED'}
                ${isUnlocked && count > 1 ? `<span class="opacity-70 ml-1">x${count}</span>` : ''}
            </div>
        `;
        grid.appendChild(box);
    });
    
    document.getElementById('col-count').textContent = unlockedCount;
    document.getElementById('col-total').textContent = CHARACTERS.length;
    lucide.createIcons();
}

function renderShop() {
    document.getElementById('shop-stat-summons').textContent = state.totalSummons;
    document.getElementById('shop-stat-coins').textContent = state.coins;

    const renderUpgrade = (type) => {
        document.getElementById(`shop-${type}-lvl`).textContent = state.upgrades[type];
        const cost = UPGRADE_COSTS[type](state.upgrades[type]);
        const formatCost = cost > 100000 ? (cost/1000).toFixed(1)+'k' : cost;
        document.getElementById(`shop-${type}-cost`).textContent = formatCost;
        
        const btn = document.getElementById(`btn-buy-${type}`);
        if (state.coins < cost) {
            btn.classList.add('opacity-50', 'saturate-50');
            btn.classList.remove('hover:bg-pink-500', 'hover:bg-yellow-400');
            btn.onclick = null;
        } else {
            btn.classList.remove('opacity-50', 'saturate-50');
            if (type === 'luck') btn.classList.add('hover:bg-pink-500');
            if (type === 'coins') btn.classList.add('hover:bg-yellow-400');
            btn.onclick = () => buyUpgrade(type);
        }
    };
    
    renderUpgrade('luck');
    renderUpgrade('coins');
}

function toggleSetting(setting) {
    if (setting === 'sound') {
        state.soundOn = !state.soundOn;
        renderSettings();
        saveState();
    }
}

function renderSettings() {
    const toggle = document.getElementById('toggle-sound');
    const dot = toggle.querySelector('div');
    if (state.soundOn) {
        toggle.classList.remove('bg-gray-600', 'border-gray-500');
        toggle.classList.add('bg-pink-600');
        dot.style.transform = 'translateX(100%)';
    } else {
        toggle.classList.remove('bg-pink-600');
        toggle.classList.add('bg-gray-600', 'border-2', 'border-gray-500');
        dot.style.transform = 'translateX(0)';
    }
}

function resetProgress() {
    if (confirm("Are you literally going to delete all your Brainrot? This cannot be undone!")) {
        localStorage.removeItem('brainrot_save');
        location.reload();
    }
}

function saveState() {
    localStorage.setItem('brainrot_save', JSON.stringify(state));
}

function updateTopbar() {
    const coinStr = state.coins > 10000 ? (state.coins/1000).toFixed(1)+'k' : state.coins;
    document.getElementById('top-coins').textContent = coinStr;
    document.getElementById('menu-coins').textContent = coinStr;
    
    if (currentScreen === SCREENS.MENU) {
        document.getElementById('topbar').classList.add('hidden');
    } else {
        document.getElementById('topbar').classList.remove('hidden');
    }
}

// Lifecycle
document.addEventListener('DOMContentLoaded', () => {
    // Load state
    const saved = localStorage.getItem('brainrot_save');
    if (saved) {
        try {
            state = { ...state, ...JSON.parse(saved) };
            // Add any missing upgrades manually due to backwards compatibility
            if (state.upgrades === undefined) state.upgrades = { luck: 0, coins: 0 };
            if (state.battleStage === undefined) state.battleStage = 1;
        } catch(e) {}
    }
    
    lucide.createIcons();
    updateTopbar();
    renderSettings();
    navigate(SCREENS.BATTLE);
});
