function extractField(actionBlock, fieldName) {
  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'im');
  const match = actionBlock.match(regex);
  return match ? match[1].trim().replace(/['"\`]/g, '') : null;
}

function extractBlock(actionBlock, startMarker, endMarker) {
  // Case-insensitive search for markers
  const startIdx = actionBlock.toLowerCase().indexOf(startMarker.toLowerCase());
  const endIdx = actionBlock.toLowerCase().indexOf(endMarker.toLowerCase());
  
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  
  // Extract content between markers
  return actionBlock.substring(startIdx + startMarker.length, endIdx).trim();
}

module.exports = { extractField, extractBlock };
