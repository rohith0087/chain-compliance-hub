
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

interface SafeSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

interface SafeSelectItemProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
}

// Error boundary specifically for Select components
class SelectErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Select component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center gap-2 p-2 border border-red-200 bg-red-50 rounded-md">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">Select component unavailable</span>
        </div>
      );
    }

    return this.props.children;
  }
}

// Safe Select Item that validates values
export const SafeSelectItem: React.FC<SafeSelectItemProps> = ({ value, children, ...props }) => {
  // Validate that value is not empty string
  const safeValue = React.useMemo(() => {
    if (!value || value.trim() === '') {
      console.warn('SafeSelectItem: Empty value detected, using fallback');
      return 'fallback-value';
    }
    return value;
  }, [value]);

  return (
    <SelectItem value={safeValue} {...props}>
      {children}
    </SelectItem>
  );
};

// Safe Select wrapper with comprehensive error handling
export const SafeSelect: React.FC<SafeSelectProps> = ({ 
  value, 
  onValueChange, 
  children, 
  placeholder = "Select an option",
  className,
  disabled,
  ...props 
}) => {
  const [internalValue, setInternalValue] = React.useState(value || '');
  
  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const handleValueChange = React.useCallback((newValue: string) => {
    console.log('SafeSelect value change:', newValue);
    
    // Prevent empty string values
    if (newValue === '') {
      console.warn('SafeSelect: Prevented empty string value');
      return;
    }
    
    setInternalValue(newValue);
    onValueChange?.(newValue);
  }, [onValueChange]);

  return (
    <SelectErrorBoundary>
      <Select 
        value={internalValue} 
        onValueChange={handleValueChange}
        disabled={disabled}
        {...props}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
    </SelectErrorBoundary>
  );
};

export default SafeSelect;
