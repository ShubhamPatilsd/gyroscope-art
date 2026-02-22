"""
Parse Orba MIDI into a normalized dict for the frontend/websocket pipeline.
Emits on any music change (channel, note, force, swell) or movement change
(rotational_velocity, gyroscope, accelerometer), or contact change.

Output: one JSON object per line (NDJSON) to stdout.
"""


"""
Summary of what’s in place:
orba_parser.py
Input: Same as midi_test.py — mido.open_input(devices[0]), or pass a device name: python orba_parser.py "Orba".
Parsing:
control_change: CC 112 → rotational_velocity, CC 1 → gyroscope, CC 74 → swell, CC 113 → accelerometer.
note_on: channel → CHANNEL_NAMES (9→drums, 8→bass, 15→chord, 0→treble), note and velocity normalized to 0–1; contact = note 39 on channel 9 (table hit).
note_off: only contact (note 39, ch 9) updates state; other note_offs don’t change channel/note/force so no emit.
Normalization: All 0–127 values (note, force, swell, rotational_velocity, gyroscope, accelerometer) → float in [0, 1] via /127.
Output dict order: channel, note, force, swell, rotational_velocity, gyroscope, accelerometer, contact (boolean).
When it emits: Only when something changes (music: channel/note/force or contact; movement: one of the four CCs). No emit on non-contact note_off.
Format: One JSON object per line (NDJSON) to stdout, so the websocket server can run it and read line-by-line.
Run
"""

import json
import mido

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


def normalize_127(value: int) -> float:
    """Map 0-127 to 0.0-1.0."""
    return max(0.0, min(1.0, value / 127.0))


def build_state_dict(state: dict) -> dict:
    """Assemble output dict in the required order: channel, note, force, swell,
    rotational_velocity, gyroscope, accelerometer, contact.
    """
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


def run(device_name: str | None = None):
    devices = mido.get_input_names()
    if not devices:
        raise RuntimeError("No MIDI devices found")

    if device_name:
        inport = mido.open_input(device_name)
    else:
        inport = mido.open_input(devices[0])

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

    def set_and_emit(key: str, value):
        if state[key] != value:
            state[key] = value
            emit()

    def emit():
        print(json.dumps(build_state_dict(state)))

    try:
        for msg in inport:
            if msg.type == "control_change":
                # Movement / swell: CC 112, 1, 74, 113
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
                    # Music: channel, note, force (always emit on new note)
                    channel_name = CHANNEL_NAMES.get(msg.channel, state["channel"])
                    note_norm = normalize_127(msg.note)
                    force_norm = normalize_127(msg.velocity)
                    state["channel"] = channel_name
                    state["note"] = note_norm
                    state["force"] = force_norm
                    emit()

            elif msg.type == "note_off":
                if msg.channel == CONTACT_CHANNEL and msg.note == CONTACT_NOTE:
                    if state["contact"]:
                        state["contact"] = False
                        emit()
                # else: no state change (we keep last channel/note/force)
    finally:
        inport.close()


if __name__ == "__main__":
    import sys
    run(sys.argv[1] if len(sys.argv) > 1 else None)

