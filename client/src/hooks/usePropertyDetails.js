import { useState, useEffect, useCallback } from 'react';
import api from '../utilities/api';

export const usePropertyDetails = (id) => {
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPropertyDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [propRes, tenancyRes, maintenanceRes] = await Promise.all([
        api.get(`/properties/my/${id}`),
        api.get('/tenancies/my').catch(() => ({ data: { data: [] } })),
        api.get('/maintenance/my').catch(() => ({ data: { data: [] } }))
      ]);
      
      const pData = propRes.data.data;
      const tenanciesList = tenancyRes.data?.data || [];
      const maintenanceTickets = maintenanceRes.data?.data || [];

      // Find active tenancy for this property
      const activeT = tenanciesList.find(t => String(t.property_id) === String(id) && t.status === 'active');
      
      // Find tickets for this property
      const propTickets = maintenanceTickets.filter(t => String(t.property_id) === String(id));

      setProperty({
        ...pData,
        active_tenancy: activeT || null,
        maintenance_tickets: propTickets
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching property details:', err);
      setError(err.response?.data?.message || 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPropertyDetails();
  }, [fetchPropertyDetails]);

  return {
    property,
    loading,
    error,
    refetch: fetchPropertyDetails
  };
};
