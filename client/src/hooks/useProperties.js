import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';
import { formatProperty } from '../utilities/formatProperty';

export const useProperties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchMyProperties = async () => {
    setLoading(true);
    try {
      // Fetch properties, tenancies, and maintenance tickets in parallel
      const [propRes, tenancyRes, maintenanceRes] = await Promise.all([
        api.get('/properties/my'),
        api.get('/tenancies/my').catch(() => ({ data: { data: [] } })),
        api.get('/maintenance/my').catch(() => ({ data: { data: [] } }))
      ]);

      const propertiesList = propRes.data.data || [];
      const tenanciesList = tenancyRes.data?.data || [];
      const maintenanceTickets = maintenanceRes.data?.data || [];

      // Create tenancy property-id mapping
      const tenancyMap = {};
      tenanciesList.forEach((t) => {
        if (t.status === 'active') {
          tenancyMap[t.property_id] = t;
        }
      });

      // Create open tickets count mapping
      const openTicketsCountMap = {};
      maintenanceTickets.forEach((t) => {
        if (t.status !== 'complete' && t.status !== 'cancelled') {
          openTicketsCountMap[t.property_id] = (openTicketsCountMap[t.property_id] || 0) + 1;
        }
      });

      const formatted = propertiesList.map((p) => {
        return formatProperty(p, tenancyMap[p.id], openTicketsCountMap[p.id]);
      });

      setProperties(formatted);
      setError(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error loading properties';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProperties();
  }, []);

  // Calculate gross yield (sum of rents of occupied/let properties)
  const monthlyGrossYield = properties
    .filter(p => p.status === 'let')
    .reduce((sum, p) => sum + (p.rent || 0), 0);

  // Count active warnings (expired certs)
  const complianceWarnings = properties.filter(
    p => p.gasCompliance === 'expired' || p.epcCompliance === 'expired' || p.eicrCompliance === 'expired'
  ).length;

  return {
    properties,
    loading,
    error,
    monthlyGrossYield,
    complianceWarnings,
    fetchMyProperties
  };
};
