window.globalSettings = new GlobalSettings();
let api;
let notrightId;
let state = false;

// gets how many times the page reloaded
// it fixes the fake unsafe js
let refreshCounter;
chrome.storage.local.get("refreshCount", function(result) {
	refreshCounter = result["refreshCount"];
});


$(document).ready(function () {
	api = new Api();

	let preloader = $("#preloader").attr("wmode", "opaque");
	$("#preloader").remove();

	let check = SafetyChecker.check();

	// Try to fix false positive on JS Change
	// it refreshes the page 3 times
	if(refreshCounter > 0 && !check){
		api.changeRefreshCount(refreshCounter-1);
		window.location.reload();
	}


	if (check !== true) {
		let warning = jQuery("<div>");
		warning.css({
			top: 0,
			left: 0,
			position: "absolute",
			width: "100%",
			height: "100%",
			backgroundColor: "gray",
			textAlign: "center"
		});

		jQuery("<h1>").text("The tool detected changes in the game.").appendTo(warning);
		jQuery("<h2>").text("Loading stopped! Your account has to stay safe.").appendTo(warning);
		jQuery("<h3>").text("Reason: UNSAFE JS").appendTo(warning);

		warning.appendTo("body");
		throw new Error("Safety tests failed!");
	}
    preloader.appendTo($("#container"));

    window.settings = new Settings();
    window.initialized = false;
    window.reviveCount = 0;
    window.count = 0;
    window.movementDone = true;
    window.statusPlayBot = false;
    window.saved = false;
    window.loaded = false;
	window.fleeingFromEnemy = false;
	window.debug = false;
	window.enemy = null;
    window.tickTime = window.globalSettings.timerTick;
    let hm = new HandlersManager(api);

	hm.registerCommand(AssetCreatedHandler.ID, new AssetCreatedHandler());
    hm.registerCommand(BoxInitHandler.ID, new BoxInitHandler());
    hm.registerCommand(ResourceInitHandler.ID, new ResourceInitHandler());
    hm.registerCommand(ShipAttackHandler.ID, new ShipAttackHandler());
    hm.registerCommand(ShipCreateHandler.ID, new ShipCreateHandler());
    hm.registerCommand(ShipMoveHandler.ID, new ShipMoveHandler());
    hm.registerCommand(AssetRemovedHandler.ID, new AssetRemovedHandler());
    hm.registerCommand(HeroInitHandler.ID, new HeroInitHandler(init));
    hm.registerCommand(ShipDestroyedHandler.ID, new ShipDestroyedHandler());
    hm.registerCommand(ShipRemovedHandler.ID, new ShipRemovedHandler());
    hm.registerCommand(GateInitHandler.ID, new GateInitHandler());
    hm.registerCommand(ShipSelectedHandler.ID, new ShipSelectedHandler());
    hm.registerCommand(MessagesHandler.ID, new MessagesHandler());
    hm.registerCommand(HeroDiedHandler.ID, new HeroDiedHandler());
    hm.registerCommand(HeroUpdateHitpointsHandler.ID, new HeroUpdateHitpointsHandler());
    hm.registerCommand(HeroUpdateShieldHandler.ID, new HeroUpdateShieldHandler());
	hm.registerCommand(QuickSlotHandler.ID, new QuickSlotHandler());
	hm.registerCommand(HeroPetUpdateHandler.ID, new HeroPetUpdateHandler());
	hm.registerCommand(HeroAttackHandler.ID, new HeroAttackHandler());



    hm.registerEvent("updateHeroPos", new HeroPositionUpdateEventHandler());
    hm.registerEvent("movementDone", new MovementDoneEventHandler());
    hm.registerEvent("isDisconnected", new HeroDisconnectedEventHandler());
    hm.registerEvent("isConnected", new HeroConnectedEventHandler());

    hm.listen();
});

