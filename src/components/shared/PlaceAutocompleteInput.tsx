import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';

// A single text input that offers live Google Places suggestions as the user
// types, so the address entered upstream (branch / buyer / supplier profile)
// is accurate and structured — that accuracy is what lets the Supplier Map
// plot a real pin instead of guessing from a hand-typed address.
//
// Degrades gracefully: if the Places library hasn't loaded (no API key, no
// APIProvider ancestor, script blocked, etc.) this renders as a perfectly
// normal controlled text input with no dropdown — manual entry always works.

export interface PlaceSelectResult {
  formatted_address: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  place_id: string;
}

interface PlaceAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: PlaceSelectResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function parsePlace(place: google.maps.places.PlaceResult): PlaceSelectResult | null {
  const loc = place.geometry?.location;
  if (!loc || !place.address_components) return null;

  const get = (type: string, useShort = false): string =>
    place.address_components!.find((c) => c.types.includes(type))?.[useShort ? 'short_name' : 'long_name'] ?? '';

  const streetNumber = get('street_number');
  const route = get('route');

  return {
    formatted_address: place.formatted_address ?? '',
    address_line1: [streetNumber, route].filter(Boolean).join(' '),
    address_line2: get('subpremise'),
    city: get('locality') || get('postal_town') || get('sublocality') || '',
    state: get('administrative_area_level_1'),
    postal_code: get('postal_code'),
    country: get('country'),
    latitude: loc.lat(),
    longitude: loc.lng(),
    place_id: place.place_id ?? '',
  };
}

export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  id,
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Start typing an address…',
  disabled = false,
  className = '',
}) => {
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
      types: ['address'],
    });
    autocompleteRef.current = autocomplete;

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const result = parsePlace(place);
      if (!result) return; // user hit Enter without picking a suggestion — no geometry
      onChange(result.formatted_address);
      onPlaceSelect(result);
    });

    return () => {
      listener.remove();
      autocompleteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib]);

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={`pl-9 ${className}`}
      />
    </div>
  );
};
