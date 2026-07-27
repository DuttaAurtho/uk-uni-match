// Small hand-rolled inline icon set (stroke-based, 1.5px) so the app has
// zero icon-library dependency.

function base(props) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  };
}

export function IconGraduationCap(props) {
  return (
    <svg {...base(props)}>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
      <path d="M22 10v6" />
    </svg>
  );
}

export function IconTarget(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function IconChat(props) {
  return (
    <svg {...base(props)}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2Z" />
      <circle cx="16.5" cy="14.5" r="1.5" />
    </svg>
  );
}

export function IconBook(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

export function IconPin(props) {
  return (
    <svg {...base(props)}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconSearch(props) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

export function IconSpinner(props) {
  return (
    <svg
      {...base(props)}
      className={`animate-spin ${props.className || ""}`}
      strokeWidth={2.5}
    >
      <path d="M21 12a9 9 0 1 1-9-9" />
    </svg>
  );
}

export function IconChevronDown(props) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconSparkle(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

export function IconCalendar(props) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}

export function IconArrowRight(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconInbox(props) {
  return (
    <svg {...base(props)}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  );
}

export function IconAlert(props) {
  return (
    <svg {...base(props)}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function IconAward(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="6" />
      <path d="m9 13.5-1.5 7L12 18l4.5 2.5-1.5-7" />
    </svg>
  );
}

export function IconSort(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  );
}

export function IconLayoutGrid(props) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconLayoutList(props) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="4" rx="1.2" />
      <rect x="3" y="10" width="18" height="4" rx="1.2" />
      <rect x="3" y="16" width="18" height="4" rx="1.2" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconSend(props) {
  return (
    <svg {...base(props)}>
      <path d="m3 3 18 9-18 9 4-9-4-9Z" />
    </svg>
  );
}

export function IconExternalLink(props) {
  return (
    <svg {...base(props)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

export function IconUser(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1c0-3.3 3.6-6 8-6s8 2.7 8 6v1" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEdit(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconStar(props) {
  return (
    <svg {...base(props)}>
      <path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.1-6.4-3.6-6.4 3.6 1.4-7.1-5.3-5 7.2-.9Z" />
    </svg>
  );
}

export function IconShuffle(props) {
  return (
    <svg {...base(props)}>
      <path d="m18 4 3 3-3 3" />
      <path d="M2 7h4.5c1.4 0 2.7.7 3.5 1.9L15 17.1c.8 1.2 2.1 1.9 3.5 1.9H21" />
      <path d="m18 20 3-3-3-3" />
      <path d="M2 17h4.5c1.4 0 2.7-.7 3.5-1.9l.6-.9" />
      <path d="M12.6 8.9 13 8" />
    </svg>
  );
}
