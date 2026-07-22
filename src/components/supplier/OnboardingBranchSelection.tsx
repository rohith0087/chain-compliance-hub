import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, MapPin, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface OnboardingBranchSelectionProps {
  request: any;
  onComplete: () => void;
  isCompleted: boolean;
}

interface Branch {
  id: string;
  branch_name: string;
  location?: string;
  address?: string;
}

export const OnboardingBranchSelection: React.FC<OnboardingBranchSelectionProps> = ({
  request,
  onComplete,
  isCompleted
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [existingSelections, setExistingSelections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchBranchesAndSelections();
  }, [request.buyer_id]);

  // Removed auto-skip behavior to avoid skipping step 1 unintentionally
  // If no branches are found, the user can choose to continue manually.

  const fetchBranchesAndSelections = async () => {
    try {
      setLoading(true);

      // Fetch available branches for this buyer
      const { data: branchData, error: branchError } = await supabase
        .from('company_branches')
        .select('id, branch_name, location, address')
        .eq('company_id', request.buyer_id)
        .eq('company_type', 'buyer')
        .eq('status', 'active');

      if (branchError) {
        console.error('Error fetching branches:', branchError);
        return;
      }

      setBranches(branchData || []);

      // Fetch existing temporary selections
      const { data: selectionData, error: selectionError } = await supabase
        .from('temporary_branch_selections')
        .select('branch_id')
        .eq('onboarding_request_id', request.id);

      if (selectionError) {
        console.error('Error fetching selections:', selectionError);
        return;
      }

      const existing = (selectionData || []).map(s => s.branch_id);
      setExistingSelections(existing);
      setSelectedBranches(existing);
    } catch (error) {
      console.error('Error in fetchBranchesAndSelections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSave = async () => {
    if (selectedBranches.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one branch",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Save to temporary branch selections instead of permanent ones
      // First, delete existing temporary selections for this request
      const { error: deleteError } = await supabase
        .from('temporary_branch_selections')
        .delete()
        .eq('onboarding_request_id', request.id);

      if (deleteError) {
        console.error('Error deleting existing temporary selections:', deleteError);
        throw deleteError;
      }

      // Insert new temporary selections
      const selectionsToInsert = selectedBranches.map(branchId => ({
        onboarding_request_id: request.id,
        branch_id: branchId,
        selected_by: user?.id
      }));

      const { error: insertError } = await supabase
        .from('temporary_branch_selections')
        .insert(selectionsToInsert);

      if (insertError) {
        console.error('Error inserting temporary branch selections:', insertError);
        throw insertError;
      }

      setExistingSelections(selectedBranches);
      toast({
        title: "Success",
        description: `Successfully selected ${selectedBranches.length} branch${selectedBranches.length > 1 ? 'es' : ''} - will be applied after approval`,
      });
      onComplete();
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({
        title: "Error",
        description: "Failed to save branch selections",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="text-muted-foreground">Loading branches...</div>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="text-muted-foreground">No branches found for this buyer.</div>
        {!isCompleted && (
          <Button onClick={onComplete} variant="outline">Continue without selecting branches</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground flex items-center justify-between">
        <span>Select the branches you want to supply to. You can modify this selection later if needed.</span>
        {!isCompleted && branches.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedBranches(branches.map(b => b.id))}>Select all</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedBranches([])}>Clear</Button>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {branches.map((branch) => (
          <Card key={branch.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id={branch.id}
                  checked={selectedBranches.includes(branch.id)}
                  onCheckedChange={() => handleBranchToggle(branch.id)}
                  disabled={isCompleted}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <label 
                      htmlFor={branch.id}
                      className="font-medium cursor-pointer"
                    >
                      {branch.branch_name}
                    </label>
                  </div>
                  {(branch.location || branch.address) && (
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {branch.location || branch.address}
                      </span>
                    </div>
                  )}
                </div>
                {selectedBranches.includes(branch.id) && (
                  <CheckCircle className="w-5 h-5 text-success" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-sm text-muted-foreground">
        Selected: {selectedBranches.length} of {branches.length} branches
      </div>

      {!isCompleted && (
        <div className="flex items-center gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || selectedBranches.length === 0}
          >
            {saving ? 'Saving...' : 'Save Branch Selection'}
          </Button>
          {selectedBranches.length === 0 && (
            <span className="text-sm text-danger">
              Please select at least one branch
            </span>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center gap-2 text-success pt-4">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Branch selection completed</span>
        </div>
      )}
    </div>
  );
};