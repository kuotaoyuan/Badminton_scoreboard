# Badminton Scoreboard Website (MediaPipe Hands)

This web app shows a badminton court with Red and Blue sides, scoreboards for each side, and uses your webcam with MediaPipe Hands to detect a thumbs-up ("yay") gesture. A detected thumbs-up on the left half of the frame increments Red's score; on the right half increments Blue's score. Manual up/down buttons are also available.

## Features
- Red vs Blue court with center net
- Live webcam feed rendered with overlaid hand landmarks
- Thumbs-up gesture gives a point to the corresponding side
- Manual score adjustments with ▲/▼ buttons

## Requirements
- Python 3.9+
- Internet access (to load MediaPipe scripts from CDN)

## Setup
1. Create and activate a virtual environment (optional):
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install flask
   ```

## Run
```bash
python app.py
```
Open `http://localhost:5050` in your browser and click "Start Camera". Grant camera permission.

## Notes
- Gesture heuristic: thumb tip above wrist; other fingertips not extended. Simple and may need tuning for your lighting/camera.
- Side attribution uses wrist x-position relative to frame center.
- No video is uploaded; all processing runs locally in the browser.

mediapipe - hand gesture
