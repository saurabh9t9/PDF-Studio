# Project Structure

```text
PDF-Studio/
├── index.html        # Browser entry page
├── src.js            # Application state, workflows, UI, and PDF operations
├── style.css         # Application layout, components, editor, and dialogs
├── package.json      # npm scripts and dependencies
├── package-lock.json # Locked dependency versions
├── README.md         # Setup and feature overview
├── STRUCTURE.md      # Codebase layout
├── DESIGN.md         # Product and interaction design
└── LICENSE           # Project license
```

## Runtime entry points

- `index.html` loads the application stylesheet and module entry point.
- `src.js` initializes the workspace, event handlers, page state, editors, conversion tools, and export workflows.
- `style.css` defines the visual system and responsive application layout.

## Core application areas in `src.js`

- **Workspace** — imports PDF/image files, displays page thumbnails, and manages page selection.
- **Organize** — merges, splits, reorders, rotates, duplicates, extracts, inserts, deletes, and crops pages.
- **Edit** — creates annotations, text, images, drawings, shapes, signatures, stamps, and form elements.
- **Convert** — exports PDFs as images or text and supports image imports.
- **Finish** — compresses files, edits or removes metadata, and compares PDFs.
- **Save/export** — serializes annotations and document changes into a downloadable PDF.

## Dependencies

- **PDF.js** renders PDF pages in the browser and reads page text.
- **pdf-lib** creates and modifies PDF documents.
- **Tesseract.js** provides browser-side text recognition.
- **Vite** serves and builds the application.
