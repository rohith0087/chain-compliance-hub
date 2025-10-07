import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ContactRole = 'recall' | 'sales' | 'quality' | 'compliance' | 'general';

export interface SupplierContact {
  id: string;
  supplier_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  roles: ContactRole[];
  is_primary: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export const CONTACT_ROLES = [
  { value: 'recall', label: 'Recall', color: 'destructive' },
  { value: 'sales', label: 'Sales', color: 'default' },
  { value: 'quality', label: 'Quality', color: 'secondary' },
  { value: 'compliance', label: 'Compliance', color: 'outline' },
  { value: 'general', label: 'General', color: 'outline' },
];

export const useSupplierContacts = (supplierId?: string) => {
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (supplierId) {
      fetchContacts();
    }
  }, [supplierId]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('supplier_contacts')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('is_primary', { ascending: false })
        .order('contact_name', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load contacts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (contactData: Omit<SupplierContact, 'id' | 'supplier_id' | 'created_at' | 'updated_at'>) => {
    try {
      // If setting as primary, unset other primary contacts first
      if (contactData.is_primary) {
        await supabase
          .from('supplier_contacts')
          .update({ is_primary: false })
          .eq('supplier_id', supplierId);
      }

      const { data, error } = await supabase
        .from('supplier_contacts')
        .insert([{ 
          contact_name: contactData.contact_name,
          contact_email: contactData.contact_email,
          contact_phone: contactData.contact_phone,
          roles: contactData.roles,
          is_primary: contactData.is_primary,
          supplier_id: supplierId!,
          status: contactData.status || 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      setContacts([...contacts, data]);
      toast({
        title: 'Success',
        description: 'Contact created successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast({
        title: 'Error',
        description: 'Failed to create contact',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateContact = async (contactId: string, contactData: Partial<SupplierContact>) => {
    try {
      // If setting as primary, unset other primary contacts first
      if (contactData.is_primary) {
        await supabase
          .from('supplier_contacts')
          .update({ is_primary: false })
          .eq('supplier_id', supplierId)
          .neq('id', contactId);
      }

      const { data, error } = await supabase
        .from('supplier_contacts')
        .update(contactData)
        .eq('id', contactId)
        .select()
        .single();

      if (error) throw error;

      setContacts(contacts.map(contact => contact.id === contactId ? data : contact));
      toast({
        title: 'Success',
        description: 'Contact updated successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast({
        title: 'Error',
        description: 'Failed to update contact',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteContact = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('supplier_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      setContacts(contacts.filter(contact => contact.id !== contactId));
      toast({
        title: 'Success',
        description: 'Contact deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete contact',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const setPrimaryContact = async (contactId: string) => {
    await updateContact(contactId, { is_primary: true });
  };

  const filterByRole = (role: ContactRole) => {
    return contacts.filter(contact => contact.roles.includes(role));
  };

  const getContactCountByRole = () => {
    const counts: { [key: string]: number } = {};
    CONTACT_ROLES.forEach(role => {
      counts[role.value] = contacts.filter(c => c.roles.includes(role.value as ContactRole)).length;
    });
    return counts;
  };

  return {
    contacts,
    loading,
    fetchContacts,
    createContact,
    updateContact,
    deleteContact,
    setPrimaryContact,
    filterByRole,
    getContactCountByRole,
  };
};
