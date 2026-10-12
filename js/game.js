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
    'attack_chase': 'attack_chase.html',
    'attack_prepare': 'attack_prepare.html',
    'attack_help': 'attack_help.html',

    // From attack_chase page
    'chase_accept': 'gameover.html?reason=reckless',
    'chase_refuse': 'gameover.html?reason=reckless',

    // From attack_prepare page
    'prepare_track_ground': 'forest.html',
    'prepare_track_sky': 'forest.html',
    'prepare_track_magic': 'forest.html',

    // From attack_help page
    'help_accept': 'gameover.html?reason=delayed_help',
    'help_reject': 'forest.html',

    // From forest page
    'forest_cave': 'forest_cave.html',
    'forest_mountain': 'forest_mountain.html',
    'forest_river': 'forest_river.html',

    // From forest_cave page
    'cave_fight': 'cave_fight.html',
    'cave_run': 'cave_run.html',
    'cave_hide': 'cave_hide.html',

    // From cave_fight page
    'caveFight_trade': 'village.html?status=injured',
    'caveFight_rest': 'village.html?status=injured',
    'caveFight_rush': 'mountain_hidden.html',

    // From cave_run page
    'caveRun_climb': 'fortress_secret.html',
    'caveRun_sneak': 'fortress_secret.html',
    'caveRun_signal': 'superlord_dragon.html',

    // From cave_hide page
    'caveHide_village': 'village.html?status=safe',
    'caveHide_fortress': 'fortress_secret.html',
    'caveHide_dragon': 'superlord_dragon.html',

    // From forest_mountain page
    'mountainPass_fight': 'mountainPass_fight.html',
    'mountainPass_sneak': 'mountainPass_sneak.html',
    'mountainPass_ambush': 'mountainPass_ambush.html',

    // From mountainPass_fight page
    'mountainPassFight_antidote': 'village.html?status=injured',
    'mountainPassFight_camp': 'village.html?status=injured',
    'mountainPassFight_scavenge': 'village.html?status=injured',

    // From mountainPass_sneak page
    'mountainPassSneak_stone': 'mountain_hidden.html',
    'mountainPassSneak_continue': 'mountain.html',
    'mountainPassSneak_mark': 'mountain.html',

    // From mountainPass_ambush page
    'mountainPassAmbush_hide': 'forest.html',
    'mountainPassAmbush_signal': 'superlord_dragon.html',
    'mountainPassAmbush_attack': 'gameover.html?reason=attack',

    // From forest_river page
    'river_continue': 'river_continue.html',
    'river_boat': 'river_tower.html',
    'river_swim': 'gameover.html?reason=delayed_river',

    // From river_continue page
    'riverContinue_boat': 'river_tower.html',
    'riverContinue_shore': 'mountain.html',
    'riverContinue_tower': 'river_tower.html',

    // From river_tower page
    'riverTower_flee': 'mountain_hidden.html',
    'riverTower_fight': 'gameover.html?reason=attack',
    'riverTower_dive': 'superlord_dragon.html',

    // From goblins page
    'goblins_fight': 'goblins_fight.html',
    'goblins_sneak': 'goblins_sneak.html',
    'goblins_talk': 'goblins_talk.html',

    // From goblins_fight page
    'goblinFight_push': 'village.html?status=injured',
    'goblinFight_rest': 'village.html?status=injured',
    'goblinFight_search': 'village.html?status=injured',

    // From goblins_sneak page
    'goblinSneak_trade': 'village_trade.html',
    'goblinSneak_steal': 'village_steal.html',
    'goblinSneak_info': 'village_trade.html',

    // From goblins_talk page
    'goblinTalk_curse': 'gameover.html?reason=talk',
    'goblinTalk_pray': 'gameover.html?reason=talk',
    'goblinTalk_spite': 'gameover.html?reason=talk',

    // From village page
    'village_steal': 'village_steal.html',
    'village_trade': 'village_trade.html',
    'village_sneak': 'village_sneak.html',

    // From village_steal page
    'villageSteal_escape': 'gameover.html?reason=steal',
    'villageSteal_wait': 'fortress.html',
    'villageSteal_message': 'gameover.html?reason=steal',

    // From village_trade page
    'villageTrade_main': 'mountain_main.html',
    'villageTrade_hidden': 'mountain_hidden.html',
    'villageTrade_bridge': 'mountain_bridge.html',

    // From village_sneak page
    'villageSneak_treat': 'mountain_hidden.html',
    'villageSneak_push': 'gameover.html?reason=delayed_sneak',
    'villageSneak_hide': 'mountain.html',

    // From mountain page
    'mountain_main': 'mountain_main.html',
    'mountain_hidden': 'mountain_hidden.html',
    'mountain_bridge': 'mountain_bridge.html',

    // From mountain_main page
    'mountainMain_escape': 'fortress.html',
    'mountainMain_resist': 'gameover.html?reason=traps',
    'mountainMain_observe': 'fortress_secret.html',

    // From mountain_hidden page
    'mountainHidden_dungeons': 'fortress_secret.html',
    'mountainHidden_armory': 'fortress_secret.html',
    'mountainHidden_throne': 'superlord.html',

    // From mountain_bridge page
    'mountainBridge_front': 'fortress_front.html',
    'mountainBridge_search': 'fortress_secret.html',
    'mountainBridge_climb': 'fortress_front.html',

    // From fortress page
    'fortress_front': 'fortress_front.html',
    'fortress_secret': 'fortress_secret.html',
    'fortress_distraction': 'fortress_distraction.html',

    // From fortress_front page
    'fortressFront_curse': 'gameover.html?reason=frontdoor',
    'fortressFront_spouse': 'gameover.html?reason=frontdoor',
    'fortressFront_grenade': 'gameover.html?reason=frontdoor',

    // From fortress_secret page
    'fortressSecret_up': 'superlord.html',
    'fortressSecret_sneak': 'superlord.html',
    'fortressSecret_free': 'superlord_dragon.html',

    // From fortress_distraction page
    'fortressDistract_fight': 'superlord.html',
    'fortressDistract_surrender': 'superlord.html',
    'fortressDistract_down': 'gameover.html?reason=delayed_distraction',

    // From superlord page
    'superlord_attack': 'superlord_attack.html',
    'superlord_free': 'superlord_free.html',
    'superlord_duel': 'superlord_duel.html',

    // From superlord_attack page
    'superlordAttack_regret': 'gameover.html?reason=attack',
    'superlordAttack_love': 'gameover.html?reason=attack',
    'superlordAttack_defiance': 'gameover.html?reason=attack',

    // From superlord_free page
    'superlordFree_aggressive': 'bossfight.html',
    'superlordFree_defensive': 'bossfight.html',
    'superlordFree_balanced': 'bossfight.html',

    // From superlord_duel page
    'superlordDuel_perfect': 'bossfight_honor.html',
    'superlordDuel_mind': 'bossfight_honor.html',
    'superlordDuel_heart': 'bossfight_honor.html',

    // From superlord_dragon page
    'dragonChoice_kill': 'dragon_kill.html',
    'dragonChoice_talk': 'dragon_talk.html',
    'dragonChoice_amulet': 'dragon_amulet.html',

    // From dragon_kill page
    'dragonKill_mourn': 'gameover.html?reason=kill',
    'dragonKill_carry': 'gameover.html?reason=kill',
    'dragonKill_revenge': 'gameover.html?reason=kill',

    // From dragon_talk page
    'dragonTalk_accept': 'gameover.html?reason=reason',
    'dragonTalk_reach': 'gameover.html?reason=reason',
    'dragonTalk_spite': 'gameover.html?reason=reason',

    // From dragon_amulet page
    'dragonAmulet_escape': 'victory.html',
    'dragonAmulet_finish': 'victory.html',
    'dragonAmulet_ride': 'victory.html',

    // From bossfight_honor page
    'bossfightHonor_win': 'victory.html',
    'bossfightHonor_lose': 'gameover.html?reason=tetrisLost',
    'bossfightHonor_draw': 'superlord_dragon.html'
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
