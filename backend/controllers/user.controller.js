const { UserRepo } = require('../storage/repository');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await UserRepo.find({}, { createdAt: -1 });

    const safeUsers = users.map(u => ({
      id: u._id || u.id,
      name: u.name,
      email: u.email,
      organization: u.organization || '—',
      plan: u.plan || 'FREE',
      role: u.role || 'USER',
      joined: u.joined || '4/26/2026',
      createdAt: u.createdAt
    }));

    return res.status(200).json({
      success: true,
      count: safeUsers.length,
      users: safeUsers
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving registered users.' });
  }
};

exports.makeAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await UserRepo.findById(id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(400).json({ success: false, message: 'User is already an Administrator.' });
    }

    const updated = await UserRepo.findByIdAndUpdate(id, {
      role: 'ADMIN',
      plan: 'ENTERPRISE'
    }, { new: true });

    return res.status(200).json({
      success: true,
      message: `User ${updated.name} has been promoted to Administrator.`,
      user: {
        id: updated._id || updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        plan: updated.plan
      }
    });
  } catch (err) {
    console.error('Make admin error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating user role.' });
  }
};
