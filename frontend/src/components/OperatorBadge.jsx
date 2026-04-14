import Button from "./Button";

/**
 * Componente reutilizável para exibir o operador atualmente logado
 * Renderiza condicionalmente: não aparece se operador for null/undefined
 */
export default function OperatorBadge({ operador, onTrocarOperador }) {
  if (!operador) return null;

  return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg p-2.5 mb-4">
      <span className="text-sm text-green-800 font-semibold">
        Operador: {operador.nome_completo}
      </span>

      {operador.perfil && (
        <span className="text-xs bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full font-medium">
          {operador.perfil}
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onTrocarOperador}
        className="ml-auto"
      >
        Trocar operador
      </Button>
    </div>
  );
}
