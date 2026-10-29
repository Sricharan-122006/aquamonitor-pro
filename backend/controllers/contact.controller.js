const { ContactRepo } = require('../storage/repository');
const { sendContactForwardEmail } = require('../services/email.service');

exports.submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Your name is required.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!subject || !subject.trim() || subject === 'Select a topic...') {
      return res.status(400).json({ success: false, message: 'Please select a subject or topic.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const newContact = await ContactRepo.create({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      read: false,
      emailForwarded: false,
      dateString: new Date().toLocaleString('en-US')
    });

    // Forward to Administrator Email in background
    sendContactForwardEmail({
      name: newContact.name,
      email: newContact.email,
      subject: newContact.subject,
      message: newContact.message
    }).then(result => {
      if (result.success) {
        ContactRepo.findByIdAndUpdate(newContact._id || newContact.id, { emailForwarded: true });
      }
    }).catch(err => {
      console.warn('Background email forward error:', err.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully. Our team will review and respond within 24 hours.',
      data: newContact
    });
  } catch (err) {
    console.error('Contact submission error:', err);
    return res.status(500).json({ success: false, message: 'Server error sending message.' });
  }
};

exports.getAdminMessages = async (req, res) => {
  try {
    const messages = await ContactRepo.find({}, { createdAt: -1 });
    const unreadCount = messages.filter(m => !m.read).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      count: messages.length,
      messages
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving contact messages.' });
  }
};

exports.markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await ContactRepo.findById(id);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const updated = await ContactRepo.findByIdAndUpdate(id, { read: true }, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Message marked as read.',
      messageData: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error marking message as read.' });
  }
};
