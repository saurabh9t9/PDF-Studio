import './style.css';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const state = {
  documents: [],
  pages: [],
  selected: new Set(),
  fileCounter: 0
};

const app = document.querySelector('#app');
app.innerHTML = `
  <header>
    <div class="brand"><div class="brandmark">PDF</div><div><strong>PDF Studio</strong><span>Keep your data private</span></div></div>
  </header>
  <main>
    <section class="hero" id="hero">
      <input id="fileInput" type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/png,image/jpeg,image/webp" multiple hidden>
      <div class="upload-icon">PDF</div>
      <h1>Organise your PDF</h1>
      <p>Your files stay on this computer. No upload, account, or internet connection.</p>
      <button class="primary" id="chooseFiles">Choose files</button>
      <small>PDF, DOCX, PNG, JPG, or WebP files — or drop them here</small>
    </section>

    <section class="workspace hidden" id="workspace">
      <div class="files-row">
        <div><h2>Pages</h2><p id="summary">0 pages</p></div>
        <div class="file-actions"><button class="ghost" id="selectAllPages">Select all</button><button class="primary" id="downloadPdf">Download</button><button class="ghost" id="addFiles">Add files</button><button class="ghost" id="clearFiles">Clear all</button></div>
      </div>
      <div class="toolbar">
        <button data-action="merge">Merge selected</button><button data-action="split">Split selected</button><button data-action="rotate-left">Rotate left</button><button data-action="rotate-right">Rotate right</button>
        <button data-action="duplicate">Duplicate</button><button data-action="extract">Extract</button><button data-action="blank">Insert blank</button><button data-action="delete" class="danger">Delete</button><button data-action="crop">Crop</button>
        <button id="editPageButton">Edit page</button><button id="fillForm">Fill forms</button>
        <button id="pdfToImages">PDF to images</button><button id="pdfToText">PDF to text</button>
        <button id="compressPdf">Compress</button><button id="editDetails">Edit details</button><button id="removeDetails">Remove details</button><button id="comparePdf">Compare PDFs</button>
      </div>
      <div id="pages" class="pages"></div>
    </section>
    <section id="importProgress" class="import-progress hidden" aria-live="polite" aria-busy="true">
      <div class="import-progress-heading">
        <div class="import-heading-copy"><span class="import-kicker">PDF STUDIO · LOCAL IMPORT</span><strong>Review upload order</strong><span>Files import one at a time in this order</span></div>
        <span id="importCount" class="import-count">0 / 0</span>
      </div>
      <div id="importFiles" class="import-files"></div>
      <button id="startImport" class="primary import-start">Start import</button>
    </section>
    <section id="downloadProgress" class="download-progress hidden" aria-live="polite">
      <div class="download-progress-heading">
        <div class="download-progress-copy"><span class="import-kicker">PDF STUDIO · DOWNLOAD</span><strong id="downloadProgressTitle">Preparing download</strong><span id="downloadProgressDetail"></span></div>
        <span id="downloadProgressValue" class="download-progress-value">Preparing</span>
      </div>
      <div id="downloadProgressTrack" class="download-progress-track" role="progressbar" aria-label="Download preparation progress" aria-valuemin="0" aria-valuemax="100" aria-valuetext="Preparing download">
        <span id="downloadProgressFill" class="download-progress-fill is-indeterminate"></span>
      </div>
    </section>
  </main>
  <input id="imagePdfInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden>
  <input id="comparePdfInput" type="file" accept="application/pdf,.pdf" hidden>
  <div id="toast" class="toast"></div>
  <dialog id="compressDialog" class="compress-dialog"><div class="compress-panel"><h3>Compress PDF</h3><div class="compress-sizes"><div><span>Original size</span><strong id="compressOriginalSize">0 MB</strong></div><div><span>Recommended size</span><strong id="compressRecommendedSize">0 MB</strong></div></div><div class="compression-result" id="compressionResult" hidden><span>Compressed size</span><strong id="compressResultSize">0 MB</strong><small id="compressSaving"></small></div><label>Target size (MB)<input id="compressTargetSize" type="number" min="0.1" step="0.1"></label><small>PDF Studio will optimize objects and metadata before download.</small><div class="dialog-actions"><button id="cancelCompress" class="ghost">Cancel</button><button id="applyCompress" class="primary">Compress PDF</button></div></div></dialog>
  <dialog id="detailsDialog" class="details-dialog"><div class="details-panel"><h3>Edit PDF details</h3><label>Title<input id="detailTitle"></label><label>Author<input id="detailAuthor"></label><label>Subject<input id="detailSubject"></label><label>Keywords<input id="detailKeywords"></label><div class="dialog-actions"><button id="cancelDetails" class="ghost">Cancel</button><button id="applyDetails" class="primary">Apply details</button></div></div></dialog>
  <dialog id="compareDialog" class="compare-dialog"><div class="compare-panel"><h3>PDF comparison</h3><div id="compareSummary"></div><div class="compare-columns"><textarea id="compareOriginal" readonly></textarea><textarea id="compareChanged" readonly></textarea></div><div class="dialog-actions"><button id="closeCompare" class="primary">Close</button></div></div></dialog>
  <dialog id="editorDialog" class="editor-dialog">
    <div class="editor-layout">
      <aside class="editor-tools">
        <strong>Edit tools</strong>
        <button id="selectTool" class="active">Select</button>
        <button data-edit-tool="text">Edit text</button><button data-edit-tool="image">Add image</button><button data-edit-tool="highlight">Highlight</button>
        <button data-edit-tool="draw">Draw</button><button data-edit-tool="shape">Shape</button><button data-edit-tool="whiteout">Whiteout</button><button data-edit-tool="redact">Redact</button>
        <button data-edit-tool="sign">Sign</button>
        <button id="openStampMenu" class="stamp-button">Stamp</button>
        <label class="tool-option">Shape<select id="shapeType"><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="line">Line</option><option value="triangle">Triangle</option><option value="arrow">Arrow</option><option value="freehand">Freehand</option></select></label>
        <label class="tool-option">Text size<input id="textSize" type="number" min="6" max="72" value="18"></label>
        <label class="tool-option">Font<select id="textFont"><option>Helvetica</option><option>Times Roman</option><option>Courier</option></select></label>
        <label class="tool-option">Spacing<input id="textSpacing" type="number" min="0" max="30" value="0"></label>
        <label class="tool-option">Alignment<select id="textAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label class="tool-option">Brush size<input id="brushSize" type="range" min="1" max="20" value="3"></label>
        <label class="color-label">Colour <input id="editColor" type="color" value="#ed2020"></label>
        <div class="history-controls"><button id="undoEdit" class="ghost">Undo</button><button id="redoEdit" class="ghost">Redo</button></div>
        <div class="page-nav"><button id="previousEditorPage">Previous</button><span id="editorPageLabel"></span><button id="nextEditorPage">Next</button></div>
        <button id="deleteSelectedObject" class="danger ghost">Delete selected</button><button id="saveEdit" class="primary">Save</button><button id="closeEditor" class="ghost">Close</button>
      </aside>
      <div class="editor-stage"><div id="canvasContextBar" class="canvas-context-bar"><button data-format="bold"><strong>B</strong></button><button data-format="italic"><em>I</em></button><button data-format="left">Left</button><button data-format="center">Center</button><button data-format="right">Right</button></div><div id="editorCanvasWrap"><canvas id="editorCanvas"></canvas><canvas id="editorOverlay"></canvas><div id="textEditor" contenteditable="true" role="textbox" aria-label="Edit PDF text" hidden></div></div></div>
    </div>
    <input id="editorImage" type="file" accept="image/png,image/jpeg" hidden>
  </dialog>
  <dialog id="signDialog" class="sign-dialog"><div class="sign-panel"><h3>Add signature</h3><div class="sign-tabs"><button id="drawSignatureTab" class="active">Draw</button><button id="uploadSignatureTab">Upload image</button></div><canvas id="signatureCanvas" width="560" height="220"></canvas><input id="signatureImage" type="file" accept="image/png,image/jpeg" hidden><div class="dialog-actions"><button id="clearSignature" class="ghost">Clear</button><button id="cancelSignature" class="ghost">Cancel</button><button id="useSignature" class="primary">Use signature</button></div></div></dialog>
  <dialog id="stampDialog" class="stamp-dialog"><div class="stamp-panel">
    <h3 id="stampDialogTitle">Add stamp</h3><label>Type<select id="stampKind"><option value="watermark">Watermark</option><option value="pageNumber">Page number</option><option value="header">Header</option><option value="footer">Footer</option><option value="date">Date stamp</option></select></label>
    <label id="stampTextRow">Text<input id="stampText" value="CONFIDENTIAL"></label><label>Placement<select id="stampPlacement"><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
    <div class="stamp-grid"><label>Font<select id="stampFont"><option>Helvetica</option><option>Times Roman</option><option>Courier</option></select></label><label>Colour<input id="stampColor" type="color" value="#111111"></label><label>Size<input id="stampSize" type="number" min="6" max="72" value="42"></label><label>Opacity<input id="stampOpacity" type="number" min="10" max="100" value="25"></label><label>Rotation<input id="stampRotation" type="number" min="-360" max="360" value="45"></label><label>Pages<select id="stampScope"><option value="current">Current page only</option><option value="all">Apply to all pages</option></select></label></div>
    <div class="dialog-actions"><button id="cancelStamp" class="ghost">Cancel</button><button id="applyStamp" class="primary">Add stamp</button></div>
  </div></dialog>
  <dialog id="saveOptionsDialog" class="save-options-dialog"><div class="save-options-panel"><h3>Save changes</h3><p>Choose how you want to apply your edits.</p><div class="save-options-actions"><button id="saveCurrentPage" class="primary">Save</button><button id="saveAllPages" class="primary">Apply changes to all pages and save</button></div></div></dialog>
  <dialog id="formDialog"><form class="form-panel"><h3>Fill PDF form</h3><div id="formFields"></div><div class="dialog-actions"><button id="closeForm" type="button" class="ghost">Cancel</button><button id="saveForm" type="button" class="primary">Save filled PDF</button></div></form></dialog>
  <dialog id="cropDialog"><form method="dialog" class="crop-form">
    <h3>Crop selected pages</h3><p>Enter the amount to remove from each edge.</p>
    <div class="crop-grid"><label>Top (%) <input id="cropTop" type="number" min="0" max="45" value="0"></label><label>Right (%) <input id="cropRight" type="number" min="0" max="45" value="0"></label><label>Bottom (%) <input id="cropBottom" type="number" min="0" max="45" value="0"></label><label>Left (%) <input id="cropLeft" type="number" min="0" max="45" value="0"></label></div>
    <div class="dialog-actions"><button value="cancel" class="ghost">Cancel</button><button id="applyCrop" value="default" class="primary">Apply crop</button></div>
  </form></dialog>
`;

const fileInput = document.querySelector('#fileInput');
const hero = document.querySelector('#hero');
const workspace = document.querySelector('#workspace');
const pagesElement = document.querySelector('#pages');
const importProgress = document.querySelector('#importProgress');
const importFilesElement = document.querySelector('#importFiles');
const importCount = document.querySelector('#importCount');
const startImportButton = document.querySelector('#startImport');
const downloadProgress = document.querySelector('#downloadProgress');
const downloadProgressTitle = document.querySelector('#downloadProgressTitle');
const downloadProgressDetail = document.querySelector('#downloadProgressDetail');
const downloadProgressValue = document.querySelector('#downloadProgressValue');
const downloadProgressTrack = document.querySelector('#downloadProgressTrack');
const downloadProgressFill = document.querySelector('#downloadProgressFill');
let importQueue = [];
let importTask = Promise.resolve();
let startImport;
let downloadHideTimer;

