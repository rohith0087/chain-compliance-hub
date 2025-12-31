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
  demoBuyerId,
} from '@/data/supplierSimulationData';
import { toast } from 'sonner';

export type SimulationStep = 
  | 'intro'
  | 'request-connection'
  | 'wait-approval'
  | 'onboarding-docs'
  | 'onboarding-form'
  | 'submit-onboarding'
  | 'check-request-notification'
  | 'upload-document'
  | 'document-approved'
  | 'check-expiry-notification'
  | 'renew-document'
  | 'explore-help'
  | 'complete';

export type ConnectionStatus = 'none' | 'pending' | 'approved' | 'onboarding' | 'active';
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
  stepTrigger?: SimulationStep; // Which step this notification advances
}

interface PendingOutgoingRequest {
  id: string;
  buyer_id: string;
  buyer_name: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface ExpiringDocument {
  id: string;
  title: string;
  buyer_name: string;
  expiration_date: string;
  days_until_expiry: number;
  is_expired: boolean;
  request_id: string;
  document_type: string;
  category: string;
  file_name: string;
  status: string;
  version: number;
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
  // Enhanced simulation state
  notifications: SimulationNotification[];
  pendingOutgoingRequests: PendingOutgoingRequest[];
  showConnectModal: boolean;
  showUploadModal: boolean;
  selectedRequestForUpload: DocumentRequest | null;
  showNotificationCenter: boolean;
  showLibraryUploadModal: boolean;
  showOnboardingUploadModal: boolean;
  selectedOnboardingDoc: typeof simulationDocumentRequirements[0] | null;
  showRenewalUploadModal: boolean;
  selectedExpiringDoc: ExpiringDocument | null;
  expiringDocuments: ExpiringDocument[];
  showHelpCenter: boolean;
  enteredBuyerId: string;
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
  setEnteredBuyerId: (id: string) => void;
  
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
  handleNotificationClick: (notification: SimulationNotification) => void;
  
  // Expiring documents actions
  renewDocument: (docId: string) => void;
  openRenewalModal: (doc: ExpiringDocument) => void;
  closeRenewalModal: () => void;
  submitRenewal: (docId: string, fileName: string) => void;
  
  // Help center actions
  setShowHelpCenter: (show: boolean) => void;
  completeHelpExploration: () => void;
  
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
  getExpiringDocuments: () => ExpiringDocument[];
  getActivityTrend: () => typeof simulationActivityTrend;
  getAvailableBuyers: () => typeof simulationAvailableBuyers;
  getDemoBuyerId: () => string;
}

const initialState: SimulationState = {
  isActive: false,
  currentStep: 'intro',
  currentTab: 'overview',
  completedSteps: [],
  connectionStatus: 'none',
  onboardingStatus: 'pending',
  documentRequests: [],
  documentUploads: [],
  libraryDocuments: [...simulationLibraryDocuments],
  connectedBuyers: [],
  uploadedOnboardingDocs: [],
  completedFormFields: [],
  submittedDocuments: [],
  showTour: true,
  pendingConnectionRequest: null,
  // Enhanced state
  notifications: [],
  pendingOutgoingRequests: [],
  showConnectModal: false,
  showUploadModal: false,
  selectedRequestForUpload: null,
  showNotificationCenter: false,
  showLibraryUploadModal: false,
  showOnboardingUploadModal: false,
  selectedOnboardingDoc: null,
  showRenewalUploadModal: false,
  selectedExpiringDoc: null,
  expiringDocuments: [...simulationExpiringDocuments],
  showHelpCenter: false,
  enteredBuyerId: '',
};

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SimulationState>(initialState);

  const startSimulation = useCallback(() => {
    setState({
      ...initialState,
      isActive: true,
      currentStep: 'request-connection',
      currentTab: 'connections',
      showTour: true,
      pendingConnectionRequest: null,
      notifications: [],
      connectionStatus: 'none',
      documentRequests: [],
      documentUploads: [],
      expiringDocuments: [...simulationExpiringDocuments],
    });
    toast.success('Simulation started! Begin by connecting with a buyer.');
  }, []);

