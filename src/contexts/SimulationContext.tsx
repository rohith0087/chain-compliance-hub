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
  simulationNotifications,
  simulationAvailableBuyers,
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
  has_sample?: boolean;
  sample_file_name?: string;
  sample_file_size?: number;
  sample_notes?: string;
}

interface SimulationNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

interface PendingOutgoingRequest {
  id: string;
  buyer_id: string;
  buyer_name: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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
  // New state for enhanced simulation
  notifications: SimulationNotification[];
  pendingOutgoingRequests: PendingOutgoingRequest[];
  showConnectModal: boolean;
  showUploadModal: boolean;
  selectedRequestForUpload: DocumentRequest | null;
  showNotificationCenter: boolean;
  showLibraryUploadModal: boolean;
  showOnboardingUploadModal: boolean;
  selectedOnboardingDoc: typeof simulationDocumentRequirements[0] | null;
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
  sendConnectionRequest: (buyerId: string, notes?: string) => void;
  setShowConnectModal: (show: boolean) => void;
  
  // Onboarding actions
  uploadOnboardingDocument: (docId: string) => void;
  completeFormField: (fieldId: string) => void;
  submitOnboarding: () => void;
  openOnboardingUploadModal: (doc: typeof simulationDocumentRequirements[0]) => void;
  closeOnboardingUploadModal: () => void;
  downloadTemplate: (docId: string) => void;
  
  // Document request actions
  submitDocumentForRequest: (requestId: string) => void;
  openUploadModal: (request: DocumentRequest) => void;
  closeUploadModal: () => void;
  submitDocumentWithDetails: (requestId: string, details: { fileName: string; expirationDate?: string; notes?: string }) => void;
  
  // Library actions
  setShowLibraryUploadModal: (show: boolean) => void;
  uploadToLibrary: (details: { name: string; category: string; tags: string[]; expirationDate?: string }) => void;
  
  // Notification actions
  setShowNotificationCenter: (show: boolean) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  getUnreadNotificationCount: () => number;
  