function queueFiles(files) {
  const selection = Array.from(files);
  const nextImport = importTask.then(
    () => loadFiles(selection),
    () => loadFiles(selection)
  );
  importTask = nextImport.catch(error => {
    console.error('Could not import the selected files.', error);
    showToast('Could not import the selected files.');
  });
  return importTask;
}

function animateImportPanel() {
  const gsap = window.gsap;
  if (!gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(importProgress, { autoAlpha: 0, y: 22, scale: 0.97 }, {
    autoAlpha: 1, y: 0, scale: 1, duration: 0.42, ease: 'power3.out'
  });
  gsap.fromTo(importFilesElement.children, { autoAlpha: 0, x: 16 }, {
    autoAlpha: 1, x: 0, duration: 0.32, stagger: 0.07, delay: 0.12, ease: 'power2.out'
  });
}

function renderImportQueue(files) {
  importQueue = [...files].map(file => ({
    file,
    name: file.name,
    status: 'waiting',
    detail: 'Waiting in selection order',
    percent: 0
  }));
  importCount.textContent = `0 / ${importQueue.length}`;
  importFilesElement.innerHTML = importQueue.map((file, index) => {
    const extension = file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE';
    return `<article class="import-file" data-import-file="${index}">
      <span class="import-file-icon">${escapeHtml(extension)}</span>
      <div class="import-file-content">
        <div class="import-file-label"><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><span data-import-percent>Queued</span></div>
        <div class="import-file-track"><span class="import-file-fill" data-import-fill></span></div>
        <span class="import-file-detail" data-import-detail>${file.detail}</span>
      </div>
      <div class="import-file-actions">
        <button type="button" class="import-order-button" data-move-import="-1" aria-label="Move ${escapeHtml(file.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="import-order-button" data-move-import="1" aria-label="Move ${escapeHtml(file.name)} down" ${index === importQueue.length - 1 ? 'disabled' : ''}>↓</button>
        <span class="import-file-state" data-import-state aria-hidden="true"></span>
      </div>
    </article>`;
  }).join('');
  importProgress.classList.remove('hidden');
  animateImportPanel();
}

function moveImportFile(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= importQueue.length) return;
  [importQueue[index], importQueue[nextIndex]] = [importQueue[nextIndex], importQueue[index]];
  const row = importFilesElement.children[index];
  const nextRow = importFilesElement.children[nextIndex];
  if (direction < 0) importFilesElement.insertBefore(row, nextRow);
  else importFilesElement.insertBefore(nextRow, row);
  [...importFilesElement.children].forEach((item, position) => {
    item.dataset.importFile = position;
    item.querySelector('[data-move-import="-1"]').disabled = position === 0;
    item.querySelector('[data-move-import="1"]').disabled = position === importQueue.length - 1;
  });
}

function updateImportFile(index, status, detail, percent = null) {
  const file = importQueue[index];
  if (!file) return;
  file.status = status;
  file.detail = detail;
  if (percent !== null) file.percent = Math.min(100, Math.max(0, percent));

  const row = importFilesElement.querySelector(`[data-import-file="${index}"]`);
  if (!row) return;
  row.dataset.state = status;
  row.querySelector('[data-import-detail]').textContent = detail;
  row.querySelector('[data-import-percent]').textContent =
    status === 'complete' ? '100%' : status === 'error' ? 'Failed' :
      status === 'uploading' && percent !== null ? `${file.percent}%` :
        status === 'converting' ? 'Converting' : status === 'processing' ? 'Preparing' : 'Queued';
  row.querySelector('[data-import-state]').textContent =
    status === 'complete' ? '✓' : status === 'error' ? '!' : '';

  const fill = row.querySelector('[data-import-fill]');
  fill.classList.toggle('is-indeterminate', ['processing', 'converting'].includes(status));
  fill.classList.toggle('is-converting', status === 'converting');
  const progressWidth = status === 'complete' ? 100 :
    status === 'uploading' && percent !== null ? file.percent :
      ['processing', 'converting'].includes(status) ? 34 : 0;
  const gsap = window.gsap;
  if (gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.to(fill, { width: `${progressWidth}%`, duration: 0.35, ease: 'power2.out' });
  } else {
    fill.style.width = `${progressWidth}%`;
  }
  const completed = importQueue.filter(item => ['complete', 'error'].includes(item.status)).length;
  importCount.textContent = `${completed} / ${importQueue.length}`;
}

function hideImportProgress() {
  importProgress.setAttribute('aria-busy', 'false');
  const gsap = window.gsap;
  if (gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.to(importProgress, {
      autoAlpha: 0,
      y: 14,
      duration: 0.22,
      onComplete: () => importProgress.classList.add('hidden')
    });
  } else {
    importProgress.classList.add('hidden');
  }
}

function showToast(message, duration = 2400) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

async function loadFiles(files) {
  const selectedInOrder = Array.from(files);
  const supportedFiles = selectedInOrder.filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name) || /\.docx$/i.test(file.name) || /^image\/(?:png|jpeg|jpg|webp)$/i.test(file.type));
  if (!supportedFiles.length) return showToast('Choose PDF, DOCX, PNG, JPG, or WebP files');
  renderImportQueue(supportedFiles);
  importProgress.setAttribute('aria-busy', 'false');
  await new Promise(resolve => {
    startImport = resolve;
  });
  importProgress.setAttribute('aria-busy', 'true');
  startImportButton.disabled = true;
  startImportButton.textContent = 'Importing files…';
  importFilesElement.querySelectorAll('.import-order-button').forEach(button => { button.disabled = true; });
  try {
    for (const [fileIndex, queuedFile] of importQueue.entries()) {
      const file = queuedFile.file;
      try {
        updateImportFile(fileIndex, 'processing', 'Reading locally', null);
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
          const bytes = await file.arrayBuffer();
          const pdf = await PDFDocument.load(bytes.slice(0));
          const sourceId = ++state.fileCounter;
          state.documents.push({ id: sourceId, name: file.name, bytes: bytes.slice(0), pdf });
          for (let index = 0; index < pdf.getPageCount(); index++) state.pages.push({ id: crypto.randomUUID(), sourceId, sourceIndex: index, rotation: 0 });
        } else if (/\.docx$/i.test(file.name)) {
          const originalBytes = await file.arrayBuffer();
          const bytes = await docxFileToPdf(originalBytes, file.name, fileIndex);
          const pdf = await PDFDocument.load(bytes.slice(0));
          const sourceId = ++state.fileCounter;
          state.documents.push({ id: sourceId, name: file.name, bytes: bytes.slice(0), pdf, originalDocxBytes: originalBytes });
          for (let index = 0; index < pdf.getPageCount(); index++) state.pages.push({ id: crypto.randomUUID(), sourceId, sourceIndex: index, rotation: 0 });
        } else {
          const imageDataUrl = await imageFileToDataUrl(file);
          const imageBytes = await fetch(imageDataUrl).then(response => response.arrayBuffer());
          const output = await PDFDocument.create();
          const image = imageDataUrl.startsWith('data:image/png') ? await output.embedPng(imageBytes) : await output.embedJpg(imageBytes);
          const page = output.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
          const bytes = await output.save();
          const sourceId = ++state.fileCounter;
          const pdf = await PDFDocument.load(bytes.slice(0));
          state.documents.push({ id: sourceId, name: file.name, bytes: bytes.slice(0), pdf });
          state.pages.push({ id: crypto.randomUUID(), sourceId, sourceIndex: 0, rotation: 0 });
        }
        updateImportFile(fileIndex, 'complete', 'Ready', 100);
      } catch (error) {
        updateImportFile(fileIndex, 'error', 'Could not import', 100);
        const message = `Could not open ${file.name}: ${error instanceof Error ? error.message : 'unsupported or invalid file'}`;
        showToast(message, /\.docx$/i.test(file.name) ? 6000 : 2400);
        console.error(error);
      }
    }
  } finally {
    hideImportProgress();
    startImportButton.disabled = false;
    startImportButton.textContent = 'Start import';
    startImport = null;
  }
  if (!state.pages.length) return;
  hero.classList.add('hidden');
  workspace.classList.remove('hidden');
  renderPages();
}

async function docxFileToPdf(originalBytes, fileName, fileIndex) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/docx-to-pdf');
    request.responseType = 'arraybuffer';
    request.setRequestHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    updateImportFile(fileIndex, 'uploading', 'Uploading', 0);
    request.upload.addEventListener('progress', event => {
      if (!event.lengthComputable) {
        updateImportFile(fileIndex, 'uploading', 'Uploading', 0);
        return;
      }
      updateImportFile(fileIndex, 'uploading', 'Uploading', Math.round(event.loaded / event.total * 100));
    });
    request.upload.addEventListener('load', () => {
      updateImportFile(fileIndex, 'converting', 'Converting locally');
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(request.response);
        return;
      }
      let message = request.status === 404
        ? 'DOCX conversion service is unavailable. Restart the PDF Studio server with npm run dev.'
        : `DOCX conversion failed (HTTP ${request.status}).`;
      try {
        const response = JSON.parse(new TextDecoder().decode(request.response));
        if (response.error) message = response.error;
      } catch (error) {
        console.error('Could not read the DOCX conversion error response.', error);
      }
      reject(new Error(message));
    });
    request.addEventListener('error', () => reject(new Error('Could not connect to the local DOCX conversion service.')));
    request.addEventListener('abort', () => reject(new Error('DOCX conversion was cancelled.')));
    request.send(originalBytes);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function renderThumbnail(page) {
  const source = state.documents.find(document => document.id === page.sourceId);
  const loadingTask = pdfjsLib.getDocument({ data: source.bytes.slice(0) });
  const pdf = await loadingTask.promise;
  const pdfPage = await pdf.getPage(page.sourceIndex + 1);
  const viewport = pdfPage.getViewport({ scale: 0.34, rotation: page.rotation });
  const canvas = document.querySelector(`[data-thumbnail="${page.id}"]`);
  if (!canvas) return;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
}

function renderPages() {
  pagesElement.innerHTML = state.pages.map((page, position) => {
    const source = state.documents.find(document => document.id === page.sourceId);
    const selected = state.selected.has(page.id) ? ' selected' : '';
    return `<article class="page-card${selected}" draggable="true" data-page-id="${page.id}" data-source-page="${page.sourceIndex + 1}">
      <button class="select-check" aria-label="${state.selected.has(page.id) ? 'Deselect' : 'Select'} page ${page.sourceIndex + 1}" aria-pressed="${state.selected.has(page.id)}">${state.selected.has(page.id) ? '✓' : ''}</button>
      <span class="page-order">${position + 1}</span>
      <canvas data-thumbnail="${page.id}"></canvas>
      <div class="page-meta"><strong>Page ${page.sourceIndex + 1}</strong><span>${source.name}</span></div>
    </article>`;
  }).join('');
  document.querySelector('#summary').textContent = `${state.pages.length} pages · ${state.documents.length} files`;
  state.pages.forEach(renderThumbnail);
  bindPageEvents();
  updatePageSelectionUI();
}

