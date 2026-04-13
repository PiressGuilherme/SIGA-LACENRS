/**
 * NavigationButtons — Stepper de setas para o fluxo do laboratório
 *
 * Props:
 *   currentStep — Etapa atual: 'aliquotagem' | 'extracao' | 'pcr' | 'resultados'
 */

import Icon from './Icon';

const STEPS = [
  { key: "importar",    label: "Importar CSV",  path: "/amostras/importar/",    short: "Importar"    },
  { key: "aliquotagem", label: "Aliquotagem",   path: "/amostras/aliquotagem/", short: "Aliquotagem" },
  { key: "extracao",    label: "Extração",      path: "/placas/extracao/",      short: "Extração"    },
  { key: "pcr",         label: "PCR",           path: "/placas/pcr/",           short: "PCR"         },
  { key: "resultados",  label: "Resultados",    path: "/resultados/revisar/",   short: "Resultados"  },
];

// Cores por estado
const COLORS = {
  done:    { bg: "#1e3a5f", hover: "#163059", text: "#fff", shadow: "rgba(30,58,95,0.35)"   },
  active:  { bg: "#1a56db", hover: "#1446c0", text: "#fff", shadow: "rgba(26,86,219,0.45)"  },
  next:    { bg: "#e8edf5", hover: "#d6dff0", text: "#374151", shadow: "rgba(0,0,0,0.12)"   },
};

function getState(stepKey, currentStep) {
  const keys = STEPS.map((s) => s.key);
  const ci = keys.indexOf(currentStep);
  const si = keys.indexOf(stepKey);
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "next";
}

export default function NavigationButtons({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  if (currentIndex === -1) return null;

  const H = 46; // altura do chevron em px
  const notch = 14; // profundidade da seta

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        marginBottom: "1.75rem",
        userSelect: "none",
        // sombra geral suave
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.13))",
      }}
    >
      {STEPS.map((step, i) => {
        const state = getState(step.key, currentStep);
        const c = COLORS[state];
        const isFirst = i === 0;
        const isLast = i === STEPS.length - 1;
        const isActive = state === "active";

        return (
          <a
            key={step.key}
            href={step.path}
            title={`Ir para ${step.label}`}
            style={{
              // geometria do chevron via clip-path
              clipPath: isFirst
                ? `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%)`
                : isLast
                ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${notch}px 50%)`
                : `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%, ${notch}px 50%)`,

              // tamanho e espaçamento
              height: `${H}px`,
              padding: isFirst
                ? `0 ${notch + 18}px 0 20px`
                : isLast
                ? `0 20px 0 ${notch + 18}px`
                : `0 ${notch + 18}px 0 ${notch + 18}px`,
              marginLeft: i === 0 ? 0 : "-1px",

              // visual
              background: c.bg,
              color: c.text,
              textDecoration: "none",
              fontWeight: isActive ? 700 : 500,
              fontSize: isActive ? "0.92rem" : "0.84rem",
              letterSpacing: isActive ? "0.01em" : "normal",
              whiteSpace: "nowrap",
              flex: isActive ? "1.3 0 auto" : "1 0 auto",
              minWidth: 0,

              // layout interno
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",

              // transição
              transition: "background 0.18s, transform 0.15s, box-shadow 0.15s",
              cursor: "pointer",
              position: "relative",
              zIndex: isActive ? 2 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = c.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = c.bg;
            }}
          >
            {/* Número da etapa */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: isActive
                  ? "rgba(255,255,255,0.25)"
                  : state === "done"
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(0,0,0,0.08)",
                fontSize: "0.7rem",
                fontWeight: 700,
                flexShrink: 0,
                color: c.text,
              }}
            >
              {state === "done" ? <Icon name="check" /> : i + 1}
            </span>

            {/* Label */}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {step.label}
            </span>
          </a>
        );
      })}
    </div>
  );
}