  const exitSimulation = useCallback(() => {
    setState(initialState);
    toast.info('Simulation ended. Welcome to your real dashboard!');
  }, []);

  const resetSimulation = useCallback(() => {
    setState({
      ...initialState,
      isActive: true,
      currentStep: 'request-connection',
      currentTab: 'connections',
      showTour: true,
      pendingConnectionRequest: null,
      notifications: [],
      connectionStatus: 'none',
      documentRequests: [],
      documentUploads: [],
      expiringDocuments: [...simulationExpiringDocuments],
    });
    toast.info('Simulation reset. Starting from the beginning.');
  }, []);

  const setActiveTab = useCallback((tab: SimulationTab) => {
    setState(prev => ({ ...prev, currentTab: tab }));
  }, []);

  const setEnteredBuyerId = useCallback((id: string) => {
    setState(prev => ({ ...prev, enteredBuyerId: id }));
  }, []);

  const acceptConnection = useCallback(() => {
    // Legacy function - kept for compatibility
    setState(prev => ({
      ...prev,
      connectionStatus: 'onboarding',
      completedSteps: [...prev.completedSteps, 'request-connection', 'wait-approval'],
      currentStep: 'onboarding-docs',
      pendingConnectionRequest: null,
      connectedBuyers: [{
        id: 'sim-connection-001',
        buyer_id: 'sim-buyer-001',
        supplier_id: 'sim-supplier-001',
        status: 'approved',
        requested_at: new Date().toISOString(),
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

  const sendConnectionRequest = useCallback((buyerId: string, notes?: string) => {
    // Validate buyer ID
    if (buyerId.toUpperCase() !== demoBuyerId) {
      toast.error(`Invalid Buyer ID. Try: ${demoBuyerId}`);
      return;
    }
    
    const newRequest: PendingOutgoingRequest = {
      id: `sim-outgoing-${Date.now()}`,
      buyer_id: buyerId,
      buyer_name: simulationBuyer.company_name,
      notes,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    setState(prev => ({
      ...prev,
      pendingOutgoingRequests: [newRequest],
      connectionStatus: 'pending',
      completedSteps: [...prev.completedSteps, 'request-connection'],
      currentStep: 'wait-approval',
      enteredBuyerId: buyerId,
    }));
    
    toast.success(`Connection request sent to ${simulationBuyer.company_name}! Wait for approval...`);
    
    // Simulate approval after 4 seconds
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        pendingOutgoingRequests: prev.pendingOutgoingRequests.map(r =>
          r.id === newRequest.id ? { ...r, status: 'approved' } : r
        ),
        connectionStatus: 'onboarding',
        completedSteps: [...prev.completedSteps, 'wait-approval'],
        currentStep: 'onboarding-docs',
        connectedBuyers: [{
          id: 'sim-connection-001',
          buyer_id: 'sim-buyer-001',
          supplier_id: 'sim-supplier-001',
          status: 'approved',
          requested_at: newRequest.created_at,
          responded_at: new Date().toISOString(),
          buyers: simulationBuyer,
          unifiedStatus: 'onboardingPending',
          supplier_onboarding_requests: [{
            id: 'sim-onboarding-001',
            status: 'pending',
            approved_at: null,
          }],
        }],
        notifications: [
          {
            id: `sim-notif-${Date.now()}`,
            type: 'connection_approved',
            title: 'Connection Approved!',
            message: `${simulationBuyer.company_name} has approved your connection request. Complete your onboarding now!`,
            read: false,
            created_at: new Date().toISOString(),
            action_url: '/connections',
          },
          ...prev.notifications,
        ],
      }));
      toast.success(`🎉 ${simulationBuyer.company_name} approved your request! Complete onboarding now.`);
    }, 4000);
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
    
    // Auto-approve after 3 seconds and add document request notification
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        onboardingStatus: 'approved',
        connectionStatus: 'active',
        completedSteps: [...prev.completedSteps, 'submit-onboarding'],
        currentStep: 'check-request-notification',
        connectedBuyers: prev.connectedBuyers.map(conn => ({
          ...conn,
          unifiedStatus: 'fullyConnected',
          supplier_onboarding_requests: [{
            ...conn.supplier_onboarding_requests?.[0],
            status: 'approved',
            approved_at: new Date().toISOString(),
          }],
        })),
        // Add document requests now that onboarding is complete
        documentRequests: [...simulationDocumentRequests.slice(0, 2)],
        notifications: [
          {
            id: `sim-notif-doc-request-${Date.now()}`,
            type: 'new_document_request',
            title: '📋 New Document Request',
            message: `${simulationBuyer.company_name} has requested a Food Handler Certificate. Click to view.`,
            read: false,
            created_at: new Date().toISOString(),
            action_url: '/requests',
            stepTrigger: 'check-request-notification',
          },
          {
            id: `sim-notif-${Date.now()}`,
            type: 'onboarding_approved',
            title: 'Onboarding Approved!',
            message: `${simulationBuyer.company_name} has approved your onboarding`,
            read: false,
            created_at: new Date().toISOString(),
            action_url: '/connections',
          },
          ...prev.notifications,
        ],
      }));
      toast.success('🎉 Onboarding approved! Check your notifications for a new document request.');
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
          ? [...prev.completedSteps, 'upload-document']
          : prev.completedSteps,
        currentStep: isFirstSubmission ? 'document-approved' : prev.currentStep,
        showUploadModal: false,
        selectedRequestForUpload: null,
      };
    });
    toast.success('Document submitted for review!');
    
    // Auto-approve and trigger expiry notification
    setTimeout(() => {
      setState(prev => {
        const updatedRequests = prev.documentRequests.map(req =>
          req.id === requestId ? { ...req, status: 'approved' } : req
        );
        
        const updatedUploads = prev.documentUploads.map(upload =>
          upload.request_id === requestId ? { ...upload, status: 'approved', approved_at: new Date().toISOString() } : upload
        );
        
        return {
          ...prev,
          documentRequests: updatedRequests,
          documentUploads: updatedUploads,
          completedSteps: [...prev.completedSteps, 'document-approved'],
          currentStep: 'check-expiry-notification',
          notifications: [
            {
              id: `sim-notif-expiry-${Date.now()}`,
              type: 'document_expiring',
              title: '⚠️ Document Expired',
              message: 'Workers Compensation Insurance has expired and needs renewal. Click to view.',
              read: false,
              created_at: new Date().toISOString(),
              action_url: '/documents',
              stepTrigger: 'check-expiry-notification',
            },
            {
              id: `sim-notif-approved-${Date.now()}`,
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
      toast.success('🎉 Document approved! Check notifications for an expiring document alert.');
    }, 3000);
  }, []);

  const submitDocumentForRequest = useCallback((requestId: string) => {
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

  const handleNotificationClick = useCallback((notification: SimulationNotification) => {
    setState(prev => {
      const updates: Partial<SimulationState> = {
        notifications: prev.notifications.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        ),
        showNotificationCenter: false,
      };
      
      // Navigate based on notification type
      if (notification.type === 'new_document_request') {
        updates.currentTab = 'requests';
        if (prev.currentStep === 'check-request-notification') {
          updates.completedSteps = [...prev.completedSteps, 'check-request-notification'];
          updates.currentStep = 'upload-document';
        }
      } else if (notification.type === 'document_expiring' || notification.type === 'document_expired') {
        updates.currentTab = 'documents';
        if (prev.currentStep === 'check-expiry-notification') {
          updates.completedSteps = [...prev.completedSteps, 'check-expiry-notification'];
          updates.currentStep = 'renew-document';
        }
      } else if (notification.type === 'connection_approved' || notification.type === 'onboarding_approved') {
        updates.currentTab = 'connections';
      } else if (notification.type === 'document_approved') {
        updates.currentTab = 'documents';
      }
      
      return { ...prev, ...updates };
    });
    
    toast.info(`Navigating to ${notification.action_url?.replace('/', '') || 'page'}...`);
  }, []);

  const openRenewalModal = useCallback((doc: ExpiringDocument) => {
    setState(prev => ({
      ...prev,
      showRenewalUploadModal: true,
      selectedExpiringDoc: doc,
    }));
  }, []);

  const closeRenewalModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      showRenewalUploadModal: false,
      selectedExpiringDoc: null,
    }));
  }, []);

  const renewDocument = useCallback((docId: string) => {
    const doc = state.expiringDocuments.find(d => d.id === docId);
    if (doc) {
      setState(prev => ({
        ...prev,
        showRenewalUploadModal: true,
        selectedExpiringDoc: doc,
      }));
    }
  }, [state.expiringDocuments]);

  const submitRenewal = useCallback((docId: string, fileName: string) => {
    setState(prev => {
      // Remove from expiring documents
      const updatedExpiring = prev.expiringDocuments.filter(d => d.id !== docId);
      const renewedDoc = prev.expiringDocuments.find(d => d.id === docId);
      
      // Add to document uploads as V2
      const newUpload = {
        id: `sim-upload-renewal-${Date.now()}`,
        request_id: renewedDoc?.request_id || docId,
        file_name: fileName || `${renewedDoc?.document_type || 'document'}_v2.pdf`,
        file_path: `/uploads/sim/${renewedDoc?.document_type || 'document'}_v2.pdf`,
        file_size: 125000,
        mime_type: 'application/pdf',
        status: 'approved',
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        version: 2,
        document_requests: {
          id: renewedDoc?.request_id || docId,
          title: renewedDoc?.title || 'Renewed Document',
          document_type: renewedDoc?.document_type || 'document',
          category: renewedDoc?.category || 'General',
          buyers: simulationBuyer,
        },
      };
      
      const isRenewalStep = prev.currentStep === 'renew-document';
      
      return {
        ...prev,
        expiringDocuments: updatedExpiring,
        documentUploads: [...prev.documentUploads, newUpload],
        showRenewalUploadModal: false,
        selectedExpiringDoc: null,
        completedSteps: isRenewalStep ? [...prev.completedSteps, 'renew-document'] : prev.completedSteps,
        currentStep: isRenewalStep ? 'explore-help' : prev.currentStep,
      };
    });
    
    toast.success('🎉 Document renewed! Version 2 uploaded successfully. Now explore the Help Center!');
  }, []);

  const setShowHelpCenter = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showHelpCenter: show }));
  }, []);

  const completeHelpExploration = useCallback(() => {
    setState(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, 'explore-help'],
      currentStep: 'complete',
      showHelpCenter: false,
    }));
    toast.success('🎉 Congratulations! You\'ve completed the simulation!');
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

  const getExpiringDocuments = useCallback(() => state.expiringDocuments, [state.expiringDocuments]);
  
  const getActivityTrend = useCallback(() => simulationActivityTrend, []);

  const getAvailableBuyers = useCallback(() => simulationAvailableBuyers, []);

  const getDemoBuyerId = useCallback(() => demoBuyerId, []);

  const value: SimulationContextType = {
    ...state,
    startSimulation,
    exitSimulation,
    resetSimulation,
    setActiveTab,
    acceptConnection,
    sendConnectionRequest,
    setShowConnectModal,
    setEnteredBuyerId,
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
    handleNotificationClick,
    renewDocument,
    openRenewalModal,
    closeRenewalModal,
    submitRenewal,
    setShowHelpCenter,
    completeHelpExploration,
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
    getDemoBuyerId,
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
