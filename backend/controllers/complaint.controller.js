const { ComplaintRepo, CommunityIssueRepo } = require('../storage/repository');

// Generate next sequential/unique Tracking ID like CMP-1024
async function generateUniqueTrackingId() {
  const all = await ComplaintRepo.find({});
  let maxNum = 1020;
  for (const c of all) {
    if (c.trackingId && c.trackingId.startsWith('CMP-')) {
      const num = parseInt(c.trackingId.replace('CMP-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `CMP-${maxNum + 1}`;
}

exports.submitComplaint = async (req, res) => {
  try {
    const {
      submitterName,
      submitterEmail,
      submitterPhone,
      category,
      locality,
      landmark,
      pincode,
      stationId,
      description,
      priority
    } = req.body;

    if (!submitterName || !submitterName.trim()) {
      return res.status(400).json({ success: false, message: 'Your name is required.' });
    }
    if (!submitterEmail || !submitterEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!submitterPhone || submitterPhone.trim().length < 8) {
      return res.status(400).json({ success: false, message: 'A valid contact phone number is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Complaint category is required.' });
    }
    if (!locality || !locality.trim()) {
      return res.status(400).json({ success: false, message: 'Locality or area name is required.' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Please provide a descriptive explanation (at least 10 characters).' });
    }

    const validCategories = [
      'Pipeline Leakage',
      'Water Contamination',
      'Low Water Pressure',
      'Odor / Discoloration',
      'Supply Disruption',
      'Sensor Calibration / Wrong Reading',
      'Other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: `Invalid category. Allowed: ${validCategories.join(', ')}` });
    }

    const trackingId = await generateUniqueTrackingId();
    const userId = req.user ? req.user.id : null;

    const initialAudit = {
      action: 'Complaint Registered',
      details: 'Complaint received and logged in system with individual tracking identity.',
      actor: submitterName.trim(),
      actorRole: req.user ? req.user.role : 'CITIZEN',
      timestamp: new Date().toISOString()
    };

    const newDoc = await ComplaintRepo.create({
      trackingId,
      userId,
      submitterName: submitterName.trim(),
      submitterEmail: submitterEmail.trim().toLowerCase(),
      submitterPhone: submitterPhone.trim(),
      category,
      locality: locality.trim(),
      landmark: (landmark || '').trim(),
      pincode: (pincode || '').trim(),
      stationId: (stationId || '').trim(),
      description: description.trim(),
      status: 'Submitted',
      priority: priority && ['Low', 'Medium', 'High', 'Critical'].includes(priority) ? priority : 'Medium',
      communityIssueRef: null,
      auditLog: [initialAudit],
      resolutionSummary: '',
      resolvedAt: null
    });

    return res.status(201).json({
      success: true,
      message: `Complaint submitted successfully. Your tracking ID is ${trackingId}.`,
      trackingId,
      complaint: {
        _id: newDoc._id || newDoc.id,
        trackingId: newDoc.trackingId,
        category: newDoc.category,
        locality: newDoc.locality,
        status: newDoc.status,
        createdAt: newDoc.createdAt
      }
    });
  } catch (err) {
    console.error('Complaint submission error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing complaint submission.' });
  }
};

exports.trackComplaintPublic = async (req, res) => {
  try {
    const { trackingId } = req.params;
    if (!trackingId || !trackingId.trim()) {
      return res.status(400).json({ success: false, message: 'Tracking ID is required.' });
    }

    const tid = trackingId.trim().toUpperCase();
    const complaint = await ComplaintRepo.findOne({ trackingId: tid });
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `No complaint found with tracking reference "${tid}". Please check the ID and try again.`
      });
    }

    // Prepare privacy-safe citizen tracking view (no personal submitter identity exposed)
    const publicTracking = {
      trackingId: complaint.trackingId,
      category: complaint.category,
      locality: complaint.locality,
      landmark: complaint.landmark,
      status: complaint.status,
      priority: complaint.priority,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      resolutionSummary: complaint.resolutionSummary || null,
      resolvedAt: complaint.resolvedAt || null,
      auditLog: (complaint.auditLog || []).map(entry => ({
        action: entry.action,
        details: entry.details,
        timestamp: entry.timestamp
      })),
      communityIssue: null
    };

    // If linked to a Community Issue, fetch public progress updates only
    if (complaint.communityIssueRef) {
      const issue = await CommunityIssueRepo.findOne({ issueRef: complaint.communityIssueRef });
      if (issue) {
        publicTracking.communityIssue = {
          issueRef: issue.issueRef,
          title: issue.title,
          category: issue.category,
          locality: issue.locality,
          status: issue.status,
          priority: issue.priority,
          assignedTeam: issue.assignedTeam,
          linkedReportsCount: issue.linkedCount || (issue.linkedComplaintIds || []).length,
          lastUpdated: issue.updatedAt,
          publicUpdates: (issue.publicUpdates || []).map(u => ({
            id: u.id,
            message: u.message,
            publishedAt: u.publishedAt
          })),
          resolutionSummary: issue.resolutionSummary || null
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: publicTracking
    });
  } catch (err) {
    console.error('Public complaint tracking error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving complaint tracking details.' });
  }
};

exports.getMyComplaints = async (req, res) => {
  try {
    const userEmail = (req.user.email || '').toLowerCase();
    const userId = req.user.id;

    const complaints = await ComplaintRepo.find({
      $or: [
        { userId: userId },
        { submitterEmail: userEmail }
      ]
    }, { createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving user complaints.' });
  }
};

exports.getAllComplaints = async (req, res) => {
  try {
    const { status, category, locality, unlinkedOnly, search } = req.query;

    const query = {};
    if (status && status !== 'ALL') query.status = status;
    if (category && category !== 'ALL') query.category = category;
    if (locality && locality !== 'ALL') query.locality = locality;
    if (unlinkedOnly === 'true') {
      query.communityIssueRef = null;
    }

    let results = await ComplaintRepo.find(query, { createdAt: -1 });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(c =>
        (c.trackingId && c.trackingId.toLowerCase().includes(q)) ||
        (c.locality && c.locality.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.submitterName && c.submitterName.toLowerCase().includes(q))
      );
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      complaints: results
    });
  } catch (err) {
    console.error('Get all complaints error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving complaints.' });
  }
};

exports.getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    let complaint = await ComplaintRepo.findOne({
      $or: [{ _id: id }, { trackingId: id.toUpperCase() }]
    });

    if (!complaint) {
      complaint = await ComplaintRepo.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Role-based privacy: regular user can only view their own complaint
    if (req.user.role !== 'ADMIN') {
      const isOwner = (complaint.userId && complaint.userId === req.user.id) ||
                      (complaint.submitterEmail && complaint.submitterEmail.toLowerCase() === req.user.email.toLowerCase());
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied to this complaint record.' });
      }
    }

    let linkedCommunityIssue = null;
    if (complaint.communityIssueRef) {
      linkedCommunityIssue = await CommunityIssueRepo.findOne({ issueRef: complaint.communityIssueRef });
    }

    return res.status(200).json({
      success: true,
      complaint,
      linkedCommunityIssue
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving complaint details.' });
  }
};

exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, resolutionSummary } = req.body;

    const validStatuses = ['Submitted', 'Under Review', 'Investigating', 'Action in Progress', 'Resolved', 'Closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Permitted: ${validStatuses.join(', ')}` });
    }

    let complaint = await ComplaintRepo.findById(id);
    if (!complaint) {
      complaint = await ComplaintRepo.findOne({ trackingId: id.toUpperCase() });
    }
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const oldStatus = complaint.status;
    const auditEntry = {
      action: `Status Changed to ${status}`,
      details: reason ? `Reason: ${reason.trim()}` : `Updated by administrator from ${oldStatus} to ${status}.`,
      actor: req.user.name,
      actorRole: req.user.role,
      timestamp: new Date().toISOString()
    };

    const updatePayload = {
      status,
      auditLog: [...(complaint.auditLog || []), auditEntry]
    };

    if (status === 'Resolved' || status === 'Closed') {
      if (resolutionSummary) {
        updatePayload.resolutionSummary = resolutionSummary.trim();
      }
      updatePayload.resolvedAt = new Date().toISOString();
    }

    const updated = await ComplaintRepo.findByIdAndUpdate(complaint._id || complaint.id, updatePayload, { new: true });

    return res.status(200).json({
      success: true,
      message: `Complaint ${complaint.trackingId} status updated to ${status}.`,
      complaint: updated
    });
  } catch (err) {
    console.error('Update complaint status error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating complaint status.' });
  }
};
