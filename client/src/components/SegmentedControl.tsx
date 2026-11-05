interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** Accessible radio group styled as a segmented control (native radios, keyboard friendly). */
export function SegmentedControl<T extends string>({ legend, name, value, options, onChange, disabled }: Props<T>) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-lilac p-1">
        {options.map((option) => (
          <label key={option.value} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block rounded-lg px-2 py-2 text-center text-sm font-semibold text-muted transition hover:text-ink peer-checked:bg-ink peer-checked:text-white peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-violet peer-focus-visible:ring-offset-1 peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
