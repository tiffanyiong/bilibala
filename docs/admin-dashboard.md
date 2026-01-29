# Admin Dashboard - Feature Spec

## Overview
Add an admin role and dashboard to manage users and manually sync subscription statuses with Stripe.

---

## 1. Admin Role

### Database
- Add `role` column to `user_subscriptions` table (or a separate `user_roles` table)
- Values: `user` (default), `admin`
- Manually assign admin role via Supabase SQL:
  ```sql
  UPDATE user_subscriptions SET role = 'admin' WHERE user_id = '<your-user-id>';
  ```

### Backend Middleware
- Create `requireAdmin` middleware that checks the user's role before allowing access to admin endpoints
- All `/api/admin/*` routes use this middleware

---

## 2. Admin API Endpoints

### GET /api/admin/users
- Returns paginated list of all users with subscription info
- Response fields: `user_id`, `email`, `tier`, `subscription_status`, `stripe_customer_id`, `current_period_end`, `created_at`
- Query params: `?page=1&limit=20&search=email@example.com&tier=free|pro`

### POST /api/admin/users/:userId/sync
- Calls the existing Stripe sync logic for a specific user
- Returns the updated subscription status
- Useful when a user reports a mismatch

### GET /api/admin/stats
- Summary stats: total users, pro users, free users, canceled users, revenue (from Stripe)

---

## 3. Admin Dashboard UI

### Access
- Add "Admin" menu item in UserMenu (only visible to admin users)
- Route: `/admin`
- Add `ADMIN` to `AppState` enum

### Pages

#### Users List
- Table with columns: Email, Tier (free/pro badge), Status, Stripe Customer, Expiry Date, Actions
- Search bar to filter by email
- Filter dropdown by tier (All / Free / Pro)
- Each row has a "Sync with Stripe" button that calls `POST /api/admin/users/:userId/sync`
- Visual feedback: loading spinner on sync, success/error toast

#### Stats Overview (optional)
- Cards showing: Total Users, Pro Subscribers, Free Users, Canceled Users

---

## 4. Implementation Order

1. Add `role` column to database
2. Create `requireAdmin` middleware
3. Build `/api/admin/users` and `/api/admin/users/:userId/sync` endpoints
4. Build admin dashboard UI (users list + sync button)
5. Add routing and menu item
6. (Optional) Add stats endpoint and overview cards
