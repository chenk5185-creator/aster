import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  // Support both patterns: simple value callback or standard event handler
  onChange?: ((value: string) => void) | React.ChangeEventHandler<HTMLInputElement>;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftAddon, leftIcon, rightAddon, id, onChange, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasLeftElement = leftAddon || leftIcon;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onChange) return;
      // Check if onChange expects event or value
      if (onChange.length === 1 && typeof onChange === 'function') {
        // Try to detect if it's a value-based handler
        try {
          (onChange as (value: string) => void)(e.target.value);
        } catch {
          (onChange as React.ChangeEventHandler<HTMLInputElement>)(e);
        }
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {hasLeftElement && (
            <div className="absolute left-3 text-text-muted">{leftAddon || leftIcon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            onChange={handleChange}
            className={cn(
              'input',
              hasLeftElement && 'pl-10',
              rightAddon && 'pr-10',
              error && 'border-error focus:border-error focus:ring-error/50',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 text-text-muted">{rightAddon}</div>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-error">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-text-muted">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Number input with increment/decrement
export interface NumberInputProps extends Omit<InputProps, 'type' | 'onChange'> {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min, max, step = 1, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;

      // Allow empty string (user is clearing the field)
      if (val === '') {
        onChange('' as any);
        return;
      }

      // Allow intermediate input like "0." for "0.56"
      // This handles cases where user is typing decimal numbers
      const num = parseFloat(val);
      if (!isNaN(num)) {
        // Only clamp on blur, not during typing
        onChange(num);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '' || val === null || val === undefined) {
        // On blur with empty field, set to min or 0
        onChange(min ?? 0);
        return;
      }

      const num = parseFloat(val);
      if (!isNaN(num)) {
        // Clamp value on blur
        let clampedValue = num;
        if (min !== undefined) clampedValue = Math.max(min, clampedValue);
        if (max !== undefined) clampedValue = Math.min(max, clampedValue);
        onChange(clampedValue);
      }
    };

    return (
      <Input
        ref={ref}
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        {...props}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';
