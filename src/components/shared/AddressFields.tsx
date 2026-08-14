import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { POPULAR_COUNTRIES, ALL_COUNTRIES } from '@/config/countries';
import { Separator } from '@/components/ui/separator';
import { PlaceAutocompleteInput, type PlaceSelectResult } from '@/components/shared/PlaceAutocompleteInput';

export interface AddressData {
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

/** Coordinates captured alongside AddressData when a place is picked from the
 *  autocomplete. Kept separate from AddressData (which stays string-only) so
 *  the existing onChange contract never has to carry numeric fields. */
export interface AddressCoordinates {
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
}

export const emptyAddressCoordinates = (): AddressCoordinates => ({
  latitude: null,
  longitude: null,
  place_id: null,
});

interface AddressFieldsProps {
  data: AddressData;
  onChange: (field: keyof AddressData, value: string) => void;
  /** Fires once with every parsed field (incl. lat/lng/place_id) when the user
   *  picks a suggestion from the search box. Optional -- omit it and the
   *  search box still fills the string fields below via onChange, just
   *  without persisting coordinates. */
  onPlaceSelect?: (result: PlaceSelectResult) => void;
  disabled?: boolean;
  required?: boolean;
}

export const AddressFields: React.FC<AddressFieldsProps> = ({
  data,
  onChange,
  onPlaceSelect,
  disabled = false,
  required = false,
}) => {
  // Create unique list with popular countries at top
  const popularSet = new Set(POPULAR_COUNTRIES);
  const otherCountries = ALL_COUNTRIES.filter(c => !popularSet.has(c));

  const handlePlaceSelect = (result: PlaceSelectResult) => {
    // Always fill the string fields via the normal onChange path -- this is
    // what makes coordinate capture optional for callers that haven't wired
    // onPlaceSelect yet: the address still fills in correctly either way.
    onChange('address_line1', result.address_line1);
    onChange('address_line2', result.address_line2);
    onChange('city', result.city);
    onChange('state', result.state);
    onChange('postal_code', result.postal_code);
    onChange('country', result.country);
    onPlaceSelect?.(result);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="address_search">Search address</Label>
        <PlaceAutocompleteInput
          id="address_search"
          value={data.address_line1}
          onChange={(value) => onChange('address_line1', value)}
          onPlaceSelect={handlePlaceSelect}
          placeholder="Start typing to search…"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Pick a suggestion to fill the fields below accurately, or enter them manually.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line1">
          Address Line 1 {required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id="address_line1"
          value={data.address_line1}
          onChange={(e) => onChange('address_line1', e.target.value)}
          placeholder="Street address, P.O. box"
          disabled={disabled}
          required={required}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line2">Address Line 2</Label>
        <Input
          id="address_line2"
          value={data.address_line2}
          onChange={(e) => onChange('address_line2', e.target.value)}
          placeholder="Apartment, suite, unit, building, floor, etc."
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City / District</Label>
          <Input
            id="city"
            value={data.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="City"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">State / Province</Label>
          <Input
            id="state"
            value={data.state}
            onChange={(e) => onChange('state', e.target.value)}
            placeholder="State or province"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postal_code">Postal Code</Label>
          <Input
            id="postal_code"
            value={data.postal_code}
            onChange={(e) => onChange('postal_code', e.target.value)}
            placeholder="ZIP / Postal code"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <SafeSelect
            value={data.country}
            onValueChange={(value) => onChange('country', value)}
            placeholder="Select country"
            disabled={disabled}
          >
            {/* Popular countries first */}
            {POPULAR_COUNTRIES.map((country) => (
              <SafeSelectItem key={country} value={country}>
                {country}
              </SafeSelectItem>
            ))}
            {/* Separator */}
            <SafeSelectItem value="---" disabled>
              ────────────────
            </SafeSelectItem>
            {/* Other countries alphabetically */}
            {otherCountries.map((country) => (
              <SafeSelectItem key={country} value={country}>
                {country}
              </SafeSelectItem>
            ))}
          </SafeSelect>
        </div>
      </div>
    </div>
  );
};

// Helper function to combine address fields into a single string
export const formatAddress = (data: Partial<AddressData>): string => {
  return [
    data.address_line1,
    data.address_line2,
    data.city,
    data.state,
    data.postal_code,
    data.country,
  ]
    .filter(Boolean)
    .join(', ');
};

// Helper to create empty address data
export const emptyAddressData = (): AddressData => ({
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
});
