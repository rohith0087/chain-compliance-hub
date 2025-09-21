import { SubscriptionData } from '@/hooks/useSubscription';

export interface FeatureRequirement {
  creditsRequired?: number;
  planRequired?: string;
  featureName: string;
}

export interface FeatureCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  creditsNeeded?: number;
}

/**
 * Check if a user has access to a specific feature based on their subscription
 */
export function checkFeatureAccess(
  subscriptionData: SubscriptionData | null,
  requirement: FeatureRequirement
): FeatureCheckResult {
  if (!subscriptionData) {
    return {
      allowed: false,
      reason: 'Subscription data not available',
      upgradeRequired: true
    };
  }

  // Check if plan requirement is met
  if (requirement.planRequired) {
    if (!subscriptionData.subscribed || !subscriptionData.plan_type) {
      return {
        allowed: false,
        reason: `${requirement.featureName} requires a ${requirement.planRequired} subscription`,
        upgradeRequired: true
      };
    }

    const planHierarchy = ['basic', 'professional', 'enterprise'];
    const userPlanIndex = planHierarchy.indexOf(subscriptionData.plan_type.toLowerCase());
    const requiredPlanIndex = planHierarchy.indexOf(requirement.planRequired.toLowerCase());

    if (userPlanIndex < requiredPlanIndex) {
      return {
        allowed: false,
        reason: `${requirement.featureName} requires ${requirement.planRequired} plan or higher`,
        upgradeRequired: true
      };
    }
  }

  // Check if credit requirement is met
  if (requirement.creditsRequired) {
    // Enterprise users have unlimited credits
    if (subscriptionData.plan_type?.includes('enterprise')) {
      return { allowed: true };
    }

    if (subscriptionData.credits < requirement.creditsRequired) {
      return {
        allowed: false,
        reason: `Insufficient credits. You need ${requirement.creditsRequired} credits for ${requirement.featureName}`,
        creditsNeeded: requirement.creditsRequired - subscriptionData.credits
      };
    }
  }

  return { allowed: true };
}

/**
 * Get credit cost for different report types
 */
export function getReportCreditCost(reportType: 'standard' | 'detailed' | 'comparison' | 'ai_enhanced'): number {
  const costs = {
    standard: 5,
    detailed: 10,
    comparison: 15,
    ai_enhanced: 20
  };
  return costs[reportType] || 5;
}

/**
 * Check if user can generate a specific type of report
 */
export function canGenerateReport(
  subscriptionData: SubscriptionData | null,
  reportType: 'standard' | 'detailed' | 'comparison' | 'ai_enhanced'
): FeatureCheckResult {
  const creditCost = getReportCreditCost(reportType);
  
  const requirement: FeatureRequirement = {
    creditsRequired: creditCost,
    featureName: `${reportType} report`
  };

  // Add plan requirements for advanced reports
  if (reportType === 'comparison') {
    requirement.planRequired = 'professional';
  } else if (reportType === 'ai_enhanced') {
    requirement.planRequired = 'professional';
  }

  return checkFeatureAccess(subscriptionData, requirement);
}

/**
 * Check if user can access bulk operations
 */
export function canUseBulkOperations(subscriptionData: SubscriptionData | null): FeatureCheckResult {
  return checkFeatureAccess(subscriptionData, {
    planRequired: 'professional',
    featureName: 'bulk operations'
  });
}

/**
 * Check if user can access advanced analytics
 */
export function canUseAdvancedAnalytics(subscriptionData: SubscriptionData | null): FeatureCheckResult {
  return checkFeatureAccess(subscriptionData, {
    planRequired: 'professional',
    featureName: 'advanced analytics'
  });
}

/**
 * Check if user can access AI-powered insights
 */
export function canUseAIInsights(subscriptionData: SubscriptionData | null): FeatureCheckResult {
  return checkFeatureAccess(subscriptionData, {
    planRequired: 'professional',
    featureName: 'AI-powered insights'
  });
}

/**
 * Check if user can access premium export options
 */
export function canUsePremiumExports(subscriptionData: SubscriptionData | null): FeatureCheckResult {
  return checkFeatureAccess(subscriptionData, {
    planRequired: 'basic',
    featureName: 'premium export options'
  });
}

/**
 * Get user's remaining credits
 */
export function getRemainingCredits(subscriptionData: SubscriptionData | null): number {
  if (!subscriptionData) return 0;
  
  // Enterprise users have unlimited credits
  if (subscriptionData.plan_type?.includes('enterprise')) {
    return 999999; // Represent unlimited as large number
  }
  
  return subscriptionData.credits || 0;
}

/**
 * Check if user is on a free plan
 */
export function isFreePlan(subscriptionData: SubscriptionData | null): boolean {
  return !subscriptionData?.subscribed || !subscriptionData.plan_type;
}

/**
 * Get plan display name
 */
export function getPlanDisplayName(planType: string | null): string {
  if (!planType) return 'Free';
  
  const planNames: Record<string, string> = {
    basic: 'Basic',
    professional: 'Professional', 
    enterprise: 'Enterprise'
  };
  
  return planNames[planType.toLowerCase()] || planType;
}

/**
 * Get next plan recommendation
 */
export function getRecommendedUpgrade(subscriptionData: SubscriptionData | null): string | null {
  if (!subscriptionData?.plan_type || subscriptionData.plan_type === 'basic') {
    return 'professional';
  }
  if (subscriptionData.plan_type === 'professional') {
    return 'enterprise';
  }
  return null;
}