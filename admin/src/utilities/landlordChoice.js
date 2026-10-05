// Helpers for LandlordChooser (components/UI/LandlordChooser.jsx): the landlord
// picked in Roca Living when ROCA Estates has no owner on an apartment.

export const emptyNewLandlord = () => ({ name: '', email: '', phone: '', address: '' });

// Validation message for the choice, or null when it is complete.
export const landlordChoiceError = (choice, newLandlord) => {
  if (!choice) return 'Choose the landlord';
  if (choice === 'new' && (!newLandlord.name.trim() || !newLandlord.email.trim())) return "Enter the new landlord's name and email";
  return null;
};

// API body fields for the choice: { landlord_id } or { new_landlord }.
export const landlordChoicePayload = (choice, newLandlord) => {
  if (choice === 'new') return { new_landlord: newLandlord };
  if (choice) return { landlord_id: Number(choice) };
  return {};
};
