import asyncio
import json
import mido
import websockets

# Channel number -> instrument name (from MODALITIES.md)
CHANNEL_NAMES = {
    9: "drums",
    8: "bass",
    15: "chord",
    0: "treble",
}

# Contact sensor: channel 9, note 39 (table hit)
CONTACT_CHANNEL = 9
CONTACT_NOTE = 39

clients: set = set()
loop: asyncio.AbstractEventLoop | None = None

# Current state; all continuous values normalized 0-1
state = {
    "channel": "drums",
    "note": 0.0,
    "force": 0.0,
    "swell": 0.0,
    "rotational_velocity": 0.0,
    "gyroscope": 0.0,
    "accelerometer": 0.0,
    "contact": False,
}


def normalize_127(value: int) -> float:
    """Map 0-127 to 0.0-1.0."""
    return max(0.0, min(1.0, value / 127.0))


def build_state_dict() -> dict:
    return {
        "channel": state["channel"],
        "note": state["note"],
        "force": state["force"],
        "swell": state["swell"],
        "rotational_velocity": state["rotational_velocity"],
        "gyroscope": state["gyroscope"],
        "accelerometer": state["accelerometer"],
        "contact": state["contact"],
    }


def emit():
    payload = json.dumps(build_state_dict())
    print(payload)
    if clients and loop:
        asyncio.run_coroutine_threadsafe(broadcast(payload), loop)


def set_and_emit(key: str, value):
    if state[key] != value:
        state[key] = value
        emit()


def midi_callback(msg):
    if msg.type == "control_change":
        if msg.control == 112:
            set_and_emit("rotational_velocity", normalize_127(msg.value))
        elif msg.control == 1:
            set_and_emit("gyroscope", normalize_127(msg.value))
        elif msg.control == 74:
            set_and_emit("swell", normalize_127(msg.value))
        elif msg.control == 113:
            set_and_emit("accelerometer", normalize_127(msg.value))

    elif msg.type == "note_on":
        if msg.channel == CONTACT_CHANNEL and msg.note == CONTACT_NOTE:
            if not state["contact"]:
                state["contact"] = True
                emit()
        else:
            channel_name = CHANNEL_NAMES.get(msg.channel, state["channel"])
            state["channel"] = channel_name
            state["note"] = normalize_127(msg.note)
            state["force"] = normalize_127(msg.velocity)
            emit()

    elif msg.type == "note_off":
        if msg.channel == CONTACT_CHANNEL and msg.note == CONTACT_NOTE:
            if state["contact"]:
                state["contact"] = False
                emit()


async def broadcast(payload: str):
    if clients:
        await asyncio.gather(
            *[c.send(payload) for c in clients.copy()],
            return_exceptions=True,
        )


async def handler(websocket):
    clients.add(websocket)
    print(f"client connected  ({len(clients)} total)")
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)
        print(f"client disconnected ({len(clients)} total)")


async def main():
    global loop
    loop = asyncio.get_event_loop()

    devices = mido.get_input_names()
    if not devices:
        print("no MIDI devices found — plug in the Orba and retry")
        return

    print(f"opening MIDI device: {devices[0]}")
    inport = mido.open_input(devices[0], callback=midi_callback)

    async with websockets.serve(handler, "localhost", 8765):
        print("WebSocket server on ws://localhost:8765")
        await asyncio.Future()  # run forever

    inport.close()


asyncio.run(main())
