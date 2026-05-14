'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import styles from './SearchableSelect.module.css';

type SearchableOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
};

type SearchableSelectProps = {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  addActionLabel?: string;
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  onCreateOption?: (value: string) => Promise<string | void> | string | void;
};

export default function SearchableSelect({
  label,
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  emptyText = 'No matching options',
  addActionLabel = 'Add New',
  value,
  options,
  onChange,
  onCreateOption,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const haystacks = [option.label, ...(option.keywords || [])];
      return haystacks.some((entry) => entry.toLowerCase().includes(normalizedQuery));
    });
  }, [options, query]);

  const canCreate = Boolean(onCreateOption && query.trim());

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className={styles.wrapper} ref={rootRef}>
      {label ? <label className={styles.label}>{label}</label> : null}

      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          setOpen((previous) => {
            const next = !previous;
            if (!next) {
              setQuery('');
            }
            return next;
          });
        }}
      >
        <span className={selected ? styles.value : styles.placeholder}>
          <span className={styles.triggerLabel}>{selected?.label || placeholder}</span>
          {selected?.description ? <span className={styles.triggerDescription}>{selected.description}</span> : null}
        </span>
        <ChevronDown size={16} className={open ? styles.iconOpen : styles.icon} />
      </button>

      {open ? (
        <div className={styles.dropdown}>
          <div className={styles.searchRow}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.options}>
            {filteredOptions.length === 0 ? (
              <div className={styles.empty}>{emptyText}</div>
            ) : filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === value ? styles.optionActive : styles.option}
                onClick={() => {
                  onChange(option.value);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <div className={styles.optionContent}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.description ? <span className={styles.optionDescription}>{option.description}</span> : null}
                </div>
              </button>
            ))}

            {canCreate ? (
              <button
                type="button"
                className={styles.addOption}
                disabled={creating}
                onClick={async () => {
                  if (!onCreateOption) return;
                  setCreating(true);
                  try {
                    const createdValue = await onCreateOption(query.trim());
                    onChange(createdValue || query.trim());
                    setQuery('');
                    setOpen(false);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? 'Adding...' : `${addActionLabel}: ${query.trim()}`}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
