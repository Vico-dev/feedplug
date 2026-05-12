const DESTINATION_SCOPE_PREFIX = 'destination:';

function splitScopeIds(scopeIds = []) {
  const channelIds = [];
  const destinationIds = [];

  for (const rawId of Array.isArray(scopeIds) ? scopeIds : []) {
    const normalizedId = String(rawId || '').trim();
    if (!normalizedId) continue;
    if (normalizedId.startsWith(DESTINATION_SCOPE_PREFIX)) {
      destinationIds.push(normalizedId.slice(DESTINATION_SCOPE_PREFIX.length));
    } else {
      channelIds.push(normalizedId);
    }
  }

  return {
    channelIds: Array.from(new Set(channelIds)),
    destinationIds: Array.from(new Set(destinationIds)),
  };
}

function mergeScopeIds(channelIds = [], destinationIds = []) {
  return [
    ...Array.from(new Set((Array.isArray(channelIds) ? channelIds : []).map((value) => String(value || '').trim()).filter(Boolean))),
    ...Array.from(new Set((Array.isArray(destinationIds) ? destinationIds : []).map((value) => String(value || '').trim()).filter(Boolean))).map((value) => `${DESTINATION_SCOPE_PREFIX}${value}`),
  ];
}

module.exports = {
  DESTINATION_SCOPE_PREFIX,
  splitScopeIds,
  mergeScopeIds,
};
