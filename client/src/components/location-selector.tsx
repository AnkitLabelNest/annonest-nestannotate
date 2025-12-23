import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Loader2 } from "lucide-react";

interface Country {
  id: string;
  name: string;
  iso_code_2: string | null;
  iso_code_3: string | null;
  phone_code: string | null;
}

interface State {
  id: string;
  country_id: string;
  name: string;
  state_code: string | null;
}

interface City {
  id: string;
  state_id: string;
  name: string;
}

interface LocationSelectorProps {
  countryValue?: string;
  stateValue?: string;
  cityValue?: string;
  onCountryChange: (country: string, phoneCode?: string) => void;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  showPhoneCode?: boolean;
  layout?: "horizontal" | "vertical";
  disabled?: boolean;
}

export function LocationSelector({
  countryValue = "",
  stateValue = "",
  cityValue = "",
  onCountryChange,
  onStateChange,
  onCityChange,
  showPhoneCode = false,
  layout = "vertical",
  disabled = false,
}: LocationSelectorProps) {
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);

  const { data: countries = [], isLoading: countriesLoading } = useQuery<Country[]>({
    queryKey: ["/api/locations/countries"],
  });

  const { data: states = [], isLoading: statesLoading } = useQuery<State[]>({
    queryKey: ["/api/locations/states", selectedCountryId],
    enabled: !!selectedCountryId,
  });

  const { data: cities = [], isLoading: citiesLoading } = useQuery<City[]>({
    queryKey: ["/api/locations/cities", selectedStateId],
    enabled: !!selectedStateId,
  });

  useEffect(() => {
    if (countryValue && countries.length > 0) {
      const country = countries.find(c => c.name === countryValue);
      if (country) {
        setSelectedCountryId(country.id);
      }
    }
  }, [countryValue, countries]);

  useEffect(() => {
    if (stateValue && states.length > 0) {
      const state = states.find(s => s.name === stateValue);
      if (state) {
        setSelectedStateId(state.id);
      }
    }
  }, [stateValue, states]);

  const handleCountryChange = (countryId: string) => {
    const country = countries.find(c => c.id === countryId);
    if (country) {
      setSelectedCountryId(countryId);
      setSelectedStateId(null);
      onCountryChange(country.name, country.phone_code || undefined);
      onStateChange("");
      onCityChange("");
    }
  };

  const handleStateChange = (stateId: string) => {
    const state = states.find(s => s.id === stateId);
    if (state) {
      setSelectedStateId(stateId);
      onStateChange(state.name);
      onCityChange("");
    }
  };

  const handleCityChange = (cityId: string) => {
    const city = cities.find(c => c.id === cityId);
    if (city) {
      onCityChange(city.name);
    }
  };

  const selectedCountry = countries.find(c => c.id === selectedCountryId);

  const containerClass = layout === "horizontal" 
    ? "grid grid-cols-3 gap-4" 
    : "space-y-4";

  return (
    <div className={containerClass}>
      <div className="space-y-2">
        <Label>Country</Label>
        <Select 
          value={selectedCountryId || ""} 
          onValueChange={handleCountryChange}
          disabled={disabled}
        >
          <SelectTrigger data-testid="select-location-country">
            {countriesLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <SelectValue placeholder="Select country" />
            )}
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.id} value={country.id}>
                <div className="flex items-center gap-2">
                  <span>{country.name}</span>
                  {showPhoneCode && country.phone_code && (
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {country.phone_code}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showPhoneCode && selectedCountry?.phone_code && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            Phone code: {selectedCountry.phone_code}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>State / Province</Label>
        <Select 
          value={selectedStateId || ""} 
          onValueChange={handleStateChange}
          disabled={disabled || !selectedCountryId}
        >
          <SelectTrigger data-testid="select-location-state">
            {statesLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <SelectValue placeholder={selectedCountryId ? "Select state" : "Select country first"} />
            )}
          </SelectTrigger>
          <SelectContent>
            {states.map((state) => (
              <SelectItem key={state.id} value={state.id}>
                {state.name} {state.state_code && `(${state.state_code})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>City</Label>
        <Select 
          value={cities.find(c => c.name === cityValue)?.id || ""} 
          onValueChange={handleCityChange}
          disabled={disabled || !selectedStateId}
        >
          <SelectTrigger data-testid="select-location-city">
            {citiesLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <SelectValue placeholder={selectedStateId ? "Select city" : "Select state first"} />
            )}
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city.id} value={city.id}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface SimpleLocationSelectorProps {
  value: {
    country: string;
    state: string;
    city: string;
  };
  onChange: (location: { country: string; state: string; city: string; phoneCode?: string }) => void;
  showPhoneCode?: boolean;
  layout?: "horizontal" | "vertical";
  disabled?: boolean;
}

export function SimpleLocationSelector({
  value,
  onChange,
  showPhoneCode = false,
  layout = "vertical",
  disabled = false,
}: SimpleLocationSelectorProps) {
  return (
    <LocationSelector
      countryValue={value.country}
      stateValue={value.state}
      cityValue={value.city}
      onCountryChange={(country, phoneCode) => onChange({ ...value, country, state: "", city: "", phoneCode })}
      onStateChange={(state) => onChange({ ...value, state, city: "" })}
      onCityChange={(city) => onChange({ ...value, city })}
      showPhoneCode={showPhoneCode}
      layout={layout}
      disabled={disabled}
    />
  );
}
