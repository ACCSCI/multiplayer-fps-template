/**
 * VibeHub 大厅:创建房间 / 房间列表 / 快速匹配 / 密码房 / 队伍等待。
 * 对局开始后由 onStart 回调交给游戏启动流程(SimHost + NetworkConnector)。
 */
const DEFAULT_MAX_PLAYERS = 10;
const DEFAULT_MODE = "competitive";
const ROOM_JOIN_OPTIONS = {
    topology: "host",
    sync: { bufferSize: 30, interpDelayMs: 80 },
};

export class Lobby {
    #vibeClient;
    #container;
    #room = null;
    #onStart;
    #onLeave;
    #mode;

    constructor(vibeClient, container, callbacks = {}) {
        this.#vibeClient = vibeClient;
        this.#container = container;
        this.#onStart = callbacks.onStart ?? null;
        this.#onLeave = callbacks.onLeave ?? null;
    }

    show(mode = DEFAULT_MODE) {
        this.#mode = mode;
        this.#container.classList.remove("hidden");
        this.#renderHome();
        this.refreshRooms();
    }

    hide() {
        this.#container.classList.add("hidden");
    }

    isOpen() {
        return !this.#container.classList.contains("hidden");
    }

    getRoom() {
        return this.#room;
    }

    #renderHome() {
        this.#container.innerHTML = `
            <div class="lobby-title">VibeHub Lobby</div>
            <button type="button" data-action="create">Create room</button>
            <button type="button" data-action="quick">Quick match</button>
            <div class="lobby-rooms" data-rooms></div>
            <div class="lobby-hint" data-hint>Rooms refresh on join/leave</div>
        `;
        this.#container.querySelector('[data-action="create"]').addEventListener("click", () => this.createRoom());
        this.#container.querySelector('[data-action="quick"]').addEventListener("click", () => this.quickJoin());
        this.#container.querySelector("[data-rooms]").addEventListener("click", (event) => {
            const button = event.target.closest("[data-join]");
            if (button) {
                this.joinRoom(button.dataset.join);
            }
        });
    }

    /** 房间列表渲染(登录玩家可看可进) */
    async refreshRooms() {
        const roomsElement = this.#container.querySelector("[data-rooms]");
        if (!roomsElement || !this.isOpen()) {
            return;
        }
        const roomsApi = this.#vibeClient.getRoomApi();
        if (!roomsApi) {
            roomsElement.innerHTML = '<div class="room-row">VibeHub not ready</div>';
            return;
        }
        let rooms;
        try {
            rooms = await roomsApi.list();
        } catch (error) {
            console.warn(`[Lobby] rooms list failed: ${error}`);
            roomsElement.innerHTML = '<div class="room-row">Room list unavailable</div>';
            return;
        }
        if (rooms.length === 0) {
            roomsElement.innerHTML = '<div class="room-row">No rooms yet - create one!</div>';
            return;
        }
        roomsElement.innerHTML = "";
        for (const room of rooms) {
            if (!room.open) {
                continue;
            }
            const row = document.createElement("div");
            row.className = "room-row";
            row.innerHTML = `
                <span>${escapeHtml(room.mode ?? "room")} (${room.players}/${room.max ?? "?"})</span>
                <button type="button" data-join="${room.roomId}">Join</button>
            `;
            roomsElement.appendChild(row);
        }
    }

    async createRoom() {
        const max = DEFAULT_MAX_PLAYERS;
        const roomId = crypto.randomUUID();
        this.#renderWaiting(roomId, true);
        try {
            const room = await this.#vibeClient.getRoomApi().room.join(roomId, ROOM_JOIN_OPTIONS);
            await room.announce({ open: true, listed: true, max, mode: this.#mode, players: 1 });
            this.#bindRoom(room);
        } catch (error) {
            console.error(`[Lobby] create room failed: ${error}`);
            this.#renderHome();
        }
    }

    async quickJoin() {
        try {
            const roomId = await this.#vibeClient.getRoomApi().quickJoin({
                filter: (room) => room.open && room.players < room.max,
            });
            if (roomId === null) {
                this.#renderHome();
                this.refreshRooms();
                return;
            }
            await this.joinRoom(roomId);
        } catch (error) {
            console.error(`[Lobby] quick join failed: ${error}`);
            this.#renderHome();
        }
    }

    async joinRoom(roomId) {
        this.#renderWaiting(roomId, false);
        try {
            const meta = await this.#vibeClient.getRoomApi().get(roomId);
            if (meta?.pass) {
                const pass = prompt(`Room "${meta.mode ?? "room"}" is password protected. Enter password:`) ?? "";
                if (pass !== meta.pass) {
                    this.#renderHome();
                    return;
                }
            }
            const room = await this.#vibeClient.getRoomApi().room.join(roomId, ROOM_JOIN_OPTIONS);
            this.#bindRoom(room);
        } catch (error) {
            console.error(`[Lobby] join room failed: ${error}`);
            this.#renderHome();
        }
    }

    #bindRoom(room) {
        this.#room = room;
        room.onPeer((event) => {
            console.log(`[Lobby] peer event ${event.type} ${event.id}`);
            if (event.type === "leave" || event.type === "join") {
                this.#renderPeers();
            }
            if (event.type === "error") {
                console.warn(`[Lobby] room error: ${event.reason} ${event.detail}`);
            }
        });
        this.#renderPeers();
    }

    #renderWaiting(roomId, isHost) {
        this.#container.innerHTML = `
            <div class="lobby-title">${isHost ? "Your room" : "Joining room"}</div>
            <div class="lobby-hint">Room id: ${roomId}</div>
            <div class="lobby-rooms" data-peers></div>
            ${isHost ? '<button type="button" data-start>Start match</button>' : '<div class="lobby-hint">Waiting for host to start...</div>'}
            <button type="button" data-leave>Leave room</button>
        `;
        const startButton = this.#container.querySelector("[data-start]");
        if (startButton) {
            startButton.addEventListener("click", () => this.#startMatch());
        }
        this.#container.querySelector("[data-leave]").addEventListener("click", () => this.leaveRoom());
    }

    #renderPeers() {
        const peersElement = this.#container.querySelector("[data-peers]");
        if (!peersElement || !this.#room) {
            return;
        }
        const peers = this.#room.peers();
        const count = peers.length + 1; // + self
        peersElement.innerHTML = `
            <div class="room-row"><span>You (${this.#room.isHost ? "host" : "player"})</span></div>
            ${peers.map((peer) => `<div class="room-row"><span>Player ${escapeHtml(peer.id.slice(0, 6))}</span><span>${peer.open ? "connected" : "..."}</span></div>`).join("")}
            <div class="room-row"><span>${count} in room (max ${DEFAULT_MAX_PLAYERS})</span></div>
        `;
    }

    async #startMatch() {
        if (!this.#room?.isHost) {
            return;
        }
        if (this.#onStart) {
            await this.#onStart(this.#room);
        }
    }

    async leaveRoom() {
        if (this.#room) {
            if (this.#room.isHost) {
                try {
                    await this.#room.close();
                } catch (error) {
                    console.warn(`[Lobby] close room failed: ${error}`);
                }
            } else {
                this.#room.leave();
            }
            this.#room = null;
        }
        if (this.#onLeave) {
            this.#onLeave();
        }
        this.#renderHome();
        this.refreshRooms();
    }

    static async create(vibeClient, container, callbacks) {
        const lobby = new Lobby(vibeClient, container, callbacks);
        return lobby;
    }
}

function escapeHtml(text) {
    return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