function init() {
	if (window.initialized)
		return;

	window.attackWindow = new AttackWindow();
	window.attackWindow.createWindow();

	window.autolockWindow = new AutolockWindow();
	window.autolockWindow.createWindow();

	window.collectionWindow = new CollectionWindow();
	window.collectionWindow.createWindow();

	window.generalSettingsWindow = new GeneralSettingsWindow();
	window.generalSettingsWindow.createWindow();

	window.GGSettingsWindow = new GGSettingsWindow();
	window.GGSettingsWindow.createWindow();

	window.minimap = new Minimap(api);
	window.minimap.createWindow();

	window.npcSettingsWindow = new NpcSettingsWindow();
	window.npcSettingsWindow.createWindow();

	window.shipSettings = new ShipSettings();
	window.shipSettings.createWindow();

	window.statisticWindow = new StatisticWindow();
	window.statisticWindow.createWindow();

	api.startTime = $.now();
	window.setInterval(logic, window.tickTime);
	
	Injector.injectScriptFromResource("res/injectables/HeroPositionUpdater.js");

	// set refreshcount to 3 if page loaded until here
	api.changeRefreshCount(3);

	$(document).keyup(function (e) {
		let key = e.key;

		if (key == "x" && (!window.settings.settings.autoAttackNpcs || (!api.lastAutoLock || $.now() - api.lastAutoLock > 1000)) ||
		key == "z" && (!window.settings.settings.autoAttack || (!api.lastAutoLock || $.now() - api.lastAutoLock > 1000))) {
			let maxDist = 1000;
			let finDist = 1000000;
			let finalShip;

			for (let property in api.ships) {
				let ship = api.ships[property];
				let dist = ship.distanceTo(window.hero.position);

				if (dist < maxDist && dist < finDist && ((ship.isNpc && window.settings.settings.lockNpc && key == "x" &&
				 (!window.settings.settings.excludeNpcs || window.settings.getNpc(ship.name))) ||
				  (!ship.isNpc && ship.isEnemy && window.settings.settings.lockPlayers && key == "z"))) {
					finalShip = ship;
					finDist = dist;
				}
			}
			if (finalShip != null) {
				api.lockShip(finalShip);
				api.lastAutoLock = $.now();
				api.autoLocked = true;
			}
		}
	});

	window.settings.settings.pause = true;
	$(document).on('click', '.cnt_minimize_window', () => {
		if (window.statusMiniWindow) {
			window.mainWindow.slideUp();
		} else {
			window.mainWindow.slideDown();
		}
		window.statusMiniWindow = !window.statusMiniWindow;
	});

	let cntBtnPlay = $('.cnt_btn_play .btn_play');
	cntBtnPlay.on('click', (e) => {
		if (window.statusPlayBot) {
			cntBtnPlay.html("Play");
			cntBtnPlay.removeClass('in_stop').addClass('in_play');
			api.resetTarget("all");
			window.fleeingFromEnemy = false;
			window.settings.settings.pause = true;
		} else {
			cntBtnPlay.html("Stop");
			cntBtnPlay.removeClass('in_play').addClass('in_stop');
			window.settings.settings.pause = false;
		}
		window.statusPlayBot = !window.statusPlayBot;
	});
	let saveBtn = $('.saveButton .btn_save');
	saveBtn.on('click', (e) => {
		chrome.storage.local.set(window.settings.settings);
	});
	let clearBtn = $('.clearButton .btn_clear');
	clearBtn.on('click', (e) => {
		chrome.storage.local.set(window.settings.defaults);
	});
	// LUL
	chrome.storage.local.get({"refreshed" :false}, function(v){
		if(v && window.settings.settings.enableRefresh){cntBtnPlay.click();}
	});
}


