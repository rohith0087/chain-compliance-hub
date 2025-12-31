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
  simulationSupplierProfile,
  simulationDocumentUploads,
  simulationLibraryDocuments,
  simulationConnectedBuyers,
  simulationExpiringDocuments,
  simulationActivityTrend,
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

export type SimulationTab = 'overview' | 'requests' | 'documents' | 'library' | 'connections' | 'compliance';

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
  buyers: typeof simulationBuyer;
}

interface SimulationState {
  isActive: boolean;
  currentStep: SimulationStep;
  currentTab: SimulationTab;
  completedSteps: string[];
  connectionStatus: ConnectionStatus;
  onboardingStatus: OnboardingStatus;
  documentRequests: DocumentRequest[];
  documentUploads: typeof simulationDocumentUploads;
  libraryDocuments: typeof simulationLibraryDocuments;
  connectedBuyers: typeof simulationConnectedBuyers;
  uploadedOnboardingDocs: string[];
  completedFormFields: string[];
  submittedDocuments: string[];
  showTour: boolean;
  pendingConnectionRequest: typeof simulationConnectionRequest | null;
}

interface SimulationContextType extends SimulationState {
  // Actions
  startSimulation: () => void;
  exitSimulation: () => void;
  resetSimulation: () => void;
  
  // Tab navigation
  setActiveTab: (tab: SimulationTab) => void;
  
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
  getConnectionRequest: () => typeof simulationConnectionRequest | null;
  getOnboardingRequest: () => typeof simulationOnboardingRequest;
  getDocumentRequirements: () => typeof simulationDocumentRequirements;
  getFormFields: () => typeof simulationFormFields;
  getBuyer: () => typeof simulationBuyer;
  getSupplierProfile: () => typeof simulationSupplierProfile;
  getSteps: () => typeof simulationSteps;
  getComplianceStats: () => typeof simulationComplianceStats;
  getExpiringDocuments: () => typeof simulationExpiringDocuments;
  getActivityTrend: () => typeof simulationActivityTrend;
}

const initialState: SimulationState = {
  isActive: false,
  currentStep: 'intro',
  currentTab: 'overview',
  completedSteps: [],
  connectionStatus: 'pending',
  onboardingStatus: 'pending',
  documentRequests: [...simulationDocumentRequests],
  documentUploads: [...simulationDocumentUploads],
  libraryDocuments: [...simulationLibraryDocuments],
  connectedBuyers: [],
  uploadedOnboardingDocs: [],
  completedFormFields: [],
  submittedDocuments: [],
  showTour: true,
  pendingConnectionRequest: { ...simulationConnectionRequest },
};

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SimulationState>(initialState);

  const startSimulation = useCallback(() => {
    setState({
      ...initialState,
      isActive: true,
      currentStep: 'connect',
      currentTab: 'overview',
      showTour: true,
      pendingConnectionRequest: { ...simulationConnectionRequest },
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
      currentTab: 'overview',
      showTour: true,
      pendingConnectionRequest: { ...simulationConnectionRequest },
    });
    toast.info('Simulation reset. Starting from the beginning.');
  }, []);

  const setActiveTab = useCallback((tab: SimulationTab) => {
    setState(prev => ({ ...prev, currentTab: tab }));
  }, []);

  const acceptConnection = useCallback(() => {
    setState(prev => ({
      ...prev,
      connectionStatus: 'onboarding',
      completedSteps: [...prev.completedSteps, 'connect'],
      currentStep: 'onboarding-docs',
      pendingConnectionRequest: null,
      connectedBuyers: [{
        id: 'sim-connection-001',
        buyer_id: 'sim-buyer-001',
        supplier_id: 'sim-supplier-001',
        status: 'approved',
        requested_at: simulationConnectionRequest.requested_at,
        responded_at: new Date().toISOString(),
        buyers: simulationBuyer,
        unifiedStatus: 'onboardingPending',
        supplier_onboarding_requests: [{
          id: 'sim-onboarding-001',
          status: 'pending',
          approved_at: null,
        }],
      }],
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
        onboardingStatus: 'in_progress',
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
      completedSteps: [...prev.completedSteps, 'submit-onboarding'],
      currentStep: 'view-requests',
      connectedBuyers: prev.connectedBuyers.map(conn => ({
        ...conn,
        unifiedStatus: 'onboardingPending',
        supplier_onboarding_requests: [{
          ...conn.supplier_onboarding_requests?.[0],
          status: 'submitted',
        }],
      })),
    }));
    toast.success('Onboarding submitted! The buyer will review your submission.');
    
    // Auto-approve after 3 seconds
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        onboardingStatus: 'approved',
        connectionStatus: 'active',
        connectedBuyers: prev.connectedBuyers.map(conn => ({
          ...conn,
          unifiedStatus: 'fullyConnected',
          supplier_onboarding_requests: [{
            ...conn.supplier_onboarding_requests?.[0],
            status: 'approved',
            approved_at: new Date().toISOString(),
          }],
        })),
      }));
      toast.success('🎉 Your onboarding has been approved by Acme Fresh Foods!');
    }, 3000);
  }, []);

  const submitDocumentForRequest = useCallback((requestId: string) => {
    setState(prev => {
      const updatedRequests = prev.documentRequests.map(req =>
        req.id === requestId ? { ...req, status: 'submitted' } : req
      );
      
      // Add a new upload entry
      const request = prev.documentRequests.find(r => r.id === requestId);
      const newUpload = {
        id: `sim-upload-${Date.now()}`,
        request_id: requestId,
        file_name: `${request?.document_type || 'document'}_upload.pdf`,
        file_path: `/uploads/sim/${request?.document_type || 'document'}_upload.pdf`,
        file_size: 125000,
        mime_type: 'application/pdf',
        status: 'submitted',
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        document_requests: {
          id: requestId,
          title: request?.title || 'Document',
          document_type: request?.document_type || 'document',
          category: request?.category || 'General',
          buyers: simulationBuyer,
        },
      };
      
      const newSubmittedDocs = [...prev.submittedDocuments, requestId];
      const isFirstSubmission = prev.submittedDocuments.length === 0;
      
      return {
        ...prev,
        documentRequests: updatedRequests,
        documentUploads: [...prev.documentUploads, newUpload],
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
        
        const updatedUploads = prev.documentUploads.map(upload =>
          upload.request_id === requestId ? { ...upload, status: 'approved', approved_at: new Date().toISOString() } : upload
        );
        
        const wasWaitingForApproval = prev.currentStep === 'approval';
        
        return {
          ...prev,
          documentRequests: updatedRequests,
          documentUploads: updatedUploads,
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
  const getConnectionRequest = useCallback(() => state.pendingConnectionRequest, [state.pendingConnectionRequest]);

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
  
  const getSupplierProfile = useCallback(() => simulationSupplierProfile, []);

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
      complianceRate: state.documentRequests.length > 0 
        ? Math.round((approved / state.documentRequests.length) * 100)
        : 0,
      connectedBuyers: state.connectedBuyers.length,
    };
  }, [state.documentRequests, state.connectedBuyers]);

  const getExpiringDocuments = useCallback(() => simulationExpiringDocuments, []);
  
  const getActivityTrend = useCallback(() => simulationActivityTrend, []);

  const value: SimulationContextType = {
    ...state,
    startSimulation,
    exitSimulation,
    resetSimulation,
    setActiveTab,
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
    getSupplierProfile,
    getSteps,
    getComplianceStats,
    getExpiringDocuments,
    getActivityTrend,
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
