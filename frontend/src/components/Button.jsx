/**
 * Button — Componente de botão reutilizável do SIGA-LACEN
 *
 * Variantes semânticas:
 *   primary   — Ação principal da tela (Confirmar, Salvar, Submeter)  cor: vermelho institucional
 *   secondary — Navegação para próxima etapa / ações secundárias      cor: azul escuro
 *   ghost     — Voltar, Início, Cancelar                              cor: neutro com borda
 *   danger    — Excluir, Remover                                      cor: vermelho vivo
 *
 * Props:
 *   variant   — 'primary' | 'secondary' | 'ghost' | 'danger'  (default: 'primary')
 *   size      — 'sm' | 'md' | 'lg'                            (default: 'md')
 *   icon      — Elemento React à esquerda do label (opcional)
 *   iconRight — Elemento React à direita do label (opcional)
 *   disabled  — Boolean
 *   onClick   — Handler
 *   type      — 'button' | 'submit' | 'reset'                 (default: 'button')
 *   className — Classes extras para override pontual
 */

const VARIANTS = {
  primary: {
    base:     'bg-[#7b1020] text-white border border-transparent',
    hover:    'hover:bg-[#5c0c18]',
    shadow:   'shadow-[0_2px_8px_rgba(123,16,32,0.25)]',
    hoverShadow: 'hover:shadow-[0_4px_16px_rgba(123,16,32,0.35)]',
  },
  secondary: {
    base:     'bg-[#1a3a5c] text-white border border-transparent',
    hover:    'hover:bg-[#122a45]',
    shadow:   'shadow-[0_2px_8px_rgba(26,58,92,0.2)]',
    hoverShadow: 'hover:shadow-[0_4px_16px_rgba(26,58,92,0.3)]',
  },
  ghost: {
    base:     'bg-transparent text-[#374151] border border-[#d1d5db]',
    hover:    'hover:bg-[#f3f4f6] hover:border-[#9ca3af]',
    shadow:   'shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
    hoverShadow: 'hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
  },
  danger: {
    base:     'bg-[#dc2626] text-white border border-transparent',
    hover:    'hover:bg-[#b91c1c]',
    shadow:   'shadow-[0_2px_8px_rgba(220,38,38,0.2)]',
    hoverShadow: 'hover:shadow-[0_4px_16px_rgba(220,38,38,0.3)]',
  },
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        // Layout
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-all duration-200 ease-out',
        // Hover: leve elevação
        'hover:-translate-y-px active:translate-y-0',
        // Variante
        v.base, v.hover, v.shadow, v.hoverShadow,
        // Tamanho
        s,
        // Disabled
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  )
}
