-- Phase 18: Dashboard aggregation RPC functions
-- Replaces unbounded JS-side aggregation with server-side COUNT/SUM/GROUP BY

-- 1. Revenue aggregation for current month
CREATE OR REPLACE FUNCTION public.dashboard_revenue_month(p_month_start timestamptz)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(paid_amount), 0)
  FROM invoices
  WHERE status IN ('paid', 'partially_paid')
    AND updated_at >= p_month_start;
$$;

-- 2. Pending payments aggregation (all time, unbounded by nature)
CREATE OR REPLACE FUNCTION public.dashboard_pending_payments()
RETURNS TABLE(pending_total numeric, pending_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(total - COALESCE(paid_amount, 0)), 0), COUNT(*)
  FROM invoices
  WHERE status IN ('issued', 'partially_paid');
$$;

-- 3. Pending commissions aggregation
CREATE OR REPLACE FUNCTION public.dashboard_pending_commissions()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(calculated_amount), 0)
  FROM commissions
  WHERE status = 'pending';
$$;

-- 4. Bookings by status for a given day (replaces fetching all rows + JS grouping)
CREATE OR REPLACE FUNCTION public.dashboard_bookings_by_status(p_date date)
RETURNS TABLE(status text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT b.status, COUNT(*)
  FROM bookings b
  WHERE b.created_at >= p_date
    AND b.created_at < p_date + interval '1 day'
  GROUP BY b.status;
$$;

-- 5. Revenue chart data grouped by day
CREATE OR REPLACE FUNCTION public.dashboard_revenue_chart(p_from date, p_to date)
RETURNS TABLE(day date, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    (updated_at AT TIME ZONE 'UTC')::date AS day,
    COALESCE(SUM(paid_amount), 0) AS total
  FROM invoices
  WHERE status IN ('paid', 'partially_paid')
    AND updated_at >= p_from
    AND updated_at < p_to + interval '1 day'
  GROUP BY (updated_at AT TIME ZONE 'UTC')::date
  ORDER BY day;
$$;

-- 6. Bookings chart data grouped by status within date range
CREATE OR REPLACE FUNCTION public.dashboard_bookings_chart(p_from date, p_to date)
RETURNS TABLE(status text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT b.status, COUNT(*)
  FROM bookings b
  WHERE b.created_at >= p_from
    AND b.created_at < p_to + interval '1 day'
  GROUP BY b.status
  ORDER BY COUNT(*) DESC;
$$;

-- 7. Services chart data grouped by service name within date range
CREATE OR REPLACE FUNCTION public.dashboard_services_chart(p_from date, p_to date)
RETURNS TABLE(service_name text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(s.name, 'غير معروف'), COUNT(*)
  FROM bookings b
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.created_at >= p_from
    AND b.created_at < p_to + interval '1 day'
    AND b.status = 'completed'
  GROUP BY s.name
  ORDER BY COUNT(*) DESC;
$$;

-- 8. Dealer performance (referrals + commissions by dealer)
CREATE OR REPLACE FUNCTION public.dashboard_dealer_performance()
RETURNS TABLE(dealer_name text, referral_count bigint, commission_sum numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    d.business_name,
    COALESCE(r.cnt, 0),
    COALESCE(c.total, 0)
  FROM dealers d
  LEFT JOIN (
    SELECT dealer_id, COUNT(*) AS cnt
    FROM referrals
    GROUP BY dealer_id
  ) r ON r.dealer_id = d.id
  LEFT JOIN (
    SELECT dealer_id, SUM(COALESCE(calculated_amount, 0)) AS total
    FROM commissions
    GROUP BY dealer_id
  ) c ON c.dealer_id = d.id
  WHERE d.is_active = true
  ORDER BY COALESCE(r.cnt, 0) DESC
  LIMIT 10;
$$;

-- 9. Low stock materials count (already uses DB filter, this formalizes it)
CREATE OR REPLACE FUNCTION public.dashboard_low_stock_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM materials
  WHERE is_active = true
    AND (current_stock <= 0 OR current_stock <= min_stock);
$$;
