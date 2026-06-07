# FAQ & Troubleshooting

## General Questions

### Is Setlists MD really free?
Yes. The core app runs entirely in your browser without requiring a server, which means our hosting costs are near zero. You can use it, store songs, and build setlists completely for free.

### Where are my songs stored?
By default, your songs are stored locally inside your web browser's storage (IndexedDB). They do not exist on any server.

## Troubleshooting

### I opened the app and all my songs are gone!
If you are using an iPhone, iPad, or Mac, Safari has a strict privacy policy that **automatically deletes website data if you don't visit the site for 7 days.**

**How to fix/prevent this:**
1. **Enable Cloud Sync:** Go to Settings > Data and connect to Google Drive, Dropbox, or OneDrive. Your songs will be safely backed up to your cloud, and if Safari clears your local cache, the app will instantly download them again when you open it.
2. **Add to Home Screen:** On iOS, tapping "Share" and "Add to Home Screen" installs the app as a PWA, which often provides more persistent storage than running it inside the Safari tab.

### The app isn't syncing my changes to my bandmates.
Check the following:
1. Are you both connected to the **same shared folder** in Google Drive/Dropbox?
2. Did you see the "Syncing..." indicator complete in the top right corner?
3. Try tapping the "Sync Now" button in the Settings menu to force an immediate pull from the cloud.

### My Bluetooth pedal isn't scrolling.
Setlists MD listens for standard keyboard arrow keys (Up/Down/Left/Right) and Page Up/Page Down.
1. Ensure your pedal is paired to your device via Bluetooth.
2. Go to **Settings > Pedal Mapping**.
3. Tap the action you want to map, then press the button on your pedal to register it.

### The chord transposition looks wrong.
If you transpose a complex chord like `F#m7b5/C#` and it results in strange characters, double-check that you typed the original chord cleanly inside the brackets `[ ]` without extra spaces. If a bug persists, please open an issue on our GitHub repository with the specific chord that failed.
