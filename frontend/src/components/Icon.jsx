import { 
  HiCheck, 
  HiX, 
  HiExclamation, 
  HiFolder, 
  HiPencil 
} from 'react-icons/hi';

/**
 * Componente centralizado para ícones do sistema
 * Abstrai a biblioteca de ícones para facilitar manutenção futura
 * 
 * @param {string} name - Nome do ícone: check, close, warning, folder, edit
 * @param {string|number} size - Tamanho do ícone (padrão: 1em = mesmo tamanho do texto)
 * @param {string} className - Classes CSS adicionais
 * @param {object} props - Demais propriedades repassadas para o ícone
 */
export default function Icon({ name, size = '1em', className = '', ...props }) {
  const icons = {
    check: HiCheck,
    close: HiX,
    warning: HiExclamation,
    folder: HiFolder,
    edit: HiPencil
  };

  const IconComponent = icons[name] || HiExclamation;

  return (
    <IconComponent 
      size={size} 
      className={`inline align-middle ${className}`}
      {...props} 
    />
  );
}