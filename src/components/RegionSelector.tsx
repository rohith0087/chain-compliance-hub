
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const RegionSelector = () => {
  const { t } = useTranslation('home');
  const { currentRegion, setRegion, regions } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleRegionSelect = (regionCode: string) => {
    setRegion(regionCode);
    setIsOpen(false);
  };

  const currentRegionData = regions.find(r => r.code === currentRegion);

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="bg-card shadow-lg hover:shadow-xl border-2 border-blue-200 hover:border-blue-300"
          >
            <Globe className="w-4 h-4 mr-2" />
            {currentRegionData?.flag} {t(`regionSelector.regions.${currentRegion.replace('-', '')}`)}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{t('regionSelector.title')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {regions.map((region) => (
              <Card 
                key={region.code}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  currentRegion === region.code 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => handleRegionSelect(region.code)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{region.flag}</div>
                      <div>
                        <p className="font-medium">{t(`regionSelector.regions.${region.code.replace('-', '')}`)}</p>
                        <p className="text-sm text-muted-foreground">
                          {region.languages.map(lang => 
                            lang === 'en' ? 'English' : 'Español'
                          ).join(', ')}
                        </p>
                      </div>
                    </div>
                    {currentRegion === region.code && (
                      <Check className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegionSelector;
