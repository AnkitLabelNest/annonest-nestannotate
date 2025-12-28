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
        { value: "Venture Capital", label: "Venture Capital" },
        { value: "Private Equity", label: "Private Equity" },
        { value: "Growth Equity", label: "Growth Equity" },
        { value: "Hedge Fund", label: "Hedge Fund" },
        { value: "Family Office", label: "Family Office" },
        { value: "Other", label: "Other" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., Menlo Park" },
      { name: "totalAum", label: "Total AUM", type: "number", placeholder: "e.g., 50000000000" },
      { name: "aumCurrency", label: "Currency", type: "select", options: [
        { value: "USD", label: "USD" },
        { value: "EUR", label: "EUR" },
        { value: "GBP", label: "GBP" },
      ]},
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "email", label: "Email", type: "text", placeholder: "contact@company.com" },
      { name: "phone", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
      { name: "linkedinUrl", label: "LinkedIn URL", type: "text", placeholder: "https://linkedin.com/company/..." },
      { name: "assignedTo", label: "Assigned To", type: "text", placeholder: "User ID or name" },
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
        { value: "Pension Fund", label: "Pension Fund" },
        { value: "Endowment", label: "Endowment" },
        { value: "Foundation", label: "Foundation" },
        { value: "Sovereign Wealth Fund", label: "Sovereign Wealth Fund" },
        { value: "Insurance Company", label: "Insurance Company" },
        { value: "Family Office", label: "Family Office" },
        { value: "Fund of Funds", label: "Fund of Funds" },
        { value: "Other", label: "Other" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., Sacramento" },
      { name: "totalAum", label: "Total AUM", type: "number", placeholder: "e.g., 500000000000" },
      { name: "aumCurrency", label: "Currency", type: "select", options: [
        { value: "USD", label: "USD" },
        { value: "EUR", label: "EUR" },
        { value: "GBP", label: "GBP" },
      ]},
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "email", label: "Email", type: "text", placeholder: "contact@organization.com" },
      { name: "phone", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
      { name: "linkedinUrl", label: "LinkedIn URL", type: "text", placeholder: "https://linkedin.com/company/..." },
      { name: "assignedTo", label: "Assigned To", type: "text", placeholder: "User ID or name" },
    ],
  },
  fund: {
    title: "Fund",
    icon: Wallet,
    color: "bg-indigo-500",
    fields: [
      { name: "fundName", label: "Fund Name", type: "text", required: true, placeholder: "e.g., Sequoia Capital Fund XV" },
      { name: "fundType", label: "Fund Type", type: "select", options: [
        { value: "Venture", label: "Venture Capital" },
        { value: "Buyout", label: "Buyout" },
        { value: "Growth", label: "Growth Equity" },
        { value: "Real Estate", label: "Real Estate" },
        { value: "Infrastructure", label: "Infrastructure" },
        { value: "Credit", label: "Credit" },
        { value: "Secondaries", label: "Secondaries" },
        { value: "Other", label: "Other" },
      ]},
      { name: "vintageYear", label: "Vintage Year", type: "number", placeholder: "e.g., 2024" },
      { name: "targetFundSize", label: "Target Fund Size", type: "number", placeholder: "e.g., 2500000000" },
      { name: "fundCurrency", label: "Currency", type: "select", options: [
        { value: "USD", label: "USD" },
        { value: "EUR", label: "EUR" },
        { value: "GBP", label: "GBP" },
      ]},
      { name: "fundStatus", label: "Fund Status", type: "select", options: [
        { value: "Fundraising", label: "Fundraising" },
        { value: "Closed", label: "Closed" },
        { value: "Investing", label: "Investing" },
        { value: "Harvesting", label: "Harvesting" },
        { value: "Liquidating", label: "Liquidating" },
      ]},
      { name: "primaryAssetClass", label: "Primary Asset Class", type: "text", placeholder: "e.g., Private Equity" },
      { name: "geographicFocus", label: "Geographic Focus", type: "text", placeholder: "e.g., North America" },
      { name: "assignedTo", label: "Assigned To", type: "text", placeholder: "User ID or name" },
    ],
  },
  portfolio_company: {
    title: "Portfolio Company",
    icon: Building2,
    color: "bg-amber-500",
    fields: [
      { name: "companyName", label: "Company Name", type: "text", required: true, placeholder: "e.g., Stripe" },
      { name: "companyType", label: "Company Type", type: "select", options: [
        { value: "Private", label: "Private" },
        { value: "Public", label: "Public" },
        { value: "Subsidiary", label: "Subsidiary" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., San Francisco" },
      { name: "primaryIndustry", label: "Primary Industry", type: "text", placeholder: "e.g., Fintech" },
      { name: "businessModel", label: "Business Model", type: "text", placeholder: "e.g., B2B SaaS" },
      { name: "businessDescription", label: "Business Description", type: "textarea", placeholder: "Brief description of the company..." },
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "foundedYear", label: "Founded Year", type: "number", placeholder: "e.g., 2010" },
      { name: "employeeCount", label: "Employee Count", type: "number", placeholder: "e.g., 5000" },
      { name: "status", label: "Status", type: "select", options: [
        { value: "Active", label: "Active" },
        { value: "Exited", label: "Exited" },
        { value: "Inactive", label: "Inactive" },
      ]},
      { name: "assignedTo", label: "Assigned To", type: "text", placeholder: "User ID or name" },
    ],
  },
  service_provider: {
    title: "Service Provider",
    icon: Briefcase,
    color: "bg-teal-500",
    fields: [
      { name: "providerName", label: "Provider Name", type: "text", required: true, placeholder: "e.g., Kirkland & Ellis" },
      { name: "providerType", label: "Provider Type", type: "select", options: [
        { value: "Law Firm", label: "Law Firm" },
        { value: "Accounting", label: "Accounting Firm" },
        { value: "Consulting", label: "Consulting" },
        { value: "Placement Agent", label: "Placement Agent" },
        { value: "Fund Administrator", label: "Fund Administrator" },
        { value: "Prime Broker", label: "Prime Broker" },
        { value: "Custodian", label: "Custodian" },
        { value: "Other", label: "Other" },
      ]},
      { name: "headquartersCountry", label: "Headquarters Country", type: "text", placeholder: "e.g., United States" },
      { name: "headquartersCity", label: "Headquarters City", type: "text", placeholder: "e.g., Chicago" },
      { name: "website", label: "Website", type: "text", placeholder: "https://..." },
      { name: "servicesOffered", label: "Services Offered", type: "textarea", placeholder: "List of services..." },
      { name: "sectorExpertise", label: "Sector Expertise", type: "text", placeholder: "e.g., Technology, Healthcare" },
      { name: "geographicCoverage", label: "Geographic Coverage", type: "text", placeholder: "e.g., Global" },
      { name: "email", label: "Email", type: "text", placeholder: "contact@provider.com" },
      { name: "phone", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
      { name: "linkedinUrl", label: "LinkedIn URL", type: "text", placeholder: "https://linkedin.com/company/..." },
      { name: "assignedTo", label: "Assigned To", type: "text", placeholder: "User ID or name" },
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
        { value: "Investor", label: "Investor" },
        { value: "Founder", label: "Founder/CEO" },
        { value: "Executive", label: "Executive" },
        { value: "Advisor", label: "Advisor" },
        { value: "Board Member", label: "Board Member" },
        { value: "Other", label: "Other" },
      ]},
      { name: "seniorityLevel", label: "Seniority Level", type: "select", options: [
        { value: "C-Suite", label: "C-Level" },
        { value: "VP", label: "VP" },
        { value: "Director", label: "Director" },
        { value: "Manager", label: "Manager" },
        { value: "Senior", label: "Senior" },
        { value: "Junior", label: "Junior" },
      ]},
      { name: "assignedTo", label: "Assigned To", type: "text", placeholder: "User ID or name" },
    ],
  },
  deal: {
    title: "Deal",
    icon: Briefcase,
    color: "bg-cyan-500",
    fields: [
      { name: "dealName", label: "Deal Name", type: "text", required: true, placeholder: "e.g., Series B - Stripe" },
      { name: "dealType", label: "Deal Type", type: "select", options: [
        { value: "Seed", label: "Seed" },
        { value: "Series A", label: "Series A" },
        { value: "Series B", label: "Series B" },
        { value: "Series C+", label: "Series C+" },
        { value: "Growth", label: "Growth" },
        { value: "Buyout", label: "Buyout" },
        { value: "Secondary", label: "Secondary" },
        { value: "IPO", label: "IPO" },
        { value: "M&A", label: "M&A" },
        { value: "Other", label: "Other" },
      ]},
      { name: "dealStatus", label: "Deal Status", type: "select", options: [
        { value: "Active", label: "Active" },
        { value: "In Progress", label: "In Progress" },
        { value: "Closed", label: "Closed" },
        { value: "Exited", label: "Exited" },
      ]},
      { name: "dealAmount", label: "Deal Amount", type: "number", placeholder: "e.g., 100000000" },
      { name: "dealCurrency", label: "Currency", type: "select", options: [
        { value: "USD", label: "USD" },
        { value: "EUR", label: "EUR" },
        { value: "GBP", label: "GBP" },
      ]},
      { name: "dealDate", label: "Deal Date", type: "text", placeholder: "e.g., 2024-01-15" },
      { name: "targetCompany", label: "Target Company", type: "text", placeholder: "Company receiving investment" },
      { name: "sector", label: "Sector", type: "text", placeholder: "e.g., Technology" },
      { name: "dealRound", label: "Deal Round", type: "text", placeholder: "e.g., Series B" },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Additional details..." },
      { name: "assignedTo", label: "Assigned To", type: "text", placeholder: "User ID or name" },
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
