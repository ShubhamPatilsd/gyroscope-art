"""
THIS FILE IS THE WORKING GRAPH
"""


import mido
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from collections import deque
import threading
import time

# Data storage
control_data = deque(maxlen=500)
start_time = time.time()

# MIDI input setup
devices = mido.get_input_names()
if not devices:
    print("No MIDI devices found!")
    exit(1)

print(f"Using MIDI device: {devices[0]}")
inport = mido.open_input(devices[0])

# Thread-safe data collection
def collect_midi_data():
    """Collect MIDI messages in a separate thread"""
    global control_data, start_time
    
    for msg in inport:
        if msg.type == 'control_change':
            current_time = time.time() - start_time
            control_data.append({
                'time': current_time,
                'control': msg.control,
                'value': msg.value,
                'channel': msg.channel
            })
            if msg.control in (1, 74, 113):
                print(f"CC{msg.control} time={current_time:.2f} value={msg.value} channel={msg.channel}")

# Start MIDI collection in background thread
midi_thread = threading.Thread(target=collect_midi_data, daemon=True)
midi_thread.start()

# Set up the plot
fig, ax = plt.subplots(1, 1, figsize=(12, 6))
fig.suptitle('Real-time MIDI Controller Visualization', fontsize=14, fontweight='bold')

ax.set_ylabel('Control Value', fontweight='bold')
ax.set_xlabel('Time (seconds)', fontweight='bold')
ax.set_title('Control Changes', fontweight='bold')
ax.set_ylim(-5, 130)
ax.grid(True, alpha=0.3)

# Time window for display (last 10 seconds)
time_window = 10

# Control numbers to display
displayed_controls = [1, 74, 113]

def update_graph(frame):
    """Update the graph with latest MIDI data"""
    current_time = time.time() - start_time
    time_min = max(0, current_time - time_window)
    time_max = current_time + 1
    
    # Clear axes
    ax.clear()
    
    # Reapply labels and settings
    ax.set_ylabel('Control Value', fontweight='bold')
    ax.set_xlabel('Time (seconds)', fontweight='bold')
    ax.set_title('Control Changes', fontweight='bold')
    ax.set_ylim(-5, 130)
    ax.set_xlim(time_min, time_max)
    ax.grid(True, alpha=0.3)
    
    # Plot control changes (group by control number)
    control_times = [d['time'] for d in control_data if time_min <= d['time'] <= time_max]
    control_values = [d['value'] for d in control_data if time_min <= d['time'] <= time_max]
    control_numbers = [d['control'] for d in control_data if time_min <= d['time'] <= time_max]
    
    if control_times:
        # Filter to only displayed controls
        filtered_data = [(t, v, n) for t, v, n in zip(control_times, control_values, control_numbers) 
                        if n in displayed_controls]
        
        if filtered_data:
            # Group by control number
            unique_controls = sorted(set(n for _, _, n in filtered_data))
            colors = plt.cm.tab10(range(len(unique_controls)))
            
            for i, cc_num in enumerate(unique_controls):
                cc_times = [t for t, _, n in filtered_data if n == cc_num]
                cc_vals = [v for _, v, n in filtered_data if n == cc_num]
                ax.plot(cc_times, cc_vals, color=colors[i], linewidth=2, alpha=0.7, 
                        label=f'CC {cc_num}', marker='o', markersize=4)
            ax.legend(loc='upper right', fontsize=8)
    
    plt.tight_layout()


ani = animation.FuncAnimation(fig, update_graph, interval=50, blit=False)  # Update every 50ms
plt.show()

# Cleanup
inport.close()
