import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Building2, Layers } from 'lucide-react';
import { usePropertyContext } from '../../context/PropertyContext';

export const PropertyDropdown = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { properties, selectedProperty, setSelectedProperty } = usePropertyContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Selected item display info
  const getSelectedDisplay = () => {
    if (selectedProperty === 'all') {
      return {
        title: 'All Properties',
        subTitle: `${properties.length} Properties`,
        image: `${import.meta.env.BASE_URL}images/block_img.jpg`
      };
    }
    if (selectedProperty) {
      return {
        title: selectedProperty.name || selectedProperty.address_line1 || 'Apartment 19, Parsons House',
        subTitle: `${selectedProperty.property_reference ? `${selectedProperty.property_reference} • ` : ''}${selectedProperty.city || 'Washington'}, ${selectedProperty.postcode || 'NE37 1EZ'}`,
        image: selectedProperty.image_url || (selectedProperty.address_line1?.includes('Random') ? `${import.meta.env.BASE_URL}images/img2.jpg` : `${import.meta.env.BASE_URL}images/block_img.jpg`)
      };
    }
    return {
      title: 'Select Property',
      subTitle: 'No property selected',
      image: null
    };
  };

  const display = getSelectedDisplay();

  return (
    <div className="relative select-none" ref={dropdownRef}>
      
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-4 px-4 py-2 bg-white border border-card-border hover:border-gray-300 rounded-card shadow-sm cursor-pointer transition-all duration-150 text-left h-[60px] w-[240px]"
      >
        {/* Thumbnail Image */}
        {display.image ? (
          <img 
            src={display.image} 
            alt={display.title} 
            className="w-11 h-11 rounded-sm object-cover shrink-0 bg-gray-100 animate-fade-in image-render-smooth"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none'; // hide if broken image
            }}
          />
        ) : (
          <div className="w-9 h-9 rounded-sm bg-status-info/10 text-status-info flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
        )}

        {/* Text */}
        <div className="flex flex-col min-w-0 pr-1 flex-grow">
          <span className="text-sm-portal font-bold text-brand-primary truncate leading-tight">
            {display.title}
          </span>
          <span className="text-xs-portal text-gray-500 truncate leading-none mt-0.5">
            {display.subTitle}
          </span>
        </div>

        {/* Arrow Chevron */}
        <ChevronDown 
          size={16} 
          className={`text-gray-400 shrink-0 ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 min-w-[240px] bg-white border border-card-border shadow-xl py-2 max-h-[300px] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-100 z-50 animate-fade-in">
          
          {/* 'All Properties' Option */}
          <button
            onClick={() => {
              setSelectedProperty('all');
              setIsOpen(false);
              if (location.pathname.match(/\/properties\/\d+/)) {
                navigate('/properties');
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left cursor-pointer transition-colors ${selectedProperty === 'all' ? 'bg-gray-50/80 font-bold' : ''}`}
          >
            <img 
              src={`${import.meta.env.BASE_URL}images/block_img.jpg`} 
              alt="All Properties" 
              className="w-8 h-8 rounded-sm object-cover shrink-0 bg-gray-100 image-render-smooth"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs-portal text-brand-primary leading-tight">All Properties</span>
              <span className="text-2xs text-gray-400 leading-none mt-0.5">{properties.length} managed units</span>
            </div>
          </button>

          <div className="border-t border-[#F5F5F5] my-1" />

          {/* Properties List */}
          {properties.length === 0 ? (
            <div className="px-4 py-3 text-xs-portal text-gray-400 text-center">No properties found</div>
          ) : (
            properties.map((property) => {
              const isSelected = selectedProperty !== 'all' && selectedProperty?.id === property.id;
              const propImage = property.image_url || (property.address_line1?.includes('Random') ? `${import.meta.env.BASE_URL}images/img2.jpg` : `${import.meta.env.BASE_URL}images/block_img.jpg`);
              
              return (
                <button
                  key={property.id}
                  onClick={() => {
                    setSelectedProperty(property);
                    setIsOpen(false);
                    if (location.pathname.match(/\/properties\/\d+/)) {
                      navigate(`/properties/${property.id}`);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left cursor-pointer transition-colors ${isSelected ? 'bg-gray-50/80 font-bold' : ''}`}
                >
                  {propImage ? (
                    <img 
                      src={propImage} 
                      alt={property.address_line1} 
                      className="w-8 h-8 rounded-sm object-cover shrink-0 bg-gray-100 image-render-smooth"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-sm bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                      <Building2 size={16} />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs-portal font-bold text-brand-primary truncate leading-tight">
                      {property.name || property.address_line1}
                    </span>
                    <span className="text-2xs text-gray-400 truncate leading-none mt-0.5">
                      {property.property_reference || `Prop #${property.id}`} • {property.city}, {property.postcode}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
