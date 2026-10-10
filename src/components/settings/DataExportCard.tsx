import { Download, FileJson, Upload } from 'lucide-react';
import { Debt, Payment } from '../../types';
import { downloadBlob } from '../../utils/storage';
import { btn, SettingsCard } from './SettingsCard';

interface DataExportCardProps {
  deudas: Debt[];
  pagos: Payment[];
  clientLimits: Record<string, number>;
  onImportBackup: (deudas: Debt[], pagos: Payment[], limits: Record<string, number>) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// A copy of everything in a file on this device (and restoring one in local mode).
export default function DataExportCard({ deudas, pagos, clientLimits, onImportBackup, onNotify }: DataExportCardProps) {
  const exportFile = () => {
    const data = { version: 'preztame-v3', timestamp: new Date().toISOString(), deudas, pagos, clientLimits };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `preztame-respaldo-${new Date().toISOString().split('T')[0]}.json`);
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(String(event.target?.result ?? ''));
        if (!Array.isArray(parsed.deudas)) {
          onNotify('El archivo no es un respaldo de Preztame: no trae la lista de préstamos.', 'error');
          return;
        }
        if (window.confirm('¿Importar este respaldo? Reemplaza los datos de prueba guardados en este navegador.')) {
          onImportBackup(parsed.deudas, parsed.pagos || [], parsed.clientLimits || {});
        }
      } catch {
        onNotify('No se pudo leer el archivo de respaldo.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <SettingsCard icon={FileJson} title="Copia en este dispositivo" description="Descarga un archivo con todos tus préstamos y abonos. Sirve para guardarlo aparte o para pasar los datos de prueba a otro navegador.">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportFile} className={btn.tonal}>
          <Download className="h-4 w-4" /> Descargar copia (.json)
        </button>
        <label className={btn.outlined}>
          <Upload className="h-4 w-4" /> Importar
          <input type="file" accept=".json,application/json" onChange={importFile} className="sr-only" />
        </label>
      </div>
    </SettingsCard>
  );
}