function bindPageEvents() {
  pagesElement.querySelectorAll('.page-card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.classList.contains('select-check')) toggleSelection(card.dataset.pageId);
      else if (event.ctrlKey || event.metaKey) toggleSelection(card.dataset.pageId);
    });
    card.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', card.dataset.pageId);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', event => event.preventDefault());
    card.addEventListener('drop', event => {
      event.preventDefault();
      const fromId = event.dataTransfer.getData('text/plain');
      const toId = card.dataset.pageId;
      const from = state.pages.findIndex(page => page.id === fromId);
      const to = state.pages.findIndex(page => page.id === toId);
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = state.pages.splice(from, 1);
        state.pages.splice(to, 0, moved);
        renderPages();
      }
    });
  });
}

function toggleSelection(id) {
  state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  updatePageSelectionUI();
}

function updatePageSelectionUI() {
  pagesElement.querySelectorAll('.page-card').forEach(card => {
    const selected = state.selected.has(card.dataset.pageId);
    card.classList.toggle('selected', selected);
    const checkbox = card.querySelector('.select-check');
    if (checkbox) {
      checkbox.textContent = selected ? '✓' : '';
      checkbox.setAttribute('aria-pressed', String(selected));
      checkbox.setAttribute('aria-label', `${selected ? 'Deselect' : 'Select'} page ${card.dataset.sourcePage}`);
    }
  });
  const allSelected = state.pages.length > 0 && state.pages.every(page => state.selected.has(page.id));
  const selectAllButton = document.querySelector('#selectAllPages');
  selectAllButton.textContent = allSelected ? 'Clear selection' : 'Select all';
  selectAllButton.setAttribute('aria-pressed', String(allSelected));
}

function selectedPages() {
  const pages = state.pages.filter(page => state.selected.has(page.id));
  return pages.length ? pages : [];
}

async function newPdfFromPages(pagesToCopy, crop, onPageCopied) {
  const output = await PDFDocument.create();
  const cache = new Map();
  for (const [index, page] of pagesToCopy.entries()) {
    let source = cache.get(page.sourceId);
    if (!source) {
      const document = state.documents.find(item => item.id === page.sourceId);
      source = await PDFDocument.load(document.bytes.slice(0));
      cache.set(page.sourceId, source);
    }
    const [copied] = await output.copyPages(source, [page.sourceIndex]);
    copied.setRotation(degrees((copied.getRotation().angle + page.rotation) % 360));
    output.addPage(copied);
    onPageCopied?.(index + 1, pagesToCopy.length);
  }
  if (crop) {
    output.getPages().forEach(page => {
      const box = page.getCropBox();
      const width = box.width;
      const height = box.height;
      const left = width * crop.left / 100;
      const right = width * crop.right / 100;
      const top = height * crop.top / 100;
      const bottom = height * crop.bottom / 100;
      page.setCropBox(box.x + left, box.y + bottom, width - left - right, height - top - bottom);
    });
  }
  return output;
}

function showDownloadProgress(name) {
  clearTimeout(downloadHideTimer);
  downloadProgressTitle.textContent = 'Preparing download';
  downloadProgressDetail.textContent = `${name} is being prepared on this device`;
  downloadProgressValue.textContent = 'Preparing';
  downloadProgressTrack.removeAttribute('aria-valuenow');
  downloadProgressTrack.setAttribute('aria-valuetext', 'Preparing download');
  downloadProgressFill.classList.add('is-indeterminate');
  downloadProgressFill.style.width = '';
  downloadProgress.classList.remove('hidden');
}

function updateDownloadPageProgress(name, completedPages, totalPages) {
  const percent = Math.round(completedPages / totalPages * 100);
  downloadProgressDetail.textContent = `Preparing ${name} · page ${completedPages} of ${totalPages}`;
  downloadProgressValue.textContent = `${percent}%`;
  downloadProgressTrack.setAttribute('aria-valuenow', String(percent));
  downloadProgressTrack.setAttribute('aria-valuetext', `${completedPages} of ${totalPages} pages prepared`);
  downloadProgressFill.classList.remove('is-indeterminate');
  downloadProgressFill.style.width = `${percent}%`;
}

function finalizeDownloadProgress(name) {
  downloadProgressDetail.textContent = `${name} is being finalized on this device`;
  downloadProgressValue.textContent = 'Finalizing';
  downloadProgressTrack.removeAttribute('aria-valuenow');
  downloadProgressTrack.setAttribute('aria-valuetext', 'Finalizing download');
  downloadProgressFill.classList.add('is-indeterminate');
  downloadProgressFill.style.width = '';
}

function completeDownloadProgress(name) {
  downloadProgressTitle.textContent = 'Download started';
  downloadProgressDetail.textContent = `${name} was handed to your browser`;
  downloadProgressValue.textContent = 'Ready';
  downloadProgressTrack.setAttribute('aria-valuenow', '100');
  downloadProgressTrack.setAttribute('aria-valuetext', 'Download started');
  downloadProgressFill.classList.remove('is-indeterminate');
  downloadProgressFill.style.width = '100%';
  downloadHideTimer = setTimeout(() => downloadProgress.classList.add('hidden'), 2200);
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPdf(output, name, progressStarted = false) {
  if (progressStarted) finalizeDownloadProgress(name);
  else showDownloadProgress(name);
  try {
    const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
    triggerDownload(new Blob([bytes], { type: 'application/pdf' }), name);
    completeDownloadProgress(name);
  } catch (error) {
    clearTimeout(downloadHideTimer);
    downloadProgress.classList.add('hidden');
    const message = error instanceof Error ? error.message : 'Unknown error';
    showToast(`Could not prepare ${name}: ${message}`, 6000);
    console.error(error);
    throw error;
  }
}

function downloadBlob(blob, name) {
  showDownloadProgress(name);
  triggerDownload(blob, name);
  completeDownloadProgress(name);
}

function selectedSource() {
  const chosen = selectedPages()[0];
  return chosen ? state.documents.find(document => document.id === chosen.sourceId) : null;
}

async function imageFileToDataUrl(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
  const image = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', .92);
}

async function pdfText(source) {
  const pdf = await pdfjsLib.getDocument({ data: source.bytes.slice(0) }).promise;
  const parts = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    parts.push(`--- Page ${pageNumber} ---\n${content.items.map(item => item.str).join(' ')}`);
  }
  return parts.join('\n\n');
}

async function act(action) {
  const chosen = selectedPages();
  if (!chosen.length && !['blank'].includes(action)) return showToast('Select one or more pages first');

  if (action === 'rotate-left' || action === 'rotate-right') {
    chosen.forEach(page => page.rotation = (page.rotation + (action === 'rotate-right' ? 90 : 270)) % 360);
    renderPages();
  } else if (action === 'delete') {
    const ids = new Set(chosen.map(page => page.id));
    state.pages = state.pages.filter(page => !ids.has(page.id));
    state.selected.clear(); renderPages(); showToast('Pages deleted');
  } else if (action === 'duplicate') {
    const copies = chosen.map(page => ({ ...page, id: crypto.randomUUID() }));
    state.pages.splice(state.pages.findIndex(page => page.id === chosen[chosen.length - 1].id) + 1, 0, ...copies);
    renderPages(); showToast('Pages duplicated');
  } else if (action === 'blank') {
    const output = await PDFDocument.create();
    output.addPage([595.28, 841.89]);
    const blob = await output.save();
    const newPage = state.pages.find(page => page.id === [...state.selected][0]);
    const blankId = crypto.randomUUID();
    const sourceId = ++state.fileCounter;
    state.documents.push({ id: sourceId, name: 'blank.pdf', bytes: blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength), pdf: output });
    const position = newPage ? state.pages.indexOf(newPage) + 1 : state.pages.length;
    state.pages.splice(position, 0, { id: blankId, sourceId, sourceIndex: 0, rotation: 0 });
    renderPages(); showToast('Blank page inserted');
  } else if (action === 'merge') {
    const output = await newPdfFromPages(state.pages.filter(page => state.selected.has(page.id)));
    await downloadPdf(output, 'pdf-studio-merged.pdf'); showToast('Merged PDF downloaded');
  } else if (action === 'extract') {
    const output = await newPdfFromPages(chosen);
    await downloadPdf(output, 'pdf-studio-extracted.pdf'); showToast('Extracted PDF downloaded');
  } else if (action === 'split') {
    for (let index = 0; index < chosen.length; index++) {
      const output = await newPdfFromPages([chosen[index]]);
      await downloadPdf(output, `page-${index + 1}.pdf`);
    }
    showToast(chosen.length === 1 ? 'Page downloaded' : `${chosen.length} pages downloaded separately`);
  }
}

