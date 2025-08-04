import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { createCompanyIfNeeded, hasCompanyInfo } from './companyUtils';

// Migration script for existing users
export const migrateExistingUsersToCompanies = async (appId) => {
  try {
    console.log('🚀 Starting company migration for app:', appId);
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    let processedCount = 0;
    let companyCreatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`📊 Found ${usersSnapshot.size} total users`);
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        console.log(`\n👤 Processing user: ${userId}`);
        console.log(`   Email: ${userData.email}`);
        
        // Skip if user already has company ID
        if (userData.companyId) {
          console.log(`   ⏭️  Skipped: Already has company ID ${userData.companyId}`);
          skippedCount++;
          continue;
        }
        
        // Check if user has company information
        if (!hasCompanyInfo(userData)) {
          console.log(`   ⏭️  Skipped: No company information found`);
          skippedCount++;
          continue;
        }
        
        console.log(`   🏢 Company info found:`, {
          companyName: userData.companyName,
          gstNumber: userData.gstNumber,
          businessName: userData.businessName
        });
        
        // Create company for this user
        const result = await createCompanyIfNeeded(userData, userId, appId);
        
        if (result.isNew) {
          console.log(`   ✅ Company created: ${result.companyId}`);
          companyCreatedCount++;
        } else {
          console.log(`   ℹ️  Company already exists: ${result.companyId}`);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error processing user ${userDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   Total users processed: ${processedCount}`);
    console.log(`   Companies created: ${companyCreatedCount}`);
    console.log(`   Users skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    return {
      success: true,
      processedCount,
      companyCreatedCount,
      skippedCount,
      errorCount
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check migration status
export const checkMigrationStatus = async (appId) => {
  try {
    console.log('🔍 Checking migration status...');
    
    // Count users with company IDs
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    let totalUsers = 0;
    let usersWithCompanyId = 0;
    let usersWithCompanyInfo = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      totalUsers++;
      
      if (userData.companyId) {
        usersWithCompanyId++;
      }
      
      if (hasCompanyInfo(userData)) {
        usersWithCompanyInfo++;
      }
    }
    
    // Count companies
    const companiesRef = collection(db, `artifacts/${appId}/companies`);
    const companiesSnapshot = await getDocs(companiesRef);
    const totalCompanies = companiesSnapshot.size;
    
    console.log('\n📊 Migration Status:');
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with company info: ${usersWithCompanyInfo}`);
    console.log(`   Users with company ID: ${usersWithCompanyId}`);
    console.log(`   Total companies: ${totalCompanies}`);
    console.log(`   Migration needed: ${usersWithCompanyInfo - usersWithCompanyId}`);
    
    return {
      totalUsers,
      usersWithCompanyInfo,
      usersWithCompanyId,
      totalCompanies,
      migrationNeeded: usersWithCompanyInfo - usersWithCompanyId
    };
    
  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    return null;
  }
}; 