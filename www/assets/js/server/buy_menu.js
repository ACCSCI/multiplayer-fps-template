import { BuyMenuItem, ItemType } from "./enums.js";
import { Decoy } from "./equipment/decoy.js";
import { DefuseKit } from "./equipment/defuse_kit.js";
import { Flashbang } from "./equipment/flashbang.js";
import { HighExplosive } from "./equipment/high_explosive.js";
import { Incendiary } from "./equipment/incendiary.js";
import { Kevlar } from "./equipment/kevlar.js";
import { Molotov } from "./equipment/molotov.js";
import { Smoke } from "./equipment/smoke.js";
import { PistolGlock } from "./weapon/pistol_glock.js";
import { PistolP250 } from "./weapon/pistol_p250.js";
import { PistolUsp } from "./weapon/pistol_usp.js";
import { RifleAk } from "./weapon/rifle_ak.js";
import { RifleAWP } from "./weapon/rifle_awp.js";
import { RifleM4A4 } from "./weapon/rifle_m4a4.js";

/**
 * Port of server/src/Core/BuyMenu.php
 */
export class BuyMenu {
    /** @type {Record<number, number>} PHP array<int,int> [itemId => count] */
    itemBuyCount = {};
    grenadeCount = 0;
    grenadeCountMax = 4;

    /**
     * @param {boolean} forAttackerStore
     * @param {Item[]} alreadyHaveItems
     */
    constructor(forAttackerStore, alreadyHaveItems) {
        this.forAttackerStore = forAttackerStore;
        this.reset(forAttackerStore, alreadyHaveItems);
    }

    /**
     * @param {boolean} forAttackerStore
     * @param {Item[]} alreadyHaveItems
     */
    reset(forAttackerStore, alreadyHaveItems) {
        this.grenadeCount = 0;
        this.itemBuyCount = {};
        this.forAttackerStore = forAttackerStore;

        // PHP foreach ($alreadyHaveItems as $item) - also handles the
        // slot-keyed items map passed by Inventory::reset()
        for (const item of Object.values(alreadyHaveItems)) {
            if (item.getType() === ItemType.TYPE_GRENADE) {
                this.grenadeCount += item.getQuantity();
            }

            if (!(item.getId() in this.itemBuyCount)) {
                this.itemBuyCount[item.getId()] = 0;
            }
            this.itemBuyCount[item.getId()]++;
        }
    }

    /**
     * PHP match ($buyCandidate) — returns a fresh item or null (side-restricted).
     * @returns {?Item}
     */
    getItem(buyCandidate) {
        switch (buyCandidate) {
            case BuyMenuItem.RIFLE_AK:
                return this.forAttackerStore ? new RifleAk() : null;
            case BuyMenuItem.RIFLE_M4A4:
                return !this.forAttackerStore ? new RifleM4A4() : null;
            case BuyMenuItem.RIFLE_AWP:
                return new RifleAWP();
            case BuyMenuItem.PISTOL_USP:
                return !this.forAttackerStore ? new PistolUsp() : null;
            case BuyMenuItem.PISTOL_GLOCK:
                return this.forAttackerStore ? new PistolGlock() : null;
            case BuyMenuItem.PISTOL_P250:
                return new PistolP250();
            case BuyMenuItem.GRENADE_FLASH:
                return new Flashbang();
            case BuyMenuItem.GRENADE_SMOKE:
                return new Smoke();
            case BuyMenuItem.GRENADE_DECOY:
                return new Decoy();
            case BuyMenuItem.GRENADE_HE:
                return new HighExplosive();
            case BuyMenuItem.GRENADE_MOLOTOV:
                return this.forAttackerStore ? new Molotov() : null;
            case BuyMenuItem.GRENADE_INCENDIARY:
                return !this.forAttackerStore ? new Incendiary() : null;
            case BuyMenuItem.DEFUSE_KIT:
                return !this.forAttackerStore ? new DefuseKit() : null;
            case BuyMenuItem.KEVLAR_BODY_AND_HEAD:
                return new Kevlar(true);
            case BuyMenuItem.KEVLAR_BODY:
                return new Kevlar(false);
            default:
                return null;
        }
    }

    /** @returns {?Item} */
    get(buyCandidate) {
        const item = this.getItem(buyCandidate);
        if (!item) {
            return null;
        }

        if (!(item.getId() in this.itemBuyCount)) {
            this.itemBuyCount[item.getId()] = 0;
        }
        if (this.itemBuyCount[item.getId()] + 1 > item.getMaxBuyCount()) {
            return null;
        }
        if (item.getType() === ItemType.TYPE_GRENADE && this.grenadeCount + 1 > this.grenadeCountMax) {
            return null;
        }

        return item;
    }

    confirmPurchase(item) {
        this.itemBuyCount[item.getId()]++;
        if (item.getType() === ItemType.TYPE_GRENADE) {
            this.grenadeCount++;
        }
    }
}
