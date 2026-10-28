import React, { useState, useEffect, useRef } from 'react';

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string | undefined | null;
  onChange: (value: number, rawStr?: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
  fallbackValue?: number;
  allowEmpty?: boolean;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(({
  value,
  onChange,
  min,
  max,
  step,
  className,
  fallbackValue,
  allowEmpty = false,
  onFocus,
  onBlur,
  ...rest
}, ref) => {
  const formatVal = (v: number | string | undefined | null): string => {
    if (v === undefined || v === null || v === '') return '';
    return String(v);
  };

  const [localValue, setLocalValue] = useState<string>(() => formatVal(value));
  const isFocusedRef = useRef(false);

  // Sync external changes when not focused or when prop changes externally
  useEffect(() => {
    const numericLocal = localValue === '' || localValue === '-' || localValue === '.' ? null : Number(localValue);
    const numericProp = value === '' || value === null || value === undefined ? null : Number(value);

    if (!isFocusedRef.current || (numericProp !== null && numericLocal !== null && numericProp !== numericLocal)) {
      setLocalValue(formatVal(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputStr = e.target.value;

    // Strip leading zeros if followed by non-decimal digits (e.g. "05" -> "5", "00" -> "0")
    if (/^0+[1-9]/.test(inputStr)) {
      inputStr = inputStr.replace(/^0+/, '');
    } else if (/^0+0$/.test(inputStr)) {
      inputStr = '0';
    }

    setLocalValue(inputStr);

    if (inputStr === '' || inputStr === '-' || inputStr === '.') {
      if (allowEmpty) {
        onChange(0, inputStr);
      } else {
        const emptyFallback = fallbackValue !== undefined ? fallbackValue : (min !== undefined && min > 0 ? min : 0);
        onChange(emptyFallback, inputStr);
      }
      return;
    }

    const num = Number(inputStr);
    if (!isNaN(num)) {
      let clamped = num;
      if (max !== undefined && clamped > max) clamped = max;
      onChange(clamped, inputStr);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    e.target.select();
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;

    if (localValue === '' || localValue === '-' || localValue === '.') {
      if (allowEmpty) {
        setLocalValue('');
        onChange(0, '');
      } else {
        const fallback = fallbackValue !== undefined ? fallbackValue : (min !== undefined ? min : 0);
        setLocalValue(String(fallback));
        onChange(fallback, String(fallback));
      }
    } else {
      const num = Number(localValue);
      if (isNaN(num)) {
        if (allowEmpty) {
          setLocalValue('');
          onChange(0, '');
        } else {
          const fallback = fallbackValue !== undefined ? fallbackValue : (min !== undefined ? min : 0);
          setLocalValue(String(fallback));
          onChange(fallback, String(fallback));
        }
      } else {
        let clamped = num;
        if (min !== undefined && clamped < min) clamped = min;
        if (max !== undefined && clamped > max) clamped = max;
        setLocalValue(String(clamped));
        onChange(clamped, String(clamped));
      }
    }

    if (onBlur) onBlur(e);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="number"
      min={min}
      max={max}
      step={step}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
});

NumberInput.displayName = 'NumberInput';

export default NumberInput;
