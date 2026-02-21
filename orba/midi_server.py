import asyncio
import json
import mido
import websockets

clients: set = set()
loop: asyncio.AbstractEventLoop | None = None


def midi_callback(msg):
    data: dict = {"type": msg.type}

    if msg.type in ("note_on", "note_off"):
        data["pitch"] = msg.note
        data["velocity"] = msg.velocity
    elif msg.type == "pitchwheel":
        data["pitch"] = msg.pitch  # -8192 to 8191
    elif msg.type == "aftertouch":
        data["value"] = msg.value  # 0 to 127
    elif msg.type == "control_change":
        data["control"] = msg.control
        data["value"] = msg.value

    payload = json.dumps(data)
    print(payload)

    if clients and loop:
        asyncio.run_coroutine_threadsafe(broadcast(payload), loop)


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
