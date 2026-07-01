import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utilities/api';
import { useToast } from '../components/UI/ToastContext';

import { formatProperty } from '../utilities/formatProperty';

const PropertyContext = createContext();

export const PropertyProvider = ({ children }) => {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null); // 'all' or property object
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const [propRes, tenancyRes, maintenanceRes] = await Promise.all([
        api.get('/properties/my'),
        api.get('/tenancies/my').catch(() => ({ data: { data: [] } })),
        api.get('/maintenance/my').catch(() => ({ data: { data: [] } }))
      ]);

      const propertiesList = propRes.data.data || [];
      const tenanciesList = tenancyRes.data?.data || [];
      const maintenanceTickets = maintenanceRes.data?.data || [];

      // Create maps
      const tenancyMap = {};
      tenanciesList.forEach((t) => {
        if (t.status === 'active') {
          tenancyMap[t.property_id] = t;
        }
      });

      const openTicketsCountMap = {};
      maintenanceTickets.forEach((t) => {
        if (t.status !== 'completed' && t.status !== 'cancelled') {
          openTicketsCountMap[t.property_id] = (openTicketsCountMap[t.property_id] || 0) + 1;
        }
      });

      const formatted = propertiesList.map((p) => {
        return formatProperty(p, tenancyMap[p.id], openTicketsCountMap[p.id]);
      });

      setProperties(formatted);
      // Default selected property is 'all'
      setSelectedProperty('all');
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
    fetchProperties();
  }, []);

  return (
    <PropertyContext.Provider value={{
      properties,
      selectedProperty,
      setSelectedProperty,
      loading,
      error,
      refetch: fetchProperties
    }}>
      {children}
    </PropertyContext.Provider>
  );
};

export const usePropertyContext = () => useContext(PropertyContext);
export default PropertyContext;
