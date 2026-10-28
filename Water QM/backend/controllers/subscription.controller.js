const crypto = require('crypto');
const { SubscriptionRepo, UserRepo } = require('../storage/repository');

exports.createOrder = async (req, res) => {
  try {
    const { plan = 'Pro', amount = 499 } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
    const amountStr = `₹${amount}`;

    const newSub = await SubscriptionRepo.create({
      userId,
      userEmail,
      plan: `${plan} Plan`,
      amount: amountStr,
      currency: 'INR',
      orderId,
      paymentId: '',
      status: 'created',
      date: new Date().toLocaleDateString('en-US')
    });

    return res.status(201).json({
      success: true,
      message: 'Razorpay order created.',
      orderId,
      amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_aquamonitor2026',
      subscriptionId: newSub._id || newSub.id
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating payment order.' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, plan = 'PRO' } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required for verification.' });
    }

    const sub = await SubscriptionRepo.findOne({ orderId });
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Order transaction not found.' });
    }

    const payId = paymentId || `pay_${crypto.randomBytes(9).toString('hex')}`;

    // Update Subscription Record to PAID
    const updatedSub = await SubscriptionRepo.findByIdAndUpdate(sub._id || sub.id, {
      paymentId: payId,
      status: 'paid',
      updatedAt: new Date().toISOString()
    }, { new: true });

    // Upgrade the user account to PRO
    await UserRepo.findByIdAndUpdate(req.user.id, {
      plan: plan.toUpperCase() === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO'
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully! Your account has been upgraded to Pro.',
      plan: 'PRO',
      paymentId: payId,
      subscription: updatedSub
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ success: false, message: 'Server error verifying transaction.' });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    let query = {};

    // Regular users see only their transactions; Admins see all user transactions (image24)
    if (!isAdmin) {
      query.userId = req.user.id;
    }

    const history = await SubscriptionRepo.find(query, { createdAt: -1 });

    return res.status(200).json({
      success: true,
      isAdmin,
      currentPlan: req.user.plan,
      transactions: history
    });
  } catch (err) {
    console.error('Payment history error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving transactions.' });
  }
};
