import { useState } from 'react';
import { Check, Copy, ExternalLink, FileCode2 } from 'lucide-react';
import appsScriptSource from '../../../apps-script/Code.gs?raw';
import { Faq, SettingsCard } from './SettingsCard';

export const SCRIPT_VERSION = Number(/API_VERSION = (\d+)/.exec(appsScriptSource)?.[1] ?? 0);

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="h-7 w-7 shrink-0 rounded-full bg-primary-container text-on-primary-container text-sm font-semibold flex items-center justify-center">{n}</span>
      <div className="min-w-0 flex-1 text-sm space-y-2">
        <p className="font-semibold text-on-surface">{title}</p>
        <div className="text-on-surface-variant leading-relaxed space-y-2">{children}</div>
      </div>
    </li>
  );
}

// Step by step guide to install (or update) the Apps Script, with the code.
export default function ScriptSetupCard({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  // The script ships with a placeholder; the user's key is embedded on copy.
  const code = appsScriptSource.replace('__DEUDAFLOW_TOKEN__', token.trim() || '__DEUDAFLOW_TOKEN__');

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SettingsCard icon={FileCode2} title={`Conectar o actualizar Google Sheets (Apps Script v${SCRIPT_VERSION})`} description="Hazlo una vez al conectar la hoja, y de nuevo cuando la app te pida actualizar el script.">
      <ol className="space-y-5">
        <Step n={1} title="Abre tu hoja de Google Sheets">
          <p>Usa la hoja donde ya tienes tus datos, o crea una en blanco en <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-primary font-semibold inline-flex items-center gap-0.5">Google Sheets <ExternalLink className="h-3 w-3" /></a>.</p>
        </Step>
        <Step n={2} title="Abre Apps Script">
          <p>En el menú de la hoja: <strong>Extensiones → Apps Script</strong>.</p>
        </Step>
        <Step n={3} title="Reemplaza todo el código por este">
          <p>Borra lo que haya en el editor y pega este código. Ya incluye tu clave de acceso y crea las hojas que falten (Deudas, Pagos, Limites, Usuarios, Clientes e Historial) sin tocar tus datos.</p>
          <div className="relative rounded-2xl bg-inverse-surface text-inverse-on-surface">
            <button type="button" onClick={copy} className="m3-state absolute top-2 right-2 h-9 px-3 rounded-full bg-primary text-on-primary text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              {copied ? <><Check className="h-3.5 w-3.5" /> ¡Copiado!</> : <><Copy className="h-3.5 w-3.5" /> Copiar código</>}
            </button>
            <pre className="max-h-56 overflow-auto p-4 pt-12 text-xs font-mono leading-relaxed"><code>{code}</code></pre>
          </div>
        </Step>
        <Step n={4} title="Guarda y publica">
          <p>Toca el ícono de guardar. Luego:</p>
          <p><strong>Si ya estaba publicado:</strong> Implementar → Administrar implementaciones → ✏️ Editar → Versión: <strong>Nueva versión</strong> → Implementar. Así la URL no cambia.</p>
          <p><strong>Si es la primera vez:</strong> Implementar → Nueva implementación → tipo <strong>Aplicación web</strong>, ejecutar como <strong>Tú</strong>, acceso <strong>Cualquiera</strong>. Copia la URL que termina en /exec y pégala en "Dónde se guardan tus datos".</p>
          <p>Google te pedirá permisos (hoja, correo, Drive y tareas programadas). Si dice "Google no verificó esta app", toca <strong>Configuración avanzada → Ir a … (no seguro)</strong>: es tu propio script.</p>
        </Step>
      </ol>

      <div className="space-y-2 pt-2">
        <p className="text-sm font-semibold">Preguntas frecuentes</p>
        <Faq q="¿Es seguro si el acceso dice «Cualquiera»?">
          <p>Sí. El script corre en tu cuenta de Google y solo responde a quien tenga tu clave de acceso; sin ella no se puede leer ni cambiar nada. Si crees que la clave se filtró, cambia la clave, copia el código de nuevo y publica una nueva versión.</p>
        </Faq>
        <Faq q="¿Puedo agregar columnas a la hoja?">
          <p>Sí. El script busca las columnas por su nombre en la fila 1. Mientras no cambies esos encabezados (id, contacto, monto…), puedes agregar las columnas que quieras.</p>
        </Faq>
        <Faq q="Sale «Failed to fetch» o error de conexión">
          <p>Casi siempre es la primera vez: abre la URL /exec en el navegador y acepta los permisos. Revisa también que el acceso de la implementación sea «Cualquiera».</p>
        </Faq>
        <Faq q="La URL no funciona">
          <p>La URL correcta tiene <code className="font-mono">/macros/s/…/exec</code>. Si tiene <code className="font-mono">/edit</code> es la de la hoja, no la del script.</p>
        </Faq>
      </div>
    </SettingsCard>
  );
}
