export default function StatusBadge({ status, statusMap }) {
  const badge = statusMap[status] || {};
  const bgClass = typeof badge.bg === 'string'
    ? (badge.bg.startsWith('bg-') ? badge.bg : `bg-[${badge.bg}]`)
    : badge.class;

  return (
    <span className={`${bgClass || 'bg-gray-400'} text-white px-2 py-1 rounded text-xs font-medium inline-block`}>
      {badge.label || status}
    </span>
  );
}
