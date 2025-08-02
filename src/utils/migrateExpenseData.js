import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

// Migration utility to move expense data from root collections to user-specific collections
export const migrateExpenseData = async (db, appId, userId) => {
  console.log('Starting expense data migration...');
  
  try {
    // Migrate employees
    const employeesSnapshot = await getDocs(collection(db, 'employees'));
    const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${employees.length} employees to migrate`);
    
    for (const employee of employees) {
      // Add to user-specific collection
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/employees`), {
        ...employee,
        migratedAt: new Date().toISOString()
      });
      
      // Delete from root collection
      await deleteDoc(doc(db, 'employees', employee.id));
      console.log(`Migrated employee: ${employee.name || employee.employeeId}`);
    }
    
    // Migrate expenses
    const expensesSnapshot = await getDocs(collection(db, 'expenses'));
    const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${expenses.length} expenses to migrate`);
    
    for (const expense of expenses) {
      // Add to user-specific collection
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/expenses`), {
        ...expense,
        migratedAt: new Date().toISOString()
      });
      
      // Delete from root collection
      await deleteDoc(doc(db, 'expenses', expense.id));
      console.log(`Migrated expense: ${expense.head || expense.group}`);
    }
    
    // Migrate salary payments
    const salaryPaymentsSnapshot = await getDocs(collection(db, 'salaryPayments'));
    const salaryPayments = salaryPaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${salaryPayments.length} salary payments to migrate`);
    
    for (const payment of salaryPayments) {
      // Add to user-specific collection
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/salaryPayments`), {
        ...payment,
        migratedAt: new Date().toISOString()
      });
      
      // Delete from root collection
      await deleteDoc(doc(db, 'salaryPayments', payment.id));
      console.log(`Migrated salary payment: ${payment.employeeName || payment.employeeId}`);
    }
    
    console.log('Expense data migration completed successfully!');
    return {
      success: true,
      migrated: {
        employees: employees.length,
        expenses: expenses.length,
        salaryPayments: salaryPayments.length
      }
    };
    
  } catch (error) {
    console.error('Error during expense data migration:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check if migration is needed
export const checkMigrationNeeded = async (db) => {
  try {
    const employeesSnapshot = await getDocs(collection(db, 'employees'));
    const expensesSnapshot = await getDocs(collection(db, 'expenses'));
    const salaryPaymentsSnapshot = await getDocs(collection(db, 'salaryPayments'));
    
    return {
      needed: employeesSnapshot.size > 0 || expensesSnapshot.size > 0 || salaryPaymentsSnapshot.size > 0,
      counts: {
        employees: employeesSnapshot.size,
        expenses: expensesSnapshot.size,
        salaryPayments: salaryPaymentsSnapshot.size
      }
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { needed: false, error: error.message };
  }
}; 