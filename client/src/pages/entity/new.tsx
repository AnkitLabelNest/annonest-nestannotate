import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Save, Building2, Users, Wallet, Briefcase, Landmark } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EntityConfig {
  title: string;
  icon: typeof Building2;
  color: string;
  fields: FieldConfig[];
}

interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

const entityConfigs: Record<string, EntityConfig> = {
  gp: {
    title: "General Partner (GP)",
    icon: Building2,
    color: "bg-blue-500",
    fields: [
      { name: "gpName", label: "GP Name", type: "text", required: true, placeholder: "e.g., Sequoia Capital" },
      { name: "gpLegalName", label: "Legal Name", type: "text", placeholder: "Legal entity name" },
      { name: "firmType", label: "Firm Type", type: "select", options: [
        { value: "venture_capital", label: "Venture Capital" },
        { value: "private_equity", label: "Private Equity" },
        { value: "growth_equity", label: "Growth Equity" },
        { value: "hedge_fund", label: "Hedge Fund" },
        { value: "family_office", label: "Family Office" },
        { value: "other", label: "Other" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., Menlo Park" },
      { name: "totalAum", label: "Total AUM", type: "text", placeholder: "e.g., $50B" },
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "email", label: "Email", type: "text", placeholder: "contact@company.com" },
      { name: "phone", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
      { name: "linkedinUrl", label: "LinkedIn URL", type: "text", placeholder: "https://linkedin.com/company/..." },
    ],
  },
  lp: {
    title: "Limited Partner (LP)",
    icon: Landmark,
    color: "bg-purple-500",
    fields: [
      { name: "lpName", label: "LP Name", type: "text", required: true, placeholder: "e.g., CalPERS" },
      { name: "lpLegalName", label: "Legal Name", type: "text", placeholder: "Legal entity name" },
      { name: "lpType", label: "Investor Type", type: "select", options: [
        { value: "pension_fund", label: "Pension Fund" },
        { value: "endowment", label: "Endowment" },
        { value: "foundation", label: "Foundation" },
        { value: "sovereign_wealth", label: "Sovereign Wealth Fund" },
        { value: "insurance", label: "Insurance Company" },
        { value: "family_office", label: "Family Office" },
        { value: "fund_of_funds", label: "Fund of Funds" },
        { value: "other", label: "Other" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., Sacramento" },
      { name: "totalAum", label: "Total AUM", type: "text", placeholder: "e.g., $500B" },
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "email", label: "Email", type: "text", placeholder: "contact@organization.com" },
      { name: "phone", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
      { name: "linkedinUrl", label: "LinkedIn URL", type: "text", placeholder: "https://linkedin.com/company/..." },
    ],
  },
  fund: {
    title: "Fund",
    icon: Wallet,
    color: "bg-indigo-500",
    fields: [
      { name: "fundName", label: "Fund Name", type: "text", required: true, placeholder: "e.g., Sequoia Capital Fund XV" },
      { name: "fundType", label: "Fund Type", type: "select", options: [
        { value: "venture", label: "Venture Capital" },
        { value: "buyout", label: "Buyout" },
        { value: "growth", label: "Growth Equity" },
        { value: "real_estate", label: "Real Estate" },
        { value: "infrastructure", label: "Infrastructure" },
        { value: "credit", label: "Credit" },
        { value: "secondaries", label: "Secondaries" },
        { value: "other", label: "Other" },
      ]},
      { name: "vintageYear", label: "Vintage Year", type: "number", placeholder: "e.g., 2024" },
      { name: "targetFundSize", label: "Target Fund Size", type: "text", placeholder: "e.g., $2.5B" },
      { name: "fundStatus", label: "Fund Status", type: "select", options: [
        { value: "fundraising", label: "Fundraising" },
        { value: "closed", label: "Closed" },
        { value: "investing", label: "Investing" },
        { value: "harvesting", label: "Harvesting" },
        { value: "liquidating", label: "Liquidating" },
      ]},
      { name: "primaryAssetClass", label: "Primary Asset Class", type: "text", placeholder: "e.g., Private Equity" },
      { name: "geographicFocus", label: "Geographic Focus", type: "text", placeholder: "e.g., North America" },
    ],
  },
  portfolio_company: {
    title: "Portfolio Company",
    icon: Building2,
    color: "bg-amber-500",
    fields: [
      { name: "companyName", label: "Company Name", type: "text", required: true, placeholder: "e.g., Stripe" },
      { name: "companyType", label: "Company Type", type: "select", options: [
        { value: "private", label: "Private" },
        { value: "public", label: "Public" },
        { value: "subsidiary", label: "Subsidiary" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., San Francisco" },
      { name: "primaryIndustry", label: "Primary Industry", type: "text", placeholder: "e.g., Fintech" },
      { name: "businessDescription", label: "Business Description", type: "textarea", placeholder: "Brief description of the company..." },
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "foundedYear", label: "Founded Year", type: "number", placeholder: "e.g., 2010" },
      { name: "employeeCount", label: "Employee Count", type: "number", placeholder: "e.g., 5000" },
    ],
  },
  service_provider: {
    title: "Service Provider",
    icon: Briefcase,
    color: "bg-teal-500",
    fields: [
      { name: "providerName", label: "Provider Name", type: "text", required: true, placeholder: "e.g., Kirkland & Ellis" },
      { name: "providerType", label: "Provider Type", type: "select", options: [
        { value: "law_firm", label: "Law Firm" },
        { value: "accounting", label: "Accounting Firm" },
        { value: "consulting", label: "Consulting" },
        { value: "placement_agent", label: "Placement Agent" },
        { value: "administrator", label: "Fund Administrator" },
        { value: "prime_broker", label: "Prime Broker" },
        { value: "custodian", label: "Custodian" },
        { value: "other", label: "Other" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., Chicago" },
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "servicesOffered", label: "Services Offered", type: "textarea", placeholder: "List of services..." },
      { name: "email", label: "Email", type: "text", placeholder: "contact@provider.com" },
      { name: "phone", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
    ],
  },
  contact: {
    title: "Contact",
    icon: Users,
    color: "bg-pink-500",
    fields: [
      { name: "firstName", label: "First Name", type: "text", required: true, placeholder: "e.g., John" },
      { name: "lastName", label: "Last Name", type: "text", required: true, placeholder: "e.g., Smith" },
      { name: "workEmail", label: "Work Email", type: "text", placeholder: "john.smith@company.com" },
      { name: "phoneNumber", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
      { name: "jobTitle", label: "Job Title", type: "text", placeholder: "e.g., Managing Partner" },
      { name: "primaryEntityNameSnapshot", label: "Company Name", type: "text", placeholder: "e.g., Sequoia Capital" },
      { name: "linkedinUrl", label: "LinkedIn URL", type: "text", placeholder: "https://linkedin.com/in/..." },
      { name: "roleCategory", label: "Role Category", type: "select", options: [
        { value: "investor", label: "Investor" },
        { value: "founder", label: "Founder/CEO" },
        { value: "executive", label: "Executive" },
        { value: "advisor", label: "Advisor" },
        { value: "board_member", label: "Board Member" },
        { value: "other", label: "Other" },
      ]},
      { name: "seniorityLevel", label: "Seniority Level", type: "select", options: [
        { value: "c_level", label: "C-Level" },
        { value: "vp", label: "VP" },
        { value: "director", label: "Director" },
        { value: "manager", label: "Manager" },
        { value: "individual_contributor", label: "Individual Contributor" },
      ]},
    ],
  },
  deal: {
    title: "Deal",
    icon: Briefcase,
    color: "bg-cyan-500",
    fields: [
      { name: "dealName", label: "Deal Name", type: "text", required: true, placeholder: "e.g., Series B - Stripe" },
      { name: "dealType", label: "Deal Type", type: "select", options: [
        { value: "seed", label: "Seed" },
        { value: "series_a", label: "Series A" },
        { value: "series_b", label: "Series B" },
        { value: "series_c", label: "Series C+" },
        { value: "growth", label: "Growth" },
        { value: "buyout", label: "Buyout" },
        { value: "secondary", label: "Secondary" },
        { value: "ipo", label: "IPO" },
        { value: "ma", label: "M&A" },
        { value: "other", label: "Other" },
      ]},
      { name: "dealStatus", label: "Deal Status", type: "select", options: [
        { value: "announced", label: "Announced" },
        { value: "in_progress", label: "In Progress" },
        { value: "closed", label: "Closed" },
        { value: "cancelled", label: "Cancelled" },
      ]},
      { name: "dealAmount", label: "Deal Amount", type: "text", placeholder: "e.g., $100M" },
      { name: "dealDate", label: "Deal Date", type: "text", placeholder: "e.g., 2024-01-15" },
      { name: "targetCompany", label: "Target Company", type: "text", placeholder: "Company receiving investment" },
      { name: "sector", label: "Sector", type: "text", placeholder: "e.g., Technology" },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Additional details..." },
    ],
  },
};

export default function NewEntityPage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/entity/:entityType/new");
  const entityType = params?.entityType || "gp";
  const config = entityConfigs[entityType];
  const { toast } = useToast();

  const [formData, setFormData] = useState<Record<string, string>>({});

  const createEntityMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", `/api/datanest/entities/${entityType}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datanest/entity-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/datanest/entities", entityType] });
      toast({ title: `${config?.title || "Entity"} created successfully` });
      window.close();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create entity", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  if (!config) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Invalid entity type: {entityType}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/data")}>
              Back to DataNest
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredFields = config.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !formData[f.name]?.trim());
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missingFields.map(f => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const processedData: Record<string, any> = { ...formData };
    config.fields.forEach(field => {
      if (field.type === "number" && processedData[field.name]) {
        processedData[field.name] = parseInt(processedData[field.name], 10);
      }
    });

    createEntityMutation.mutate(processedData);
  };

  const Icon = config.icon;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => window.close()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.color} text-white`}>
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle>Create New {config.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.fields.map((field) => (
                <div 
                  key={field.name} 
                  className={field.type === "textarea" ? "md:col-span-2" : ""}
                >
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  
                  {field.type === "text" && (
                    <Input
                      id={field.name}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      data-testid={`input-${field.name}`}
                    />
                  )}
                  
                  {field.type === "number" && (
                    <Input
                      id={field.name}
                      type="number"
                      value={formData[field.name] || ""}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      data-testid={`input-${field.name}`}
                    />
                  )}
                  
                  {field.type === "textarea" && (
                    <Textarea
                      id={field.name}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      data-testid={`textarea-${field.name}`}
                    />
                  )}
                  
                  {field.type === "select" && field.options && (
                    <Select
                      value={formData[field.name] || ""}
                      onValueChange={(value) => handleInputChange(field.name, value)}
                    >
                      <SelectTrigger data-testid={`select-${field.name}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => window.close()}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createEntityMutation.isPending}
                data-testid="button-save-entity"
              >
                {createEntityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Create {config.title}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