  // Expiring documents actions
  renewDocument: (docId: string) => void;
  
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
  getAvailableBuyers: () => typeof simulationAvailableBuyers;
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
  // New state
  notifications: [...simulationNotifications],
  pendingOutgoingRequests: [],
  showConnectModal: false,
  showUploadModal: false,
  selectedRequestForUpload: null,
  showNotificationCenter: false,
  showLibraryUploadModal: false,
  showOnboardingUploadModal: false,
  selectedOnboardingDoc: null,
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
      notifications: [...simulationNotifications],
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
      notifications: [...simulationNotifications],
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
      notifications: prev.notifications.filter(n => n.type !== 'connection_request'),
    }));
    toast.success('Connection accepted! Now complete your onboarding.');
  }, []);

  const sendConnectionRequest = useCallback((buyerId: string, notes?: string) => {
    const buyer = simulationAvailableBuyers.find(b => b.id === buyerId);
    if (!buyer) {
      toast.error('Buyer not found');
      return;
    }
    
    const newRequest: PendingOutgoingRequest = {
      id: `sim-outgoing-${Date.now()}`,
      buyer_id: buyerId,
      buyer_name: buyer.company_name,
      notes,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    setState(prev => ({
      ...prev,
      pendingOutgoingRequests: [...prev.pendingOutgoingRequests, newRequest],
      showConnectModal: false,
    }));
    
    toast.success(`Connection request sent to ${buyer.company_name}!`);
    
    // Simulate approval after 5 seconds
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        pendingOutgoingRequests: prev.pendingOutgoingRequests.map(r =>
          r.id === newRequest.id ? { ...r, status: 'approved' } : r
        ),
        notifications: [
          {
            id: `sim-notif-${Date.now()}`,
            type: 'connection_approved',
            title: 'Connection Approved!',
            message: `${buyer.company_name} has approved your connection request`,
            read: false,
            created_at: new Date().toISOString(),
            action_url: '/connections',
          },
          ...prev.notifications,
        ],
      }));
      toast.success(`🎉 ${buyer.company_name} accepted your connection request!`);
    }, 5000);
  }, []);

  const setShowConnectModal = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showConnectModal: show }));
  }, []);

  const openOnboardingUploadModal = useCallback((doc: typeof simulationDocumentRequirements[0]) => {
    setState(prev => ({
      ...prev,
      showOnboardingUploadModal: true,
      selectedOnboardingDoc: doc,
    }));
  }, []);

  const closeOnboardingUploadModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      showOnboardingUploadModal: false,
      selectedOnboardingDoc: null,
    }));
  }, []);

  const downloadTemplate = useCallback((docId: string) => {
    toast.success('Template downloaded! Fill in your details and re-upload.');
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
        showOnboardingUploadModal: false,
        selectedOnboardingDoc: null,
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
        notifications: [
          {
            id: `sim-notif-${Date.now()}`,
            type: 'onboarding_approved',
            title: 'Onboarding Approved!',
            message: 'Acme Fresh Foods has approved your onboarding',
            read: false,
            created_at: new Date().toISOString(),
            action_url: '/connections',
          },
          ...prev.notifications,
        ],
      }));
      toast.success('🎉 Your onboarding has been approved by Acme Fresh Foods!');
    }, 3000);
  }, []);

  const openUploadModal = useCallback((request: DocumentRequest) => {
    setState(prev => ({
      ...prev,
      showUploadModal: true,
      selectedRequestForUpload: request,
    }));
  }, []);

  const closeUploadModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      showUploadModal: false,
      selectedRequestForUpload: null,
    }));
  }, []);

  const submitDocumentWithDetails = useCallback((requestId: string, details: { fileName: string; expirationDate?: string; notes?: string }) => {
    setState(prev => {
      const updatedRequests = prev.documentRequests.map(req =>
        req.id === requestId ? { ...req, status: 'submitted' } : req
      );
      
      const request = prev.documentRequests.find(r => r.id === requestId);
      const newUpload = {
        id: `sim-upload-${Date.now()}`,
        request_id: requestId,
        file_name: details.fileName || `${request?.document_type || 'document'}_upload.pdf`,
        file_path: `/uploads/sim/${request?.document_type || 'document'}_upload.pdf`,
        file_size: 125000,
        mime_type: 'application/pdf',
        status: 'submitted',
        expiration_date: details.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
        showUploadModal: false,
        selectedRequestForUpload: null,
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
          notifications: [
            {
              id: `sim-notif-${Date.now()}`,
              type: 'document_approved',
              title: 'Document Approved!',
              message: `Your ${prev.documentRequests.find(r => r.id === requestId)?.title} has been approved`,
              read: false,
              created_at: new Date().toISOString(),
              action_url: '/documents',
            },
            ...prev.notifications,
          ],
        };
      });
      toast.success('🎉 Your document has been approved!');
    }, 3000);
  }, []);

  const submitDocumentForRequest = useCallback((requestId: string) => {
    // Open the upload modal instead of instant submit
    const request = state.documentRequests.find(r => r.id === requestId);
    if (request) {
      setState(prev => ({
        ...prev,
        showUploadModal: true,
        selectedRequestForUpload: request,
      }));
    }
  }, [state.documentRequests]);

  const setShowLibraryUploadModal = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showLibraryUploadModal: show }));
  }, []);

  const uploadToLibrary = useCallback((details: { name: string; category: string; tags: string[]; expirationDate?: string }) => {
    const newDoc = {
      id: `sim-lib-${Date.now()}`,
      document_name: details.name,
      document_type: details.category.toLowerCase().replace(/ /g, '_'),
      category: details.category,
      file_path: `/library/sim/${details.name.replace(/ /g, '_').toLowerCase()}.pdf`,
      file_size: Math.floor(Math.random() * 500000) + 100000,
      mime_type: 'application/pdf',
      expiration_date: details.expirationDate || null,
      version: 1,
      is_current_version: true,
      created_at: new Date().toISOString(),
      tags: details.tags,
      description: '',
    };
    
    setState(prev => ({
      ...prev,
      libraryDocuments: [newDoc, ...prev.libraryDocuments],
      showLibraryUploadModal: false,
    }));
    
    toast.success('Document added to library!');
  }, []);

  const setShowNotificationCenter = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showNotificationCenter: show }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
    }));
  }, []);

  const getUnreadNotificationCount = useCallback(() => {
    return state.notifications.filter(n => !n.read).length;
  }, [state.notifications]);

  const renewDocument = useCallback((docId: string) => {
    toast.success('Renewal request submitted. Upload your updated document.');
    // In a real scenario, this would open an upload modal
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
      totalRequests: state.documentRequests.length,
      complianceRate: state.documentRequests.length > 0 
        ? Math.round((approved / state.documentRequests.length) * 100)
        : 0,
      connectedBuyers: state.connectedBuyers.length,
      totalUploads: state.documentUploads.length,
    };
  }, [state.documentRequests, state.connectedBuyers, state.documentUploads]);

  const getExpiringDocuments = useCallback(() => simulationExpiringDocuments, []);
  
  const getActivityTrend = useCallback(() => simulationActivityTrend, []);

  const getAvailableBuyers = useCallback(() => simulationAvailableBuyers, []);

  const value: SimulationContextType = {
    ...state,
    startSimulation,
    exitSimulation,
    resetSimulation,
    setActiveTab,
    acceptConnection,
    sendConnectionRequest,
    setShowConnectModal,
    uploadOnboardingDocument,
    completeFormField,
    submitOnboarding,
    openOnboardingUploadModal,
    closeOnboardingUploadModal,
    downloadTemplate,
    submitDocumentForRequest,
    openUploadModal,
    closeUploadModal,
    submitDocumentWithDetails,
    setShowLibraryUploadModal,
    uploadToLibrary,
    setShowNotificationCenter,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,
    renewDocument,
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
    getAvailableBuyers,
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