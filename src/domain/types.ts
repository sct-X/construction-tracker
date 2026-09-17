/**
 * Domain types for the Construction Tracker.
 *
 * Conventions (locked for every later stage):
 *  - Every date is an ISO calendar string `YYYY-MM-DD`. Never a Date object in a record.
 *  - Timestamps (activity, notes, notifications) are ISO `YYYY-MM-DDTHH:mm` local strings.
 *  - Every id is a string. Every row carries a `sideId`.
 *  - Money fields are `number | undefined` and are listed in `money.ts`
 *    (MONEY_FIELDS) so the data layer can delete them for the site role.
 */

export type Role = 'admin' | 'partner' | 'builder' | 'site';

export type JobKind = 'build' | 'design';
export type ApprovalPath = 'DA' | 'CDC';

export type StepStatus = 'not_started' | 'in_progress' | 'done';
export type StageStatus = 'not_started' | 'in_progress' | 'done';

export type ItemType =
  | 'trade' // trade to book
  | 'material' // material to order
  | 'decision'
  | 'consultant_report'
  | 'council_request'
  | 'inspection'
  | 'defect'
  | 'condition_of_consent'
  | 'manual_reminder';

/** Display order is the status order: each "move forward" goes one step right. */
export type ItemStatus = 'to_do' | 'booked' | 'confirmed' | 'done';

export type ShipmentStatus = 'design' | 'in_production' | 'shipped' | 'delivered';

export type RequirementKind = 'trade' | 'material';

export interface Side {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  shortName: string;
  phone?: string;
  email?: string;
  /** Screen 19 phone-setup state, per person. */
  notificationsEnabled: boolean;
  installedToHomeScreen: boolean;
  testBuzzReceived: boolean;
}

export interface Membership {
  id: string;
  personId: string;
  sideId: string;
  role: Role;
}

export interface Job {
  id: string;
  sideId: string;
  name: string;
  address?: string;
  kind: JobKind;
  path?: ApprovalPath;
  /** Money. Absent for the site role. */
  weeklyHoldingCost?: number;
  lastConfirmed?: string;
  isTemplate: boolean;
  /** Accepted additions from the UI Plan's model gaps. */
  startDate?: string;
  plannedFinish?: string;
  startsFromStageId?: string;
  templateId?: string;
  createdAt: string;
}

export interface Stage {
  id: string;
  sideId: string;
  jobId: string;
  name: string;
  order: number;
  /** Set by hand on design jobs. Derived from steps on build jobs (see forecast.stageStatus). */
  status: StageStatus;
}

export interface Step {
  id: string;
  sideId: string;
  jobId: string;
  stageId: string;
  name: string;
  order: number;
  /** Working days, inclusive of the start day. Minimum 1. */
  durationDays: number;
  /** Templates carry no dates. */
  plannedStart?: string;
  plannedEnd?: string;
  /** Recorded when someone marks it started / done. */
  actualStart?: string;
  actualEnd?: string;
  status: StepStatus;
  isHoldPoint: boolean;
  /** One placeholder step per stage on stage-level jobs. */
  isPlaceholder?: boolean;
  /** Trade responsible, for the look-ahead ("Roof plumber"). */
  tradeType?: string;
}

/** "This step waits for that step." */
export interface StepLink {
  id: string;
  sideId: string;
  jobId: string;
  stepId: string;
  waitsForStepId: string;
}

/** What a step needs: a trade to book or a material to order, with its lead time. */
export interface Requirement {
  id: string;
  sideId: string;
  jobId: string;
  stepId: string;
  kind: RequirementKind;
  name: string;
  /** Calendar weeks. */
  leadTimeWeeks: number;
  tradeType?: string;
}

export interface Item {
  id: string;
  sideId: string;
  /** Required (model gap 1). */
  jobId: string;
  type: ItemType;
  title: string;
  /** Free text or the trade's name. */
  waitingOn?: string;
  tradeId?: string;
  ownerId?: string;
  /**
   * Typed needed-by, used only when the item has no step. When `stepId` is set
   * the calculator computes needed-by from the step (rule 1) and this is ignored.
   */
  neededBy?: string;
  /** Calendar weeks. Falls back to the requirement's lead time, then 0. */
  leadTimeWeeks?: number;
  /**
   * When the item is linked to a shipment this is ignored and the shipment's ETA
   * is used ("Comes from shipment: Park Rd windows").
   */
  expectedDate?: string;
  status: ItemStatus;
  confirmedDate?: string;
  stepId?: string;
  requirementId?: string;
  shipmentId?: string;
  photoId?: string;
  notes?: string;
  createdAt: string;
  /** Set when status becomes done. */
  doneAt?: string;
}

