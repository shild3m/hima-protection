export interface CurrentUser {
  auth_user_id: string;
  email: string;
  staff_id: string;
  name: string;
  role_id: string;
  role_name: string;
  permissions: string[];
  is_active: boolean;
  user: { id: string; email: string };
}
