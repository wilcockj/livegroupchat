import os

emotes = {}

# Path to the directory containing the images
directory_path = "."

# Iterate over the files in the directory
for filename in os.listdir(directory_path):
    # Check if the file is an image file
    if filename.endswith(".png") or filename.endswith(".jpg") or filename.endswith(".webp"):
        # Extract the emote name from the filename (assuming the filename is in the format "emote.png")
        emote_name = os.path.splitext(filename)[0]

        # Create the emote path by joining the directory path and the filename
        emote_path = os.path.join(directory_path, filename)

        # Add the emote and its path to the dictionary
        emotes[emote_name] = emote_path

# Print the resulting dictionary in the desired format
for emote, path in emotes.items():
    print(f'"{emote}": "./emotes{path[1:]}",')

