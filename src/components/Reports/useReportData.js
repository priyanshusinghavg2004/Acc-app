import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';

// Custom hook for fetching report data
export const useReportData = ({ 
  db, 
  userId, 
  appId, 
  dateRange, 
  selectedParty, 
  collectionName, 
  dependencies = [],
  filters = {},
  orderByField = 'date',
  orderDirection = 'desc'
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Build query
        let q = query(
          collection(db, `users/${userId}/apps/${appId}/${collectionName}`),
          orderBy(orderByField, orderDirection)
        );

        // Add date range filters if provided
        if (dateRange && dateRange.start && dateRange.end) {
          q = query(q, 
            where('date', '>=', dateRange.start),
            where('date', '<=', dateRange.end)
          );
        }

        // Add other filters
        Object.entries(filters).forEach(([field, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            q = query(q, where(field, '==', value));
          }
        });

        const snapshot = await getDocs(q);
        let fetchedData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Apply party filter in JavaScript if needed
        if (selectedParty && selectedParty !== '') {
          fetchedData = fetchedData.filter(item => {
            const itemParty = item.partyId || item.party || item.partyName;
            return itemParty === selectedParty;
          });
        }

        setData(fetchedData);
      } catch (err) {
        console.error(`Error fetching ${collectionName} data:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, userId, appId, dateRange, selectedParty, ...dependencies]);

  return { data, loading, error, setData };
};

// Hook for fetching multiple collections
export const useMultipleCollections = ({ 
  db, 
  userId, 
  appId, 
  collections = [],
  dateRange,
  selectedParty
}) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const results = {};
        
        for (const collectionConfig of collections) {
          const { name, filters = {}, orderByField = 'date', orderDirection = 'desc' } = collectionConfig;
          
          let q = query(
            collection(db, `users/${userId}/apps/${appId}/${name}`),
            orderBy(orderByField, orderDirection)
          );

          // Add date range filters if provided
          if (dateRange && dateRange.start && dateRange.end) {
            q = query(q, 
              where('date', '>=', dateRange.start),
              where('date', '<=', dateRange.end)
            );
          }

          // Add other filters
          Object.entries(filters).forEach(([field, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              q = query(q, where(field, '==', value));
            }
          });

          const snapshot = await getDocs(q);
          let fetchedData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Apply party filter in JavaScript if needed
          if (selectedParty && selectedParty !== '') {
            fetchedData = fetchedData.filter(item => {
              const itemParty = item.partyId || item.party || item.partyName;
              return itemParty === selectedParty;
            });
          }

          results[name] = fetchedData;
        }
        
        setData(results);
      } catch (err) {
        console.error('Error fetching multiple collections:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [db, userId, appId, dateRange, selectedParty, collections]);

  return { data, loading, error };
};

// Hook for calculating summary statistics
export const useSummaryCalculation = (data, calculationFn) => {
  const [summary, setSummary] = useState({});

  useEffect(() => {
    if (data && data.length > 0 && calculationFn) {
      const calculatedSummary = calculationFn(data);
      setSummary(calculatedSummary);
    } else {
      setSummary({});
    }
  }, [data, calculationFn]);

  return summary;
};

// Hook for table operations
export const useReportTable = (data, defaultSortKey = 'date', defaultSortDirection = 'desc', pageSize = 25) => {
  const { sortedData, sortConfig, handleSort } = useTableSort(data, { 
    key: defaultSortKey, 
    direction: defaultSortDirection 
  });
  const pagination = useTablePagination(sortedData, pageSize);

  return {
    sortedData,
    sortConfig,
    handleSort,
    pagination
  };
}; 