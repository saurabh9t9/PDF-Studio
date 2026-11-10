# PDF Studio Requirements

## Product

- Provide a complete PDF editing and processing workspace named **PDF Studio**.
- Run locally in the browser without uploads, accounts, or required internet access.
- Keep documents and processed data on the user's device.
- Support PDF and DOCX documents and image uploads, including PNG, JPEG, and WebP.
- Convert DOCX files to PDF pages using local LibreOffice, or Microsoft Word on Windows, so tables, lists, drawings, charts, and images are rendered by an office engine.
- Preserve the uploaded DOCX bytes unchanged and provide a download of the original.
- Do not silently fall back to text extraction if DOCX conversion is unavailable; show the conversion error to the user.
- Show per-file upload percentages from actual transferred bytes, and use an indeterminate animation during local conversion.
- Process one file at a time and allow the queued order to be set before import starts.
- Keep imported pages in queue order without prioritizing file types or completion speed.
- Update page selection without rebuilding page previews or rerendering their thumbnails.

## Organize pages

- Merge PDF pages and documents.
- Split selected pages into separate output.
- Reorder pages.
- Rotate pages left and right.
- Delete pages.
- Duplicate pages.
- Extract selected pages.
- Insert blank pages.
- Crop pages.
- Provide page selection and select-all controls.

## Edit PDF pages

- Add text, images, highlights, freehand drawings, shapes, whiteout areas, signatures, and form fields.
- Add and apply redactions that permanently remove underlying content.
- Add editable stamps, watermarks, page numbers, headers, footers, and dates.
- Support selecting, moving, resizing, and rotating editor objects using handles.
- Keep PDF text selectable and editable on the document canvas where supported.
- Provide undo and redo behavior.

## Stamp behavior

- Support changing stamp text, font, color, size, opacity, placement, angle, and page scope.
- Display rotated object bounds and resize handles that follow the stamp orientation.
- Apply stamp changes to individual pages or all relevant pages when requested.

## Save workflow

- Use an active **Save** action after changes are made.
- Offer **Save** for the current scope and **Apply changes to all pages and save**.
- Export a PDF that opens correctly in other PDF readers.

## Convert and finish

- Convert PDFs to images and text.
- Import supported images directly into the workspace.
- Compress PDFs and show original, recommended, manual-target, and final sizes.
- Edit PDF details, remove metadata, and compare two PDFs.

## Workspace and privacy

- Display visual page thumbnails, page counts, file counts, and selection controls.
- Provide Select all and download actions for all or selected pages.
- Keep the local workspace upload control but do not use a header-level **Add PDFs** button.
- Process documents locally without uploads, accounts, or required internet access.
- Ensure permanent redactions cannot be selected, searched, or extracted afterwards.
- Confirm that compression reports original and compressed file sizes.
