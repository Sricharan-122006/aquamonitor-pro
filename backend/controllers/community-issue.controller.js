const crypto = require('crypto');
const {
  CommunityIssueRepo,
  ComplaintRepo,
  CommunityNotificationRepo,
  UserRepo
} = require('../storage/repository');
const { findRelatedComplaints, evaluateComplaintMatch } = require('../services/duplicate-detection.service');

// Generate sequential/unique Issue Reference e.g. ISS-0001
async function generateUniqueIssueRef() {
  const all = await CommunityIssueRepo.find({});
  let maxNum = 0;
  for (const item of all) {
    if (item.issueRef && item.issueRef.startsWith('ISS-')) {
      const num = parseInt(item.issueRef.replace('ISS-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `ISS-${String(nextNum).padStart(4, '0')}`;
}

// 1. Overview Summary Stats
exports.getOverviewStats = async (req, res) => {
  try {
    const issues = await CommunityIssueRepo.find({});
    const now = Date.now();
    const INACTIVITY_THRESHOLD_HOURS = 48;

    const totalIssues = issues.length;
    let newIssues = 0;
    let underInvestigation = 0;
    let actionInProgress = 0;
    let resolved = 0;
    let requiringAttention = 0;
    let unassignedCount = 0;

    for (const issue of issues) {
      const status = issue.status || 'New';
      if (status === 'New') newIssues++;
      else if (status === 'Under Investigation') underInvestigation++;
      else if (status === 'Action in Progress') actionInProgress++;
      else if (status === 'Resolved' || status === 'Closed') resolved++;

      const isUnassigned = !issue.assignedTeam || issue.assignedTeam === 'Unassigned';
      if (isUnassigned) unassignedCount++;

      // Requiring attention criteria:
      // - Open issue that is High or Critical priority and unassigned
      // - Or open issue with no activity for > 48 hours
      const isResolved = status === 'Resolved' || status === 'Closed';
      if (!isResolved) {
        const lastUpdatedTime = new Date(issue.updatedAt || issue.createdAt || now).getTime();
        const hoursInactive = (now - lastUpdatedTime) / (1000 * 60 * 60);
        const isHighOrCritical = issue.priority === 'High' || issue.priority === 'Critical';

        if ((isHighOrCritical && isUnassigned) || hoursInactive >= INACTIVITY_THRESHOLD_HOURS) {
          requiringAttention++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalIssues,
        newIssues,
        underInvestigation,
        actionInProgress,
        resolved,
        requiringAttention,
        unassignedCount,
        thresholds: {
          inactivityHours: INACTIVITY_THRESHOLD_HOURS,
          policy: 'Open issues unassigned with High/Critical priority, or no updates for over 48 hours.'
        }
      }
    });
  } catch (err) {
    console.error('Overview stats error:', err);
    return res.status(500).json({ success: false, message: 'Server error calculating overview statistics.' });
  }
};

// 2. List Community Issues with filters and search
exports.getCommunityIssues = async (req, res) => {
  try {
    const { status, category, priority, locality, assignedTeam, unassignedOnly, search, sort } = req.query;

    let issues = await CommunityIssueRepo.find({}, { createdAt: -1 });

    if (status && status !== 'ALL') {
      issues = issues.filter(i => i.status === status);
    }
    if (category && category !== 'ALL') {
      issues = issues.filter(i => i.category === category);
    }
    if (priority && priority !== 'ALL') {
      issues = issues.filter(i => i.priority === priority);
    }
    if (locality && locality !== 'ALL') {
      issues = issues.filter(i => i.locality && i.locality.toLowerCase() === locality.toLowerCase());
    }
    if (assignedTeam && assignedTeam !== 'ALL') {
      issues = issues.filter(i => i.assignedTeam === assignedTeam);
    }
    if (unassignedOnly === 'true') {
      issues = issues.filter(i => !i.assignedTeam || i.assignedTeam === 'Unassigned');
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      issues = issues.filter(i =>
        (i.issueRef && i.issueRef.toLowerCase().includes(q)) ||
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.locality && i.locality.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sort === 'priority') {
      const weight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      issues.sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0));
    } else if (sort === 'linkedCount') {
      issues.sort((a, b) => (b.linkedCount || 0) - (a.linkedCount || 0));
    } else if (sort === 'updatedAt') {
      issues.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    } else {
      // Default newest
      issues.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return res.status(200).json({
      success: true,
      count: issues.length,
      issues
    });
  } catch (err) {
    console.error('Get community issues error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving community issues.' });
  }
};

// 3. Get Single Community Issue by ID or Reference
exports.getCommunityIssueById = async (req, res) => {
  try {
    const { id } = req.params;
    let issue = await CommunityIssueRepo.findOne({
      $or: [{ _id: id }, { issueRef: id.toUpperCase() }]
    });

    if (!issue) {
      issue = await CommunityIssueRepo.findById(id);
    }

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found.' });
    }

    // Fetch linked complaints
    const linkedIds = issue.linkedComplaintIds || [];
    let linkedComplaints = [];
    if (linkedIds.length > 0) {
      const allComplaints = await ComplaintRepo.find({});
      linkedComplaints = allComplaints.filter(c =>
        linkedIds.includes(String(c._id || c.id)) ||
        linkedIds.includes(c.trackingId) ||
        c.communityIssueRef === issue.issueRef
      );
    }

    // Calculate time elapsed since last activity
    const lastActive = new Date(issue.updatedAt || issue.createdAt || Date.now());
    const hoursElapsed = Math.max(0, Math.round((Date.now() - lastActive.getTime()) / (1000 * 60 * 60)));

    return res.status(200).json({
      success: true,
      issue: {
        ...issue,
        hoursSinceLastUpdate: hoursElapsed,
        linkedCount: linkedComplaints.length
      },
      linkedComplaints
    });
  } catch (err) {
    console.error('Get community issue details error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving issue details.' });
  }
};

// 4. Create Community Issue
exports.createCommunityIssue = async (req, res) => {
  try {
    const {
      title,
      category,
      locality,
      locationDetails,
      stationId,
      description,
      priority,
      assignedTeam,
      initialNote,
      initialComplaintIds
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Issue title is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Issue category is required.' });
    }
    if (!locality || !locality.trim()) {
      return res.status(400).json({ success: false, message: 'Locality is required.' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Description must be at least 10 characters.' });
    }

    const issueRef = await generateUniqueIssueRef();
    const adminActor = req.user ? req.user.name : 'Administrator';
    const adminRole = req.user ? req.user.role : 'ADMIN';

    // Activity timeline initialization
    const activityTimeline = [
      {
        id: crypto.randomUUID(),
        action: 'Issue Created',
        details: `Community issue "${title.trim()}" initialized by ${adminActor}.`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      }
    ];

    const internalNotes = [];
    if (initialNote && initialNote.trim()) {
      internalNotes.push({
        id: crypto.randomUUID(),
        note: initialNote.trim(),
        author: adminActor,
        authorRole: adminRole,
        createdAt: new Date().toISOString()
      });
      activityTimeline.push({
        id: crypto.randomUUID(),
        action: 'Investigation Note Added',
        details: 'Initial internal assessment recorded.',
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      });
    }

    // Process initial linked complaints if supplied
    const linkedComplaintIds = [];
    if (Array.isArray(initialComplaintIds) && initialComplaintIds.length > 0) {
      for (const cId of initialComplaintIds) {
        let comp = await ComplaintRepo.findById(cId);
        if (!comp) {
          comp = await ComplaintRepo.findOne({ trackingId: cId });
        }
        if (comp) {
          const compIdStr = String(comp._id || comp.id);
          if (!linkedComplaintIds.includes(compIdStr)) {
            linkedComplaintIds.push(compIdStr);

            // Update complaint linking reference & append audit log
            const auditEntry = {
              action: `Linked to Community Issue ${issueRef}`,
              details: `Grouped under common community issue "${title.trim()}". Individual tracking preserved.`,
              actor: adminActor,
              actorRole: adminRole,
              timestamp: new Date().toISOString()
            };

            await ComplaintRepo.findByIdAndUpdate(compIdStr, {
              communityIssueRef: issueRef,
              auditLog: [...(comp.auditLog || []), auditEntry]
            });
          }
        }
      }

      if (linkedComplaintIds.length > 0) {
        activityTimeline.push({
          id: crypto.randomUUID(),
          action: 'Related Complaints Linked',
          details: `${linkedComplaintIds.length} citizen complaint(s) linked under this common issue.`,
          actor: adminActor,
          actorRole: adminRole,
          timestamp: new Date().toISOString()
        });
      }
    }

    const newIssue = await CommunityIssueRepo.create({
      issueRef,
      title: title.trim(),
      category,
      locality: locality.trim(),
      locationDetails: (locationDetails || '').trim(),
      stationId: (stationId || '').trim(),
      description: description.trim(),
      priority: priority && ['Low', 'Medium', 'High', 'Critical'].includes(priority) ? priority : 'Medium',
      status: 'New',
      assignedTo: assignedTeam && assignedTeam !== 'Unassigned' ? assignedTeam : 'Unassigned',
      assignedTeam: assignedTeam || 'Unassigned',
      linkedComplaintIds,
      linkedCount: linkedComplaintIds.length,
      internalNotes,
      publicUpdates: [],
      activityTimeline,
      resolutionSummary: '',
      resolvedBy: '',
      resolvedAt: null,
      reopenHistory: []
    });

    // Persist notification for admin dashboard
    if (newIssue.priority === 'High' || newIssue.priority === 'Critical') {
      await CommunityNotificationRepo.create({
        type: 'HIGH_PRIORITY',
        title: `High Priority Issue Created: ${issueRef}`,
        message: `${newIssue.title} in ${newIssue.locality} logged with ${newIssue.priority} priority. Immediate assignment recommended.`,
        issueRef,
        priority: newIssue.priority,
        read: false
      });
    } else {
      await CommunityNotificationRepo.create({
        type: 'NEW_ISSUE',
        title: `New Community Issue: ${issueRef}`,
        message: `${newIssue.title} in ${newIssue.locality} recorded and awaiting review.`,
        issueRef,
        priority: newIssue.priority,
        read: false
      });
    }

    return res.status(201).json({
      success: true,
      message: `Community Issue ${issueRef} created successfully.`,
      issue: newIssue
    });
  } catch (err) {
    console.error('Create community issue error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating community issue.' });
  }
};

// 5. Update permitted metadata fields
exports.updateCommunityIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, locality, locationDetails, description, priority, assignedTeam } = req.body;

    let issue = await CommunityIssueRepo.findById(id);
    if (!issue) {
      issue = await CommunityIssueRepo.findOne({ issueRef: id.toUpperCase() });
    }
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found.' });
    }

    const adminActor = req.user ? req.user.name : 'Administrator';
    const adminRole = req.user ? req.user.role : 'ADMIN';
    const updates = {};
    const timelineEvents = [];

    if (title && title.trim() && title.trim() !== issue.title) {
      updates.title = title.trim();
    }
    if (category && category !== issue.category) {
      updates.category = category;
      timelineEvents.push({
        id: crypto.randomUUID(),
        action: 'Category Changed',
        details: `Category updated from "${issue.category}" to "${category}".`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      });
    }
    if (locality && locality.trim() && locality.trim() !== issue.locality) {
      updates.locality = locality.trim();
    }
    if (locationDetails !== undefined) {
      updates.locationDetails = (locationDetails || '').trim();
    }
    if (description && description.trim() && description.trim() !== issue.description) {
      updates.description = description.trim();
    }
    if (priority && priority !== issue.priority) {
      updates.priority = priority;
      timelineEvents.push({
        id: crypto.randomUUID(),
        action: 'Priority Updated',
        details: `Priority adjusted from ${issue.priority} to ${priority}.`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      });
    }
    if (assignedTeam !== undefined && assignedTeam !== issue.assignedTeam) {
      updates.assignedTeam = assignedTeam;
      updates.assignedTo = assignedTeam !== 'Unassigned' ? assignedTeam : 'Unassigned';
      timelineEvents.push({
        id: crypto.randomUUID(),
        action: 'Assignment Changed',
        details: `Responsibility assigned to "${assignedTeam}".`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      });
    }

    if (timelineEvents.length > 0) {
      updates.activityTimeline = [...(issue.activityTimeline || []), ...timelineEvents];
    }

    const updated = await CommunityIssueRepo.findByIdAndUpdate(issue._id || issue.id, updates, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Issue details updated successfully.',
      issue: updated
    });
  } catch (err) {
    console.error('Update issue error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating issue details.' });
  }
};

