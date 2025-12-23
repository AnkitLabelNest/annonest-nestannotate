import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Globe, MapPin, Building2, Phone, Loader2 } from "lucide-react";

interface Country {
  id: string;
  name: string;
  iso_code_2: string | null;
  iso_code_3: string | null;
  phone_code: string | null;
  currency_code: string | null;
  is_active: boolean;
}

interface State {
  id: string;
  country_id: string;
  name: string;
  state_code: string | null;
  is_active: boolean;
}

interface City {
  id: string;
  state_id: string;
  name: string;
  is_active: boolean;
}

export default function LocationManagementPage() {
  const { toast } = useToast();
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

  const initMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/locations/init"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/countries"] });
      toast({ title: "Location tables initialized successfully" });
    },
    onError: () => {
      toast({ title: "Failed to initialize tables", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Location Management</h1>
          <p className="text-muted-foreground">Manage countries, states, and cities for dropdown selections</p>
        </div>
        <Button 
          onClick={() => initMutation.mutate()} 
          disabled={initMutation.isPending}
          data-testid="button-init-tables"
        >
          {initMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Initialize Tables
        </Button>
      </div>

      <Tabs defaultValue="countries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="countries" data-testid="tab-countries">
            <Globe className="h-4 w-4 mr-2" />
            Countries
          </TabsTrigger>
          <TabsTrigger value="states" data-testid="tab-states">
            <MapPin className="h-4 w-4 mr-2" />
            States
          </TabsTrigger>
          <TabsTrigger value="cities" data-testid="tab-cities">
            <Building2 className="h-4 w-4 mr-2" />
            Cities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="countries">
          <CountriesTab 
            countries={countries} 
            isLoading={countriesLoading} 
          />
        </TabsContent>

        <TabsContent value="states">
          <StatesTab 
            countries={countries}
            states={states}
            selectedCountryId={selectedCountryId}
            onCountrySelect={setSelectedCountryId}
            isLoading={statesLoading}
          />
        </TabsContent>

        <TabsContent value="cities">
          <CitiesTab 
            countries={countries}
            states={states}
            cities={cities}
            selectedCountryId={selectedCountryId}
            selectedStateId={selectedStateId}
            onCountrySelect={(id) => {
              setSelectedCountryId(id);
              setSelectedStateId(null);
            }}
            onStateSelect={setSelectedStateId}
            isLoading={citiesLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CountriesTab({ countries, isLoading }: { countries: Country[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    iso_code_2: "",
    iso_code_3: "",
    phone_code: "",
    currency_code: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/locations/countries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/countries"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Country created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create country", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => apiRequest("PUT", `/api/locations/countries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/countries"] });
      setDialogOpen(false);
      setEditingCountry(null);
      resetForm();
      toast({ title: "Country updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update country", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/locations/countries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/countries"] });
      toast({ title: "Country deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete country", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", iso_code_2: "", iso_code_3: "", phone_code: "", currency_code: "" });
  };

  const handleEdit = (country: Country) => {
    setEditingCountry(country);
    setFormData({
      name: country.name,
      iso_code_2: country.iso_code_2 || "",
      iso_code_3: country.iso_code_3 || "",
      phone_code: country.phone_code || "",
      currency_code: country.currency_code || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCountry) {
      updateMutation.mutate({ id: editingCountry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Countries
          </CardTitle>
          <CardDescription>Manage country list with phone codes and currency</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingCountry(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-country">
              <Plus className="h-4 w-4 mr-2" />
              Add Country
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCountry ? "Edit Country" : "Add Country"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Country Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="input-country-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iso_code_2">ISO Code (2)</Label>
                  <Input
                    id="iso_code_2"
                    value={formData.iso_code_2}
                    onChange={(e) => setFormData({ ...formData, iso_code_2: e.target.value.toUpperCase() })}
                    maxLength={2}
                    placeholder="US"
                    data-testid="input-iso2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iso_code_3">ISO Code (3)</Label>
                  <Input
                    id="iso_code_3"
                    value={formData.iso_code_3}
                    onChange={(e) => setFormData({ ...formData, iso_code_3: e.target.value.toUpperCase() })}
                    maxLength={3}
                    placeholder="USA"
                    data-testid="input-iso3"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_code">Phone Code</Label>
                  <Input
                    id="phone_code"
                    value={formData.phone_code}
                    onChange={(e) => setFormData({ ...formData, phone_code: e.target.value })}
                    placeholder="+1"
                    data-testid="input-phone-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency_code">Currency</Label>
                  <Input
                    id="currency_code"
                    value={formData.currency_code}
                    onChange={(e) => setFormData({ ...formData, currency_code: e.target.value.toUpperCase() })}
                    maxLength={3}
                    placeholder="USD"
                    data-testid="input-currency"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-country">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCountry ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : countries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No countries added yet. Click "Initialize Tables" then add your first country.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>ISO-2</TableHead>
                <TableHead>ISO-3</TableHead>
                <TableHead><Phone className="h-4 w-4 inline mr-1" />Phone</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countries.map((country) => (
                <TableRow key={country.id} data-testid={`row-country-${country.id}`}>
                  <TableCell className="font-medium">{country.name}</TableCell>
                  <TableCell>{country.iso_code_2 || "-"}</TableCell>
                  <TableCell>{country.iso_code_3 || "-"}</TableCell>
                  <TableCell>{country.phone_code || "-"}</TableCell>
                  <TableCell>{country.currency_code || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(country)} data-testid={`button-edit-country-${country.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(country.id)} data-testid={`button-delete-country-${country.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatesTab({ 
  countries, 
  states, 
  selectedCountryId, 
  onCountrySelect, 
  isLoading 
}: { 
  countries: Country[]; 
  states: State[]; 
  selectedCountryId: string | null; 
  onCountrySelect: (id: string | null) => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [formData, setFormData] = useState({ name: "", state_code: "" });

  const createMutation = useMutation({
    mutationFn: (data: { country_id: string; name: string; state_code: string }) => 
      apiRequest("POST", "/api/locations/states", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/states", selectedCountryId] });
      setDialogOpen(false);
      setFormData({ name: "", state_code: "" });
      toast({ title: "State created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create state", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; state_code: string } }) => 
      apiRequest("PUT", `/api/locations/states/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/states", selectedCountryId] });
      setDialogOpen(false);
      setEditingState(null);
      setFormData({ name: "", state_code: "" });
      toast({ title: "State updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update state", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/locations/states/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/states", selectedCountryId] });
      toast({ title: "State deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete state", variant: "destructive" });
    },
  });

  const handleEdit = (state: State) => {
    setEditingState(state);
    setFormData({ name: state.name, state_code: state.state_code || "" });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCountryId) return;
    if (editingState) {
      updateMutation.mutate({ id: editingState.id, data: formData });
    } else {
      createMutation.mutate({ country_id: selectedCountryId, ...formData });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            States / Provinces
          </CardTitle>
          <CardDescription>Manage states for each country</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCountryId || ""} onValueChange={(v) => onCountrySelect(v || null)}>
            <SelectTrigger className="w-48" data-testid="select-country-for-states">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.id} value={country.id}>{country.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingState(null);
              setFormData({ name: "", state_code: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button disabled={!selectedCountryId} data-testid="button-add-state">
                <Plus className="h-4 w-4 mr-2" />
                Add State
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingState ? "Edit State" : "Add State"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="state_name">State Name *</Label>
                  <Input
                    id="state_name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-state-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state_code">State Code</Label>
                  <Input
                    id="state_code"
                    value={formData.state_code}
                    onChange={(e) => setFormData({ ...formData, state_code: e.target.value.toUpperCase() })}
                    placeholder="CA"
                    data-testid="input-state-code"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-state">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingState ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedCountryId ? (
          <div className="text-center py-8 text-muted-foreground">
            Select a country to view and manage its states.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : states.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No states added for this country yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {states.map((state) => (
                <TableRow key={state.id} data-testid={`row-state-${state.id}`}>
                  <TableCell className="font-medium">{state.name}</TableCell>
                  <TableCell>{state.state_code || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(state)} data-testid={`button-edit-state-${state.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(state.id)} data-testid={`button-delete-state-${state.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CitiesTab({ 
  countries, 
  states, 
  cities,
  selectedCountryId, 
  selectedStateId,
  onCountrySelect, 
  onStateSelect,
  isLoading 
}: { 
  countries: Country[]; 
  states: State[];
  cities: City[];
  selectedCountryId: string | null;
  selectedStateId: string | null;
  onCountrySelect: (id: string | null) => void;
  onStateSelect: (id: string | null) => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [formData, setFormData] = useState({ name: "" });

  const createMutation = useMutation({
    mutationFn: (data: { state_id: string; name: string }) => 
      apiRequest("POST", "/api/locations/cities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/cities", selectedStateId] });
      setDialogOpen(false);
      setFormData({ name: "" });
      toast({ title: "City created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create city", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) => 
      apiRequest("PUT", `/api/locations/cities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/cities", selectedStateId] });
      setDialogOpen(false);
      setEditingCity(null);
      setFormData({ name: "" });
      toast({ title: "City updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update city", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/locations/cities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations/cities", selectedStateId] });
      toast({ title: "City deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete city", variant: "destructive" });
    },
  });

  const handleEdit = (city: City) => {
    setEditingCity(city);
    setFormData({ name: city.name });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStateId) return;
    if (editingCity) {
      updateMutation.mutate({ id: editingCity.id, data: formData });
    } else {
      createMutation.mutate({ state_id: selectedStateId, ...formData });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Cities
          </CardTitle>
          <CardDescription>Manage cities for each state</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedCountryId || ""} onValueChange={(v) => onCountrySelect(v || null)}>
            <SelectTrigger className="w-40" data-testid="select-country-for-cities">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.id} value={country.id}>{country.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStateId || ""} onValueChange={(v) => onStateSelect(v || null)} disabled={!selectedCountryId}>
            <SelectTrigger className="w-40" data-testid="select-state-for-cities">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              {states.map((state) => (
                <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingCity(null);
              setFormData({ name: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button disabled={!selectedStateId} data-testid="button-add-city">
                <Plus className="h-4 w-4 mr-2" />
                Add City
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCity ? "Edit City" : "Add City"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="city_name">City Name *</Label>
                  <Input
                    id="city_name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-city-name"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-city">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingCity ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedStateId ? (
          <div className="text-center py-8 text-muted-foreground">
            Select a country and state to view and manage cities.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : cities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No cities added for this state yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City Name</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((city) => (
                <TableRow key={city.id} data-testid={`row-city-${city.id}`}>
                  <TableCell className="font-medium">{city.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(city)} data-testid={`button-edit-city-${city.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(city.id)} data-testid={`button-delete-city-${city.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
