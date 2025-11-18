import { supabase } from '@/integrations/supabase/client';

export interface AddHishōSushiResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Cleans up ALL existing supplier sample data from the database
 */
export async function cleanupSampleData(): Promise<void> {
  // Delete ALL existing suppliers (this is demo/sample data only)
  const { error: supplierError } = await supabase
    .from('suppliers')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Keep only system records if any

  if (supplierError) {
    console.error('Error cleaning up suppliers:', supplierError);
  }

  // Delete ALL supplier-type company branches
  const { error: branchError } = await supabase
    .from('company_branches')
    .delete()
    .eq('company_type', 'supplier');

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
        phone: '(704) 555-0100',
        address: '11949 Steele Creek Road, Charlotte, NC 28273',
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
        address: '11949 Steele Creek Road, Charlotte, NC 28273',
        location: 'headquarters',
        email: 'hq@hishosushi.com',
        phone: '(704) 555-0100'
      },
      {
        branch_name: 'HishōSushi - Troy University Mein Bowl',
        address: '117 Adams Center, Troy, AL 36082-0001',
        location: 'store',
        email: 'troy-mein@hishosushi.com',
        phone: '334-670-3454'
      },
      {
        branch_name: 'HishōSushi - Troy University Sushi',
        address: '117 Adams Center, Troy, AL 36082-0001',
        location: 'store',
        email: 'troy-sushi@hishosushi.com',
        phone: '334-670-3454'
      },
      {
        branch_name: 'HishōSushi - Sprouts Peachtree City',
        address: '2015 Highway 54, Peachtree City, GA 30269-1315',
        location: 'store',
        email: 'sprouts@hishosushi.com',
        phone: '678-586-2577'
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

/**
 * Adds seafood supplier companies with their facilities
 */
export async function addSeafoodSuppliers(): Promise<AddHishōSushiResult[]> {
  const results: AddHishōSushiResult[] = [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [{
        success: false,
        message: 'User not authenticated'
      }];
    }

    // Blue Ocean Seafood Co.
    const { data: blueOcean, error: blueOceanError } = await supabase
      .from('suppliers')
      .insert({
        company_name: 'Blue Ocean Seafood Co.',
        contact_email: 'info@blueoceanseafood.com',
        industry: 'Seafood',
        phone: '(206) 555-0200',
        address: '1200 Harbor Drive, Seattle, WA 98101',
        profile_id: user.id
      })
      .select()
      .single();

    if (blueOceanError || !blueOcean) {
      results.push({
        success: false,
        message: `Failed to create Blue Ocean Seafood: ${blueOceanError?.message}`
      });
    } else {
      results.push({
        success: true,
        message: 'Blue Ocean Seafood Co. created',
        data: blueOcean
      });

      const blueOceanFacilities = [
        {
          branch_name: 'Blue Ocean Seafood - Corporate HQ',
          address: '1200 Harbor Drive, Seattle, WA 98101',
          location: 'headquarters',
          email: 'hq@blueoceanseafood.com',
          phone: '(206) 555-0200'
        },
        {
          branch_name: 'Blue Ocean Seafood - Portland Distribution',
          address: '4500 Industrial Parkway, Portland, OR 97203',
          location: 'distribution',
          email: 'portland@blueoceanseafood.com',
          phone: '(503) 555-0250'
        },
        {
          branch_name: 'Blue Ocean Seafood - Pike Place Market',
          address: '85 Pike Street, Seattle, WA 98101',
          location: 'store',
          email: 'pikeplace@blueoceanseafood.com',
          phone: '(206) 555-0201'
        },
        {
          branch_name: 'Blue Ocean Seafood - Fisherman\'s Wharf',
          address: 'Pier 39, San Francisco, CA 94133',
          location: 'store',
          email: 'wharf@blueoceanseafood.com',
          phone: '(415) 555-0300'
        }
      ];

      for (const facility of blueOceanFacilities) {
        const { data: branch, error: branchError } = await supabase
          .from('company_branches')
          .insert({
            company_id: blueOcean.id,
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
    }

    // Atlantic Fresh Fish Market
    const { data: atlantic, error: atlanticError } = await supabase
      .from('suppliers')
      .insert({
        company_name: 'Atlantic Fresh Fish Market',
        contact_email: 'info@atlanticfresh.com',
        industry: 'Seafood',
        phone: '(617) 555-0400',
        address: '789 Ocean Avenue, Boston, MA 02110',
        profile_id: user.id
      })
      .select()
      .single();

    if (atlanticError || !atlantic) {
      results.push({
        success: false,
        message: `Failed to create Atlantic Fresh: ${atlanticError?.message}`
      });
    } else {
      results.push({
        success: true,
        message: 'Atlantic Fresh Fish Market created',
        data: atlantic
      });

      const atlanticFacilities = [
        {
          branch_name: 'Atlantic Fresh - Corporate HQ',
          address: '789 Ocean Avenue, Boston, MA 02110',
          location: 'headquarters',
          email: 'hq@atlanticfresh.com',
          phone: '(617) 555-0400'
        },
        {
          branch_name: 'Atlantic Fresh - Newark Distribution',
          address: '2100 Commerce Street, Newark, NJ 07102',
          location: 'distribution',
          email: 'newark@atlanticfresh.com',
          phone: '(973) 555-0450'
        },
        {
          branch_name: 'Atlantic Fresh - Quincy Market',
          address: '206 South Market Street, Boston, MA 02109',
          location: 'store',
          email: 'quincy@atlanticfresh.com',
          phone: '(617) 555-0401'
        },
        {
          branch_name: 'Atlantic Fresh - Chelsea Market',
          address: '75 9th Avenue, New York, NY 10011',
          location: 'store',
          email: 'chelsea@atlanticfresh.com',
          phone: '(212) 555-0500'
        }
      ];

      for (const facility of atlanticFacilities) {
        const { data: branch, error: branchError } = await supabase
          .from('company_branches')
          .insert({
            company_id: atlantic.id,
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
    }

    return results;
  } catch (error: any) {
    console.error('Error adding seafood suppliers:', error);
    return [{
      success: false,
      message: `Unexpected error: ${error.message}`
    }];
  }
}
