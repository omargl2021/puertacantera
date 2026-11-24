import { useRef, useState, type ChangeEvent } from 'react';
import { readSheet } from 'read-excel-file/browser';
import writeXlsxFile from 'write-excel-file/browser';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import {
  formatFileSizeEs,
  MAX_EXCEL_IMPORT_BYTES,
  MAX_EXCEL_IMPORT_ROWS,
  parseCsvText,
  parseExcelResidentRows,
  type ExcelImportBatchResult,
  type ParsedExcelResidentRow,
} from '../utils/portalLogic';

interface ImportExcelModalProps {
  onClose: () => void;
  onImport: (rows: ParsedExcelResidentRow[]) => ExcelImportBatchResult;
  onNotify: (message: string) => void;
}

const TEMPLATE_FILENAME = 'Plantilla_Residentes_Puerta_Cantera.xlsx';

export function ImportExcelModal({ onClose, onImport, onNotify }: ImportExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [parsedRows, setParsedRows] = useState<ParsedExcelResidentRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<ExcelImportBatchResult | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const sheetData = [
        [
          { value: 'Nombre completo', fontWeight: 'bold' as const },
          { value: 'Teléfono', fontWeight: 'bold' as const },
          { value: 'Calle', fontWeight: 'bold' as const },
          { value: 'Número ext', fontWeight: 'bold' as const },
          { value: 'Num Int', fontWeight: 'bold' as const },
          { value: 'Placas', fontWeight: 'bold' as const },
        ],
        [
          { value: 'Ana Morales', type: String },
          { value: '442 123 4567', type: String },
          { value: 'Av. Cantera', type: String },
          { value: '205', type: String },
          { value: '', type: String },
          { value: 'QRO-123-A, QRO-456-B', type: String },
        ],
        [
          { value: 'Carlos Mendoza', type: String },
          { value: '442 987 6543', type: String },
          { value: 'Calle Girasol', type: String },
          { value: '112', type: String },
          { value: '2B', type: String },
          { value: 'QRO-789-C', type: String },
        ],
      ];

      await writeXlsxFile(sheetData, {
        sheet: 'Residentes',
        columns: [
          { width: 24 },
          { width: 16 },
          { width: 22 },
          { width: 12 },
          { width: 10 },
          { width: 26 },
        ],
      }).toFile(TEMPLATE_FILENAME);

      onNotify('Plantilla Excel descargada.');
    } catch {
      setParseError('No se pudo generar la plantilla Excel. Intenta de nuevo.');
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setResult(null);
    setParsedRows([]);

    const lowerName = file.name.toLowerCase();
    const isXlsx = lowerName.endsWith('.xlsx');
    const isCsv = lowerName.endsWith('.csv');

    if (!isXlsx && !isCsv) {
      setParseError('Formato no soportado. Sube un archivo Excel (.xlsx) o CSV (.csv).');
      e.target.value = '';
      return;
    }

    if (file.size <= 0) {
      setParseError('El archivo seleccionado está vacío.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_EXCEL_IMPORT_BYTES) {
      setParseError('El archivo supera el límite máximo de 5 MB.');
      e.target.value = '';
      return;
    }

    setIsReading(true);
    setFileName(file.name);
    setFileSize(file.size);

    try {
      let matrix: unknown[][];
      if (isXlsx) {
        matrix = await readSheet(file);
      } else {
        const text = await file.text();
        matrix = parseCsvText(text);
      }

      const parsed = parseExcelResidentRows(matrix);
      if (parsed.parseError) {
        setParseError(parsed.parseError);
        setParsedRows([]);
      } else {
        setParsedRows(parsed.rows);
      }
    } catch {
      setParseError(
        'No se pudo leer el archivo Excel. Verifica que sea un .xlsx válido (no .xls antiguo) o guárdalo en formato .xlsx.',
      );
      setParsedRows([]);
    } finally {
      setIsReading(false);
    }
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    const batchResult = onImport(parsedRows);
    setResult(batchResult);
  };

  const resetSelection = () => {
    setFileName(null);
    setFileSize(0);
    setParsedRows([]);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-excel-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-[22px] border border-gold/30 bg-white p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-cantera" />
              <h2
                id="import-excel-title"
                className="font-heading text-2xl font-semibold text-ink"
              >
                Importar residentes desde Excel
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-stone">
              Carga un archivo .xlsx o .csv para registrar residentes con clave consecutiva (RES###),
              dirección única y QR automático por placa.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar importación"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-sand-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
          {result ? (
            /* Post-import summary */
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok-bg/60 p-4">
                  <CheckCircle2 className="size-7 shrink-0 text-ok" />
                  <div>
                    <p className="text-xs font-semibold tracking-[0.06em] text-ok uppercase">
                      Registrados en base
                    </p>
                    <p className="font-heading text-3xl font-semibold text-ink tabular-nums">
                      {result.added.length}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-bg/60 p-4">
                  <AlertTriangle className="size-7 shrink-0 text-warn" />
                  <div>
                    <p className="text-xs font-semibold tracking-[0.06em] text-warn uppercase">
                      Omitidos por validación
                    </p>
                    <p className="font-heading text-3xl font-semibold text-ink tabular-nums">
                      {result.skipped.length}
                    </p>
                  </div>
                </div>
              </div>

              {result.added.length > 0 && (
                <div className="flex flex-col gap-2 rounded-2xl border border-line bg-sand/45 p-3.5">
                  <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
                    Residentes agregados ({result.added.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.added.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink"
                      >
                        <span className="rounded bg-night px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gold-light">
                          {u.residentKey}
                        </span>
                        {u.name}
                        {u.carCount > 0 && (
                          <span className="text-stone">
                            · {u.carCount} {u.carCount === 1 ? 'QR' : 'QRs'}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.skipped.length > 0 && (
                <div className="flex flex-col gap-2 rounded-2xl border border-bad/25 bg-bad-bg/40 p-3.5">
                  <span className="text-xs font-semibold tracking-[0.06em] text-bad uppercase">
                    Filas omitidas ({result.skipped.length})
                  </span>
                  <ul className="flex flex-col gap-1.5 text-xs">
                    {result.skipped.map((item) => (
                      <li
                        key={`${item.rowNumber}-${item.name}`}
                        className="flex flex-wrap items-baseline gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-ink"
                      >
                        <span className="font-mono font-semibold text-bad">
                          Fila {item.rowNumber}
                        </span>
                        <span className="font-semibold">{item.name}:</span>
                        <span className="text-stone">{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Upload + Preview state */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-cantera-soft/45 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">
                    Columnas aceptadas en tu Excel
                  </span>
                  <span className="text-xs text-stone">
                    Nombre completo · Teléfono · Calle · Número ext · Num Int · Placas (separa varias con coma)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gold/45 bg-white px-3.5 text-xs font-semibold text-ink transition-colors hover:border-gold hover:bg-sand"
                >
                  <Download className="size-3.5 text-cantera" />
                  Descargar plantilla Excel (.xlsx)
                </button>
              </div>

              <div className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-gold/40 bg-sand/45 px-4 py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-night text-gold shadow-sm">
                  <Upload className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {fileName ? fileName : 'Selecciona tu listado de residentes en Excel'}
                  </p>
                  <p className="mt-0.5 text-xs text-stone">
                    {fileName
                      ? `${formatFileSizeEs(fileSize)} · ${parsedRows.length} ${
                          parsedRows.length === 1 ? 'fila detectada' : 'filas detectadas'
                        }`
                      : `Formatos .xlsx o .csv · Máximo 5 MB y ${MAX_EXCEL_IMPORT_ROWS} filas`}
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  id="excel-residents-file"
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <label
                    htmlFor="excel-residents-file"
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-cantera px-4 text-sm font-semibold text-white transition-colors hover:bg-cantera-dark"
                  >
                    <FileSpreadsheet className="size-4" />
                    {isReading
                      ? 'Leyendo archivo...'
                      : fileName
                        ? 'Cambiar archivo'
                        : 'Elegir archivo Excel'}
                  </label>
                  {fileName && (
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="inline-flex h-10 items-center rounded-xl border border-chip-line bg-white px-3 text-xs font-semibold text-ink hover:bg-sand-2"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {parseError && (
                <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
                  {parseError}
                </p>
              )}

              {parsedRows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
                      Vista previa ({parsedRows.length}{' '}
                      {parsedRows.length === 1 ? 'residente' : 'residentes'})
                    </span>
                    <span className="text-xs text-stone">
                      Se validarán nombres, direcciones y placas únicas al guardar
                    </span>
                  </div>
                  <div className="max-h-60 overflow-auto rounded-xl border border-line bg-white">
                    <table className="w-full min-w-[540px] text-left text-xs">
                      <thead className="sticky top-0 border-b border-line bg-sand-2 text-[11px] font-semibold tracking-[0.05em] text-stone uppercase">
                        <tr>
                          <th className="px-3 py-2">Fila</th>
                          <th className="px-3 py-2">Nombre completo</th>
                          <th className="px-3 py-2">Domicilio</th>
                          <th className="px-3 py-2">Teléfono</th>
                          <th className="px-3 py-2">Placas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 50).map((row) => {
                          const addr = row.street
                            ? `${row.street}${row.exteriorNumber ? ` #${row.exteriorNumber}` : ''}${
                                row.interiorNumber ? ` Int. ${row.interiorNumber}` : ''
                              }`
                            : 'Sin casa';
                          return (
                            <tr key={row.rowNumber} className="border-b border-line last:border-0">
                              <td className="px-3 py-2 font-mono text-stone">{row.rowNumber}</td>
                              <td className="px-3 py-2 font-semibold text-ink">
                                {row.name || <span className="text-bad">(Vacío)</span>}
                              </td>
                              <td className="px-3 py-2 text-ink-soft">{addr}</td>
                              <td className="px-3 py-2 text-stone">{row.phone || '—'}</td>
                              <td className="px-3 py-2 font-mono text-ink">
                                {row.plates.length > 0 ? row.plates.join(', ') : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 50 && (
                    <p className="text-xs text-stone">
                      Mostrando las primeras 50 filas de {parsedRows.length}. Todas se procesarán al
                      importar.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-3.5">
          {result ? (
            <>
              <button
                type="button"
                onClick={resetSelection}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
              >
                Subir otro archivo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-cantera px-5 text-sm font-semibold text-white transition-colors hover:bg-cantera-dark"
              >
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={parsedRows.length === 0 || isReading}
                onClick={handleConfirmImport}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cantera px-5 text-sm font-semibold text-white transition-colors hover:bg-cantera-dark disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Upload className="size-4" />
                {parsedRows.length > 0
                  ? `Importar ${parsedRows.length} ${
                      parsedRows.length === 1 ? 'residente' : 'residentes'
                    }`
                  : 'Importar residentes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
