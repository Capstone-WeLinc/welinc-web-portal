import { useState, type KeyboardEvent } from 'react';
import { ArrowBigUpDash, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { splitInput } from './AuthSplit';

/**
 * A password field on the split with its show or hide button (44px square, inside the field), and
 * a "Caps Lock is on" line under it while the field has focus and Caps Lock is on (the commonest
 * reason a right password fails). The line is a polite live region, so a screen reader hears it once.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const capsId = `${id}-caps`;
  // `getModifierState` is read on every key, since Caps Lock can change while the field has focus
  const readCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsOn(e.getModifierState?.('CapsLock') ?? false);
  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          aria-describedby={[describedBy, capsId].filter(Boolean).join(' ')}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCapsOn(false)}
          className={cn(splitInput, 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute top-px right-px flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-strong transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          {shown ? (
            <EyeOff className="size-4.5" aria-hidden="true" />
          ) : (
            <Eye className="size-4.5" aria-hidden="true" />
          )}
        </button>
      </div>
      <p
        id={capsId}
        aria-live="polite"
        className="text-small text-muted-strong"
      >
        {capsOn && (
          <span className="mt-2 flex items-center gap-1.5">
            <ArrowBigUpDash className="size-4 shrink-0" aria-hidden="true" />
            Caps Lock is on
          </span>
        )}
      </p>
    </div>
  );
}
