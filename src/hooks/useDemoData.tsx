
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useDemoData = () => {
  const { user } = useAuth();

  const createDemoData = async () => {
    if (!user) return;

    try {
      // Create demo suppliers for non-demo users
      const supplierData = [
        {
          company_name: 'Premium Farms LLC',
          contact_email: 'contact@premiumfarms.com',
          industry: 'Agriculture',
          phone: '555-0101',
          address: '123 Farm Road, Rural Valley, CA 95123'
        },
        {
          company_name: 'FreshSource Distributors',
          contact_email: 'orders@freshsource.com',
          industry: 'Food Distribution',
          phone: '555-0102',
          address: '456 Distribution Center, Metro City, CA 90210'
        },
        {
          company_name: 'Quality Feed Solutions',
          contact_email: 'info@qualityfeed.com',
          industry: 'Animal Feed',
          phone: '555-0103',
          address: '789 Feed Mill Lane, Farm County, CA 93001'
        }
      ];

      // Check if suppliers already exist
      const { data: existingSuppliers } = await supabase
        .from('suppliers')
        .select('company_name');

      const existingCompanyNames = existingSuppliers?.map(s => s.company_name) || [];
      const newSuppliers = supplierData.filter(s => !existingCompanyNames.includes(s.company_name));

      if (newSuppliers.length > 0) {
        const { error: supplierError } = await supabase
          .from('suppliers')
          .insert(newSuppliers);

        if (supplierError) {
          console.error('Error creating demo suppliers:', supplierError);
        }
      }

      // Get all suppliers for creating requests
      const { data: allSuppliers } = await supabase
        .from('suppliers')
        .select('*');

      if (!allSuppliers || allSuppliers.length === 0) return;

      // Create demo document requests from current user to suppliers
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 14);

      const requestsData = [
        {
          title: 'ISO 9001 Quality Management Certificate',
          document_type: 'certificate',
          category: 'quality',
          description: 'Current ISO 9001 certification demonstrating quality management system compliance',
          requester_id: user.id,
          supplier_id: allSuppliers[0]?.id,
          priority: 'high' as const,
          status: 'pending' as const,
          due_date: futureDate.toISOString().split('T')[0]
        },
        {
          title: 'Food Safety Certificate',
          document_type: 'certificate',
          category: 'safety',
          description: 'HACCP and food safety certification for all processed products',
          requester_id: user.id,
          supplier_id: allSuppliers[1]?.id,
          priority: 'urgent' as const,
          status: 'submitted' as const,
          due_date: futureDate.toISOString().split('T')[0]
        },
        {
          title: 'Environmental Impact Report',
          document_type: 'audit_report',
          category: 'environmental',
          description: 'Annual environmental compliance and sustainability report',
          requester_id: user.id,
          supplier_id: allSuppliers[2]?.id,
          priority: 'medium' as const,
          status: 'approved' as const,
          due_date: futureDate.toISOString().split('T')[0]
        },
        {
          title: 'Insurance Certificate',
          document_type: 'insurance',
          category: 'financial',
          description: 'General liability and product liability insurance coverage proof',
          requester_id: user.id,
          supplier_id: allSuppliers[0]?.id,
          priority: 'low' as const,
          status: 'rejected' as const,
          due_date: futureDate.toISOString().split('T')[0]
        }
      ];

      // Check existing requests to avoid duplicates
      const { data: existingRequests } = await supabase
        .from('document_requests')
        .select('title')
        .eq('requester_id', user.id);

      const existingTitles = existingRequests?.map(r => r.title) || [];
      const newRequests = requestsData.filter(r => !existingTitles.includes(r.title));

      if (newRequests.length > 0) {
        const { data: createdRequests, error: requestError } = await supabase
          .from('document_requests')
          .insert(newRequests)
          .select();

        if (requestError) {
          console.error('Error creating demo requests:', requestError);
        } else {
          console.log(`Created ${createdRequests?.length} demo requests`);
          
          // Create some demo document uploads for submitted/approved requests
          const submittedRequest = createdRequests?.find(r => r.status === 'submitted');
          const approvedRequest = createdRequests?.find(r => r.status === 'approved');

          if (submittedRequest || approvedRequest) {
            const uploadData = [];
            
            if (submittedRequest) {
              uploadData.push({
                request_id: submittedRequest.id,
                uploader_id: user.id,
                file_name: 'food_safety_certificate.pdf',
                file_path: `demo/${submittedRequest.id}/food_safety_certificate.pdf`,
                file_size: 2457600, // 2.4MB
                mime_type: 'application/pdf',
                status: 'pending_review'
              });
            }

            if (approvedRequest) {
              uploadData.push({
                request_id: approvedRequest.id,
                uploader_id: user.id,
                file_name: 'environmental_report_2024.pdf',
                file_path: `demo/${approvedRequest.id}/environmental_report_2024.pdf`,
                file_size: 5242880, // 5MB
                mime_type: 'application/pdf',
                status: 'approved'
              });
            }

            if (uploadData.length > 0) {
              const { error: uploadError } = await supabase
                .from('document_uploads')
                .insert(uploadData);

              if (uploadError) {
                console.error('Error creating demo uploads:', uploadError);
              }
            }
          }
        }
      }

      console.log('Demo data creation completed');
    } catch (error) {
      console.error('Error in createDemoData:', error);
    }
  };

  useEffect(() => {
    if (user) {
      // Small delay to ensure user profile is loaded
      const timer = setTimeout(() => {
        createDemoData();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user]);

  return { createDemoData };
};
