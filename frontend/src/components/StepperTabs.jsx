/**
 * StepperTabs — abas em formato de flecha.
 *
 * Props:
 *   tabs      — [{ id, label }]
 *   activeTab — id da aba ativa
 *   onChange  — (id) => void
 *   colors    — paleta opcional { done, active, next } onde cada estado tem
 *               { bg, hover, text }. Default = paleta azul (Extração).
 */

const DEFAULT_COLORS = {
  done:   { bg: "#1e3a5f", hover: "#163059", text: "#fff" },
  active: { bg: "#1a56db", hover: "#1446c0", text: "#fff" },
  next:   { bg: "#e8edf5", hover: "#d6dff0", text: "#374151" },
};

export default function StepperTabs({ tabs, activeTab, onChange, colors = DEFAULT_COLORS }) {
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);
  const H = 46;
  const notch = 14;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        marginBottom: "1.5rem",
        userSelect: "none",
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.13))",
        alignSelf: "flex-start",
      }}
    >
      {tabs.map((tab, i) => {
        const isFirst = i === 0;
        const isLast = i === tabs.length - 1;
        const isActive = i === activeIndex;
        const state = i < activeIndex ? "done" : isActive ? "active" : "next";
        const c = colors[state];

        const clipPath = isLast
          ? isFirst
            ? "none"
            : `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${notch}px 50%)`
          : isFirst
          ? `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%)`
          : `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%, ${notch}px 50%)`;

        const padding = isLast
          ? isFirst
            ? "0 20px"
            : `0 20px 0 ${notch + 18}px`
          : isFirst
          ? `0 ${notch + 18}px 0 20px`
          : `0 ${notch + 18}px 0 ${notch + 18}px`;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            title={tab.label}
            style={{
              clipPath,
              height: `${H}px`,
              padding,
              marginLeft: i === 0 ? 0 : "-1px",
              background: c.bg,
              color: c.text,
              border: "none",
              textDecoration: "none",
              fontWeight: isActive ? 700 : 500,
              fontSize: isActive ? "0.92rem" : "0.84rem",
              letterSpacing: isActive ? "0.01em" : "normal",
              whiteSpace: "nowrap",
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              transition: "background 0.18s",
              cursor: "pointer",
              position: "relative",
              zIndex: isActive ? 2 : 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = c.bg)}
          >
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
              {i + 1}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const STEPPER_COLORS = {
  extracao: DEFAULT_COLORS,
  pcr: {
    done:   { bg: "#065f46", hover: "#064e3b", text: "#fff" },
    active: { bg: "#059669", hover: "#047857", text: "#fff" },
    next:   { bg: "#e6f4ee", hover: "#d1ece0", text: "#374151" },
  },
};
