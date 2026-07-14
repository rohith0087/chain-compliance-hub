import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RiskPolicyConfig } from '@/features/supplier-risk/RiskPolicyConfig';

export default function SupplierRiskPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
        <RiskPolicyConfig />
      </div>
    </div>
  );
}