document.querySelector('#chooseFiles').addEventListener('click', () => fileInput.click());
document.querySelector('#addFiles')?.addEventListener('click', () => fileInput.click());
startImportButton.addEventListener('click', () => startImport?.());
importFilesElement.addEventListener('click', event => {
  const button = event.target.closest('[data-move-import]');
  if (!button || importProgress.getAttribute('aria-busy') === 'true') return;
  moveImportFile(Number(button.closest('[data-import-file]').dataset.importFile), Number(button.dataset.moveImport));
});
document.querySelector('#selectAllPages').addEventListener('click', () => {
  const allSelected = state.pages.length > 0 && state.pages.every(page => state.selected.has(page.id));
  state.selected = allSelected ? new Set() : new Set(state.pages.map(page => page.id));
  updatePageSelectionUI();
  showToast(allSelected ? 'Selection cleared' : 'All pages selected');
});
document.querySelector('#downloadPdf').addEventListener('click', async () => {
  const pagesToDownload = selectedPages().length ? selectedPages() : state.pages;
  if (!pagesToDownload.length) return showToast('Add a PDF or images first');
  const name = 'pdf-studio-download.pdf';
  showDownloadProgress(name);
  try {
    const output = await newPdfFromPages(pagesToDownload, undefined, (completed, total) => {
      updateDownloadPageProgress(name, completed, total);
    });
    await downloadPdf(output, name, true);
    showToast('PDF downloaded');
  } catch (error) {
    if (!downloadProgress.classList.contains('hidden')) {
      clearTimeout(downloadHideTimer);
      downloadProgress.classList.add('hidden');
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Could not prepare ${name}: ${message}`, 6000);
      console.error(error);
    }
  }
});
document.querySelector('#clearFiles').addEventListener('click', () => {
  state.documents = []; state.pages = []; state.selected.clear(); state.fileCounter = 0;
  workspace.classList.add('hidden'); hero.classList.remove('hidden');
});
fileInput.addEventListener('change', () => { queueFiles(fileInput.files); fileInput.value = ''; });
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => act(button.dataset.action)));

const imagePdfInput = document.querySelector('#imagePdfInput');
imagePdfInput.addEventListener('change', async () => {
  const files = [...imagePdfInput.files];
  if (!files.length) return;
  const output = await PDFDocument.create();
  for (const file of files) {
    const dataUrl = await imageFileToDataUrl(file);
    const bytes = await fetch(dataUrl).then(response => response.arrayBuffer());
    const image = dataUrl.startsWith('data:image/png') ? await output.embedPng(bytes) : await output.embedJpg(bytes);
    const page = output.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  await downloadPdf(output, 'images-to-pdf.pdf'); imagePdfInput.value = ''; showToast('Images converted to PDF');
});

document.querySelector('#pdfToText').addEventListener('click', async () => {
  const source = selectedSource(); if (!source) return showToast('Select a page first');
  const text = await pdfText(source);
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), source.name.replace(/\.pdf$/i, '') + '-text.txt');
  showToast('PDF text downloaded');
});

document.querySelector('#pdfToImages').addEventListener('click', async () => {
  const source = selectedSource(); if (!source) return showToast('Select a page first');
  const pdf = await pdfjsLib.getDocument({ data: source.bytes.slice(0) }).promise;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    downloadBlob(await new Promise(resolve => canvas.toBlob(resolve, 'image/png')), `${source.name.replace(/\.pdf$/i, '')}-page-${pageNumber}.png`);
  }
  showToast(`${pdf.numPages} pages converted to images`);
});

async function sourcePdfFromSelection() {
  const source = selectedSource();
  if (!source) return null;
  return await PDFDocument.load(source.bytes.slice(0));
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const compressDialog = document.querySelector('#compressDialog');

async function flattenPdfForCompression(pdfBytes, targetBytes) {
  const renderedPdf = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const compressedPdf = await PDFDocument.create();
  const quality = Math.max(.28, Math.min(.72, targetBytes / Math.max(pdfBytes.byteLength, 1)));
  for (let pageIndex = 1; pageIndex <= renderedPdf.numPages; pageIndex++) {
    const renderedPage = await renderedPdf.getPage(pageIndex);
    const viewport = renderedPage.getViewport({ scale: quality < .4 ? 1 : 1.35 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await renderedPage.render({ canvasContext: context, viewport }).promise;
    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
    const jpegBytes = await fetch(jpegDataUrl).then(response => response.arrayBuffer());
    const jpeg = await compressedPdf.embedJpg(jpegBytes);
    const { width, height } = renderedPage.getViewport({ scale: 1 });
    const outputPage = compressedPdf.addPage([width, height]);
    outputPage.drawImage(jpeg, { x: 0, y: 0, width, height });
  }
  renderedPdf.destroy();
  return compressedPdf;
}

document.querySelector('#compressPdf').addEventListener('click', () => {
  const source = selectedSource(); if (!source) return showToast('Select a page first');
  const originalMb = source.bytes.byteLength / (1024 * 1024);
  const recommendedMb = Math.max(.1, originalMb * .65);
  document.querySelector('#compressOriginalSize').textContent = formatFileSize(source.bytes.byteLength);
  document.querySelector('#compressRecommendedSize').textContent = formatFileSize(Math.round(recommendedMb * 1024 * 1024));
  document.querySelector('#compressTargetSize').value = recommendedMb.toFixed(originalMb < 10 ? 1 : 0);
  document.querySelector('#compressionResult').hidden = true;
  compressDialog.showModal();
});
document.querySelector('#cancelCompress').addEventListener('click', () => compressDialog.close());
document.querySelector('#applyCompress').addEventListener('click', async () => {
  const source = selectedSource(); if (!source) return;
  const targetMb = Number(document.querySelector('#compressTargetSize').value);
  if (!Number.isFinite(targetMb) || targetMb <= 0) return showToast('Enter a valid target size');
  showToast('Compressing PDF locally…');
  const selectedPdf = await sourcePdfFromSelection();
  selectedPdf.setProducer('PDF Studio'); selectedPdf.setCreator('PDF Studio');
  const selectedBytes = await selectedPdf.save({ useObjectStreams: true });
  const targetBytes = Math.max(100_000, targetMb * 1024 * 1024);
  let compressed = await flattenPdfForCompression(selectedBytes, targetBytes);
  let bestBytes = await compressed.save({ useObjectStreams: true });
  if (bestBytes.byteLength >= selectedBytes.byteLength) {
    bestBytes = selectedBytes;
  }
  const actualBytes = bestBytes.byteLength;
  document.querySelector('#compressResultSize').textContent = formatFileSize(actualBytes);
  const savedPercent = Math.max(0, Math.round((1 - actualBytes / selectedBytes.byteLength) * 100));
  document.querySelector('#compressSaving').textContent = savedPercent ? `${savedPercent}% smaller` : 'File is already optimized';
  document.querySelector('#compressionResult').hidden = false;
  downloadBlob(new Blob([bestBytes], { type: 'application/pdf' }), source.name.replace(/\.pdf$/i, '') + '-compressed.pdf');
  showToast(`Compression complete: ${formatFileSize(selectedBytes.byteLength)} → ${formatFileSize(actualBytes)}`);
});

const detailsDialog = document.querySelector('#detailsDialog');
document.querySelector('#editDetails').addEventListener('click', () => {
  const source = selectedSource(); if (!source) return showToast('Select a page first');
  document.querySelector('#detailTitle').value = source.pdf.getTitle() || ''; document.querySelector('#detailAuthor').value = source.pdf.getAuthor() || '';
  document.querySelector('#detailSubject').value = source.pdf.getSubject() || ''; document.querySelector('#detailKeywords').value = source.pdf.getKeywords() || '';
  detailsDialog.showModal();
});
document.querySelector('#cancelDetails').addEventListener('click', () => detailsDialog.close());
document.querySelector('#applyDetails').addEventListener('click', async () => {
  const source = selectedSource(); if (!source) return;
  const output = await PDFDocument.load(source.bytes.slice(0));
  output.setTitle(document.querySelector('#detailTitle').value); output.setAuthor(document.querySelector('#detailAuthor').value);
  output.setSubject(document.querySelector('#detailSubject').value); output.setKeywords(document.querySelector('#detailKeywords').value.split(',').map(value => value.trim()).filter(Boolean));
  await downloadPdf(output, source.name.replace(/\.pdf$/i, '') + '-details.pdf'); detailsDialog.close(); showToast('PDF details updated');
});
document.querySelector('#removeDetails').addEventListener('click', async () => {
  const source = selectedSource(); if (!source) return showToast('Select a page first');
  const output = await PDFDocument.load(source.bytes.slice(0));
  output.setTitle(''); output.setAuthor(''); output.setSubject(''); output.setKeywords([]); output.setProducer(''); output.setCreator('');
  await downloadPdf(output, source.name.replace(/\.pdf$/i, '') + '-clean.pdf'); showToast('PDF details removed');
});

const compareDialog = document.querySelector('#compareDialog');
document.querySelector('#comparePdf').addEventListener('click', () => document.querySelector('#comparePdfInput').click());
document.querySelector('#comparePdfInput').addEventListener('change', async () => {
  const file = document.querySelector('#comparePdfInput').files[0]; const source = selectedSource();
  if (!file || !source) return showToast('Choose a PDF and select a page first');
  const second = await file.arrayBuffer(); const firstText = await pdfText(source);
  const secondSource = { bytes: new Uint8Array(second), name: file.name };
  const secondText = await pdfText(secondSource);
  const firstWords = firstText.split(/\s+/).filter(Boolean); const secondWords = secondText.split(/\s+/).filter(Boolean);
  const matching = secondWords.filter(word => firstWords.includes(word)).length;
  const similarity = secondWords.length ? Math.round(matching / Math.max(firstWords.length, secondWords.length) * 100) : 0;
  document.querySelector('#compareSummary').textContent = `Text similarity: ${similarity}% · ${source.name} and ${file.name}`;
  document.querySelector('#compareOriginal').value = firstText; document.querySelector('#compareChanged').value = secondText;
  compareDialog.showModal(); document.querySelector('#comparePdfInput').value = '';
});
document.querySelector('#closeCompare').addEventListener('click', () => compareDialog.close());

for (const target of [hero, document.body]) {
  target.addEventListener('dragover', event => { event.preventDefault(); hero.classList.add('dragover'); });
  target.addEventListener('dragleave', () => hero.classList.remove('dragover'));
}
document.body.addEventListener('drop', event => { event.preventDefault(); hero.classList.remove('dragover'); queueFiles(event.dataTransfer.files); });

const cropDialog = document.querySelector('#cropDialog');
document.querySelector('[data-action="crop"]').addEventListener('click', () => {
  if (!selectedPages().length) return showToast('Select pages to crop');
  cropDialog.showModal();
});
document.querySelector('#applyCrop').addEventListener('click', async event => {
  event.preventDefault();
  const crop = {
    top: Number(document.querySelector('#cropTop').value), right: Number(document.querySelector('#cropRight').value),
    bottom: Number(document.querySelector('#cropBottom').value), left: Number(document.querySelector('#cropLeft').value)
  };
  if (Object.values(crop).some(value => !Number.isFinite(value) || value < 0 || value > 45)) return showToast('Crop values must be between 0 and 45%');
  const output = await newPdfFromPages(selectedPages(), crop);
  cropDialog.close(); await downloadPdf(output, 'pdf-studio-cropped.pdf'); showToast('Cropped PDF downloaded');
});

const editorDialog = document.querySelector('#editorDialog');
const editorCanvas = document.querySelector('#editorCanvas');
const editorOverlay = document.querySelector('#editorOverlay');
let editorPage = null;
let editorTool = null;
let editorAnnotations = [];
let drawingStart = null;
let drawingPoints = [];
let editorTextRects = [];
let textEditorAnnotation = null;
let ocrWords = [];
let selectedAnnotation = null;
let annotationAction = null;
let annotationHistory = [];
let annotationRedo = [];
const pageAnnotations = new Map();
let editorPageIndex = 0;
let editingStamp = null;

function pointOnEditor(event) {
  const rect = editorOverlay.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

async function openEditor() {
  const chosen = selectedPages();
  if (chosen.length !== 1) return showToast('Select exactly one page to edit');
  editorPage = chosen[0];
  editorPageIndex = state.pages.findIndex(page => page.id === editorPage.id);
  editorAnnotations = pageAnnotations.get(editorPage.id) || [];
  editorDialog.showModal();
  await renderEditorPage();
}

async function renderEditorPage() {
  pageAnnotations.set(editorPage.id, editorAnnotations);
  const source = state.documents.find(document => document.id === editorPage.sourceId);
  const pdf = await pdfjsLib.getDocument({ data: source.bytes.slice(0) }).promise;
  const page = await pdf.getPage(editorPage.sourceIndex + 1);
  const viewport = page.getViewport({ scale: 1.25 });
  editorCanvas.width = editorOverlay.width = Math.ceil(viewport.width);
  editorCanvas.height = editorOverlay.height = Math.ceil(viewport.height);
  editorCanvas.style.width = editorOverlay.style.width = `${viewport.width}px`;
  editorCanvas.style.height = editorOverlay.style.height = `${viewport.height}px`;
  await page.render({ canvasContext: editorCanvas.getContext('2d'), viewport }).promise;
  document.querySelector('#editorPageLabel').textContent = `${editorPageIndex + 1} / ${state.pages.length}`;
  const textContent = await page.getTextContent();
  ocrWords = [];
  editorTextRects = textContent.items.filter(item => item.str?.trim()).map(item => {
    const point = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const transformScale = Math.hypot(item.transform[0], item.transform[1]) || viewport.scale;
    const width = Math.max(item.width || 0, (item.str || '').length * transformScale * .55) * viewport.scale;
    const height = Math.max(8, Math.abs(item.height || item.transform[3] || transformScale) * viewport.scale);
    return { x: point[0], y: point[1] - height, width, height: height * 1.15, text: item.str };
  });
  if (!editorTextRects.length) detectScannedTextAutomatically();
  redrawOverlay();
}

function pushHistory() {
  annotationHistory.push(JSON.stringify(editorAnnotations));
  if (annotationHistory.length > 50) annotationHistory.shift();
  annotationRedo = [];
}

function annotationBounds(annotation) {
  if (annotation.type === 'text') {
    const context = editorOverlay.getContext('2d'); context.font = `${annotation.size || 18}px Helvetica`;
    return { x: annotation.x, y: annotation.y - (annotation.size || 18), width: context.measureText(annotation.text).width || 20, height: annotation.size || 18 };
  }
  if (annotation.points?.length) {
    const xs = annotation.points.map(point => point.x), ys = annotation.points.map(point => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  if (annotation.type === 'stamp') {
    const context = editorOverlay.getContext('2d'); context.font = `${annotation.size || 18}px ${canvasFontName(annotation.font)}`;
    const width = context.measureText(resolveStampText(annotation)).width;
    return { x: annotation.x - width / 2, y: annotation.y - (annotation.size || 18) / 2, width, height: annotation.size || 18 };
  }
  return { x: annotation.x || 0, y: annotation.y || 0, width: annotation.width || 20, height: annotation.height || 20 };
}

function stampTransformPoint(annotation, x, y) {
  const angle = (annotation.rotation || 0) * Math.PI / 180;
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}

function pointInStamp(annotation, point) {
  const bounds = annotationBounds(annotation);
  const dx = point.x - annotation.x, dy = point.y - annotation.y;
  const angle = -(annotation.rotation || 0) * Math.PI / 180;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(localX) <= bounds.width / 2 + 14 && Math.abs(localY) <= bounds.height / 2 + 14;
}

function stampHandles(annotation) {
  const bounds = annotationBounds(annotation);
  const points = {
    nw: { x: -bounds.width / 2, y: -bounds.height / 2 }, ne: { x: bounds.width / 2, y: -bounds.height / 2 },
    sw: { x: -bounds.width / 2, y: bounds.height / 2 }, se: { x: bounds.width / 2, y: bounds.height / 2 }
  };
  Object.keys(points).forEach(key => Object.assign(points[key], stampTransformPoint(annotation, points[key].x, points[key].y)));
  Object.keys(points).forEach(key => { points[key].x += annotation.x; points[key].y += annotation.y; });
  points.rotate = stampTransformPoint(annotation, 0, -bounds.height / 2 - 28); points.rotate.x += annotation.x; points.rotate.y += annotation.y;
  return points;
}

function redrawOverlay() {
  const context = editorOverlay.getContext('2d');
  context.clearRect(0, 0, editorOverlay.width, editorOverlay.height);
  [...editorAnnotations].sort((a, b) => (a.type === 'whiteout' ? 0 : 1) - (b.type === 'whiteout' ? 0 : 1)).forEach(annotation => drawAnnotationPreview(context, annotation));
  if (selectedAnnotation && editorAnnotations.includes(selectedAnnotation)) {
    const bounds = annotationBounds(selectedAnnotation);
    context.save(); context.strokeStyle = '#1683ff'; context.lineWidth = 1;
    if (selectedAnnotation.type === 'stamp') {
      const handles = stampHandles(selectedAnnotation);
      context.translate(selectedAnnotation.x, selectedAnnotation.y); context.rotate((selectedAnnotation.rotation || 0) * Math.PI / 180);
      context.setLineDash([5, 3]); context.strokeRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height); context.setLineDash([]);
      context.beginPath(); context.moveTo(0, -bounds.height / 2); context.lineTo(0, -bounds.height / 2 - 28); context.stroke();
      context.restore(); context.save(); context.fillStyle = '#ffffff'; context.strokeStyle = '#1683ff';
      Object.values({ nw: handles.nw, ne: handles.ne, sw: handles.sw, se: handles.se }).forEach(handle => { context.fillRect(handle.x - 5, handle.y - 5, 10, 10); context.strokeRect(handle.x - 5, handle.y - 5, 10, 10); });
      context.beginPath(); context.arc(handles.rotate.x, handles.rotate.y, 7, 0, Math.PI * 2); context.fillStyle = '#1683ff'; context.fill(); context.stroke();
    } else {
      context.setLineDash([5, 3]); context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height); context.setLineDash([]);
      context.fillStyle = '#ffffff'; context.strokeStyle = '#1683ff';
      [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y], [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]].forEach(([x, y]) => { context.fillRect(x - 4, y - 4, 8, 8); context.strokeRect(x - 4, y - 4, 8, 8); });
    }
    context.restore();
  }
}

function drawAnnotationPreview(context, annotation) {
  const color = hexToRgb(annotation.color || '#ed2020');
  context.save(); context.strokeStyle = annotation.color || '#ed2020'; context.fillStyle = annotation.color || '#ed2020'; context.lineWidth = 3;
  if (annotation.type === 'highlight') { context.globalAlpha = .35; context.fillRect(annotation.x, annotation.y, annotation.width, annotation.height); }
  if (annotation.type === 'whiteout' || annotation.type === 'redact') { context.globalAlpha = 1; context.fillStyle = annotation.type === 'redact' ? '#111111' : '#ffffff'; context.fillRect(annotation.x, annotation.y, annotation.width, annotation.height); }
  if (annotation.type === 'shape') { drawShapePreview(context, annotation); }
  if (annotation.type === 'draw' && annotation.points.length > 1) { context.lineWidth = annotation.brushSize || 3; context.beginPath(); annotation.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke(); }
  if (annotation.type === 'text') { context.fillStyle = annotation.color || '#111111'; context.font = `${annotation.size || 18}px Helvetica`; context.fillText(annotation.text, annotation.x, annotation.y); }
  if (annotation.type === 'stamp') {
    context.save(); context.globalAlpha = annotation.opacity ?? 1; context.fillStyle = annotation.color || '#111111'; context.font = `${annotation.size || 18}px ${canvasFontName(annotation.font)}`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.translate(annotation.x, annotation.y); context.rotate((annotation.rotation || 0) * Math.PI / 180); context.fillText(resolveStampText(annotation), 0, 0); context.restore();
  }
  context.restore();
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
}

let movingText = null;

function beginInlineText(point, detectedRect, existingAnnotation) {
  const editor = document.querySelector('#textEditor');
  const size = Number(document.querySelector('#textSize').value);
  editor.hidden = false;
  editor.style.left = `${existingAnnotation?.x ?? detectedRect?.x ?? point.x}px`;
  editor.style.top = `${existingAnnotation?.y ?? detectedRect?.y ?? point.y - size}px`;
  editor.style.fontSize = `${existingAnnotation?.size ?? size}px`;
  editor.style.color = document.querySelector('#editColor').value;
  editor.textContent = existingAnnotation?.text ?? detectedRect?.text ?? '';
  textEditorAnnotation = existingAnnotation || null;
  editor.dataset.detectedX = detectedRect?.x ?? '';
  editor.dataset.detectedY = detectedRect?.y ?? '';
  editor.dataset.detectedWidth = detectedRect?.width ?? '';
  editor.dataset.detectedHeight = detectedRect?.height ?? '';
  requestAnimationFrame(() => {
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);

    if (detectedRect && point.x > detectedRect.x) {
      const ratio = Math.max(0, Math.min(1, (point.x - detectedRect.x) / detectedRect.width));
      const offset = Math.round((detectedRect.text || '').length * ratio);
      const textNode = editor.firstChild || editor.appendChild(document.createTextNode(editor.textContent));
      const caret = document.createRange();
      caret.setStart(textNode, Math.min(offset, textNode.length));
      caret.collapse(true);
      selection.removeAllRanges(); selection.addRange(caret);
    }
  });
}

function finishInlineText() {
  const editor = document.querySelector('#textEditor');
  if (editor.hidden) return;
  const text = editor.textContent;
  const detectedX = Number(editor.dataset.detectedX);
  const detectedY = Number(editor.dataset.detectedY);
  const detectedWidth = Number(editor.dataset.detectedWidth);
  const detectedHeight = Number(editor.dataset.detectedHeight);

  if (textEditorAnnotation) {
    textEditorAnnotation.text = text;
  } else if (text) {
    textEditorAnnotation = { type: 'text', x: parseFloat(editor.style.left), y: parseFloat(editor.style.top) + (Number(document.querySelector('#textSize').value)), text, color: document.querySelector('#editColor').value, size: Number(document.querySelector('#textSize').value) };
    editorAnnotations.push(textEditorAnnotation);
  }
  if (textEditorAnnotation) {
    textEditorAnnotation.text = text;
  }
  if (detectedWidth > 0 && detectedHeight > 0) {
    editorAnnotations.push({ type: 'whiteout', x: detectedX, y: detectedY, width: detectedWidth, height: detectedHeight, color: '#ffffff' });
  }
  if (textEditorAnnotation && !text) {
    editorAnnotations.splice(editorAnnotations.indexOf(textEditorAnnotation), 1);
  }
  editor.hidden = true;
  editor.textContent = '';
  textEditorAnnotation = null;
  redrawOverlay();
}

document.querySelector('#textEditor').addEventListener('blur', finishInlineText);
editorOverlay.addEventListener('dblclick', event => {
  const point = pointOnEditor(event);
  const stampHit = [...editorAnnotations].reverse().find(annotation => annotation.type === 'stamp' && pointInStamp(annotation, point));
  if (stampHit) { openStampEditor(stampHit); return; }
  const detectedText = editorTextRects.find(rect => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height);
  if (detectedText) {
    pushHistory(); beginInlineText(point, detectedText);
  }
});

document.querySelector('#textEditor').addEventListener('keydown', event => {
  if (event.key === 'Escape' || event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault(); event.currentTarget.blur();
  } else if (event.key === 'Delete' && event.shiftKey) {
    event.preventDefault(); event.currentTarget.textContent = ''; event.currentTarget.blur();
  }
});

editorOverlay.addEventListener('pointerdown', async event => {
  const point = pointOnEditor(event);
  editorOverlay.setPointerCapture(event.pointerId);

  const stampHit = [...editorAnnotations].reverse().find(annotation => {
    if (annotation.type !== 'stamp') return false;
    const handleHit = Object.values(stampHandles(annotation)).some(handle => Math.hypot(point.x - handle.x, point.y - handle.y) <= 16);
    return handleHit || pointInStamp(annotation, point);
  });
  if (stampHit) {
    selectedAnnotation = stampHit; editorTool = null;
    document.querySelectorAll('[data-edit-tool]').forEach(item => item.classList.remove('active'));
    document.querySelector('#selectTool').classList.add('active');
    const handles = stampHandles(stampHit);
    const handleHit = Object.entries(handles).find(([, handle]) => Math.hypot(point.x - handle.x, point.y - handle.y) <= 14);
    if (handleHit) {
      const rotationStartAngle = Math.atan2(point.y - stampHit.y, point.x - stampHit.x) * 180 / Math.PI;
      pushHistory(); annotationAction = { annotation: stampHit, start: point, original: annotationBounds(stampHit), mode: handleHit[0] === 'rotate' ? 'rotate' : 'resize', rotationStartAngle, rotationStart: stampHit.rotation || 0 }; redrawOverlay(); return;
    }
    pushHistory(); annotationAction = { annotation: stampHit, start: point, original: annotationBounds(stampHit) }; redrawOverlay(); return;
  }

  if (!editorTool) {
    const hit = [...editorAnnotations].reverse().find(annotation => {
      const bounds = annotationBounds(annotation);
      const padding = annotation.type === 'stamp' ? 12 : 0;
      return point.x >= bounds.x - padding && point.x <= bounds.x + bounds.width + padding && point.y >= bounds.y - padding && point.y <= bounds.y + bounds.height + padding;
    });
    selectedAnnotation = hit || null;
    if (hit) { pushHistory(); annotationAction = { annotation: hit, start: point, original: annotationBounds(hit) }; }
    redrawOverlay(); return;
  }

  if (editorTool === 'text') {
    const context = editorOverlay.getContext('2d');
    const addedText = [...editorAnnotations].reverse().find(annotation => {
      if (annotation.type !== 'text') return false;
      context.font = `${annotation.size || 18}px Helvetica`;
      const width = context.measureText(annotation.text).width;
      return point.x >= annotation.x - 4 && point.x <= annotation.x + width + 4 && point.y >= annotation.y - annotation.size && point.y <= annotation.y + 6;
    });
    if (addedText) {
      pushHistory(); beginInlineText({ x: addedText.x, y: addedText.y }, addedText, addedText);
      return;
    }
    const detectedText = editorTextRects.find(rect => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height);
    pushHistory(); beginInlineText(point, detectedText);
    return;
  }
  if (editorTool === 'sign') {
    state.pendingEditPoint = point;
    if (state.signatureDataUrl) editorAnnotations.push({ type: 'image', x: point.x, y: point.y, width: 180, height: 70, dataUrl: state.signatureDataUrl });
    else document.querySelector('#signDialog').showModal();
    redrawOverlay();
    return;
  }
  pushHistory();
  drawingStart = point;
  drawingPoints = [point];
});

editorOverlay.addEventListener('pointermove', event => {
  const point = pointOnEditor(event);
  if (annotationAction && !editorTool) {
    const dx = point.x - annotationAction.start.x, dy = point.y - annotationAction.start.y;
    const annotation = annotationAction.annotation;
    if (annotation.type === 'stamp' && annotationAction.mode === 'resize') {
      const startDx = annotationAction.start.x - annotation.x, startDy = annotationAction.start.y - annotation.y;
      const startDistance = Math.max(20, Math.hypot(startDx, startDy));
      const currentDistance = Math.hypot(point.x - annotation.x, point.y - annotation.y);
      annotation.size = Math.max(6, Math.min(180, (annotationAction.original.height || 18) * currentDistance / startDistance)); redrawOverlay(); return;
    }
    if (annotation.type === 'stamp' && annotationAction.mode === 'rotate') {
      const currentAngle = Math.atan2(point.y - annotation.y, point.x - annotation.x) * 180 / Math.PI;
      let angleDelta = currentAngle - annotationAction.rotationStartAngle;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;
      annotation.rotation = Math.round(annotationAction.rotationStart + angleDelta); redrawOverlay(); return;
    }
    if (event.shiftKey && !annotation.points?.length) {
      if (annotation.type === 'stamp') {
        annotation.size = Math.max(6, Math.min(180, (annotationAction.original.height || 18) + dy));
        redrawOverlay(); return;
      }
      annotation.width = Math.max(8, annotationAction.original.width + dx);
      annotation.height = Math.max(8, annotationAction.original.height + dy);
      if (annotation.type === 'text') annotation.size = Math.max(6, annotationAction.original.height + dy);
      redrawOverlay(); return;
    }
    if (annotation.points?.length) annotation.points.forEach(item => { item.x += dx; item.y += dy; });
    else if (annotation.type === 'text' || annotation.type === 'image') { annotation.x += dx; annotation.y += dy; }
    else { annotation.x += dx; annotation.y += dy; }
    if (annotation.type === 'stamp') {
      annotation.nx = Math.max(0, Math.min(1, annotation.x / editorOverlay.width));
      annotation.ny = Math.max(0, Math.min(1, annotation.y / editorOverlay.height));
    }
    annotationAction.start = point;
    redrawOverlay(); return;
  }
  if (movingText) {
    movingText.annotation.x = point.x - movingText.offsetX;
    movingText.annotation.y = point.y - movingText.offsetY;
    redrawOverlay();
    return;
  }
  if (!drawingStart) return;
  if (editorTool === 'draw' || (editorTool === 'shape' && document.querySelector('#shapeType').value === 'freehand')) drawingPoints.push(point);
  redrawOverlay();
  const context = editorOverlay.getContext('2d');
  if (editorTool === 'draw' || (editorTool === 'shape' && document.querySelector('#shapeType').value === 'freehand')) {
    drawAnnotationPreview(context, { type: editorTool === 'draw' ? 'draw' : 'shape', shape: 'freehand', points: drawingPoints, color: document.querySelector('#editColor').value, brushSize: Number(document.querySelector('#brushSize').value) });
  } else if (['highlight', 'shape', 'whiteout', 'redact'].includes(editorTool)) {
    const x = Math.min(drawingStart.x, point.x), y = Math.min(drawingStart.y, point.y);
    drawAnnotationPreview(context, { type: editorTool, shape: editorTool === 'shape' ? document.querySelector('#shapeType').value : undefined, x, y, width: Math.abs(point.x - drawingStart.x), height: Math.abs(point.y - drawingStart.y), color: document.querySelector('#editColor').value, brushSize: Number(document.querySelector('#brushSize').value) });
  }
});

editorOverlay.addEventListener('pointerup', event => {
  if (annotationAction) { annotationAction = null; return; }
  if (movingText) { movingText = null; return; }
  if (!drawingStart) return;
  const point = pointOnEditor(event);
  const x = Math.min(drawingStart.x, point.x), y = Math.min(drawingStart.y, point.y);
  const width = Math.abs(point.x - drawingStart.x), height = Math.abs(point.y - drawingStart.y);
  if (editorTool === 'draw') editorAnnotations.push({ type: 'draw', points: drawingPoints, color: document.querySelector('#editColor').value, brushSize: Number(document.querySelector('#brushSize').value) });
  else if (editorTool === 'highlight') {
    const draggedStart = Math.min(drawingStart.x, point.x), draggedEnd = Math.max(drawingStart.x, point.x);
    const hitRects = editorTextRects.filter(rect => rect.y < Math.max(drawingStart.y, point.y) && rect.y + rect.height > Math.min(drawingStart.y, point.y) && rect.x < draggedEnd && rect.x + rect.width > draggedStart);
    if (hitRects.length) {
      const x = Math.min(...hitRects.map(rect => rect.x)), right = Math.max(...hitRects.map(rect => rect.x + rect.width));
      const y = Math.min(...hitRects.map(rect => rect.y)), bottom = Math.max(...hitRects.map(rect => rect.y + rect.height));
      editorAnnotations.push({ type: 'highlight', x, y, width: right - x, height: bottom - y, color: document.querySelector('#editColor').value });
    } else editorAnnotations.push({ type: 'highlight', x, y, width, height, color: document.querySelector('#editColor').value });
  }
  else if (editorTool === 'shape' && document.querySelector('#shapeType').value === 'freehand') editorAnnotations.push({ type: 'shape', shape: 'freehand', points: drawingPoints, color: document.querySelector('#editColor').value, brushSize: Number(document.querySelector('#brushSize').value) });
  else editorAnnotations.push({ type: editorTool === 'highlight' ? 'highlight' : editorTool, shape: editorTool === 'shape' ? document.querySelector('#shapeType').value : undefined, x, y, width, height, color: document.querySelector('#editColor').value, brushSize: Number(document.querySelector('#brushSize').value) });
  drawingStart = null; drawingPoints = []; redrawOverlay();
});

document.querySelectorAll('[data-edit-tool]').forEach(button => button.addEventListener('click', () => {
  editorTool = button.dataset.editTool;
  if (editorTool === 'image') document.querySelector('#editorImage').click();
  if (editorTool === 'sign') document.querySelector('#signDialog').showModal();
  if (editorTool === 'text') showToast('Click text to edit it. Ctrl+Backspace or Ctrl+Delete removes it.');
  document.querySelectorAll('[data-edit-tool]').forEach(item => item.classList.toggle('active', item === button));
}));

document.querySelector('#editPageButton').addEventListener('click', openEditor);
document.querySelector('#openStampMenu').addEventListener('click', () => {
  editingStamp = null;
  document.querySelector('#stampDialogTitle').textContent = 'Add stamp';
  document.querySelector('#applyStamp').textContent = 'Add stamp';
  editorTool = null;
  document.querySelectorAll('[data-edit-tool]').forEach(item => item.classList.remove('active'));
  document.querySelector('#selectTool').classList.add('active');
  document.querySelector('#stampDialog').showModal();
});
document.querySelector('#cancelStamp').addEventListener('click', () => { editingStamp = null; document.querySelector('#stampDialog').close(); });

function openStampEditor(stamp) {
  editingStamp = stamp;
  document.querySelector('#stampDialogTitle').textContent = 'Edit stamp';
  document.querySelector('#applyStamp').textContent = 'Update stamp';
  document.querySelector('#stampKind').value = stamp.stampKind || 'watermark';
  document.querySelector('#stampText').value = stamp.text || '';
  document.querySelector('#stampTextRow').hidden = !['watermark', 'header', 'footer'].includes(stamp.stampKind);
  document.querySelector('#stampPlacement').value = stamp.placement || 'center';
  document.querySelector('#stampFont').value = stamp.font || 'Helvetica';
  document.querySelector('#stampColor').value = stamp.color || '#111111';
  document.querySelector('#stampSize').value = stamp.size || 18;
  document.querySelector('#stampOpacity').value = Math.round((stamp.opacity ?? 1) * 100);
  document.querySelector('#stampRotation').value = stamp.rotation || 0;
  document.querySelector('#stampScope').value = 'current';
  document.querySelector('#stampDialog').showModal();
}

document.querySelector('#stampKind').addEventListener('change', event => {
  const kind = event.target.value;
  document.querySelector('#stampTextRow').hidden = !['watermark', 'header', 'footer'].includes(kind);
  if (kind === 'pageNumber') {
    document.querySelector('#stampText').value = 'Page {{page}}';
    document.querySelector('#stampPlacement').value = 'bottom';
    document.querySelector('#stampSize').value = 12;
    document.querySelector('#stampRotation').value = 0;
    document.querySelector('#stampOpacity').value = 100;
  }
  if (kind === 'date') document.querySelector('#stampText').value = '{{date}}';
  if (kind === 'header') document.querySelector('#stampPlacement').value = 'top';
  if (kind === 'footer') document.querySelector('#stampPlacement').value = 'bottom';
});
document.querySelector('#applyStamp').addEventListener('click', () => {
  const kind = document.querySelector('#stampKind').value;
  const placement = document.querySelector('#stampPlacement').value;
  const scope = document.querySelector('#stampScope').value;
  const text = kind === 'pageNumber' ? 'Page {{page}}' : kind === 'date' ? '{{date}}' : document.querySelector('#stampText').value.trim();
  if (!text && kind !== 'pageNumber' && kind !== 'date') return showToast('Enter stamp text');
  pushHistory();
  if (editingStamp) {
    editingStamp.stampKind = kind; editingStamp.text = text; editingStamp.placement = kind === 'pageNumber' ? 'bottom' : placement;
    editingStamp.font = document.querySelector('#stampFont').value; editingStamp.size = Number(document.querySelector('#stampSize').value);
    editingStamp.opacity = Number(document.querySelector('#stampOpacity').value) / 100; editingStamp.rotation = Number(document.querySelector('#stampRotation').value);
    editingStamp.color = document.querySelector('#stampColor').value;
    editingStamp.nx = editingStamp.nx ?? editingStamp.x / editorOverlay.width;
    editingStamp.ny = editingStamp.ny ?? editingStamp.y / editorOverlay.height;
    document.querySelector('#stampDialog').close(); selectedAnnotation = editingStamp; editingStamp = null; redrawOverlay(); showToast('Stamp updated'); return;
  }
  const stamp = { type: 'stamp', stampKind: kind, text, placement: kind === 'pageNumber' ? 'bottom' : placement, x: 0, y: 0, font: document.querySelector('#stampFont').value, size: Number(document.querySelector('#stampSize').value), opacity: Number(document.querySelector('#stampOpacity').value) / 100, rotation: Number(document.querySelector('#stampRotation').value), color: document.querySelector('#stampColor').value, pageNumber: editorPageIndex + 1 };
  stampPosition(stamp, editorOverlay.width, editorOverlay.height);
  if (scope === 'current') {
    editorAnnotations.push(stamp);
  } else {
    const targets = state.pages.filter(page => page.sourceId === editorPage.sourceId);
    targets.forEach((page, index) => {
      const copy = { ...stamp, pageNumber: index + 1, x: stamp.x, y: stamp.y };
      const annotations = pageAnnotations.get(page.id) || [];
      pageAnnotations.set(page.id, [...annotations, copy]);
    });
    editorAnnotations = pageAnnotations.get(editorPage.id);
  }
  document.querySelector('#stampDialog').close(); selectedAnnotation = stamp; redrawOverlay(); showToast(scope === 'all' ? 'Stamp added to all pages' : 'Stamp added');
});

function stampPosition(stamp, width, height) {
  const yOffsets = { center: .5, top: .12, bottom: .88, 'top-left': .12, 'top-right': .12, 'bottom-left': .88, 'bottom-right': .88 };
  const xOffsets = { center: .5, top: .5, bottom: .5, 'top-left': .08, 'top-right': .92, 'bottom-left': .08, 'bottom-right': .92 };
  stamp.nx = xOffsets[stamp.placement] ?? .5;
  stamp.ny = yOffsets[stamp.placement] ?? .5;
  stamp.x = width * stamp.nx;
  stamp.y = height * stamp.ny;
}
function canvasFontName(font) {
  return font === 'Times Roman' ? 'Times New Roman' : font === 'Courier' ? 'Courier New' : 'Helvetica';
}
function resolveStampText(annotation) {
  if (annotation.text === '{{date}}') return new Date().toLocaleDateString();
  return annotation.text.replaceAll('{{page}}', String(annotation.pageNumber || 1));
}

document.querySelector('#editorImage').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const point = state.pendingEditPoint || { x: 30, y: 30 };
  editorAnnotations.push({ type: editorTool === 'sign' ? 'image' : 'image', x: point.x, y: point.y, width: 150, height: 75, dataUrl: await fileToDataUrl(file), color: '#000000' });
  event.target.value = ''; redrawOverlay();
});

function fileToDataUrl(file) { return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }); }

const signatureCanvas = document.querySelector('#signatureCanvas');
const signatureContext = signatureCanvas.getContext('2d');
let signatureDrawing = false;
signatureContext.lineWidth = 3; signatureContext.lineCap = 'round'; signatureContext.strokeStyle = '#111111';
signatureCanvas.addEventListener('pointerdown', event => { signatureDrawing = true; signatureContext.beginPath(); const point = signaturePoint(event); signatureContext.moveTo(point.x, point.y); });
signatureCanvas.addEventListener('pointermove', event => { if (!signatureDrawing) return; const point = signaturePoint(event); signatureContext.lineTo(point.x, point.y); signatureContext.stroke(); });
signatureCanvas.addEventListener('pointerup', () => { signatureDrawing = false; });
function signaturePoint(event) { const rect = signatureCanvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * signatureCanvas.width / rect.width, y: (event.clientY - rect.top) * signatureCanvas.height / rect.height }; }
document.querySelector('#clearSignature').addEventListener('click', () => signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height));
document.querySelector('#cancelSignature').addEventListener('click', () => document.querySelector('#signDialog').close());
document.querySelector('#uploadSignatureTab').addEventListener('click', () => document.querySelector('#signatureImage').click());
document.querySelector('#drawSignatureTab').addEventListener('click', () => signatureCanvas.hidden = false);
document.querySelector('#signatureImage').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  state.signatureDataUrl = await fileToDataUrl(file); document.querySelector('#signDialog').close(); showToast('Signature ready. Click the page to place it.');
});
document.querySelector('#useSignature').addEventListener('click', () => {
  state.signatureDataUrl = signatureCanvas.toDataURL('image/png'); document.querySelector('#signDialog').close(); showToast('Signature ready. Click the page to place it.');
});

document.querySelector('#undoEdit').addEventListener('click', () => {
  if (!annotationHistory.length) return;
  annotationRedo.push(JSON.stringify(editorAnnotations));
  editorAnnotations = JSON.parse(annotationHistory.pop()); selectedAnnotation = null; redrawOverlay();
});
document.querySelector('#redoEdit').addEventListener('click', () => {
  if (!annotationRedo.length) return;
  annotationHistory.push(JSON.stringify(editorAnnotations));
  editorAnnotations = JSON.parse(annotationRedo.pop()); selectedAnnotation = null; redrawOverlay();
});
document.querySelector('#deleteSelectedObject').addEventListener('click', () => {
  if (!selectedAnnotation) return;
  pushHistory(); editorAnnotations.splice(editorAnnotations.indexOf(selectedAnnotation), 1); selectedAnnotation = null; redrawOverlay();
});
document.querySelector('#closeEditor').addEventListener('click', () => editorDialog.close());
document.querySelector('#editSelected')?.addEventListener('click', openEditor);

document.querySelector('#saveEdit')?.addEventListener('click', () => {
  if (!editorAnnotations.length) return showToast('Make an edit first');
  document.querySelector('#saveOptionsDialog').showModal();
});

async function saveEditedPdf(applyToAllPages = false) {
  document.querySelector('#saveOptionsDialog').close();
  pageAnnotations.set(editorPage.id, editorAnnotations);
  if (applyToAllPages) {
    const changes = JSON.parse(JSON.stringify(editorAnnotations));
    state.pages.filter(pageRef => pageRef.sourceId === editorPage.sourceId).forEach(pageRef => {
      pageAnnotations.set(pageRef.id, JSON.parse(JSON.stringify(changes)));
    });
  }
  const source = state.documents.find(document => document.id === editorPage.sourceId);
  const output = await PDFDocument.load(source.bytes.slice(0));
  const page = output.getPage(editorPage.sourceIndex);
  const embeddedFonts = {
    Helvetica: await output.embedFont(StandardFonts.Helvetica),
    'Times Roman': await output.embedFont(StandardFonts.TimesRoman),
    Courier: await output.embedFont(StandardFonts.Courier)
  };
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const stampFont = embeddedFonts.Helvetica;
  state.pages.filter(pageRef => pageRef.sourceId === editorPage.sourceId).forEach(pageRef => {
    const pageAnnotationsForStamp = pageAnnotations.get(pageRef.id) || [];
    const stampPage = output.getPage(pageRef.sourceIndex);
    const stampSize = stampPage.getSize();
    pageAnnotationsForStamp.filter(annotation => annotation.type === 'stamp').forEach(annotation => {
      const font = embeddedFonts[annotation.font] || stampFont;
      const stampText = resolveStampText(annotation);
      const stampSizePt = (annotation.size || 18) * stampSize.width / editorOverlay.width;
      const textWidth = font.widthOfTextAtSize(stampText, stampSizePt);
      stampPage.drawText(stampText, { x: (annotation.nx ?? .5) * stampSize.width - textWidth / 2, y: stampSize.height - (annotation.ny ?? .5) * stampSize.height, size: stampSizePt, font, color: hexToPdfRgb(annotation.color || '#111111'), opacity: annotation.opacity ?? 1, rotate: degrees(annotation.rotation || 0) });
    });
  });
  const scaleX = pageWidth / editorOverlay.width;
  const scaleY = pageHeight / editorOverlay.height;
  const pagesToSave = applyToAllPages ? state.pages.filter(pageRef => pageRef.sourceId === editorPage.sourceId) : [editorPage];
  const sourcePdfJs = await pdfjsLib.getDocument({ data: source.bytes.slice(0) }).promise;
  for (const pageRef of pagesToSave) {
    const redactions = (pageAnnotations.get(pageRef.id) || []).filter(annotation => annotation.type === 'redact');
    if (!redactions.length) continue;
    const pdfJsPage = await sourcePdfJs.getPage(pageRef.sourceIndex + 1);
    const viewport = pdfJsPage.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfJsPage.render({ canvasContext: context, viewport }).promise;
    const renderScaleX = canvas.width / editorOverlay.width;
    const renderScaleY = canvas.height / editorOverlay.height;
    context.fillStyle = '#000000';
    redactions.forEach(annotation => context.fillRect(annotation.x * renderScaleX, annotation.y * renderScaleY, (annotation.width || 150) * renderScaleX, (annotation.height || 18) * renderScaleY));
    const jpegBytes = await fetch(canvas.toDataURL('image/jpeg', .92)).then(response => response.arrayBuffer());
    const jpeg = await output.embedJpg(jpegBytes);
    const originalPage = output.getPage(pageRef.sourceIndex);
    const { width, height } = originalPage.getSize();
    output.removePage(pageRef.sourceIndex);
    const flattenedPage = output.insertPage(pageRef.sourceIndex, [width, height]);
    flattenedPage.drawImage(jpeg, { x: 0, y: 0, width, height });
  }
  sourcePdfJs.destroy();
  for (const pageRef of pagesToSave) {
    const annotationsPage = output.getPage(pageRef.sourceIndex);
    const annotationsPageSize = annotationsPage.getSize();
    const annotationScaleX = annotationsPageSize.width / editorOverlay.width;
    const annotationScaleY = annotationsPageSize.height / editorOverlay.height;
    const annotations = pageAnnotations.get(pageRef.id) || [];
    for (const annotation of [...annotations].filter(item => item.type !== 'stamp').sort((a, b) => (a.type === 'whiteout' ? 0 : 1) - (b.type === 'whiteout' ? 0 : 1))) {
    const page = annotationsPage, pageWidth = annotationsPageSize.width, pageHeight = annotationsPageSize.height;
    const scaleX = annotationScaleX, scaleY = annotationScaleY;
    const x = annotation.x * scaleX;
    const width = (annotation.width || 150) * scaleX;
    const y = pageHeight - ((annotation.y || 0) + (annotation.height || 18)) * scaleY;
    const height = (annotation.height || 18) * scaleY;
    const color = annotation.color === '#111111' ? rgb(0.07, 0.07, 0.07) : hexToPdfRgb(annotation.color || '#ed2020');
    if (annotation.type === 'stamp') {
      const font = embeddedFonts.Helvetica;
      page.drawText(resolveStampText(annotation), { x: annotation.x * scaleX, y: pageHeight - annotation.y * scaleY, size: (annotation.size || 18) * Math.min(scaleX, scaleY), font, color, opacity: annotation.opacity ?? 1, rotate: degrees(annotation.rotation || 0) });
    }
    if (annotation.type === 'text') {
      const font = embeddedFonts[annotation.font] || embeddedFonts.Helvetica;
      const textWidth = font.widthOfTextAtSize(annotation.text, (annotation.size || 18) * Math.min(scaleX, scaleY));
      const alignedX = annotation.align === 'center' ? x - textWidth / 2 : annotation.align === 'right' ? x - textWidth : x;
      page.drawText(annotation.text, { x: alignedX, y: pageHeight - annotation.y * scaleY, size: (annotation.size || 18) * Math.min(scaleX, scaleY), font, color, characterSpacing: annotation.spacing || 0, rotate: degrees(annotation.rotation || 0) });
    }
    if (annotation.type === 'highlight') page.drawRectangle({ x, y: pageHeight - (annotation.y + annotation.height) * scaleY, width, height, color: rgb(1, .92, 0), opacity: .45 });
    if (annotation.type === 'shape' && annotation.shape === 'ellipse') page.drawEllipse({ x: x + width / 2, y: pageHeight - (annotation.y + height / 2) * scaleY, xScale: Math.max(width / 2, 1), yScale: Math.max(height / 2, 1), borderColor: color, borderWidth: annotation.brushSize || 2 });
    if (annotation.type === 'shape' && annotation.shape === 'line') page.drawLine({ start: { x, y: pageHeight - (annotation.y + height) * scaleY }, end: { x: x + width, y: pageHeight - annotation.y * scaleY }, color, thickness: annotation.brushSize || 2 });
    if (annotation.type === 'shape' && ['rectangle', undefined].includes(annotation.shape)) page.drawRectangle({ x, y: pageHeight - (annotation.y + annotation.height) * scaleY, width, height, borderColor: color, borderWidth: annotation.brushSize || 2 });
    if (annotation.type === 'shape' && annotation.shape === 'triangle') {
      const top = { x: x + width / 2, y: pageHeight - annotation.y * scaleY }; const left = { x, y: pageHeight - (annotation.y + annotation.height) * scaleY }; const right = { x: x + width, y: left.y }; page.drawLine({ start: top, end: left, color, thickness: annotation.brushSize || 2 }); page.drawLine({ start: left, end: right, color, thickness: annotation.brushSize || 2 }); page.drawLine({ start: right, end: top, color, thickness: annotation.brushSize || 2 });
    }
    if (annotation.type === 'shape' && annotation.shape === 'arrow') {
      const start = { x, y: pageHeight - (annotation.y + annotation.height) * scaleY }, end = { x: x + width, y: pageHeight - annotation.y * scaleY }; page.drawLine({ start, end, color, thickness: annotation.brushSize || 2 });
      const angle = Math.atan2(end.y - start.y, end.x - start.x), head = 10;
      page.drawLine({ start: end, end: { x: end.x - head * Math.cos(angle - Math.PI / 6), y: end.y - head * Math.sin(angle - Math.PI / 6) }, color, thickness: annotation.brushSize || 2 });
      page.drawLine({ start: end, end: { x: end.x - head * Math.cos(angle + Math.PI / 6), y: end.y - head * Math.sin(angle + Math.PI / 6) }, color, thickness: annotation.brushSize || 2 });
    }
    if (annotation.type === 'shape' && annotation.shape === 'freehand') {
      const points = annotation.points.map(point => ({ x: point.x * scaleX, y: pageHeight - point.y * scaleY }));
      for (let index = 1; index < points.length; index++) page.drawLine({ start: points[index - 1], end: points[index], color, thickness: annotation.brushSize || 2 });
    }
    if (annotation.type === 'whiteout') page.drawRectangle({ x, y: pageHeight - (annotation.y + annotation.height) * scaleY, width, height, color: rgb(1, 1, 1) });
    if (annotation.type === 'redact') page.drawRectangle({ x, y: pageHeight - (annotation.y + annotation.height) * scaleY, width, height, color: rgb(0, 0, 0) });
    if (annotation.type === 'draw') {
      const points = annotation.points.map(point => ({ x: point.x * scaleX, y: pageHeight - point.y * scaleY }));
      for (let index = 1; index < points.length; index++) page.drawLine({ start: points[index - 1], end: points[index], color, thickness: annotation.brushSize || 2 });
    }
    if (annotation.type === 'image' && annotation.dataUrl) {
      const bytes = await fetch(annotation.dataUrl).then(response => response.arrayBuffer());
      const image = annotation.dataUrl.startsWith('data:image/png') ? await output.embedPng(bytes) : await output.embedJpg(bytes);
      page.drawImage(image, { x, y, width, height });
    }
    }
  }
  const saved = await output.save();
  source.bytes = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength);
  source.pdf = await PDFDocument.load(source.bytes.slice(0));
  editorDialog.close(); renderPages(); showToast(applyToAllPages ? 'Changes applied to every page and saved' : 'Changes saved');
}

document.querySelector('#saveCurrentPage').addEventListener('click', () => saveEditedPdf(false));
document.querySelector('#saveAllPages').addEventListener('click', () => saveEditedPdf(true));

function drawShapePreview(context, annotation) {
  context.strokeStyle = annotation.color || '#ed2020'; context.lineWidth = annotation.brushSize || 3;
  const x = annotation.x, y = annotation.y, w = annotation.width, h = annotation.height;
  if (annotation.shape === 'ellipse') { context.beginPath(); context.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2); context.stroke(); return; }
  if (annotation.shape === 'line' || annotation.shape === 'arrow') { context.beginPath(); context.moveTo(x, y + h); context.lineTo(x + w, y); context.stroke(); if (annotation.shape === 'arrow') { const angle = Math.atan2(-h, w), endX = x + w, endY = y; context.beginPath(); context.moveTo(endX, endY); context.lineTo(endX - 14 * Math.cos(angle - .45), endY - 14 * Math.sin(angle - .45)); context.moveTo(endX, endY); context.lineTo(endX - 14 * Math.cos(angle + .45), endY - 14 * Math.sin(angle + .45)); context.stroke(); } return; }
  if (annotation.shape === 'triangle') { context.beginPath(); context.moveTo(x + w / 2, y); context.lineTo(x + w, y + h); context.lineTo(x, y + h); context.closePath(); context.stroke(); return; }
  if (annotation.shape === 'freehand' && annotation.points?.length > 1) { context.beginPath(); annotation.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke(); return; }
  context.strokeRect(x, y, w, h);
}

function hexToPdfRgb(hex) { const color = hexToRgb(hex || '#ed2020'); return rgb(color.r, color.g, color.b); }

async function detectScannedTextAutomatically() {
  try {
    const worker = await createWorker('eng', 1);
    const result = await worker.recognize(editorCanvas);
    ocrWords = (result.data.words || []).filter(word => word.text?.trim() && word.confidence >= 35).map(word => ({
      x: word.bbox.x0 * editorCanvas.width / editorCanvas.width,
      y: word.bbox.y0 * editorCanvas.height / editorCanvas.height,
      width: (word.bbox.x1 - word.bbox.x0) * editorCanvas.width / editorCanvas.width,
      height: (word.bbox.y1 - word.bbox.y0) * editorCanvas.height / editorCanvas.height,
      text: word.text,
      source: 'ocr'
    }));
    editorTextRects = editorTextRects.concat(ocrWords);
    await worker.terminate();
    if (ocrWords.length) showToast(`${ocrWords.length} scanned text regions detected automatically`);
  } catch (error) {
    console.error(error);
  }
}

async function navigateEditorPage(offset) {
  const nextIndex = editorPageIndex + offset;
  if (nextIndex < 0 || nextIndex >= state.pages.length) return;
  pageAnnotations.set(editorPage.id, editorAnnotations);
  editorPageIndex = nextIndex;
  editorPage = state.pages[editorPageIndex];
  editorAnnotations = pageAnnotations.get(editorPage.id) || [];
  selectedAnnotation = null; annotationHistory = [];
  await renderEditorPage();
}
document.querySelector('#previousEditorPage').addEventListener('click', () => navigateEditorPage(-1));
document.querySelector('#nextEditorPage').addEventListener('click', () => navigateEditorPage(1));

document.querySelector('#selectTool').addEventListener('click', () => {
  editorTool = null; document.querySelectorAll('[data-edit-tool]').forEach(item => item.classList.remove('active')); document.querySelector('#selectTool').classList.add('active');
});

document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
  if (!selectedAnnotation || selectedAnnotation.type !== 'text') return;
  pushHistory();
  if (button.dataset.format === 'bold') selectedAnnotation.bold = !selectedAnnotation.bold;
  if (button.dataset.format === 'italic') selectedAnnotation.italic = !selectedAnnotation.italic;
  if (['left', 'center', 'right'].includes(button.dataset.format)) selectedAnnotation.align = button.dataset.format;
  redrawOverlay();
}));

document.querySelector('#textFont').addEventListener('change', event => { if (selectedAnnotation?.type === 'text') { pushHistory(); selectedAnnotation.font = event.target.value; redrawOverlay(); } });
document.querySelector('#textSpacing').addEventListener('change', event => { if (selectedAnnotation?.type === 'text') { pushHistory(); selectedAnnotation.spacing = Number(event.target.value); redrawOverlay(); } });
document.querySelector('#textAlign').addEventListener('change', event => { if (selectedAnnotation?.type === 'text') { pushHistory(); selectedAnnotation.align = event.target.value; redrawOverlay(); } });
document.querySelector('#editColor').addEventListener('change', event => { if (selectedAnnotation) { pushHistory(); selectedAnnotation.color = event.target.value; redrawOverlay(); } });

async function fillSelectedForm() {
  const chosen = selectedPages();
  if (chosen.length !== 1) return showToast('Select one PDF page to fill');
  const source = state.documents.find(document => document.id === chosen[0].sourceId);
  const pdf = await PDFDocument.load(source.bytes.slice(0));
  const form = pdf.getForm();
  const fields = form.getFields();
  const container = document.querySelector('#formFields');
  container.innerHTML = '';
  if (!fields.length) { container.innerHTML = '<p>This PDF has no fillable form fields.</p>'; }
  fields.forEach((field, index) => {
    const row = document.createElement('label'); row.innerHTML = `${field.getName()} <input data-form-field="${index}" value="${field.getText?.() || ''}">`;
    container.appendChild(row);
  });
  document.querySelector('#formDialog').showModal();
}

document.querySelector('#fillForm').addEventListener('click', fillSelectedForm);
document.querySelector('#closeForm').addEventListener('click', () => document.querySelector('#formDialog').close());
document.querySelector('#saveForm').addEventListener('click', async () => {
  const chosen = selectedPages();
  const source = state.documents.find(document => document.id === chosen[0].sourceId);
  const output = await PDFDocument.load(source.bytes.slice(0));
  const fields = output.getForm().getFields();
  document.querySelectorAll('[data-form-field]').forEach(input => {
    const field = fields[Number(input.dataset.formField)];
    if (field.constructor.name === 'PDFTextField') field.setText(input.value);
    if (field.constructor.name === 'PDFCheckBox') field.check();
  });
  try { output.getForm().flatten(); } catch (_) {}
  await downloadPdf(output, 'pdf-studio-filled.pdf');
  document.querySelector('#formDialog').close(); showToast('Filled PDF downloaded');
});
