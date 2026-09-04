# JARVIS GitHub Pages — Private Location Rooms

This build adds an opt-in **Private Location Room** system. A user can generate an 8-character room code, share that code with friends, and see locations from people who explicitly enable location sharing. Voice commands can open the room, start/stop sharing, and report distances.

## Important privacy/technical note

GitHub Pages is static hosting, so it cannot itself synchronize live locations between separate phones. This project therefore includes an optional Node/WebSocket room server in `server/`. Configure its `wss://...` URL in **Settings → Private room server** to enable cross-device synchronization. Without a server URL, room-code UI still works locally but does not sync between devices.

The room code is an access code, not a guarantee of end-to-end encryption. Only share it with people you trust. Location sharing is always opt-in and can be stopped.

## Room server

1. Install Node.js.
2. In `server/`, run `npm install`.
3. Run `npm start`.
4. Put the deployed secure WebSocket URL (for example `wss://your-domain.example`) into JARVIS Settings.

Use HTTPS/WSS in production. Do not put API secrets in the GitHub Pages frontend.

## Voice examples

- “Open private room”
- “Create a room”
- “Start live location”
- “Stop sharing”
- “Show friends”
- “How far is everyone?”
