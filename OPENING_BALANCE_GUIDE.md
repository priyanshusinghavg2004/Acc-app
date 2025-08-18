# Opening Balance System for Parties

## Overview
The opening balance system allows you to carry forward existing balances from previous accounting periods when setting up parties in the system. This is essential for maintaining accurate financial records and ensuring continuity in your accounting.

## How It Works

### Opening Balance Values
- **Positive Value (+ve)**: Represents money owed to you by the customer (Udhari/Receivable)
- **Negative Value (-ve)**: Represents money you owe to the supplier (Advance/Payable)
- **Zero (0)**: No opening balance

### Examples

#### Customer with Udhari (Receivable)
- **Scenario**: Customer owes you ₹5,000 from previous transactions
- **Opening Balance**: Enter `5000` (positive)
- **Meaning**: Customer has ₹5,000 outstanding balance in your favor
- **Reports Impact**: This amount will appear as receivable in balance sheet and aging reports

#### Supplier with Advance (Payable)
- **Scenario**: You owe supplier ₹3,000 from previous transactions
- **Opening Balance**: Enter `-3000` (negative)
- **Meaning**: You have ₹3,000 outstanding balance owed to supplier
- **Reports Impact**: This amount will appear as payable in balance sheet reports

#### New Party
- **Scenario**: New customer/supplier with no previous transactions
- **Opening Balance**: Enter `0` or leave empty
- **Meaning**: No opening balance to carry forward

## Where Opening Balance Appears

### 1. Parties Table
- Shows opening balance with color coding:
  - Green: Receivable (positive)
  - Red: Payable (negative)
  - Gray: No balance

### 2. Reports
- **Customer Ledger Report**: Opening balance is added to transaction-based calculations
- **Balance Sheet Report**: 
  - Positive balances added to Debtors (Assets)
  - Negative balances added to Creditors (Liabilities)
- **Aging Report**: Opening balances included in outstanding amounts
- **Dashboard**: Opening balances reflected in outstanding receivables/payables

### 3. Balance Calculations
All balance calculations now start with the opening balance and add/subtract subsequent transactions:
```
Final Balance = Opening Balance + Sales - Purchases - Payments
```

## Best Practices

### 1. Accurate Entry
- Double-check opening balance amounts before saving
- Use exact amounts from your previous accounting records
- Consider the date as of which the balance is being entered

### 2. Regular Review
- Review opening balances periodically
- Update if discrepancies are found
- Document any changes made

### 3. Data Migration
- When migrating from other systems, ensure opening balances are correctly transferred
- Verify totals match your previous system's closing balances

## Technical Implementation

### Data Structure
```javascript
{
  openingBalance: 5000,  // Positive for receivable
  // or
  openingBalance: -3000, // Negative for payable
  // or
  openingBalance: 0      // No balance
}
```

### Validation
- Accepts positive and negative numbers
- Supports decimal values (₹0.01 precision)
- No minimum/maximum limits

### Calculations
- **Receivable**: `openingBalance > 0 ? openingBalance : 0`
- **Payable**: `openingBalance < 0 ? Math.abs(openingBalance) : 0`

## Troubleshooting

### Common Issues
1. **Balance not appearing in reports**: Check if opening balance field is filled
2. **Wrong balance type**: Verify positive/negative values are correct
3. **Reports not updating**: Ensure party data is saved properly

### Verification Steps
1. Check party details in Parties component
2. Verify opening balance value in table
3. Run relevant reports to confirm inclusion
4. Check dashboard outstanding amounts

## Migration from Existing Data

If you have existing parties without opening balances:
1. **Current parties**: Add opening balances manually based on your records
2. **New parties**: Opening balance will default to 0
3. **Historical accuracy**: Opening balances only affect future calculations

## Support

For questions or issues with the opening balance system:
1. Check this guide first
2. Verify data entry accuracy
3. Review report calculations
4. Contact support if technical issues persist

---

*This system ensures your accounting continuity and provides accurate financial reporting by incorporating historical balances into current calculations.*