// 6. Controlled Status Workflow
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionSummary, reopenReason, syncComplaints } = req.body;

    const validStatuses = [
      'New',
      'Under Investigation',
      'Action in Progress',
      'Awaiting Verification',
      'Resolved',
      'Closed',
      'Reopened'
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Permitted: ${validStatuses.join(', ')}` });
    }

    let issue = await CommunityIssueRepo.findById(id);
    if (!issue) {
      issue = await CommunityIssueRepo.findOne({ issueRef: id.toUpperCase() });
    }
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found.' });
    }

    const currentStatus = issue.status;
    if (currentStatus === status) {
      return res.status(400).json({ success: false, message: `Issue is already in status "${status}".` });
    }

    // Permitted transitions validation
    const allowedTransitions = {
      'New': ['Under Investigation', 'Action in Progress', 'Resolved', 'Closed'],
      'Under Investigation': ['Action in Progress', 'Awaiting Verification', 'Resolved', 'Closed'],
      'Action in Progress': ['Awaiting Verification', 'Resolved', 'Closed'],
      'Awaiting Verification': ['Action in Progress', 'Resolved', 'Closed', 'Under Investigation'],
      'Resolved': ['Reopened', 'Closed'],
      'Closed': ['Reopened'],
      'Reopened': ['Under Investigation', 'Action in Progress', 'Awaiting Verification', 'Resolved', 'Closed']
    };

    const permittedNext = allowedTransitions[currentStatus] || [];
    if (!permittedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from "${currentStatus}" to "${status}". Allowed next steps: ${permittedNext.join(', ')}`
      });
    }

    const adminActor = req.user ? req.user.name : 'Administrator';
    const adminRole = req.user ? req.user.role : 'ADMIN';
    const updates = { status };
    const timelineEvents = [];

    // Resolution requirements
    if (status === 'Resolved' || status === 'Closed') {
      if (!resolutionSummary || resolutionSummary.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'A concise resolution summary is required before marking an issue as resolved.'
        });
      }
      updates.resolutionSummary = resolutionSummary.trim();
      updates.resolvedBy = adminActor;
      updates.resolvedAt = new Date().toISOString();

      timelineEvents.push({
        id: crypto.randomUUID(),
        action: `Issue ${status}`,
        details: `Resolution summary recorded: "${resolutionSummary.trim()}".`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      });

      // Persist confirmation notification
      await CommunityNotificationRepo.create({
        type: 'RESOLUTION_CONFIRMED',
        title: `Community Issue Resolved: ${issue.issueRef}`,
        message: `${issue.title} resolved by ${adminActor}.`,
        issueRef: issue.issueRef,
        priority: issue.priority,
        read: false
      });
    } else if (status === 'Reopened') {
      if (!reopenReason || reopenReason.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'A valid reason is required to reopen an issue.'
        });
      }
      const reopenEntry = {
        reason: reopenReason.trim(),
        reopenedBy: adminActor,
        reopenedAt: new Date().toISOString()
      };
      updates.reopenHistory = [...(issue.reopenHistory || []), reopenEntry];

      timelineEvents.push({
        id: crypto.randomUUID(),
        action: 'Issue Reopened',
        details: `Reopened by ${adminActor}. Reason: "${reopenReason.trim()}".`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      });

      await CommunityNotificationRepo.create({
        type: 'ISSUE_REOPENED',
        title: `Issue Reopened: ${issue.issueRef}`,
        message: `${issue.title} was reopened. Reason: ${reopenReason.trim()}`,
        issueRef: issue.issueRef,
        priority: 'High',
        read: false
      });
    } else {
      timelineEvents.push({
        id: crypto.randomUUID(),
        action: `Status Transition to ${status}`,
        details: `Status advanced from ${currentStatus} to ${status}.`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      });
    }

    updates.activityTimeline = [...(issue.activityTimeline || []), ...timelineEvents];

    const updatedIssue = await CommunityIssueRepo.findByIdAndUpdate(issue._id || issue.id, updates, { new: true });

    // Propagate status update to linked complaints if requested
    if (syncComplaints === true && (issue.linkedComplaintIds || []).length > 0) {
      let targetComplaintStatus = 'Investigating';
      if (status === 'Action in Progress') targetComplaintStatus = 'Action in Progress';
      else if (status === 'Resolved' || status === 'Closed') targetComplaintStatus = 'Resolved';
      else if (status === 'Under Investigation') targetComplaintStatus = 'Under Review';

      for (const compId of issue.linkedComplaintIds) {
        let comp = await ComplaintRepo.findById(compId);
        if (!comp) comp = await ComplaintRepo.findOne({ trackingId: compId });
        if (comp) {
          const cId = String(comp._id || comp.id);
          const audit = {
            action: `Synchronized with Issue ${issue.issueRef} (${status})`,
            details: `Status moved to ${targetComplaintStatus} following community issue progression.`,
            actor: adminActor,
            actorRole: adminRole,
            timestamp: new Date().toISOString()
          };
          const compUpdate = {
            status: targetComplaintStatus,
            auditLog: [...(comp.auditLog || []), audit]
          };
          if (status === 'Resolved' && resolutionSummary) {
            compUpdate.resolutionSummary = resolutionSummary.trim();
            compUpdate.resolvedAt = new Date().toISOString();
          }
          await ComplaintRepo.findByIdAndUpdate(cId, compUpdate);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Community Issue ${issue.issueRef} status successfully changed to ${status}.`,
      issue: updatedIssue
    });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating status.' });
  }
};

// 7. Link Complaints to Community Issue
exports.linkComplaints = async (req, res) => {
  try {
    const { id } = req.params;
    const { complaintIds } = req.body;

    if (!Array.isArray(complaintIds) || complaintIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one complaint to link.' });
    }

    let issue = await CommunityIssueRepo.findById(id);
    if (!issue) {
      issue = await CommunityIssueRepo.findOne({ issueRef: id.toUpperCase() });
    }
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found.' });
    }

    const currentLinked = new Set((issue.linkedComplaintIds || []).map(String));
    const newlyLinkedIds = [];
    const newlyLinkedTrackings = [];
    const adminActor = req.user ? req.user.name : 'Administrator';
    const adminRole = req.user ? req.user.role : 'ADMIN';

    for (const cId of complaintIds) {
      let comp = await ComplaintRepo.findById(cId);
      if (!comp) comp = await ComplaintRepo.findOne({ trackingId: cId });
      if (!comp) continue;

      const compIdStr = String(comp._id || comp.id);

      // Prevent duplicate linking
      if (currentLinked.has(compIdStr) || currentLinked.has(comp.trackingId)) {
        continue;
      }

      newlyLinkedIds.push(compIdStr);
      newlyLinkedTrackings.push(comp.trackingId);

      // Update individual complaint record
      const auditEntry = {
        action: `Linked to Community Issue ${issue.issueRef}`,
        details: `Linked by ${adminActor} under shared issue "${issue.title}". Original tracking ID and history preserved.`,
        actor: adminActor,
        actorRole: adminRole,
        timestamp: new Date().toISOString()
      };

      await ComplaintRepo.findByIdAndUpdate(compIdStr, {
        communityIssueRef: issue.issueRef,
        auditLog: [...(comp.auditLog || []), auditEntry]
      });
    }

    if (newlyLinkedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All selected complaints are already linked to this issue.'
      });
    }

    const updatedLinkedIds = [...(issue.linkedComplaintIds || []), ...newlyLinkedIds];
    const timelineEntry = {
      id: crypto.randomUUID(),
      action: 'Complaints Linked',
      details: `${newlyLinkedTrackings.length} complaint(s) (${newlyLinkedTrackings.join(', ')}) linked by ${adminActor}.`,
      actor: adminActor,
      actorRole: adminRole,
      timestamp: new Date().toISOString()
    };

    const updatedIssue = await CommunityIssueRepo.findByIdAndUpdate(issue._id || issue.id, {
      linkedComplaintIds: updatedLinkedIds,
      linkedCount: updatedLinkedIds.length,
      activityTimeline: [...(issue.activityTimeline || []), timelineEntry]
    }, { new: true });

    // Persist notification
    await CommunityNotificationRepo.create({
      type: 'NEW_COMPLAINT_LINKED',
      title: `${newlyLinkedTrackings.length} Complaint(s) Linked to ${issue.issueRef}`,
      message: `Complaints ${newlyLinkedTrackings.join(', ')} grouped under ${issue.title}.`,
      issueRef: issue.issueRef,
      priority: issue.priority,
      read: false
    });

    return res.status(200).json({
      success: true,
      message: `Successfully linked ${newlyLinkedTrackings.length} complaint(s) to ${issue.issueRef}.`,
      linkedTrackings: newlyLinkedTrackings,
      issue: updatedIssue
    });
  } catch (err) {
    console.error('Link complaints error:', err);
    return res.status(500).json({ success: false, message: 'Server error linking complaints.' });
  }
};

// 8. Unlink Complaint from Community Issue
exports.unlinkComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { complaintId, reason } = req.body;

    if (!complaintId) {
      return res.status(400).json({ success: false, message: 'Complaint ID or tracking ID is required.' });
    }
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'A specific reason is required to unlink a complaint.' });
    }

    let issue = await CommunityIssueRepo.findById(id);
    if (!issue) {
      issue = await CommunityIssueRepo.findOne({ issueRef: id.toUpperCase() });
    }
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found.' });
    }

    let comp = await ComplaintRepo.findById(complaintId);
    if (!comp) comp = await ComplaintRepo.findOne({ trackingId: complaintId });
    if (!comp) {
      return res.status(404).json({ success: false, message: 'Complaint record not found.' });
    }

    const compIdStr = String(comp._id || comp.id);
    const trackingId = comp.trackingId;
    const adminActor = req.user ? req.user.name : 'Administrator';
    const adminRole = req.user ? req.user.role : 'ADMIN';

    // Remove from linked list
    const currentLinked = (issue.linkedComplaintIds || []).map(String);
    const filteredLinked = currentLinked.filter(x => x !== compIdStr && x !== trackingId);

    // Update complaint: clear issueRef and append audit log with reason
    const auditEntry = {
      action: `Unlinked from Community Issue ${issue.issueRef}`,
      details: `Unlinked by ${adminActor}. Reason: "${reason.trim()}". Retaining standalone complaint tracking.`,
      actor: adminActor,
      actorRole: adminRole,
      timestamp: new Date().toISOString()
    };

    await ComplaintRepo.findByIdAndUpdate(compIdStr, {
      communityIssueRef: null,
      auditLog: [...(comp.auditLog || []), auditEntry]
    });

    // Update community issue
    const timelineEntry = {
      id: crypto.randomUUID(),
      action: 'Complaint Unlinked',
      details: `Complaint ${trackingId} unlinked by ${adminActor}. Reason: "${reason.trim()}".`,
      actor: adminActor,
      actorRole: adminRole,
      timestamp: new Date().toISOString()
    };

    const updatedIssue = await CommunityIssueRepo.findByIdAndUpdate(issue._id || issue.id, {
      linkedComplaintIds: filteredLinked,
      linkedCount: filteredLinked.length,
      activityTimeline: [...(issue.activityTimeline || []), timelineEntry]
    }, { new: true });

    return res.status(200).json({
      success: true,
      message: `Complaint ${trackingId} unlinked from ${issue.issueRef}. Standalone record preserved.`,
      issue: updatedIssue
    });
  } catch (err) {
    console.error('Unlink complaint error:', err);
    return res.status(500).json({ success: false, message: 'Server error unlinking complaint.' });
  }
};

// 9. Add Internal Investigation Note (Staff-Only)
exports.addInternalNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note content cannot be empty.' });
    }

    let issue = await CommunityIssueRepo.findById(id);
    if (!issue) {
      issue = await CommunityIssueRepo.findOne({ issueRef: id.toUpperCase() });
    }
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found.' });
    }

    const adminActor = req.user ? req.user.name : 'Administrator';
    const adminRole = req.user ? req.user.role : 'ADMIN';

    const newNote = {
      id: crypto.randomUUID(),
      note: note.trim(),
      author: adminActor,
      authorRole: adminRole,
      createdAt: new Date().toISOString()
    };

    const timelineEntry = {
      id: crypto.randomUUID(),
      action: 'Internal Note Added',
      details: `Staff investigation note recorded by ${adminActor}.`,
      actor: adminActor,
      actorRole: adminRole,
      timestamp: new Date().toISOString()
    };

    const updated = await CommunityIssueRepo.findByIdAndUpdate(issue._id || issue.id, {
      internalNotes: [...(issue.internalNotes || []), newNote],
      activityTimeline: [...(issue.activityTimeline || []), timelineEntry]
    }, { new: true });

    return res.status(201).json({
      success: true,
      message: 'Internal investigation note saved.',
      note: newNote,
      issue: updated
    });
  } catch (err) {
    console.error('Add internal note error:', err);
    return res.status(500).json({ success: false, message: 'Server error saving note.' });
  }
};

// 10. Publish Public Progress Update (Visible to complainants & public tracking)
exports.addPublicUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Public update message must be at least 5 characters.' });
    }

    let issue = await CommunityIssueRepo.findById(id);
    if (!issue) {
      issue = await CommunityIssueRepo.findOne({ issueRef: id.toUpperCase() });
    }
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Community issue not found.' });
    }

    const adminActor = req.user ? req.user.name : 'Administrator';
    const adminRole = req.user ? req.user.role : 'ADMIN';

    const newUpdate = {
      id: crypto.randomUUID(),
      message: message.trim(),
      publishedBy: adminActor,
      publishedAt: new Date().toISOString()
    };

    const timelineEntry = {
      id: crypto.randomUUID(),
      action: 'Public Progress Update Published',
      details: `Official update shared with affected citizens: "${message.trim()}".`,
      actor: adminActor,
      actorRole: adminRole,
      timestamp: new Date().toISOString()
    };

    const updated = await CommunityIssueRepo.findByIdAndUpdate(issue._id || issue.id, {
      publicUpdates: [...(issue.publicUpdates || []), newUpdate],
      activityTimeline: [...(issue.activityTimeline || []), timelineEntry]
    }, { new: true });

    return res.status(201).json({
      success: true,
      message: 'Public progress update published successfully.',
      publicUpdate: newUpdate,
      issue: updated
    });
  } catch (err) {
    console.error('Add public update error:', err);
    return res.status(500).json({ success: false, message: 'Server error publishing update.' });
  }
};

// 11. Duplicate Complaint Detection / Related Suggestions
exports.getDuplicateSuggestions = async (req, res) => {
  try {
    const { issueId, complaintId, category, locality, stationId } = req.query;

    let reference = { category, locality, stationId };
    let currentLinkedIds = [];

    if (issueId) {
      let issue = await CommunityIssueRepo.findById(issueId);
      if (!issue) issue = await CommunityIssueRepo.findOne({ issueRef: issueId.toUpperCase() });
      if (issue) {
        reference = {
          title: issue.title,
          category: issue.category,
          locality: issue.locality,
          stationId: issue.stationId,
          description: issue.description,
          createdAt: issue.createdAt
        };
        currentLinkedIds = issue.linkedComplaintIds || [];
      }
    } else if (complaintId) {
      let comp = await ComplaintRepo.findById(complaintId);
      if (!comp) comp = await ComplaintRepo.findOne({ trackingId: complaintId });
      if (comp) {
        reference = comp;
      }
    }

    const allComplaints = await ComplaintRepo.find({});
    const suggestions = findRelatedComplaints(reference, allComplaints, currentLinkedIds);

    return res.status(200).json({
      success: true,
      count: suggestions.length,
      reference: {
        category: reference.category || 'N/A',
        locality: reference.locality || 'N/A'
      },
      notice: 'Suggestions evaluate locality proximity, category, submission time, and description keywords. Administrator confirmation is required before linking.',
      suggestions
    });
  } catch (err) {
    console.error('Duplicate suggestions error:', err);
    return res.status(500).json({ success: false, message: 'Server error generating duplicate suggestions.' });
  }
};

// 12. Persisted Admin Notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await CommunityNotificationRepo.find({}, { createdAt: -1 });
    const unreadCount = notifications.filter(n => !n.read).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      notifications: notifications.slice(0, 30)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await CommunityNotificationRepo.findByIdAndUpdate(id, { read: true }, { new: true });
    return res.status(200).json({ success: true, notification: notif });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error updating notification.' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const notifications = await CommunityNotificationRepo.find({});
    for (const n of notifications) {
      if (!n.read) {
        await CommunityNotificationRepo.findByIdAndUpdate(n._id || n.id, { read: true });
      }
    }
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error marking notifications read.' });
  }
};
