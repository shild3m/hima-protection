export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  source: "walk_in" | "referral" | "online" | "social" | "phone" | null;
  referred_by_dealer_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  plate_number: string | null;
  vin: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  vehicle_id: string;
  service_id: string;
  status:
    | "new"
    | "contacted"
    | "confirmed"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show";
  preferred_date: string | null;
  preferred_time: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  source: "walk_in" | "online" | "referral" | "phone" | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  idempotency_key: string | null;
  payment_method?: string;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  base_price: number | null;
  duration_minutes: number | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface BookingStatusHistory {
  id: string;
  booking_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerWithStats extends Customer {
  vehicle_count?: number;
  booking_count?: number;
  last_booking_date?: string | null;
}

export interface VehicleWithCustomer extends Vehicle {
  customer?: Customer;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface CustomerFilters {
  search?: string;
  source?: string;
  is_active?: boolean;
  created_from?: string;
  created_to?: string;
}

export interface VehicleFilters {
  search?: string;
  make?: string;
  model?: string;
  year?: number;
  is_active?: boolean;
  customer_id?: string;
}

export interface Dealer {
  id: string;
  user_id: string | null;
  business_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: "active" | "inactive" | "suspended";
  commission_type: "fixed" | "percentage";
  commission_value: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DealerWithStats extends Dealer {
  referral_count?: number;
}

export interface DealerFilters {
  search?: string;
  status?: string;
  is_active?: boolean;
}

// ============================================================
// REFERRALS (Phase 12)
// ============================================================

export type ReferralStatus =
  | "created"
  | "contacted"
  | "redeemed"
  | "expired"
  | "cancelled"
  | "completed";

export interface Referral {
  id: string;
  referral_code: string;
  dealer_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  customer_name: string;
  customer_phone: string;
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  car_color: string | null;
  offer_id: string | null;
  status: ReferralStatus;
  redeemed_at: string | null;
  completed_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralService {
  id: string;
  referral_id: string;
  service_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface ReferralWithServices extends Referral {
  referral_services?: ReferralService[];
  dealer?: Dealer;
}

export interface ReferralFilters {
  search?: string;
  status?: ReferralStatus;
  dealer_id?: string;
  created_from?: string;
  created_to?: string;
}

// ============================================================
// OFFERS (Phase 12)
// ============================================================

export type OfferType =
  | "fixed_discount"
  | "percentage_discount"
  | "free_service"
  | "special_price";

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  offer_type: OfferType;
  value: number | null;
  service_id: string | null;
  dealer_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OfferWithService extends Offer {
  service?: Service;
  dealer?: Dealer;
}

export interface OfferFilters {
  search?: string;
  offer_type?: OfferType;
  dealer_id?: string;
  is_active?: boolean;
}

// ============================================================
// INVOICES (Phase 14)
// ============================================================

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "refunded";

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  vehicle_id: string | null;
  booking_id: string | null;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  status: InvoiceStatus;
  notes: string | null;
  issued_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
  created_at: string;
}

export interface InvoiceWithDetails extends Invoice {
  customer?: { id: string; full_name: string; phone: string; email: string | null };
  vehicle?: { id: string; make: string; model: string; year: number | null; plate_number: string | null };
  booking?: { id: string; status: string; preferred_date: string | null };
  items?: (InvoiceItem & { service?: { id: string; name: string } })[];
  payments?: Payment[];
}

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus | "all";
  customer_id?: string;
  created_from?: string;
  created_to?: string;
}

// ============================================================
// PAYMENTS (Phase 14)
// ============================================================

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "online";

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  idempotency_key: string | null;
  created_by: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentWithInvoice extends Payment {
  invoice?: {
    id: string;
    invoice_number: string;
    total: number;
    paid_amount: number;
    status: InvoiceStatus;
    customer?: { id: string; full_name: string; phone: string };
    vehicle?: { id: string; make: string; model: string; plate_number: string | null };
  };
}

export interface PaymentFilters {
  search?: string;
  invoice_id?: string;
  payment_method?: PaymentMethod;
  created_from?: string;
  created_to?: string;
}

// ============================================================
// COMMISSIONS (Phase 13)
// ============================================================

export type CommissionStatus = "pending" | "approved" | "paid" | "cancelled";

export type CommissionCalcType = "fixed" | "percentage";

export interface Commission {
  id: string;
  referral_id: string;
  dealer_id: string;
  service_id: string | null;
  calculation_type: CommissionCalcType;
  rate_value: number;
  calculated_amount: number;
  status: CommissionStatus;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionWithDetails extends Commission {
  referral?: Referral;
  dealer?: Dealer;
  service?: Service;
}

export interface CommissionFilters {
  search?: string;
  status?: CommissionStatus;
  dealer_id?: string;
  created_from?: string;
  created_to?: string;
}

export interface CommissionRule {
  id: string;
  name: string;
  calculation_type: CommissionCalcType;
  rate_value: number;
  dealer_id: string | null;
  service_id: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionRuleWithDetails extends CommissionRule {
  dealer?: Dealer;
  service?: Service;
}

export interface CommissionRuleFilters {
  search?: string;
  dealer_id?: string;
  service_id?: string;
  is_active?: boolean;
}

export interface CommissionMonthlyReport {
  dealer_id: string;
  dealer_name: string;
  total_referrals: number;
  completed_referrals: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
  total_amount: number;
}

export interface CurrentUserUser {
  id: string;
  email: string;
}

export interface CurrentUser {
  auth_user_id: string;
  email: string;
  staff_id: string;
  name: string;
  role_id: string;
  role_name: string;
  permissions: string[];
  is_active: boolean;
  user: CurrentUserUser;
}

export type MaterialUnit = 'meter' | 'liter' | 'ml' | 'piece' | 'roll' | 'box' | 'bottle';

export interface Material {
  id: string;
  name: string;
  sku: string;
  unit: MaterialUnit;
  min_stock: number;
  max_stock: number | null;
  current_stock: number;
  cost_per_unit: number;
  supplier_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialWithSupplier extends Material {
  supplier: { id: string; name: string } | null;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type InventoryTransactionType = 'purchase' | 'usage' | 'waste' | 'adjustment' | 'return';

export interface InventoryTransaction {
  id: string;
  material_id: string;
  quantity: number;
  type: InventoryTransactionType;
  reference_type: string | null;
  reference_id: string | null;
  vehicle_id: string | null;
  booking_id: string | null;
  service_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  idempotency_key: string | null;
}

export interface InventoryTransactionWithMaterial extends InventoryTransaction {
  material: { id: string; name: string; sku: string; unit: string; current_stock: number } | null;
}

export interface ServiceMaterial {
  id: string;
  service_id: string;
  material_id: string;
  expected_quantity: number;
  notes: string | null;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  status: 'draft' | 'received' | 'cancelled';
  total_amount: number;
  purchase_date: string;
  received_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  material_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
}

export type MaterialFilters = {
  search?: string;
  unit?: MaterialUnit;
  is_active?: boolean;
  low_stock?: boolean;
  supplier_id?: string;
};

export type InventoryFilters = {
  material_id?: string;
  type?: InventoryTransactionType;
};

export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'service_completed'
  | 'low_stock'
  | 'referral_created'
  | 'referral_redeemed'
  | 'commission_approved'
  | 'commission_paid'
  | 'invoice_issued'
  | 'payment_received';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  message: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
