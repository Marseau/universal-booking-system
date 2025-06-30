// Advanced Scheduling Rules System Types
// Comprehensive rules engine for multi-tenant scheduling platform

export interface TimeSlot {
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number; // Every N days/weeks/months/years
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  daysOfMonth?: number[]; // 1-31
  weeksOfMonth?: number[]; // 1-5
  customPattern?: string; // Cron-like pattern
}

// =============================================================================
// CANCELLATION POLICIES
// =============================================================================

export interface CancellationRule {
  id: string;
  name: string;
  description: string;
  
  // Time-based rules
  freeWindow: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  
  // Penalty structure
  penalties: CancellationPenalty[];
  
  // Special conditions
  noShowPenalty?: CancellationPenalty;
  emergencyExceptions?: boolean;
  clientTierExceptions?: string[]; // VIP, Premium, etc.
  
  // Refund rules
  refundPolicy: {
    withinFreeWindow: number; // percentage (0-100)
    afterFreeWindow: number;
    noShow: number;
    emergencyRefund: number;
  };
}

export interface CancellationPenalty {
  timeFrame: {
    start: number; // hours before appointment
    end: number;   // hours before appointment
  };
  penalty: {
    type: 'percentage' | 'fixed' | 'noRefund';
    amount?: number;
  };
  description: string;
}

// =============================================================================
// ADVANCE BOOKING RULES
// =============================================================================

export interface AdvanceBookingRule {
  id: string;
  name: string;
  
  // Minimum advance booking
  minimumAdvance: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
    exceptions?: AdvanceBookingException[];
  };
  
  // Maximum advance booking
  maximumAdvance: {
    amount: number;
    unit: 'days' | 'weeks' | 'months';
    exceptions?: AdvanceBookingException[];
  };
  
  // Same-day booking rules
  sameDayBooking: {
    allowed: boolean;
    cutoffTime?: string; // HH:MM
    emergencySlots?: boolean;
  };
  
  // Service-specific rules
  serviceOverrides?: {
    serviceId: string;
    minimumAdvance?: { amount: number; unit: 'minutes' | 'hours' | 'days' };
    maximumAdvance?: { amount: number; unit: 'days' | 'weeks' | 'months' };
  }[];
}

export interface AdvanceBookingException {
  condition: 'vip_client' | 'emergency' | 'staff_booking' | 'custom';
  customCondition?: string;
  overrideMinimum?: { amount: number; unit: 'minutes' | 'hours' | 'days' };
  overrideMaximum?: { amount: number; unit: 'days' | 'weeks' | 'months' };
}

// =============================================================================
// AVAILABILITY MANAGEMENT
// =============================================================================

export interface AvailabilityRule {
  id: string;
  name: string;
  professionalId: string;
  
  // Regular working hours
  regularHours: WeeklySchedule;
  
  // Seasonal patterns
  seasonalPatterns?: SeasonalPattern[];
  
  // Irregular schedules
  irregularSchedules?: IrregularSchedule[];
  
  // Days off and holidays
  daysOff: DayOffRule[];
  
  // Override rules
  overrides: AvailabilityOverride[];
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  workingHours: TimeSlot[];
  breaks: TimeSlot[];
  isWorkingDay: boolean;
  notes?: string;
}

export interface SeasonalPattern {
  name: string;
  period: DateRange;
  schedule: WeeklySchedule;
  recurrence?: RecurrencePattern;
}

export interface IrregularSchedule {
  name: string;
  pattern: 'alternating_weeks' | 'rotating_shifts' | 'custom';
  schedules: {
    week1?: WeeklySchedule;
    week2?: WeeklySchedule;
    week3?: WeeklySchedule;
    week4?: WeeklySchedule;
  };
  customRotation?: WeeklySchedule[];
}

export interface DayOffRule {
  id: string;
  type: 'single_day' | 'recurring' | 'date_range';
  date?: Date;
  dateRange?: DateRange;
  recurrence?: RecurrencePattern;
  reason: string;
  isPaid?: boolean;
}

export interface AvailabilityOverride {
  id: string;
  date: Date;
  schedule?: DaySchedule;
  isUnavailable?: boolean;
  reason: string;
  priority: number; // Higher number = higher priority
}

// Additional interfaces for all other rule types...
// (This is a condensed version for demonstration)

export interface RuleValidationResult {
  isValid: boolean;
  violations: RuleViolation[];
  warnings: RuleWarning[];
  suggestions: RuleSuggestion[];
  alternativeSlots?: TimeSlot[] | undefined;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  affectedFields: string[];
  suggestedFix?: string;
}

export interface RuleWarning {
  ruleId: string;
  ruleName: string;
  message: string;
  canProceed: boolean;
  requiresConfirmation: boolean;
}

export interface RuleSuggestion {
  type: 'alternative_time' | 'alternative_service' | 'alternative_professional' | 'policy_explanation';
  title: string;
  description: string;
  actionable: boolean;
  data?: any;
}

export interface BookingRequest {
  professionalId: string;
  serviceId: string;
  clientId: string;
  preferredDateTime: Date;
  duration?: number;
  notes?: string;
  clientType?: string;
  isEmergency?: boolean;
}

export interface AvailabilityCriteria {
  professionalId?: string;
  serviceId?: string;
  dateRange: DateRange;
  duration: number;
  clientType?: string;
  preferences?: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    daysOfWeek?: number[];
    urgency?: 'low' | 'medium' | 'high' | 'emergency';
  };
}
