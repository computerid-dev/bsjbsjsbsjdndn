/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, ChevronsRight, X } from 'lucide-react';

interface HoldToDeleteButtonProps {
  onConfirmDelete: () => void;
  disabled?: boolean;
  label?: string;
  iconSize?: number;
  className?: string;
  title?: string;
  /** If true, renders as a full slide-right track immediately instead of a compact icon button */
  inlineSlider?: boolean;
}

/**
 * Slide-Right-to-Delete control (replaces hold-to-delete to avoid touch timer bugs).
 * - If `inlineSlider` is true (or when compact trash icon is tapped), shows a slider track:
 *   user drags the thumb from left to right to confirm deletion.
 */
export const HoldToDeleteButton: React.FC<HoldToDeleteButtonProps> = ({
  onConfirmDelete,
  disabled = false,
  label,
  iconSize = 15,
  className = '',
  title = 'Geser ke kanan untuk menghapus',
  inlineSlider = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(inlineSlider);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef<number | null>(null);
  const maxDragRef = useRef<number>(140);
  const triggeredRef = useRef<boolean>(false);

  const THUMB_WIDTH = 40;

  const updateMaxDrag = useCallback(() => {
    if (trackRef.current) {
      maxDragRef.current = Math.max(60, trackRef.current.clientWidth - THUMB_WIDTH - 8);
    }
  }, []);

  useEffect(() => {
    if (isExpanded || inlineSlider) {
      updateMaxDrag();
    }
  }, [isExpanded, inlineSlider, updateMaxDrag]);

  const handleStart = (clientX: number) => {
    if (disabled) return;
    updateMaxDrag();
    triggeredRef.current = false;
    startXRef.current = clientX - dragX;
    setIsDragging(true);
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (startXRef.current === null || disabled || triggeredRef.current) return;
      const rawX = clientX - startXRef.current;
      const clamped = Math.max(0, Math.min(maxDragRef.current, rawX));
      setDragX(clamped);

      if (clamped >= maxDragRef.current * 0.82 && !triggeredRef.current) {
        triggeredRef.current = true;
        setIsDragging(false);
        startXRef.current = null;
        setDragX(maxDragRef.current);
        try {
          navigator.vibrate?.(40);
        } catch {
          // Ignore if unsupported
        }
        setTimeout(() => {
          onConfirmDelete();
          setDragX(0);
          if (!inlineSlider) setIsExpanded(false);
        }, 80);
      }
    },
    [disabled, inlineSlider, onConfirmDelete]
  );

  const handleEnd = useCallback(() => {
    if (startXRef.current === null) return;
    startXRef.current = null;
    setIsDragging(false);
    if (!triggeredRef.current) {
      setDragX(0);
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onUp = () => handleEnd();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  if (!isExpanded && !inlineSlider) {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(true);
        }}
        className={`select-none transition-all flex items-center justify-center space-x-1 ${
          className || 'p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <Trash2 size={iconSize} />
        {label && <span>{label}</span>}
      </button>
    );
  }

  const progressRatio = maxDragRef.current > 0 ? Math.min(1, dragX / maxDragRef.current) : 0;

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="flex items-center space-x-1.5"
    >
      <div
        ref={trackRef}
        className={`relative h-10 ${
          inlineSlider ? 'w-44 sm:w-48' : 'w-40'
        } rounded-xl bg-rose-950/60 border border-rose-800/70 overflow-hidden select-none touch-pan-y flex items-center px-1`}
      >
        {/* Red progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-rose-600/40 pointer-events-none"
          style={{
            width: `${ Math.min(100, ((dragX + THUMB_WIDTH / 2) / (maxDragRef.current + THUMB_WIDTH)) * 100) }%`,
            transition: isDragging ? 'none' : 'width 180ms ease-out',
          }}
        />

        {/* Instruction text */}
        <div
          className="w-full text-center pl-8 pr-2 pointer-events-none text-[11px] font-bold text-rose-200 truncate"
          style={{ opacity: Math.max(0.15, 1 - progressRatio * 1.1) }}
        >
          Geser kanan hapus →
        </div>

        {/* Draggable Thumb */}
        <div
          role="slider"
          aria-label="Geser ke kanan untuk menghapus"
          aria-valuenow={Math.round(progressRatio * 100)}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            handleStart(e.clientX);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            if (e.touches.length > 0) {
              handleStart(e.touches[0].clientX);
            }
          }}
          style={{
            transform: `translateX(${dragX}px)`,
            transition: isDragging ? 'none' : 'transform 180ms ease-out',
          }}
          className="relative z-10 w-9 h-8 rounded-lg bg-rose-500 text-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
        >
          <ChevronsRight size={17} />
        </div>
      </div>

      {!inlineSlider && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(false);
            setDragX(0);
          }}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          title="Batal"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
