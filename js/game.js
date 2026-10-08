/* ============================================
   THE DRAGON'S SHADOW - Game Engine
   ============================================ */

const GameState = {
  playerName: '',
  playerGender: '',
  currentStep: 0,
  health: 100,
  inventory: [],
  flags: {},
  choiceHistory: [],

  save() {
    localStorage.setItem('dragonStory_save', JSON.stringify({
      playerName: this.playerName,
      playerGender: this.playerGender,
      currentStep: this.currentStep,
      health: this.health,
      inventory: this.inventory,
      flags: this.flags,
      choiceHistory: this.choiceHistory
    }));
  },

  load() {
    const data = localStorage.getItem('dragonStory_save');
    if (data) {
      const parsed = JSON.parse(data);
      Object.assign(this, parsed);
      return true;
    }
    return false;
  },

  reset() {
    this.playerName = '';
    this.playerGender = '';
    this.currentStep = 0;
    this.health = 100;
    this.inventory = [];
    this.flags = {};
    this.choiceHistory = [];
    localStorage.removeItem('dragonStory_save');
  },

  addItem(item) {
    if (!this.inventory.includes(item)) {
      this.inventory.push(item);
    }
  },

  removeItem(item) {
    this.inventory = this.inventory.filter(i => i !== item);
  },

  hasItem(item) {
    return this.inventory.includes(item);
  },

  setFlag(flag) {
    this.flags[flag] = true;
  },

  hasFlag(flag) {
    return !!this.flags[flag];
  },

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
  },

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }
};

// Navigation
function goToPage(page) {
  window.location.href = page;
}

// Choice handler
function makeChoice(choiceId, currentPage) {
  GameState.choiceHistory.push({ page: currentPage, choice: choiceId });
  GameState.save();

  // Navigation map
  const navMap = {
    // From attack page
    'attack_chase': 'gameover.html?reason=reckless',
    'attack_prepare': 'forest.html',
    'attack_help': 'gameover.html?reason=delayed_help',

    // From forest page
    'forest_cave': 'gameover.html?reason=cave',
    'forest_mountain': 'goblins.html',
    'forest_river': 'gameover.html?reason=delayed_river',

    // From goblins page
    'goblins_fight': 'village.html?status=injured',
    'goblins_sneak': 'village.html?status=safe',
    'goblins_talk': 'gameover.html?reason=talk',

    // From village page
    'village_steal': 'gameover.html?reason=steal',
    'village_trade': 'mountain.html',
    'village_sneak': 'gameover.html?reason=delayed_sneak',

    // From mountain page
    'mountain_main': 'gameover.html?reason=traps',
    'mountain_hidden': 'fortress.html',
    'mountain_bridge': 'gameover.html?reason=delayed_bridge',

    // From fortress page
    'fortress_front': 'gameover.html?reason=frontdoor',
    'fortress_secret': 'superlord.html',
    'fortress_distraction': 'gameover.html?reason=delayed_distraction',

    // From superlord page
    'superlord_attack': 'gameover.html?reason=attack',
    'superlord_free': 'bossfight.html',
    'superlord_duel': 'bossfight.html?mode=honor'
  };

  const target = navMap[choiceId];
  if (target) {
    goToPage(target);
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  // Load game state
  GameState.load();

  // Update health bar if exists
  const healthFill = document.querySelector('.health-fill');
  if (healthFill) {
    healthFill.style.width = GameState.health + '%';
  }

  // Update inventory if exists
  const inventoryBar = document.querySelector('.inventory-bar');
  if (inventoryBar && GameState.inventory.length > 0) {
    const itemsHtml = GameState.inventory.map(item =>
      `<span class="inventory-item">${item}</span>`
    ).join('');
    inventoryBar.innerHTML = `<span class="inventory-label">Inventory:</span> ${itemsHtml}`;
  } else if (inventoryBar) {
    inventoryBar.style.display = 'none';
  }

  // Update player name references
  const nameElements = document.querySelectorAll('.player-name');
  nameElements.forEach(el => {
    el.textContent = GameState.playerName || 'Hero';
  });

  // Update gender references
  const genderElements = document.querySelectorAll('.player-gender');
  genderElements.forEach(el => {
    el.textContent = GameState.playerGender === 'male' ? 'he' : 'she';
  });

  const genderElementsCap = document.querySelectorAll('.player-gender-cap');
  genderElementsCap.forEach(el => {
    el.textContent = GameState.playerGender === 'male' ? 'He' : 'She';
  });

  // Add fade-in animation to main content
  const container = document.querySelector('.game-container');
  if (container) {
    container.classList.add('fade-in');
  }
});
