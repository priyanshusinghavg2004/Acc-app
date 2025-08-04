import { migrateExistingUsersToCompanies, checkMigrationStatus } from './migrateCompanyData';

// Function to run migration from browser console
export const runCompanyMigration = async (appId) => {
  console.log('🚀 Starting Company ID Migration...');
  console.log('App ID:', appId);
  
  // First check current status
  console.log('\n📊 Checking current migration status...');
  const status = await checkMigrationStatus(appId);
  console.log('Current Status:', status);
  
  if (status && status.migrationNeeded > 0) {
    console.log(`\n🔄 Found ${status.migrationNeeded} users that need company IDs`);
    
    const confirm = window.confirm(
      `Found ${status.migrationNeeded} users with company information that need Company IDs.\n\n` +
      'This will:\n' +
      '• Generate unique 6-digit Company IDs\n' +
      '• Create company documents\n' +
      '• Assign users as company owners\n' +
      '• Update user documents\n\n' +
      'Do you want to proceed with the migration?'
    );
    
    if (confirm) {
      console.log('\n🔄 Starting migration...');
      const result = await migrateExistingUsersToCompanies(appId);
      
      if (result.success) {
        console.log('\n✅ Migration completed successfully!');
        console.log('Results:', result);
        
        // Check final status
        const finalStatus = await checkMigrationStatus(appId);
        console.log('\n📊 Final Status:', finalStatus);
        
        alert(
          `Migration completed successfully!\n\n` +
          `• Users processed: ${result.processedCount}\n` +
          `• Companies created: ${result.companyCreatedCount}\n` +
          `• Users skipped: ${result.skippedCount}\n` +
          `• Errors: ${result.errorCount}`
        );
      } else {
        console.error('❌ Migration failed:', result.error);
        alert(`Migration failed: ${result.error}`);
      }
    } else {
      console.log('❌ Migration cancelled by user');
    }
  } else {
    console.log('✅ No migration needed - all users already have Company IDs');
    alert('No migration needed - all users with company information already have Company IDs!');
  }
};

// Function to check migration status only
export const checkMigrationOnly = async (appId) => {
  console.log('🔍 Checking Company ID Migration Status...');
  const status = await checkMigrationStatus(appId);
  console.log('Migration Status:', status);
  return status;
};

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  window.runCompanyMigration = runCompanyMigration;
  window.checkMigrationOnly = checkMigrationOnly;
  
  console.log('🔧 Company Migration Tools Available:');
  console.log('• runCompanyMigration(appId) - Run full migration');
  console.log('• checkMigrationOnly(appId) - Check status only');
  console.log('• Example: runCompanyMigration("acc-app-e5316")');
} 