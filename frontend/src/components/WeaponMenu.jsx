import { useEffect, useRef, useState } from 'react';

function WeaponMenu({ options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const summary = selected.length === 0 ? 'No weapons' : selected.length <= 2 ? selected.join(', ') : `${selected.length} weapons`;

  return (
    <div className="weapon-menu" ref={rootRef}>
      <button type="button" className={`menu-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="true" title="Weapons whose skins are shown on each player">
        <span className="menu-trigger-label">Skins</span>
        <span>{summary}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="menu-panel" role="group" aria-label="Weapons to show skins for">
          <p className="menu-panel-title">Show skins for</p>
          <div className="weapon-filters">
            {options.map((weapon) => (
              <button
                key={weapon}
                type="button"
                aria-pressed={selected.includes(weapon)}
                className={`weapon-chip ${selected.includes(weapon) ? 'active' : ''}`}
                onClick={() => onToggle(weapon)}
              >
                {weapon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WeaponMenu;
