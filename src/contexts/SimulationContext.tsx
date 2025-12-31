import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  simulationBuyer,
  simulationConnectionRequest,
  simulationOnboardingRequest,
  simulationDocumentRequirements,
  simulationFormFields,
  simulationDocumentRequests,
  simulationSteps,
  simulationComplianceStats,
} from '@/data/supplierSimulationData';
import { toast } from 'sonner';

export type SimulationStep = 
  | 'intro'
  | 'connect'
  | 'onboarding-docs'
  | 'onboarding-form'
  | 'submit-onboarding'
  | 'view-requests'
  | 'submit-document'
  | 'approval'
  | 'complete';

export type ConnectionStatus = 'pending' | 'approved' | 'onboarding' | 'active';
export type OnboardingStatus = 'pending' | 'in_progress' | 'submitted' | 'approved';

interface DocumentRequest {
  id: string;
  title: string;
  document_type: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  created_at: string;
  buyer_id: string;
  supplier_id: string;
  buyer: typeof simulationBuyer;
}

interface SimulationState {
  isActive: boolean;
  currentStep: SimulationStep;
  completedSteps: string[];
  connectionStatus: ConnectionStatus;
  onboardingStatus: OnboardingStatus;
  documentRequests: DocumentRequest[];
  uploadedOnboardingDocs: string[];
  completedFormFields: string[];
  submittedDocuments: string[];
  showTour: boolean;
}

interface SimulationContextType extends SimulationState {
  // Actions
  startSimulation: () => void;
  exitSimulation: () => void;
  resetSimulation: () => void;
  
  // Connection actions
  acceptConnection: () => void;
  
  // Onboarding actions
  uploadOnboardingDocument: (docId: string) => void;
  completeFormField: (fieldId: string) => void;
  submitOnboarding: () => void;
  
  // Document request actions
  submitDocumentForRequest: (requestId: string) => void;
  
  // Navigation
  goToStep: (step: SimulationStep) => void;
  completeCurrentStep: () => void;
  
  // Tour
  setShowTour: (show: boolean) => void;
  
  // Data getters
  getConnectionRequest: () => typeof simulationConnectionRequest;
  getOnboardingRequest: () => typeof simulationOnboardingRequest;
  getDocumentRequirements: () => typeof simulationDocumentRequirements;
  getFormFields: () => typeof simulationFormFields;
  getBuyer: () => typeof simulationBuyer;
  getSteps: () => typeof simulationSteps;
  getComplianceStats: () => typeof simulationComplianceStats;
}

