/**
 * Design System — SIGA-LACENRS
 * Re-exports de todos os tokens e componentes do design system.
 */

// Tokens
export {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  STATUS_CONFIG,
  WELL_COLORS,
} from './tokens.js'

export { default as tokens } from './tokens.js'

// Componentes
export { default as Button } from './components/Button.jsx'
export { default as StatusBadge } from './components/StatusBadge.jsx'
export { default as BarcodeInput } from './components/BarcodeInput.jsx'
export { default as ConfirmDialog } from './components/ConfirmDialog.jsx'
export { default as MetadataCard } from './components/MetadataCard.jsx'
export { default as CrachaInput } from './components/CrachaInput.jsx'
export { default as DataGrid } from './components/DataGrid.jsx'
export { default as PlateViewer } from './components/PlateViewer.jsx'
export { default as SearchInput } from './components/SearchInput.jsx'
export { default as FilterPanel } from './components/FilterPanel.jsx'
