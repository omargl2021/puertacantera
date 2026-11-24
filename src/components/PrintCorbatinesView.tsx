import { useMemo, useState } from 'react';
import {
  Car,
  CheckSquare,
  ChevronLeft,
  Download,
  LayoutGrid,
  Printer,
  QrCode,
  Search,
  Square,
} from 'lucide-react';
import type {
  AppRoute,
  CorbatinItem,
  PortalDatabase,
  ScannedResidentData,
} from '../types/portal';
import {
  chunkCorbatines,
  createScannedResidentData,
  formatHouseLabel,
  formatVehicleSummary,
  getAllCorbatines,
} from '../utils/portalLogic';
import {
  CORBATIN_HEIGHT_CM,
  CORBATIN_WIDTH_CM,
  CorbatinCard,
  exportCorbatinPng,
} from './CorbatinCard';

interface PrintCorbatinesViewProps {
  db: PortalDatabase;
  isAdminLayout?: boolean;
  onNavigate?: (route: AppRoute) => void;
  onScanQr: (data: ScannedResidentData) => void;
  onNotify: (message: string) => void;
}

export function PrintCorbatinesView({
  db,
  isAdminLayout = false,
  onNavigate,
  onScanQr,
  onNotify,
}: PrintCorbatinesViewProps) {
  const allItems = useMemo(() => getAllCorbatines(db), [db]);
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState<1 | 4>(4);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return allItems;
    return allItems.filter(({ user, house, vehicle }) => {
      const searchable = [
        user.residentKey,
        user.name,
        user.email,
        user.phone ?? '',
        house ? formatHouseLabel(house) : '',
        vehicle.label,
        vehicle.code,
        vehicle.plate ?? '',
        vehicle.model ?? '',
        vehicle.color ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [allItems, normalizedQuery]);

  // null selectedIds means "all filtered items selected" by default
  const activeSelectionSet = useMemo(() => {
    if (selectedIds === null) {
      return new Set(filteredItems.map((i) => i.id));
    }
    return new Set(selectedIds);
  }, [filteredItems, selectedIds]);

  const itemsToPrint = useMemo(
    () => filteredItems.filter((item) => activeSelectionSet.has(item.id)),
    [filteredItems, activeSelectionSet],
  );

  const pages = useMemo(() => chunkCorbatines(itemsToPrint, perPage), [itemsToPrint, perPage]);

  const toggleItem = (id: string) => {
    const next = new Set(activeSelectionSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(Array.from(next));
  };

  const toggleAllFiltered = () => {
    const allSelected =
      filteredItems.length > 0 && filteredItems.every((i) => activeSelectionSet.has(i.id));
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(null);
    }
  };

  const triggerBatchPrint = () => {
    if (itemsToPrint.length === 0) {
      onNotify('Selecciona al menos un corbatín para imprimir.');
      return;
    }
    onNotify(
      `Preparando impresión: ${itemsToPrint.length} ${itemsToPrint.length === 1 ? 'corbatín' : 'corbatines'} (${perPage} por hoja · ${CORBATIN_HEIGHT_CM} × ${CORBATIN_WIDTH_CM} cm).`,
    );
    document.body.dataset.printMode = 'corbatin-batch';
    const cleanup = () => {
      delete document.body.dataset.printMode;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 1200);
  };

  const handleDownloadSinglePng = async (item: CorbatinItem) => {
    setDownloadingId(item.id);
    try {
      const dataUrl = await exportCorbatinPng(item.user, item.vehicle, item.house);
      const link = document.createElement('a');
      const slug = `${item.user.residentKey}-${item.user.name}-${item.vehicle.label}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      link.href = dataUrl;
      link.download = `corbatin-9x19cm-${slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onNotify(
        `Corbatín de ${item.user.name} (${item.vehicle.label}) descargado en 19 × 9 cm (300 DPI).`,
      );
    } catch {
      onNotify('No se pudo generar el PNG del corbatín.');
    } finally {
      setDownloadingId(null);
    }
  };

  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((i) => activeSelectionSet.has(i.id));

  return (
    <div className={isAdminLayout ? 'flex flex-col gap-6' : 'flex flex-col gap-5 pb-10'}>
      {/* Page Header */}
      {isAdminLayout ? (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
              Comunidad · Accesos vehiculares
            </span>
            <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">
              Imprimir corbatín
            </h1>
            <p className="text-sm text-stone">
              Todos los corbatines registrados en medida exacta{' '}
              <strong className="text-ink">
                {CORBATIN_HEIGHT_CM} cm alto × {CORBATIN_WIDTH_CM} cm ancho
              </strong>
              . Imprime 1 o 4 por hoja, o toca cualquier QR para abrir la ventana flotante del residente.
            </p>
          </div>
        </header>
      ) : (
        <header className="flex flex-col gap-2 px-4 pt-[max(env(safe-area-inset-top),2.25rem)] pb-1 md:px-6">
          <div className="flex items-center gap-1">
            {onNavigate && (
              <button
                type="button"
                aria-label="Volver"
                onClick={() => onNavigate('/')}
                className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink hover:bg-white/70"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="font-heading text-[28px] leading-tight font-semibold text-ink">
                Imprimir corbatín
              </h1>
              <p className="text-xs text-stone">
                Medida exacta {CORBATIN_HEIGHT_CM} cm alto × {CORBATIN_WIDTH_CM} cm ancho · 1 o 4 por hoja
              </p>
            </div>
          </div>
        </header>
      )}

      <div className={isAdminLayout ? 'flex flex-col gap-5' : 'flex flex-col gap-4 px-4 md:px-6'}>
        {/* Controls Toolbar */}
        <section className="flex flex-col gap-3.5 rounded-[20px] border border-gold/30 bg-white p-4 shadow-[0_6px_18px_rgba(23,20,17,0.05)] sm:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone" />
              <input
                type="search"
                aria-label="Buscar corbatín por clave, residente, casa o placa"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por clave (RES001), residente, dirección o placa..."
                className="h-11 w-full rounded-xl border border-input bg-sand/45 pr-3.5 pl-10 text-sm font-medium text-ink outline-none placeholder:text-stone/60 focus-visible:border-cantera focus-visible:bg-white"
              />
            </div>

            {/* 1 por hoja vs 4 por hoja selector */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="radiogroup"
                aria-label="Corbatines por hoja"
                className="inline-flex rounded-xl border border-line bg-sand p-1"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={perPage === 1}
                  onClick={() => setPerPage(1)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                    perPage === 1
                      ? 'bg-night text-gold-light shadow-2xs'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <QrCode className="size-4" />
                  1 por hoja
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={perPage === 4}
                  onClick={() => setPerPage(4)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                    perPage === 4
                      ? 'bg-night text-gold-light shadow-2xs'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <LayoutGrid className="size-4" />
                  4 por hoja
                </button>
              </div>

              <button
                type="button"
                onClick={triggerBatchPrint}
                disabled={itemsToPrint.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cantera px-5 text-sm font-semibold text-white transition-colors hover:bg-cantera-dark active:translate-y-px disabled:opacity-50"
              >
                <Printer className="size-4" />
                Imprimir ({itemsToPrint.length})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-stone">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="inline-flex items-center gap-1.5 font-semibold text-ink transition-colors hover:text-cantera"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="size-4 text-cantera" />
                ) : (
                  <Square className="size-4 text-stone" />
                )}
                {allFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
              <span>
                {itemsToPrint.length} de {filteredItems.length} seleccionados ·{' '}
                <strong className="text-ink">
                  {pages.length} {pages.length === 1 ? 'hoja' : 'hojas'}
                </strong>{' '}
                ({perPage} por hoja)
              </span>
            </div>

            <span className="font-mono font-semibold text-cantera">
              Medida: {CORBATIN_HEIGHT_CM} cm alto × {CORBATIN_WIDTH_CM} cm ancho
            </span>
          </div>
        </section>

        {/* All Corbatines Catalog Grid */}
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-chip-line bg-white/80 px-4 py-12 text-center">
            <p className="text-sm font-semibold text-ink">No hay corbatines disponibles</p>
            <p className="mt-1 text-xs text-stone">
              Registra residentes con al menos un automóvil para generar sus corbatines con código QR.
            </p>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const selected = activeSelectionSet.has(item.id);
              const specs = formatVehicleSummary(item.vehicle);
              const scanData = createScannedResidentData(item.user, item.vehicle, item.house);
              return (
                <article
                  key={item.id}
                  className={`flex flex-col gap-3 rounded-[20px] border bg-white p-4 transition-all ${
                    selected
                      ? 'border-gold/60 shadow-[0_8px_22px_rgba(138,100,27,0.10)]'
                      : 'border-line opacity-80'
                  }`}
                >
                  {/* Card Header with checkbox */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    >
                      {selected ? (
                        <CheckSquare className="mt-0.5 size-4 shrink-0 text-cantera" />
                      ) : (
                        <Square className="mt-0.5 size-4 shrink-0 text-stone" />
                      )}
                      <div className="flex min-w-0 flex-col">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-night px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gold-light">
                            {item.user.residentKey}
                          </span>
                          <span className="truncate text-sm font-semibold text-ink">
                            {item.user.name}
                          </span>
                        </div>
                        <span className="truncate text-xs text-stone">
                          {item.house ? formatHouseLabel(item.house) : 'Sin casa asignada'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Corbatín visual preview */}
                  <div className="mx-auto w-full max-w-[180px] overflow-hidden rounded-xl border border-line shadow-xs">
                    <CorbatinCard
                      user={item.user}
                      vehicle={item.vehicle}
                      house={item.house}
                      sizing="fluid"
                      onScanQr={onScanQr}
                    />
                  </div>

                  {/* Vehicle info */}
                  <div className="flex flex-col gap-0.5 rounded-xl bg-sand/70 px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                      <Car className="size-3.5 shrink-0 text-cantera" />
                      {item.vehicle.label}
                      {specs ? ` · ${specs}` : ''}
                    </span>
                    <span className="font-mono text-[11px] text-stone">{item.vehicle.code}</span>
                  </div>

                  {/* Quick actions per corbatín */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onScanQr(scanData)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-cantera/35 bg-cantera-soft/60 px-2.5 text-xs font-semibold text-cantera transition-colors hover:bg-cantera hover:text-white"
                    >
                      <QrCode className="size-3.5" />
                      Escanear QR
                    </button>
                    <button
                      type="button"
                      disabled={downloadingId === item.id}
                      onClick={() => handleDownloadSinglePng(item)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-chip-line bg-white px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-sand-2 disabled:opacity-50"
                    >
                      <Download className="size-3.5" />
                      {downloadingId === item.id ? 'PNG...' : 'PNG 9×19'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Sheet Layout Preview & Dedicated Print Container (1 or 4 per sheet at exact 19cm x 9cm) */}
        {pages.length > 0 && (
          <section className="flex flex-col gap-3 pt-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-xl font-semibold text-ink">
                Vista previa de impresión ({perPage === 1 ? '1 por hoja' : '4 por hoja'})
              </h2>
              <span className="text-xs text-stone">
                Al imprimir, cada corbatín mide exactamente {CORBATIN_HEIGHT_CM} cm de alto ×{' '}
                {CORBATIN_WIDTH_CM} cm de ancho.
              </span>
            </div>

            <div className="corbatin-print-root flex flex-col gap-5" data-testid="corbatin-sheet-preview">
              {pages.map((pageItems, pageIndex) => (
                <div
                  key={pageIndex}
                  data-per-page={perPage}
                  className="corbatin-print-page flex flex-col gap-3 rounded-[20px] border border-line bg-white p-4 shadow-xs sm:p-5"
                >
                  <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-semibold text-stone print:hidden">
                    <span>
                      Hoja {pageIndex + 1} de {pages.length}
                    </span>
                    <span>
                      {pageItems.length} {pageItems.length === 1 ? 'corbatín' : 'corbatines'} ·{' '}
                      {CORBATIN_HEIGHT_CM} × {CORBATIN_WIDTH_CM} cm c/u
                    </span>
                  </div>

                  <div
                    className={
                      perPage === 1
                        ? 'mx-auto grid w-full max-w-[240px] grid-cols-1 gap-4 print:max-w-none print:grid-cols-1'
                        : 'mx-auto grid w-full max-w-[480px] grid-cols-2 gap-3 sm:gap-4 print:max-w-none print:grid-cols-2'
                    }
                  >
                    {pageItems.map((item) => (
                      <div
                        key={item.id}
                        className="corbatin-print-card overflow-hidden rounded-lg border border-dashed border-chip-line print:border-stone/40"
                      >
                        <CorbatinCard
                          user={item.user}
                          vehicle={item.vehicle}
                          house={item.house}
                          sizing="fluid"
                          onScanQr={onScanQr}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
