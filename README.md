# ZenoPack Specification v1.0

> The universal game package format for browser-based unblockers.

---

## Overview

ZenoPack (`.zenopack`) is an open, client-side game packaging format designed for browser-based unblocking platforms. A `.zenopack` file contains everything needed to run a web game — HTML, JavaScript, CSS, assets, and metadata — in a single portable file that requires no server, no installation, and no external dependencies.

Any platform that implements the ZenoPack spec can import and export games interchangeably, creating a universal ecosystem of shareable browser games.

---

## File Format

A `.zenopack` file is a **UTF-8 encoded JSON document** with the `.zenopack` extension.

Despite being JSON, it is saved with the `.zenopack` extension to make it clearly identifiable and prevent accidental editing. Platforms should not rely on the MIME type being set correctly by the transferring system.

### Top-Level Structure

```json
{
  "zenopack": "1.0",
  "name": "My Game",
  "icon": "data:image/png;base64,...",
  "category": "arcade",
  "description": "A short description of the game.",
  "fileCount": 3,
  "exportedAt": "2025-03-16T12:00:00.000Z",
  "files": [ ... ]
}
```

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zenopack` | `string` | ✅ | Spec version. Currently `"1.0"`. |
| `name` | `string` | ✅ | Display name of the game. Max 128 characters. |
| `files` | `array` | ✅ | Array of file objects. Must contain at least one entry with `path: "index.html"`. |
| `icon` | `string` | ❌ | Base64 data URL of the game's icon/thumbnail. Recommended size: 256×256px. |
| `category` | `string` | ❌ | Category tag. See [Categories](#categories). |
| `description` | `string` | ❌ | Short description of the game. Max 512 characters. |
| `fileCount` | `number` | ❌ | Number of files (informational, for display). |
| `exportedAt` | `string` | ❌ | ISO 8601 timestamp of when the pack was created. |

---

## File Objects

Each entry in the `files` array represents one file from the game.

```json
{
  "path": "index.html",
  "mimeType": "text/html",
  "data": [60, 33, 68, 79, 67, 84, 89, 80, 69, ...]
}
```

### File Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | ✅ | Relative path of the file within the game folder. Must use forward slashes. |
| `mimeType` | `string` | ✅ | MIME type of the file (e.g. `"text/html"`, `"application/javascript"`). |
| `data` | `number[]` | ✅ | Raw file contents as an array of unsigned 8-bit integers (byte array). |

### Path Rules

- Paths are **relative to the game root** — no leading slash, no `./` prefix.
- Directory separators must be forward slashes (`/`), not backslashes.
- Every `.zenopack` **must** contain a file with `path: "index.html"` — this is the game's entry point.
- Subdirectories are supported: `"assets/sprite.png"`, `"js/game.js"`, etc.

### Encoding File Data

File contents are stored as a plain JavaScript byte array (array of integers 0–255). This is intentionally chosen over base64 for simplicity and direct `Uint8Array` compatibility:

```js
// Encoding (export)
const buffer = await file.arrayBuffer();
const data = Array.from(new Uint8Array(buffer));

// Decoding (import)
const buffer = new Uint8Array(data).buffer;
const file = new File([buffer], filename, { type: mimeType });
```

---

## Validation Rules

A valid `.zenopack` file must satisfy all of the following:

1. The file must be valid JSON.
2. The top-level `zenopack` field must be present and a string.
3. The `name` field must be present and a non-empty string.
4. The `files` field must be a non-empty array.
5. At least one file must have `path` equal to `"index.html"` (case-insensitive).
6. Every file object must have `path`, `mimeType`, and `data` fields.
7. `data` must be an array of integers.

---

## Categories

The optional `category` field should be one of the following standard values. Platforms may display or filter by category.

| Value | Description |
|-------|-------------|
| `arcade` | Fast-paced action games |
| `puzzle` | Logic and puzzle games |
| `platformer` | Side-scrolling platformers |
| `shooter` | Shoot-em-ups and FPS |
| `rpg` | Role-playing games |
| `strategy` | Strategy and tower defense |
| `sports` | Sports simulations |
| `racing` | Racing games |
| `horror` | Horror games |
| `other` | Anything else |

---

## Versioning

The `zenopack` field contains the spec version as a string (`"1.0"`).

- **Patch versions** (e.g. `1.0` → `1.0.1`) are backwards compatible. Importers should accept any `1.x` pack.
- **Major versions** (e.g. `1.0` → `2.0`) may introduce breaking changes. Importers should warn if the major version is higher than supported.

---

## Implementation Guide

### Importing a `.zenopack`

```js
// 1. Read the file as text
const text = await file.text();
const pack = JSON.parse(text);