function logic() {
	let circleBox = null;

	if (api.isDisconnected) {
		if (window.fleeingFromEnemy) 
			window.fleeFromEnemy = false;
		if (api.disconnectTime && $.now() - api.disconnectTime > 5000 && (!api.reconnectTime || (api.reconnectTime && $.now() - api.reconnectTime > 15000)) && window.reviveCount < window.settings.settings.reviveLimit) 
			api.reconnect();
		return;
	}

	window.minimap.draw();

	if (api.heroDied || window.settings.settings.pause) {
		api.resetTarget("all");
		return;
	}

	if(window.settings.settings.fleeFromEnemy && window.fleeFromEnemy && window.enemy){
		let gate = api.findNearestGateForRunAway(window.enemy);
		if(gate.gate){
			let dist = window.hero.distanceTo(gate.gate.position);
			if(dist > 200){
				api.flyingMode();
				if (window.settings.settings.useAbility && window.hero.skillName == "spectrum") {
					api.useAbility();
				}
				window.fleeingFromEnemy = true;
				let x = gate.gate.position.x + MathUtils.random(-100, 100);
				let y = gate.gate.position.y + MathUtils.random(-100, 100);
				api.resetTarget("all");
				api.move(x, y);
				return;
			} else if(window.settings.settings.jumpFromEnemy){
				// LMAO
				setTimeout(function(gate) { 
					if (api.jumpAndGoBack(gate.gate.gateId)) {
					api.jumped = true;
					window.movementDone = false;
					window.fleeingFromEnemy = false;
				}}, 1000, gate);
				return;
				
			}
		}else{
			window.fleeFromEnemy = false;
		}
	}

	if ((api.startTime && $.now() - api.startTime >= window.settings.settings.refreshTime * 60000)
	 && window.settings.settings.enableRefresh && !window.settings.settings.ggbot) {
		if ((api.Disconected && !state) || window.settings.settings.palladium) {
			chrome.storage.local.set({"refreshed" :true});
			window.location.reload();
			state = true;
		} else {
			let gate = api.findNearestGate();
			if (gate.gate) {
				let x = gate.gate.position.x;
				let y = gate.gate.position.y;
				if (window.hero.position.distanceTo(gate.gate.position) < 200 && !state) {
					window.location.reload();
					chrome.storage.local.set({"refreshed" :true});
					state = true;
				}
				api.resetTarget("all");
				api.move(x, y);
				window.movementDone = false;
				return;
			}
		}
	}

	if(window.settings.settings.useAbility && window.hero.skillName == "solace"){
		if(MathUtils.percentFrom(window.hero.hp, window.hero.maxHp) < 70) {
			if(api.useAbility())
				return;
		}
	}

	if(api.isRepairing){
		if (window.hero.hp !== window.hero.maxHp && !window.settings.settings.ggbot && !window.settings.settings.palladium) {
			return;
		}else if (window.hero.hp === window.hero.maxHp) {
			api.isRepairing = false;
			if (window.settings.settings.autoChangeConfig){
				if (window.settings.settings.attackConfig != window.hero.shipconfig) {
					api.changeConfig();
				}
			}
		}
	}

	if ($.now() - api.resetBlackListTime > api.blackListTimeOut) {
		api._blackListedBoxes = [];
		api.resetBlackListTime = $.now();
	}

	/*GG BOT for Alpha, Beta and Gamma Gates*/
	if(window.settings.settings.ggbot){
		window.settings.settings.moveRandomly = true;
		window.settings.settings.killNpcs = true;
		window.settings.settings.circleNpc = true;
		window.settings.settings.resetTargetWhenHpBelow25Percent = true;
		window.settings.settings.dontCircleWhenHpBelow25Percent = false;
		if (window.hero.mapId == 73) {
			api.ggZetaFix();
		} else if (window.hero.mapId == 55) {
			api.ggDeltaFix();
		}
		if (api.targetBoxHash == null) {
			api.jumpInGG(2, window.settings.settings.alpha);
			api.jumpInGG(3, window.settings.settings.beta);
			api.jumpInGG(4, window.settings.settings.gamma);
			api.jumpInGG(5, window.settings.settings.delta);
			api.jumpInGG(53, window.settings.settings.epsilon);
			api.jumpInGG(54, window.settings.settings.zeta);
			api.jumpInGG(70, window.settings.settings.kappa);
			api.jumpInGG(71, window.settings.settings.lambda);
			api.jumpInGG(72, window.settings.settings.kronos);
			api.jumpInGG(74, window.settings.settings.hades);
			api.jumpInGG(82, window.settings.settings.kuiper);
		}
	}

	if (window.settings.settings.fleeFromEnemy && !window.settings.settings.palladium) {
		let enemyResult = api.checkForEnemy();
		if (enemyResult.run) {
			window.enemy = enemyResult.enemy;
			window.fleeFromEnemy = true;
			return;
		}else{
			window.enemy = null;
		}
	}

	if (MathUtils.percentFrom(window.hero.hp, window.hero.maxHp) < window.settings.settings.repairWhenHpIsLowerThanPercent || api.isRepairing) {
		if (window.settings.settings.ggbot) {
			api.resetTarget("all");
			let npcCount = api.ggCountNpcAround(1000);
			if (npcCount > 0) {
				let ship = api.findNearestShip();
				ship.ship.update();
				let f = Math.atan2(window.hero.position.x - ship.ship.position.x, window.hero.position.y - ship.ship.position.y) + 0.5;
				let s = Math.PI / 180;
				f += s;
				let x = 10890 + 4000 * Math.sin(f);
				let y = 6750 + 4000 * Math.cos(f);
				//To avoid entering radiation.
				if (x > 20800 && x < 500 && y > 12900 && y < 500) {
					x = MathUtils.random(500, 20800);
					y = MathUtils.random(500, 12900);
				} else {
					api.move(x, y);
				}
				api.isRepairing = true;
				return;
			} else {
				return;
			}
		} else if(window.settings.settings.palladium){
			// TODO	
		} else {
			let gate = api.findNearestGate();
			if (gate.gate) {
				api.resetTarget("all");
				let x = gate.gate.position.x + MathUtils.random(-100, 100);
				let y = gate.gate.position.y + MathUtils.random(-100, 100);
				api.move(x, y);
				window.movementDone = false;
				api.flyingMode();
				api.isRepairing = true;
				return;
			}
		}
	}

	if (!window.settings.palladium && !window.settings.ggbot && window.settings.settings.workmap != 0 &&  window.hero.mapId != window.settings.settings.workmap) {
		api.goToMap(window.settings.settings.workmap);
		return;
	} else {
		api.rute = null;
	}
	

	if (window.X1Map || (window.settings.settings.palladium && window.hero.mapId != 93)) {
		return;
	}

	if (api.targetBoxHash == null && api.targetShip == null) {
		let box = api.findNearestBox();
		let ship = api.findNearestShip();

		if ((ship.distance > 1000 || !ship.ship) && (box.box)) {
			if (!(MathUtils.percentFrom(window.hero.shd, window.hero.maxShd) < 90) && window.settings.settings.autoChangeConfig && window.settings.settings.palladium) {
				api.flyingMode();
			}
			api.collectBox(box.box);
			api.targetBoxHash = box.box.hash;
			return;
		} else if (ship.ship && ship.distance < 1000 && window.settings.settings.killNpcs) {
			api.lockShip(ship.ship);
			api.triedToLock = true;
			api.targetShip = ship.ship;
			return;
		} else if (ship.ship && window.settings.settings.killNpcs) {
			ship.ship.update();
			api.move(ship.ship.position.x - MathUtils.random(-50, 50), ship.ship.position.y - MathUtils.random(-50, 50));
			api.targetShip = ship.ship;
			return;
		}
	}

	// Failsafe in case attack starts too early
	if (api.lockedShip && ($.now() - api.lockTime > 2500 && $.now() - api.lockTime < 6000) && $.now() - api.lastAttack > 2000 && api.lockedShip.distanceTo(hero.position) < 1200) {
		api.startLaserAttack();
		api.lastAttack = $.now();
		return;
	}

	if (api.targetShip && window.settings.settings.killNpcs) {
		if (!api.triedToLock && (api.lockedShip == null || api.lockedShip.id != api.targetShip.id)) {
			api.targetShip.update();
			let dist = api.targetShip.distanceTo(window.hero.position);
			if (dist < 600) {
				api.lockShip(api.targetShip);
				api.triedToLock = true;
				return;
			}
		}

		/*if (!api.attacking && api.lockedShip && api.lockedShip.shd + 1 != api.lockedShip.maxShd && window.settings.settings.avoidAttackedNpcs) {
			notrightId = api.lockedShip.id;
			api.resetTarget("enemy");
			return;
		}*/

		/*if (!api.attacking && api.lockedShip && api.lockedShip.shd + 1 == api.lockedShip.maxShd && window.settings.settings.avoidAttackedNpcs || !api.attacking && api.lockedShip && !window.settings.settings.avoidAttackedNpcs) {
			api.startLaserAttack();
			api.lastAttack = $.now();
			api.attacking = true;
			return;
		}*/
	}

	if (api.targetBoxHash && $.now() - api.collectTime > 7000) {
		let box = api.boxes[api.targetBoxHash];
		if (box && box.distanceTo(window.hero.position) > 1000) {
			api.collectTime = $.now();
		} else {
			delete api.boxes[api.targetBoxHash];
			api.blackListHash(api.targetBoxHash);
			api.resetTarget("box");
		}
	}

	if ((api.targetShip && $.now() - api.lockTime > 6000 && !api.attacking) || !api.attacking && ($.now() - api.lastAttack > 10000)){
		api.resetTarget("enemy");
	}

	let x;
	let y;

	if (window.settings.settings.palladium)
		api.battlerayFix();

	/*Dodge the CBS*/
	if (window.settings.settings.dodgeTheCbs && api.battlestation != null) {
		if (api.battlestation.isEnemy) {
			let result = api.checkForCBS();
			if (result.walkAway) {
				if (api.targetBoxHash) {
					let box = api.boxes[api.targetBoxHash];
					if (box && box.distanceTo(result.cbsPos) < 1800) {
						delete api.boxes[api.targetBoxHash];
						api.blackListHash(api.targetBoxHash);
						api.resetTarget("box");
					}
				}
				let f = Math.atan2(window.hero.position.x - result.cbsPos.x, window.hero.position.y - result.cbsPos.y) + 0.5;
				let s = Math.PI / 180;
				f += s;
				x = result.cbsPos.x + 1800 * Math.sin(f);
				y = result.cbsPos.y + 1800 * Math.cos(f);
				api.move(x, y);
				api.resetTarget("all");
				window.movementDone = false;
				return;
			}
		}
	}

	if(api.targetBoxHash == null && api.targetShip == null && window.movementDone && window.settings.settings.moveRandomly){
		if ( !window.settings.settings.palladium && !window.bigMap) {
			x = MathUtils.random(200, 20800);
			y = MathUtils.random(200, 12900);
		} else if (!window.settings.settings.palladium && window.bigMap) {
			x = MathUtils.random(500, 41500);
			y = MathUtils.random(500, 25700);
		} else if (window.settings.settings.palladium) {
			// Palladium fog.
			x = MathUtils.random(13000, 30400);
			y = MathUtils.random(19000, 25500);
		}
	}


	if (api.targetShip && window.settings.settings.killNpcs && api.targetBoxHash == null) {
		api.targetShip.update();
		let dist = api.targetShip.distanceTo(window.hero.position);

		if(api.attacking){
			api.combatMode();
			if(window.settings.settings.useAbility && window.hero.skillName && dist <450){
				// Make hp and shield heren a user option.
				if((window.hero.skillname == "cyborg" && api.targetShip.hp > window.globalSettings.cyborgHp)||
					(window.hero.skillName == "venom" && api.targetShip.hp > window.globalSettings.venomHp))
				{
					api.useAbility();
				} else if(window.hero.skillName == "diminisher" && api.targetShip.shd > window.globalSettings.diminisherShd){ // this one too
					api.useAbility();
				} else if(window.hero.skillname == "sentinel"){
					api.useAbility();
				}
			}
		}
		if (window.settings.settings.ggbot && api.targetShip.position.x == 20999 && api.targetShip.position.y == 13499) {
			//GG bottom right corner
			x = 20495;
			y = 13363;
		} else if (window.settings.settings.ggbot && api.targetShip.position.x == 0 && api.targetShip.position.y == 0) {
			//GG top left corner
			x = 450;
			y = 302;
		} else if ((dist > 600 && (api.lockedShip == null || api.lockedShip.id != api.targetShip.id) && $.now() - api.lastMovement > 1000)) {
			x = api.targetShip.position.x - MathUtils.random(-50, 50);
			y = api.targetShip.position.y - MathUtils.random(-50, 50);
			api.lastMovement = $.now();
		} else if (api.lockedShip && window.settings.settings.dontCircleWhenHpBelow25Percent && api.lockedShip.percentOfHp < 25 && api.lockedShip.id == api.targetShip.id ) {
			if (dist > 450) {
				x = api.targetShip.position.x + MathUtils.random(-30, 30);
				y = api.targetShip.position.y + MathUtils.random(-30, 30);
			}
		} else if (window.settings.settings.ggbot && window.settings.settings.resetTargetWhenHpBelow25Percent && api.lockedShip && api.lockedShip.percentOfHp < 25 && api.lockedShip.id == api.targetShip.id ) {
			api.resetTarget("enemy");
		} else if (dist > 300 && api.lockedShip && api.lockedShip.id == api.targetShip.id & !window.settings.settings.circleNpc) {
			x = api.targetShip.position.x + MathUtils.random(-200, 200);
			y = api.targetShip.position.y + MathUtils.random(-200, 200);
		} else if (api.lockedShip && api.lockedShip.id == api.targetShip.id) {
			if (window.settings.settings.circleNpc) {
				let enemy = api.targetShip.position;
				let f = Math.atan2(window.hero.position.x - enemy.x, window.hero.position.y - enemy.y) + 0.5;
				let s = Math.PI / 180;
				f += s;
				x = enemy.x + window.settings.settings.npcCircleRadius * Math.sin(f);
				y = enemy.y + window.settings.settings.npcCircleRadius * Math.cos(f);

				let nearestBox = api.findNearestBox();
				if (nearestBox && nearestBox.box && nearestBox.distance < 300) {
					circleBox = nearestBox;
				}
			}
		} else {
			api.resetTarget("enemy");
		}
	}

	if (x && y) {
		if (circleBox) {
			api.collectBox(circleBox.box);
			circleBox = null;
		}else{
			api.move(x, y);
		}
		window.movementDone = false;
	}
	window.dispatchEvent(new CustomEvent("logicEnd"));
}

