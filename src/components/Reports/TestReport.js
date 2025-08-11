import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const TestReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [testData, setTestData] = useState({
    sales: [],
    purchases: [],
    payments: [],
    parties: []
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTestData = async () => {
      if (!db || !userId || !appId) {
        console.log('❌ Missing required props:', { db: !!db, userId: !!userId, appId: !!appId });
        return;
      }

      console.log('🧪 Starting test data fetch for user:', userId);
      setLoading(true);
      setError(null);

      try {
        // Test database connection first
        console.log('🔍 Testing database connection...');
        const testQuery = query(collection(db, `users/${userId}/apps/${appId}/parties`), orderBy('partyName', 'asc'));
        const testSnapshot = await getDocs(testQuery);
        console.log('✅ Database connection successful');

        // Test 1: Fetch parties
        console.log('📋 Testing parties fetch...');
        const partiesQuery = query(
          collection(db, `users/${userId}/apps/${appId}/parties`),
          orderBy('partyName', 'asc')
        );
        const partiesSnapshot = await getDocs(partiesQuery);
        const partiesData = partiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('✅ Parties fetched:', partiesData.length);

        // Test 2: Fetch sales
        console.log('📊 Testing sales fetch...');
        const salesQuery = query(
          collection(db, `users/${userId}/apps/${appId}/sales`),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        );
        const salesSnapshot = await getDocs(salesQuery);
        const salesData = salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('✅ Sales fetched:', salesData.length);

        // Test 3: Fetch purchases
        console.log('📦 Testing purchases fetch...');
        const purchasesQuery = query(
          collection(db, `users/${userId}/apps/${appId}/purchases`),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        );
        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchasesData = purchasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('✅ Purchases fetched:', purchasesData.length);

        // Test 4: Fetch payments
        console.log('💰 Testing payments fetch...');
        const paymentsQuery = query(
          collection(db, `users/${userId}/apps/${appId}/payments`),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const paymentsData = paymentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('✅ Payments fetched:', paymentsData.length);

        setTestData({
          sales: salesData,
          purchases: purchasesData,
          payments: paymentsData,
          parties: partiesData
        });

        console.log('🎉 All test data fetched successfully!');

      } catch (error) {
        console.error('❌ Error in test data fetch:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        setError(`Database Error: ${error.code} - ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTestData();
  }, [db, userId, appId]); // Only depend on core props

  const refreshData = () => {
    setTestData({
      sales: [],
      purchases: [],
      payments: [],
      parties: []
    });
    // Trigger re-fetch by updating a dependency
    setError(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">🧪 Test Report - Data Fetching Debug</h2>
          <button
            onClick={refreshData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition duration-300"
          >
            🔄 Refresh Data
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <h3 className="text-red-800 font-medium">Error:</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Parties</div>
            <div className="text-2xl font-bold text-blue-800">{testData.parties.length}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Sales</div>
            <div className="text-2xl font-bold text-green-800">{testData.sales.length}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-purple-600 font-medium">Purchases</div>
            <div className="text-2xl font-bold text-purple-800">{testData.purchases.length}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-yellow-600 font-medium">Payments</div>
            <div className="text-2xl font-bold text-yellow-800">{testData.payments.length}</div>
          </div>
        </div>

        {/* Sample Data Display */}
        <div className="space-y-6">
          {/* Parties Sample */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Sample Parties ({testData.parties.length})</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {testData.parties.length > 0 ? (
                <div className="space-y-2">
                  {testData.parties.slice(0, 5).map((party, index) => (
                    <div key={party.id} className="text-sm">
                      <span className="font-medium">{index + 1}.</span> {party.partyName} (ID: {party.id})
                    </div>
                  ))}
                  {testData.parties.length > 5 && (
                    <div className="text-sm text-gray-500">... and {testData.parties.length - 5} more</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">No parties found</div>
              )}
            </div>
          </div>

          {/* Sales Sample */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Sample Sales ({testData.sales.length})</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {testData.sales.length > 0 ? (
                <div className="space-y-2">
                  {testData.sales.slice(0, 5).map((sale, index) => (
                    <div key={sale.id} className="text-sm">
                      <span className="font-medium">{index + 1}.</span> {sale.invoiceNumber || sale.number} - {sale.party || sale.partyName} - ₹{sale.amount || sale.totalAmount}
                    </div>
                  ))}
                  {testData.sales.length > 5 && (
                    <div className="text-sm text-gray-500">... and {testData.sales.length - 5} more</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">No sales found in date range</div>
              )}
            </div>
          </div>

          {/* Payments Sample */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Sample Payments ({testData.payments.length})</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {testData.payments.length > 0 ? (
                <div className="space-y-2">
                  {testData.payments.slice(0, 5).map((payment, index) => (
                    <div key={payment.id} className="text-sm">
                      <span className="font-medium">{index + 1}.</span> {payment.receiptNumber || payment.number} - {payment.partyName || payment.party} - ₹{payment.amount}
                    </div>
                  ))}
                  {testData.payments.length > 5 && (
                    <div className="text-sm text-gray-500">... and {testData.payments.length - 5} more</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">No payments found in date range</div>
              )}
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Debug Information</h3>
          <div className="text-sm space-y-1">
            <div><strong>User ID:</strong> {userId}</div>
            <div><strong>App ID:</strong> {appId}</div>
            <div><strong>Date Range:</strong> {dateRange.start.toDateString()} to {dateRange.end.toDateString()}</div>
            <div><strong>Selected Party:</strong> {selectedParty || 'None'}</div>
            <div><strong>Parties from Props:</strong> {parties.length}</div>
            <div><strong>Loading State:</strong> {loading ? 'True' : 'False'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestReport; 