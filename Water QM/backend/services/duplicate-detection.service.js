/**
 * Duplicate Complaint Detection & Suggestion Service
 * Evaluates geographic locality, category, submission time, and description keywords.
 * Never auto-merges or overwrites complaints.
 */

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'for',
  'of', 'with', 'from', 'by', 'as', 'it', 'this', 'that', 'we', 'our', 'my',
  'have', 'has', 'had', 'been', 'there', 'their', 'very', 'please', 'water', 'issue'
]);

function extractKeywords(text) {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

function computeKeywordOverlap(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return [];
  const overlap = [];
  for (const word of setA) {
    if (setB.has(word)) overlap.push(word);
  }
  return overlap;
}

/**
 * Compare candidate complaint against reference attributes (or reference complaint)
 */
function evaluateComplaintMatch(candidate, reference) {
  const reasons = [];
  let score = 0;

  // 1. Locality match
  const candLocality = (candidate.locality || '').trim().toLowerCase();
  const refLocality = (reference.locality || '').trim().toLowerCase();

  if (candLocality && refLocality && candLocality === refLocality) {
    score += 40;
    reasons.push(`Exact locality match in "${candidate.locality}"`);
  } else if (candLocality && refLocality && (candLocality.includes(refLocality) || refLocality.includes(candLocality))) {
    score += 25;
    reasons.push(`Geographic vicinity match ("${candidate.locality}" ~ "${reference.locality}")`);
  }

  // 2. PIN Code match if provided
  if (candidate.pincode && reference.pincode && candidate.pincode === reference.pincode) {
    score += 15;
    reasons.push(`Postal code match (${candidate.pincode})`);
  }

  // 3. Category match
  if (candidate.category && reference.category && candidate.category === reference.category) {
    score += 30;
    reasons.push(`Identical problem category: "${candidate.category}"`);
  }

  // 4. Station match if available
  if (candidate.stationId && reference.stationId && candidate.stationId === reference.stationId) {
    score += 15;
    reasons.push(`Monitored water station reference: ${candidate.stationId}`);
  }

  // 5. Keyword overlap in description / title
  const refKeywords = extractKeywords(`${reference.title || ''} ${reference.description || ''}`);
  const candKeywords = extractKeywords(`${candidate.description || ''}`);
  const overlap = computeKeywordOverlap(refKeywords, candKeywords);

  if (overlap.length >= 2) {
    score += Math.min(25, overlap.length * 8);
    reasons.push(`Keyword overlap in description (${overlap.slice(0, 4).join(', ')})`);
  } else if (overlap.length === 1) {
    score += 8;
    reasons.push(`Keyword match: "${overlap[0]}"`);
  }

  // 6. Time proximity
  const candTime = new Date(candidate.createdAt || Date.now()).getTime();
  const refTime = new Date(reference.createdAt || Date.now()).getTime();
  const diffHours = Math.abs(candTime - refTime) / (1000 * 60 * 60);

  if (diffHours <= 48) {
    score += 15;
    reasons.push(`Submitted within ${Math.max(1, Math.round(diffHours))} hours of related event`);
  } else if (diffHours <= 168) { // 7 days
    score += 8;
    reasons.push(`Submitted within ${Math.round(diffHours / 24)} days of related event`);
  }

  let confidence = 'Low';
  if (score >= 65) confidence = 'High';
  else if (score >= 35) confidence = 'Medium';

  return {
    score,
    confidence,
    reasons,
    isSuggested: score >= 35
  };
}

/**
 * Scan all unlinked complaints (or complaints not in current issue) and return scored suggestions
 */
function findRelatedComplaints(reference, allComplaints, currentLinkedIds = []) {
  const linkedSet = new Set(currentLinkedIds.map(String));
  const suggestions = [];

  for (const c of allComplaints) {
    const cId = String(c._id || c.id || c.trackingId);
    // Skip if already linked to this issue or if it is the reference itself
    if (linkedSet.has(cId) || linkedSet.has(c.trackingId)) continue;
    if (reference.trackingId && c.trackingId === reference.trackingId) continue;
    if (reference._id && String(reference._id) === cId) continue;

    const evaluation = evaluateComplaintMatch(c, reference);
    if (evaluation.isSuggested) {
      suggestions.push({
        complaint: {
          _id: c._id || c.id,
          trackingId: c.trackingId,
          category: c.category,
          locality: c.locality,
          pincode: c.pincode,
          stationId: c.stationId,
          status: c.status,
          priority: c.priority,
          createdAt: c.createdAt,
          descriptionExcerpt: (c.description || '').slice(0, 120) + ((c.description || '').length > 120 ? '...' : ''),
          alreadyLinkedTo: c.communityIssueRef || null
        },
        score: evaluation.score,
        confidence: evaluation.confidence,
        reasons: evaluation.reasons
      });
    }
  }

  // Sort by score descending
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
}

module.exports = {
  evaluateComplaintMatch,
  findRelatedComplaints
};
