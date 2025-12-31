import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SimulationProvider, useSimulation } from '@/contexts/SimulationContext';
import { SimulationIntro } from '@/components/simulation/SimulationIntro';
import { SimulationComplete } from '@/components/simulation/SimulationComplete';
import { SupplierSimulationDashboard } from '@/components/simulation/SupplierSimulationDashboard';

const SimulationRouter = ({ onSkip }: { onSkip: () => void }) => {
  const { isActive, currentStep, startSimulation } = useSimulation();

  if (!isActive) {
    return <SimulationIntro onStart={startSimulation} onSkip={onSkip} />;
  }

  if (currentStep === 'complete') {
    return <SimulationComplete />;
  }

  return <SupplierSimulationDashboard />;
};

const SupplierSimulationPage = () => {
  const navigate = useNavigate();

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <SimulationProvider>
      <SimulationRouter onSkip={handleSkip} />
    </SimulationProvider>
  );
};

export default SupplierSimulationPage;
