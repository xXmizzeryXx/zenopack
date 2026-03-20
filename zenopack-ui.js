(function (global) {
  'use strict';

  const DEFAULT_STYLES = `
.znpk-wrap {
  font-family: system-ui, sans-serif;
  box-sizing: border-box;
}
.znpk-wrap *, .znpk-wrap *::before, .znpk-wrap *::after {
  box-sizing: border-box;
}
.znpk-drop {
  border: 2px dashed rgba(0,245,255,0.3);
  border-radius: 12px;
  padding: 36px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  background: rgba(0,245,255,0.02);
  position: relative;
  user-select: none;
}
.znpk-drop:hover, .znpk-drop.znpk-dragover {
  border-color: rgba(0,245,255,0.6);
  background: rgba(0,245,255,0.05);
  box-shadow: 0 0 24px rgba(0,245,255,0.07);
}
.znpk-drop input[type="file"] {
  position: absolute; inset: 0;
  opacity: 0; cursor: pointer; width: 100%; height: 100%;
}
.znpk-icon {
  font-size: 2.4rem;
  margin-bottom: 12px;
  display: block;
}
.znpk-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #e0e8ff;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.znpk-sub {
  font-size: 12px;
  color: #5a6080;
}
.znpk-status {
  margin-top: 12px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  min-height: 18px;
  transition: color 0.2s;
  text-align: center;
}
.znpk-status.znpk-ok    { color: #00ff88; }
.znpk-status.znpk-err   { color: #ff006e; }
.znpk-status.znpk-info  { color: #00f5ff; }
.znpk-progress {
  margin-top: 10px;
  height: 3px;
  background: rgba(0,245,255,0.1);
  border-radius: 3px;
  overflow: hidden;
  display: none;
}
.znpk-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #00f5ff, #bf00ff);
  border-radius: 3px;
  transition: width 0.2s;
  width: 0%;
}
`;

  function injectStyles(customStyles) {
    if (document.getElementById('znpk-styles')) return;
    const style = document.createElement('style');
    style.id = 'znpk-styles';
    style.textContent = DEFAULT_STYLES + (customStyles || '');
    document.head.appendChild(style);
  }

  function createImportUI(container, options = {}) {
    if (!global.ZenoPack) {
      throw new Error('zenopack.js must be loaded before zenopack-ui.js');
    }

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) throw new Error('Container element not found');

    injectStyles(options.styles);

    const {
      onImport,
      onError,
      title = 'DROP A .ZENOPACK FILE',
      subtitle = 'or click to browse',
      icon = '📦',
    } = options;

    const wrap = document.createElement('div');
    wrap.className = 'znpk-wrap';
    wrap.innerHTML = `
      <div class="znpk-drop" id="znpk-drop">
        <input type="file" accept=".zenopack" id="znpk-input">
        <span class="znpk-icon">${icon}</span>
        <div class="znpk-title">${title}</div>
        <div class="znpk-sub">${subtitle}</div>
      </div>
      <div class="znpk-progress" id="znpk-progress">
        <div class="znpk-progress-bar" id="znpk-progress-bar"></div>
      </div>
      <div class="znpk-status" id="znpk-status"></div>
    `;

    container.appendChild(wrap);

    const dropEl     = wrap.querySelector('#znpk-drop');
    const inputEl    = wrap.querySelector('#znpk-input');
    const statusEl   = wrap.querySelector('#znpk-status');
    const progressEl = wrap.querySelector('#znpk-progress');
    const barEl      = wrap.querySelector('#znpk-progress-bar');

    function setStatus(msg, type = '') {
      statusEl.textContent = msg;
      statusEl.className = 'znpk-status' + (type ? ' znpk-' + type : '');
    }

    function setProgress(pct, show = true) {
      progressEl.style.display = show ? 'block' : 'none';
      barEl.style.width = Math.min(100, pct) + '%';
    }

    async function handleFile(file) {
      if (!file) return;
      if (!file.name.endsWith('.zenopack')) {
        setStatus('File must be a .zenopack', 'err');
        if (onError) onError(new Error('Invalid file type'));
        return;
      }

      setStatus('Reading file...', 'info');
      setProgress(10);

      try {
        setProgress(40);
        const game = await ZenoPack.import(file);
        setProgress(90);
        setStatus(`Loaded: ${game.name}`, 'ok');
        setProgress(100);
        setTimeout(() => setProgress(0, false), 800);
        if (onImport) onImport(game);
      } catch (e) {
        setStatus(e.message, 'err');
        setProgress(0, false);
        if (onError) onError(e);
      }

      inputEl.value = '';
    }

    inputEl.addEventListener('change', () => handleFile(inputEl.files[0]));

    dropEl.addEventListener('dragover', e => {
      e.preventDefault(); e.stopPropagation();
      dropEl.classList.add('znpk-dragover');
    });
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('znpk-dragover'));
    dropEl.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      dropEl.classList.remove('znpk-dragover');
      const file = e.dataTransfer.files[0];
      handleFile(file);
    });

    function destroy() {
      container.removeChild(wrap);
    }

    return { setStatus, setProgress, destroy };
  }

  const ZenoPack_UI = { createImportUI };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZenoPack_UI;
  } else if (typeof define === 'function' && define.amd) {
    define(['ZenoPack'], function () { return ZenoPack_UI; });
  } else {
    global.ZenoPack_UI = ZenoPack_UI;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
