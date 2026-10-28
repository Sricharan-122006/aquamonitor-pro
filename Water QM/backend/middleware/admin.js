function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required for this operation.'
    });
  }
  next();
}

module.exports = adminMiddleware;
