import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import Stats from "../threejs/Stats.js";
import { Control } from "./Control.js";
import { Game } from "./Game.js";
import { HUD } from "./Hud.js";
import { PlayerAction } from "./PlayerAction.js";
import { Setting } from "./Setting.js";
import { SimHost } from "./sim/SimHost.js";
import { NetworkConnector } from "./vibehub/NetworkConnector.js";
import { World } from "./World.js";

/**
 * VibeHub 联机启动(房主跑 SimHost worker,远程玩家直连 room):
 *   {room, vibeClient, onExit}  onExit: 对局结束/离开回调(回大厅)
 */
export async function launchVibeHubGame(canvasParent, elementHud, settingString, options) {
    const { room, vibeClient, onExit } = options;
    const map = "default";

    const world = new World();
    const hud = new HUD();
    const stats = new Stats();
    const game = new Game(world, hud, stats);
    const action = new PlayerAction(game, hud);
    const control = new Control(game, action);
    hud.injectDependency(game);

    const setting = new Setting(settingString);
    const canvas = await world.init(map, setting);
    const pointerLock = new PointerLockControls(world.getCamera(), canvasParent);
    pointerLock.pointerSpeed = setting.getSensitivity();

    hud.createHud(elementHud, map, setting);
    control.init(canvasParent, pointerLock, setting);
    game.setDependency(pointerLock, setting, action);
    canvas.addEventListener("click", () => game.requestPointerLock());
    canvasParent.appendChild(canvas);
    if (setting.shouldShowFps()) {
        stats.dom.style.position = "inherit";
        elementHud.querySelector("#fps-stats").appendChild(stats.dom);
    }

    const connector = new NetworkConnector(game, {
        onGameOver: (result) => {
            console.log(`[NetworkConnector] game over: ${JSON.stringify(result)}`);
        },
    });
    let source;
    if (room.isHost) {
        const simHost = new SimHost(room);
        const playerList = [
            { peerId: null, name: vibeClient.getUser()?.name ?? "Host" },
            ...room.peers().map((peer) => ({ peerId: peer.id, name: peer.id.slice(0, 8) })),
        ];
        await simHost.start(playerList);
        source = simHost;
    } else {
        source = createRoomSource(room);
    }

    game.onEnd((msg) => {
        console.log(`Game ended: ${msg}`);
        connector.close();
        if (onExit) {
            onExit(msg);
        }
    });
    game.onReady(() => {
        if (!setting.shouldMatchServerFps()) {
            render();
        }
    });

    setting.addUpdateCallback("sensitivity", (newValue) => (pointerLock.pointerSpeed = parseFloat(newValue)));
    setting.addUpdateCallback("volume", (newValue) => (world.volume = parseFloat(newValue)));

    connector.connect(source, control, vibeClient);
    window.addEventListener("beforeunload", () => connector.close());

    function render() {
        connector.interpolate(performance.now());
        world.render();
        requestAnimationFrame(render);
    }
}

/** 远程玩家数据源:room <-> 游戏 */
function createRoomSource(room) {
    return {
        sendCommand: (commandString) => room.send(commandString),
        setFeed(callback) {
            room.onMessage((msg) => {
                let parsed = msg;
                if (typeof msg === "string") {
                    try {
                        parsed = JSON.parse(msg);
                    } catch {
                        return;
                    }
                }
                if (parsed.t === "start") {
                    callback({ t: "start", d: parsed.d });
                } else if (parsed.t === "s") {
                    callback({ t: "snap", players: parsed.p });
                } else if (parsed.t === "e") {
                    callback({ t: "ev", e: parsed.e });
                }
            });
        },
        close() {},
    };
}
