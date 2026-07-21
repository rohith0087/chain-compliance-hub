import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: {
    wrapper: "h-9",
    input: "h-9 pl-9 pr-9 text-[14px] rounded-[12px]",
    icon: "h-4 w-4 left-3",
    clear: "h-6 w-6 right-1.5",
    clearIcon: "h-3.5 w-3.5",
  },
  md: {
    wrapper: "h-11",
    input: "h-11 pl-11 pr-10 text-[15px] rounded-[14px]",
    icon: "h-[18px] w-[18px] left-3.5",
    clear: "h-7 w-7 right-2",
    clearIcon: "h-4 w-4",
  },
  lg: {
    wrapper: "h-12",
    input: "h-12 pl-12 pr-11 text-[16px] rounded-[16px]",
    icon: "h-5 w-5 left-4",
    clear: "h-8 w-8 right-2",
    clearIcon: "h-[18px] w-[18px]",
  },
} as const;

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "size" | "type"> {
  value: string;
  /** Receives the raw string, not the event -- callers almost always want just the text. */
  onValueChange: (value: string) => void;
  size?: keyof typeof SIZES;
  /** Wrapper class (width/flex). Input-level overrides go through `inputClassName`. */
  className?: string;
  inputClassName?: string;
  /** Hides the clear affordance for search bars that are always-populated. */
  hideClear?: boolean;
}

/**
 * The one search field for the app. Every list/table/filter toolbar should use
 * this instead of hand-rolling `<Search className="absolute ..."/> + <Input className="pl-8"/>`,
 * which had drifted into ~10 different paddings, heights, and icon offsets.
 *
 * Baseline is `md` (44px) -- the previous default was the 40px `Input` with 14px
 * text, which read as cramped and made typed queries hard to scan.
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onValueChange,
      size = "md",
      className,
      inputClassName,
      hideClear = false,
      placeholder = "Search...",
      disabled,
      ...props
    },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const s = SIZES[size];
    const showClear = !hideClear && value.length > 0 && !disabled;

    const handleClear = () => {
      onValueChange("");
      innerRef.current?.focus();
    };

    return (
      <div className={cn("relative group", s.wrapper, className)}>
        <Search
          aria-hidden="true"
          strokeWidth={2}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/70 transition-colors",
            "group-focus-within:text-primary",
            s.icon,
          )}
        />
        <input
          ref={innerRef}
          type="search"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          // `search` inputs get a native WebKit clear button that would sit next
          // to ours -- suppressed in index.css via [type='search'] rules.
          className={cn(
            "w-full border border-input bg-background text-foreground",
            "placeholder:text-muted-foreground/70",
            "shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
            "transition-[border-color,box-shadow] duration-150",
            "hover:border-border/80",
            // `focus`, not `focus-visible`: browsers withhold :focus-visible from
            // mouse-clicked text inputs, which left the field with zero visual
            // response to a click. A text field should always show it has focus.
            "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
            s.input,
            inputClassName,
          )}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              "absolute top-1/2 -translate-y-1/2 grid place-items-center rounded-full",
              "text-muted-foreground/70 hover:text-foreground hover:bg-muted",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              s.clear,
            )}
          >
            <X className={s.clearIcon} />
          </button>
        )}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
