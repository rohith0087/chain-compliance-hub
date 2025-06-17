
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDemoData = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const createDemoUsers = async () => {
    setIsCreating(true);
    
    try {
      // Demo users data
      const demoUsers = [
        {
          email: 'sonic@franchise.com',
          password: 'demo123',
          fullName: 'Sonic Franchisee',
          roles: ['buyer', 'supplier'] as ('buyer' | 'supplier')[],
          companyName: 'Sonic Drive-In Franchise'
        },
        {
          email: 'processor@chicken.com',
          password: 'demo123',
          fullName: 'Chicken Processor Co',
          roles: ['buyer', 'supplier'] as ('buyer' | 'supplier')[],
          companyName: 'Premium Chicken Processing LLC'
        },
        {
          email: 'farm@organic.com',
          password: 'demo123',
          fullName: 'Organic Farm',
          roles: ['supplier'] as ('buyer' | 'supplier')[],
          companyName: 'Green Valley Organic Farm'
        }
      ];

      // Create demo users
      for (const user of demoUsers) {
        const { error } = await supabase.auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: user.fullName,
              roles: user.roles,
              company_name: user.companyName
            }
          }
        });

        if (error && !error.message.includes('already registered')) {
          console.error(`Error creating demo user ${user.email}:`, error);
        }
      }

      // Wait a bit for profiles to be created
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create supplier records for demo users
      await createSuppliersForDemoUsers();

      // Create sample requests
      await createSampleRequests();

      toast({
        title: "Demo Data Created",
        description: "Demo accounts and data are ready to use!",
      });

    } catch (error) {
      console.error('Error creating demo data:', error);
      toast({
        title: "Demo Data Creation Failed",
        description: "There was an error setting up demo accounts.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const createSuppliersForDemoUsers = async () => {
    try {
      // Get the demo users from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('email', ['sonic@franchise.com', 'processor@chicken.com', 'farm@organic.com']);

      if (!profiles || profiles.length === 0) {
        console.log('No demo profiles found to create suppliers');
        return;
      }

      // Create supplier records
      const suppliersData = profiles.map(profile => ({
        profile_id: profile.id,
        company_name: profile.company_name || profile.full_name,
        contact_email: profile.email,
        phone: '555-0123',
        address: '123 Demo Street, Demo City, DC 12345',
        industry: profile.email.includes('farm') ? 'Agriculture' : 
                 profile.email.includes('processor') ? 'Food Processing' : 'Restaurant'
      }));

      const { error } = await supabase
        .from('suppliers')
        .insert(suppliersData);

      if (error) {
        console.error('Error creating suppliers:', error);
      } else {
        console.log('Suppliers created successfully');
      }

    } catch (error) {
      console.error('Error in createSuppliersForDemoUsers:', error);
    }
  };

  const createSampleRequests = async () => {
    try {
      // First, get the demo users from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('email', ['sonic@franchise.com', 'processor@chicken.com', 'farm@organic.com']);

      if (!profiles || profiles.length === 0) {
        console.log('No demo profiles found to create sample requests');
        return;
      }

      // Get supplier records
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .in('profile_id', profiles.map(p => p.id));

      if (!suppliers || suppliers.length === 0) {
        console.log('No suppliers found to create sample requests');
        return;
      }

      const sonicProfile = profiles.find(p => p.email === 'sonic@franchise.com');
      const processorProfile = profiles.find(p => p.email === 'processor@chicken.com');
      const farmProfile = profiles.find(p => p.email === 'farm@organic.com');

      const processorSupplier = suppliers.find(s => s.profile_id === processorProfile?.id);
      const farmSupplier = suppliers.find(s => s.profile_id === farmProfile?.id);

      if (!sonicProfile || !processorProfile || !farmProfile || !processorSupplier || !farmSupplier) {
        console.log('Not all demo profiles or suppliers found');
        return;
      }

      // Sample document requests with proper typing
      const sampleRequests = [
        {
          title: 'Food Safety Certificate',
          document_type: 'Food Safety Certificate',
          category: 'Safety',
          description: 'Required food safety certification for chicken processing',
          requester_id: sonicProfile.id,
          supplier_id: processorSupplier.id,
          priority: 'high' as const,
          status: 'pending' as const,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          title: 'Organic Certification',
          document_type: 'Organic Certificate',
          category: 'Quality',
          description: 'Organic certification for farm products',
          requester_id: processorProfile.id,
          supplier_id: farmSupplier.id,
          priority: 'medium' as const,
          status: 'pending' as const,
          due_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          title: 'Insurance Certificate',
          document_type: 'Insurance Certificate',
          category: 'Legal',
          description: 'General liability insurance certificate',
          requester_id: sonicProfile.id,
          supplier_id: farmSupplier.id,
          priority: 'low' as const,
          status: 'approved' as const,
          due_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ];

      // Insert sample requests
      const { error } = await supabase
        .from('document_requests')
        .insert(sampleRequests);

      if (error) {
        console.error('Error creating sample requests:', error);
      } else {
        console.log('Sample requests created successfully');
      }

    } catch (error) {
      console.error('Error in createSampleRequests:', error);
    }
  };

  return {
    createDemoUsers,
    createSampleRequests,
    isCreating
  };
};
