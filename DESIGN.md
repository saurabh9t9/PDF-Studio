# PDF Studio Design

## Product principles

1. **Private by design** — documents stay on the user's device.
2. **One workspace** — page organization and advanced editing are available without switching applications.
3. **Direct manipulation** — annotations, stamps, text, and images use on-page handles for movement, resizing, and rotation.
4. **Progressive complexity** — common actions are visible; advanced options appear only when relevant.
5. **Fast local feedback** — the interface reports local page counts, file sizes, progress, and saved output immediately.

## Information architecture

### Workspace

The workspace lists PDF pages and supplies multi-selection, upload, download, and global page actions.

### Organize

Page-level operations modify the document structure: merge, split, rotate, duplicate, extract, delete, reorder, blank-page insertion, and crop.

### Edit

The editor combines a rendered PDF canvas with annotation tools and selection handles. A change remains local until it is saved.

### Convert and finish

Conversion and finishing tools operate as focused dialogs with clear inputs, progress, and output actions.

## Interaction patterns

- Selection controls are used for destructive, bulk, and export actions.
- Dangerous actions require clear wording or confirmation.
- Save actions offer either the current scope or application to all relevant pages where appropriate.
- Canvas objects expose drag, resize, and rotation controls without leaving the editor.
- Redactions visibly cover source content and are exported as flattened page content.

## Visual system

- Clean neutral surfaces keep PDF content dominant.
- The header communicates the local-only privacy model.
- Primary actions use a strong accent for immediate discoverability.
- Dense page tools use compact controls that preserve available canvas space.
- Status and dialog copy use concise, action-oriented language.

## Privacy and offline behavior

The application avoids document uploads and account-based flows. Libraries and assets should be bundled with the application so document processing remains available when network access is disabled.
