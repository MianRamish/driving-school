const jwt = require('jsonwebtoken');

const createToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

module.exports = createToken;
