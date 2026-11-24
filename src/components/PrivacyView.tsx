interface PrivacyViewProps {
  onBack: () => void;
}

export function PrivacyView({ onBack }: PrivacyViewProps) {
  return (
    <main className="min-h-dvh bg-sand px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-10">
      <article className="mx-auto flex max-w-2xl flex-col gap-4 text-[15px] leading-relaxed text-ink-soft">
        <button
          type="button"
          onClick={onBack}
          className="w-fit text-sm font-semibold text-cantera hover:underline"
        >
          ← Volver
        </button>

        <h1 className="font-heading text-3xl font-semibold text-ink">
          Aviso de privacidad simplificado
        </h1>

        <p>
          La mesa directiva de <strong>Puerta Cantera Residencial</strong> administra los datos que se registran.
        </p>

        <h2 className="font-heading text-xl font-semibold text-ink">¿Qué datos usamos?</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            De vecinos: nombre, correo, teléfono, casa a la que pertenecen y comprobantes
            de pago de cuotas.
          </li>
          <li>
            De visitantes: nombre del responsable, teléfono (opcional), placa, modelo y color del
            vehículo y número de acompañantes.
          </li>
          <li>Reportes: descripción, ubicación y fotos que el vecino decide subir.</li>
        </ul>

        <h2 className="font-heading text-xl font-semibold text-ink">¿Para qué?</h2>
        <p>
          Para llevar el registro de cuotas de mantenimiento, controlar el acceso al
          fraccionamiento, dar seguimiento a reportes y enviar avisos de la comunidad. No se
          procesan pagos en línea ni se comparten datos.
        </p>

        <h2 className="font-heading text-xl font-semibold text-ink">¿Quién los ve?</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tu casa ve sus propios pagos, visitas y reportes.</li>
          <li>Tesorería y la mesa directiva ven pagos y comprobantes para validarlos.</li>
          <li>
            El personal de caseta solo ve los datos de las visitas del día al validar un pase.
          </li>
          <li>
            Los pases QR no contienen datos personales: solo un código aleatorio que se valida en el
            servidor.
          </li>
        </ul>

        <h2 className="font-heading text-xl font-semibold text-ink">Tus derechos</h2>
        <p>
          Puedes pedir el acceso, corrección o eliminación de tus datos a la mesa directiva. Los comprobantes y
          fotos se guardan en almacenamiento privado y solo se abren con enlaces temporales.
        </p>
      </article>
    </main>
  );
}
