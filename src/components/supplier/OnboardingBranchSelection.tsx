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

      // Fetch existing selections
      const { data: selectionData, error: selectionError } = await supabase
        .from('onboarding_branch_selections')
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
      // Remove existing selections
      if (existingSelections.length > 0) {
        await supabase
          .from('onboarding_branch_selections')
          .delete()
          .eq('onboarding_request_id', request.id);
      }

      // Add new selections
      const selections = selectedBranches.map(branchId => ({
        onboarding_request_id: request.id,
        branch_id: branchId,
        selected_by: user?.id
      }));

      const { error } = await supabase
        .from('onboarding_branch_selections')
        .insert(selections);

      if (error) {
        console.error('Error saving branch selections:', error);
        throw new Error('Failed to save branch selections');
      }

      setExistingSelections(selectedBranches);
      toast({
        title: "Success",
        description: "Branch selections saved successfully"
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
      <div className="text-center py-4">
        <div className="text-muted-foreground">No branches available for selection</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Select the branches you want to supply to. You can modify this selection later if needed.
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
                  <CheckCircle className="w-5 h-5 text-green-600" />
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
            <span className="text-sm text-red-600">
              Please select at least one branch
            </span>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center gap-2 text-green-600 pt-4">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Branch selection completed</span>
        </div>
      )}
    </div>
  );
};