// 2. Validate
if (!pack.zenopack || !pack.name || !pack.files?.length) {
  throw new Error('Invalid .zenopack');
}
const hasIndex = pack.files.some(f => f.path.toLowerCase() === 'index.html');
if (!hasIndex) throw new Error('Missing index.html');

// 3. Reconstruct files
const fileRecords = pack.files.map(f => {
  const buffer = new Uint8Array(f.data).buffer;
  const file = new File([buffer], f.path.split('/').pop(), { type: f.mimeType });
  return { file, path: f.path, mimeType: f.mimeType };
});

// 4. Use fileRecords however your platform loads games
// e.g. register with a Service Worker, use blob URLs, etc.
```

### Exporting a `.zenopack`

```js
// fileRecords: [{ file: File, path: string, mimeType: string }]
async function exportZenopack(name, fileRecords) {
  const files = [];
  for (const r of fileRecords) {
    const buf = await r.file.arrayBuffer();
    files.push({
      path: r.path,
      mimeType: r.mimeType,
      data: Array.from(new Uint8Array(buf)),
    });
  }

  const pack = {
    zenopack: '1.0',
    name,
    fileCount: files.length,
    exportedAt: new Date().toISOString(),
    files,
  };

  const blob = new Blob([JSON.stringify(pack)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[^a-z0-9_-]/gi, '_') + '.zenopack';
  a.click();
  URL.revokeObjectURL(url);
}
```

### Using the Official Library

The fastest way to add ZenoPack support is to use the official `zenopack.js` library:

```html
<script src="zenopack.js"></script>
<!-- Optional: drop-in UI -->
<script src="zenopack-ui.js"></script>
```

**Import a game:**
```js
const fileInput = document.getElementById('my-file-input');
fileInput.addEventListener('change', async () => {
  const game = await ZenoPack.import(fileInput.files[0]);
  console.log(game.name);       // "My Game"
  console.log(game.fileRecords); // [{ file, path, mimeType }, ...]
});
```

**Export a game:**
```js
await ZenoPack.export({
  name: 'My Game',
  icon: 'data:image/png;base64,...', // optional
  fileRecords: myFileRecords,
});
// Downloads "My_Game.zenopack" automatically
```

**Drop-in import UI:**
```js
ZenoPack_UI.createImportUI('#my-container', {
  onImport: (game) => {
    console.log('Imported:', game.name);
    // game.fileRecords is ready to use
  },
  onError: (err) => console.error(err),
});
```

---

## File Size Considerations

ZenoPack files store binary data as integer arrays, which results in approximately **3–4× larger** file sizes compared to the original game assets. This is a deliberate trade-off for simplicity and universal JSON compatibility.

For large games (>50MB original), consider whether ZenoPack is the right transport. For most browser games (typically 1–20MB), the size overhead is acceptable.

---

## Example `.zenopack`

```json
{
  "zenopack": "1.0",
  "name": "Snake",
  "category": "arcade",
  "description": "Classic snake game.",
  "fileCount": 2,
  "exportedAt": "2025-03-16T12:00:00.000Z",
  "files": [
    {
      "path": "index.html",
      "mimeType": "text/html",
      "data": [60, 104, 116, 109, 108, 62, ...]
    },
    {
      "path": "game.js",
      "mimeType": "application/javascript",
      "data": [118, 97, 114, 32, 115, ...]
    }
  ]
}
```

---

## License

The ZenoPack specification is released under the **MIT License**. Any platform may implement, extend, or build upon it freely.

---

## Credits

ZenoPack was created by the **Eclipse Suite** team as part of the Zeno platform.

*Originated by Mizzery — Eclipse Suite*
