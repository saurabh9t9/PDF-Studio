# PDF Studio

PDF Studio is a browser-based PDF workspace that processes files entirely on the device. It supports organizing pages, editing PDF content, converting files, and completing common PDF tasks without accounts or uploads.

## Features

- Merge, split, reorder, rotate, duplicate, extract, insert, delete, and crop pages
- Add text, images, highlights, drawings, shapes, signatures, form fields, and stamps
- Redact content and save edited PDFs locally
- Convert PDFs to images or text
- Compress PDFs and inspect before/after file sizes
- Edit PDF metadata, remove metadata, and compare PDFs
- Import PDF documents and PNG, JPEG, or WebP images

## Privacy

PDF Studio processes documents locally in the browser. Files are not uploaded to a server.

## Requirements

- Node.js 18 or newer
- npm

See [REQUIREMENTS.md](REQUIREMENTS.md) for the complete functional requirements and acceptance criteria. Development prompt history is documented in [PROMPTS.md](PROMPTS.md).

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Production build

```bash
npm run build
npm run preview
```

The production output is generated in `dist/`.

## Main technologies

- PDF.js — PDF rendering and text access
- pdf-lib — PDF creation, editing, and export
- Tesseract.js — local text recognition support
- Vite — development and production tooling
