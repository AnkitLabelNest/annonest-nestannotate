import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { WorkflowProgress } from "@/components/workflow-progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Copy,
  RotateCcw,
  Save,
  CheckCircle2,
  Languages,
  Sparkles,
} from "lucide-react";

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "pt", name: "Portuguese" },
];

export default function TranslationPage() {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [sourceText, setSourceText] = useState(
    "Acme Corporation announced today that its quarterly revenue exceeded expectations, reaching $2.3 billion. The company's CEO, John Smith, attributed the success to strong product demand and strategic market expansion. Shareholders will receive an increased dividend starting next quarter."
  );
  const [translatedText, setTranslatedText] = useState(
    "Acme Corporation anunció hoy que sus ingresos trimestrales superaron las expectativas, alcanzando $2.3 mil millones. El CEO de la empresa, John Smith, atribuyó el éxito a la fuerte demanda de productos y la expansión estratégica del mercado. Los accionistas recibirán un dividendo aumentado a partir del próximo trimestre."
  );
  const [confidence, setConfidence] = useState([92]);
  const [currentStep, setCurrentStep] = useState("confidence");

  const swapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    const tempText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(tempText);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Translation</h1>
          <p className="text-muted-foreground">
            Document and content translation with quality review
          </p>
        </div>
        <WorkflowProgress currentStep={currentStep} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                Translation Editor
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger className="w-[140px]" data-testid="select-source-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={swapLanguages}
                  data-testid="button-swap-languages"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger className="w-[140px]" data-testid="select-target-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Source ({languages.find((l) => l.code === sourceLanguage)?.name})
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {sourceText.split(" ").length} words
                    </span>
                  </div>
                  <Textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    className="min-h-[300px] resize-none"
                    placeholder="Enter source text..."
                    data-testid="textarea-source"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Translation ({languages.find((l) => l.code === targetLanguage)?.name})
                    </label>
                    <Button variant="ghost" size="sm" className="h-6">
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    value={translatedText}
                    onChange={(e) => setTranslatedText(e.target.value)}
                    className="min-h-[300px] resize-none"
                    placeholder="Translation will appear here..."
                    data-testid="textarea-translation"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Button variant="outline" data-testid="button-auto-translate">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Translate
                </Button>
                <div className="text-sm text-muted-foreground">
                  Character count: {translatedText.length}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Accuracy", value: 94, color: "text-emerald-600" },
                  { label: "Fluency", value: 91, color: "text-blue-600" },
                  { label: "Terminology", value: 88, color: "text-purple-600" },
                  { label: "Style Match", value: 85, color: "text-amber-600" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="p-4 rounded-lg border border-border text-center"
                  >
                    <p className={`text-2xl font-bold ${metric.color}`}>
                      {metric.value}%
                    </p>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Translation Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about translation choices, terminology decisions..."
                className="min-h-[120px]"
                data-testid="textarea-notes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Glossary Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { source: "revenue", target: "ingresos" },
                  { source: "shareholders", target: "accionistas" },
                  { source: "dividend", target: "dividendo" },
                ].map((term, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded border border-border text-sm"
                  >
                    <span className="font-medium">{term.source}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{term.target}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confidence Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Slider
                  value={confidence}
                  onValueChange={setConfidence}
                  max={100}
                  step={1}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Score</span>
                  <span className="text-lg font-semibold">{confidence}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button className="w-full" variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
