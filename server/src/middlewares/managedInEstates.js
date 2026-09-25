// Blocks, apartments and landlords are added and edited only in ROCA Estates
// (rocaem); Roca Living shows them read-only. Old create/edit/delete endpoints
// answer 410 Gone with a clear message instead of changing anything.
export const managedInEstates = (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Landlords, blocks and apartments are managed in ROCA Estates. Add or change them there.'
  });
};

// Edits that touch fields owned by ROCA Estates are refused; Roca Living's own
// lettings fields (notes, fee %, key ref, NRL…) can still be saved.
export const rejectEstateFields = (fields) => (req, res, next) => {
  const touched = fields.filter((f) => req.body && req.body[f] !== undefined);
  if (touched.length) {
    return res.status(410).json({
      success: false,
      message: `${touched.join(', ')} ${touched.length === 1 ? 'is' : 'are'} managed in ROCA Estates. Change ${touched.length === 1 ? 'it' : 'them'} there.`
    });
  }
  return next();
};
