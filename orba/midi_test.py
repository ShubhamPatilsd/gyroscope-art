import mido

devices = mido.get_input_names()

with mido.open_input(devices[0]) as inport:
    for msg in inport:
        if "note" in str(msg):
            print(msg)


# force sensor - {velocity} in note_on and note_off
# turning - {value} in control_change gives delta(?)
# ?????? - {pitch} in pitchwheel gives delta(?)
# ?????? (maybe swell) - {value} in aftertouch


# LOOK AT GRAPHER.PY TO GET THE ROTATION AND VIBRATO(?)



#### LOOK UP WHAT THESE WORDS MEAN IN MIDI STANDARDS




"""
note_on:
- triggers when you press a key or pad
- pitch 0 to 127
- velocity 0 to 127 for how hard you hit it

note_off:
- sent when you release a key
- tells synth to stop playing
- also has a velocity

pitchwheel:
- 


- aftertouch
- control_change
- 
"""