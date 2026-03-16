/*!
 * zenopack.js v1.0.0
 * The universal game package format for browser-based unblockers.
 * https://github.com/xXmizzeryXx/zenopack
 * MIT License
 */

(function (global) {
  'use strict';

  const ZENOPACK_VERSION = '1.0';
  const MIME_MAP = {
    html:'text/html', htm:'text/html',
    js:'application/javascript', mjs:'application/javascript', cjs:'application/javascript',
    css:'text/css', json:'application/json',
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
    webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp', ico:'image/x-icon',
    mp3:'audio/mpeg', ogg:'audio/ogg', wav:'audio/wav',
    mp4:'video/mp4', webm:'video/webm',
    woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf',
    eot:'application/vnd.ms-fontobject',
    txt:'text/plain', xml:'application/xml', wasm:'application/wasm',
  };

  function getMime(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return MIME_MAP[ext] || 'application/octet-stream';
  }

  // ── VALIDATION ────────────────────────────────────────────────────

  /**
   * Validate a parsed zenopack object.
   * @param {object} pack - The parsed JSON object
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate(pack) {
    const errors = [];

    if (!pack || typeof pack !== 'object') {
      return { valid: false, errors: ['Not a valid object'] };
    }
    if (!pack.zenopack) errors.push('Missing field: zenopack (version string)');
    if (!pack.name || typeof pack.name !== 'string') errors.push('Missing field: name');
    if (!Array.isArray(pack.files) || pack.files.length === 0) {
      errors.push('Missing or empty field: files');
    } else {
      const hasIndex = pack.files.some(f =>
        f.path && f.path.toLowerCase() === 'index.html'
      );
      if (!hasIndex) errors.push('files must contain an entry with path "index.html"');

      pack.files.forEach((f, i) => {
        if (!f.path) errors.push(`files[${i}]: missing path`);
        if (!f.mimeType) errors.push(`files[${i}]: missing mimeType`);
        if (!Array.isArray(f.data)) errors.push(`files[${i}]: data must be a byte array`);
      });
    }

    return { valid: errors.length === 0, errors };
  }

  // ── IMPORT ────────────────────────────────────────────────────────

  /**
   * Parse a .zenopack File or Blob into a usable game object.
   * @param {File|Blob} file
   * @returns {Promise<ZenoPackGame>}
   */
  async function importPack(file) {
    if (!file) throw new Error('No file provided');

    const text = await file.text();
    let pack;
    try {
      pack = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid .zenopack file: not valid JSON');
    }

    const { valid, errors } = validate(pack);
    if (!valid) throw new Error('Invalid .zenopack: ' + errors.join('; '));

    // Reconstruct File objects from byte arrays
    const fileRecords = pack.files.map(f => {
      const buffer = new Uint8Array(f.data).buffer;
      const fileName = f.path.split('/').pop();
      const fileObj = new File([buffer], fileName, { type: f.mimeType });
      // Attach webkitRelativePath-style path
      Object.defineProperty(fileObj, 'webkitRelativePath', {
        value: pack.name + '/' + f.path,
        writable: false, configurable: true
      });
      return { file: fileObj, path: f.path, mimeType: f.mimeType };
    });

    return {
      name: pack.name,
      icon: pack.icon || null,
      category: pack.category || null,
      description: pack.description || null,
      version: pack.zenopack,
      fileRecords,
      raw: pack,
    };
  }

  // ── EXPORT ────────────────────────────────────────────────────────

  /**
   * Export a game to a .zenopack file and trigger a download.
   * @param {object} options
   * @param {string} options.name - Game name
   * @param {string|null} [options.icon] - Base64 data URL icon
   * @param {string|null} [options.category] - Optional category tag
   * @param {string|null} [options.description] - Optional description
   * @param {Array<{file: File, path: string, mimeType: string}>} options.fileRecords
   * @param {boolean} [options.download=true] - Whether to auto-download
   * @returns {Promise<Blob>} The .zenopack blob
   */
  async function exportPack(options) {
    const { name, icon = null, category = null, description = null, fileRecords, download = true } = options;

    if (!name) throw new Error('name is required');
    if (!fileRecords || !fileRecords.length) throw new Error('fileRecords is required');

    const files = [];
    for (const r of fileRecords) {
      const buf = await r.file.arrayBuffer();
      files.push({
        path: r.path,
        mimeType: r.mimeType || getMime(r.path),
        data: Array.from(new Uint8Array(buf)),
      });
    }

    const pack = {
      zenopack: ZENOPACK_VERSION,
      name,
      icon,
      category,
      description,
      fileCount: files.length,
      exportedAt: new Date().toISOString(),
      files,
    };

    const json = JSON.stringify(pack);
    const blob = new Blob([json], { type: 'application/octet-stream' });

    if (download) {
      const safeName = name.replace(/[^a-z0-9_\-]/gi, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = safeName + '.zenopack';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return blob;
  }

  // ── EXPORT FROM FILE INPUTS ───────────────────────────────────────

  /**
   * Build fileRecords from a FileList (e.g. from a folder input or drop).
   * @param {FileList|File[]} fileList
   * @returns {object|null} { name, fileRecords } or null if no index.html found
   */
  function fileListToRecords(fileList) {
    const files = Array.from(fileList);
    const name = files[0]?.webkitRelativePath?.split('/')[0] || 'Game';
    const hasIndex = files.some(f => {
      const parts = f.webkitRelativePath.split('/');
      return parts.length === 2 && parts[1].toLowerCase() === 'index.html';
    });
    if (!hasIndex) return null;

    const fileRecords = files.map(f => ({
      file: f,
      path: f.webkitRelativePath.split('/').slice(1).join('/'),
      mimeType: getMime(f.name),
    }));

    return { name, fileRecords };
  }

  // ── PUBLIC API ────────────────────────────────────────────────────

  const ZenoPack = {
    version: ZENOPACK_VERSION,
    validate,
    import: importPack,
    export: exportPack,
    fileListToRecords,
    getMime,
  };

  // UMD export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZenoPack;
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return ZenoPack; });
  } else {
    global.ZenoPack = ZenoPack;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