export interface Trade {
  id: string;
  sideId: string;
  name: string;
  type: string;
  phone?: string;
  email?: string;
}

export interface Shipment {
  id: string;
  sideId: string;
  jobId: string;
  name: string;
  supplier?: string;
  status: ShipmentStatus;
  eta: string;
  notes?: string;
}

export interface PhotoCategory {
  id: string;
  sideId: string;
  jobId: string;
  /** Null for the job-wide "General" category (model gap 5). */
  stageId: string | null;
  name: string;
  requiredForHoldPoint: boolean;
  order: number;
}

export interface Photo {
  id: string;
  sideId: string;
  jobId: string;
  stageId: string | null;
  categoryId: string;
  uploadedById: string;
  uploadedAt: string;
  takenOn: string;
  /** Data URL (tiny inline SVG in the seed). */
  dataUrl: string;
  caption?: string;
}

export interface DailyNote {
  id: string;
  sideId: string;
  jobId: string;
  date: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface ForecastSnapshot {
  id: string;
  sideId: string;
  jobId: string;
  /** The Monday it was saved for. */
  date: string;
  forecastFinish: string;
  /** Per-step forecast ends at the time, so "why it moved" can compare against last Monday. */
  stepEnds?: Record<string, string>;
  stepStarts?: Record<string, string>;
}

export type ActivityKind =
  | 'eta_changed'
  | 'shipment_status'
  | 'item_status'
  | 'item_added'
  | 'item_edited'
  | 'item_deleted'
  | 'item_expected_changed'
  | 'step_status'
  | 'step_edited'
  | 'program_edited'
  | 'photo_added'
  | 'photo_moved'
  | 'photo_deleted'
  | 'note_added'
  | 'job_confirmed'
  | 'job_added'
  | 'job_edited'
  | 'snapshot_saved'
  | 'reminders_fired'
  | 'trade_edited'
  | 'person_edited';

export interface ActivityEntry {
  id: string;
  sideId: string;
  kind: ActivityKind;
  at: string; // YYYY-MM-DDTHH:mm
  personId: string;
  jobId?: string;
  itemId?: string;
  stepId?: string;
  shipmentId?: string;
  photoId?: string;
  /** Plain words. Never contains money. */
  text: string;
  from?: string;
  to?: string;
}

export type NotificationKind =
  | 'act_by_today'
  | 'overdue'
  | 'eta_moved'
  | 'hold_point_week_away'
  | 'job_unconfirmed'
  | 'upload_failed'
  | 'test_buzz';

export interface Notification {
  id: string;
  sideId: string;
  personId: string;
  kind: NotificationKind;
  at: string;
  /** Plain words. Never contains money. */
  text: string;
  read: boolean;
  jobId?: string;
  itemId?: string;
  stepId?: string;
  shipmentId?: string;
}

export interface PushSubscriptionRecord {
  id: string;
  sideId: string;
  personId: string;
  device: string;
  subscription: string;
  enabled: boolean;
  lastTestSentAt?: string;
}

/** Everything the mock store holds. The seed produces one of these. */
export interface SeedData {
  sides: Side[];
  people: Person[];
  memberships: Membership[];
  jobs: Job[];
  stages: Stage[];
  steps: Step[];
  stepLinks: StepLink[];
  requirements: Requirement[];
  items: Item[];
  trades: Trade[];
  shipments: Shipment[];
  photoCategories: PhotoCategory[];
  photos: Photo[];
  dailyNotes: DailyNote[];
  snapshots: ForecastSnapshot[];
  activity: ActivityEntry[];
  notifications: Notification[];
  pushSubscriptions: PushSubscriptionRecord[];
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  trade: 'Trade to book',
  material: 'Material to order',
  decision: 'Decision',
  consultant_report: 'Consultant report',
  council_request: 'Council request',
  inspection: 'Inspection',
  defect: 'Defect',
  condition_of_consent: 'Condition of consent',
  manual_reminder: 'Reminder',
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  to_do: 'To do',
  booked: 'Ordered or booked',
  confirmed: 'Confirmed',
  done: 'Done',
};

export const ITEM_STATUS_ORDER: ItemStatus[] = ['to_do', 'booked', 'confirmed', 'done'];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  design: 'Design',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = ['design', 'in_production', 'shipped', 'delivered'];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  partner: 'Partner',
  builder: 'Builder',
  site: 'Site',
};
