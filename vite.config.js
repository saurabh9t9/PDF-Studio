import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';

const maxDocxSize = 50 * 1024 * 1024;
const maxProcessOutput = 16 * 1024;

function jsonResponse(response, status, message) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ error: message }));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxDocxSize) {
        reject(Object.assign(new Error('DOCX files must be 50 MB or smaller.'), { status: 413 }));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
    request.on('aborted', () => reject(Object.assign(new Error('DOCX upload was interrupted.'), { status: 400 })));
  });
}

async function findLibreOffice() {
  if (process.env.LIBREOFFICE_PATH) return process.env.LIBREOFFICE_PATH;
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ];
    for (const candidate of candidates) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        // Check the next standard installation path.
      }
    }
  }
  return 'soffice';
}

function runOfficeCommand(executable, args, officeName, missingMessage) {
  return new Promise((resolve, reject) => {
    const processHandle = spawn(executable, args, { windowsHide: true });
    let output = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      error ? reject(error) : resolve(result);
    };
    const collect = chunk => {
      output = (output + chunk.toString()).slice(-maxProcessOutput);
    };
    const timeout = setTimeout(() => {
      processHandle.kill();
      finish(Object.assign(new Error('Local office conversion timed out.'), { status: 504 }));
    }, 120_000);
    processHandle.stdout.on('data', collect);
    processHandle.stderr.on('data', collect);
    processHandle.on('error', error => {
      if (error.code === 'ENOENT') {
        finish(Object.assign(new Error(missingMessage), { status: 503, code: error.code }));
      } else {
        finish(Object.assign(new Error(`Could not start ${officeName}.`), { status: 500 }));
      }
    });
    processHandle.on('close', code => {
      if (code !== 0) {
        finish(Object.assign(new Error(`${officeName} could not convert this DOCX file.${output ? ` ${output.trim()}` : ''}`), { status: 422 }));
      } else {
        finish(null);
      }
    });
  });
}

function convertWithLibreOffice(executable, inputPath, outputPath, profilePath) {
  const args = [
    '--headless',
    '--nologo',
    '--nodefault',
    '--nofirststartwizard',
    `-env:UserInstallation=${pathToFileURL(profilePath).href}`,
    '--convert-to',
    'pdf:writer_pdf_Export',
    '--outdir',
    path.dirname(outputPath),
    inputPath
  ];
  return runOfficeCommand(executable, args, 'LibreOffice', 'LibreOffice was not found. Install LibreOffice, or set LIBREOFFICE_PATH to soffice.');
}

async function convertWithWord(inputPath, outputPath, tempDirectory) {
  const scriptPath = path.join(tempDirectory, 'convert-with-word.ps1');
  const script = [
    'param([string]$InputPath, [string]$OutputPath)',
    '$ErrorActionPreference = "Stop"',
    '$word = $null',
    '$document = $null',
    'try {',
    '  $word = New-Object -ComObject Word.Application',
    '  $word.Visible = $false',
    '  $word.DisplayAlerts = 0',
    '  $word.AutomationSecurity = 3',
    '  $document = $word.Documents.Open($InputPath, $false, $true)',
    '  $document.SaveAs2($OutputPath, 17)',
    '} catch {',
    '  [Console]::Error.WriteLine($_.Exception.Message)',
    '  exit 1',
    '} finally {',
    '  if ($document) { $document.Close(0) }',
    '  if ($word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }',
    '}'
  ].join('\n');
  await writeFile(scriptPath, script, { flag: 'wx' });
  return runOfficeCommand(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, inputPath, outputPath],
    'Microsoft Word',
    'No local office renderer was found. Install LibreOffice or Microsoft Word.'
  );
}

async function convertDocxLocally(inputPath, outputPath, profilePath, tempDirectory) {
  try {
    await convertWithLibreOffice(await findLibreOffice(), inputPath, outputPath, profilePath);
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'ENOENT') throw error;
    await convertWithWord(inputPath, outputPath, tempDirectory);
  }
}

function docxConversionMiddleware() {
  return async (request, response, next) => {
    if (request.method !== 'POST') {
      jsonResponse(response, 405, 'Use POST to convert a DOCX file.');
      return;
    }
    const contentType = request.headers['content-type'] || '';
    if (!contentType.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      jsonResponse(response, 415, 'The request must contain a DOCX file.');
      return;
    }
    const declaredSize = Number(request.headers['content-length'] || 0);
    if (declaredSize > maxDocxSize) {
      jsonResponse(response, 413, 'DOCX files must be 50 MB or smaller.');
      return;
    }

    let tempDirectory;
    try {
      const docxBytes = await readRequestBody(request);
      if (!docxBytes.length) {
        jsonResponse(response, 400, 'The DOCX file is empty.');
        return;
      }
      tempDirectory = await mkdtemp(path.join(tmpdir(), 'pdf-studio-docx-'));
      const inputPath = path.join(tempDirectory, 'document.docx');
      const outputPath = path.join(tempDirectory, 'document.pdf');
      const profilePath = path.join(tempDirectory, 'profile');
      await writeFile(inputPath, docxBytes, { flag: 'wx' });
      await convertDocxLocally(inputPath, outputPath, profilePath, tempDirectory);
      try {
        await access(outputPath);
      } catch {
        throw Object.assign(new Error('The local office renderer did not create a PDF.'), { status: 422 });
      }
      const pdfBytes = await readFile(outputPath);
      response.statusCode = 200;
      response.setHeader('content-type', 'application/pdf');
      response.setHeader('content-length', pdfBytes.length);
      response.end(pdfBytes);
    } catch (error) {
      if (response.headersSent) return;
      jsonResponse(response, error.status || 500, error.message || 'DOCX conversion failed.');
    } finally {
      if (tempDirectory) {
        try {
          await rm(tempDirectory, { recursive: true, force: true });
        } catch (error) {
          console.error('Could not clean up temporary DOCX conversion files.', error);
        }
      }
    }
  };
}

function localDocxConverter() {
  return {
    name: 'local-docx-converter',
    configureServer(server) {
      return () => server.middlewares.use('/api/docx-to-pdf', docxConversionMiddleware());
    },
    configurePreviewServer(server) {
      return () => server.middlewares.use('/api/docx-to-pdf', docxConversionMiddleware());
    }
  };
}

export default defineConfig({
  plugins: [localDocxConverter()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' }
});
