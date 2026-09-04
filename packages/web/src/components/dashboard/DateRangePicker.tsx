'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DateRangeState,
  DatePreset,
  computeDatePresets,
  calculateCustomComparison,
} from '@/lib/date-utils';

export type { DateRangeState, DatePreset };

interface DateRangePickerProps {
  dateRange: DateRangeState;
  onChange: (newRange: DateRangeState) => void;
}

export default function DateRangePicker({ dateRange, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGranularityOpen, setIsGranularityOpen] = useState(false);
  
  // Dynamically compute presets relative to current date
  const { presets } = useMemo(() => computeDatePresets(), []);

  // Default selected preset matches 'Last 30 Days' or dateRange
  const [selectedPreset, setSelectedPreset] = useState('Last 30 Days');
  
  // Interactive calendar month state (Current viewing month, dynamically initialized to current date)
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  
  // Custom date selection state
  const [customStartDay, setCustomStartDay] = useState<number | null>(null);
  const [customEndDay, setCustomEndDay] = useState<number | null>(null);
  const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start');

  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsGranularityOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePresetSelect = (preset: DatePreset) => {
    setSelectedPreset(preset.label);
    onChange({
      ...dateRange,
      startDate: preset.startDate,
      endDate: preset.endDate,
      label: preset.display,
      compareStartDate: preset.compStart,
      compareEndDate: preset.compEnd,
      compareLabel: preset.compDisplay,
    });
    setIsOpen(false);
  };

  const handleDayClick = (day: number) => {
    if (selectingStep === 'start') {
      setCustomStartDay(day);
      setCustomEndDay(null);
      setSelectingStep('end');
    } else {
      let start = customStartDay || day;
      let end = day;
      if (end < start) {
        const temp = start;
        start = end;
        end = temp;
      }
      setCustomStartDay(start);
      setCustomEndDay(end);
      setSelectingStep('start');

      const monthStr = (currentMonth + 1).toString().padStart(2, '0');
      const startStr = `${currentYear}-${monthStr}-${start.toString().padStart(2, '0')}`;
      const endStr = `${currentYear}-${monthStr}-${end.toString().padStart(2, '0')}`;
      const monthAbbr = monthNames[currentMonth].substring(0, 3);
      const comp = calculateCustomComparison(startStr, endStr);

      setSelectedPreset('Custom');
      onChange({
        ...dateRange,
        startDate: startStr,
        endDate: endStr,
        label: `${monthAbbr} ${start.toString().padStart(2, '0')} – ${monthAbbr} ${end.toString().padStart(2, '0')}`,
        compareStartDate: comp.compStart,
        compareEndDate: comp.compEnd,
        compareLabel: comp.compLabel,
      });
      setIsOpen(false);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Generate days in month dynamically
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-2.5 text-xs relative">
      
      {/* ─────────────────────────────────────────────────────────────
          1. INTERACTIVE DATE RANGE PILL (Opens Calendar)
      ───────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setIsGranularityOpen(false); }}
        className="flex items-center rounded-full bg-elevated/90 hover:bg-elevated border border-border hover:border-accent/60 p-1 transition-all cursor-pointer shadow-sm group"
      >
        <span className="px-3 py-1 text-text font-medium flex items-center gap-1.5 group-hover:text-accent-light transition-colors">
          <span>📅</span>
          <span>{dateRange.label}</span>
        </span>
        <span className="px-1 text-text-dim text-[10px]">vs</span>
        <span className="px-3 py-1 text-text-muted font-normal">
          {dateRange.compareLabel}
        </span>
        <span className="pr-2 text-[10px] text-text-dim group-hover:text-text transition-colors">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* ─────────────────────────────────────────────────────────────
          2. GRANULARITY DROPDOWN (Hourly / Daily / Weekly / Monthly)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setIsGranularityOpen(!isGranularityOpen); setIsOpen(false); }}
          className="px-3.5 py-1.5 rounded-full bg-elevated/90 hover:bg-elevated border border-border hover:border-accent/50 text-text-muted hover:text-text flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
        >
          <span className="font-semibold text-text">{dateRange.granularity}</span>
          <span className="text-[10px] text-text-dim">{isGranularityOpen ? '▲' : '▼'}</span>
        </button>

        {isGranularityOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 mt-2 w-36 rounded-2xl bg-bg-card border border-border shadow-2xl p-1.5 z-50 animate-in fade-in"
          >
            {(['Hourly', 'Daily', 'Weekly', 'Monthly'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  onChange({ ...dateRange, granularity: g });
                  setIsGranularityOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                  dateRange.granularity === g
                    ? 'bg-accent/20 text-accent-light font-bold'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
              >
                <span>{g}</span>
                {dateRange.granularity === g && <span>✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. FULL INTERACTIVE DUAL-PANE CALENDAR POPUP MODAL
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="absolute right-0 top-full mt-3 w-[92vw] sm:w-[560px] rounded-3xl bg-bg-card/98 backdrop-blur-2xl border border-accent/40 shadow-[0_25px_60px_rgba(0,0,0,0.8)] p-5 sm:p-6 z-50 space-y-5"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h4 className="text-sm font-bold text-text">Choose Analytics Date Window</h4>
                <p className="text-[11px] text-text-dim">
                  Select predefined intervals or click two dates on the calendar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-full bg-elevated hover:bg-white/10 text-text-dim hover:text-text flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid sm:grid-cols-12 gap-5">
              
              {/* Left Column: Quick Range Presets (4 cols) */}
              <div className="sm:col-span-4 space-y-1 sm:border-r border-border/40 sm:pr-3">
                <span className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-2 font-mono">
                  Quick Presets
                </span>
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-between ${
                      selectedPreset === p.label
                        ? 'bg-accent text-white font-bold shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                        : 'text-text-muted hover:text-text hover:bg-elevated'
                    }`}
                  >
                    <span>{p.label}</span>
                    {selectedPreset === p.label && <span className="text-xs">✓</span>}
                  </button>
                ))}
              </div>

              {/* Right Column: Interactive Month Calendar (8 cols) */}
              <div className="sm:col-span-8 space-y-3">
                
                {/* Month Navigation */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-7 h-7 rounded-lg bg-elevated hover:bg-white/10 text-text flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ‹
                  </button>
                  <span className="text-xs font-bold text-text font-mono">
                    {monthNames[currentMonth]} {currentYear}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-7 h-7 rounded-lg bg-elevated hover:bg-white/10 text-text flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ›
                  </button>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-text-dim font-mono">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>

                {/* Month Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {/* Empty padding days before day 1 */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8" />
                  ))}

                  {/* Month days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isStart = customStartDay === day;
                    const isEnd = customEndDay === day;
                    const isInRange =
                      customStartDay !== null &&
                      customEndDay !== null &&
                      day >= customStartDay &&
                      day <= customEndDay;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={`h-8 rounded-lg flex items-center justify-center font-mono text-xs transition-all cursor-pointer ${
                          isStart || isEnd
                            ? 'bg-accent text-white font-bold shadow-[0_0_10px_rgba(124,58,237,0.6)] scale-105 z-10'
                            : isInRange
                            ? 'bg-accent/20 text-accent-light font-semibold'
                            : 'text-text-muted hover:bg-elevated hover:text-text'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Selection helper banner */}
                <div className="p-2.5 rounded-xl bg-bg/80 border border-border/60 text-[11px] text-text-dim flex items-center justify-between">
                  <span>
                    Selected: <strong className="text-text">{dateRange.label}</strong>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ● Data Live Computed
                  </span>
                </div>

              </div>

            </div>

            {/* Footer actions */}
            <div className="border-t border-border/40 pt-3 flex items-center justify-between text-xs">
              <span className="text-text-dim text-[11px]">
                Comparing with previous matching duration automatically.
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold shadow-md cursor-pointer"
              >
                Apply Range ⚡
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
