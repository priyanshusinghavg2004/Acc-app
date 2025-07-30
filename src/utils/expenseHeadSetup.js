import { db } from '../firebase.config';
import { collection, setDoc, doc } from 'firebase/firestore';

// Define grouped expense heads
export const EXPENSE_GROUPS = [
  {
    group: 'Salaries',
    heads: ['Employee Salary', 'Advance', 'Credit']
  },
  {
    group: 'Fixed',
    heads: ['Rent', 'Electricity', 'Internet', 'Insurance', 'Professional Fees', 'Bank Charges', 'Interest Paid']
  },
  {
    group: 'Variable',
    heads: ['Office Expenses', 'Stationery', 'Travel', 'Repairs & Maintenance', 'Advertising & Marketing', 'Miscellaneous']
  }
];

// Utility to upload heads/groups to Firestore
export async function uploadExpenseHeadsToFirestore() {
  const headsCol = collection(db, 'expenseHeads');
  for (const group of EXPENSE_GROUPS) {
    for (const head of group.heads) {
      const docRef = doc(headsCol, head.replace(/\s+/g, '_').toLowerCase());
      await setDoc(docRef, {
        head,
        group: group.group
      });
    }
  }
  console.log('Expense heads/groups uploaded to Firestore!');
}

// Allow running as a script
if (require.main === module) {
  uploadExpenseHeadsToFirestore().then(() => {
    console.log('Done.');
    process.exit(0);
  }).catch(err => {
    console.error('Error uploading expense heads:', err);
    process.exit(1);
  });
} 