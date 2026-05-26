import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";

function detectLanIp() {
  const commands = [
    ["ipconfig", ["getifaddr", "en0"]],
    ["ipconfig", ["getifaddr", "en1"]],
  ];

  for (const [command, args] of commands) {
    try {
      const value = execFileSync(command, args, { encoding: "utf8" }).trim();
      if (value) return value;
    } catch {
      // Try the next interface.
    }
  }

  return "localhost";
}

const port = process.argv[2] || "4173";
const host = process.argv[3] || detectLanIp();
const url = `http://${host}:${port}`;
const svgPath = resolve("webui", "phone-qr.svg");
const textPath = resolve("webui", "phone-url.txt");

const svg = await QRCode.toString(url, {
  type: "svg",
  margin: 2,
  color: {
    dark: "#f8fafc",
    light: "#05060a",
  },
  width: 512,
});

writeFileSync(svgPath, svg);
writeFileSync(textPath, `${url}\n`);
console.log(url);
