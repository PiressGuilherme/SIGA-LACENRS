export default function FeedbackBlock({ feedback, children }) {
  if (!feedback) return null;

  const styles = {
    sucesso: 'bg-green-100 text-green-800 border border-green-300',
    aviso: 'bg-amber-100 text-amber-800 border border-amber-300',
    erro: 'bg-red-100 text-red-800 border border-red-300',
  };

  return (
    <div className={`p-3 rounded-md mb-6 ${styles[feedback.tipo] || styles.aviso}`}>
      <div className="flex items-center gap-3">
        <span>{feedback.msg}</span>
        {children}
      </div>
    </div>
  );
}
