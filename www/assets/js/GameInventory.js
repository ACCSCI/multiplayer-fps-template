import { InventorySlot } from "./Enums.js";
import { Utils } from "./Utils.js";

/**
 * Equipment model management: what the spectator/player holds in hands and
 * the models shown on the belt of other players.
 */
export class GameInventory {
    #game;
    #world;
    #hud;
    #playerSlotsVisibleModels = [
        InventorySlot.SLOT_KNIFE,
        InventorySlot.SLOT_PRIMARY,
        InventorySlot.SLOT_SECONDARY,
        InventorySlot.SLOT_BOMB,
        InventorySlot.SLOT_GRENADE_DECOY,
        InventorySlot.SLOT_GRENADE_MOLOTOV,
        InventorySlot.SLOT_GRENADE_SMOKE,
        InventorySlot.SLOT_GRENADE_FLASH,
        InventorySlot.SLOT_GRENADE_HE,
        InventorySlot.SLOT_TASER,
        InventorySlot.SLOT_KIT,
    ];

    constructor(game, world, hud) {
        this.#game = game;
        this.#world = world;
        this.#hud = hud;
    }

    equip(slotId) {
        const game = this.#game;
        if (!game.playerSpectate.data.slots[slotId]) {
            return false;
        }

        game.playerSpectate.equip(slotId);
        const item = game.playerSpectate.data.slots[slotId];
        const povItems = this.#world.getCamera().getObjectByName("pov-item");
        for (const mesh of povItems.children) {
            mesh.visible = false;
        }

        let model = povItems.getObjectByName(`item-${item.id}`);
        if (!model) {
            model = this.#world.getModelForItem(item);
            povItems.add(model);
        }
        for (const root of model.children) {
            root.visible = false;
        }
        model.getObjectByName("pov").visible = true;
        model.visible = true;

        this.#hud.equip(slotId, item.id, game.playerSpectate.data.slots);
        return true;
    }

    switchHands() {
        const povItem = this.#world.getCamera().getObjectByName("pov-item");
        povItem.scale.x *= -1;
        povItem.position.x *= -1;
    }

    updateOtherPlayersModels(player, data) {
        const playerObject = player.get3DObject();
        playerObject.rotation.y = Utils.serverHorizontalRotationToThreeRadian(data.look.horizontal);
        playerObject.getObjectByName("sight").rotation.x = Utils.serverVerticalRotationToThreeRadian(
            data.look.vertical,
        );

        const hand = playerObject.getObjectByName("hand");
        if (hand.children.length) {
            hand.children[0].rotation.y = Utils.serverVerticalRotationToThreeRadian(
                Math.max(Math.min(data.look.vertical, 50), -50),
            ); // cap hand item vertical look rotation
        }

        player.animate();
        if (player.isInventoryChanged(data)) {
            this.#otherPlayersInventoryChanged(player, data);
            player.equip(data.item.slot);
        }
    }

    #otherPlayersInventoryChanged(player, data) {
        const world = this.#world;
        const hand = player.get3DObject().getObjectByName("hand");
        const belt = player.get3DObject().getObjectByName("belt");

        if (hand.children.length === 1) {
            const lastHandItemModel = hand.children[0];
            lastHandItemModel.rotation.set(0, 0, 0);
            belt.getObjectByName(`slot-${lastHandItemModel.userData.slot}`).add(lastHandItemModel);
        } else if (hand.children.length > 1) {
            throw new Error("Too many items in hands?");
        }

        this.#playerSlotsVisibleModels.forEach((slotId) => {
            const item = data.slots[slotId];
            const beltSlot = belt.getObjectByName(`slot-${slotId}`);
            for (const model of beltSlot.children) {
                model.visible = false;
            }
            if (!item) {
                // do not have slotID filled
                return;
            }

            let itemModel = beltSlot.getObjectByName(`item-${item.id}`);
            if (!itemModel) {
                itemModel = world.getModelForItem(item);
                beltSlot.add(itemModel);
            }
            for (const root of itemModel.children) {
                root.visible = false;
            }
            itemModel.getObjectByName("item").visible = true;
            itemModel.visible = true;
        });

        const modelInHand = belt.getObjectByName(`slot-${data.item.slot}`).getObjectByName(`item-${data.item.id}`);
        hand.add(modelInHand);
        modelInHand.userData.slot = data.item.slot;
        for (const root of modelInHand.children) {
            root.visible = false;
        }
        modelInHand.getObjectByName("item").visible = true;
        modelInHand.visible = true;
    }
}
