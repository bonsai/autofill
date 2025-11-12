# JSON AutoFill 
## Load in Chrome
1. Open chrome://extensions
2. Enable Developer mode
3. Click "Load unpacked" and select `me/autofill`

## Usage
- Click the toolbar icon
- Import your `me.json` (see `me.json.example`)
- Choose active profile; content script will auto-fill forms when pages load

## Messages
- LOAD_DATA: import me.json
- EXPORT_DATA: export current storage
- GET_PROFILES / SET_ACTIVE_PROFILE
- GET_PROFILE: content script requests active profile
