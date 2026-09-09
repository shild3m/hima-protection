const fs = require('fs');
const path = require('path');

const checkpoint = {
  timestamp: new Date().toISOString(),
  tables: 30,
  functions: 2, // handle_new_user(), update_updated_at()
  policies: 3, // offers, service_images, services
  indexes: 91,
  referral_services_columns: ['id', 'referral_id', 'service_id', 'created_at'],
  staff_columns: ['id', 'user_id', 'email', 'full_name', 'phone', 'role', 'is_active', 'created_at', 'updated_at'],
  referral_services_count: 0,
  staff_count: 0,
};

fs.writeFileSync(path.join(__dirname, 'migration-checkpoint-pre-003.json'), JSON.stringify(checkpoint, null, 2));
console.log('Checkpoint saved.');
