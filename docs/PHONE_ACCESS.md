# Phone Access

## Recommended: GitHub Pages

For microphone access on a phone, use HTTPS. GitHub Pages is the simplest path because mobile browsers usually block `getUserMedia` on plain LAN HTTP.

After Pages is enabled, open:

```text
https://blackmvmba88.github.io/rainbow-mic-scope/
```

Tap `Start Mic` and allow microphone access.

## Local Docker

Docker is useful for testing the WebUI from another device on the same Wi-Fi.

```bash
docker compose up --build
```

Then open from your phone:

```text
http://192.168.101.100:4173
```

Important: some mobile browsers will show the page but block the microphone because this is HTTP, not HTTPS.

## QR Shortcut

Generate a QR code for the current LAN address:

```bash
npm run qr
```

The WebUI `QR` button opens the generated code and URL. If your Wi-Fi IP changes, rerun `npm run qr`.

## Local Non-Docker

```bash
python3 -m http.server 4173 -d webui
```

Then open:

```text
http://192.168.101.100:4173
```

Again, HTTP may block phone microphone access. Use GitHub Pages for the clean path.
