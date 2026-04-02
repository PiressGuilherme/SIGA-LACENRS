/**
 * MetadataCard — Card de resumo de entidade (Amostra, Placa)
 * 
 * Exibe pares label:valor de forma organizada.
 */

export default function MetadataCard({
  title,
  subtitle,
  badge,
  items = [],
  actions = [],
  className = '',
}) {
  return (
    <div className={`bg-white rounded-lg border border-neutral-200 shadow-sm p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          {title && (
            <h3 className="text-base font-bold text-neutral-900 font-mono">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-neutral-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <div className="ml-3 flex-shrink-0">
            {badge}
          </div>
        )}
      </div>

      {/* Divider */}
      {items.length > 0 && (
        <div className="border-t border-neutral-100 my-3" />
      )}

      {/* Items */}
      {items.length > 0 && (
        <dl className="space-y-2.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-baseline gap-2">
              <dt className="text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[120px] flex-shrink-0">
                {item.label}
              </dt>
              <dd className={`text-sm text-neutral-900 ${item.mono ? 'font-mono font-medium' : 'font-medium'}`}>
                {item.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <>
          {(items.length > 0) && (
            <div className="border-t border-neutral-100 my-4" />
          )}
          <div className="flex gap-2 flex-wrap">
            {actions}
          </div>
        </>
      )}
    </div>
  )
}