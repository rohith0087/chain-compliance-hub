import { supabase } from '@/integrations/supabase/client';

export interface AddHishōSushiResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Cleans up incomplete sample supplier data from the database
 */
export async function cleanupSampleData(): Promise<void> {
  // Delete suppliers with no valid addresses or incomplete data
  const { error: supplierError } = await supabase
    .from('suppliers')
    .delete()
    .or('address.is.null,address.eq.,company_name.ilike.%sample%,company_name.ilike.%test%,company_name.ilike.%wain%');

  if (supplierError) {
    console.error('Error cleaning up suppliers:', supplierError);
  }

  // Delete company_branches with no valid addresses
  const { error: branchError } = await supabase
    .from('company_branches')
    .delete()
    .eq('company_type', 'supplier')
    .or('address.is.null,address.eq.');

  if (branchError) {
    console.error('Error cleaning up branches:', branchError);
  }
}

/**
 * Adds HishōSushi supplier with corporate HQ and all facilities
 */
export async function addHishōSushiData(): Promise<AddHishōSushiResult[]> {
  const results: AddHishōSushiResult[] = [];

  try {
    // Step 1: Get current user's profile
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [{
        success: false,
        message: 'User not authenticated'
      }];
    }

    // Step 2: Create HishōSushi supplier
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        company_name: 'HishōSushi',
        contact_email: 'info@hishosushi.com',
        industry: 'Food Service',
        phone: '(212) 555-0100',
        address: '123 5th Avenue, New York, NY 10003',
        profile_id: user.id
      })
      .select()
      .single();

    if (supplierError || !supplier) {
      results.push({
        success: false,
        message: `Failed to create HishōSushi supplier: ${supplierError?.message}`
      });
      return results;
    }

    results.push({
      success: true,
      message: 'HishōSushi supplier created',
      data: supplier
    });

    // Step 3: Create facilities for HishōSushi
    const facilities = [
      {
        branch_name: 'HishōSushi - Corporate HQ',
        address: '123 5th Avenue, New York, NY 10003',
        location: 'headquarters',
        email: 'hq@hishosushi.com',
        phone: '(212) 555-0100'
      },
      {
        branch_name: 'HishōSushi - Distribution Center',
        address: '500 Commerce Blvd, Secaucus, NJ 07094',
        location: 'distribution',
        email: 'distribution@hishosushi.com',
        phone: '(201) 555-0200'
      },
      {
        branch_name: 'HishōSushi - Times Square',
        address: '1540 Broadway, New York, NY 10036',
        location: 'store',
        email: 'timessquare@hishosushi.com',
        phone: '(212) 555-0301'
      },
      {
        branch_name: 'HishōSushi - Brooklyn Heights',
        address: '55 Water Street, Brooklyn, NY 11201',
        location: 'store',
        email: 'brooklyn@hishosushi.com',
        phone: '(718) 555-0302'
      },
      {
        branch_name: 'HishōSushi - Philadelphia',
        address: '1500 Market Street, Philadelphia, PA 19102',
        location: 'store',
        email: 'philly@hishosushi.com',
        phone: '(215) 555-0303'
      },
      {
        branch_name: 'HishōSushi - Boston Seaport',
        address: '100 Seaport Blvd, Boston, MA 02210',
        location: 'store',
        email: 'boston@hishosushi.com',
        phone: '(617) 555-0304'
      },
      {
        branch_name: 'HishōSushi - Washington DC',
        address: '701 Pennsylvania Ave NW, Washington, DC 20004',
        location: 'store',
        email: 'dc@hishosushi.com',
        phone: '(202) 555-0305'
      },
      {
        branch_name: 'HishōSushi - Chicago Loop',
        address: '233 S Wacker Dr, Chicago, IL 60606',
        location: 'store',
        email: 'chicago@hishosushi.com',
        phone: '(312) 555-0306'
      }
    ];

    for (const facility of facilities) {
      const { data: branch, error: branchError } = await supabase
        .from('company_branches')
        .insert({
          company_id: supplier.id,
          company_type: 'supplier',
          ...facility,
          status: 'active'
        })
        .select()
        .single();

      if (branchError) {
        results.push({
          success: false,
          message: `Failed to create ${facility.branch_name}: ${branchError.message}`
        });
      } else {
        results.push({
          success: true,
          message: `Created ${facility.branch_name}`,
          data: branch
        });
      }
    }

    return results;
  } catch (error: any) {
    console.error('Error adding HishōSushi data:', error);
    return [{
      success: false,
      message: `Unexpected error: ${error.message}`
    }];
  }
}
