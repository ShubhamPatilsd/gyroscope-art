# Orba modalities: how each is expressed in the data stream and ranges

Plain summary of how to parse each modality from the Orba MIDI stream and the value ranges observed.

---

## 1. Rotational velocity

- **Message**: `control_change channel=0 control=112 value=<N> time=...`
- **Parsing**: `control` is always **112**; only **`value`** changes. When the Orba is at rest, **no** `control_change` messages are sent for this.
- **Range**:
  - At rest: no data (no CC 112 messages).
  - Gentle rotation / typical motion: **value ~64–65**.
  - Fast spin: briefly up to **~120**.
  - Jerk without rotation: **~0–1**.

---

## 2. Gyroscope (tilt / rotation sideways)

- **Message**: `control_change` with **control = 1**.
- **Parsing**: `msg.control == 1`, use **`msg.value`**.
- **Range**: **0–127**. 0 = no pitch (no tilt), 127 = full pitch in either direction.

---

## 3. Swell (moving fingers on pads)

- **Message**: `control_change` with **control = 74**.
- **Parsing**: `msg.control == 74`, use **`msg.value`**.
- **Range**: **0–127** (observed up to ~124 at low end; 127 is likely the max). 0 = high end of gesture, ~124–127 = low end.

---

## 4. Accelerometer (jerk / sudden movement)

- **Message**: `control_change` with **control = 113**.
- **Parsing**: `msg.control == 113`, use **`msg.value`**. When still, **no** messages are sent.
- **Range**:
  - When still: no data.
  - Tiny jerks: **~0–1**.
  - Mid jerks: **~40s**.
  - Max: **127**.

---

## 5. What note is being played

- **Message**: `note_on` and `note_off`.
- **Parsing**: **`channel`** = instrument (9, 8, 15, 0). **`note`** = MIDI note number.
- **Instrument → notes**:
  - **Channel 9**: 36, 38, 42, 49, 43, 45, 51, 70 (pad order).
  - **Channel 8**: 50, 52, 54, 55, 57, 59, 61, 62.
  - **Channel 15**: chords (four `note_on`s at once): (50,57,62,66), (52,54,64,67), (51,54,66,69), (55,59,62,71), (57,61,64,69), (59,62,66,71), (61,64,73,57), (62,66,74,57).
  - **Channel 0**: 62, 64, 66, 69, 71, 74, 76, 78.
- **Range**: `note` 0–127 (MIDI); `channel` 0, 8, 9, 15 for the four instruments.

---

## 6. Contact sensor (table hit)

- **Message**: `note_on` / `note_off` on **channel 9** with **note = 39**.
- **Parsing**: `channel == 9` and `note == 39` = Orba hit against table (contact), not a drum pad.
- **Range**: discrete on/off (note 39 on channel 9).

---

## 7. Force on note pads

- **Message**: `note_on` (and `note_off`; force_on is enough for most uses).
- **Parsing**: **`msg.velocity`** = how hard the pad was hit.
- **Range**: **0–127**.

---

## Ignored for now

- **Pitchwheel**: Present in the stream but mapping/meaning not yet clear; ignore for now.
- **Aftertouch**: Constant stream; ignore for now.

---

## Quick reference

| Modality            | Message type      | Identifier              | Value field | Range / notes                          |
|---------------------|-------------------|-------------------------|-------------|----------------------------------------|
| Rotational velocity | `control_change`  | `control == 112`        | `value`     | At rest: no data. ~64–65 typical, ~120 max spin, ~0–1 jerk no rotation. |
| Gyroscope           | `control_change`  | `control == 1`           | `value`     | 0–127 (0 = no pitch, 127 = full pitch) |
| Swell               | `control_change`  | `control == 74`          | `value`     | 0–127 (0 = high end, ~124–127 = low)   |
| Accelerometer       | `control_change`  | `control == 113`         | `value`     | At rest: no data. 0–1 tiny, ~40s mid, 127 max. |
| Note being played   | `note_on`/`note_off` | `channel`, `note`    | `note`      | channel 0/8/9/15; note per instrument (see above) |
| Contact (table hit) | `note_on` (ch 9) | `note == 39`            | —           | on/off                                 |
| Force (pad)         | `note_on`         | —                       | `velocity`  | 0–127                                  |
