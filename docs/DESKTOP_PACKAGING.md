# Desktop Packaging

Rainbow Mic Scope can be wrapped as a desktop application with Electron.

## Install

```bash
npm install
```

## Development

```bash
npm run desktop:dev
```

This opens the local WebUI inside an Electron shell.

## macOS DMG

```bash
npm run dist:mac
```

Output goes to:

```text
release/
```

The DMG is unsigned by default. It is useful for local testing and internal sharing. Public distribution should add Apple Developer ID signing and notarization.

## Windows EXE

```bash
npm run dist:win
```

Best path: run this on a Windows GitHub Actions runner or Windows machine. Building Windows installers from macOS can require extra tooling.

## Product Steps

1. Create unsigned macOS DMG.
2. Add Windows CI build for `.exe`.
3. Add app icon.
4. Add signing/notarization for public macOS distribution.
5. Attach artifacts to GitHub Releases.
