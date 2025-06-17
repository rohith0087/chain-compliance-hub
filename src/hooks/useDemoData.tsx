
import { useState, useEffect } from 'react';
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

      toast({
        title: "Demo Data Created",
        description: "Demo accounts are ready to use!",
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

      const sonicProfile = profiles.find(p => p.email === 'sonic@franchise.com');
      const processorProfile = profiles.find(p => p.email === 'processor@chicken.com');
      const farmProfile = profiles.find(p => p.email === 'farm@organic.com');

      if (!sonicProfile || !processorProfile || !farmProfile) {
        console.log('Not all demo profiles found');
        return;
      }

      // Sample document requests
      const sampleRequests = [
        {
          title: 'Food Safety Certificate',
          document_type: 'Food Safety Certificate',
          category: 'Safety',
          description: 'Required food safety certification for chicken processing',
          requester_id: sonicProfile.id,
          supplier_id: processorProfile.id,
          priority: 'high',
          status: 'pending',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
        },
        {
          title: 'Organic Certification',
          document_type: 'Organic Certificate',
          category: 'Quality',
          description: 'Organic certification for farm products',
          requester_id: processorProfile.id,
          supplier_id: farmProfile.id,
          priority: 'medium',
          status: 'pending',
          due_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 45 days from now
        },
        {
          title: 'Insurance Certificate',
          document_type: 'Insurance Certificate',
          category: 'Legal',
          description: 'General liability insurance certificate',
          requester_id: sonicProfile.id,
          supplier_id: farmProfile.id,
          priority: 'low',
          status: 'approved',
          due_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 60 days from now
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