const initialState: SimulationState = {
  isActive: false,
  currentStep: 'intro',
  completedSteps: [],
  connectionStatus: 'pending',
  onboardingStatus: 'pending',
  documentRequests: [...simulationDocumentRequests],
  uploadedOnboardingDocs: [],
  completedFormFields: [],
  submittedDocuments: [],
  showTour: true,
};

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SimulationState>(initialState);

  const startSimulation = useCallback(() => {
    setState({
      ...initialState,
      isActive: true,
      currentStep: 'connect',
      showTour: true,
    });
    toast.success('Simulation started! Follow the guided steps to learn the platform.');
  }, []);

  const exitSimulation = useCallback(() => {
    setState(initialState);
    toast.info('Simulation ended. Welcome to your real dashboard!');
  }, []);

  const resetSimulation = useCallback(() => {
    setState({
      ...initialState,
      isActive: true,
      currentStep: 'connect',
      showTour: true,
    });
    toast.info('Simulation reset. Starting from the beginning.');
  }, []);

  const acceptConnection = useCallback(() => {
    setState(prev => ({
      ...prev,
      connectionStatus: 'onboarding',
      completedSteps: [...prev.completedSteps, 'connect'],
      currentStep: 'onboarding-docs',
    }));
    toast.success('Connection accepted! Now complete your onboarding.');
  }, []);

  const uploadOnboardingDocument = useCallback((docId: string) => {
    setState(prev => {
      const newUploadedDocs = [...prev.uploadedOnboardingDocs, docId];
      const allDocsUploaded = newUploadedDocs.length >= simulationDocumentRequirements.length;
      
      return {
        ...prev,
        uploadedOnboardingDocs: newUploadedDocs,
        completedSteps: allDocsUploaded 
          ? [...prev.completedSteps, 'onboarding-docs']
          : prev.completedSteps,
        currentStep: allDocsUploaded ? 'onboarding-form' : prev.currentStep,
      };
    });
    toast.success('Document uploaded successfully!');
  }, []);

  const completeFormField = useCallback((fieldId: string) => {
    setState(prev => {
      const newCompletedFields = [...prev.completedFormFields, fieldId];
      const allFieldsCompleted = newCompletedFields.length >= simulationFormFields.length;
      
      return {
        ...prev,
        completedFormFields: newCompletedFields,
        completedSteps: allFieldsCompleted 
          ? [...prev.completedSteps, 'onboarding-form']
          : prev.completedSteps,
        currentStep: allFieldsCompleted ? 'submit-onboarding' : prev.currentStep,
      };
    });
  }, []);

  const submitOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      onboardingStatus: 'submitted',
      connectionStatus: 'active',
      completedSteps: [...prev.completedSteps, 'submit-onboarding'],
      currentStep: 'view-requests',
    }));
    toast.success('Onboarding submitted! The buyer will review your submission.');
    
    // Auto-approve after 3 seconds
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        onboardingStatus: 'approved',
      }));
      toast.success('🎉 Your onboarding has been approved by Acme Fresh Foods!');
    }, 3000);
  }, []);

  const submitDocumentForRequest = useCallback((requestId: string) => {
    setState(prev => {
      const updatedRequests = prev.documentRequests.map(req =>
        req.id === requestId ? { ...req, status: 'submitted' } : req
      );
      
      const newSubmittedDocs = [...prev.submittedDocuments, requestId];
      const isFirstSubmission = prev.submittedDocuments.length === 0;
      
      return {
        ...prev,
        documentRequests: updatedRequests,
        submittedDocuments: newSubmittedDocs,
        completedSteps: isFirstSubmission 
          ? [...prev.completedSteps, 'submit-document']
          : prev.completedSteps,
        currentStep: isFirstSubmission ? 'approval' : prev.currentStep,
      };
    });
    toast.success('Document submitted for review!');
    
    // Auto-approve after 3 seconds
    setTimeout(() => {
      setState(prev => {
        const updatedRequests = prev.documentRequests.map(req =>
          req.id === requestId ? { ...req, status: 'approved' } : req
        );
        
        const wasWaitingForApproval = prev.currentStep === 'approval';
        
        return {
          ...prev,
          documentRequests: updatedRequests,
          completedSteps: wasWaitingForApproval 
            ? [...prev.completedSteps, 'approval']
            : prev.completedSteps,
          currentStep: wasWaitingForApproval ? 'complete' : prev.currentStep,
        };
      });
      toast.success('🎉 Your document has been approved!');
    }, 3000);
  }, []);

  const goToStep = useCallback((step: SimulationStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const completeCurrentStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, prev.currentStep],
    }));
  }, []);

  const setShowTour = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showTour: show }));
  }, []);

  // Data getters
  const getConnectionRequest = useCallback(() => ({
    ...simulationConnectionRequest,
    status: state.connectionStatus,
  }), [state.connectionStatus]);

  const getOnboardingRequest = useCallback(() => ({
    ...simulationOnboardingRequest,
    status: state.onboardingStatus,
  }), [state.onboardingStatus]);

  const getDocumentRequirements = useCallback(() => 
    simulationDocumentRequirements.map(doc => ({
      ...doc,
      status: state.uploadedOnboardingDocs.includes(doc.id) ? 'uploaded' : 'pending',
    }))
  , [state.uploadedOnboardingDocs]);

  const getFormFields = useCallback(() => 
    simulationFormFields.map(field => ({
      ...field,
      completed: state.completedFormFields.includes(field.id),
    }))
  , [state.completedFormFields]);

  const getBuyer = useCallback(() => simulationBuyer, []);

  const getSteps = useCallback(() => 
    simulationSteps.map(step => ({
      ...step,
      completed: state.completedSteps.includes(step.id),
    }))
  , [state.completedSteps]);

  const getComplianceStats = useCallback(() => {
    const approved = state.documentRequests.filter(r => r.status === 'approved').length;
    const submitted = state.documentRequests.filter(r => r.status === 'submitted').length;
    const pending = state.documentRequests.filter(r => r.status === 'pending').length;
    
    return {
      ...simulationComplianceStats,
      approved,
      submitted,
      pending,
      complianceRate: Math.round((approved / state.documentRequests.length) * 100),
    };
  }, [state.documentRequests]);

  const value: SimulationContextType = {
    ...state,
    startSimulation,
    exitSimulation,
    resetSimulation,
    acceptConnection,
    uploadOnboardingDocument,
    completeFormField,
    submitOnboarding,
    submitDocumentForRequest,
    goToStep,
    completeCurrentStep,
    setShowTour,
    getConnectionRequest,
    getOnboardingRequest,
    getDocumentRequirements,
    getFormFields,
    getBuyer,
    getSteps,
    getComplianceStats,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};
