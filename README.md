# PDF Studio

PDF Studio is a browser-based PDF workspace that processes files entirely on the device. It supports organizing pages, editing PDF content, converting files, and completing common PDF tasks without accounts or uploads.

## Features

- Merge, split, reorder, rotate, duplicate, extract, insert, delete, and crop pages
- Add text, images, highlights, drawings, shapes, signatures, form fields, and stamps
- Redact content and save edited PDFs locally
- Convert PDFs to images or text
- Compress PDFs and inspect before/after file sizes
- Edit PDF metadata, remove metadata, and compare PDFs
- Import PDF and DOCX documents, plus PNG, JPEG, or WebP images
- Convert DOCX documents to PDF locally with LibreOffice or Microsoft Word on Windows, preserving the original DOCX for download
- Show an animated, per-file import queue and preserve the selected file order
- Update page selection without rerendering previews

## Privacy

PDF Studio processes documents locally in the browser. Files are not uploaded to a server.

## Requirements

- Node.js 18 or newer
- npm
- LibreOffice or (on Windows) Microsoft Word for DOCX import; set `LIBREOFFICE_PATH` if `soffice` is not on `PATH`

See [REQUIREMENTS.md](REQUIREMENTS.md) for the complete functional requirements and acceptance criteria. Development prompt history is documented in [PROMPTS.md](PROMPTS.md).

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.
If PDF Studio was already running when these changes were installed, stop the old server and run `npm run dev` again so the local DOCX conversion endpoint is loaded.

## Production build

```bash
npm run build
npm run preview
```

The production output is generated in `dist/`. Run the Vite preview server to use its local DOCX conversion endpoint; serving `dist/` as static files alone does not provide DOCX conversion.

## Main technologies

- PDF.js — PDF rendering and text access
- pdf-lib — PDF creation, editing, and export
- Tesseract.js — local text recognition support
- LibreOffice or Microsoft Word — local DOCX-to-PDF conversion for tables, lists, drawings, charts, and images
- Vite — development and production tooling
